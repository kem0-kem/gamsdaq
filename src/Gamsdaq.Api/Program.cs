using System.Text.Json;
using System.Threading.RateLimiting;
using Gamsdaq.Api.Agents;
using Gamsdaq.Api.Diagnostics;
using Gamsdaq.Api.Matching;
using Gamsdaq.Api.Models;
using Gamsdaq.Api.Tools;
using Microsoft.AspNetCore.RateLimiting;
using OpenTelemetry.Metrics;
using OpenTelemetry.Trace;

var builder = WebApplication.CreateBuilder(args);

builder.Services.AddOpenTelemetry()
    .WithTracing(tracing => tracing
        .AddSource(GamsdaqTelemetry.ActivitySourceName, GamsdaqTelemetry.CopilotActivitySourceName)
        .AddAspNetCoreInstrumentation())
    .WithMetrics(metrics => metrics.AddMeter(GamsdaqTelemetry.MeterName).AddAspNetCoreInstrumentation());

if (!string.IsNullOrWhiteSpace(builder.Configuration["APPLICATIONINSIGHTS_CONNECTION_STRING"]))
{
    builder.Services.AddApplicationInsightsTelemetry();
}
builder.Services.AddCors(options =>
{
    options.AddDefaultPolicy(policy =>
        policy.AllowAnyOrigin().AllowAnyHeader().AllowAnyMethod());
});
builder.Services.AddRateLimiter(options =>
{
    options.RejectionStatusCode = StatusCodes.Status429TooManyRequests;
    options.GlobalLimiter = PartitionedRateLimiter.Create<HttpContext, string>(httpContext =>
        RateLimitPartition.GetFixedWindowLimiter(
            partitionKey: httpContext.Connection.RemoteIpAddress?.ToString() ?? "global",
            factory: _ => new FixedWindowRateLimiterOptions
            {
                PermitLimit = 120,
                Window = TimeSpan.FromMinutes(1),
                QueueProcessingOrder = QueueProcessingOrder.OldestFirst,
                QueueLimit = 20
            }));
});

builder.Services.AddSingleton<MarketEngineService>();
builder.Services.AddSingleton<GamsdaqTools>();
builder.Services.AddSingleton<CopilotSdkChatClientAdapter>();
builder.Services.AddSingleton<CopilotAgentOrchestrator>();

var app = builder.Build();
GamsdaqTelemetry.AttachApplicationInsights(app.Services.GetService<Microsoft.ApplicationInsights.TelemetryClient>());

app.Use(async (context, next) =>
{
    context.Response.Headers["X-Content-Type-Options"] = "nosniff";
    context.Response.Headers["X-Frame-Options"] = "DENY";
    context.Response.Headers["Referrer-Policy"] = "no-referrer";
    context.Response.Headers["X-Permitted-Cross-Domain-Policies"] = "none";

    var path = context.Request.Path.Value ?? string.Empty;
    if (path.Equals("/api/wallet-and-cart", StringComparison.OrdinalIgnoreCase) ||
        path.StartsWith("/api/cart/", StringComparison.OrdinalIgnoreCase))
    {
        context.Response.Headers["Cache-Control"] = "no-store";
    }

    await next();
});

app.UseCors();
app.UseRateLimiter();
app.UseDefaultFiles();
app.UseStaticFiles();

var jsonOptions = new JsonSerializerOptions
{
    PropertyNamingPolicy = JsonNamingPolicy.CamelCase
};

