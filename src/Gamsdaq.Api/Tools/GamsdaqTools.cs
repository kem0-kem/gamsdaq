using System.ComponentModel;
using Gamsdaq.Api.Diagnostics;
using Gamsdaq.Api.Matching;
using Gamsdaq.Api.Models;
using Gamsdaq.Api.Security;
using Microsoft.Extensions.AI;

namespace Gamsdaq.Api.Tools;

/// <summary>
/// Deterministic C# AIFunction Tools bound to Microsoft.Agents.AI agents.
/// Enforces AGENTS.md Zero-Mental-Math rule: all arithmetic and 4-Gate filtering happen in deterministic C# code.
/// </summary>
public class GamsdaqTools
{
    private readonly MarketEngineService _market;
    private readonly AsyncLocal<MarketEngineService?> _verificationWorkspace = new();
    private MarketEngineService ActiveMarket => _verificationWorkspace.Value ?? _market;

    public GamsdaqTools(MarketEngineService market)
    {
        _market = market;
    }

    public IList<AITool> CreateSpecNormalizerTools() =>
    [
        AIFunctionFactory.Create(ParseProduceSpecTool, "parse_produce_spec", "비정형 농산물 입력 문장에서 품목, 당도(Brix), 중량(kg), 수량(박스)을 추출하고 표준 티커 코드로 매핑합니다."),
        AIFunctionFactory.Create(LookupStandardTickerTool, "lookup_standard_ticker", "지원하는 표준 티커 규격을 조회합니다.")
    ];

    public IList<AITool> CreatePriceDiscoveryTools() =>
    [
        AIFunctionFactory.Create(SearchEcommerceListingsTool, "search_ecommerce_listings", "표준 티커에 대한 온라인 오픈마켓 소매 후보군(표기가격, 배송비, 표기중량, 브릭스)을 조회합니다."),
        AIFunctionFactory.Create(FetchWholesaleBenchmarkTool, "fetch_wholesale_benchmark", "KAMIS 공영도매시장 및 산지 공판장 도매 기준가를 조회합니다.")
    ];

    public IList<AITool> CreateBaitVerifierTools() =>
    [
        AIFunctionFactory.Create(CalculateEffectivePriceTool, "calculate_effective_price", "배송비와 실제 중량을 반영한 목표 중량의 실질 가격을 10원 단위로 계산합니다."),
        AIFunctionFactory.Create(EvaluateBaitRulesTool, "evaluate_bait_rules", "원본 후보에 품질, 브릭스, 중량, 덤핑 4-Gate를 동적으로 적용합니다."),
        AIFunctionFactory.Create(VerifyFourGateLowestPriceTool, "verify_four_gate_lowest_price", "4-Gate 미끼 상품 필터링 수식을 실행하여 부적격 상품을 제외하고 동일 스펙 인터넷 실질 최저가를 산출합니다.")
    ];

    public IList<AITool> CreateOptimalQuoteTools() =>
    [
        AIFunctionFactory.Create(GetOrderBookSnapshotTool, "get_order_book_snapshot", "현재 전체 호가 잔량과 OBI를 조회합니다."),
        AIFunctionFactory.Create(ComputeWinWinOptimalQuoteTool, "compute_win_win_optimal_quote", "산지 도매가, 인터넷 실질 최저가, 현재 호가창 잔량 불균형(OBI)을 기반으로 상생 최적 호가와 양측 기대 이익을 계산합니다.")
    ];

    public IList<AITool> CreateAuditorTools() =>
    [
        AIFunctionFactory.Create(AuditQuoteInvariantsTool, "audit_quote_invariants", "추천 호가가 상생 부등식(도매가 < 추천호가 < 인터넷최저가) 및 100원 호가 단위 불변식을 만족하는지 교차 검증합니다.")
    ];

