using System.Diagnostics;
using System.Runtime.CompilerServices;
using System.Text.Json;
using Gamsdaq.Api.Diagnostics;
using Gamsdaq.Api.Models;
using Gamsdaq.Api.Security;
using Gamsdaq.Api.Tools;
using GitHub.Copilot;
using Microsoft.Agents.AI;
using Microsoft.Extensions.AI;

namespace Gamsdaq.Api.Agents;

public record ToolInvocationRequest(string ToolName, Dictionary<string, object?> Arguments);
public record ToolInvocationPlan(List<ToolInvocationRequest> Calls, string? UpstreamAgent = null, object? HandoffContext = null);
public record AgentHandoffEnvelope(string UpstreamAgent, string DownstreamAgent, string Objective, Dictionary<string, object?> State);

public record AgentToolBatchResult(string ExecutionMode, double LatencyMs, List<AgentToolExecution> ToolCalls, string? CopilotReasoning = null)
{
    public T Read<T>(string toolName) =>
        ToolCalls.Last(call => call.ToolName == toolName).Result.Deserialize<T>(CopilotSdkChatClientAdapter.JsonOptions)
        ?? throw new InvalidOperationException($"Tool {toolName} returned no {typeof(T).Name} result.");
}

/// <summary>
/// Bridges Microsoft.Agents.AI (ChatClientAgent / IChatClient) with GitHub.Copilot.SDK (CopilotClient / CopilotSession).
/// Bound AIFunction tools are registered on SessionConfig.Tools for native Copilot SDK tool-calling RPC,
/// with deterministic AIFunction execution as a resilient fallback when offline or unauthenticated.
/// </summary>
public sealed class CopilotSdkChatClientAdapter : IChatClient, IAsyncDisposable
{
    internal static readonly JsonSerializerOptions JsonOptions = new(JsonSerializerDefaults.Web);
    private readonly ILogger<CopilotSdkChatClientAdapter> _logger;
    private readonly Lazy<CopilotClient> _copilotClient;
    private readonly Func<IReadOnlyList<ChatMessage>, IReadOnlyDictionary<string, AIFunction>, CancellationToken, Task<ToolInvocationPlan?>>? _modelToolPlanner;
    private readonly Func<string, CancellationToken, Task<string?>>? _copilotSynthesizer;
    private readonly Func<SessionConfig, MessageOptions, CancellationToken, Task<string?>>? _sessionResponder;
    private int _disposed;
    private string _lastToolExecutionMode = "NOT_EXECUTED";

    public string ConnectionStatus { get; private set; } =
        ResolveGitHubToken() is not null ? "CONNECTED_COPILOT_SDK_LIVE" : "RESILIENT_FALLBACK_DETERMINISTIC_AIFUNCTION";
    public string LastToolExecutionMode => Volatile.Read(ref _lastToolExecutionMode);
    public static IReadOnlyList<string> SupportedExecutionModes { get; } = Array.AsReadOnly(new[]
    {
        "NOT_EXECUTED", "DETERMINISTIC_AIFUNCTION", "COPILOT_SDK_SYNTHESIS_WITH_AIFUNCTION",
        "COPILOT_SDK_MODEL_DIRECTED_AIFUNCTION", "COPILOT_SDK_NATIVE_AIFUNCTION"
    });

    public CopilotSdkChatClientAdapter(
        ILogger<CopilotSdkChatClientAdapter> logger,
        Func<IReadOnlyList<ChatMessage>, IReadOnlyDictionary<string, AIFunction>, CancellationToken, Task<ToolInvocationPlan?>>? modelToolPlanner = null,
        Func<string, CancellationToken, Task<string?>>? copilotSynthesizer = null,
        Func<SessionConfig, MessageOptions, CancellationToken, Task<string?>>? sessionResponder = null)
    {
        _logger = logger;
        _modelToolPlanner = modelToolPlanner;
        _copilotSynthesizer = copilotSynthesizer;
        _sessionResponder = sessionResponder;
        _copilotClient = new Lazy<CopilotClient>(() => new CopilotClient(new CopilotClientOptions
        {
            GitHubToken = ResolveGitHubToken(),
            Logger = _logger,
            Telemetry = new TelemetryConfig
            {
                SourceName = GamsdaqTelemetry.CopilotActivitySourceName
            }
        }));
    }

    public static string? ResolveGitHubToken()
    {
        var token = Environment.GetEnvironmentVariable("COPILOT_GITHUB_TOKEN")
                 ?? Environment.GetEnvironmentVariable("GITHUB_TOKEN");
        return string.IsNullOrWhiteSpace(token) ? null : token;
    }

    public static SessionConfig BuildSessionConfig(
        string? systemInstructions,
        IReadOnlyDictionary<string, AIFunction> functions,
        string? model = null) =>
        new()
        {
            Model = model ?? Environment.GetEnvironmentVariable("COPILOT_MODEL") ?? "claude-haiku-4.5",
            Tools = functions.Values.Cast<AIFunctionDeclaration>().ToList(),
            AvailableTools = functions.Keys.ToList(),
            OnPermissionRequest = PermissionHandler.ApproveAll,
            SystemMessage = string.IsNullOrWhiteSpace(systemInstructions)
                ? null
                : new SystemMessageConfig
                {
                    Mode = SystemMessageMode.Append,
                    Content = systemInstructions
                }
        };

    public static MessageOptions BuildMessageOptions(string prompt, string? upstreamAgent = null) =>
        new()
        {
            Prompt = prompt,
            Source = !string.IsNullOrWhiteSpace(upstreamAgent)
                ? MessageSource.Agent(upstreamAgent)
                : MessageSource.User
        };

    public ChatClientMetadata Metadata => new("GitHub.Copilot.SDK", null, "copilot-market-agent");

