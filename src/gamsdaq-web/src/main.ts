import './style.css'

interface ProduceTicker {
  code: string
  name: string
  origin: string
  minBrix: number
  weightKg: number
  grade: string
  openPrice: number
  currentPrice: number
  highPrice: number
  lowPrice: number
  wholesalePrice: number
  verifiedRetailLowestPrice: number
  aiOptimalPrice: number
  executionStrength: number
}

interface OrderLevel {
  price: number
  quantity: number
  changeRatePercent: number
}

interface TradeRecord {
  id: string
  tickerCode: string
  price: number
  quantity: number
  side: 'BUY' | 'SELL'
  executedAt: string
}

interface EcommerceCandidate {
  id: string
  mallName: string
  productTitle: string
  listedPrice: number
  shippingFee: number
  listedWeightKg: number
  guaranteedBrix: number | null
  gradeText: string
  effective3KgOr5KgPrice: number
  isPassed: boolean
  gateCode: string
  verdictReason: string
  sourceUrl: string
}

interface OrderBookSnapshot {
  ticker: ProduceTicker
  asks: OrderLevel[]
  bids: OrderLevel[]
  totalAskQuantity: number
  totalBidQuantity: number
  recentTrades: TradeRecord[]
  verifiedCandidates: EcommerceCandidate[]
}

interface CartContractItem {
  contractId: string
  tickerCode: string
  itemName: string
  executedPrice: number
  quantity: number
  totalPaidAmount: number
  savedVsRetailAmount: number
  farmerExtraGainAmount: number
  status: 'CONTRACT_EXECUTED' | 'SHIPPING_STARTED'
  recipientName: string | null
  recipientPhone: string | null
  shippingAddress: string | null
  executedAt: string
  shippedAt: string | null
}

interface WalletAndCartResponse {
  virtualBalance: number
  sellerPendingSettlement: number
  totalConsumerSaved: number
  totalFarmerExtraEarned: number
  cartContracts: CartContractItem[]
}

interface AgentStreamEvent {
  stepId: string
  agentName: string
  status: string
  toolName: string | null
  summary: string
}

const state = {
  tickers: [] as ProduceTicker[],
  selectedTickerCode: 'JJ-GYUL-12B-3KG',
  orderBook: null as OrderBookSnapshot | null,
  walletAndCart: null as WalletAndCartResponse | null,
  leftView: 'ORDERBOOK' as 'ORDERBOOK' | 'CHART' | 'AI_AUDIT',
  rightTab: 'SELL' as 'SELL' | 'BUY' | 'CART',
  orderType: 'LIMIT' as 'LIMIT' | 'MARKET',
  inputPrice: 12400,
  inputQty: 10,
  naturalSellerInput: '오늘 수확한 12브릭스 노지 감귤 3kg 20박스 상생 최적가로 내놓을게요',
  lastBannerMessage: 'GitHub Copilot SDK 및 Microsoft.Agents.AI 5-에이전트 최저가 검증 엔진이 활성화되었습니다.',
  agentSteps: [] as AgentStreamEvent[],
  isStreamingAgents: false,
  confirmModalOpen: false,
  seniorLargeFont: false,
  recipientName: '김청도',
  recipientPhone: '010-2026-0419',
  shippingAddress: '경상북도 청도군 화양읍 청화로 70 (청도혁신센터)',
  copilotSessionMode: 'KEYLESS_DETERMINISTIC_AIFUNCTION',
  toolExecutionMode: 'DETERMINISTIC_AIFUNCTION'
}

function escapeHtml(raw: string | null | undefined): string {
  if (!raw) return ''
  return raw
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

function fmtWon(n: number): string {
  return `${n.toLocaleString('ko-KR')}원`
}

function fmtRate(rate: number): string {
  return `${rate > 0 ? '+' : ''}${rate.toFixed(2)}%`
}

async function loadInitialData() {
  const [tickersRes, walletRes, healthRes] = await Promise.all([
    fetch('/api/tickers'),
    fetch('/api/wallet-and-cart'),
    fetch('/api/health')
  ])
  state.tickers = await tickersRes.json()
  state.walletAndCart = await walletRes.json()
  if (healthRes.ok) {
    const h = await healthRes.json()
    state.copilotSessionMode = h.copilotSessionMode ?? state.copilotSessionMode
    state.toolExecutionMode = h.toolExecutionMode ?? state.toolExecutionMode
  }
  await loadOrderBook(state.selectedTickerCode, true)
}

async function loadOrderBook(tickerCode: string, resetPrice = false) {
  state.selectedTickerCode = tickerCode
  const res = await fetch(`/api/tickers/${tickerCode}/orderbook`)
  const ob: OrderBookSnapshot = await res.json()
  state.orderBook = ob
  if (resetPrice) {
    state.inputPrice = ob.ticker.currentPrice
  }
  renderApp()
}

async function runAgentVerificationStream() {
  if (state.isStreamingAgents) return
  state.isStreamingAgents = true
  state.agentSteps = []
  renderApp()

  try {
    const res = await fetch('/api/agents/verify-stream', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        query: state.naturalSellerInput,
        role: state.rightTab === 'BUY' ? 'BUYER' : 'SELLER',
        tickerCode: state.selectedTickerCode
      })
    })

    const reader = res.body?.getReader()
    const decoder = new TextDecoder()
    if (reader) {
      let buffer = ''
      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        buffer += decoder.decode(value, { stream: true })
        const parts = buffer.split('\n\n')
        buffer = parts.pop() || ''
        for (const chunk of parts) {
          const line = chunk.trim()
          if (line.startsWith('data:')) {
            const evt: AgentStreamEvent = JSON.parse(line.replace(/^data:\s*/, ''))
            state.agentSteps.push(evt)
            renderApp()
          }
        }
      }
    }
  } finally {
    state.isStreamingAgents = false
    renderApp()
  }
}

