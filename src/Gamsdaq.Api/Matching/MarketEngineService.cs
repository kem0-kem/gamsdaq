using System.Diagnostics;
using Gamsdaq.Api.Diagnostics;
using Gamsdaq.Api.Models;
using Gamsdaq.Api.Security;
using Gamsdaq.Api.Tools;

namespace Gamsdaq.Api.Matching;

/// <summary>
/// Thread-safe Price-Time Priority Order Book, Virtual Wallet, and Cart Fulfillment Engine
/// for the 2 test tickers: JJ-GYUL-12B-3KG and CD-BANSI-13B-5KG.
/// </summary>
public class MarketEngineService
{
    private readonly object _sync = new();

    private int _virtualBalance = 500_000;
    private int _sellerPendingSettlement = 189_000;
    private int _totalConsumerSaved = 124_800;
    private int _totalFarmerExtraEarned = 142_600;
    private int _contractSeq = 2;
    private int _orderSeq;
    private int _tradeSeq;
    private int _reservedBalance;
    private long _verificationVersion;

    private readonly Dictionary<string, ProduceTicker> _tickers = new(StringComparer.OrdinalIgnoreCase);
    private readonly Dictionary<string, SortedDictionary<int, LinkedList<OrderQueueEntry>>> _asks = new(StringComparer.OrdinalIgnoreCase);
    private readonly Dictionary<string, SortedDictionary<int, LinkedList<OrderQueueEntry>>> _bids = new(StringComparer.OrdinalIgnoreCase);
    private readonly Dictionary<string, List<TradeRecord>> _trades = new(StringComparer.OrdinalIgnoreCase);
    private readonly Dictionary<string, List<EcommerceCandidate>> _candidates = new(StringComparer.OrdinalIgnoreCase);
    private readonly Dictionary<string, List<EcommerceCandidate>> _verifiedCandidates = new(StringComparer.OrdinalIgnoreCase);
    private readonly List<CartContractItem> _cartContracts = [];

    public MarketEngineService(int initialVirtualBalance = 500_000)
    {
        ArgumentOutOfRangeException.ThrowIfNegative(initialVirtualBalance);
        _virtualBalance = initialVirtualBalance;
        SeedInitialMarket();
        foreach (var ticker in _tickers.Values.ToList())
        {
            UpdateVerifiedMarket(ProducePricingMath.Verify(ticker, _candidates[ticker.Code]));
        }
    }

    private SortedDictionary<int, LinkedList<OrderQueueEntry>> CreateBook(Dictionary<int, int> levels) =>
        new(levels.ToDictionary(level => level.Key, level =>
            new LinkedList<OrderQueueEntry>([new OrderQueueEntry(
                $"SEED-{++_orderSeq}", level.Key, level.Value, DateTime.UtcNow.AddMinutes(-30))])));