    private async Task<string?> SendSessionAsync(string systemText, IReadOnlyDictionary<string, AIFunction> functions,
        string prompt, string? upstreamAgent, TimeSpan timeout, CancellationToken cancellationToken)
    {
        var config = BuildSessionConfig(systemText, functions);
        var message = BuildMessageOptions(prompt, upstreamAgent);
        if (_sessionResponder is not null)
            return await _sessionResponder(config, message, cancellationToken);
        await using var session = await _copilotClient.Value.CreateSessionAsync(config, cancellationToken);
        var reply = await session.SendAndWaitAsync(message, timeout, cancellationToken);
        return reply?.Data?.Content;
    }

    private sealed class SessionAIFunction(AIFunction inner,
        Func<AIFunctionArguments, CancellationToken, ValueTask<object?>> invoke) : DelegatingAIFunction(inner)
    {
        // SDK callbacks can arrive on RPC threads without the request's AsyncLocal workspace.
        private readonly ExecutionContext? _context = ExecutionContext.Capture();

        protected override ValueTask<object?> InvokeCoreAsync(AIFunctionArguments arguments, CancellationToken cancellationToken)
        {
            if (_context is null) return invoke(arguments, cancellationToken);
            ValueTask<object?> result = default;
            ExecutionContext.Run(_context.CreateCopy(), _ => result = invoke(arguments, cancellationToken), null);
            return result;
        }
    }

