using Gamsdaq.Api.Models;
using Gamsdaq.Api.Security;

namespace Gamsdaq.Api.Tools;

public static class ProducePricingMath
{
    private static readonly string[] ExcludedGrades =
        ["파지", "못난이", "주스용", "가공용", "흠과", "중소과", "혼합", "하품"];

    public static int RoundToTick(decimal price, int tick) =>
        checked((int)(Math.Round(price / tick, 0, MidpointRounding.AwayFromZero) * tick));

    public static int CalculateEffectivePrice(int listedPrice, int shippingFee, decimal actualWeightKg, decimal targetWeightKg)
    {
        ArgumentOutOfRangeException.ThrowIfNegative(listedPrice);
        ArgumentOutOfRangeException.ThrowIfNegative(shippingFee);
        ArgumentOutOfRangeException.ThrowIfNegativeOrZero(actualWeightKg);
        ArgumentOutOfRangeException.ThrowIfNegativeOrZero(targetWeightKg);
        return RoundToTick(((decimal)listedPrice + shippingFee) / actualWeightKg * targetWeightKg, 10);
    }

    public static EcommerceCandidate Evaluate(EcommerceCandidate candidate, ProduceTicker ticker)
    {
        var codes = new List<string>();
        var reasons = new List<string>();
        void Reject(string code, string reason)
        {
            codes.Add(code);
            reasons.Add(reason);
        }

        var (titleSafe, _, _) = PromptShieldGuardrail.ValidateAndSanitize(candidate.ProductTitle);
        var (gradeSafe, _, _) = PromptShieldGuardrail.ValidateAndSanitize(candidate.GradeText);
        if (!titleSafe || !gradeSafe)
        {
            Reject("GATE-00_INDIRECT_INJECTION_BLOCKED", "외부 상품명/등급 텍스트에서 간접 프롬프트 인젝션 위험 패턴 감지");
        }

        if (ExcludedGrades.Any(grade =>
            candidate.ProductTitle.Contains(grade, StringComparison.OrdinalIgnoreCase) ||
            candidate.GradeText.Contains(grade, StringComparison.OrdinalIgnoreCase)))
        {
            Reject("GATE-01_QUALITY_MISMATCH", "목표 등급에 부합하지 않는 파지/혼합/가공용 등급");
        }
        if (!candidate.GuaranteedBrix.HasValue || candidate.GuaranteedBrix.Value < ticker.MinBrix)
        {
            Reject("GATE-02_BRIX_UNVERIFIED", $"{ticker.MinBrix}브릭스 이상 보장되지 않음");
        }
        if (candidate.ListedWeightKg < 0.6m * ticker.WeightKg)
        {
            Reject("GATE-03_BAIT_WEIGHT_OPTION", $"{candidate.ListedWeightKg}kg 소포장 옵션: 목표 {ticker.WeightKg}kg의 60% 미만");
        }

        int effective = 0;
        if (candidate.ListedPrice < 0 || candidate.ShippingFee < 0 || candidate.ListedWeightKg <= 0)
        {
            Reject("GATE-04_INVALID_PRICE_DATA", "가격/배송비는 음수가 아니며 중량은 양수여야 함");
        }
        else
        {
            try
            {
                effective = CalculateEffectivePrice(candidate.ListedPrice, candidate.ShippingFee, candidate.ListedWeightKg, ticker.WeightKg);
                if (effective < (decimal)ticker.WholesalePrice + 2_000)
                {
                    Reject("GATE-04_DUMP_OUTLIER", $"실질 환산가 {effective:N0}원은 도매가 + 2,000원 미만인 덤핑 이상치");
                }
            }
            catch (OverflowException)
            {
                Reject("GATE-04_INVALID_PRICE_DATA", "실질 환산가가 허용 금액 범위를 초과함");
            }
        }

        bool shippingWarning = candidate.ShippingFee > 0 &&
            (candidate.ListedPrice == 0 || (candidate.ListedPrice > 0 && (decimal)candidate.ShippingFee / candidate.ListedPrice > 0.35m));
        var reason = codes.Count > 0
            ? $"제외: {string.Join("; ", reasons)}"
            : $"통과: 배송비 {candidate.ShippingFee:N0}원 합산, {ticker.WeightKg}kg 실질 환산가 {effective:N0}원";
        if (shippingWarning)
        {
            reason += "; [FLAG_SHIPPING_BAIT] 배송비 주의 (상품가의 35% 초과)";
        }

        return candidate with
        {
            Effective3KgOr5KgPrice = effective,
            IsPassed = codes.Count == 0,
            GateCode = codes.FirstOrDefault() ?? "GATE_PASS",
            VerdictReason = reason,
            ShippingRatioWarning = shippingWarning,
            RejectionCodes = codes
        };
    }