    private void SeedInitialMarket()
    {
        // 1. 12브릭스 노지 감귤 3kg (시드: 시가 대비 상승세 +3.33%)
        const string gyul = "JJ-GYUL-12B-3KG";
        _tickers[gyul] = new ProduceTicker(
            Code: gyul,
            Name: "12브릭스 노지 감귤 3kg",
            Origin: "제주 서귀포 노지",
            MinBrix: 12,
            WeightKg: 3.0m,
            Grade: "로얄과 (특등급)",
            OpenPrice: 12_000,
            CurrentPrice: 12_400,
            HighPrice: 12_800,
            LowPrice: 11_800,
            WholesalePrice: 9_200,
            VerifiedRetailLowestPrice: 15_800,
            AiOptimalPrice: 0,
            ExecutionStrength: 118.4
        );

        _asks[gyul] = CreateBook(new Dictionary<int, int>
        {
            [12_400] = 38,
            [12_500] = 64,
            [12_600] = 96,
            [12_700] = 58,
            [12_800] = 84
        });

        _bids[gyul] = CreateBook(new Dictionary<int, int>
        {
            [12_300] = 92,
            [12_200] = 115,
            [12_100] = 54,
            [12_000] = 76,
            [11_900] = 41,
            [11_800] = 29
        });

        _trades[gyul] =
        [
            new TradeRecord("TRD-101", gyul, 12_400, 12, "BUY", DateTime.UtcNow.AddMinutes(-1)),
            new TradeRecord("TRD-102", gyul, 12_400, 5, "BUY", DateTime.UtcNow.AddMinutes(-2)),
            new TradeRecord("TRD-103", gyul, 12_300, 8, "SELL", DateTime.UtcNow.AddMinutes(-4)),
            new TradeRecord("TRD-104", gyul, 12_400, 30, "BUY", DateTime.UtcNow.AddMinutes(-6)),
            new TradeRecord("TRD-105", gyul, 12_400, 4, "BUY", DateTime.UtcNow.AddMinutes(-8)),
            new TradeRecord("TRD-106", gyul, 12_300, 15, "SELL", DateTime.UtcNow.AddMinutes(-11)),
            new TradeRecord("TRD-107", gyul, 12_400, 9, "BUY", DateTime.UtcNow.AddMinutes(-15))
        ];

        _candidates[gyul] =
        [
            new EcommerceCandidate(
                "EC-G1", "오픈마켓 A몰 (네이버쇼핑)", "[특가] 제주 노지 감귤 달콤 과즙팡팡",
                9_900, 4_500, 1.0m, 12, "로얄과 특등급",
                0, false, "UNVERIFIED", "",
                "https://search.shopping.naver.com/search/all?query=%EC%A0%9C%EC%A3%BC+%EB%85%B8%EC%A7%80+%EA%B0%90%EA%B7%A4+1kg"
            ),
            new EcommerceCandidate(
                "EC-G2", "오픈마켓 B몰 (11번가)", "제주 산지직송 노지 감귤 3kg 가정용 혼합과",
                11_500, 3_000, 3.0m, 9, "가정용 파지/혼합",
                0, false, "UNVERIFIED", "",
                "https://www.11st.co.kr/search/Search.tmall?kwd=%EC%A0%9C%EC%A3%BC+%EB%85%B8%EC%A7%80+%EA%B0%90%EA%B7%A4+3kg"
            ),
            new EcommerceCandidate(
                "EC-G3", "소셜커머스 C몰 (G마켓)", "서귀포 고당도 12브릭스 노지감귤 3kg 로얄과",
                11_900, 5_000, 3.0m, 12, "로얄과 특등급",
                0, false, "UNVERIFIED", "",
                "https://www.gmarket.co.kr/n/search?keyword=12%EB%B8%8C%EB%A6%AD%EC%8A%A4+%EB%85%B8%EC%A7%80%EA%B0%90%EA%B7%A4+3kg"
            ),
            new EcommerceCandidate(
                "EC-G4", "산지직송 D몰 (쿠팡 로켓프레시)", "[비파괴당도선별] 12브릭스 보장 제주 노지감귤 3kg 로얄과 무료배송",
                15_800, 0, 3.0m, 12, "로얄과 특등급",
                0, false, "UNVERIFIED", "",
                "https://www.coupang.com/np/search?q=12%EB%B8%8C%EB%A6%AD%EC%8A%A4+%EB%85%B8%EC%A7%80%EA%B0%90%EA%B7%A4+3kg"
            ),
            new EcommerceCandidate(
                "EC-G5", "백화점몰 E몰 (SSG닷컴)", "제주 명품 12브릭스 노지 감귤 선물세트 3kg",
                17_500, 0, 3.0m, 12, "로얄과 특등급",
                0, false, "UNVERIFIED", "",
                "https://www.ssg.com/search.ssg?query=12%EB%B8%8C%EB%A6%AD%EC%8A%A4+%EB%85%B8%EC%A7%80%EA%B0%90%EA%B7%A4+3kg"
            )
        ];

        // 2. 청도 명품 반시 대과 5kg (시드: 시가 대비 하락세 -3.08%)
        const string bansi = "CD-BANSI-13B-5KG";
        _tickers[bansi] = new ProduceTicker(
            Code: bansi,
            Name: "청도 명품 반시 대과 5kg",
            Origin: "경북 청도군 화양읍",
            MinBrix: 13,
            WeightKg: 5.0m,
            Grade: "대과 (특품)",
            OpenPrice: 19_500,
            CurrentPrice: 18_900,
            HighPrice: 19_600,
            LowPrice: 18_500,
            WholesalePrice: 14_000,
            VerifiedRetailLowestPrice: 24_800,
            AiOptimalPrice: 0,
            ExecutionStrength: 86.2
        );

        _asks[bansi] = CreateBook(new Dictionary<int, int>
        {
            [18_900] = 54,
            [19_000] = 110,
            [19_100] = 75,
            [19_200] = 88,
            [19_300] = 62
        });

        _bids[bansi] = CreateBook(new Dictionary<int, int>
        {
            [18_800] = 48,
            [18_700] = 66,
            [18_600] = 82,
            [18_500] = 39,
            [18_400] = 30,
            [18_300] = 25
        });

        _trades[bansi] =
        [
            new TradeRecord("TRD-201", bansi, 18_900, 6, "SELL", DateTime.UtcNow.AddMinutes(-1)),
            new TradeRecord("TRD-202", bansi, 18_900, 10, "SELL", DateTime.UtcNow.AddMinutes(-3)),
            new TradeRecord("TRD-203", bansi, 19_000, 4, "BUY", DateTime.UtcNow.AddMinutes(-5)),
            new TradeRecord("TRD-204", bansi, 18_900, 18, "SELL", DateTime.UtcNow.AddMinutes(-9)),
            new TradeRecord("TRD-205", bansi, 18_900, 7, "SELL", DateTime.UtcNow.AddMinutes(-12)),
            new TradeRecord("TRD-206", bansi, 18_800, 12, "SELL", DateTime.UtcNow.AddMinutes(-16))
        ];

        _candidates[bansi] =
        [
            new EcommerceCandidate(
                "EC-B1", "오픈마켓 A몰 (네이버쇼핑)", "씨없는 청도 반시 감 홍시용 초특가",
                12_900, 4_000, 2.5m, 13, "중소과",
                0, false, "UNVERIFIED", "",
                "https://search.shopping.naver.com/search/all?query=%EC%B2%AD%EB%8F%84+%EB%B0%98%EC%8B%9C+2.5kg"
            ),
            new EcommerceCandidate(
                "EC-B2", "오픈마켓 B몰 (11번가)", "청도 반시 5kg 가정용 주스/홍시용 파지 포함",
                15_900, 3_500, 5.0m, 10, "가정용 파지",
                0, false, "UNVERIFIED", "",
                "https://www.11st.co.kr/search/Search.tmall?kwd=%EC%B2%AD%EB%8F%84+%EB%B0%98%EC%8B%9C+5kg"
            ),
            new EcommerceCandidate(
                "EC-B3", "산지직송 C몰 (청도몰/쿠팡)", "[청도군인증] 13브릭스 청도 명품 반시 대과 5kg 무료배송",
                24_800, 0, 5.0m, 13, "대과 특품",
                0, false, "UNVERIFIED", "",
                "https://www.coupang.com/np/search?q=13%EB%B8%8C%EB%A6%AD%EC%8A%A4+%EC%B2%AD%EB%8F%84+%EB%B0%98%EC%8B%9C+%EB%8C%80%EA%B3%BC+5kg"
            ),
            new EcommerceCandidate(
                "EC-B4", "오픈마켓 D몰 (G마켓)", "청도 화양 명품 반시 대과 5kg 특등급 선물용",
                23_000, 3_500, 5.0m, 13, "대과 특품",
                0, false, "UNVERIFIED", "",
                "https://www.gmarket.co.kr/n/search?keyword=%EC%B2%AD%EB%8F%84+%EB%B0%98%EC%8B%9C+%EB%8C%80%EA%B3%BC+5kg"
            ),
            new EcommerceCandidate(
                "EC-B5", "백화점몰 E몰 (SSG닷컴)", "경북 청도 명품 반시 대과 5kg 산지직송 특품",
                27_200, 0, 5.0m, 13, "대과 특품",
                0, false, "UNVERIFIED", "",
                "https://www.ssg.com/search.ssg?query=%EC%B2%AD%EB%8F%84+%EB%B0%98%EC%8B%9C+%EB%8C%80%EA%B3%BC+5kg"
            )
        ];

        _cartContracts.Add(new CartContractItem(
            ContractId: "CTR-2026-001",
            TickerCode: gyul,
            ItemName: "12브릭스 노지 감귤 3kg",
            ExecutedPrice: 12_400,
            Quantity: 2,
            TotalPaidAmount: 24_800,
            SavedVsRetailAmount: 6_800,
            FarmerExtraGainAmount: 6_400,
            Status: "CONTRACT_EXECUTED",
            RecipientName: null,
            RecipientPhone: null,
            ShippingAddress: null,
            ExecutedAt: DateTime.UtcNow.AddMinutes(-10),
            ShippedAt: null
        ));
    }