    public async Task<ChatResponse> GetResponseAsync(
        IEnumerable<ChatMessage> messages,
        ChatOptions? options = null,
        CancellationToken cancellationToken = default)
    {
        ObjectDisposedException.ThrowIf(_disposed != 0, this);
        cancellationToken.ThrowIfCancellationRequested();
        var history = messages.ToList();
        var systemText = string.Join("\n", history.Where(m => m.Role == ChatRole.System).Select(m => m.Text).Where(t => !string.IsNullOrWhiteSpace(t)));
        var userText = history.LastOrDefault(message => message.Role == ChatRole.User)?.Text ?? "";
        if (options?.Tools?.Any(tool => tool is not AIFunction) == true)
        {
            throw new NotSupportedException("Deterministic execution supports bound AIFunction tools only.");
        }
        var functions = options?.Tools?.OfType<AIFunction>().ToDictionary(function => function.Name)
            ?? new Dictionary<string, AIFunction>();
        if (functions.Count == 0)
        {
            // No fictitious "verified" response if the SDK is unavailable.
            await using var session = await _copilotClient.Value.CreateSessionAsync(
                BuildSessionConfig(systemText, functions), cancellationToken);
            var reply = await session.SendAndWaitAsync(
                BuildMessageOptions(userText), TimeSpan.FromSeconds(30), cancellationToken);
            if (reply is null) throw new InvalidOperationException("Copilot SDK returned no response.");
            ConnectionStatus = "CONNECTED_COPILOT_SDK_LIVE";
            return new ChatResponse(new ChatMessage(ChatRole.Assistant, reply.Data.Content));
        }

        var started = Stopwatch.GetTimestamp();
        var executions = new List<AgentToolExecution>();
        var responseMessages = new List<ChatMessage>();
        var envelope = TryParseHandoffEnvelope(userText);
        var dynamicState = envelope?.State is not null
            ? new Dictionary<string, object?>(envelope.State, StringComparer.OrdinalIgnoreCase)
            : new Dictionary<string, object?>(StringComparer.OrdinalIgnoreCase);
        using var toolGate = new SemaphoreSlim(1, 1);
        var nativeInvocationKeys = new HashSet<string>(StringComparer.Ordinal);
        bool nativeExecuted = false;
        Exception? toolFailure = null;

        static string InvocationKey(string name, Dictionary<string, object?> arguments) =>
            name + ":" + JsonSerializer.Serialize(arguments.OrderBy(pair => pair.Key).ToDictionary(pair => pair.Key, pair => pair.Value), JsonOptions);

        async ValueTask<object?> InvokeTrackedAsync(AIFunction function, AIFunctionArguments supplied, bool native, CancellationToken token)
        {
            using var linkedCancellation = CancellationTokenSource.CreateLinkedTokenSource(token, cancellationToken);
            await toolGate.WaitAsync(linkedCancellation.Token);
            try
            {
                using var activity = GamsdaqTelemetry.ActivitySource.StartActivity($"tool.{function.Name}");
                activity?.SetTag("tool.name", function.Name);
                activity?.SetTag("tool.native", native);
                var callId = Guid.NewGuid().ToString("N");
                var resolvedArgs = ResolveChainedArguments(new Dictionary<string, object?>(supplied), function, dynamicState);
                var key = InvocationKey(function.Name, resolvedArgs);
                var callStarted = Stopwatch.GetTimestamp();
                object? result;
                try
                {
                    result = await function.InvokeAsync(new AIFunctionArguments(resolvedArgs), linkedCancellation.Token);
                }
                catch (Exception exception)
                {
                    toolFailure = exception;
                    activity?.SetStatus(ActivityStatusCode.Error, exception.Message);
                    _logger.LogWarning("Tool {ToolName} failed with {ExceptionType}", function.Name, exception.GetType().Name);
                    throw;
                }
                var output = JsonSerializer.SerializeToElement(result, JsonOptions);
                MergeToolOutputIntoState(output, dynamicState);
                executions.Add(new AgentToolExecution(callId, function.Name,
                    Stopwatch.GetElapsedTime(callStarted).TotalMilliseconds, output));
                responseMessages.Add(new ChatMessage(ChatRole.Assistant, [
                    new FunctionCallContent(callId, function.Name, resolvedArgs)]));
                responseMessages.Add(new ChatMessage(ChatRole.Tool, [new FunctionResultContent(callId, output)]));
                if (native)
                {
                    nativeExecuted = true;
                    nativeInvocationKeys.Add(key);
                    Volatile.Write(ref _lastToolExecutionMode, "COPILOT_SDK_NATIVE_AIFUNCTION");
                }
                return result;
            }
            finally
            {
                toolGate.Release();
            }
        }

        var sessionFunctions = functions.ToDictionary(pair => pair.Key,
            pair => (AIFunction)new SessionAIFunction(pair.Value,
                (arguments, token) => InvokeTrackedAsync(pair.Value, arguments, true, token)));
        var (plan, modelSelectedTools, liveSessionSummary, _) = await ResolveToolPlanAsync(history, systemText, userText, sessionFunctions, cancellationToken);
        if (toolFailure is not null) System.Runtime.ExceptionServices.ExceptionDispatchInfo.Capture(toolFailure).Throw();
        if (plan.Calls.Count == 0) throw new InvalidOperationException("At least one bound tool invocation is required.");
        // Validate the complete allowlist before executing the returned plan.
        foreach (var call in plan.Calls)
            if (!functions.ContainsKey(call.ToolName))
                throw new InvalidOperationException($"Tool '{call.ToolName}' is not bound to this agent.");

        foreach (var call in plan.Calls)
        {
            cancellationToken.ThrowIfCancellationRequested();
            var resolvedArgs = ResolveChainedArguments(call.Arguments, functions[call.ToolName], dynamicState);
            if (nativeInvocationKeys.Remove(InvocationKey(call.ToolName, resolvedArgs))) continue;
            await InvokeTrackedAsync(functions[call.ToolName], new AIFunctionArguments(resolvedArgs), false, cancellationToken);
        }

        var batchMode = modelSelectedTools ? "COPILOT_SDK_MODEL_DIRECTED_AIFUNCTION" : "DETERMINISTIC_AIFUNCTION";
        string? copilotReasoning = liveSessionSummary;
        if (!string.IsNullOrWhiteSpace(copilotReasoning))
        {
            batchMode = modelSelectedTools
                ? "COPILOT_SDK_MODEL_DIRECTED_AIFUNCTION"
                : "COPILOT_SDK_SYNTHESIS_WITH_AIFUNCTION";
            ConnectionStatus = "CONNECTED_COPILOT_SDK_LIVE";
        }
        else if (_copilotSynthesizer is not null || (!nativeExecuted && (_sessionResponder is not null || ResolveGitHubToken() is not null)))
        {
            try
            {
                var toolSummary = string.Join(", ", executions.Select(e => $"{e.ToolName}=>{e.Result.GetRawText()}"));
                string? summary;
                if (_copilotSynthesizer is not null)
                {
                    summary = await _copilotSynthesizer(toolSummary, cancellationToken);
                }
                else
                {
                    summary = await SendSessionAsync(systemText, new Dictionary<string, AIFunction>(),
                        $"Summarize produce verification step concisely in Korean based on tool outputs: {toolSummary}",
                        envelope?.UpstreamAgent ?? plan.UpstreamAgent, TimeSpan.FromSeconds(10), cancellationToken);
                }
                cancellationToken.ThrowIfCancellationRequested();
                if (!string.IsNullOrWhiteSpace(summary))
                {
                    copilotReasoning = summary;
                    batchMode = modelSelectedTools
                        ? "COPILOT_SDK_MODEL_DIRECTED_AIFUNCTION"
                        : "COPILOT_SDK_SYNTHESIS_WITH_AIFUNCTION";
                    ConnectionStatus = "CONNECTED_COPILOT_SDK_LIVE";
                }
            }
            catch (Exception ex) when (ex is not OperationCanceledException || !cancellationToken.IsCancellationRequested)
            {
                if (!nativeExecuted)
                {
                    ConnectionStatus = $"RESILIENT_FALLBACK_DETERMINISTIC_AIFUNCTION ({ex.GetType().Name})";
                }
                _logger.LogInformation("Copilot live synthesis skipped ({Message}); using deterministic AIFunction output.", ex.Message);
            }
        }

        if (toolFailure is not null) System.Runtime.ExceptionServices.ExceptionDispatchInfo.Capture(toolFailure).Throw();
        if (nativeExecuted)
        {
            batchMode = "COPILOT_SDK_NATIVE_AIFUNCTION";
            ConnectionStatus = "CONNECTED_COPILOT_SDK_LIVE";
        }
        Volatile.Write(ref _lastToolExecutionMode, batchMode);
        var batch = new AgentToolBatchResult(batchMode, Stopwatch.GetElapsedTime(started).TotalMilliseconds, executions, copilotReasoning);
        responseMessages.Add(new ChatMessage(ChatRole.Assistant, JsonSerializer.Serialize(batch, JsonOptions)));
        return new ChatResponse(responseMessages)
        {
            ResponseId = Guid.NewGuid().ToString("N"),
            CreatedAt = DateTimeOffset.UtcNow,
            AdditionalProperties = new AdditionalPropertiesDictionary
            {
                ["executionMode"] = batch.ExecutionMode,
                ["latencyMs"] = batch.LatencyMs,
                ["toolCalls"] = executions,
                ["copilotReasoning"] = copilotReasoning
            }
        };
    }