app.MapGet("/api/health", (CopilotSdkChatClientAdapter copilotAdapter) => Results.Ok(new
{
    status = "Healthy",
    service = "Gamsdaq.Api",
    copilotSdk = "GitHub.Copilot.SDK 1.0.29-preview.8",
    agentFramework = "Microsoft.Agents.AI 1.27.0",
    registeredAgents = new[]
    {
        "SpecNormalizerAgent",
        "PriceDiscoveryAgent",
        "BaitFilterVerifierAgent",
        "OptimalQuoteAdvisorAgent",
        "AuditorGuardrailAgent"
    },
    mode = "VIRTUAL_PAPER_TRADING",
    toolExecutionMode = copilotAdapter.LastToolExecutionMode,
    supportedExecutionModes = CopilotSdkChatClientAdapter.SupportedExecutionModes,
    copilotSessionMode = copilotAdapter.ConnectionStatus,
    dataProvenance = "SIMULATED_PUBLIC_BENCHMARK (KAMIS & Open-Market Snapshot 2026-11-05)",
    securityPolicy = new
    {
        piiRetention = "ZERO_RAW_PII_IN_MEMORY_MASKED_ON_INGEST",
        securityHeaders = true,
        rateLimiting = "ACTIVE"
    },
    telemetry = GamsdaqTelemetry.GetSnapshot(),
    tickers = new[] { "JJ-GYUL-12B-3KG", "CD-BANSI-13B-5KG" },
    timestamp = DateTime.UtcNow
}));

app.MapGet("/api/diagnostics/telemetry", () => Results.Ok(GamsdaqTelemetry.GetSnapshot()));

app.MapPost("/api/demo/reset", (MarketEngineService market) =>
    Results.Ok(new
    {
        success = true,
        message = "데모 호가창, 가상 예수금(500,000원), 체결 장바구니가 초기 시드 상태로 복원되었습니다.",
        walletAndCart = market.ResetDemoMarket(),
        tickers = market.GetAllTickers()
    }));

app.MapGet("/api/tickers", (MarketEngineService market) =>
    Results.Ok(market.GetAllTickers()));

app.MapGet("/api/tickers/{tickerCode}/orderbook", (string tickerCode, MarketEngineService market) =>
    Results.Ok(market.GetOrderBook(tickerCode)));

app.MapGet("/api/wallet-and-cart", (MarketEngineService market) =>
    Results.Ok(market.GetWalletAndCart()));

app.MapPost("/api/orders", (SubmitOrderRequest req, MarketEngineService market) =>
{
    if (!req.ConfirmedByUser)
    {
        return Results.BadRequest(new
        {
            success = false,
            message = "Human-in-the-Loop 확인 모달을 통한 사용자 최종 승인(confirmedByUser=true)이 필요합니다."
        });
    }

    var result = market.SubmitOrder(req);
    return Results.Ok(result);
});

app.MapPost("/api/cart/{contractId}/ship", (string contractId, ShippingRequest req, MarketEngineService market) =>
{
    var (success, message, contract) = market.StartShipping(contractId, req);
    if (!success)
    {
        return Results.BadRequest(new { success = false, message });
    }
    return Results.Ok(new
    {
        success = true,
        message,
        contract,
        walletAndCart = market.GetWalletAndCart()
    });
});

app.MapPost("/api/farmers/natural-quote", async (NaturalSellerQuoteRequest req, CopilotAgentOrchestrator orchestrator, CancellationToken ct) =>
{
    var res = await orchestrator.AnalyzeNaturalSellerInputAsync(req.NaturalText, ct);
    return Results.Ok(res);
});

app.MapPost("/api/agents/verify-stream", async (
    AgentVerifyRequest req,
    CopilotAgentOrchestrator orchestrator,
    HttpContext httpContext,
    CancellationToken ct) =>
{
    httpContext.Response.Headers.ContentType = "text/event-stream; charset=utf-8";
    httpContext.Response.Headers.CacheControl = "no-cache";
    httpContext.Response.Headers.Connection = "keep-alive";

    await foreach (var evt in orchestrator.RunVerificationStreamAsync(req, ct))
    {
        var payload = JsonSerializer.Serialize(evt, jsonOptions);
        await httpContext.Response.WriteAsync($"data: {payload}\n\n", ct);
        await httpContext.Response.Body.FlushAsync(ct);
    }
});

app.MapFallbackToFile("index.html");

app.Run();