    public List<ProduceTicker> GetAllTickers()
    {
        lock (_sync)
        {
            return _tickers.Values.ToList();
        }
    }

    public ProduceTicker GetTicker(string code)
    {
        lock (_sync)
        {
            return _tickers.TryGetValue(code, out var t) ? t
                : throw new ArgumentException("지원하지 않는 표준 티커 코드입니다.", nameof(code));
        }
    }

    public List<EcommerceCandidate> GetCandidates(string code)
    {
        lock (_sync)
        {
            return _candidates[GetTicker(code).Code].ToList();
        }
    }

    public OrderBookSnapshot GetOrderBook(string code)
    {
        lock (_sync)
        {
            var ticker = GetTicker(code);
            var askDict = _asks[ticker.Code];
            var bidDict = _bids[ticker.Code];

            var asks = askDict
                .OrderByDescending(kv => kv.Key)
                .Select(kv => new OrderLevel(
                    kv.Key,
                    kv.Value.Sum(order => order.Quantity),
                    Math.Round((kv.Key - ticker.OpenPrice) / (double)ticker.OpenPrice * 100.0, 2)))
                .ToList();

            var bids = bidDict
                .OrderByDescending(kv => kv.Key)
                .Select(kv => new OrderLevel(
                    kv.Key,
                    kv.Value.Sum(order => order.Quantity),
                    Math.Round((kv.Key - ticker.OpenPrice) / (double)ticker.OpenPrice * 100.0, 2)))
                .ToList();

            return new OrderBookSnapshot(
                Ticker: ticker,
                Asks: asks,
                Bids: bids,
                TotalAskQuantity: askDict.Values.Sum(queue => queue.Sum(order => order.Quantity)),
                TotalBidQuantity: bidDict.Values.Sum(queue => queue.Sum(order => order.Quantity)),
                RecentTrades: _trades[ticker.Code].Take(8).ToList(),
                VerifiedCandidates: _verifiedCandidates.GetValueOrDefault(ticker.Code)?.ToList() ?? []
            );
        }
    }