    private async Task<(ToolInvocationPlan Plan, bool ModelSelected, string? LiveSummary, AgentHandoffEnvelope? Envelope)> ResolveToolPlanAsync(
        IReadOnlyList<ChatMessage> history,
        string systemText,
        string userText,
        Dictionary<string, AIFunction> functions,
        CancellationToken cancellationToken)
    {
        var envelope = TryParseHandoffEnvelope(userText);
        if (_modelToolPlanner is not null)
        {
            var planned = await _modelToolPlanner(history, functions, cancellationToken);
            if (planned is { Calls.Count: > 0 })
            {
                ConnectionStatus = "CONNECTED_COPILOT_SDK_LIVE";
                return (planned, true, null, envelope);
            }
        }
        else if (_sessionResponder is not null || ResolveGitHubToken() is not null)
        {
            try
            {
                var toolSchemas = functions.Values.Select(f => new { f.Name, f.Description, Schema = f.JsonSchema });
                var prompt = $"Select bound tools to invoke as JSON {{\"calls\":[{{\"toolName\":\"...\",\"arguments\":{{...}}}}]}} or invoke the main bound tool once and summarize in one Korean sentence. Available tools: {JsonSerializer.Serialize(toolSchemas, JsonOptions)}. Input: {userText}";
                var reply = await SendSessionAsync(systemText, functions, prompt,
                    envelope?.UpstreamAgent, TimeSpan.FromSeconds(15), cancellationToken);
                if (!string.IsNullOrWhiteSpace(reply))
                {
                    try
                    {
                        var modelPlan = JsonSerializer.Deserialize<ToolInvocationPlan>(reply, JsonOptions);
                        if (modelPlan is { Calls.Count: > 0 } && modelPlan.Calls.All(c => functions.ContainsKey(c.ToolName)))
                        {
                            ConnectionStatus = "CONNECTED_COPILOT_SDK_LIVE";
                            return (modelPlan, true, null, envelope);
                        }
                    }
                    catch (JsonException)
                    {
                        ConnectionStatus = "CONNECTED_COPILOT_SDK_LIVE";
                        var fallbackPlan = envelope is not null
                            ? PlanFromBoundAgentTools(envelope, functions)
                            : ParsePlan(userText, functions);
                        return (fallbackPlan, false, reply.Trim(), envelope);
                    }
                }
            }
            catch (Exception ex) when (ex is not OperationCanceledException || !cancellationToken.IsCancellationRequested)
            {
                ConnectionStatus = $"RESILIENT_FALLBACK_DETERMINISTIC_AIFUNCTION ({ex.GetType().Name})";
            }
        }

        if (envelope is not null)
        {
            return (PlanFromBoundAgentTools(envelope, functions), false, null, envelope);
        }

        return (ParsePlan(userText, functions), false, null, null);
    }

    private static AgentHandoffEnvelope? TryParseHandoffEnvelope(string text)
    {
        try
        {
            var json = JsonSerializer.Deserialize<JsonElement>(text);
            if (json.ValueKind == JsonValueKind.Object
                && json.TryGetProperty("objective", out _)
                && json.TryGetProperty("state", out _))
            {
                return json.Deserialize<AgentHandoffEnvelope>(JsonOptions);
            }
        }
        catch (JsonException)
        {
        }
        return null;
    }

    private static ToolInvocationPlan PlanFromBoundAgentTools(
        AgentHandoffEnvelope envelope,
        Dictionary<string, AIFunction> functions)
    {
        var calls = new List<ToolInvocationRequest>();
        var stateJson = JsonSerializer.SerializeToElement(envelope.State, JsonOptions);
        var candidates = stateJson.TryGetProperty("candidates", out var candEl) && candEl.ValueKind == JsonValueKind.Array
            ? candEl.Deserialize<List<EcommerceCandidate>>(JsonOptions)
            : null;
        var targetWeightKg = stateJson.TryGetProperty("targetWeightKg", out var wEl) && wEl.ValueKind == JsonValueKind.Number
            ? wEl.GetDecimal()
            : 0m;
        var tickerCode = stateJson.TryGetProperty("tickerCode", out var tEl) && tEl.ValueKind == JsonValueKind.String
            ? tEl.GetString()
            : null;

        foreach (var function in functions.Values)
        {
            var schema = function.JsonSchema;
            if (!schema.TryGetProperty("properties", out var properties))
            {
                calls.Add(new ToolInvocationRequest(function.Name, new Dictionary<string, object?>()));
                continue;
            }

            // Expand single-candidate evaluation tools across candidate arrays when present in state.
            if (candidates is { Count: > 0 } && properties.TryGetProperty("listedPrice", out _) && properties.TryGetProperty("shippingFee", out _))
            {
                foreach (var candidate in candidates.Where(c => c.ListedWeightKg > 0 && c.ListedPrice >= 0 && c.ShippingFee >= 0))
                {
                    calls.Add(new ToolInvocationRequest(function.Name, new Dictionary<string, object?>
                    {
                        ["listedPrice"] = candidate.ListedPrice,
                        ["shippingFee"] = candidate.ShippingFee,
                        ["actualWeightKg"] = candidate.ListedWeightKg,
                        ["targetWeightKg"] = targetWeightKg
                    }));
                }
                continue;
            }

            if (candidates is { Count: > 0 } && properties.TryGetProperty("candidate", out _))
            {
                foreach (var candidate in candidates)
                {
                    calls.Add(new ToolInvocationRequest(function.Name, new Dictionary<string, object?>
                    {
                        ["tickerCode"] = tickerCode,
                        ["candidate"] = candidate
                    }));
                }
                continue;
            }

            var values = new Dictionary<string, object?>();
            foreach (var prop in properties.EnumerateObject())
            {
                if (stateJson.TryGetProperty(prop.Name, out var val) && val.ValueKind != JsonValueKind.Null)
                {
                    values[prop.Name] = val;
                }
            }
            calls.Add(new ToolInvocationRequest(function.Name, values));
        }

        return new ToolInvocationPlan(calls, envelope.UpstreamAgent, envelope.State);
    }

    private static Dictionary<string, object?> ResolveChainedArguments(
        Dictionary<string, object?> initialArgs,
        AIFunction function,
        Dictionary<string, object?> dynamicState)
    {
        var resolved = new Dictionary<string, object?>(initialArgs, StringComparer.OrdinalIgnoreCase);
        if (!function.JsonSchema.TryGetProperty("properties", out var properties))
        {
            return resolved;
        }
        foreach (var prop in properties.EnumerateObject())
        {
            // Missing evidence (including null) must never be replaced by a model's claim.
            if (dynamicState.TryGetValue(prop.Name, out var chained))
            {
                resolved[prop.Name] = chained;
            }
        }
        return resolved;
    }

    private static void MergeToolOutputIntoState(JsonElement output, Dictionary<string, object?> dynamicState)
    {
        if (output.ValueKind != JsonValueKind.Object) return;
        foreach (var prop in output.EnumerateObject())
        {
            if (prop.Value.ValueKind != JsonValueKind.Undefined)
            {
                dynamicState[prop.Name] = prop.Value;
            }
        }
    }

