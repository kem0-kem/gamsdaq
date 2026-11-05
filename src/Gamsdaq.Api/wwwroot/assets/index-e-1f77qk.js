(function(){let e=document.createElement(`link`).relList;if(e&&e.supports&&e.supports(`modulepreload`))return;for(let e of document.querySelectorAll(`link[rel="modulepreload"]`))n(e);new MutationObserver(e=>{for(let t of e)if(t.type===`childList`)for(let e of t.addedNodes)e.tagName===`LINK`&&e.rel===`modulepreload`&&n(e)}).observe(document,{childList:!0,subtree:!0});function t(e){let t={};return e.integrity&&(t.integrity=e.integrity),e.referrerPolicy&&(t.referrerPolicy=e.referrerPolicy),t.credentials=e.crossOrigin===`use-credentials`?`include`:e.crossOrigin===`anonymous`?`omit`:`same-origin`,t}function n(e){if(e.ep)return;e.ep=!0;let n=t(e);fetch(e.href,n)}})();var e={tickers:[],selectedTickerCode:`JJ-GYUL-12B-3KG`,orderBook:null,walletAndCart:null,leftView:`ORDERBOOK`,rightTab:`SELL`,orderType:`LIMIT`,inputPrice:12400,inputQty:10,naturalSellerInput:`오늘 수확한 12브릭스 노지 감귤 3kg 20박스 상생 최적가로 내놓을게요`,lastBannerMessage:`GitHub Copilot SDK 및 Microsoft.Agents.AI 5-에이전트 최저가 검증 엔진이 활성화되었습니다.`,agentSteps:[],isStreamingAgents:!1,confirmModalOpen:!1,seniorLargeFont:!1,recipientName:`김청도`,recipientPhone:`010-2026-0419`,shippingAddress:`경상북도 청도군 화양읍 청화로 70 (청도혁신센터)`,copilotSessionMode:`KEYLESS_DETERMINISTIC_AIFUNCTION`,toolExecutionMode:`DETERMINISTIC_AIFUNCTION`};function t(e){return e?e.replace(/&/g,`&amp;`).replace(/</g,`&lt;`).replace(/>/g,`&gt;`).replace(/"/g,`&quot;`).replace(/'/g,`&#39;`):``}function n(e){return`${e.toLocaleString(`ko-KR`)}원`}function r(e){return`${e>0?`+`:``}${e.toFixed(2)}%`}async function i(){let[t,n,r]=await Promise.all([fetch(`/api/tickers`),fetch(`/api/wallet-and-cart`),fetch(`/api/health`)]);if(e.tickers=await t.json(),e.walletAndCart=await n.json(),r.ok){let t=await r.json();e.copilotSessionMode=t.copilotSessionMode??e.copilotSessionMode,e.toolExecutionMode=t.toolExecutionMode??e.toolExecutionMode}await a(e.selectedTickerCode,!0)}async function a(t,n=!1){e.selectedTickerCode=t;let r=await(await fetch(`/api/tickers/${t}/orderbook`)).json();e.orderBook=r,n&&(e.inputPrice=r.ticker.currentPrice),m()}async function o(){if(!e.isStreamingAgents){e.isStreamingAgents=!0,e.agentSteps=[],m();try{let t=(await fetch(`/api/agents/verify-stream`,{method:`POST`,headers:{"Content-Type":`application/json`},body:JSON.stringify({query:e.naturalSellerInput,role:e.rightTab===`BUY`?`BUYER`:`SELLER`,tickerCode:e.selectedTickerCode})})).body?.getReader(),n=new TextDecoder;if(t){let r=``;for(;;){let{done:i,value:a}=await t.read();if(i)break;r+=n.decode(a,{stream:!0});let o=r.split(`

`);r=o.pop()||``;for(let t of o){let n=t.trim();if(n.startsWith(`data:`)){let t=JSON.parse(n.replace(/^data:\s*/,``));e.agentSteps.push(t),m()}}}}}finally{e.isStreamingAgents=!1,m()}}}async function s(){let t=await(await fetch(`/api/farmers/natural-quote`,{method:`POST`,headers:{"Content-Type":`application/json`},body:JSON.stringify({naturalText:e.naturalSellerInput})})).json();t.isSafeInput?(t.matchedTickerCode!==e.selectedTickerCode&&await a(t.matchedTickerCode,!1),e.inputPrice=t.recommendedAskPrice,e.inputQty=t.extractedQuantity,e.orderType=`LIMIT`,e.lastBannerMessage=`[Copilot SDK 자연어 호가 산출] ${t.reasoningSummary}`,m()):(e.lastBannerMessage=`[가드레일 차단] ${t.safetyWarning}`,m())}async function c(){if(!e.orderBook)return;e.confirmModalOpen=!1;let t=e.rightTab===`BUY`?`BUY`:`SELL`,n=await(await fetch(`/api/orders`,{method:`POST`,headers:{"Content-Type":`application/json`},body:JSON.stringify({tickerCode:e.selectedTickerCode,side:t,orderType:e.orderType,price:e.inputPrice,quantity:e.inputQty,confirmedByUser:!0})})).json();e.lastBannerMessage=n.message;let[r,i]=await Promise.all([fetch(`/api/tickers`),fetch(`/api/wallet-and-cart`)]);e.tickers=await r.json(),e.walletAndCart=await i.json(),n.updatedOrderBook&&(e.orderBook=n.updatedOrderBook),n.success&&n.createdContract&&(e.rightTab=`CART`),m()}async function l(t){let n=await(await fetch(`/api/cart/${t}/ship`,{method:`POST`,headers:{"Content-Type":`application/json`},body:JSON.stringify({recipientName:e.recipientName,recipientPhone:e.recipientPhone,shippingAddress:e.shippingAddress})})).json();e.lastBannerMessage=n.message,n.walletAndCart&&(e.walletAndCart=n.walletAndCart),m()}function u(e){let t=Math.max(...e.asks.map(e=>e.quantity),...e.bids.map(e=>e.quantity),100);return`
    <div class="ob-head">
      <div style="text-align:right">판매대기 잔량(박스)</div>
      <div style="text-align:center">호가 (클릭 시 자동입력)</div>
      <div>구매대기 잔량(박스)</div>
    </div>
    <div class="ob-grid">
      ${e.asks.map((n,i)=>{let a=Math.min(100,Math.round(n.quantity/t*100)),o=n.changeRatePercent>=0?`up-txt`:`down-txt`,s=n.price===e.ticker.currentPrice?`current`:``;return`
      <div class="ob-cell-ask" data-pick-price="${n.price}">
        <div class="bar-ask" style="width:${a}%"></div>
        <span class="z-txt down-txt">${n.quantity}</span>
      </div>
      <div class="ob-cell-price ${s}" data-pick-price="${n.price}">
        <span class="${o}">${n.price.toLocaleString(`ko-KR`)}</span>
        <span class="${o}" style="font-size:11px">${r(n.changeRatePercent)}</span>
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
      ${e.bids.map((n,i)=>{let a=Math.min(100,Math.round(n.quantity/t*100)),o=n.changeRatePercent>=0?`up-txt`:`down-txt`,s=n.price===e.ticker.currentPrice?`current`:``;return`
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
      <div class="ob-cell-price ${s}" data-pick-price="${n.price}">
        <span class="${o}">${n.price.toLocaleString(`ko-KR`)}</span>
        <span class="${o}" style="font-size:11px">${r(n.changeRatePercent)}</span>
      </div>
      <div class="ob-cell-bid" data-pick-price="${n.price}">
        <div class="bar-bid" style="width:${a}%"></div>
        <span class="z-txt up-txt">${n.quantity}</span>
      </div>
    `}).join(``)}
    </div>
    <div class="ob-footer">
      <div style="text-align:right" class="down-txt">총 판매 잔량 ${e.totalAskQuantity.toLocaleString(`ko-KR`)}박스</div>
      <div style="text-align:center;color:#666666">잔량합계</div>
      <div class="up-txt">총 구매 잔량 ${e.totalBidQuantity.toLocaleString(`ko-KR`)}박스</div>
    </div>
  `}function d(e){let t=e.ticker,r=t.currentPrice>=t.openPrice,i=r?`#E12343`:`#1B64DA`,a=t.wholesalePrice,o=Math.max(t.verifiedRetailLowestPrice,a+1e3),s=e=>{let t=(e-a)/(o-a);return Math.round(195-Math.max(0,Math.min(1,t))*160)},c=s(t.openPrice),l=s(t.aiOptimalPrice),u=[...e.recentTrades].reverse().map(e=>e.price),d=u.length>=2?[t.openPrice,...u,t.currentPrice]:[t.openPrice,t.aiOptimalPrice,t.currentPrice],f=d.map((e,t)=>`${Math.round(20+t/Math.max(1,d.length-1)*680)},${s(e)}`).join(` `);return`
    <div class="chart-box">
      <div class="chart-meta">
        <span>실시간 체결 추이 및 상생 가격 밴드 (도매가 ${n(t.wholesalePrice)} &lt; 체결가 &lt; 인터넷최저가 ${n(t.verifiedRetailLowestPrice)})</span>
        <span class="${r?`up-txt`:`down-txt`}">현재가 ${n(t.currentPrice)} | AI 최적호가 ${n(t.aiOptimalPrice)}</span>
      </div>
      <div class="svg-wrap">
        <svg viewBox="0 0 720 220" width="100%" height="100%">
          <line x1="20" y1="35" x2="700" y2="35" stroke="#DCDFE4" stroke-dasharray="4 4" />
          <text x="26" y="28" fill="#666666" font-size="11" font-weight="700">인터넷 실질 최저가 상한 (${n(t.verifiedRetailLowestPrice)})</text>

          <line x1="20" y1="${l}" x2="700" y2="${l}" stroke="#1B64DA" stroke-dasharray="2 2" />
          <text x="510" y="${Math.max(18,l-6)}" fill="#1B64DA" font-size="11" font-weight="700">AI 최적호가 (${n(t.aiOptimalPrice)})</text>

          <line x1="20" y1="${c}" x2="700" y2="${c}" stroke="#DCDFE4" />
          <text x="26" y="${Math.max(18,c-6)}" fill="#666666" font-size="11" font-weight="700">당일 시가 기준선 (${n(t.openPrice)})</text>

          <line x1="20" y1="195" x2="700" y2="195" stroke="#DCDFE4" stroke-dasharray="4 4" />
          <text x="26" y="188" fill="#666666" font-size="11" font-weight="700">산지 도매 기준가 하한 (${n(t.wholesalePrice)})</text>

          <polyline fill="none" stroke="${i}" stroke-width="3" points="${f}" />
        </svg>
      </div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-top:14px">
        <button class="cta-btn cta-sell" id="btn-quick-market-sell">
          현재 시장가(${n(e.bids[0]?.price??t.currentPrice)})로 즉시 판매 등록
        </button>
        <button class="cta-btn cta-buy" id="btn-quick-market-buy">
          현재 시장가(${n(e.asks[e.asks.length-1]?.price??t.currentPrice)})로 즉시 매수 주문
        </button>
      </div>
    </div>
  `}function f(r){return`
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
            <th>판매처 (출처)</th>
            <th>상품명 / 규격</th>
            <th>표기가 + 배송비</th>
            <th>동일중량 환산가</th>
            <th>4-Gate 판정 사유</th>
          </tr>
        </thead>
        <tbody>
          ${r.verifiedCandidates.map(e=>`
            <tr>
              <td style="font-weight:700">
                <div>${t(e.mallName)}</div>
                <div style="font-size:10px;color:#666666;font-weight:500">${t(e.sourceUrl)}</div>
                <div style="font-size:10px;color:#666666;font-weight:500">기준시각: ${t(e.collectedAtKst??`2026-11-05 14:00 KST`)}</div>
              </td>
              <td>${t(e.productTitle)} (${e.listedWeightKg}kg | ${t(e.gradeText)})</td>
              <td>${n(e.listedPrice)} + ${n(e.shippingFee)}</td>
              <td style="font-weight:800" class="${e.isPassed?`down-txt`:`up-txt`}">${n(e.effective3KgOr5KgPrice)}</td>
              <td style="font-weight:700" class="${e.isPassed?`down-txt`:`up-txt`}">${t(e.verdictReason)}</td>
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
              <div>
                <b>[${t(e.stepId)} | ${t(e.agentName)}]</b>
                <span style="font-size:11px;color:#1B64DA;font-weight:700;margin-left:6px">도구: ${t(e.toolName??`-`)}</span>
                <div style="margin-top:2px">${t(e.summary)}</div>
              </div>
              <div style="color:#666666;white-space:nowrap;text-align:right">
                <div style="font-weight:700">${t(e.status)}</div>
                <div style="font-size:10px">${t(e.executionMode??`DETERMINISTIC_AIFUNCTION`)}${e.executionLatencyMs==null?``:` · ${e.executionLatencyMs.toFixed(1)}ms`}</div>
              </div>
            </div>
          `).join(``)}
      </div>
    </div>
  `}function p(r,i){let a=r.ticker,o=r.asks.length>0?Math.min(...r.asks.map(e=>e.price)):a.currentPrice,s=r.bids.length>0?Math.max(...r.bids.map(e=>e.price)):a.currentPrice-100;if(e.rightTab===`CART`)return`
      <div class="dock-body">
        <div style="font-size:14px;font-weight:800;margin-bottom:10px">
          체결 계약 장바구니 및 산지 직송 주소지 입력 (${i.cartContracts.length}건)
        </div>
        ${i.cartContracts.map(r=>`
          <div class="cart-item">
            <div class="cart-head">
              <span>계약번호 ${r.contractId}</span>
              <span class="${r.status===`SHIPPING_STARTED`?`down-txt`:`up-txt`}">
                ${r.status===`SHIPPING_STARTED`?`산지 출고·배송 시작됨`:`매수계약 체결 완료 (배송대기)`}
              </span>
            </div>
            <div style="font-size:14px;font-weight:800;margin-bottom:4px">${r.itemName} (${r.quantity}박스)</div>
            <div style="font-size:12px;color:#666666">
              체결 단가 ${n(r.executedPrice)} | 결제 차감액 <b>${n(r.totalPaidAmount)}</b> | 인터넷 최저가 대비 <b class="up-txt">${n(r.savedVsRetailAmount)} 절약</b>
            </div>
            ${r.status===`SHIPPING_STARTED`?`
              <div style="margin-top:8px;padding:8px;background:#F5F6F8;border:1px solid #DCDFE4;font-size:12px;font-weight:700">
                수령인: ${t(r.recipientName)} (${t(r.recipientPhone)})<br/>
                배송지: ${t(r.shippingAddress)}
              </div>
            `:`
              <div class="ship-form">
                <input class="input-rect" id="inp-rec-name" value="${t(e.recipientName)}" placeholder="수령인 성함" />
                <input class="input-rect" id="inp-rec-phone" value="${t(e.recipientPhone)}" placeholder="연락처" />
                <input class="input-rect" id="inp-rec-addr" value="${t(e.shippingAddress)}" placeholder="배송지 도로명 주소" />
                <button class="cta-btn cta-ship" data-ship-id="${t(r.contractId)}">
                  주소 확인 및 산지 직송 배송받기
                </button>
              </div>
            `}
          </div>
        `).join(``)}
      </div>
    `;let c=e.rightTab===`SELL`,l=e.orderType===`MARKET`?c?s:o:e.inputPrice,u=l*e.inputQty,d=l-a.wholesalePrice,f=a.verifiedRetailLowestPrice-l;return`
    <div class="dock-body">
      ${c?`
        <div class="nlp-box">
          <div class="nlp-label">농부 자연어 한 줄 출하 (Copilot SDK 에이전트 자동 호가 변환)</div>
          <div class="nlp-row">
            <input class="input-rect" id="inp-nlp-seller" value="${t(e.naturalSellerInput)}" />
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
        <span class="form-lbl">${c?`판매 희망 호가 (박스당)`:`매수 희망 호가 (박스당)`}</span>
        ${e.orderType===`MARKET`?`<div style="font-size:15px;font-weight:800">${n(l)} (최우선 즉시체결가)</div>`:`
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
          <b>${a.name} (${a.minBrix}Brix+)</b>
        </div>
        <div class="sum-line">
          <span>산지 도매 기준가</span>
          <span>${n(a.wholesalePrice)}</span>
        </div>
        <div class="sum-line">
          <span>검증된 인터넷 실질 최저가</span>
          <span>${n(a.verifiedRetailLowestPrice)}</span>
        </div>
        <div class="sum-line">
          <span>${c?`도매가 대비 농가 추가 수취액`:`인터넷 최저가 대비 소비자 절약액`}</span>
          <b class="${c?`down-txt`:`up-txt`}">
            ${c?`+${n(d*e.inputQty)} (박스당 +${n(d)})`:`-${n(f*e.inputQty)} 절약 (박스당 -${n(f)})`}
          </b>
        </div>
        <div class="sum-line">
          <span>${c?`총 예상 판매 정산금`:`총 매수 결제 금액 (잔고 차감)`}</span>
          <span>${n(u)}</span>
        </div>
      </div>

      <button class="cta-btn ${c?`cta-sell`:`cta-buy`}" id="btn-open-confirm">
        ${c?e.orderType===`MARKET`?`${n(l)} 시장가 즉시 판매 체결하기`:`${n(l)} 판매 호가 등록하기`:e.orderType===`MARKET`?`${n(l)} 시장가 즉시 매수 계약 체결`:`${n(l)} 매수 주문 제출하기`}
      </button>

      <div class="status-banner">
        ${t(e.lastBannerMessage)}
      </div>
    </div>
  `}function m(){let i=document.querySelector(`#app`);if(!i||!e.orderBook||!e.walletAndCart)return;document.body.classList.toggle(`senior-large-font`,e.seniorLargeFont);let a=e.orderBook,o=a.ticker,s=e.walletAndCart,c=o.currentPrice-o.openPrice,l=(o.currentPrice-o.openPrice)/o.openPrice*100,m=c>=0,g=e.orderType===`MARKET`?e.rightTab===`SELL`?a.bids.length>0:a.asks.length>0:e.inputPrice>o.wholesalePrice&&e.inputPrice<o.verifiedRetailLowestPrice&&e.inputPrice%100==0,_=e.inputPrice,v=e.inputPrice*e.inputQty;if(e.orderType===`MARKET`){let t=e.rightTab===`SELL`?a.bids:[...a.asks].reverse(),n=e.inputQty,r=0,i=0;for(let e of t){let t=Math.min(n,e.quantity);if(r+=t*e.price,i+=t,n-=t,n<=0)break}i>0&&(_=Math.round(r/i),v=r)}i.innerHTML=`
    <header class="topbar">
      <div class="brand-wrap">
        <div class="brand-title">감스닥 GAMSDAQ</div>
        <div class="brand-sub">AI 검증 (Copilot SDK + MS Agent Framework) | 연결모드: ${t(e.copilotSessionMode)} | 시뮬레이션 데이터셋 (KAMIS·오픈마켓 스냅샷 출처 기반)</div>
      </div>
      <div class="wallet-bar">
        <button class="btn-outline" id="btn-reset-demo">데모 초기화</button>
        <button class="btn-outline" id="btn-toggle-senior">${e.seniorLargeFont?`기본 글씨 크기`:`고령 농가 큰글씨 모드`}</button>
        <div class="wallet-box">구매자 가상 예수금 <b>${n(s.virtualBalance)}</b></div>
        <div class="wallet-box">판매자 누적 정산금 <b class="down-txt">${n(s.sellerPendingSettlement)}</b></div>
        <div class="wallet-box">장바구니 체결계약 <b class="up-txt">${s.cartContracts.length}건</b></div>
      </div>
    </header>

    <main class="layout">
      <section class="panel">
        <div class="ticker-strip">
          ${e.tickers.map(t=>{let i=(t.currentPrice-t.openPrice)/t.openPrice*100,a=i>=0;return`
              <button class="ticker-btn ${t.code===e.selectedTickerCode?`active`:``}" data-ticker="${t.code}">
                <div class="t-code">${t.code} | ${t.origin}</div>
                <div class="t-name">${t.name}</div>
                <div class="t-price-row">
                  <span class="t-price ${a?`up-txt`:`down-txt`}">${n(t.currentPrice)}</span>
                  <span class="t-rate ${a?`up-txt`:`down-txt`}">시가대비 ${r(i)}</span>
                </div>
              </button>
            `}).join(``)}
        </div>

        <div class="quote-header">
          <div>
            <div style="font-size:12px;color:#666666;font-weight:700">${o.code} | ${o.grade} | 당도 ${o.minBrix}Brix 이상 보증</div>
            <div class="q-main-price ${m?`up-txt`:`down-txt`}">${n(o.currentPrice)}</div>
            <div class="q-diff ${m?`up-txt`:`down-txt`}">
              당일 시가(${n(o.openPrice)}) 대비 ${c>0?`+`:``}${c.toLocaleString(`ko-KR`)}원 (${r(l)})
            </div>
          </div>

          <div class="winwin-band">
            <div class="wb-cell">
              <div class="wb-lbl">산지 공판장 도매가(하한)</div>
              <div class="wb-val">${n(o.wholesalePrice)}</div>
            </div>
            <div class="wb-cell">
              <div class="wb-lbl">AI 추천 상생 최적호가</div>
              <div class="wb-val ${m?`up-txt`:`down-txt`}">${n(o.aiOptimalPrice)}</div>
            </div>
            <div class="wb-cell">
              <div class="wb-lbl">검증된 인터넷 최저가(상한)</div>
              <div class="wb-val">${n(o.verifiedRetailLowestPrice)}</div>
            </div>
          </div>
        </div>

        <div class="view-tabs">
          <button class="v-tab ${e.leftView===`ORDERBOOK`?`active`:``}" data-view="ORDERBOOK">호가 (3열 지정가 호가창)</button>
          <button class="v-tab ${e.leftView===`CHART`?`active`:``}" data-view="CHART">차트 (간편 시장가 주문)</button>
          <button class="v-tab ${e.leftView===`AI_AUDIT`?`active`:``}" data-view="AI_AUDIT">AI 최저가 4-Gate 검증원장</button>
        </div>

        ${e.leftView===`ORDERBOOK`?u(a):e.leftView===`CHART`?d(a):f(a)}
      </section>

      <aside class="right-col">
        <div class="panel">
          <div class="role-tabs">
            <button class="r-tab ${e.rightTab===`SELL`?`active-sell`:``}" data-rtab="SELL">판매자 출하·등록</button>
            <button class="r-tab ${e.rightTab===`BUY`?`active-buy`:``}" data-rtab="BUY">구매자 매수주문</button>
            <button class="r-tab ${e.rightTab===`CART`?`active-cart`:``}" data-rtab="CART">장바구니·배송 (${s.cartContracts.length})</button>
          </div>
          ${p(a,s)}
        </div>
      </aside>
    </main>

    ${e.confirmModalOpen?`
      <div class="modal-backdrop">
        <div class="modal-box">
          <div class="modal-title">주문 최종 확인 (Human-in-the-Loop 승인)</div>
          <div style="font-size:13px;line-height:1.6">
            <div>종목: <b>${t(o.name)}</b></div>
            <div>구분: <b>${e.rightTab===`SELL`?`판매자 매도 호가 주문`:`구매자 매수 계약 주문`} (${e.orderType===`MARKET`?`시장가 다단계 즉시체결`:`지정가`})</b></div>
            <div>수량: <b>${e.inputQty}박스</b></div>
            <div>단가: <b>${n(_)}</b> (예상 총액 <b>${n(v)}</b>)</div>
            <div style="margin-top:8px;padding:8px;background:#F5F6F8;border:1px solid #DCDFE4;font-size:12px" class="${g?`down-txt`:`up-txt`}">
              ${g?`상생 가격 불변식 검증 통과: 산지 도매가(${n(o.wholesalePrice)}) < 주문 호가(${n(_)}) < 인터넷 최저가(${n(o.verifiedRetailLowestPrice)})`:`가드레일 경고: 주문 호가(${n(_)})가 상생 가격 밴드(${n(o.wholesalePrice)} < P < ${n(o.verifiedRetailLowestPrice)}) 또는 100원 호가 단위를 벗어났습니다.`}
            </div>
          </div>
          <div class="modal-actions">
            <button class="btn-outline" id="btn-modal-cancel">취소</button>
            <button class="cta-btn ${e.rightTab===`SELL`?`cta-sell`:`cta-buy`}" id="btn-modal-confirm">최종 승인 및 주문 실행</button>
          </div>
        </div>
      </div>
    `:``}
  `,h()}function h(){let t=document.getElementById(`btn-reset-demo`);t&&(t.onclick=async()=>{let t=await(await fetch(`/api/demo/reset`,{method:`POST`})).json();e.walletAndCart=t.walletAndCart??t,e.tickers=await(await fetch(`/api/tickers`)).json(),await a(e.selectedTickerCode,!0),e.lastBannerMessage=t.message??`[데모 초기화 완료] 초기 호가창·예수금(500,000원)·장바구니 상태가 복원되었습니다.`,m()});let n=document.getElementById(`btn-toggle-senior`);n&&(n.onclick=()=>{e.seniorLargeFont=!e.seniorLargeFont,m()}),document.querySelectorAll(`[data-ticker]`).forEach(e=>{e.onclick=()=>{let t=e.getAttribute(`data-ticker`);t&&a(t,!0)}}),document.querySelectorAll(`[data-view]`).forEach(t=>{t.onclick=()=>{e.leftView=t.getAttribute(`data-view`),m()}}),document.querySelectorAll(`[data-rtab]`).forEach(t=>{t.onclick=()=>{e.rightTab=t.getAttribute(`data-rtab`),m()}}),document.querySelectorAll(`[data-pick-price]`).forEach(t=>{t.onclick=()=>{let n=Number(t.getAttribute(`data-pick-price`));n>0&&(e.inputPrice=n,e.orderType=`LIMIT`,e.rightTab===`CART`&&(e.rightTab=`BUY`),m())}});let r=document.getElementById(`btn-type-limit`);r&&(r.onclick=()=>{e.orderType=`LIMIT`,m()});let i=document.getElementById(`btn-type-market`);i&&(i.onclick=()=>{e.orderType=`MARKET`,m()});let u=document.getElementById(`btn-price-minus`);u&&(u.onclick=()=>{e.inputPrice=Math.max(1e3,e.inputPrice-100),m()});let d=document.getElementById(`btn-price-plus`);d&&(d.onclick=()=>{e.inputPrice+=100,m()});let f=document.getElementById(`inp-order-price`);f&&(f.onchange=()=>{e.inputPrice=Number(f.value)||e.inputPrice,m()});let p=document.getElementById(`btn-qty-minus`);p&&(p.onclick=()=>{e.inputQty=Math.max(1,e.inputQty-1),m()});let h=document.getElementById(`btn-qty-plus`);h&&(h.onclick=()=>{e.inputQty=Math.min(500,e.inputQty+1),m()});let g=document.getElementById(`inp-order-qty`);g&&(g.onchange=()=>{e.inputQty=Math.max(1,Number(g.value)||1),m()});let _=document.getElementById(`inp-nlp-seller`);_&&(_.oninput=()=>{e.naturalSellerInput=_.value});let v=document.getElementById(`btn-nlp-quote`);v&&(v.onclick=()=>s());let y=document.getElementById(`btn-run-agent-stream`);y&&(y.onclick=()=>o());let b=document.getElementById(`btn-quick-market-sell`);b&&e.orderBook&&(b.onclick=()=>{e.rightTab=`SELL`,e.orderType=`MARKET`,e.inputPrice=e.orderBook.bids[0]?.price??e.orderBook.ticker.currentPrice,e.confirmModalOpen=!0,m()});let x=document.getElementById(`btn-quick-market-buy`);x&&e.orderBook&&(x.onclick=()=>{e.rightTab=`BUY`,e.orderType=`MARKET`;let t=e.orderBook.asks;e.inputPrice=t.length>0?Math.min(...t.map(e=>e.price)):e.orderBook.ticker.currentPrice,e.confirmModalOpen=!0,m()});let S=document.getElementById(`btn-open-confirm`);S&&e.orderBook&&(S.onclick=()=>{if(e.orderType===`MARKET`){let t=e.orderBook.asks,n=e.orderBook.bids;e.inputPrice=e.rightTab===`BUY`?t.length>0?Math.min(...t.map(e=>e.price)):e.orderBook.ticker.currentPrice:n.length>0?Math.max(...n.map(e=>e.price)):e.orderBook.ticker.currentPrice}e.confirmModalOpen=!0,m()});let C=document.getElementById(`btn-modal-cancel`);C&&(C.onclick=()=>{e.confirmModalOpen=!1,m()});let w=document.getElementById(`btn-modal-confirm`);w&&(w.onclick=()=>c());let T=document.getElementById(`inp-rec-name`);T&&(T.oninput=()=>{e.recipientName=T.value});let E=document.getElementById(`inp-rec-phone`);E&&(E.oninput=()=>{e.recipientPhone=E.value});let D=document.getElementById(`inp-rec-addr`);D&&(D.oninput=()=>{e.shippingAddress=D.value}),document.querySelectorAll(`[data-ship-id]`).forEach(e=>{e.onclick=()=>{let t=e.getAttribute(`data-ship-id`);t&&l(t)}})}i();