    public IReadOnlyList<OrderQueueEntry> GetOrderQueue(string tickerCode, string side, int price)
    {
        lock (_sync)
        {
            var code = GetTicker(tickerCode).Code;
            var book = side.Equals("BUY", StringComparison.OrdinalIgnoreCase) ? _bids[code] : _asks[code];
            return book.TryGetValue(price, out var queue) ? queue.ToList() : [];
        }
    }

    public void UpdateVerifiedMarket(BaitVerificationSummary summary)
    {
        lock (_sync)
        {
            var ticker = GetTicker(summary.TickerCode);
            _verifiedCandidates[ticker.Code] = summary.Candidates.ToList();
            _tickers[ticker.Code] = ticker with { VerifiedRetailLowestPrice = summary.VerifiedRetailLowestPrice };
            foreach (var book in new[] { _asks[ticker.Code], _bids[ticker.Code] })
            {
                foreach (var price in book.Keys.Where(price => price <= ticker.WholesalePrice ||
                    price >= summary.VerifiedRetailLowestPrice).ToList())
                {
                    _reservedBalance -= book[price].Where(order => order.IsWalletFunded).Sum(order => order.Price * order.Quantity);
                    book.Remove(price);
                }
            }
            RefreshOptimalPrice(ticker.Code);
        }
    }