    private static ToolInvocationPlan ParsePlan(string text, Dictionary<string, AIFunction> functions)
    {
        JsonElement? arguments = null;
        try
        {
            var json = JsonSerializer.Deserialize<JsonElement>(text);
            if (json.ValueKind == JsonValueKind.Object && json.TryGetProperty("calls", out _))
            {
                return json.Deserialize<ToolInvocationPlan>(JsonOptions)
                    ?? throw new InvalidOperationException("Invalid tool invocation plan.");
            }
            if (json.ValueKind == JsonValueKind.Object) arguments = json;
        }
        catch (JsonException)
        {
            // Plain text can bind to a single required string argument; numbers are never inferred.
        }

        var calls = new List<ToolInvocationRequest>();
        foreach (var function in functions.Values)
        {
            var values = new Dictionary<string, object?>();
            var schema = function.JsonSchema;
            if (arguments is { } supplied)
            {
                if (schema.TryGetProperty("properties", out var properties))
                {
                    foreach (var property in properties.EnumerateObject())
                    {
                        if (supplied.TryGetProperty(property.Name, out var value)) values[property.Name] = value;
                    }
                }
            }
            else if (schema.TryGetProperty("required", out var required) && required.GetArrayLength() > 0)
            {
                if (required.GetArrayLength() != 1)
                    throw new InvalidOperationException($"Explicit structured arguments are required for {function.Name}.");
                var name = required[0].GetString()!;
                if (schema.GetProperty("properties").GetProperty(name).GetProperty("type").GetString() != "string")
                    throw new InvalidOperationException($"Explicit structured arguments are required for {function.Name}.");
                values[name] = text;
            }
            calls.Add(new ToolInvocationRequest(function.Name, values));
        }
        return new ToolInvocationPlan(calls);
    }

    public async IAsyncEnumerable<ChatResponseUpdate> GetStreamingResponseAsync(
        IEnumerable<ChatMessage> messages,
        ChatOptions? options = null,
        [EnumeratorCancellation] CancellationToken cancellationToken = default)
    {
        var response = await GetResponseAsync(messages, options, cancellationToken);
        foreach (var message in response.Messages)
        {
            cancellationToken.ThrowIfCancellationRequested();
            yield return new ChatResponseUpdate
            {
                Role = message.Role,
                Contents = message.Contents,
                ResponseId = response.ResponseId,
                AdditionalProperties = response.AdditionalProperties
            };
        }
    }

    public object? GetService(Type serviceType, object? serviceKey = null)
    {
        ObjectDisposedException.ThrowIf(_disposed != 0, this);
        if (serviceKey is not null) return null;
        if (serviceType == typeof(ChatClientMetadata)) return Metadata;
        if (serviceType == typeof(CopilotClient)) return _copilotClient.Value;
        return serviceType.IsInstanceOfType(this) ? this : null;
    }

    public void Dispose() => DisposeAsync().AsTask().GetAwaiter().GetResult();

    public async ValueTask DisposeAsync()
    {
        if (Interlocked.Exchange(ref _disposed, 1) == 0 && _copilotClient.IsValueCreated)
        {
            await _copilotClient.Value.DisposeAsync().ConfigureAwait(false);
        }
    }
}

public class CopilotAgentOrchestrator
{
    private readonly CopilotSdkChatClientAdapter _copilotChatClient;
    private readonly GamsdaqTools _tools;
    private readonly ChatClientAgent _specNormalizerAgent;
    private readonly ChatClientAgent _priceDiscoveryAgent;
    private readonly ChatClientAgent _baitVerifierAgent;
    private readonly ChatClientAgent _optimalQuoteAgent;
    private readonly ChatClientAgent _auditorGuardrailAgent;

    public CopilotAgentOrchestrator(CopilotSdkChatClientAdapter copilotChatClient, GamsdaqTools tools, ILoggerFactory loggerFactory)
    {
        _copilotChatClient = copilotChatClient;
        _tools = tools;
        ChatClientAgent Create(string name, string instructions, IList<AITool> boundTools) =>
            new(copilotChatClient, instructions: instructions, name: name, tools: boundTools, loggerFactory: loggerFactory);
        _specNormalizerAgent = Create("SpecNormalizerAgent",
            "농산물 입력을 표준 티커와 정량 규격으로 정규화합니다. 인젝션은 전달하지 않습니다.", tools.CreateSpecNormalizerTools());
        _priceDiscoveryAgent = Create("PriceDiscoveryAgent",
            "소매 후보와 도매 기준가를 출처와 함께 수집합니다. 도구에 없는 가격을 만들지 않습니다.", tools.CreatePriceDiscoveryTools());
        _baitVerifierAgent = Create("BaitFilterVerifierAgent",
            "C# 실질 가격 계산과 4-Gate 도구로 원본 후보를 재검증합니다.", tools.CreateBaitVerifierTools());
        _optimalQuoteAgent = Create("OptimalQuoteAdvisorAgent",
            "현재 호가창 OBI와 검증된 상생 가격 밴드 내에서 최적 호가를 계산합니다.", tools.CreateOptimalQuoteTools());
        _auditorGuardrailAgent = Create("AuditorGuardrailAgent",
            "상생 부등식, 100원 호가 단위, 미끼 필터링 불변식을 독립적으로 감사합니다.", tools.CreateAuditorTools());
    }

