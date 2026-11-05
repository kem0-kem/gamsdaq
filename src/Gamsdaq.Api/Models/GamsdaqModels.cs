namespace Gamsdaq.Api.Models;

public record ProduceTicker(
    string Code,
    string Name,
    string Origin,
    int MinBrix,
    decimal WeightKg,
    string Grade,
    int OpenPrice,
    int CurrentPrice,
    int HighPrice,
    int LowPrice,
    int WholesalePrice,
    int VerifiedRetailLowestPrice,
    int AiOptimalPrice,
    double ExecutionStrength
);

public record OrderLevel(int Price, int Quantity, double ChangeRatePercent);

public record OrderQueueEntry(
    string OrderId,
    int Price,
    int Quantity,
    DateTime Timestamp,
    bool IsWalletFunded = false
);

public record TradeRecord(
    string Id,
    string TickerCode,
    int Price,
    int Quantity,
    string Side, // "BUY" | "SELL"
    DateTime ExecutedAt,
    string? RestingOrderId = null,
    string? IncomingOrderId = null
);

public record EcommerceCandidate(
    string Id,
    string MallName,
    string ProductTitle,
    int ListedPrice,
    int ShippingFee,
    decimal ListedWeightKg,
    int? GuaranteedBrix,
    string GradeText,
    int Effective3KgOr5KgPrice,
    bool IsPassed,
    string GateCode,
    string VerdictReason,
    string SourceUrl,
    bool ShippingRatioWarning = false,
    IReadOnlyList<string>? RejectionCodes = null,
    string CollectedAtKst = "2026-11-05T09:00:00+09:00"
);

public record OrderBookSnapshot(
    ProduceTicker Ticker,
    List<OrderLevel> Asks,
    List<OrderLevel> Bids,
    int TotalAskQuantity,
    int TotalBidQuantity,
    List<TradeRecord> RecentTrades,
    List<EcommerceCandidate> VerifiedCandidates
)
{
    public decimal OrderBookImbalance =>
        ((decimal)TotalBidQuantity - TotalAskQuantity) / ((decimal)TotalBidQuantity + TotalAskQuantity + 1m);
}

public record SubmitOrderRequest(
    string TickerCode,
    string Side, // "BUY" | "SELL"
    string OrderType, // "LIMIT" | "MARKET"
    int Price,
    int Quantity,
    bool ConfirmedByUser,
    string? SellerNote = null
);

public record CartContractItem(
    string ContractId,
    string TickerCode,
    string ItemName,
    int ExecutedPrice,
    int Quantity,
    int TotalPaidAmount,
    int SavedVsRetailAmount,
    int FarmerExtraGainAmount,
    string Status, // "CONTRACT_EXECUTED" | "SHIPPING_STARTED"
    string? RecipientName,
    string? RecipientPhone,
    string? ShippingAddress,
    DateTime ExecutedAt,
    DateTime? ShippedAt
);

public record SubmitOrderResponse(
    bool Success,
    string Message,
    int MatchedQuantity,
    int RestingQuantity,
    int ExecutedPrice,
    int TotalAmount,
    int RemainingWalletBalance,
    CartContractItem? CreatedContract,
    OrderBookSnapshot UpdatedOrderBook,
    string? OrderId = null,
    IReadOnlyList<TradeRecord>? Fills = null
);

public record ShippingRequest(
    string RecipientName,
    string RecipientPhone,
    string ShippingAddress
);

public record WalletAndCartResponse(
    int VirtualBalance,
    int SellerPendingSettlement,
    int TotalConsumerSaved,
    int TotalFarmerExtraEarned,
    List<CartContractItem> CartContracts
);

public record NaturalSellerQuoteRequest(
    string NaturalText
);

public record NaturalSellerQuoteResponse(
    bool IsSafeInput,
    string? SafetyWarning,
    string MatchedTickerCode,
    string MatchedItemName,
    int ExtractedQuantity,
    int WholesalePrice,
    int VerifiedRetailPrice,
    int RecommendedAskPrice,
    int ExpectedExtraGainPerBox,
    int ExpectedTotalExtraGain,
    string ReasoningSummary,
    double ElapsedMs = 0,
    int ClicksEquivalent = 3
);

public record AgentVerifyRequest(
    string Query,
    string Role, // "SELLER" | "BUYER"
    string? TickerCode = null
);

public record AgentStreamEvent(
    string StepId,
    string AgentName,
    string Status, // "RUNNING" | "TOOL_CALL" | "COMPLETED" | "AUDIT_PASSED"
    string? ToolName,
    string Summary,
    object? Payload,
    DateTime Timestamp,
    double? ExecutionLatencyMs = null,
    IReadOnlyList<AgentToolExecution>? ToolCalls = null,
    string? ExecutionMode = null
);

public record AgentToolExecution(string CallId, string ToolName, double LatencyMs, System.Text.Json.JsonElement Result);