    [Description("자연어 농산물 출하/검색 문장을 표준 티커(JJ-GYUL-12B-3KG 또는 CD-BANSI-13B-5KG)와 수량으로 정규화합니다.")]
    public NormalizedSpecResult ParseProduceSpecTool(
        [Description("사용자 입력 원문")] string inputQuery,
        [Description("선택적으로 명시한 표준 티커 코드")] string? tickerCode = null)
    {
        var (safe, sanitized, rejection) = PromptShieldGuardrail.ValidateAndSanitize(inputQuery);
        if (!safe)
        {
            throw new ArgumentException(rejection, nameof(inputQuery));
        }
        inputQuery = sanitized;
        string[] forbiddenGrades = ["파지", "못난이", "흠과", "가공용", "주스용", "하품"];
        if (forbiddenGrades.Any(term => inputQuery.Contains(term, StringComparison.OrdinalIgnoreCase)))
        {
            throw new ArgumentException("파지/못난이/흠과 등 비규격 등급은 표준 티커 호가창에 등록할 수 없습니다.", nameof(inputQuery));
        }

        var mentionsBansi = inputQuery.Contains("반시", StringComparison.OrdinalIgnoreCase)
                         || inputQuery.Contains("청도", StringComparison.OrdinalIgnoreCase)
                         || inputQuery.Contains("감 ", StringComparison.OrdinalIgnoreCase);
        var mentionsGyul = inputQuery.Contains("감귤", StringComparison.OrdinalIgnoreCase)
                        || inputQuery.Contains("귤", StringComparison.OrdinalIgnoreCase)
                        || inputQuery.Contains("제주", StringComparison.OrdinalIgnoreCase);
        var isBansi = mentionsBansi || (!mentionsGyul && (
                      inputQuery.Contains("5kg", StringComparison.OrdinalIgnoreCase)
                   || inputQuery.Contains("다섯 키로", StringComparison.OrdinalIgnoreCase)
                   || inputQuery.Contains("다섯키로", StringComparison.OrdinalIgnoreCase)));

        string resolvedTickerCode = mentionsBansi
            ? "CD-BANSI-13B-5KG"
            : mentionsGyul
                ? "JJ-GYUL-12B-3KG"
                : (tickerCode ?? (isBansi ? "CD-BANSI-13B-5KG" : "JJ-GYUL-12B-3KG"));
        var ticker = LookupStandardTickerTool(resolvedTickerCode);

        int resolvedBrix = ticker.MinBrix;
        bool brixExtracted = false;
        var brixMatch = System.Text.RegularExpressions.Regex.Match(inputQuery, @"(\d+)\s*(?:브릭스|brix)", System.Text.RegularExpressions.RegexOptions.IgnoreCase);
        if (brixMatch.Success && int.TryParse(brixMatch.Groups[1].Value, out var parsedBrix))
        {
            if (parsedBrix < ticker.MinBrix)
            {
                throw new ArgumentException($"입력 당도({parsedBrix}브릭스)가 표준 티커[{ticker.Code}] 최소 기준({ticker.MinBrix}브릭스)에 미달하여 거부됩니다.", nameof(inputQuery));
            }
            resolvedBrix = parsedBrix;
            brixExtracted = true;
        }

        decimal resolvedWeight = ticker.WeightKg;
        bool weightExtracted = false;
        var weightMatch = System.Text.RegularExpressions.Regex.Match(inputQuery, @"(\d+(?:\.\d+)?)\s*(?:kg|키로|킬로)", System.Text.RegularExpressions.RegexOptions.IgnoreCase);
        if (weightMatch.Success && decimal.TryParse(weightMatch.Groups[1].Value, System.Globalization.NumberStyles.Number, System.Globalization.CultureInfo.InvariantCulture, out var parsedWeight))
        {
            if (parsedWeight != ticker.WeightKg)
            {
                throw new ArgumentException($"입력 중량({parsedWeight}kg)이 표준 티커[{ticker.Code}] 규격({ticker.WeightKg}kg)과 일치하지 않습니다.", nameof(inputQuery));
            }
            resolvedWeight = parsedWeight;
            weightExtracted = true;
        }
        else if (System.Text.RegularExpressions.Regex.IsMatch(inputQuery, @"다섯\s*(?:키로|킬로)"))
        {
            if (ticker.WeightKg != 5.0m)
            {
                throw new ArgumentException($"입력 중량(5kg)이 표준 티커[{ticker.Code}] 규격({ticker.WeightKg}kg)과 일치하지 않습니다.", nameof(inputQuery));
            }
            resolvedWeight = 5.0m;
            weightExtracted = true;
        }
        else if (System.Text.RegularExpressions.Regex.IsMatch(inputQuery, @"세\s*(?:키로|킬로)"))
        {
            if (ticker.WeightKg != 3.0m)
            {
                throw new ArgumentException($"입력 중량(3kg)이 표준 티커[{ticker.Code}] 규격({ticker.WeightKg}kg)과 일치하지 않습니다.", nameof(inputQuery));
            }
            resolvedWeight = 3.0m;
            weightExtracted = true;
        }

        var qty = 10;
        bool qtyExtracted = false;
        var match = System.Text.RegularExpressions.Regex.Match(inputQuery, @"(\d+)\s*(?:박스|상자|개)");
        if (match.Success && int.TryParse(match.Groups[1].Value, out var parsedQty))
        {
            qty = Math.Clamp(parsedQty, 1, 1000);
            qtyExtracted = true;
        }
        else if (TryParseColloquialBoxCount(inputQuery, out var wordQty))
        {
            qty = wordQty;
            qtyExtracted = true;
        }

        var extracted = new List<string>();
        var defaulted = new List<string>();
        void Classify(string field, bool present) => (present ? extracted : defaulted).Add(field);

        Classify("crop", inputQuery.Contains("감귤", StringComparison.OrdinalIgnoreCase)
                      || inputQuery.Contains("귤", StringComparison.OrdinalIgnoreCase)
                      || inputQuery.Contains("반시", StringComparison.OrdinalIgnoreCase)
                      || inputQuery.Contains("감", StringComparison.OrdinalIgnoreCase));
        Classify("origin", inputQuery.Contains("제주", StringComparison.OrdinalIgnoreCase)
                        || inputQuery.Contains("서귀포", StringComparison.OrdinalIgnoreCase)
                        || inputQuery.Contains("청도", StringComparison.OrdinalIgnoreCase)
                        || inputQuery.Contains("경북", StringComparison.OrdinalIgnoreCase));
        Classify("minBrix", brixExtracted);
        Classify("weightKg", weightExtracted);
        Classify("grade", inputQuery.Contains("특", StringComparison.OrdinalIgnoreCase)
                       || inputQuery.Contains("로얄", StringComparison.OrdinalIgnoreCase)
                       || inputQuery.Contains("대과", StringComparison.OrdinalIgnoreCase)
                       || inputQuery.Contains("명품", StringComparison.OrdinalIgnoreCase));
        Classify("quantity", qtyExtracted);

        return new NormalizedSpecResult(
            TickerCode: ticker.Code,
            StandardName: ticker.Name,
            Origin: ticker.Origin,
            MinBrix: resolvedBrix,
            WeightKg: resolvedWeight,
            Grade: ticker.Grade,
            ExtractedQuantity: qty,
            ExtractedFields: extracted,
            DefaultMappedFields: defaulted
        );
    }