    public WalletAndCartResponse ResetDemoMarket(int initialVirtualBalance = 500_000)
    {
        lock (_sync)
        {
            _virtualBalance = initialVirtualBalance;
            _sellerPendingSettlement = 189_000;
            _totalConsumerSaved = 124_800;
            _totalFarmerExtraEarned = 142_600;
            _contractSeq = 2;
            _orderSeq = 0;
            _tradeSeq = 0;
            _reservedBalance = 0;
            _tickers.Clear();
            _asks.Clear();
            _bids.Clear();
            _trades.Clear();
            _candidates.Clear();
            _verifiedCandidates.Clear();
            _cartContracts.Clear();
            SeedInitialMarket();
            foreach (var ticker in _tickers.Values.ToList())
            {
                _candidates[ticker.Code] = _candidates[ticker.Code].Select(candidate => candidate with
                {
                    Effective3KgOr5KgPrice = 0,
                    IsPassed = false,
                    GateCode = "",
                    VerdictReason = ""
                }).ToList();
                UpdateVerifiedMarket(ProducePricingMath.Verify(ticker, _candidates[ticker.Code]));
            }
            return GetWalletAndCart();
        }
    }

    public sealed record VerificationCheckpoint(
        ProduceTicker Ticker,
        IReadOnlyList<EcommerceCandidate> VerifiedCandidates,
        IReadOnlyList<OrderQueueEntry> AskOrders,
        IReadOnlyList<OrderQueueEntry> BidOrders,
        int CashBalance,
        int ReservedCashBalance,
        IReadOnlyList<EcommerceCandidate> Candidates,
        IReadOnlyList<TradeRecord> Trades,
        long Version);

    private static List<EcommerceCandidate> CopyCandidates(IEnumerable<EcommerceCandidate> candidates) =>
        candidates.Select(candidate => candidate with { RejectionCodes = candidate.RejectionCodes?.ToArray() }).ToList();

    private static SortedDictionary<int, LinkedList<OrderQueueEntry>> CopyBook(IEnumerable<OrderQueueEntry> orders) =>
        new(orders.GroupBy(order => order.Price).ToDictionary(group => group.Key,
            group => new LinkedList<OrderQueueEntry>(group.Select(order => order with { }))));

    public VerificationCheckpoint CaptureVerificationCheckpoint(string code)
    {
        lock (_sync)
        {
            var ticker = GetTicker(code);
            return new VerificationCheckpoint(
                ticker with { },
                CopyCandidates(_verifiedCandidates.GetValueOrDefault(ticker.Code) ?? []).AsReadOnly(),
                _asks[ticker.Code].Values.SelectMany(queue => queue).Select(order => order with { }).ToList().AsReadOnly(),
                _bids[ticker.Code].Values.SelectMany(queue => queue).Select(order => order with { }).ToList().AsReadOnly(),
                _virtualBalance, _reservedBalance,
                CopyCandidates(_candidates[ticker.Code]).AsReadOnly(),
                _trades[ticker.Code].Select(trade => trade with { }).ToList().AsReadOnly(),
                _verificationVersion);
        }
    }

    public void RestoreVerificationCheckpoint(string code, VerificationCheckpoint checkpoint)
    {
        lock (_sync)
        {
            var ticker = GetTicker(code);
            if (!ticker.Code.Equals(checkpoint.Ticker.Code, StringComparison.OrdinalIgnoreCase))
                throw new ArgumentException("체크포인트의 티커가 일치하지 않습니다.", nameof(checkpoint));

            // Build all deep copies before changing any live field.
            var verified = CopyCandidates(checkpoint.VerifiedCandidates);
            var asks = CopyBook(checkpoint.AskOrders);
            var bids = CopyBook(checkpoint.BidOrders);
            _tickers[ticker.Code] = checkpoint.Ticker;
            _verifiedCandidates[ticker.Code] = verified;
            _asks[ticker.Code] = asks;
            _bids[ticker.Code] = bids;
            _virtualBalance = checkpoint.CashBalance;
            _reservedBalance = checkpoint.ReservedCashBalance;
            _verificationVersion++;
        }
    }

