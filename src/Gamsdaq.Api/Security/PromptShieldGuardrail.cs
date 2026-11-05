using System.Text;
using System.Text.RegularExpressions;

namespace Gamsdaq.Api.Security;

/// <summary>
/// Responsible AI Guardrail (judgement-criteria.md #6):
/// Blocks prompt injection attempts and validates price safety bounds.
/// </summary>
public static class PromptShieldGuardrail
{
    private static readonly string[] BlockedPatterns =
    [
        "지시무시",
        "이전지시",
        "규칙무시",
        "가드레일무시",
        "검증생략",
        "우회",
        "프롬프트무시",
        "시스템프롬프트",
        "프롬프트출력",
        "ignore",
        "disregard",
        "system prompt",
        "system:",
        "developer:",
        "assistant:",
        "최저가를 0원",
        "최저가를 100원",
        "drop table",
        "union select",
        "delete from",
        "<script",
        "javascript:",
        "onerror="
    ];

    public static (bool IsSafe, string SanitizedText, string? RejectionReason) ValidateAndSanitize(string? rawInput)
    {
        if (string.IsNullOrWhiteSpace(rawInput))
        {
            return (false, string.Empty, "입력 문장이 비어 있습니다.");
        }

        // Inspect the entire normalized input, including text beyond the input limit.
        var normalized = Regex.Replace(rawInput.Normalize(NormalizationForm.FormKC), @"[\u200B-\u200D\uFEFF]", "");
        var compact = Compact(normalized);

        foreach (var pattern in BlockedPatterns)
        {
            if (compact.Contains(Compact(pattern), StringComparison.OrdinalIgnoreCase))
            {
                return (
                    false,
                    string.Empty,
                    $"프롬프트 인젝션 또는 비정상 명령 패턴('{pattern}')이 감지되어 가드레일에 의해 차단되었습니다."
                );
            }
        }

        if (rawInput.Length > 300)
        {
            return (false, string.Empty, "입력 문장은 300자 이하여야 합니다.");
        }

        var cleaned = Regex.Replace(normalized.Trim(), @"\s+", " ");
        if (string.IsNullOrWhiteSpace(cleaned))
        {
            return (false, string.Empty, "입력 문장이 비어 있습니다.");
        }
        return (true, cleaned, null);
    }

    private static string Compact(string text) => Regex.Replace(text, @"[\s\p{P}\p{S}]+", "");

    public static (bool IsValid, string? WarningMessage) ValidateOrderPriceGuardrail(
        string side,
        int price,
        int quantity,
        int wholesalePrice,
        int retailLowestPrice,
        string orderType = "LIMIT")
    {
        if (!string.Equals(side, "BUY", StringComparison.OrdinalIgnoreCase) &&
            !string.Equals(side, "SELL", StringComparison.OrdinalIgnoreCase))
        {
            return (false, "주문 방향은 BUY 또는 SELL이어야 합니다.");
        }

        var isLimit = string.Equals(orderType, "LIMIT", StringComparison.OrdinalIgnoreCase);
        if (!isLimit && !string.Equals(orderType, "MARKET", StringComparison.OrdinalIgnoreCase))
        {
            return (false, "주문 유형은 LIMIT 또는 MARKET이어야 합니다.");
        }

        if (quantity <= 0 || quantity > 1000)
        {
            return (false, "주문 수량은 1박스 이상 1,000박스 이하여야 합니다.");
        }

        if (wholesalePrice <= 0 || retailLowestPrice <= wholesalePrice)
        {
            return (false, "유효한 상생 가격 밴드가 없습니다.");
        }

        if (!isLimit)
        {
            return (true, null);
        }

        if (price <= 0 || price % 100 != 0)
        {
            return (false, "호가 단위는 100원 단위 정수여야 합니다.");
        }

        if (price >= retailLowestPrice)
        {
            return (
                false,
                $"인터넷 실질 최저가({retailLowestPrice:N0}원) 이상인 호가({price:N0}원)는 소비자 절감 불변식(P < P_retail) 위반으로 차단됩니다."
            );
        }

        if (price <= wholesalePrice)
        {
            return (
                false,
                $"산지 도매 기준가({wholesalePrice:N0}원) 이하인 호가({price:N0}원)는 농가 수취 증대 불변식(P > P_wholesale) 위반으로 차단됩니다."
            );
        }

        return (true, null);
    }
}