    private static bool TryParseColloquialBoxCount(string text, out int count)
    {
        (string Pattern, int Value)[] colloquial =
        [
            (@"스무\s*(?:박스|상자|개)", 20),
            (@"열\s*(?:박스|상자|개)", 10),
            (@"다섯\s*(?:박스|상자|개)", 5),
            (@"네\s*(?:박스|상자|개)", 4),
            (@"세\s*(?:박스|상자|개)", 3),
            (@"두\s*(?:박스|상자|개)", 2),
            (@"한\s*(?:박스|상자|개)", 1)
        ];
        foreach (var (pattern, val) in colloquial)
        {
            if (System.Text.RegularExpressions.Regex.IsMatch(text, pattern))
            {
                count = val;
                return true;
            }
        }
        count = 0;
        return false;
    }

    public ProduceTicker LookupStandardTickerTool(string tickerCode) => ActiveMarket.GetTicker(tickerCode);

    [Description("온라인 오픈마켓 소매 가격 후보 리스트를 수집합니다.")]
    public List<EcommerceCandidate> SearchEcommerceListingsTool(
        [Description("표준 티커 코드")] string tickerCode)
    {
        return ActiveMarket.GetCandidates(tickerCode);
    }

    [Description("KAMIS 및 산지 공판장 도매 기준가를 조회합니다.")]
    public WholesaleBenchmarkResult FetchWholesaleBenchmarkTool(
        [Description("표준 티커 코드")] string tickerCode)
    {
        var ticker = ActiveMarket.GetTicker(tickerCode);
        return new WholesaleBenchmarkResult(
            TickerCode: ticker.Code,
            WholesalePrice: ticker.WholesalePrice,
            Source: "KAMIS 공영도매시장 및 산지 공판장 정산 기준가 (시뮬레이션 기준 데이터 스냅샷)",
            AsOfDate: "2026-11-05",
            DataProvenance: "SIMULATED_PUBLIC_BENCHMARK",
            SourceUrl: "https://www.kamis.or.kr/customer/price/wholesale/item.do"
        );
    }