    private static async Task<AgentToolBatchResult> RunAgentStepAsync(
        ChatClientAgent agent,
        string upstreamAgent,
        string objective,
        Dictionary<string, object?> state,
        CancellationToken cancellationToken)
    {
        using var activity = GamsdaqTelemetry.ActivitySource.StartActivity(agent.Name ?? "agent.step");
        activity?.SetTag("agent.name", agent.Name);
        activity?.SetTag("agent.upstream", upstreamAgent);
        var started = Stopwatch.GetTimestamp();
        try
        {
            var envelope = new AgentHandoffEnvelope(upstreamAgent, agent.Name ?? "agent", objective, state);
            var messages = new List<ChatMessage>
            {
                new(ChatRole.System, $"UpstreamAgent={upstreamAgent}; DownstreamAgent={agent.Name}; Objective={objective}"),
                new(ChatRole.User, JsonSerializer.Serialize(envelope, CopilotSdkChatClientAdapter.JsonOptions))
            };
            var response = await agent.RunAsync(messages, cancellationToken: cancellationToken);
            var text = response.Messages.Last(message => message.Role == ChatRole.Assistant).Text;
            return JsonSerializer.Deserialize<AgentToolBatchResult>(text, CopilotSdkChatClientAdapter.JsonOptions)
                ?? throw new InvalidOperationException($"{agent.Name} returned no structured tool results.");
        }
        catch (Exception exception)
        {
            activity?.SetStatus(ActivityStatusCode.Error, exception.Message);
            throw;
        }
        finally
        {
            var tag = new KeyValuePair<string, object?>("agent.name", agent.Name);
            GamsdaqTelemetry.AgentSteps.Add(1, tag);
            GamsdaqTelemetry.AgentStepLatency.Record(Stopwatch.GetElapsedTime(started).TotalMilliseconds, tag);
        }
    }

    private static AgentStreamEvent Event(string step, ChatClientAgent agent, string status, string summary,
        object? payload, AgentToolBatchResult execution) =>
        new(step, agent.Name!, status, string.Join(" + ", execution.ToolCalls.Select(call => call.ToolName).Distinct()),
            summary, payload, DateTime.UtcNow, execution.LatencyMs, execution.ToolCalls, execution.ExecutionMode);

