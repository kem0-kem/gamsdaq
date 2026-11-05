(function(){let e=document.createElement(`link`).relList;if(e&&e.supports&&e.supports(`modulepreload`))return;for(let e of document.querySelectorAll(`link[rel="modulepreload"]`))n(e);new MutationObserver(e=>{for(let t of e)if(t.type===`childList`)for(let e of t.addedNodes)e.tagName===`LINK`&&e.rel===`modulepreload`&&n(e)}).observe(document,{childList:!0,subtree:!0});function t(e){let t={};return e.integrity&&(t.integrity=e.integrity),e.referrerPolicy&&(t.referrerPolicy=e.referrerPolicy),t.credentials=e.crossOrigin===`use-credentials`?`include`:e.crossOrigin===`anonymous`?`omit`:`same-origin`,t}function n(e){if(e.ep)return;e.ep=!0;let n=t(e);fetch(e.href,n)}})();var e={tickers:[],selectedTickerCode:`JJ-GYUL-12B-3KG`,orderBook:null,walletAndCart:null,leftView:`ORDERBOOK`,rightTab:`SELL`,orderType:`LIMIT`,inputPrice:12400,inputQty:10,naturalSellerInput:`오늘 수확한 12브릭스 노지 감귤 3kg 20박스 상생 최적가로 내놓을게요`,lastBannerMessage:`GitHub Copilot SDK 및 Microsoft.Agents.AI 5-에이전트 최저가 검증 엔진이 활성화되었습니다.`,naturalQuoteSummary:`자연어 한 줄을 입력하고 [AI 호가산출]을 누르면 5단계 멀티 에이전트가 상생 최적 호가와 수량을 자동으로 채웁니다.`,naturalQuoteExecutionMode:null,agentSteps:[],isStreamingAgents:!1,isBusyNaturalQuote:!1,isBusyOrder:!1,isBusyReset:!1,isBusyRefresh:!1,busyShipContractId:null,networkError:null,activeAbortController:null,confirmModalOpen:!1,seniorLargeFont:!1,recipientName:`김청도`,recipientPhone:`010-2026-0419`,shippingAddress:`경상북도 청도군 화양읍 청화로 70 (청도혁신센터)`,shippingDrafts:{},copilotSessionMode:`CONNECTED_COPILOT_SDK_LIVE`,toolExecutionMode:`COPILOT_SDK_NATIVE_AIFUNCTION`};function t(e){return e?e.replace(/&/g,`&amp;`).replace(/</g,`&lt;`).replace(/>/g,`&gt;`).replace(/"/g,`&quot;`).replace(/'/g,`&#39;`):``}function n(e){return`${e.toLocaleString(`ko-KR`)}원`}function r(e){return`${e>0?`+`:``}${e.toFixed(2)}%`}function i(t){return e.shippingDrafts[t]||(e.shippingDrafts[t]={receiver:e.recipientName,phone:e.recipientPhone,address:e.shippingAddress}),e.shippingDrafts[t]}async function a(t){try{let n=await fetch(`/api/health`,{signal:t});if(n.ok){let t=await n.json();e.copilotSessionMode=t.copilotSessionMode??e.copilotSessionMode,e.toolExecutionMode=t.toolExecutionMode??e.toolExecutionMode}}catch{}}function o(t,n,r){e.networkError={message:t,retryLabel:n,retryAction:r},e.lastBannerMessage=`[네트워크 오류] ${t}`,y()}function s(){e.activeAbortController&&=(e.activeAbortController.abort(),null),e.isStreamingAgents=!1,e.isBusyNaturalQuote=!1,e.lastBannerMessage=`[검증 취소 완료] 진행 중인 AI 에이전트 요청이 사용자에 의해 안전하게 중단되었습니다.`,y()}async function c(t=e.selectedTickerCode,n=!1){if(!e.isBusyRefresh){e.isBusyRefresh=!0,e.selectedTickerCode=t;try{let[r,i,o]=await Promise.all([fetch(`/api/tickers`),fetch(`/api/wallet-and-cart`),fetch(`/api/tickers/${encodeURIComponent(t)}/orderbook`)]);if(!r.ok||!i.ok||!o.ok)throw Error(`시장 데이터 조회 실패 (HTTP ${o.status})`);e.tickers=await r.json(),e.walletAndCart=await i.json();let s=await o.json();e.orderBook=s,n&&(e.inputPrice=s.ticker.currentPrice),await a(),e.networkError=null}catch(e){o(e instanceof Error?e.message:`시장 데이터 동기화 중 네트워크 오류가 발생했습니다.`,`시장 데이터 다시 불러오기`,()=>{c(t,n)})}finally{e.isBusyRefresh=!1,y()}}}async function l(){await c(e.selectedTickerCode,!0)}async function u(){if(e.isStreamingAgents||e.isBusyNaturalQuote)return;let t=new AbortController;e.activeAbortController=t,e.isStreamingAgents=!0,e.agentSteps=[],e.networkError=null,y();try{let n=await fetch(`/api/agents/verify-stream`,{method:`POST`,headers:{"Content-Type":`application/json`},body:JSON.stringify({query:e.naturalSellerInput,role:e.rightTab===`BUY`?`BUYER`:`SELLER`,tickerCode:e.selectedTickerCode}),signal:t.signal});if(!n.ok)throw Error(`AI 5-에이전트 검증 스트림 연결 실패 (HTTP ${n.status})`);let r=n.body?.getReader(),i=new TextDecoder;if(r){let t=``;for(;;){let{done:n,value:a}=await r.read();if(n)break;t+=i.decode(a,{stream:!0});let o=t.split(`

`);t=o.pop()||``;for(let t of o){let n=t.trim();if(n.startsWith(`data:`)){let t=JSON.parse(n.replace(/^data:\s*/,``));t.executionMode&&(e.toolExecutionMode=t.executionMode),e.agentSteps.push(t),y()}}}}await a(),e.lastBannerMessage=`[5-에이전트 검증 완료] GitHub.Copilot.SDK (${e.copilotSessionMode}) + Microsoft.Agents.AI (${e.toolExecutionMode}) 감사가 완료되었습니다.`}catch(e){if(e instanceof DOMException&&e.name===`AbortError`)return;o(e instanceof Error?e.message:`AI 에이전트 스트리밍 검증 중 오류가 발생했습니다.`,`5-에이전트 검증 다시 시도`,()=>{u()})}finally{e.activeAbortController===t&&(e.activeAbortController=null),e.isStreamingAgents=!1,y()}}async function d(){if(e.isBusyNaturalQuote||e.isStreamingAgents)return;let t=new AbortController;e.activeAbortController=t,e.isBusyNaturalQuote=!0,e.networkError=null,y();try{let r=await fetch(`/api/farmers/natural-quote`,{method:`POST`,headers:{"Content-Type":`application/json`},body:JSON.stringify({naturalText:e.naturalSellerInput}),signal:t.signal});if(!r.ok)throw Error(`자연어 호가 산출 요청 실패 (HTTP ${r.status})`);let i=await r.json();if(await a(t.signal),i.copilotSessionMode&&(e.copilotSessionMode=i.copilotSessionMode),i.executionMode&&(e.toolExecutionMode=i.executionMode),e.naturalQuoteExecutionMode=i.executionMode??e.toolExecutionMode,!i.isSafeInput){e.naturalQuoteSummary=`[가드레일 차단] ${i.safetyWarning??`프롬프트 보안 정책에 의해 차단되었습니다.`}`,e.lastBannerMessage=e.naturalQuoteSummary,y();return}i.matchedTickerCode!==e.selectedTickerCode&&await c(i.matchedTickerCode,!1),e.inputPrice=i.recommendedAskPrice,e.inputQty=i.extractedQuantity,e.orderType=`LIMIT`,e.naturalQuoteSummary=`${i.reasoningSummary} (박스당 농가 추가수익 +${n(i.expectedExtraGainPerBox)}, 총 +${n(i.expectedTotalExtraGain)})`,e.lastBannerMessage=`[Copilot SDK 자연어 호가 산출] ${i.reasoningSummary}`}catch(e){if(e instanceof DOMException&&e.name===`AbortError`)return;o(e instanceof Error?e.message:`자연어 호가 산출 중 네트워크 오류가 발생했습니다.`,`AI 호가산출 다시 시도`,()=>{d()})}finally{e.activeAbortController===t&&(e.activeAbortController=null),e.isBusyNaturalQuote=!1,y()}}async function f(){if(!e.orderBook||e.isBusyOrder)return;e.isBusyOrder=!0,e.confirmModalOpen=!1,e.networkError=null,y();let t=e.rightTab===`BUY`?`BUY`:`SELL`;try{let n=await fetch(`/api/orders`,{method:`POST`,headers:{"Content-Type":`application/json`},body:JSON.stringify({tickerCode:e.selectedTickerCode,side:t,orderType:e.orderType,price:e.inputPrice,quantity:e.inputQty,confirmedByUser:!0})}),r=await n.json().catch(()=>null);if(!n.ok||!r)throw Error(r?.message??`주문 처리 실패 (HTTP ${n.status})`);e.lastBannerMessage=r.message;let[a,o]=await Promise.all([fetch(`/api/tickers`),fetch(`/api/wallet-and-cart`)]);if(a.ok&&(e.tickers=await a.json()),o.ok&&(e.walletAndCart=await o.json()),r.updatedOrderBook&&(e.orderBook=r.updatedOrderBook),r.success&&r.createdContract){let t=r.createdContract.contractId;i(t),e.rightTab=`CART`}}catch(e){o(e instanceof Error?e.message:`주문 제출 중 네트워크 오류가 발생했습니다.`,`주문 다시 제출`,()=>{f()})}finally{e.isBusyOrder=!1,y()}}async function p(t){if(e.busyShipContractId)return;let n=document.getElementById(`shipReceiver-${t}`),r=document.getElementById(`shipPhone-${t}`),a=document.getElementById(`shipAddress-${t}`),s=i(t),c=(n?n.value:s.receiver).trim(),l=(r?r.value:s.phone).trim(),u=(a?a.value:s.address).trim();e.shippingDrafts[t]={receiver:c,phone:l,address:u},e.busyShipContractId=t,e.networkError=null,y();try{let n=await fetch(`/api/cart/${encodeURIComponent(t)}/ship`,{method:`POST`,headers:{"Content-Type":`application/json`},body:JSON.stringify({recipientName:c,recipientPhone:l,shippingAddress:u})}),r=await n.json().catch(()=>null);if(!n.ok||!r||r.success===!1)throw Error(r?.message??`배송지 등록 실패 (HTTP ${n.status})`);e.lastBannerMessage=r.message,r.walletAndCart&&(e.walletAndCart=r.walletAndCart)}catch(e){o(e instanceof Error?e.message:`배송 요청 중 네트워크 오류가 발생했습니다.`,`배송 요청 다시 시도`,()=>{p(t)})}finally{e.busyShipContractId=null,y()}}async function m(){if(!e.isBusyReset){e.isBusyReset=!0,e.networkError=null,y();try{let t=await fetch(`/api/demo/reset`,{method:`POST`});if(!t.ok)throw Error(`데모 초기화 실패 (HTTP ${t.status})`);let n=await t.json();e.walletAndCart=n.walletAndCart??n,e.shippingDrafts={};let r=await fetch(`/api/tickers`);r.ok&&(e.tickers=await r.json()),await c(e.selectedTickerCode,!0),e.lastBannerMessage=n.message??`[데모 초기화 완료] 초기 호가창·예수금(500,000원)·장바구니 상태가 복원되었습니다.`}catch(e){o(e instanceof Error?e.message:`데모 초기화 중 네트워크 오류가 발생했습니다.`,`데모 초기화 다시 시도`,()=>{m()})}finally{e.isBusyReset=!1,y()}}}function h(e){let t=Math.max(...e.asks.map(e=>e.quantity),...e.bids.map(e=>e.quantity),100);return`
    <div class="ob-scroll-wrap">
      <div class="ob-head">
        <div style="text-align:right">판매대기 잔량(박스)</div>
        <div style="text-align:center">호가 (클릭 시 자동입력)</div>
        <div>구매대기 잔량(박스)</div>
      </div>
      <div class="ob-grid ob-3col-grid" role="region" aria-label="3열 지정가 호가창">
        ${e.asks.map((n,i)=>{let a=Math.min(100,Math.round(n.quantity/t*100)),o=n.changeRatePercent>=0?`up-txt`:`down-txt`,s=n.price===e.ticker.currentPrice?`current`:``;return`
      <div class="ob-cell-ask" role="button" tabindex="0" aria-label="매도 호가 ${n.price}원 잔량 ${n.quantity}박스 선택" data-pick-price="${n.price}">
        <div class="bar-ask" style="width:${a}%"></div>
        <span class="z-txt down-txt">${n.quantity}</span>
      </div>
      <div class="ob-cell-price ${s}" role="button" tabindex="0" aria-label="호가 ${n.price}원 자동입력" data-pick-price="${n.price}">
        <span class="${o}">${n.price.toLocaleString(`ko-KR`)}</span>
        <span class="${o}" style="font-size:11px">${r(n.changeRatePercent)}</span>
      </div>
      ${i===0?`
        <div class="tape-cell" style="grid-row: span ${e.asks.length}">
          <div style="font-weight:800;margin-bottom:6px;border-bottom:1px solid #E5E8EB;padding-bottom:4px">
            체결강도 <span class="${e.ticker.executionStrength>=100?`up-txt`:`down-txt`}">${e.ticker.executionStrength.toFixed(1)}%</span>
          </div>
          <div style="display:flex;justify-content:space-between;color:#4E5968;margin-bottom:4px">
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
          <div style="border-top:1px solid #E5E8EB;margin:6px 0"></div>
          <div class="info-row"><span>도매하한</span><b>${e.ticker.wholesalePrice.toLocaleString(`ko-KR`)}</b></div>
          <div class="info-row"><span>소매최저</span><b>${e.ticker.verifiedRetailLowestPrice.toLocaleString(`ko-KR`)}</b></div>
          <div class="info-row"><span>호가단위</span><b>100원</b></div>
        </div>
      `:``}
      <div class="ob-cell-price ${s}" role="button" tabindex="0" aria-label="호가 ${n.price}원 자동입력" data-pick-price="${n.price}">
        <span class="${o}">${n.price.toLocaleString(`ko-KR`)}</span>
        <span class="${o}" style="font-size:11px">${r(n.changeRatePercent)}</span>
      </div>
      <div class="ob-cell-bid" role="button" tabindex="0" aria-label="매수 호가 ${n.price}원 잔량 ${n.quantity}박스 선택" data-pick-price="${n.price}">
        <div class="bar-bid" style="width:${a}%"></div>
        <span class="z-txt up-txt">${n.quantity}</span>
      </div>
    `}).join(``)}
      </div>
      <div class="ob-footer">
        <div style="text-align:right" class="down-txt">총 판매 잔량 ${e.totalAskQuantity.toLocaleString(`ko-KR`)}박스</div>
        <div style="text-align:center;color:#4E5968">잔량합계</div>
        <div class="up-txt">총 구매 잔량 ${e.totalBidQuantity.toLocaleString(`ko-KR`)}박스</div>
      </div>
    </div>
  `}function g(r){let i=r.ticker,a=i.currentPrice>=i.openPrice,o=a?`#E12343`:`#1B64DA`,s=i.wholesalePrice,c=Math.max(i.verifiedRetailLowestPrice,s+1e3),l=e=>{let t=(e-s)/(c-s);return Math.round(195-Math.max(0,Math.min(1,t))*160)},u=l(i.openPrice),d=l(i.aiOptimalPrice),f=[...r.recentTrades].reverse().map(e=>e.price),p=f.length>=2?[i.openPrice,...f,i.currentPrice]:[i.openPrice,i.aiOptimalPrice,i.currentPrice],m=p.map((e,t)=>`${Math.round(20+t/Math.max(1,p.length-1)*680)},${l(e)}`).join(` `);return`
    <div class="chart-box">
      <div class="chart-meta">
        <span>실시간 체결 추이 및 상생 가격 밴드 (도매가 ${n(i.wholesalePrice)} &lt; 체결가 &lt; 인터넷최저가 ${n(i.verifiedRetailLowestPrice)})</span>
        <span class="${a?`up-txt`:`down-txt`}">현재가 ${n(i.currentPrice)} | AI 최적호가 ${n(i.aiOptimalPrice)}</span>
      </div>
      <div class="svg-wrap">
        <svg viewBox="0 0 720 220" width="100%" height="100%" role="img" aria-label="${t(i.name)} 실시간 체결 가격 및 상생 가격 밴드 차트">
          <line x1="20" y1="35" x2="700" y2="35" stroke="#E5E8EB" stroke-dasharray="4 4" />
          <text x="26" y="28" fill="#4E5968" font-size="11" font-weight="700">인터넷 실질 최저가 상한 (${n(i.verifiedRetailLowestPrice)})</text>

          <line x1="20" y1="${d}" x2="700" y2="${d}" stroke="#1B64DA" stroke-dasharray="2 2" />
          <text x="510" y="${Math.max(18,d-6)}" fill="#1B64DA" font-size="11" font-weight="700">AI 최적호가 (${n(i.aiOptimalPrice)})</text>

          <line x1="20" y1="${u}" x2="700" y2="${u}" stroke="#E5E8EB" />
          <text x="26" y="${Math.max(18,u-6)}" fill="#4E5968" font-size="11" font-weight="700">당일 시가 기준선 (${n(i.openPrice)})</text>

          <line x1="20" y1="195" x2="700" y2="195" stroke="#E5E8EB" stroke-dasharray="4 4" />
          <text x="26" y="188" fill="#4E5968" font-size="11" font-weight="700">산지 도매 기준가 하한 (${n(i.wholesalePrice)})</text>

          <polyline fill="none" stroke="${o}" stroke-width="3" points="${m}" />
        </svg>
      </div>
      <div class="chart-cta-grid">
        <button class="cta-btn cta-sell" id="btn-quick-market-sell" ${e.isBusyOrder?`disabled`:``}>
          ${e.isBusyOrder?`처리 중...`:`현재 시장가(${n(r.bids[0]?.price??i.currentPrice)})로 즉시 판매 등록`}
        </button>
        <button class="cta-btn cta-buy" id="btn-quick-market-buy" ${e.isBusyOrder?`disabled`:``}>
          ${e.isBusyOrder?`처리 중...`:`현재 시장가(${n(r.asks[r.asks.length-1]?.price??i.currentPrice)})로 즉시 매수 주문`}
        </button>
      </div>
    </div>
  `}function _(r){return`
    <div class="verify-box">
      <div class="verify-head">
        <div>
          <div style="font-size:14px;font-weight:800">4-Gate 미끼 상품 필터링 및 인터넷 실질 최저가 감사표</div>
          <div style="font-size:11px;color:#4E5968;margin-top:2px">
            AI 검증 경로: GitHub.Copilot.SDK (CopilotSession) + Microsoft.Agents.AI (5 ChatClientAgents · 10 AIFunction Tools) | 실행모드: ${t(e.toolExecutionMode)}
          </div>
        </div>
        <div class="verify-actions">
          <button class="btn-outline" id="btn-run-agent-stream" ${e.isStreamingAgents||e.isBusyNaturalQuote?`disabled`:``}>
            ${e.isStreamingAgents?`AI 5단계 에이전트 검증 실행 중...`:`5-에이전트 실시간 재검증 실행`}
          </button>
          ${e.isStreamingAgents?`
            <button class="btn-outline" id="btn-cancel-stream" type="button">검증 취소</button>
          `:``}
        </div>
      </div>
      <div class="table-scroll-wrap">
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
                  <div style="font-size:10px;color:#4E5968;font-weight:500">${t(e.sourceUrl)}</div>
                  <div style="font-size:10px;color:#4E5968;font-weight:500">기준시각: ${t(e.collectedAtKst??`2026-11-05 14:00 KST`)}</div>
                </td>
                <td>${t(e.productTitle)} (${e.listedWeightKg}kg | ${t(e.gradeText)})</td>
                <td>${n(e.listedPrice)} + ${n(e.shippingFee)}</td>
                <td style="font-weight:800" class="${e.isPassed?`down-txt`:`up-txt`}">${n(e.effective3KgOr5KgPrice)}</td>
                <td style="font-weight:700" class="${e.isPassed?`down-txt`:`up-txt`}">${t(e.verdictReason)}</td>
              </tr>
            `).join(``)}
          </tbody>
        </table>
      </div>

      <div class="agent-stream-log" aria-live="polite">
        <div style="font-weight:800;margin-bottom:6px">
          Microsoft.Agents.AI + GitHub.Copilot.SDK 에이전트 실행 트레이스 (SSE Stream)
        </div>
        ${e.agentSteps.length===0?`<div style="color:#4E5968">상단 [5-에이전트 실시간 재검증 실행] 버튼을 누르면 5개 에이전트의 도구 호출 및 Maker-Checker 감사 로그가 실시간 스트리밍됩니다.</div>`:e.agentSteps.map(n=>`
            <div class="agent-step">
              <div>
                <b>[${t(n.stepId)} | ${t(n.agentName)}]</b>
                <span style="font-size:11px;color:#1B64DA;font-weight:700;margin-left:6px">도구: ${t(n.toolName??`-`)}</span>
                <div style="margin-top:2px">${t(n.summary)}</div>
              </div>
              <div style="color:#4E5968;white-space:nowrap;text-align:right">
                <div style="font-weight:700">${t(n.status)}</div>
                <div style="font-size:10px">${t(n.executionMode??e.toolExecutionMode)}${n.executionLatencyMs==null?``:` · ${n.executionLatencyMs.toFixed(1)}ms`}</div>
              </div>
            </div>
          `).join(``)}
      </div>
    </div>
  `}function v(r,a){let o=r.ticker,s=r.asks.length>0?Math.min(...r.asks.map(e=>e.price)):o.currentPrice,c=r.bids.length>0?Math.max(...r.bids.map(e=>e.price)):o.currentPrice-100;if(e.rightTab===`CART`){let r=a.cartContracts;return`
      <div class="dock-body">
        <div style="font-size:14px;font-weight:800;margin-bottom:10px">
          체결 계약 장바구니 및 산지 직송 주소지 입력 (${r.length}건)
        </div>
        ${r.map(r=>{let a=t(r.contractId),o=i(r.contractId),s=e.busyShipContractId===r.contractId;return`
            <div class="cart-item">
              <div class="cart-head">
                <span>계약번호 ${a}</span>
                <span class="${r.status===`SHIPPING_STARTED`?`down-txt`:`up-txt`}">
                  ${r.status===`SHIPPING_STARTED`?`산지 출고·배송 시작됨`:`매수계약 체결 완료 (배송대기)`}
                </span>
              </div>
              <div style="font-size:14px;font-weight:800;margin-bottom:4px">${t(r.itemName)} (${r.quantity}박스)</div>
              <div style="font-size:12px;color:#4E5968">
                체결 단가 ${n(r.executedPrice)} | 결제 차감액 <b>${n(r.totalPaidAmount)}</b> | 인터넷 최저가 대비 <b class="up-txt">${n(r.savedVsRetailAmount)} 절약</b>
              </div>
              ${r.status===`SHIPPING_STARTED`?`
                <div style="margin-top:8px;padding:8px;background:#F7F8FA;border:1px solid #E5E8EB;font-size:12px;font-weight:700">
                  수령인: ${t(r.recipientName)} (${t(r.recipientPhone)})<br/>
                  배송지: ${t(r.shippingAddress)}
                </div>
              `:`
                <div class="ship-form">
                  <div class="ship-field">
                    <label class="ship-lbl" for="shipReceiver-${a}">수령인 성함 (${a})</label>
                    <input class="input-rect" id="shipReceiver-${a}" data-draft-field="receiver" data-draft-contract="${a}" value="${t(o.receiver)}" placeholder="수령인 성함" />
                  </div>
                  <div class="ship-field">
                    <label class="ship-lbl" for="shipPhone-${a}">연락처 (${a})</label>
                    <input class="input-rect" id="shipPhone-${a}" data-draft-field="phone" data-draft-contract="${a}" value="${t(o.phone)}" placeholder="연락처" />
                  </div>
                  <div class="ship-field">
                    <label class="ship-lbl" for="shipAddress-${a}">배송지 도로명 주소 (${a})</label>
                    <input class="input-rect" id="shipAddress-${a}" data-draft-field="address" data-draft-contract="${a}" value="${t(o.address)}" placeholder="배송지 도로명 주소" />
                  </div>
                  <button class="cta-btn cta-ship" data-ship-contract="${a}" data-ship-id="${a}" ${e.busyShipContractId===null?``:`disabled`}>
                    ${s?`배송 등록 처리 중...`:`주소 확인 및 산지 직송 배송받기`}
                  </button>
                </div>
              `}
            </div>
          `}).join(``)}
      </div>
    `}let l=e.rightTab===`SELL`,u=e.orderType===`MARKET`?l?c:s:e.inputPrice,d=u*e.inputQty,f=u-o.wholesalePrice,p=o.verifiedRetailLowestPrice-u,m=e.naturalQuoteExecutionMode??e.toolExecutionMode;return`
    <div class="dock-body">
      ${l?`
        <div class="senior-guide-banner">
          [고령 농가 3단계 간편 출하: ① 한 줄 입력 → ② AI 호가 자동 채우기 → ③ 주문 승인]
        </div>
        <div class="nlp-box">
          <label class="nlp-label" for="inp-nlp-seller">농부 자연어 한 줄 출하 (Copilot SDK 에이전트 자동 호가 변환)</label>
          <div class="nlp-row">
            <input class="input-rect" id="inp-nlp-seller" value="${t(e.naturalSellerInput)}" ${e.isBusyNaturalQuote?`disabled`:``} />
            <button class="btn-outline" id="btn-nlp-quote" style="white-space:nowrap" ${e.isBusyNaturalQuote||e.isStreamingAgents?`disabled`:``}>
              ${e.isBusyNaturalQuote?`AI 5단계 에이전트 호가 산출 중...`:`AI 호가산출`}
            </button>
            ${e.isBusyNaturalQuote?`
              <button class="btn-outline" id="btn-cancel-nlp" type="button" style="white-space:nowrap">검증 취소</button>
            `:``}
          </div>
          <div class="natural-quote-result" id="naturalQuoteResult" aria-live="polite">
            <div>${t(e.naturalQuoteSummary)}</div>
            <div style="margin-top:4px;color:#1B64DA">
              AI 검증 경로: GitHub.Copilot.SDK (CopilotSession) + Microsoft.Agents.AI (5 ChatClientAgents · 10 AIFunction Tools) | 실행모드: ${t(m)}
            </div>
          </div>
        </div>
      `:``}

      <div class="form-row">
        <span class="form-lbl">주문 유형</span>
        <div class="type-switch" role="tablist" aria-label="주문 유형 선택">
          <button class="type-btn ${e.orderType===`LIMIT`?`active`:``}" role="tab" aria-selected="${e.orderType===`LIMIT`}" id="btn-type-limit">지정가 호가</button>
          <button class="type-btn ${e.orderType===`MARKET`?`active`:``}" role="tab" aria-selected="${e.orderType===`MARKET`}" id="btn-type-market">시장가 즉시체결</button>
        </div>
      </div>

      <div class="form-row">
        <label class="form-lbl" for="inp-order-price">${l?`판매 희망 호가 (박스당)`:`매수 희망 호가 (박스당)`}</label>
        ${e.orderType===`MARKET`?`<div style="font-size:15px;font-weight:800">${n(u)} (최우선 즉시체결가)</div>`:`
            <div class="stepper">
              <button class="step-btn" id="btn-price-minus" type="button" aria-label="호가 100원 낮추기">-</button>
              <input class="step-val" id="inp-order-price" type="number" step="100" value="${e.inputPrice}" aria-label="주문 호가 입력" />
              <button class="step-btn" id="btn-price-plus" type="button" aria-label="호가 100원 높이기">+</button>
            </div>
          `}
      </div>

      <div class="form-row">
        <label class="form-lbl" for="inp-order-qty">주문 수량 (박스)</label>
        <div class="stepper">
          <button class="step-btn" id="btn-qty-minus" type="button" aria-label="수량 1박스 줄이기">-</button>
          <input class="step-val" id="inp-order-qty" type="number" min="1" max="500" value="${e.inputQty}" aria-label="주문 수량 입력" />
          <button class="step-btn" id="btn-qty-plus" type="button" aria-label="수량 1박스 늘리기">+</button>
        </div>
      </div>

      <div class="summary-card">
        <div class="sum-line">
          <span>종목 규격</span>
          <b>${t(o.name)} (${o.minBrix}Brix+)</b>
        </div>
        <div class="sum-line">
          <span>산지 도매 기준가</span>
          <span>${n(o.wholesalePrice)}</span>
        </div>
        <div class="sum-line">
          <span>검증된 인터넷 실질 최저가</span>
          <span>${n(o.verifiedRetailLowestPrice)}</span>
        </div>
        <div class="sum-line">
          <span>${l?`도매가 대비 농가 추가 수취액`:`인터넷 최저가 대비 소비자 절약액`}</span>
          <b class="${l?`down-txt`:`up-txt`}">
            ${l?`+${n(f*e.inputQty)} (박스당 +${n(f)})`:`-${n(p*e.inputQty)} 절약 (박스당 -${n(p)})`}
          </b>
        </div>
        <div class="sum-line">
          <span>${l?`총 예상 판매 정산금`:`총 매수 결제 금액 (잔고 차감)`}</span>
          <span>${n(d)}</span>
        </div>
      </div>

      <button class="cta-btn ${l?`cta-sell`:`cta-buy`}" id="btn-open-confirm" ${e.isBusyOrder?`disabled`:``}>
        ${e.isBusyOrder?`주문 처리 중...`:l?e.orderType===`MARKET`?`${n(u)} 시장가 즉시 판매 체결하기`:`${n(u)} 판매 호가 등록하기`:e.orderType===`MARKET`?`${n(u)} 시장가 즉시 매수 계약 체결`:`${n(u)} 매수 주문 제출하기`}
      </button>

      <div class="status-banner" aria-live="polite" role="status">
        ${t(e.lastBannerMessage)}
      </div>
    </div>
  `}function y(){let i=document.querySelector(`#app`);if(!i||!e.orderBook||!e.walletAndCart)return;document.body.classList.toggle(`senior-large-font`,e.seniorLargeFont);let a=e.orderBook,o=a.ticker,s=e.walletAndCart,c=o.currentPrice-o.openPrice,l=(o.currentPrice-o.openPrice)/o.openPrice*100,u=c>=0,d=e.orderType===`MARKET`?e.rightTab===`SELL`?a.bids.length>0:a.asks.length>0:e.inputPrice>o.wholesalePrice&&e.inputPrice<o.verifiedRetailLowestPrice&&e.inputPrice%100==0,f=e.inputPrice,p=e.inputPrice*e.inputQty;if(e.orderType===`MARKET`){let t=e.rightTab===`SELL`?a.bids:[...a.asks].reverse(),n=e.inputQty,r=0,i=0;for(let e of t){let t=Math.min(n,e.quantity);if(r+=t*e.price,i+=t,n-=t,n<=0)break}i>0&&(f=Math.round(r/i),p=r)}i.innerHTML=`
    ${e.networkError?`
      <div class="network-error-bar" role="alert" aria-live="assertive">
        <span>오류 복구 안내: ${t(e.networkError.message)}</span>
        <div class="network-error-actions">
          ${e.networkError.retryAction?`<button class="btn-outline" id="btn-retry-network" type="button">다시 시도 (${t(e.networkError.retryLabel)})</button>`:``}
          <button class="btn-outline" id="btn-close-network-error" type="button">닫기</button>
        </div>
      </div>
    `:``}

    <header class="topbar header-bar">
      <div class="brand-wrap">
        <div class="brand-title">감스닥 GAMSDAQ</div>
        <div class="brand-sub">AI 검증 (Copilot SDK + MS Agent Framework) | 연결모드: ${t(e.copilotSessionMode)} | 실행모드: ${t(e.toolExecutionMode)} | 시뮬레이션 데이터셋 (KAMIS·오픈마켓 스냅샷 출처 기반)</div>
      </div>
      <div class="wallet-bar">
        <button class="btn-outline" id="btn-reset-demo" ${e.isBusyReset?`disabled`:``}>
          ${e.isBusyReset?`초기화 처리 중...`:`데모 초기화`}
        </button>
        <button class="btn-outline" id="btn-toggle-senior" aria-pressed="${e.seniorLargeFont}">
          ${e.seniorLargeFont?`기본 글씨 크기`:`고령 농가 큰글씨 모드`}
        </button>
        <div class="wallet-box">구매자 가상 예수금 <b>${n(s.virtualBalance)}</b></div>
        <div class="wallet-box">판매자 누적 정산금 <b class="down-txt">${n(s.sellerPendingSettlement)}</b></div>
        <div class="wallet-box">장바구니 체결계약 <b class="up-txt">${s.cartContracts.length}건</b></div>
      </div>
    </header>

    <main class="layout workspace-grid">
      <section class="panel">
        <div class="ticker-strip" role="tablist" aria-label="농산물 표준 규격 종목 선택">
          ${e.tickers.map(t=>{let i=(t.currentPrice-t.openPrice)/t.openPrice*100,a=i>=0,o=t.code===e.selectedTickerCode;return`
              <button class="ticker-btn ${o?`active`:``}" role="tab" aria-selected="${o}" data-ticker="${t.code}" ${e.isBusyRefresh?`disabled`:``}>
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
            <div style="font-size:12px;color:#4E5968;font-weight:700">${o.code} | ${o.grade} | 당도 ${o.minBrix}Brix 이상 보증</div>
            <div class="q-main-price ${u?`up-txt`:`down-txt`}">${n(o.currentPrice)}</div>
            <div class="q-diff ${u?`up-txt`:`down-txt`}">
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
              <div class="wb-val ${u?`up-txt`:`down-txt`}">${n(o.aiOptimalPrice)}</div>
            </div>
            <div class="wb-cell">
              <div class="wb-lbl">검증된 인터넷 최저가(상한)</div>
              <div class="wb-val">${n(o.verifiedRetailLowestPrice)}</div>
            </div>
          </div>
        </div>

        <div class="view-tabs" role="tablist" aria-label="화면 보기 전환">
          <button class="v-tab ${e.leftView===`ORDERBOOK`?`active`:``}" role="tab" aria-selected="${e.leftView===`ORDERBOOK`}" data-view="ORDERBOOK">호가 (3열 지정가 호가창)</button>
          <button class="v-tab ${e.leftView===`CHART`?`active`:``}" role="tab" aria-selected="${e.leftView===`CHART`}" data-view="CHART">차트 (간편 시장가 주문)</button>
          <button class="v-tab ${e.leftView===`AI_AUDIT`?`active`:``}" role="tab" aria-selected="${e.leftView===`AI_AUDIT`}" data-view="AI_AUDIT">AI 최저가 4-Gate 검증원장</button>
        </div>

        ${e.leftView===`ORDERBOOK`?h(a):e.leftView===`CHART`?g(a):_(a)}
      </section>

      <aside class="right-col">
        <div class="panel">
          <div class="role-tabs" role="tablist" aria-label="거래 역할 및 장바구니 탭">
            <button class="r-tab ${e.rightTab===`SELL`?`active-sell`:``}" role="tab" aria-selected="${e.rightTab===`SELL`}" data-rtab="SELL">판매자 출하·등록</button>
            <button class="r-tab ${e.rightTab===`BUY`?`active-buy`:``}" role="tab" aria-selected="${e.rightTab===`BUY`}" data-rtab="BUY">구매자 매수주문</button>
            <button class="r-tab ${e.rightTab===`CART`?`active-cart`:``}" role="tab" aria-selected="${e.rightTab===`CART`}" data-rtab="CART">장바구니·배송 (${s.cartContracts.length})</button>
          </div>
          ${v(a,s)}
        </div>
      </aside>
    </main>

    ${e.confirmModalOpen?`
      <div class="modal-backdrop" role="dialog" aria-modal="true" aria-labelledby="modalTitle">
        <div class="modal-box">
          <div class="modal-title" id="modalTitle">주문 최종 확인 (Human-in-the-Loop 승인)</div>
          <div style="font-size:13px;line-height:1.6">
            <div>종목: <b>${t(o.name)}</b></div>
            <div>구분: <b>${e.rightTab===`SELL`?`판매자 매도 호가 주문`:`구매자 매수 계약 주문`} (${e.orderType===`MARKET`?`시장가 다단계 즉시체결`:`지정가`})</b></div>
            <div>수량: <b>${e.inputQty}박스</b></div>
            <div>단가: <b>${n(f)}</b> (예상 총액 <b>${n(p)}</b>)</div>
            <div style="margin-top:8px;padding:8px;background:#F7F8FA;border:1px solid #E5E8EB;font-size:12px" class="${d?`down-txt`:`up-txt`}">
              ${d?`상생 가격 불변식 검증 통과: 산지 도매가(${n(o.wholesalePrice)}) < 주문 호가(${n(f)}) < 인터넷 최저가(${n(o.verifiedRetailLowestPrice)})`:`가드레일 경고: 주문 호가(${n(f)})가 상생 가격 밴드(${n(o.wholesalePrice)} < P < ${n(o.verifiedRetailLowestPrice)}) 또는 100원 호가 단위를 벗어났습니다.`}
            </div>
          </div>
          <div class="modal-actions">
            <button class="btn-outline" id="btn-modal-cancel" type="button" ${e.isBusyOrder?`disabled`:``}>취소 (Esc)</button>
            <button class="cta-btn ${e.rightTab===`SELL`?`cta-sell`:`cta-buy`}" id="btn-modal-confirm" type="button" ${e.isBusyOrder?`disabled`:``}>
              ${e.isBusyOrder?`주문 실행 중...`:`최종 승인 및 주문 실행`}
            </button>
          </div>
        </div>
      </div>
    `:``}
  `,b()}function b(){let t=document.getElementById(`btn-retry-network`);if(t&&e.networkError?.retryAction){let n=e.networkError.retryAction;t.onclick=()=>{e.networkError=null,n()}}let n=document.getElementById(`btn-close-network-error`);n&&(n.onclick=()=>{e.networkError=null,y()});let r=document.getElementById(`btn-reset-demo`);r&&(r.onclick=()=>{m()});let a=document.getElementById(`btn-toggle-senior`);a&&(a.onclick=()=>{e.seniorLargeFont=!e.seniorLargeFont,y()}),document.querySelectorAll(`[data-ticker]`).forEach(e=>{e.onclick=()=>{let t=e.getAttribute(`data-ticker`);t&&c(t,!0)}}),document.querySelectorAll(`[data-view]`).forEach(t=>{t.onclick=()=>{e.leftView=t.getAttribute(`data-view`),y()}}),document.querySelectorAll(`[data-rtab]`).forEach(t=>{t.onclick=()=>{e.rightTab=t.getAttribute(`data-rtab`),y()}}),document.querySelectorAll(`[data-pick-price]`).forEach(t=>{let n=()=>{let n=Number(t.getAttribute(`data-pick-price`));n>0&&(e.inputPrice=n,e.orderType=`LIMIT`,e.rightTab===`CART`&&(e.rightTab=`BUY`),y())};t.onclick=n,t.onkeydown=e=>{(e.key===`Enter`||e.key===` `)&&(e.preventDefault(),n())}});let o=document.getElementById(`btn-type-limit`);o&&(o.onclick=()=>{e.orderType=`LIMIT`,y()});let l=document.getElementById(`btn-type-market`);l&&(l.onclick=()=>{e.orderType=`MARKET`,y()});let h=document.getElementById(`btn-price-minus`);h&&(h.onclick=()=>{e.inputPrice=Math.max(1e3,e.inputPrice-100),y()});let g=document.getElementById(`btn-price-plus`);g&&(g.onclick=()=>{e.inputPrice+=100,y()});let _=document.getElementById(`inp-order-price`);_&&(_.onchange=()=>{e.inputPrice=Number(_.value)||e.inputPrice,y()});let v=document.getElementById(`btn-qty-minus`);v&&(v.onclick=()=>{e.inputQty=Math.max(1,e.inputQty-1),y()});let b=document.getElementById(`btn-qty-plus`);b&&(b.onclick=()=>{e.inputQty=Math.min(500,e.inputQty+1),y()});let x=document.getElementById(`inp-order-qty`);x&&(x.onchange=()=>{e.inputQty=Math.max(1,Number(x.value)||1),y()});let S=document.getElementById(`inp-nlp-seller`);S&&(S.oninput=()=>{e.naturalSellerInput=S.value});let C=document.getElementById(`btn-nlp-quote`);C&&(C.onclick=()=>{d()});let w=document.getElementById(`btn-cancel-nlp`);w&&(w.onclick=()=>s());let T=document.getElementById(`btn-run-agent-stream`);T&&(T.onclick=()=>{u()});let E=document.getElementById(`btn-cancel-stream`);E&&(E.onclick=()=>s());let D=document.getElementById(`btn-quick-market-sell`);D&&e.orderBook&&(D.onclick=()=>{e.rightTab=`SELL`,e.orderType=`MARKET`,e.inputPrice=e.orderBook.bids[0]?.price??e.orderBook.ticker.currentPrice,e.confirmModalOpen=!0,y()});let O=document.getElementById(`btn-quick-market-buy`);O&&e.orderBook&&(O.onclick=()=>{e.rightTab=`BUY`,e.orderType=`MARKET`;let t=e.orderBook.asks;e.inputPrice=t.length>0?Math.min(...t.map(e=>e.price)):e.orderBook.ticker.currentPrice,e.confirmModalOpen=!0,y()});let k=document.getElementById(`btn-open-confirm`);k&&e.orderBook&&(k.onclick=()=>{if(e.orderType===`MARKET`){let t=e.orderBook.asks,n=e.orderBook.bids;e.inputPrice=e.rightTab===`BUY`?t.length>0?Math.min(...t.map(e=>e.price)):e.orderBook.ticker.currentPrice:n.length>0?Math.max(...n.map(e=>e.price)):e.orderBook.ticker.currentPrice}e.confirmModalOpen=!0,y()});let A=document.getElementById(`btn-modal-cancel`);A&&(A.onclick=()=>{e.confirmModalOpen=!1,y()});let j=document.getElementById(`btn-modal-confirm`);j&&(j.onclick=()=>{f()}),document.querySelectorAll(`[data-draft-contract]`).forEach(e=>{e.oninput=()=>{let t=e.getAttribute(`data-draft-contract`),n=e.getAttribute(`data-draft-field`);if(t&&n){let r=i(t);r[n]=e.value}}}),document.querySelectorAll(`[data-ship-contract]`).forEach(e=>{e.onclick=()=>{let t=e.getAttribute(`data-ship-contract`);t&&p(t)}})}window.addEventListener(`keydown`,t=>{t.key===`Escape`&&(e.confirmModalOpen?(e.confirmModalOpen=!1,y()):(e.isStreamingAgents||e.isBusyNaturalQuote)&&s())}),l();