    public int CalculateEffectivePriceTool(int listedPrice, int shippingFee, decimal actualWeightKg, decimal targetWeightKg) =>
        ProducePricingMath.CalculateEffectivePrice(listedPrice, shippingFee, actualWeightKg, targetWeightKg);

    public EcommerceCandidate EvaluateBaitRulesTool(string tickerCode, EcommerceCandidate candidate) =>
        ProducePricingMath.Evaluate(candidate, ActiveMarket.GetTicker(tickerCode));

    [Description("원본 후보를 재평가하여 실질 최저가를 확정합니다. 통과 후보가 없으면 최저가는 0입니다.")]
    public virtual BaitVerificationSummary VerifyFourGateLowestPriceTool(
        [Description("표준 티커 코드")] string tickerCode,
        [Description("탐색 단계의 원본 후보. 생략하면 현재 후보를 조회합니다.")] List<EcommerceCandidate>? candidates = null)
    {
        var ticker = ActiveMarket.GetTicker(tickerCode);
        var summary = ProducePricingMath.Verify(ticker, candidates ?? ActiveMarket.GetCandidates(tickerCode));
        ActiveMarket.UpdateVerifiedMarket(summary);
        GamsdaqTelemetry.CandidatesInspected.Add(summary.TotalCandidatesInspected);
        GamsdaqTelemetry.BaitRejected.Add(summary.RejectedBaitCount);
        GamsdaqTelemetry.BaitRejectionRate.Record(summary.TotalCandidatesInspected == 0
            ? 0 : (double)summary.RejectedBaitCount / summary.TotalCandidatesInspected);
        return summary;
    }

    public OrderBookSnapshot GetOrderBookSnapshotTool(string tickerCode) => ActiveMarket.GetOrderBook(tickerCode);

    public MarketEngineService.VerificationCheckpoint CaptureCheckpoint(string tickerCode) =>
        _market.CaptureVerificationCheckpoint(tickerCode);

    public virtual void RestoreCheckpoint(string tickerCode, MarketEngineService.VerificationCheckpoint checkpoint,
        MarketEngineService? workspace = null) =>
        (workspace ?? _market).RestoreVerificationCheckpoint(tickerCode, checkpoint);

    public MarketEngineService CreateVerificationWorkspace(MarketEngineService.VerificationCheckpoint checkpoint) =>
        _market.CreateVerificationWorkspace(checkpoint);

    public bool TryCommitVerification(MarketEngineService.VerificationCheckpoint checkpoint,
        BaitVerificationSummary summary, OptimalQuoteResult quote) =>
        _market.TryCommitVerification(checkpoint, summary, quote);

    public IDisposable UseVerificationWorkspace(MarketEngineService workspace)
    {
        var previous = _verificationWorkspace.Value;
        _verificationWorkspace.Value = workspace;
        return new WorkspaceScope(() => _verificationWorkspace.Value = previous);
    }

    private sealed class WorkspaceScope(Action restore) : IDisposable
    {
        public void Dispose() => restore();
    }

    private static readonly string[] TrustedSourceDomains =
        ["coupang.com", "naver.com", "11st.co.kr", "gmarket.co.kr", "ssg.com", "kamis.or.kr"];

    [Description("도매 기준가, 인터넷 최저가, 호가창 잔량을 바탕으로 상생 최적 호가를 결정론적으로 산출합니다.")]
    public virtual OptimalQuoteResult ComputeWinWinOptimalQuoteTool(
        [Description("표준 티커 코드")] string tickerCode,
        [Description("재감사 시 적용할 추가 안전 하한")] int? minimumPrice = null,
        [Description("재감사 시 적용할 추가 안전 상한")] int? maximumPrice = null) =>
        ActiveMarket.RecomputeOptimalQuote(tickerCode, minimumPrice, maximumPrice);