    public async IAsyncEnumerable<AgentStreamEvent> RunVerificationStreamAsync(
        AgentVerifyRequest request,
        [EnumeratorCancellation] CancellationToken cancellationToken = default)
    {
        cancellationToken.ThrowIfCancellationRequested();
        using var activity = GamsdaqTelemetry.ActivitySource.StartActivity("verification.pipeline");
        var query = string.IsNullOrWhiteSpace(request.Query)
            ? (request.TickerCode == "CD-BANSI-13B-5KG" ? "청도 명품 반시 대과 5kg 20박스" : "12브릭스 노지 감귤 3kg 10박스")
            : request.Query;
        var (safe, sanitizedQuery, rejection) = PromptShieldGuardrail.ValidateAndSanitize(query);
        if (!safe)
        {
            yield return new AgentStreamEvent("STEP-0", "PromptShieldGuardrail", "BLOCKED", "ValidateAndSanitize",
                rejection ?? "입력 차단", null, DateTime.UtcNow);
            yield break;
        }

        AgentToolBatchResult specExecution;
        NormalizedSpecResult spec;
        string? specRejectedReason = null;
        try
        {
            specExecution = await RunAgentStepAsync(
                _specNormalizerAgent,
                upstreamAgent: "PromptShieldGuardrail",
                objective: "사용자 입력에서 품목·당도·중량·수량을 정규화하고 표준 티커 규격을 조회한다.",
                state: new Dictionary<string, object?>
                {
                    ["inputQuery"] = sanitizedQuery,
                    ["tickerCode"] = request.TickerCode,
                    ["role"] = request.Role
                },
                cancellationToken);
            spec = specExecution.Read<NormalizedSpecResult>("parse_produce_spec");
        }
        catch (ArgumentException ex)
        {
            specRejectedReason = ex.Message;
            specExecution = null!;
            spec = null!;
        }
        if (specRejectedReason is not null)
        {
            yield return new AgentStreamEvent("STEP-1", _specNormalizerAgent.Name!, "SPEC_REJECTED", "parse_produce_spec",
                specRejectedReason, null, DateTime.UtcNow);
            yield break;
        }
        yield return Event("STEP-1", _specNormalizerAgent, "COMPLETED",
            specExecution.CopilotReasoning ?? $"규격 정규화 완료: [{spec.TickerCode}] {spec.StandardName}", spec, specExecution);

        var checkpoint = _tools.CaptureCheckpoint(spec.TickerCode);
        var workspace = _tools.CreateVerificationWorkspace(checkpoint);
        bool committed = false;
        AgentStreamEvent finalEvent;

        async Task<AgentToolBatchResult> RunStagedStepAsync(ChatClientAgent agent, string upstreamAgent,
            string objective, Dictionary<string, object?> state, CancellationToken token)
        {
            // Scope each awaited step separately: AsyncLocal state must not escape an SSE yield.
            using var scope = _tools.UseVerificationWorkspace(workspace);
            return await RunAgentStepAsync(agent, upstreamAgent, objective, state, token);
        }

        try
        {
            var discovery = await RunStagedStepAsync(
                _priceDiscoveryAgent,
                upstreamAgent: _specNormalizerAgent.Name!,
                objective: "표준 티커에 해당하는 온라인 소매 후보군(5건 이상)과 공영도매시장 기준가를 수집한다.",
                state: new Dictionary<string, object?>
                {
                    ["tickerCode"] = spec.TickerCode,
                    ["normalizedSpec"] = spec
                },
                cancellationToken);
            var listings = discovery.Read<List<EcommerceCandidate>>("search_ecommerce_listings");
            var wholesale = discovery.Read<WholesaleBenchmarkResult>("fetch_wholesale_benchmark");
            yield return Event("STEP-2", _priceDiscoveryAgent, "COMPLETED",
                discovery.CopilotReasoning ?? $"원본 소매 후보 {listings.Count}건, 산지 도매 기준가 {wholesale.WholesalePrice:N0}원 확보",
                new { wholesale, candidateCount = listings.Count }, discovery);

            var verification = await RunStagedStepAsync(
                _baitVerifierAgent,
                upstreamAgent: _priceDiscoveryAgent.Name!,
                objective: "모든 소매 후보의 실질 환산가를 계산하고 4-Gate 미끼 필터링을 수행해 실질 최저가를 확정한다.",
                state: new Dictionary<string, object?>
                {
                    ["tickerCode"] = spec.TickerCode,
                    ["targetWeightKg"] = spec.WeightKg,
                    ["candidates"] = listings,
                    ["wholesalePrice"] = wholesale.WholesalePrice
                },
                cancellationToken);
            var baitSummary = verification.Read<BaitVerificationSummary>("verify_four_gate_lowest_price");
            yield return Event("STEP-3", _baitVerifierAgent, "COMPLETED",
                verification.CopilotReasoning ?? $"4-Gate 검증: {baitSummary.RejectedBaitCount}건 제외, 실질 최저가 {baitSummary.VerifiedRetailLowestPrice:N0}원 채택",
                baitSummary, verification);

            async Task<AgentToolBatchResult> QuoteAsync(bool retry) => await RunStagedStepAsync(
                _optimalQuoteAgent,
                upstreamAgent: _baitVerifierAgent.Name!,
                objective: "현재 호가창 잔량(OBI)을 조회하고 상생 가격 밴드 내 최적 추천 호가와 즉시체결 호가를 계산한다.",
                state: new Dictionary<string, object?>
                {
                    ["tickerCode"] = spec.TickerCode,
                    ["minimumPrice"] = retry ? (int?)(wholesale.WholesalePrice + 500) : null,
                    ["maximumPrice"] = retry ? (int?)(baitSummary.VerifiedRetailLowestPrice - 500) : null,
                    ["wholesalePrice"] = wholesale.WholesalePrice,
                    ["verifiedRetailLowestPrice"] = baitSummary.VerifiedRetailLowestPrice
                },
                cancellationToken);

            var quoteExecution = await QuoteAsync(false);
            var optimalQuote = quoteExecution.Read<OptimalQuoteResult>("compute_win_win_optimal_quote");
            var immediateInfo = optimalQuote.ImmediateMatchAskPrice.HasValue || optimalQuote.ImmediateMatchBidPrice.HasValue
                ? $" [즉시체결 매수 {optimalQuote.ImmediateMatchAskPrice ?? optimalQuote.RecommendedOptimalPrice:N0}원 / 매도 {optimalQuote.ImmediateMatchBidPrice ?? optimalQuote.RecommendedOptimalPrice:N0}원]"
                : "";
            yield return Event("STEP-4", _optimalQuoteAgent, "COMPLETED",
                "[감사 대기] " + (quoteExecution.CopilotReasoning ?? $"상생 최적 대기호가 {optimalQuote.RecommendedOptimalPrice:N0}원 (농부 +{optimalQuote.FarmerExtraGainAmount:N0}원 / 소비자 -{optimalQuote.ConsumerSavedAmount:N0}원){immediateInfo}"),
                optimalQuote, quoteExecution);

            var adoptedCandidate = baitSummary.Candidates.FirstOrDefault(c => c.IsPassed && c.Effective3KgOr5KgPrice == baitSummary.VerifiedRetailLowestPrice)
                ?? baitSummary.Candidates.FirstOrDefault(c => c.IsPassed);
            bool hasSourceProvenance = !string.IsNullOrWhiteSpace(wholesale.SourceUrl)
                && adoptedCandidate is not null
                && !string.IsNullOrWhiteSpace(adoptedCandidate.SourceUrl);

            async Task<AgentToolBatchResult> AuditAsync() => await RunStagedStepAsync(
                _auditorGuardrailAgent,
                upstreamAgent: _optimalQuoteAgent.Name!,
                objective: "상생 가격 부등식, 100원 호가 단위, 미끼 필터링, 스펙 일치 및 출처 불변식을 교차 감사한다.",
                state: new Dictionary<string, object?>
                {
                    ["wholesalePrice"] = wholesale.WholesalePrice,
                    ["optimalPrice"] = optimalQuote.RecommendedOptimalPrice,
                    ["retailLowestPrice"] = baitSummary.VerifiedRetailLowestPrice,
                    ["rejectedBaitCount"] = baitSummary.RejectedBaitCount,
                    ["adoptedBrix"] = adoptedCandidate?.GuaranteedBrix,
                    ["targetMinBrix"] = spec.MinBrix,
                    ["adoptedGrade"] = adoptedCandidate?.GradeText,
                    ["targetGrade"] = spec.Grade,
                    ["hasSourceProvenance"] = hasSourceProvenance,
                    ["adoptedSourceUrl"] = adoptedCandidate?.SourceUrl
                },
                cancellationToken);

            const int maxRetries = 2;
            var auditExecution = await AuditAsync();
            var audit = auditExecution.Read<AuditResult>("audit_quote_invariants");
            for (int retry = 1; !audit.AuditPassed && retry <= maxRetries; retry++)
            {
                yield return Event("STEP-5", _auditorGuardrailAgent, "AUDIT_RETRY",
                    $"감사 실패: 안전 가격 경계로 재산출 ({retry}/{maxRetries})", audit, auditExecution);
                quoteExecution = await QuoteAsync(true);
                optimalQuote = quoteExecution.Read<OptimalQuoteResult>("compute_win_win_optimal_quote");
                yield return Event("STEP-4", _optimalQuoteAgent, "COMPLETED",
                    $"[감사 대기] 안전 경계 적용 재산출: {optimalQuote.RecommendedOptimalPrice:N0}원", optimalQuote, quoteExecution);
                auditExecution = await AuditAsync();
                audit = auditExecution.Read<AuditResult>("audit_quote_invariants");
            }

            cancellationToken.ThrowIfCancellationRequested();
            if (audit.AuditPassed)
            {
                committed = _tools.TryCommitVerification(checkpoint, baitSummary, optimalQuote);
                if (!committed)
                    audit = audit with
                    {
                        AuditPassed = false,
                        AuditVerdict = "AUDIT_REJECTED: 감사 중 시장 상태가 변경되어 확정하지 않았습니다. 최신 호가창으로 재검증하세요."
                    };
            }
            if (!committed)
            {
                optimalQuote = optimalQuote with { RecommendedOptimalPrice = 0 };
            }

            finalEvent = Event("STEP-5", _auditorGuardrailAgent, audit.AuditPassed ? "AUDIT_PASSED" : "AUDIT_FAILED",
                audit.AuditVerdict, new { spec, baitVerification = baitSummary, optimalQuote, audit }, auditExecution);
        }
        finally
        {
            // Exceptions, cancellation and early stream disposal roll back only the private workspace.
            // The live market stays unchanged, including concurrent trades and wallet reservations.
            if (!committed)
                _tools.RestoreCheckpoint(spec.TickerCode, checkpoint, workspace);
        }
        yield return finalEvent;
    }