async function runNaturalSellerQuote() {
  const res = await fetch('/api/farmers/natural-quote', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ naturalText: state.naturalSellerInput })
  })
  const data = await res.json()
  if (!data.isSafeInput) {
    state.lastBannerMessage = `[가드레일 차단] ${data.safetyWarning}`
    renderApp()
    return
  }

  if (data.matchedTickerCode !== state.selectedTickerCode) {
    await loadOrderBook(data.matchedTickerCode, false)
  }
  state.inputPrice = data.recommendedAskPrice
  state.inputQty = data.extractedQuantity
  state.orderType = 'LIMIT'
  state.lastBannerMessage = `[Copilot SDK 자연어 호가 산출] ${data.reasoningSummary}`
  renderApp()
}

async function executeConfirmedOrder() {
  if (!state.orderBook) return
  state.confirmModalOpen = false

  const side = state.rightTab === 'BUY' ? 'BUY' : 'SELL'
  const res = await fetch('/api/orders', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      tickerCode: state.selectedTickerCode,
      side,
      orderType: state.orderType,
      price: state.inputPrice,
      quantity: state.inputQty,
      confirmedByUser: true
    })
  })
  const data = await res.json()
  state.lastBannerMessage = data.message

  const [tickersRes, walletRes] = await Promise.all([
    fetch('/api/tickers'),
    fetch('/api/wallet-and-cart')
  ])
  state.tickers = await tickersRes.json()
  state.walletAndCart = await walletRes.json()
  if (data.updatedOrderBook) {
    state.orderBook = data.updatedOrderBook
  }

  if (data.success && data.createdContract) {
    state.rightTab = 'CART'
  }
  renderApp()
}

async function submitShipping(contractId: string) {
  const res = await fetch(`/api/cart/${contractId}/ship`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      recipientName: state.recipientName,
      recipientPhone: state.recipientPhone,
      shippingAddress: state.shippingAddress
    })
  })
  const data = await res.json()
  state.lastBannerMessage = data.message
  if (data.walletAndCart) {
    state.walletAndCart = data.walletAndCart
  }
  renderApp()
}

function renderOrderBookView(ob: OrderBookSnapshot): string {
  const maxQty = Math.max(
    ...ob.asks.map(a => a.quantity),
    ...ob.bids.map(b => b.quantity),
    100
  )

  const askRows = ob.asks.map((a, idx) => {
    const pct = Math.min(100, Math.round((a.quantity / maxQty) * 100))
    const colorCls = a.changeRatePercent >= 0 ? 'up-txt' : 'down-txt'
    const isCurrent = a.price === ob.ticker.currentPrice ? 'current' : ''
    return `
      <div class="ob-cell-ask" data-pick-price="${a.price}">
        <div class="bar-ask" style="width:${pct}%"></div>
        <span class="z-txt down-txt">${a.quantity}</span>
      </div>
      <div class="ob-cell-price ${isCurrent}" data-pick-price="${a.price}">
        <span class="${colorCls}">${a.price.toLocaleString('ko-KR')}</span>
        <span class="${colorCls}" style="font-size:11px">${fmtRate(a.changeRatePercent)}</span>
      </div>
      ${idx === 0 ? `
        <div class="tape-cell" style="grid-row: span ${ob.asks.length}">
          <div style="font-weight:800;margin-bottom:6px;border-bottom:1px solid #DCDFE4;padding-bottom:4px">
            체결강도 <span class="${ob.ticker.executionStrength >= 100 ? 'up-txt' : 'down-txt'}">${ob.ticker.executionStrength.toFixed(1)}%</span>
          </div>
          <div style="display:flex;justify-content:space-between;color:#666666;margin-bottom:4px">
            <span>체결가</span><span>수량</span>
          </div>
          ${ob.recentTrades.map(tr => `
            <div style="display:flex;justify-content:space-between;margin-bottom:3px;font-weight:700">
              <span class="${tr.side === 'BUY' ? 'up-txt' : 'down-txt'}">${tr.price.toLocaleString('ko-KR')}</span>
              <span class="${tr.side === 'BUY' ? 'up-txt' : 'down-txt'}">${tr.quantity}</span>
            </div>
          `).join('')}
        </div>
      ` : ''}
    `
  }).join('')

  const bidRows = ob.bids.map((b, idx) => {
    const pct = Math.min(100, Math.round((b.quantity / maxQty) * 100))
    const colorCls = b.changeRatePercent >= 0 ? 'up-txt' : 'down-txt'
    const isCurrent = b.price === ob.ticker.currentPrice ? 'current' : ''
    return `
      ${idx === 0 ? `
        <div class="info-cell" style="grid-row: span ${ob.bids.length}">
          <div class="info-row"><span>시가</span><b>${ob.ticker.openPrice.toLocaleString('ko-KR')}</b></div>
          <div class="info-row"><span>고가</span><b class="up-txt">${ob.ticker.highPrice.toLocaleString('ko-KR')}</b></div>
          <div class="info-row"><span>저가</span><b class="down-txt">${ob.ticker.lowPrice.toLocaleString('ko-KR')}</b></div>
          <div style="border-top:1px solid #DCDFE4;margin:6px 0"></div>
          <div class="info-row"><span>도매하한</span><b>${ob.ticker.wholesalePrice.toLocaleString('ko-KR')}</b></div>
          <div class="info-row"><span>소매최저</span><b>${ob.ticker.verifiedRetailLowestPrice.toLocaleString('ko-KR')}</b></div>
          <div class="info-row"><span>호가단위</span><b>100원</b></div>
        </div>
      ` : ''}
      <div class="ob-cell-price ${isCurrent}" data-pick-price="${b.price}">
        <span class="${colorCls}">${b.price.toLocaleString('ko-KR')}</span>
        <span class="${colorCls}" style="font-size:11px">${fmtRate(b.changeRatePercent)}</span>
      </div>
      <div class="ob-cell-bid" data-pick-price="${b.price}">
        <div class="bar-bid" style="width:${pct}%"></div>
        <span class="z-txt up-txt">${b.quantity}</span>
      </div>
    `
  }).join('')

  return `
    <div class="ob-head">
      <div style="text-align:right">판매대기 잔량(박스)</div>
      <div style="text-align:center">호가 (클릭 시 자동입력)</div>
      <div>구매대기 잔량(박스)</div>
    </div>
    <div class="ob-grid">
      ${askRows}
      ${bidRows}
    </div>
    <div class="ob-footer">
      <div style="text-align:right" class="down-txt">총 판매 잔량 ${ob.totalAskQuantity.toLocaleString('ko-KR')}박스</div>
      <div style="text-align:center;color:#666666">잔량합계</div>
      <div class="up-txt">총 구매 잔량 ${ob.totalBidQuantity.toLocaleString('ko-KR')}박스</div>
    </div>
  `
}