    [Description("Maker-Checker 불변식을 검증합니다: WholesalePrice < OptimalPrice < RetailLowestPrice, 100원 호가 단위, 채택 최저가 상품의 당도/등급 스펙 일치, 원본 출처(Source) 존재 여부")]
    public virtual AuditResult AuditQuoteInvariantsTool(
        [Description("산지 도매 기준가")] int wholesalePrice,
        [Description("AI 추천 상생 호가")] int optimalPrice,
        [Description("검증된 인터넷 실질 최저가")] int retailLowestPrice,
        [Description("제외된 미끼 상품 수")] int rejectedBaitCount,
        [Description("채택된 최저가 상품의 보장 당도(Brix)")] int? adoptedBrix,
        [Description("목표 티커 최소 당도(Brix)")] int? targetMinBrix,
        [Description("채택된 최저가 상품의 등급 텍스트")] string? adoptedGrade,
        [Description("목표 티커 표준 등급")] string? targetGrade,
        [Description("모든 가격 수치의 원본 출처(Source URL) 존재 여부")] bool hasSourceProvenance,
        [Description("채택된 소매 후보 출처 URL")] string? adoptedSourceUrl)
    {
        bool inv1 = wholesalePrice < optimalPrice && optimalPrice < retailLowestPrice;
        bool inv2 = optimalPrice % 100 == 0;
        bool inv3 = rejectedBaitCount > 0;
        // Fail-closed spec verification: missing Brix or Grade is immediately rejected.
        bool brixOk = adoptedBrix.HasValue && targetMinBrix.HasValue && adoptedBrix.Value >= targetMinBrix.Value;
        bool gradeOk = MatchesTargetGradeStrict(adoptedGrade, targetGrade);
        bool inv4Spec = brixOk && gradeOk;
        bool inv5Source = hasSourceProvenance
            && !string.IsNullOrWhiteSpace(adoptedSourceUrl)
            && Uri.TryCreate(adoptedSourceUrl, UriKind.Absolute, out var uri)
            && uri.Scheme == Uri.UriSchemeHttps
            && TrustedSourceDomains.Any(domain =>
                uri.Host.Equals(domain, StringComparison.OrdinalIgnoreCase) ||
                uri.Host.EndsWith("." + domain, StringComparison.OrdinalIgnoreCase));

        bool passed = inv1 && inv2 && inv3 && inv4Spec && inv5Source;
        return new AuditResult(
            AuditPassed: passed,
            InvariantWinWinInequality: inv1,
            InvariantTickSize100Won: inv2,
            InvariantBaitFiltered: inv3,
            AuditVerdict: passed
                ? $"AUDIT_PASSED: 도매가({wholesalePrice:N0}원) < 추천호가({optimalPrice:N0}원) < 인터넷최저가({retailLowestPrice:N0}원) 불변식, 100원 호가 단위, 스펙 일치 및 출처 검증 완료"
                : "AUDIT_REJECTED: 상생 가격 밴드 또는 스펙·출처 불변식 위반",
            InvariantSpecMatched: inv4Spec,
            InvariantSourceProvenance: inv5Source
        );
    }

    private static bool MatchesTargetGradeStrict(string? adoptedGrade, string? targetGrade) =>
        ProducePricingMath.MatchesTargetGradeStrict(adoptedGrade, targetGrade);
}

public record NormalizedSpecResult(
    string TickerCode,
    string StandardName,
    string Origin,
    int MinBrix,
    decimal WeightKg,
    string Grade,
    int ExtractedQuantity,
    IReadOnlyList<string>? ExtractedFields = null,
    IReadOnlyList<string>? DefaultMappedFields = null
);

public record WholesaleBenchmarkResult(
    string TickerCode,
    int WholesalePrice,
    string Source,
    string AsOfDate,
    string DataProvenance = "SIMULATED_PUBLIC_BENCHMARK",
    string SourceUrl = "https://www.kamis.or.kr/customer/price/wholesale/item.do"
);

public record BaitVerificationSummary(
    string TickerCode,
    int TotalCandidatesInspected,
    int PassedCount,
    int RejectedBaitCount,
    int VerifiedRetailLowestPrice,
    string AdoptedSourceMall,
    List<EcommerceCandidate> Candidates
);

public record OptimalQuoteResult(
    string TickerCode,
    int WholesaleFloorPrice,
    int VerifiedRetailCeilingPrice,
    int RecommendedOptimalPrice,
    double OrderBookImbalance,
    int ConsumerSavedAmount,
    double ConsumerSavedPercent,
    int FarmerExtraGainAmount,
    double FarmerExtraGainPercent,
    int? ImmediateMatchAskPrice = null,
    int? ImmediateMatchBidPrice = null,
    int? RestingLimitQuotePrice = null
);

public record AuditResult(
    bool AuditPassed,
    bool InvariantWinWinInequality,
    bool InvariantTickSize100Won,
    bool InvariantBaitFiltered,
    string AuditVerdict,
    bool InvariantSpecMatched = true,
    bool InvariantSourceProvenance = true
);