    public NaturalSellerQuoteResponse AnalyzeNaturalSellerInput(string rawInput) =>
        AnalyzeNaturalSellerInputAsync(rawInput).GetAwaiter().GetResult();

    public async Task<NaturalSellerQuoteResponse> AnalyzeNaturalSellerInputAsync(
        string rawInput,
        CancellationToken cancellationToken = default)
    {
        var started = Stopwatch.GetTimestamp();
        var (safe, sanitized, warning) = PromptShieldGuardrail.ValidateAndSanitize(rawInput);
        if (!safe)
        {
            return new NaturalSellerQuoteResponse(false, warning, "JJ-GYUL-12B-3KG", "12브릭스 노지 감귤 3kg",
                0, 0, 0, 0, 0, 0, warning ?? "입력 차단",
                Math.Round(Stopwatch.GetElapsedTime(started).TotalMilliseconds, 2), 3, 0,
                "BLOCKED_BY_GUARDRAIL", _copilotChatClient.ConnectionStatus,
                ["PromptShieldGuardrail"], ["ValidateAndSanitize"], "BLOCKED_BY_PROMPT_SHIELD");
        }

        NormalizedSpecResult? spec = null;
        OptimalQuoteResult? quote = null;
        AuditResult? audit = null;
        int executedSteps = 0;
        var executedAgents = new List<string>();
        var executedTools = new List<string>();
        string? lastExecutionMode = null;
        string? step1Reasoning = null;
        string? step4Reasoning = null;

        await foreach (var evt in RunVerificationStreamAsync(new AgentVerifyRequest(sanitized, "SELLER"), cancellationToken))
        {
            executedSteps++;
            if (!string.IsNullOrWhiteSpace(evt.AgentName) && !executedAgents.Contains(evt.AgentName, StringComparer.Ordinal))
            {
                executedAgents.Add(evt.AgentName);
            }
            if (evt.ToolCalls is { Count: > 0 })
            {
                foreach (var toolCall in evt.ToolCalls)
                {
                    if (!executedTools.Contains(toolCall.ToolName, StringComparer.Ordinal))
                    {
                        executedTools.Add(toolCall.ToolName);
                    }
                }
            }
            if (!string.IsNullOrWhiteSpace(evt.ExecutionMode))
            {
                lastExecutionMode = evt.ExecutionMode;
            }
            if (evt.StepId == "STEP-1" && evt.Payload is NormalizedSpecResult s)
            {
                spec = s;
                step1Reasoning = evt.Summary;
            }
            if (evt.StepId == "STEP-4" && evt.Payload is OptimalQuoteResult q)
            {
                quote = q;
                step4Reasoning = evt.Summary?.Replace("[감사 대기] ", "", StringComparison.Ordinal).Trim();
            }
            if (evt.StepId == "STEP-5" && evt.Status is "AUDIT_PASSED" or "AUDIT_FAILED")
            {
                var json = JsonSerializer.SerializeToElement(evt.Payload, CopilotSdkChatClientAdapter.JsonOptions);
                if (json.TryGetProperty("audit", out var auditEl))
                {
                    audit = auditEl.Deserialize<AuditResult>(CopilotSdkChatClientAdapter.JsonOptions);
                }
            }
        }

        double elapsedMs = Math.Round(Stopwatch.GetElapsedTime(started).TotalMilliseconds, 2);
        string resolvedMode = lastExecutionMode ?? _copilotChatClient.LastToolExecutionMode;
        if (spec is null || quote is null || audit is not { AuditPassed: true })
        {
            return new NaturalSellerQuoteResponse(false, audit?.AuditVerdict ?? "감사 검증 실패",
                spec?.TickerCode ?? "JJ-GYUL-12B-3KG", spec?.StandardName ?? "12브릭스 노지 감귤 3kg",
                0, 0, 0, 0, 0, 0, audit?.AuditVerdict ?? "감사 검증 실패", elapsedMs, 3, executedSteps,
                resolvedMode, _copilotChatClient.ConnectionStatus, executedAgents, executedTools, audit?.AuditVerdict);
        }

        int totalExtra = quote.FarmerExtraGainAmount * spec.ExtractedQuantity;
        string baseReasoning = $"도매가 대비 박스당 +{quote.FarmerExtraGainAmount:N0}원, {spec.ExtractedQuantity}박스 총 +{totalExtra:N0}원 추가 수익을 기대합니다.";
        string reasoningSummary = !string.IsNullOrWhiteSpace(step4Reasoning)
            ? $"{baseReasoning} ({step4Reasoning})"
            : !string.IsNullOrWhiteSpace(step1Reasoning)
                ? $"{baseReasoning} ({step1Reasoning})"
                : baseReasoning;

        return new NaturalSellerQuoteResponse(true, null, spec.TickerCode, spec.StandardName, spec.ExtractedQuantity,
            quote.WholesaleFloorPrice, quote.VerifiedRetailCeilingPrice, quote.RecommendedOptimalPrice,
            quote.FarmerExtraGainAmount, totalExtra,
            reasoningSummary,
            elapsedMs, 3, executedSteps,
            resolvedMode, _copilotChatClient.ConnectionStatus, executedAgents, executedTools, audit.AuditVerdict);
    }
}