function renderChartView(ob: OrderBookSnapshot): string {
  const t = ob.ticker
  const isUp = t.currentPrice >= t.openPrice
  const strokeColor = isUp ? '#E12343' : '#1B64DA'
  const minBand = t.wholesalePrice
  const maxBand = Math.max(t.verifiedRetailLowestPrice, minBand + 1000)
  const priceToY = (p: number) => {
    const ratio = (p - minBand) / (maxBand - minBand)
    return Math.round(195 - Math.max(0, Math.min(1, ratio)) * 160)
  }
  const openY = priceToY(t.openPrice)
  const optimalY = priceToY(t.aiOptimalPrice)
  const tradeSeries = [...ob.recentTrades].reverse().map(tr => tr.price)
  const chartPrices = tradeSeries.length >= 2
    ? [t.openPrice, ...tradeSeries, t.currentPrice]
    : [t.openPrice, t.aiOptimalPrice, t.currentPrice]
  const points = chartPrices.map((p, idx) => {
    const x = Math.round(20 + (idx / Math.max(1, chartPrices.length - 1)) * 680)
    const y = priceToY(p)
    return `${x},${y}`
  }).join(' ')

  return `
    <div class="chart-box">
      <div class="chart-meta">
        <span>실시간 체결 추이 및 상생 가격 밴드 (도매가 ${fmtWon(t.wholesalePrice)} &lt; 체결가 &lt; 인터넷최저가 ${fmtWon(t.verifiedRetailLowestPrice)})</span>
        <span class="${isUp ? 'up-txt' : 'down-txt'}">현재가 ${fmtWon(t.currentPrice)} | AI 최적호가 ${fmtWon(t.aiOptimalPrice)}</span>
      </div>
      <div class="svg-wrap">
        <svg viewBox="0 0 720 220" width="100%" height="100%">
          <line x1="20" y1="35" x2="700" y2="35" stroke="#DCDFE4" stroke-dasharray="4 4" />
          <text x="26" y="28" fill="#666666" font-size="11" font-weight="700">인터넷 실질 최저가 상한 (${fmtWon(t.verifiedRetailLowestPrice)})</text>

          <line x1="20" y1="${optimalY}" x2="700" y2="${optimalY}" stroke="#1B64DA" stroke-dasharray="2 2" />
          <text x="510" y="${Math.max(18, optimalY - 6)}" fill="#1B64DA" font-size="11" font-weight="700">AI 최적호가 (${fmtWon(t.aiOptimalPrice)})</text>

          <line x1="20" y1="${openY}" x2="700" y2="${openY}" stroke="#DCDFE4" />
          <text x="26" y="${Math.max(18, openY - 6)}" fill="#666666" font-size="11" font-weight="700">당일 시가 기준선 (${fmtWon(t.openPrice)})</text>

          <line x1="20" y1="195" x2="700" y2="195" stroke="#DCDFE4" stroke-dasharray="4 4" />
          <text x="26" y="188" fill="#666666" font-size="11" font-weight="700">산지 도매 기준가 하한 (${fmtWon(t.wholesalePrice)})</text>

          <polyline fill="none" stroke="${strokeColor}" stroke-width="3" points="${points}" />
        </svg>
      </div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-top:14px">
        <button class="cta-btn cta-sell" id="btn-quick-market-sell">
          현재 시장가(${fmtWon(ob.bids[0]?.price ?? t.currentPrice)})로 즉시 판매 등록
        </button>
        <button class="cta-btn cta-buy" id="btn-quick-market-buy">
          현재 시장가(${fmtWon(ob.asks[ob.asks.length - 1]?.price ?? t.currentPrice)})로 즉시 매수 주문
        </button>
      </div>
    </div>
  `
}

