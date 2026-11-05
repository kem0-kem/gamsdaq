using System.Collections.Concurrent;
using System.Diagnostics;
using System.Diagnostics.Metrics;

namespace Gamsdaq.Api.Diagnostics;

public record ExportedSpanRecord(string OperationName, string? TagSummary, double DurationMs, string Status, DateTime TimestampUtc);

public record TelemetryExportSnapshot(
    long TotalExportedSpans,
    IReadOnlyDictionary<string, double> LatestMetrics,
    IReadOnlyList<ExportedSpanRecord> RecentSpans);

public static class GamsdaqTelemetry
{
    public const string ActivitySourceName = "Gamsdaq.Agents";
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
    private static readonly ConcurrentQueue<ExportedSpanRecord> RecentSpans = new();
    private static readonly ConcurrentDictionary<string, double> MetricValues = new();

    static GamsdaqTelemetry()
    {
        ActivitySource.AddActivityListener(new ActivityListener
        {
            ShouldListenTo = source => source.Name == ActivitySourceName,
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
            MetricValues.AddOrUpdate(inst.Name, val, (_, prev) => prev + val));
        meterListener.SetMeasurementEventCallback<double>((inst, val, _, _) =>
            MetricValues[inst.Name] = Math.Round(val, 4));
        meterListener.Start();
    }

    public static TelemetryExportSnapshot GetSnapshot() =>
        new(Interlocked.Read(ref _exportedSpanCount),
            new Dictionary<string, double>(MetricValues),
            RecentSpans.ToArray());
}