    public static BaitVerificationSummary Verify(ProduceTicker ticker, IEnumerable<EcommerceCandidate> rawCandidates)
    {
        var evaluated = rawCandidates.Select(candidate => Evaluate(candidate, ticker)).ToList();
        var passed = evaluated.Where(candidate => candidate.IsPassed).OrderBy(candidate => candidate.Effective3KgOr5KgPrice).ToList();
        var adopted = passed.FirstOrDefault();
        if (adopted is not null)
        {
            var index = evaluated.IndexOf(adopted);
            evaluated[index] = adopted with
            {
                GateCode = "GATE_PASS_LOWEST_ADOPTED",
                VerdictReason = $"채택(실질 최저가): {adopted.VerdictReason}"
            };
        }

        // No passing listing means no verified ceiling, never a stale seed-price fallback.
        return new BaitVerificationSummary(ticker.Code, evaluated.Count, passed.Count,
            evaluated.Count - passed.Count, adopted?.Effective3KgOr5KgPrice ?? 0, adopted?.MallName ?? "",
            evaluated);
    }

    public static OptimalQuoteResult ComputeQuote(OrderBookSnapshot snapshot, int? minimumPrice = null, int? maximumPrice = null)
    {
        var ticker = snapshot.Ticker;
        decimal lower = Math.Max(ticker.WholesalePrice + 500, minimumPrice ?? int.MinValue);
        decimal upper = Math.Min(ticker.VerifiedRetailLowestPrice - 500, maximumPrice ?? int.MaxValue);
        int lowerTick = checked((int)(Math.Ceiling(lower / 100m) * 100));
        int upperTick = checked((int)(Math.Floor(upper / 100m) * 100));
        if (lowerTick > upperTick || ticker.WholesalePrice <= 0)
        {
            throw new InvalidOperationException("검증된 소매가와 도매가 사이에 안전한 100원 단위 추천 호가가 없습니다.");
        }

        decimal obi = snapshot.OrderBookImbalance;
        decimal mid = 0.48m * ticker.WholesalePrice + 0.52m * ticker.VerifiedRetailLowestPrice;
        decimal raw = mid + 0.08m * obi * (ticker.VerifiedRetailLowestPrice - ticker.WholesalePrice);
        int clampedOpt = Math.Clamp(RoundToTick(Math.Clamp(raw, lower, upper), 100), lowerTick, upperTick);
        int saved = ticker.VerifiedRetailLowestPrice - clampedOpt;
        int gain = clampedOpt - ticker.WholesalePrice;
        int? bestAsk = snapshot.Asks
            .Where(a => a.Price > ticker.WholesalePrice && a.Price < ticker.VerifiedRetailLowestPrice && a.Quantity > 0)
            .OrderBy(a => a.Price)
            .Select(a => (int?)a.Price)
            .FirstOrDefault();
        int? bestBid = snapshot.Bids
            .Where(b => b.Price > ticker.WholesalePrice && b.Price < ticker.VerifiedRetailLowestPrice && b.Quantity > 0)
            .OrderByDescending(b => b.Price)
            .Select(b => (int?)b.Price)
            .FirstOrDefault();

        return new OptimalQuoteResult(ticker.Code, ticker.WholesalePrice, ticker.VerifiedRetailLowestPrice,
            clampedOpt, (double)obi, saved,
            (double)Math.Round((decimal)saved / ticker.VerifiedRetailLowestPrice * 100m, 1),
            gain, (double)Math.Round((decimal)gain / ticker.WholesalePrice * 100m, 1),
            bestAsk, bestBid, clampedOpt);
    }
}