    private MarketEngineService(VerificationCheckpoint checkpoint)
    {
        var code = checkpoint.Ticker.Code;
        _tickers[code] = checkpoint.Ticker;
        _candidates[code] = CopyCandidates(checkpoint.Candidates);
        _trades[code] = checkpoint.Trades.Select(trade => trade with { }).ToList();
        RestoreVerificationCheckpoint(code, checkpoint);
    }

    public MarketEngineService CreateVerificationWorkspace(VerificationCheckpoint checkpoint) => new(checkpoint);

    public bool TryCommitVerification(VerificationCheckpoint checkpoint, BaitVerificationSummary summary, OptimalQuoteResult quote)
    {
        lock (_sync)
        {
            // Never overwrite orders placed while the model/auditor was running.
            if (_verificationVersion != checkpoint.Version) return false;
            var code = checkpoint.Ticker.Code;
            if (summary.TickerCode != code || quote.TickerCode != code ||
                quote.WholesaleFloorPrice != checkpoint.Ticker.WholesalePrice ||
                quote.VerifiedRetailCeilingPrice != summary.VerifiedRetailLowestPrice ||
                quote.RecommendedOptimalPrice <= quote.WholesaleFloorPrice ||
                quote.RecommendedOptimalPrice >= quote.VerifiedRetailCeilingPrice ||
                quote.RecommendedOptimalPrice % 100 != 0)
                throw new InvalidOperationException("감사 결과와 확정할 가격 밴드가 일치하지 않습니다.");

            try
            {
                UpdateVerifiedMarket(summary);
                _tickers[code] = _tickers[code] with { AiOptimalPrice = quote.RecommendedOptimalPrice };
                return true;
            }
            catch
            {
                RestoreVerificationCheckpoint(code, checkpoint);
                throw;
            }
        }
    }

    public OptimalQuoteResult RecomputeOptimalQuote(string tickerCode, int? minimumPrice = null, int? maximumPrice = null)
    {
        lock (_sync)
        {
            var quote = ProducePricingMath.ComputeQuote(GetOrderBook(tickerCode), minimumPrice, maximumPrice);
            _tickers[quote.TickerCode] = _tickers[quote.TickerCode] with { AiOptimalPrice = quote.RecommendedOptimalPrice };
            _verificationVersion++;
            return quote;
        }
    }

    private void RefreshOptimalPrice(string code)
    {
        try
        {
            RecomputeOptimalQuote(code);
        }
        catch (InvalidOperationException)
        {
            _tickers[code] = _tickers[code] with { AiOptimalPrice = 0 };
            _verificationVersion++;
        }
    }

    public SubmitOrderResponse SubmitOrder(SubmitOrderRequest req)
    {
        using var activity = GamsdaqTelemetry.ActivitySource.StartActivity("order.match");
        var started = Stopwatch.GetTimestamp();
        try
        {
            lock (_sync)
            {
                return MatchOrder(req);
            }
        }
        finally
        {
            GamsdaqTelemetry.OrdersProcessed.Add(1);
            GamsdaqTelemetry.OrderMatchingLatency.Record(Stopwatch.GetElapsedTime(started).TotalMilliseconds);
        }
    }