function renderAiAuditView(ob: OrderBookSnapshot): string {
  return `
    <div class="verify-box">
      <div class="verify-head">
        <div>
          <div style="font-size:14px;font-weight:800">4-Gate 미끼 상품 필터링 및 인터넷 실질 최저가 감사표</div>
          <div style="font-size:11px;color:#666666;margin-top:2px">
            GitHub.Copilot.SDK + Microsoft.Agents.AI 5-에이전트 파이프라인 검증 결과
          </div>
        </div>
        <button class="btn-outline" id="btn-run-agent-stream">
          ${state.isStreamingAgents ? '에이전트 검증 실행 중...' : '5-에이전트 실시간 재검증 실행'}
        </button>
      </div>
      <table class="cand-table">
        <thead>
          <tr>
            <th>판매처 (출처)</th>
            <th>상품명 / 규격</th>
            <th>표기가 + 배송비</th>
            <th>동일중량 환산가</th>
            <th>4-Gate 판정 사유</th>
          </tr>
        </thead>
        <tbody>
          ${ob.verifiedCandidates.map(c => `
            <tr>
              <td style="font-weight:700">
                <div>${escapeHtml(c.mallName)}</div>
                <div style="font-size:10px;color:#666666;font-weight:500">${escapeHtml(c.sourceUrl)}</div>
              </td>
              <td>${escapeHtml(c.productTitle)} (${c.listedWeightKg}kg | ${escapeHtml(c.gradeText)})</td>
              <td>${fmtWon(c.listedPrice)} + ${fmtWon(c.shippingFee)}</td>
              <td style="font-weight:800" class="${c.isPassed ? 'down-txt' : 'up-txt'}">${fmtWon(c.effective3KgOr5KgPrice)}</td>
              <td style="font-weight:700" class="${c.isPassed ? 'down-txt' : 'up-txt'}">${escapeHtml(c.verdictReason)}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>

      <div class="agent-stream-log">
        <div style="font-weight:800;margin-bottom:6px">
          Microsoft.Agents.AI + GitHub.Copilot.SDK 에이전트 실행 트레이스 (SSE Stream)
        </div>
        ${state.agentSteps.length === 0
          ? `<div style="color:#666666">상단 [5-에이전트 실시간 재검증 실행] 버튼을 누르면 5개 에이전트의 도구 호출 및 Maker-Checker 감사 로그가 실시간 스트리밍됩니다.</div>`
          : state.agentSteps.map(s => `
            <div class="agent-step">
              <div><b>[${escapeHtml(s.stepId)} | ${escapeHtml(s.agentName)}]</b> ${escapeHtml(s.summary)}</div>
              <div style="color:#666666;white-space:nowrap">${escapeHtml(s.status)}</div>
            </div>
          `).join('')}
      </div>
    </div>
  `
}

function renderRightPanel(ob: OrderBookSnapshot, wallet: WalletAndCartResponse): string {
  const t = ob.ticker
  const bestAsk = ob.asks.length > 0 ? Math.min(...ob.asks.map(a => a.price)) : t.currentPrice
  const bestBid = ob.bids.length > 0 ? Math.max(...ob.bids.map(b => b.price)) : t.currentPrice - 100

  if (state.rightTab === 'CART') {
    return `
      <div class="dock-body">
        <div style="font-size:14px;font-weight:800;margin-bottom:10px">
          체결 계약 장바구니 및 산지 직송 주소지 입력 (${wallet.cartContracts.length}건)
        </div>
        ${wallet.cartContracts.map(c => `
          <div class="cart-item">
            <div class="cart-head">
              <span>계약번호 ${c.contractId}</span>
              <span class="${c.status === 'SHIPPING_STARTED' ? 'down-txt' : 'up-txt'}">
                ${c.status === 'SHIPPING_STARTED' ? '산지 출고·배송 시작됨' : '매수계약 체결 완료 (배송대기)'}
              </span>
            </div>
            <div style="font-size:14px;font-weight:800;margin-bottom:4px">${c.itemName} (${c.quantity}박스)</div>
            <div style="font-size:12px;color:#666666">
              체결 단가 ${fmtWon(c.executedPrice)} | 결제 차감액 <b>${fmtWon(c.totalPaidAmount)}</b> | 인터넷 최저가 대비 <b class="up-txt">${fmtWon(c.savedVsRetailAmount)} 절약</b>
            </div>
            ${c.status === 'SHIPPING_STARTED' ? `
              <div style="margin-top:8px;padding:8px;background:#F5F6F8;border:1px solid #DCDFE4;font-size:12px;font-weight:700">
                수령인: ${escapeHtml(c.recipientName)} (${escapeHtml(c.recipientPhone)})<br/>
                배송지: ${escapeHtml(c.shippingAddress)}
              </div>
            ` : `
              <div class="ship-form">
                <input class="input-rect" id="inp-rec-name" value="${escapeHtml(state.recipientName)}" placeholder="수령인 성함" />
                <input class="input-rect" id="inp-rec-phone" value="${escapeHtml(state.recipientPhone)}" placeholder="연락처" />
                <input class="input-rect" id="inp-rec-addr" value="${escapeHtml(state.shippingAddress)}" placeholder="배송지 도로명 주소" />
                <button class="cta-btn cta-ship" data-ship-id="${escapeHtml(c.contractId)}">
                  주소 확인 및 산지 직송 배송받기
                </button>
              </div>
            `}
          </div>
        `).join('')}
      </div>
    `
  }

  const isSell = state.rightTab === 'SELL'
  const effectivePrice = state.orderType === 'MARKET'
    ? (isSell ? bestBid : bestAsk)
    : state.inputPrice
  const totalOrderWon = effectivePrice * state.inputQty
  const farmerDiffPerBox = effectivePrice - t.wholesalePrice
  const buyerSavedPerBox = t.verifiedRetailLowestPrice - effectivePrice

  return `
    <div class="dock-body">
      ${isSell ? `
        <div class="nlp-box">
          <div class="nlp-label">농부 자연어 한 줄 출하 (Copilot SDK 에이전트 자동 호가 변환)</div>
          <div class="nlp-row">
            <input class="input-rect" id="inp-nlp-seller" value="${escapeHtml(state.naturalSellerInput)}" />
            <button class="btn-outline" id="btn-nlp-quote" style="white-space:nowrap">AI 호가산출</button>
          </div>
        </div>
      ` : ''}

      <div class="form-row">
        <span class="form-lbl">주문 유형</span>
        <div class="type-switch">
          <button class="type-btn ${state.orderType === 'LIMIT' ? 'active' : ''}" id="btn-type-limit">지정가 호가</button>
          <button class="type-btn ${state.orderType === 'MARKET' ? 'active' : ''}" id="btn-type-market">시장가 즉시체결</button>
        </div>
      </div>

      <div class="form-row">
        <span class="form-lbl">${isSell ? '판매 희망 호가 (박스당)' : '매수 희망 호가 (박스당)'}</span>
        ${state.orderType === 'MARKET'
          ? `<div style="font-size:15px;font-weight:800">${fmtWon(effectivePrice)} (최우선 즉시체결가)</div>`
          : `
            <div class="stepper">
              <button class="step-btn" id="btn-price-minus">-</button>
              <input class="step-val" id="inp-order-price" type="number" step="100" value="${state.inputPrice}" />
              <button class="step-btn" id="btn-price-plus">+</button>
            </div>
          `}
      </div>

      <div class="form-row">
        <span class="form-lbl">주문 수량 (박스)</span>
        <div class="stepper">
          <button class="step-btn" id="btn-qty-minus">-</button>
          <input class="step-val" id="inp-order-qty" type="number" min="1" max="500" value="${state.inputQty}" />
          <button class="step-btn" id="btn-qty-plus">+</button>
        </div>
      </div>

      <div class="summary-card">
        <div class="sum-line">
          <span>종목 규격</span>
          <b>${t.name} (${t.minBrix}Brix+)</b>
        </div>
        <div class="sum-line">
          <span>산지 도매 기준가</span>
          <span>${fmtWon(t.wholesalePrice)}</span>
        </div>
        <div class="sum-line">
          <span>검증된 인터넷 실질 최저가</span>
          <span>${fmtWon(t.verifiedRetailLowestPrice)}</span>
        </div>
        <div class="sum-line">
          <span>${isSell ? '도매가 대비 농가 추가 수취액' : '인터넷 최저가 대비 소비자 절약액'}</span>
          <b class="${isSell ? 'down-txt' : 'up-txt'}">
            ${isSell
              ? `+${fmtWon(farmerDiffPerBox * state.inputQty)} (박스당 +${fmtWon(farmerDiffPerBox)})`
              : `-${fmtWon(buyerSavedPerBox * state.inputQty)} 절약 (박스당 -${fmtWon(buyerSavedPerBox)})`}
          </b>
        </div>
        <div class="sum-line">
          <span>${isSell ? '총 예상 판매 정산금' : '총 매수 결제 금액 (잔고 차감)'}</span>
          <span>${fmtWon(totalOrderWon)}</span>
        </div>
      </div>

      <button class="cta-btn ${isSell ? 'cta-sell' : 'cta-buy'}" id="btn-open-confirm">
        ${isSell
          ? (state.orderType === 'MARKET' ? `${fmtWon(effectivePrice)} 시장가 즉시 판매 체결하기` : `${fmtWon(effectivePrice)} 판매 호가 등록하기`)
          : (state.orderType === 'MARKET' ? `${fmtWon(effectivePrice)} 시장가 즉시 매수 계약 체결` : `${fmtWon(effectivePrice)} 매수 주문 제출하기`)}
      </button>

      <div class="status-banner">
        ${escapeHtml(state.lastBannerMessage)}
      </div>
    </div>
  `
}

function renderApp() {
  const root = document.querySelector<HTMLDivElement>('#app')
  if (!root || !state.orderBook || !state.walletAndCart) return

  document.body.classList.toggle('senior-large-font', state.seniorLargeFont)

  const ob = state.orderBook
  const t = ob.ticker
  const w = state.walletAndCart
  const changeDiff = t.currentPrice - t.openPrice
  const changeRate = ((t.currentPrice - t.openPrice) / t.openPrice) * 100
  const isUp = changeDiff >= 0
  const inWinWinBand = state.orderType === 'MARKET'
    ? (state.rightTab === 'SELL' ? ob.bids.length > 0 : ob.asks.length > 0)
    : (state.inputPrice > t.wholesalePrice && state.inputPrice < t.verifiedRetailLowestPrice && state.inputPrice % 100 === 0)

  let marketPreviewPrice = state.inputPrice
  let marketPreviewTotal = state.inputPrice * state.inputQty
  if (state.orderType === 'MARKET') {
    const levels = state.rightTab === 'SELL' ? ob.bids : [...ob.asks].reverse()
    let rem = state.inputQty
    let cost = 0
    let filled = 0
    for (const lv of levels) {
      const take = Math.min(rem, lv.quantity)
      cost += take * lv.price
      filled += take
      rem -= take
      if (rem <= 0) break
    }
    if (filled > 0) {
      marketPreviewPrice = Math.round(cost / filled)
      marketPreviewTotal = cost
    }
  }

  root.innerHTML = `
    <header class="topbar">
      <div class="brand-wrap">
        <div class="brand-title">감스닥 GAMSDAQ</div>
        <div class="brand-sub">AI 검증 (Copilot SDK + MS Agent Framework) | 연결모드: ${escapeHtml(state.copilotSessionMode)} | 시뮬레이션 데이터셋 (KAMIS·오픈마켓 스냅샷 출처 기반)</div>
      </div>
      <div class="wallet-bar">
        <button class="btn-outline" id="btn-reset-demo">데모 초기화</button>
        <button class="btn-outline" id="btn-toggle-senior">${state.seniorLargeFont ? '기본 글씨 크기' : '고령 농가 큰글씨 모드'}</button>
        <div class="wallet-box">구매자 가상 예수금 <b>${fmtWon(w.virtualBalance)}</b></div>
        <div class="wallet-box">판매자 누적 정산금 <b class="down-txt">${fmtWon(w.sellerPendingSettlement)}</b></div>
        <div class="wallet-box">장바구니 체결계약 <b class="up-txt">${w.cartContracts.length}건</b></div>
      </div>
    </header>

    <main class="layout">
      <section class="panel">
        <div class="ticker-strip">
          ${state.tickers.map(item => {
            const r = ((item.currentPrice - item.openPrice) / item.openPrice) * 100
            const up = r >= 0
            return `
              <button class="ticker-btn ${item.code === state.selectedTickerCode ? 'active' : ''}" data-ticker="${item.code}">
                <div class="t-code">${item.code} | ${item.origin}</div>
                <div class="t-name">${item.name}</div>
                <div class="t-price-row">
                  <span class="t-price ${up ? 'up-txt' : 'down-txt'}">${fmtWon(item.currentPrice)}</span>
                  <span class="t-rate ${up ? 'up-txt' : 'down-txt'}">시가대비 ${fmtRate(r)}</span>
                </div>
              </button>
            `
          }).join('')}
        </div>

        <div class="quote-header">
          <div>
            <div style="font-size:12px;color:#666666;font-weight:700">${t.code} | ${t.grade} | 당도 ${t.minBrix}Brix 이상 보증</div>
            <div class="q-main-price ${isUp ? 'up-txt' : 'down-txt'}">${fmtWon(t.currentPrice)}</div>
            <div class="q-diff ${isUp ? 'up-txt' : 'down-txt'}">
              당일 시가(${fmtWon(t.openPrice)}) 대비 ${changeDiff > 0 ? '+' : ''}${changeDiff.toLocaleString('ko-KR')}원 (${fmtRate(changeRate)})
            </div>
          </div>

          <div class="winwin-band">
            <div class="wb-cell">
              <div class="wb-lbl">산지 공판장 도매가(하한)</div>
              <div class="wb-val">${fmtWon(t.wholesalePrice)}</div>
            </div>
            <div class="wb-cell">
              <div class="wb-lbl">AI 추천 상생 최적호가</div>
              <div class="wb-val ${isUp ? 'up-txt' : 'down-txt'}">${fmtWon(t.aiOptimalPrice)}</div>
            </div>
            <div class="wb-cell">
              <div class="wb-lbl">검증된 인터넷 최저가(상한)</div>
              <div class="wb-val">${fmtWon(t.verifiedRetailLowestPrice)}</div>
            </div>
          </div>
        </div>

        <div class="view-tabs">
          <button class="v-tab ${state.leftView === 'ORDERBOOK' ? 'active' : ''}" data-view="ORDERBOOK">호가 (3열 지정가 호가창)</button>
          <button class="v-tab ${state.leftView === 'CHART' ? 'active' : ''}" data-view="CHART">차트 (간편 시장가 주문)</button>
          <button class="v-tab ${state.leftView === 'AI_AUDIT' ? 'active' : ''}" data-view="AI_AUDIT">AI 최저가 4-Gate 검증원장</button>
        </div>

        ${state.leftView === 'ORDERBOOK'
          ? renderOrderBookView(ob)
          : state.leftView === 'CHART'
            ? renderChartView(ob)
            : renderAiAuditView(ob)}
      </section>

      <aside class="right-col">
        <div class="panel">
          <div class="role-tabs">
            <button class="r-tab ${state.rightTab === 'SELL' ? 'active-sell' : ''}" data-rtab="SELL">판매자 출하·등록</button>
            <button class="r-tab ${state.rightTab === 'BUY' ? 'active-buy' : ''}" data-rtab="BUY">구매자 매수주문</button>
            <button class="r-tab ${state.rightTab === 'CART' ? 'active-cart' : ''}" data-rtab="CART">장바구니·배송 (${w.cartContracts.length})</button>
          </div>
          ${renderRightPanel(ob, w)}
        </div>
      </aside>
    </main>

    ${state.confirmModalOpen ? `
      <div class="modal-backdrop">
        <div class="modal-box">
          <div class="modal-title">주문 최종 확인 (Human-in-the-Loop 승인)</div>
          <div style="font-size:13px;line-height:1.6">
            <div>종목: <b>${escapeHtml(t.name)}</b></div>
            <div>구분: <b>${state.rightTab === 'SELL' ? '판매자 매도 호가 주문' : '구매자 매수 계약 주문'} (${state.orderType === 'MARKET' ? '시장가 다단계 즉시체결' : '지정가'})</b></div>
            <div>수량: <b>${state.inputQty}박스</b></div>
            <div>단가: <b>${fmtWon(marketPreviewPrice)}</b> (예상 총액 <b>${fmtWon(marketPreviewTotal)}</b>)</div>
            <div style="margin-top:8px;padding:8px;background:#F5F6F8;border:1px solid #DCDFE4;font-size:12px" class="${inWinWinBand ? 'down-txt' : 'up-txt'}">
              ${inWinWinBand
                ? `상생 가격 불변식 검증 통과: 산지 도매가(${fmtWon(t.wholesalePrice)}) < 주문 호가(${fmtWon(marketPreviewPrice)}) < 인터넷 최저가(${fmtWon(t.verifiedRetailLowestPrice)})`
                : `가드레일 경고: 주문 호가(${fmtWon(marketPreviewPrice)})가 상생 가격 밴드(${fmtWon(t.wholesalePrice)} < P < ${fmtWon(t.verifiedRetailLowestPrice)}) 또는 100원 호가 단위를 벗어났습니다.`}
            </div>
          </div>
          <div class="modal-actions">
            <button class="btn-outline" id="btn-modal-cancel">취소</button>
            <button class="cta-btn ${state.rightTab === 'SELL' ? 'cta-sell' : 'cta-buy'}" id="btn-modal-confirm">최종 승인 및 주문 실행</button>
          </div>
        </div>
      </div>
    ` : ''}
  `

  bindEvents()
}

function bindEvents() {
  const btnResetDemo = document.getElementById('btn-reset-demo')
  if (btnResetDemo) {
    btnResetDemo.onclick = async () => {
      const res = await fetch('/api/demo/reset', { method: 'POST' })
      const data = await res.json()
      state.walletAndCart = data.walletAndCart ?? data
      const tickersRes = await fetch('/api/tickers')
      state.tickers = await tickersRes.json()
      await loadOrderBook(state.selectedTickerCode, true)
      state.lastBannerMessage = data.message ?? '[데모 초기화 완료] 초기 호가창·예수금(500,000원)·장바구니 상태가 복원되었습니다.'
      renderApp()
    }
  }

  const btnSenior = document.getElementById('btn-toggle-senior')
  if (btnSenior) {
    btnSenior.onclick = () => {
      state.seniorLargeFont = !state.seniorLargeFont
      renderApp()
    }
  }

  document.querySelectorAll<HTMLButtonElement>('[data-ticker]').forEach(btn => {
    btn.onclick = () => {
      const code = btn.getAttribute('data-ticker')
      if (code) loadOrderBook(code, true)
    }
  })

  document.querySelectorAll<HTMLButtonElement>('[data-view]').forEach(btn => {
    btn.onclick = () => {
      const v = btn.getAttribute('data-view') as 'ORDERBOOK' | 'CHART' | 'AI_AUDIT'
      state.leftView = v
      renderApp()
    }
  })

  document.querySelectorAll<HTMLButtonElement>('[data-rtab]').forEach(btn => {
    btn.onclick = () => {
      const r = btn.getAttribute('data-rtab') as 'SELL' | 'BUY' | 'CART'
      state.rightTab = r
      renderApp()
    }
  })

  document.querySelectorAll<HTMLElement>('[data-pick-price]').forEach(el => {
    el.onclick = () => {
      const p = Number(el.getAttribute('data-pick-price'))
      if (p > 0) {
        state.inputPrice = p
        state.orderType = 'LIMIT'
        if (state.rightTab === 'CART') state.rightTab = 'BUY'
        renderApp()
      }
    }
  })

  const btnTypeLimit = document.getElementById('btn-type-limit')
  if (btnTypeLimit) btnTypeLimit.onclick = () => { state.orderType = 'LIMIT'; renderApp() }

  const btnTypeMarket = document.getElementById('btn-type-market')
  if (btnTypeMarket) btnTypeMarket.onclick = () => { state.orderType = 'MARKET'; renderApp() }

  const btnPriceMinus = document.getElementById('btn-price-minus')
  if (btnPriceMinus) btnPriceMinus.onclick = () => { state.inputPrice = Math.max(1000, state.inputPrice - 100); renderApp() }

  const btnPricePlus = document.getElementById('btn-price-plus')
  if (btnPricePlus) btnPricePlus.onclick = () => { state.inputPrice += 100; renderApp() }

  const inpPrice = document.getElementById('inp-order-price') as HTMLInputElement | null
  if (inpPrice) inpPrice.onchange = () => { state.inputPrice = Number(inpPrice.value) || state.inputPrice; renderApp() }

  const btnQtyMinus = document.getElementById('btn-qty-minus')
  if (btnQtyMinus) btnQtyMinus.onclick = () => { state.inputQty = Math.max(1, state.inputQty - 1); renderApp() }

  const btnQtyPlus = document.getElementById('btn-qty-plus')
  if (btnQtyPlus) btnQtyPlus.onclick = () => { state.inputQty = Math.min(500, state.inputQty + 1); renderApp() }

  const inpQty = document.getElementById('inp-order-qty') as HTMLInputElement | null
  if (inpQty) inpQty.onchange = () => { state.inputQty = Math.max(1, Number(inpQty.value) || 1); renderApp() }

  const inpNlp = document.getElementById('inp-nlp-seller') as HTMLInputElement | null
  if (inpNlp) inpNlp.oninput = () => { state.naturalSellerInput = inpNlp.value }

  const btnNlpQuote = document.getElementById('btn-nlp-quote')
  if (btnNlpQuote) btnNlpQuote.onclick = () => runNaturalSellerQuote()

  const btnRunStream = document.getElementById('btn-run-agent-stream')
  if (btnRunStream) btnRunStream.onclick = () => runAgentVerificationStream()

  const btnQuickSell = document.getElementById('btn-quick-market-sell')
  if (btnQuickSell && state.orderBook) {
    btnQuickSell.onclick = () => {
      state.rightTab = 'SELL'
      state.orderType = 'MARKET'
      state.inputPrice = state.orderBook!.bids[0]?.price ?? state.orderBook!.ticker.currentPrice
      state.confirmModalOpen = true
      renderApp()
    }
  }

  const btnQuickBuy = document.getElementById('btn-quick-market-buy')
  if (btnQuickBuy && state.orderBook) {
    btnQuickBuy.onclick = () => {
      state.rightTab = 'BUY'
      state.orderType = 'MARKET'
      const asks = state.orderBook!.asks
      state.inputPrice = asks.length > 0 ? Math.min(...asks.map(a => a.price)) : state.orderBook!.ticker.currentPrice
      state.confirmModalOpen = true
      renderApp()
    }
  }

  const btnOpenConfirm = document.getElementById('btn-open-confirm')
  if (btnOpenConfirm && state.orderBook) {
    btnOpenConfirm.onclick = () => {
      if (state.orderType === 'MARKET') {
        const asks = state.orderBook!.asks
        const bids = state.orderBook!.bids
        state.inputPrice = state.rightTab === 'BUY'
          ? (asks.length > 0 ? Math.min(...asks.map(a => a.price)) : state.orderBook!.ticker.currentPrice)
          : (bids.length > 0 ? Math.max(...bids.map(b => b.price)) : state.orderBook!.ticker.currentPrice)
      }
      state.confirmModalOpen = true
      renderApp()
    }
  }

  const btnModalCancel = document.getElementById('btn-modal-cancel')
  if (btnModalCancel) btnModalCancel.onclick = () => { state.confirmModalOpen = false; renderApp() }

  const btnModalConfirm = document.getElementById('btn-modal-confirm')
  if (btnModalConfirm) btnModalConfirm.onclick = () => executeConfirmedOrder()

  const inpRecName = document.getElementById('inp-rec-name') as HTMLInputElement | null
  if (inpRecName) inpRecName.oninput = () => { state.recipientName = inpRecName.value }

  const inpRecPhone = document.getElementById('inp-rec-phone') as HTMLInputElement | null
  if (inpRecPhone) inpRecPhone.oninput = () => { state.recipientPhone = inpRecPhone.value }

  const inpRecAddr = document.getElementById('inp-rec-addr') as HTMLInputElement | null
  if (inpRecAddr) inpRecAddr.oninput = () => { state.shippingAddress = inpRecAddr.value }

  document.querySelectorAll<HTMLButtonElement>('[data-ship-id]').forEach(btn => {
    btn.onclick = () => {
      const id = btn.getAttribute('data-ship-id')
      if (id) submitShipping(id)
    }
  })
}

loadInitialData()

