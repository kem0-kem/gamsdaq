(function(){let e=document.createElement(`link`).relList;if(e&&e.supports&&e.supports(`modulepreload`))return;for(let e of document.querySelectorAll(`link[rel="modulepreload"]`))n(e);new MutationObserver(e=>{for(let t of e)if(t.type===`childList`)for(let e of t.addedNodes)e.tagName===`LINK`&&e.rel===`modulepreload`&&n(e)}).observe(document,{childList:!0,subtree:!0});function t(e){let t={};return e.integrity&&(t.integrity=e.integrity),e.referrerPolicy&&(t.referrerPolicy=e.referrerPolicy),t.credentials=e.crossOrigin===`use-credentials`?`include`:e.crossOrigin===`anonymous`?`omit`:`same-origin`,t}function n(e){if(e.ep)return;e.ep=!0;let n=t(e);fetch(e.href,n)}})();var e={tickers:[],selectedTickerCode:`JJ-GYUL-12B-3KG`,orderBook:null,walletAndCart:null,leftView:`ORDERBOOK`,rightTab:`SELL`,orderType:`LIMIT`,inputPrice:12400,inputQty:10,naturalSellerInput:`오늘 수확한 12브릭스 노지 감귤 3kg 20박스 상생 최적가로 내놓을게요`,lastBannerMessage:`GitHub Copilot SDK 및 Microsoft.Agents.AI 5-에이전트 최저가 검증 엔진이 활성화되었습니다.`,agentSteps:[],isStreamingAgents:!1,confirmModalOpen:!1,recipientName:`김청도`,recipientPhone:`010-2026-0419`,shippingAddress:`경상북도 청도군 화양읍 청화로 70 (청도혁신센터)`};function t(e){return`${e.toLocaleString(`ko-KR`)}원`}function n(e){return`${e>0?`+`:``}${e.toFixed(2)}%`}async function r(){let[t,n]=await Promise.all([fetch(`/api/tickers`),fetch(`/api/wallet-and-cart`)]);e.tickers=await t.json(),e.walletAndCart=await n.json(),await i(e.selectedTickerCode,!0)}async function i(t,n=!1){e.selectedTickerCode=t;let r=await(await fetch(`/api/tickers/${t}/orderbook`)).json();e.orderBook=r,n&&(e.inputPrice=r.ticker.currentPrice),p()}async function a(){if(!e.isStreamingAgents){e.isStreamingAgents=!0,e.agentSteps=[],p();try{let t=(await fetch(`/api/agents/verify-stream`,{method:`POST`,headers:{"Content-Type":`application/json`},body:JSON.stringify({query:e.naturalSellerInput,role:e.rightTab===`BUY`?`BUYER`:`SELLER`,tickerCode:e.selectedTickerCode})})).body?.getReader(),n=new TextDecoder;if(t){let r=``;for(;;){let{done:i,value:a}=await t.read();if(i)break;r+=n.decode(a,{stream:!0});let o=r.split(`

`);r=o.pop()||``;for(let t of o){let n=t.trim();if(n.startsWith(`data:`)){let t=JSON.parse(n.replace(/^data:\s*/,``));e.agentSteps.push(t),p()}}}}}finally{e.isStreamingAgents=!1,p()}}}async function o(){let t=await(await fetch(`/api/farmers/natural-quote`,{method:`POST`,headers:{"Content-Type":`application/json`},body:JSON.stringify({naturalText:e.naturalSellerInput})})).json();t.isSafeInput?(t.matchedTickerCode!==e.selectedTickerCode&&await i(t.matchedTickerCode,!1),e.inputPrice=t.recommendedAskPrice,e.inputQty=t.extractedQuantity,e.orderType=`LIMIT`,e.lastBannerMessage=`[Copilot SDK 자연어 호가 산출] ${t.reasoningSummary}`,p()):(e.lastBannerMessage=`[가드레일 차단] ${t.safetyWarning}`,p())}async function s(){if(!e.orderBook)return;e.confirmModalOpen=!1;let t=e.rightTab===`BUY`?`BUY`:`SELL`,n=await(await fetch(`/api/orders`,{method:`POST`,headers:{"Content-Type":`application/json`},body:JSON.stringify({tickerCode:e.selectedTickerCode,side:t,orderType:e.orderType,price:e.inputPrice,quantity:e.inputQty,confirmedByUser:!0})})).json();e.lastBannerMessage=n.message;let[r,i]=await Promise.all([fetch(`/api/tickers`),fetch(`/api/wallet-and-cart`)]);e.tickers=await r.json(),e.walletAndCart=await i.json(),n.updatedOrderBook&&(e.orderBook=n.updatedOrderBook),n.success&&n.createdContract&&(e.rightTab=`CART`),p()}async function c(t){let n=await(await fetch(`/api/cart/${t}/ship`,{method:`POST`,headers:{"Content-Type":`application/json`},body:JSON.stringify({recipientName:e.recipientName,recipientPhone:e.recipientPhone,shippingAddress:e.shippingAddress})})).json();e.lastBannerMessage=n.message,n.walletAndCart&&(e.walletAndCart=n.walletAndCart),p()}function l(e){let t=Math.max(...e.asks.map(e=>e.quantity),...e.bids.map(e=>e.quantity),100);return`
    <div class="ob-head">
      <div style="text-align:right">판매대기 잔량(박스)</div>
      <div style="text-align:center">호가 (클릭 시 자동입력)</div>
      <div>구매대기 잔량(박스)</div>
    </div>
    <div class="ob-grid">
      ${e.asks.map((r,i)=>{let a=Math.min(100,Math.round(r.quantity/t*100)),o=r.changeRatePercent>=0?`up-txt`:`down-txt`,s=r.price===e.ticker.currentPrice?`current`:``;return`
      <div class="ob-cell-ask" data-pick-price="${r.price}">
        <div class="bar-ask" style="width:${a}%"></div>
        <span class="z-txt down-txt">${r.quantity}</span>
      </div>
      <div class="ob-cell-price ${s}" data-pick-price="${r.price}">
        <span class="${o}">${r.price.toLocaleString(`ko-KR`)}</span>
        <span class="${o}" style="font-size:11px">${n(r.changeRatePercent)}</span>
      </div>
      ${i===0?`
        <div class="tape-cell" style="grid-row: span ${e.asks.length}">
          <div style="font-weight:800;margin-bottom:6px;border-bottom:1px solid #DCDFE4;padding-bottom:4px">
            체결강도 <span class="${e.ticker.executionStrength>=100?`up-txt`:`down-txt`}">${e.ticker.executionStrength.toFixed(1)}%</span>
          </div>
          <div style="display:flex;justify-content:space-between;color:#666666;margin-bottom:4px">
            <span>체결가</span><span>수량</span>
          </div>
          ${e.recentTrades.map(e=>`
            <div style="display:flex;justify-content:space-between;margin-bottom:3px;font-weight:700">
              <span class="${e.side===`BUY`?`up-txt`:`down-txt`}">${e.price.toLocaleString(`ko-KR`)}</span>
              <span class="${e.side===`BUY`?`up-txt`:`down-txt`}">${e.quantity}</span>
            </div>
          `).join(``)}
        </div>
      `:``}
    `}).join(``)}
      ${e.bids.map((r,i)=>{let a=Math.min(100,Math.round(r.quantity/t*100)),o=r.changeRatePercent>=0?`up-txt`:`down-txt`,s=r.price===e.ticker.currentPrice?`current`:``;return`
      ${i===0?`
        <div class="info-cell" style="grid-row: span ${e.bids.length}">
          <div class="info-row"><span>시가</span><b>${e.ticker.openPrice.toLocaleString(`ko-KR`)}</b></div>
          <div class="info-row"><span>고가</span><b class="up-txt">${e.ticker.highPrice.toLocaleString(`ko-KR`)}</b></div>
          <div class="info-row"><span>저가</span><b class="down-txt">${e.ticker.lowPrice.toLocaleString(`ko-KR`)}</b></div>
          <div style="border-top:1px solid #DCDFE4;margin:6px 0"></div>
          <div class="info-row"><span>도매하한</span><b>${e.ticker.wholesalePrice.toLocaleString(`ko-KR`)}</b></div>
          <div class="info-row"><span>소매최저</span><b>${e.ticker.verifiedRetailLowestPrice.toLocaleString(`ko-KR`)}</b></div>
          <div class="info-row"><span>호가단위</span><b>100원</b></div>
        </div>
      `:``}
      <div class="ob-cell-price ${s}" data-pick-price="${r.price}">
        <span class="${o}">${r.price.toLocaleString(`ko-KR`)}</span>
        <span class="${o}" style="font-size:11px">${n(r.changeRatePercent)}</span>
      </div>
      <div class="ob-cell-bid" data-pick-price="${r.price}">
        <div class="bar-bid" style="width:${a}%"></div>
        <span class="z-txt up-txt">${r.quantity}</span>
      </div>
    `}).join(``)}
    </div>
    <div class="ob-footer">
      <div style="text-align:right" class="down-txt">총 판매 잔량 ${e.totalAskQuantity.toLocaleString(`ko-KR`)}박스</div>
      <div style="text-align:center;color:#666666">잔량합계</div>
      <div class="up-txt">총 구매 잔량 ${e.totalBidQuantity.toLocaleString(`ko-KR`)}박스</div>
    </div>
  `}function u(e){let n=e.ticker,r=n.currentPrice>=n.openPrice,i=r?`#E12343`:`#1B64DA`,a=r?`20,165 95,155 170,160 245,140 320,132 395,118 470,124 545,98 620,88 700,72`:`20,70 95,82 170,78 245,104 320,118 395,130 470,125 545,148 620,158 700,168`;return`
    <div class="chart-box">
      <div class="chart-meta">
        <span>실시간 체결 추이 및 상생 가격 밴드 (도매가 ${t(n.wholesalePrice)} ~ 인터넷최저가 ${t(n.verifiedRetailLowestPrice)})</span>
        <span class="${r?`up-txt`:`down-txt`}">현재가 ${t(n.currentPrice)}</span>
      </div>
      <div class="svg-wrap">
        <svg viewBox="0 0 720 220" width="100%" height="100%">
          <line x1="20" y1="35" x2="700" y2="35" stroke="#DCDFE4" stroke-dasharray="4 4" />
          <text x="26" y="28" fill="#666666" font-size="11" font-weight="700">인터넷 실질 최저가 상한 (${t(n.verifiedRetailLowestPrice)})</text>

          <line x1="20" y1="115" x2="700" y2="115" stroke="#DCDFE4" />
          <text x="26" y="108" fill="#666666" font-size="11" font-weight="700">당일 시가 기준선 (${t(n.openPrice)})</text>

          <line x1="20" y1="195" x2="700" y2="195" stroke="#DCDFE4" stroke-dasharray="4 4" />
          <text x="26" y="188" fill="#666666" font-size="11" font-weight="700">산지 도매 기준가 하한 (${t(n.wholesalePrice)})</text>

          <polyline fill="none" stroke="${i}" stroke-width="3" points="${a}" />
        </svg>
      </div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-top:14px">
        <button class="cta-btn cta-sell" id="btn-quick-market-sell">
          현재 시장가(${t(e.bids[0]?.price??n.currentPrice)})로 즉시 판매 등록
        </button>
        <button class="cta-btn cta-buy" id="btn-quick-market-buy">
          현재 시장가(${t(e.asks[e.asks.length-1]?.price??n.currentPrice)})로 즉시 매수 주문
        </button>
      </div>
    </div>
  `}function d(n){return`
    <div class="verify-box">
      <div class="verify-head">
        <div>
          <div style="font-size:14px;font-weight:800">4-Gate 미끼 상품 필터링 및 인터넷 실질 최저가 감사표</div>
          <div style="font-size:11px;color:#666666;margin-top:2px">
            GitHub.Copilot.SDK + Microsoft.Agents.AI 5-에이전트 파이프라인 검증 결과
          </div>
        </div>
        <button class="btn-outline" id="btn-run-agent-stream">
          ${e.isStreamingAgents?`에이전트 검증 실행 중...`:`5-에이전트 실시간 재검증 실행`}
        </button>
      </div>
      <table class="cand-table">
        <thead>
          <tr>
            <th>판매처</th>
            <th>상품명 / 규격</th>
            <th>표기가 + 배송비</th>
            <th>동일중량 환산가</th>
            <th>4-Gate 판정 사유</th>
          </tr>
        </thead>
        <tbody>
          ${n.verifiedCandidates.map(e=>`
            <tr>
              <td style="font-weight:700">${e.mallName}</td>
              <td>${e.productTitle} (${e.listedWeightKg}kg)</td>
              <td>${t(e.listedPrice)} + ${t(e.shippingFee)}</td>
              <td style="font-weight:800" class="${e.isPassed?`down-txt`:`up-txt`}">${t(e.effective3KgOr5KgPrice)}</td>
              <td style="font-weight:700" class="${e.isPassed?`down-txt`:`up-txt`}">${e.verdictReason}</td>
            </tr>
          `).join(``)}
        </tbody>
      </table>

      <div class="agent-stream-log">
        <div style="font-weight:800;margin-bottom:6px">
          Microsoft.Agents.AI + GitHub.Copilot.SDK 에이전트 실행 트레이스 (SSE Stream)
        </div>
        ${e.agentSteps.length===0?`<div style="color:#666666">상단 [5-에이전트 실시간 재검증 실행] 버튼을 누르면 5개 에이전트의 도구 호출 및 Maker-Checker 감사 로그가 실시간 스트리밍됩니다.</div>`:e.agentSteps.map(e=>`
            <div class="agent-step">
              <div><b>[${e.stepId} | ${e.agentName}]</b> ${e.summary}</div>
              <div style="color:#666666;white-space:nowrap">${e.status}</div>
            </div>
          `).join(``)}
      </div>
    </div>
  `}function f(n,r){let i=n.ticker,a=n.asks.length>0?Math.min(...n.asks.map(e=>e.price)):i.currentPrice,o=n.bids.length>0?Math.max(...n.bids.map(e=>e.price)):i.currentPrice-100;if(e.rightTab===`CART`)return`
      <div class="dock-body">
        <div style="font-size:14px;font-weight:800;margin-bottom:10px">
          체결 계약 장바구니 및 산지 직송 주소지 입력 (${r.cartContracts.length}건)
        </div>
        ${r.cartContracts.map(n=>`
          <div class="cart-item">
            <div class="cart-head">
              <span>계약번호 ${n.contractId}</span>
              <span class="${n.status===`SHIPPING_STARTED`?`down-txt`:`up-txt`}">
                ${n.status===`SHIPPING_STARTED`?`산지 출고·배송 시작됨`:`매수계약 체결 완료 (배송대기)`}
              </span>
            </div>
            <div style="font-size:14px;font-weight:800;margin-bottom:4px">${n.itemName} (${n.quantity}박스)</div>
            <div style="font-size:12px;color:#666666">
              체결 단가 ${t(n.executedPrice)} | 결제 차감액 <b>${t(n.totalPaidAmount)}</b> | 인터넷 최저가 대비 <b class="up-txt">${t(n.savedVsRetailAmount)} 절약</b>
            </div>
            ${n.status===`SHIPPING_STARTED`?`
              <div style="margin-top:8px;padding:8px;background:#F5F6F8;border:1px solid #DCDFE4;font-size:12px;font-weight:700">
                수령인: ${n.recipientName} (${n.recipientPhone})<br/>
                배송지: ${n.shippingAddress}
              </div>
            `:`
              <div class="ship-form">
                <input class="input-rect" id="inp-rec-name" value="${e.recipientName}" placeholder="수령인 성함" />
                <input class="input-rect" id="inp-rec-phone" value="${e.recipientPhone}" placeholder="연락처" />
                <input class="input-rect" id="inp-rec-addr" value="${e.shippingAddress}" placeholder="배송지 도로명 주소" />
                <button class="cta-btn cta-ship" data-ship-id="${n.contractId}">
                  주소 확인 및 산지 직송 배송받기
                </button>
              </div>
            `}
          </div>
        `).join(``)}
      </div>
    `;let s=e.rightTab===`SELL`,c=e.orderType===`MARKET`?s?o:a:e.inputPrice,l=c*e.inputQty,u=c-i.wholesalePrice,d=i.verifiedRetailLowestPrice-c;return`
    <div class="dock-body">
      ${s?`
        <div class="nlp-box">
          <div class="nlp-label">농부 자연어 한 줄 출하 (Copilot SDK 에이전트 자동 호가 변환)</div>
          <div class="nlp-row">
            <input class="input-rect" id="inp-nlp-seller" value="${e.naturalSellerInput}" />
            <button class="btn-outline" id="btn-nlp-quote" style="white-space:nowrap">AI 호가산출</button>
          </div>
        </div>
      `:``}

      <div class="form-row">
        <span class="form-lbl">주문 유형</span>
        <div class="type-switch">
          <button class="type-btn ${e.orderType===`LIMIT`?`active`:``}" id="btn-type-limit">지정가 호가</button>
          <button class="type-btn ${e.orderType===`MARKET`?`active`:``}" id="btn-type-market">시장가 즉시체결</button>
        </div>
      </div>

      <div class="form-row">
        <span class="form-lbl">${s?`판매 희망 호가 (박스당)`:`매수 희망 호가 (박스당)`}</span>
        ${e.orderType===`MARKET`?`<div style="font-size:15px;font-weight:800">${t(c)} (최우선 즉시체결가)</div>`:`
            <div class="stepper">
              <button class="step-btn" id="btn-price-minus">-</button>
              <input class="step-val" id="inp-order-price" type="number" step="100" value="${e.inputPrice}" />
              <button class="step-btn" id="btn-price-plus">+</button>
            </div>
          `}
      </div>

      <div class="form-row">
        <span class="form-lbl">주문 수량 (박스)</span>
        <div class="stepper">
          <button class="step-btn" id="btn-qty-minus">-</button>
          <input class="step-val" id="inp-order-qty" type="number" min="1" max="500" value="${e.inputQty}" />
          <button class="step-btn" id="btn-qty-plus">+</button>
        </div>
      </div>

      <div class="summary-card">
        <div class="sum-line">
          <span>종목 규격</span>
          <b>${i.name} (${i.minBrix}Brix+)</b>
        </div>
        <div class="sum-line">
          <span>산지 도매 기준가</span>
          <span>${t(i.wholesalePrice)}</span>
        </div>
        <div class="sum-line">
          <span>검증된 인터넷 실질 최저가</span>
          <span>${t(i.verifiedRetailLowestPrice)}</span>
        </div>
        <div class="sum-line">
          <span>${s?`도매가 대비 농가 추가 수취액`:`인터넷 최저가 대비 소비자 절약액`}</span>
          <b class="${s?`down-txt`:`up-txt`}">
            ${s?`+${t(u*e.inputQty)} (박스당 +${t(u)})`:`-${t(d*e.inputQty)} 절약 (박스당 -${t(d)})`}
          </b>
        </div>
        <div class="sum-line">
          <span>${s?`총 예상 판매 정산금`:`총 매수 결제 금액 (잔고 차감)`}</span>
          <span>${t(l)}</span>
        </div>
      </div>

      <button class="cta-btn ${s?`cta-sell`:`cta-buy`}" id="btn-open-confirm">
        ${s?e.orderType===`MARKET`?`${t(c)} 시장가 즉시 판매 체결하기`:`${t(c)} 판매 호가 등록하기`:e.orderType===`MARKET`?`${t(c)} 시장가 즉시 매수 계약 체결`:`${t(c)} 매수 주문 제출하기`}
      </button>

      <div class="status-banner">
        ${e.lastBannerMessage}
      </div>
    </div>
  `}function p(){let r=document.querySelector(`#app`);if(!r||!e.orderBook||!e.walletAndCart)return;let i=e.orderBook,a=i.ticker,o=e.walletAndCart,s=a.currentPrice-a.openPrice,c=(a.currentPrice-a.openPrice)/a.openPrice*100,p=s>=0;r.innerHTML=`
    <header class="topbar">
      <div class="brand-wrap">
        <div class="brand-title">감스닥 GAMSDAQ</div>
        <div class="brand-sub">GitHub Copilot SDK + Microsoft Agent Framework 기반 농산물 상생 호가 거래소</div>
      </div>
      <div class="wallet-bar">
        <div class="wallet-box">구매자 가상 예수금 <b>${t(o.virtualBalance)}</b></div>
        <div class="wallet-box">판매자 누적 정산금 <b class="down-txt">${t(o.sellerPendingSettlement)}</b></div>
        <div class="wallet-box">장바구니 체결계약 <b class="up-txt">${o.cartContracts.length}건</b></div>
      </div>
    </header>

    <main class="layout">
      <section class="panel">
        <div class="ticker-strip">
          ${e.tickers.map(r=>{let i=(r.currentPrice-r.openPrice)/r.openPrice*100,a=i>=0;return`
              <button class="ticker-btn ${r.code===e.selectedTickerCode?`active`:``}" data-ticker="${r.code}">
                <div class="t-code">${r.code} | ${r.origin}</div>
                <div class="t-name">${r.name}</div>
                <div class="t-price-row">
                  <span class="t-price ${a?`up-txt`:`down-txt`}">${t(r.currentPrice)}</span>
                  <span class="t-rate ${a?`up-txt`:`down-txt`}">시가대비 ${n(i)}</span>
                </div>
              </button>
            `}).join(``)}
        </div>

        <div class="quote-header">
          <div>
            <div style="font-size:12px;color:#666666;font-weight:700">${a.code} | ${a.grade} | 당도 ${a.minBrix}Brix 이상 보증</div>
            <div class="q-main-price ${p?`up-txt`:`down-txt`}">${t(a.currentPrice)}</div>
            <div class="q-diff ${p?`up-txt`:`down-txt`}">
              당일 시가(${t(a.openPrice)}) 대비 ${s>0?`+`:``}${s.toLocaleString(`ko-KR`)}원 (${n(c)})
            </div>
          </div>

          <div class="winwin-band">
            <div class="wb-cell">
              <div class="wb-lbl">산지 공판장 도매가(하한)</div>
              <div class="wb-val">${t(a.wholesalePrice)}</div>
            </div>
            <div class="wb-cell">
              <div class="wb-lbl">AI 추천 상생 최적호가</div>
              <div class="wb-val ${p?`up-txt`:`down-txt`}">${t(a.aiOptimalPrice)}</div>
            </div>
            <div class="wb-cell">
              <div class="wb-lbl">검증된 인터넷 최저가(상한)</div>
              <div class="wb-val">${t(a.verifiedRetailLowestPrice)}</div>
            </div>
          </div>
        </div>

        <div class="view-tabs">
          <button class="v-tab ${e.leftView===`ORDERBOOK`?`active`:``}" data-view="ORDERBOOK">호가 (3열 지정가 호가창)</button>
          <button class="v-tab ${e.leftView===`CHART`?`active`:``}" data-view="CHART">차트 (간편 시장가 주문)</button>
          <button class="v-tab ${e.leftView===`AI_AUDIT`?`active`:``}" data-view="AI_AUDIT">AI 최저가 4-Gate 검증원장</button>
        </div>

        ${e.leftView===`ORDERBOOK`?l(i):e.leftView===`CHART`?u(i):d(i)}
      </section>

      <aside class="right-col">
        <div class="panel">
          <div class="role-tabs">
            <button class="r-tab ${e.rightTab===`SELL`?`active-sell`:``}" data-rtab="SELL">판매자 출하·등록</button>
            <button class="r-tab ${e.rightTab===`BUY`?`active-buy`:``}" data-rtab="BUY">구매자 매수주문</button>
            <button class="r-tab ${e.rightTab===`CART`?`active-cart`:``}" data-rtab="CART">장바구니·배송 (${o.cartContracts.length})</button>
          </div>
          ${f(i,o)}
        </div>
      </aside>
    </main>

    ${e.confirmModalOpen?`
      <div class="modal-backdrop">
        <div class="modal-box">
          <div class="modal-title">주문 최종 확인 (Human-in-the-Loop 승인)</div>
          <div style="font-size:13px;line-height:1.6">
            <div>종목: <b>${a.name}</b></div>
            <div>구분: <b>${e.rightTab===`SELL`?`판매자 매도 호가 주문`:`구매자 매수 계약 주문`} (${e.orderType===`MARKET`?`시장가`:`지정가`})</b></div>
            <div>수량: <b>${e.inputQty}박스</b></div>
            <div>단가: <b>${t(e.inputPrice)}</b> (총액 <b>${t(e.inputPrice*e.inputQty)}</b>)</div>
            <div style="margin-top:8px;padding:8px;background:#F5F6F8;border:1px solid #DCDFE4;font-size:12px">
              상생 가격 불변식 검증 통과: 산지 도매가(${t(a.wholesalePrice)}) &lt; 주문 호가 &lt; 인터넷 최저가(${t(a.verifiedRetailLowestPrice)})
            </div>
          </div>
          <div class="modal-actions">
            <button class="btn-outline" id="btn-modal-cancel">취소</button>
            <button class="cta-btn ${e.rightTab===`SELL`?`cta-sell`:`cta-buy`}" id="btn-modal-confirm">최종 승인 및 주문 실행</button>
          </div>
        </div>
      </div>
    `:``}
  `,m()}function m(){document.querySelectorAll(`[data-ticker]`).forEach(e=>{e.onclick=()=>{let t=e.getAttribute(`data-ticker`);t&&i(t,!0)}}),document.querySelectorAll(`[data-view]`).forEach(t=>{t.onclick=()=>{e.leftView=t.getAttribute(`data-view`),p()}}),document.querySelectorAll(`[data-rtab]`).forEach(t=>{t.onclick=()=>{e.rightTab=t.getAttribute(`data-rtab`),p()}}),document.querySelectorAll(`[data-pick-price]`).forEach(t=>{t.onclick=()=>{let n=Number(t.getAttribute(`data-pick-price`));n>0&&(e.inputPrice=n,e.orderType=`LIMIT`,e.rightTab===`CART`&&(e.rightTab=`BUY`),p())}});let t=document.getElementById(`btn-type-limit`);t&&(t.onclick=()=>{e.orderType=`LIMIT`,p()});let n=document.getElementById(`btn-type-market`);n&&(n.onclick=()=>{e.orderType=`MARKET`,p()});let r=document.getElementById(`btn-price-minus`);r&&(r.onclick=()=>{e.inputPrice=Math.max(1e3,e.inputPrice-100),p()});let l=document.getElementById(`btn-price-plus`);l&&(l.onclick=()=>{e.inputPrice+=100,p()});let u=document.getElementById(`inp-order-price`);u&&(u.onchange=()=>{e.inputPrice=Number(u.value)||e.inputPrice,p()});let d=document.getElementById(`btn-qty-minus`);d&&(d.onclick=()=>{e.inputQty=Math.max(1,e.inputQty-1),p()});let f=document.getElementById(`btn-qty-plus`);f&&(f.onclick=()=>{e.inputQty=Math.min(500,e.inputQty+1),p()});let m=document.getElementById(`inp-order-qty`);m&&(m.onchange=()=>{e.inputQty=Math.max(1,Number(m.value)||1),p()});let h=document.getElementById(`inp-nlp-seller`);h&&(h.oninput=()=>{e.naturalSellerInput=h.value});let g=document.getElementById(`btn-nlp-quote`);g&&(g.onclick=()=>o());let _=document.getElementById(`btn-run-agent-stream`);_&&(_.onclick=()=>a());let v=document.getElementById(`btn-quick-market-sell`);v&&e.orderBook&&(v.onclick=()=>{e.rightTab=`SELL`,e.orderType=`MARKET`,e.inputPrice=e.orderBook.bids[0]?.price??e.orderBook.ticker.currentPrice,e.confirmModalOpen=!0,p()});let y=document.getElementById(`btn-quick-market-buy`);y&&e.orderBook&&(y.onclick=()=>{e.rightTab=`BUY`,e.orderType=`MARKET`;let t=e.orderBook.asks;e.inputPrice=t.length>0?Math.min(...t.map(e=>e.price)):e.orderBook.ticker.currentPrice,e.confirmModalOpen=!0,p()});let b=document.getElementById(`btn-open-confirm`);b&&e.orderBook&&(b.onclick=()=>{if(e.orderType===`MARKET`){let t=e.orderBook.asks,n=e.orderBook.bids;e.inputPrice=e.rightTab===`BUY`?t.length>0?Math.min(...t.map(e=>e.price)):e.orderBook.ticker.currentPrice:n.length>0?Math.max(...n.map(e=>e.price)):e.orderBook.ticker.currentPrice}e.confirmModalOpen=!0,p()});let x=document.getElementById(`btn-modal-cancel`);x&&(x.onclick=()=>{e.confirmModalOpen=!1,p()});let S=document.getElementById(`btn-modal-confirm`);S&&(S.onclick=()=>s());let C=document.getElementById(`inp-rec-name`);C&&(C.oninput=()=>{e.recipientName=C.value});let w=document.getElementById(`inp-rec-phone`);w&&(w.oninput=()=>{e.recipientPhone=w.value});let T=document.getElementById(`inp-rec-addr`);T&&(T.oninput=()=>{e.shippingAddress=T.value}),document.querySelectorAll(`[data-ship-id]`).forEach(e=>{e.onclick=()=>{let t=e.getAttribute(`data-ship-id`);t&&c(t)}})}r();