    private SubmitOrderResponse MatchOrder(SubmitOrderRequest req)
    {
        var ticker = GetTicker(req.TickerCode);
        bool isMarket = string.Equals(req.OrderType, "MARKET", StringComparison.OrdinalIgnoreCase);
        bool isBuy = string.Equals(req.Side, "BUY", StringComparison.OrdinalIgnoreCase);
        int targetPrice = req.Price;
        SubmitOrderResponse Reject(string message) =>
            new(false, message, 0, 0, 0, 0, _virtualBalance, null, GetOrderBook(ticker.Code));
        if (!req.ConfirmedByUser)
        {
            return Reject("Human-in-the-Loop 사용자 최종 승인이 필요합니다.");
        }

        var (isValid, warning) = PromptShieldGuardrail.ValidateOrderPriceGuardrail(
            req.Side,
            targetPrice,
            req.Quantity,
            ticker.WholesalePrice,
            ticker.VerifiedRetailLowestPrice,
            req.OrderType);

        if (!isValid)
        {
            return Reject(warning ?? "유효하지 않은 호가 주문입니다.");
        }

        var opposite = isBuy ? _asks[ticker.Code] : _bids[ticker.Code];
        var ownBook = isBuy ? _bids[ticker.Code] : _asks[ticker.Code];
        var prices = (isBuy ? opposite.Keys.AsEnumerable() : opposite.Keys.Reverse())
            .Where(price => price > ticker.WholesalePrice && price < ticker.VerifiedRetailLowestPrice &&
                (isMarket || (isBuy ? price <= targetPrice : price >= targetPrice))).ToList();

        // Preflight the entire walk and reserve any limit remainder before mutating.
        int projectedRemaining = req.Quantity;
        int projectedCost = 0;
        foreach (var price in prices)
        {
            int quantity = Math.Min(projectedRemaining, opposite[price].Sum(order => order.Quantity));
            projectedCost = checked(projectedCost + price * quantity);
            projectedRemaining -= quantity;
            if (projectedRemaining == 0) break;
        }

        int reserve = isBuy && !isMarket ? checked(targetPrice * projectedRemaining) : 0;
        if (isBuy && (long)projectedCost + reserve > _virtualBalance - _reservedBalance)
        {
            return Reject($"가상 예수금 가용 잔고({_virtualBalance - _reservedBalance:N0}원)가 체결금액 및 대기 예약금보다 부족합니다.");
        }
        if (isMarket && projectedRemaining == req.Quantity)
        {
            return Reject("상생 가격 밴드 내 체결 가능한 상대 호가가 없습니다.");
        }

        string orderId = $"ORD-{++_orderSeq}";
        var timestamp = DateTime.UtcNow;
        var fills = new List<TradeRecord>();
        int remaining = req.Quantity;
        int totalPaid = 0;
        foreach (var price in prices)
        {
            var queue = opposite[price];
            while (remaining > 0 && queue.First is { } node)
            {
                var resting = node.Value;
                int fillQty = Math.Min(remaining, resting.Quantity);
                int amount = price * fillQty;
                remaining -= fillQty;
                totalPaid += amount;
                if (resting.Quantity == fillQty) queue.RemoveFirst();
                else node.Value = resting with { Quantity = resting.Quantity - fillQty };

                var fill = new TradeRecord($"FILL-{++_tradeSeq}", ticker.Code, price, fillQty,
                    isBuy ? "BUY" : "SELL", DateTime.UtcNow, resting.OrderId, orderId);
                fills.Add(fill);
                _trades[ticker.Code].Insert(0, fill);
                _sellerPendingSettlement += amount;
                _totalFarmerExtraEarned += amount - ticker.WholesalePrice * fillQty;
                if (isBuy || resting.IsWalletFunded)
                {
                    _virtualBalance -= amount;
                    _totalConsumerSaved += ticker.VerifiedRetailLowestPrice * fillQty - amount;
                    if (resting.IsWalletFunded)
                    {
                        _reservedBalance -= amount;
                        CreateContract(ticker, fillQty, amount);
                    }
                }
                ticker = ticker with
                {
                    CurrentPrice = price,
                    HighPrice = Math.Max(ticker.HighPrice, price),
                    LowPrice = Math.Min(ticker.LowPrice, price)
                };
            }
            if (queue.Count == 0) opposite.Remove(price);
            if (remaining == 0) break;
        }
        int restingQty = isMarket ? 0 : remaining;
        if (restingQty > 0)
        {
            if (!ownBook.TryGetValue(targetPrice, out var queue))
            {
                queue = new LinkedList<OrderQueueEntry>();
                ownBook.Add(targetPrice, queue);
            }
            queue.AddLast(new OrderQueueEntry(orderId, targetPrice, restingQty, timestamp, isBuy));
            _reservedBalance += reserve;
        }
        _tickers[ticker.Code] = ticker;
        RefreshOptimalPrice(ticker.Code);
        int matched = req.Quantity - remaining;
        var contract = isBuy && matched > 0 ? CreateContract(ticker, matched, totalPaid) : null;
        int averagePrice = matched > 0 ? ProducePricingMath.RoundToTick((decimal)totalPaid / matched, 100) : 0;
        string message = $"[{(isBuy ? "매수" : "매도")}] {matched}박스 체결, {restingQty}박스 지정가 대기, 체결 총액 {totalPaid:N0}원";
        if (isMarket && remaining > 0) message += $", 미체결 {remaining}박스 취소";
        return new SubmitOrderResponse(true, message, matched, restingQty, averagePrice, totalPaid,
            _virtualBalance, contract, GetOrderBook(ticker.Code), orderId, fills);
    }

