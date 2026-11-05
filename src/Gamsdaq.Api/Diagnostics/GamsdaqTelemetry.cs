using System.Collections.Concurrent;
using System.Diagnostics;
using System.Diagnostics.Metrics;
using Microsoft.ApplicationInsights;
using Microsoft.ApplicationInsights.DataContracts;

namespace Gamsdaq.Api.Diagnostics;

public record ExportedSpanRecord(string OperationName, string? TagSummary, double DurationMs, string Status, DateTime TimestampUtc);

public record TelemetryExportSnapshot(
    long TotalExportedSpans,
    IReadOnlyDictionary<string, double> LatestMetrics,
    IReadOnlyList<ExportedSpanRecord> RecentSpans,
    bool ApplicationInsightsBridged = false);

public static class GamsdaqTelemetry
{
    public const string ActivitySourceName = "Gamsdaq.Agents";
    public const string CopilotActivitySourceName = "github.copilot";
    public const string MeterName = "Gamsdaq.Metrics";
    public static readonly ActivitySource ActivitySource = new(ActivitySourceName);
    public static readonly Meter Meter = new(MeterName);
    public static readonly Counter<long> AgentSteps = Meter.CreateCounter<long>("gamsdaq.agent.steps");
    public static readonly Histogram<double> AgentStepLatency = Meter.CreateHistogram<double>("gamsdaq.agent.step.duration", "ms");
    public static readonly Counter<long> CandidatesInspected = Meter.CreateCounter<long>("gamsdaq.bait.inspected");
    public static readonly Counter<long> BaitRejected = Meter.CreateCounter<long>("gamsdaq.bait.rejected");
    public static readonly Histogram<double> BaitRejectionRate = Meter.CreateHistogram<double>("gamsdaq.bait.rejection.rate", "1");
    public static readonly Counter<long> OrdersProcessed = Meter.CreateCounter<long>("gamsdaq.orders.processed");
    public static readonly Histogram<double> OrderMatchingLatency = Meter.CreateHistogram<double>("gamsdaq.order.matching.duration", "ms");

    private static long _exportedSpanCount;
    private static TelemetryClient? _appInsightsClient;
    private static readonly ConcurrentQueue<ExportedSpanRecord> RecentSpans = new();
    private static readonly ConcurrentDictionary<string, double> MetricValues = new();

    public static void AttachApplicationInsights(TelemetryClient? client) => _appInsightsClient = client;

    static GamsdaqTelemetry()
    {
        ActivitySource.AddActivityListener(new ActivityListener
        {
            ShouldListenTo = source => source.Name is ActivitySourceName or CopilotActivitySourceName,
            Sample = (ref ActivityCreationOptions<ActivityContext> _) => ActivitySamplingResult.AllDataAndRecorded,
            ActivityStopped = activity =>
            {
                Interlocked.Increment(ref _exportedSpanCount);
                var tags = string.Join(", ", activity.TagObjects.Select(t => $"{t.Key}={t.Value}"));
                RecentSpans.Enqueue(new ExportedSpanRecord(
                    activity.OperationName,
                    tags,
                    Math.Round(activity.Duration.TotalMilliseconds, 3),
                    activity.Status.ToString(),
                    DateTime.UtcNow));
                while (RecentSpans.Count > 50 && RecentSpans.TryDequeue(out _)) { }

                if (_appInsightsClient is { } ai)
                {
                    var dep = new DependencyTelemetry(
                        dependencyTypeName: activity.Source.Name,
                        target: "Microsoft.Agents.AI",
                        dependencyName: activity.OperationName,
                        data: tags,
                        startTime: new DateTimeOffset(activity.StartTimeUtc, TimeSpan.Zero),
                        duration: activity.Duration,
                        resultCode: activity.Status.ToString(),
                        success: activity.Status != ActivityStatusCode.Error);
                    ai.TrackDependency(dep);
                }
            }
        });

        var meterListener = new MeterListener
        {
            InstrumentPublished = (instrument, listener) =>
            {
                if (instrument.Meter.Name == MeterName)
                {
                    listener.EnableMeasurementEvents(instrument);
                }
            }
        };
        meterListener.SetMeasurementEventCallback<long>((inst, val, _, _) =>
        {
            MetricValues.AddOrUpdate(inst.Name, val, (_, prev) => prev + val);
            _appInsightsClient?.GetMetric(inst.Name).TrackValue(val);
        });
        meterListener.SetMeasurementEventCallback<double>((inst, val, _, _) =>
        {
            MetricValues[inst.Name] = Math.Round(val, 4);
            _appInsightsClient?.GetMetric(inst.Name).TrackValue(val);
        });
        meterListener.Start();
    }

    public static TelemetryExportSnapshot GetSnapshot() =>
        new(Interlocked.Read(ref _exportedSpanCount),
            new Dictionary<string, double>(MetricValues),
            RecentSpans.ToArray(),
            _appInsightsClient is not null);
}