    private CartContractItem CreateContract(ProduceTicker ticker, int quantity, int totalPaid)
    {
        var contract = new CartContractItem($"CTR-2026-{_contractSeq++:D3}", ticker.Code, ticker.Name,
            ProducePricingMath.RoundToTick((decimal)totalPaid / quantity, 100), quantity, totalPaid,
            ticker.VerifiedRetailLowestPrice * quantity - totalPaid, totalPaid - ticker.WholesalePrice * quantity,
            "CONTRACT_EXECUTED", null, null, null, DateTime.UtcNow, null);
        _cartContracts.Insert(0, contract);
        return contract;
    }

    public WalletAndCartResponse GetWalletAndCart()
    {
        lock (_sync)
        {
            return new WalletAndCartResponse(
                VirtualBalance: _virtualBalance,
                SellerPendingSettlement: _sellerPendingSettlement,
                TotalConsumerSaved: _totalConsumerSaved,
                TotalFarmerExtraEarned: _totalFarmerExtraEarned,
                CartContracts: _cartContracts.ToList()
            );
        }
    }

    public (bool Success, string Message, CartContractItem? UpdatedContract) StartShipping(
        string contractId,
        ShippingRequest req)
    {
        lock (_sync)
        {
            var idx = _cartContracts.FindIndex(c => string.Equals(c.ContractId, contractId, StringComparison.OrdinalIgnoreCase));
            if (idx < 0)
            {
                return (false, "해당 체결 계약 번호를 찾을 수 없습니다.", null);
            }

            if (string.IsNullOrWhiteSpace(req.ShippingAddress) || string.IsNullOrWhiteSpace(req.RecipientName))
            {
                return (false, "수령인 성함과 배송지 주소를 모두 입력해 주세요.", null);
            }

            var maskedPhone = MaskPhone(req.RecipientPhone.Trim());
            var updated = _cartContracts[idx] with
            {
                Status = "SHIPPING_STARTED",
                RecipientName = req.RecipientName.Trim(),
                RecipientPhone = maskedPhone,
                ShippingAddress = req.ShippingAddress.Trim(),
                ShippedAt = DateTime.UtcNow
            };

            _cartContracts[idx] = updated;
            return (
                true,
                $"[배송 시작 완료] {updated.ItemName} ({updated.Quantity}박스) 산지 출고가 시작되었습니다. 수령지: {updated.ShippingAddress}",
                updated
            );
        }
    }

    private static string MaskPhone(string phone)
    {
        if (string.IsNullOrWhiteSpace(phone)) return "010-****-0000";
        var digits = new string(phone.Where(char.IsDigit).ToArray());
        if (digits.Length >= 10)
        {
            return $"{digits[..3]}-****-{digits[^4..]}";
        }
        return phone;
    }
}
