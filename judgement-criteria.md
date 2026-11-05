# 2026 청도 바이브코딩 해커톤 — 공식 심사 기준 (Judgement Criteria)

본 문서는 해커톤 심사위원 및 자동화 평가 에이전트(AI Judge)가 출품작 **감스닥 (GAMSDAQ)**을 평가할 때 적용하는 7대 공식 평가 기준과 배점, 그리고 감스닥 레포지토리 내 검증 근거 경로를 정의합니다.

---

## 1. 평가 항목 및 배점 요약 (Evaluation Weights)

| 순번 | 평가 코드 | 평가 항목 | 배점 | 핵심 평가 관점 |
|---:|---|---|---:|---|
| **1** | `CRIT-01` | **GitHub Copilot SDK 및 Microsoft Agent Framework 활용** | **25%** | 멀티 에이전트 아키텍처 설계, C# `AIFunction` Tool Calling 위임, 실시간 추론 스트리밍(SSE), 에이전트 간 구조화된 컨텍스트 전달 및 검증 깊이 |
| **2** | `CRIT-02` | **생산성 향상 효과 및 문제 적합성** | **18%** | 청도군 지역 사회문제(`cheongdo-social-issues.md`)와의 직접적 정합성, 농가 수취가 향상 및 소비자 비용 절감의 정량적 입증, 고령 농부 출하 소요 시간 단축 |
| **3** | `CRIT-03` | **Azure 클라우드 통합** | **18%** | 실용적이고 재현 가능한 Azure 클라우드 네이티브 아키텍처(`Azure Container Apps`, `ACR`, `Application Insights`), Bicep IaC 코드화 및 CI/CD 자동화 |
| **4** | `CRIT-04` | **기능적 완성도 (Functional Completeness)** | **16%** | 무인증 즉시 접근성, 엔드투엔드 거래 워크플로(호가 등록 -> 체결 -> 예수금 차감 -> 장바구니 담김 -> 배송 시작) 완결성, 단위/통합 테스트 검증 |
| **5** | `CRIT-05` | **사용자 경험 (UX)** | **12%** | 토스증권 스타일 직관적 호가창 및 차트 전환, 고대비 라이트 모드, 엄격한 3색 제한, 0px 직각 디자인 시스템, 고령 농부 자연어 출하 접근성 |
| **6** | `CRIT-06` | **책임 있는 AI (Responsible AI)** | **6%** | 프롬프트 인젝션 가드레일(`PromptShieldGuardrail`), 상생 가격 밴드($P_{\text{wholesale}} < P < P_{\text{retail}}$) 강제, 출처 투명성, Human-in-the-Loop 주문 승인 |
| **7** | `CRIT-07` | **창의성 및 혁신성 (Creativity & Innovation)** | **5%** | 비정형 농산물의 표준 규격 티커(Ticker) 자산화, 4-Gate 미끼 상품 필터링 수식과 실시간 양방향 금융형 오더북의 결합 |
| **합계** | - | **총점** | **100%** | - |

---

## 2. 세부 평가 기준 및 감스닥 구현 매핑

### 2.1 CRIT-01: GitHub Copilot SDK 및 Microsoft Agent Framework 활용 (25%)
* **요구 사항**:
  * 단순 단일 프롬프트 호출이 아닌 `GitHub.Copilot.SDK`와 `Microsoft.Agents.AI`를 결합한 다단계 에이전트 오케스트레이션을 구현해야 합니다.
  * 가격 계산 및 규칙 판정은 LLM의 암산에 의존하지 않고 결정론적 함수 도구(`AIFunction`)를 호출해야 합니다.
* **검증 경로**:
  * 오케스트레이터: `src/Gamsdaq.Api/Agents/CopilotAgentOrchestrator.cs` (`SpecNormalizerAgent` -> `PriceDiscoveryAgent` -> `BaitFilterVerifierAgent` -> `OptimalQuoteAdvisorAgent` -> `AuditorGuardrailAgent`)
  * 결정론적 도구(10종): `src/Gamsdaq.Api/Tools/GamsdaqTools.cs` (`parse_produce_spec`, `lookup_standard_ticker`, `search_ecommerce_listings`, `fetch_wholesale_benchmark`, `evaluate_bait_rules`, `calculate_effective_price`, `verify_four_gate_lowest_price`, `get_order_book_snapshot`, `compute_win_win_optimal_quote`, `audit_quote_invariants`)
  * 실시간 스트리밍 API: `POST /api/agents/verify-stream` (`text/event-stream`)
  * 실행 모드: 모델이 도구를 선택한 경우에만 `COPILOT_SDK_MODEL_DIRECTED_AIFUNCTION`. 결정론적 선택 + 라이브 요약 성공은 `COPILOT_SDK_SYNTHESIS_WITH_AIFUNCTION`, 라이브 요약 없는 결정론적 실행은 `DETERMINISTIC_AIFUNCTION`.
  * SDK 세션 내부 도구 실행도 스키마를 보존하는 `SessionAIFunction` 래퍼로 신뢰 인자·격리 컨텍스트·SSE 호출 기록을 적용하며 `COPILOT_SDK_NATIVE_AIFUNCTION`으로 표시합니다. `/api/health`는 `LastToolExecutionMode` 및 `supportedExecutionModes`를 반환합니다(실행 전 `NOT_EXECUTED`).

### 2.2 CRIT-02: 생산성 향상 효과 및 문제 적합성 (18%)
* **요구 사항**:
  * 청도군 농업 유통 병목과 고령 농가의 디지털 소외 문제를 실질적으로 해결하고 정량적 지표를 제시해야 합니다.
* **검증 경로**:
  * `CD-BANSI-13B-5KG` (청도 명품 반시 대과 5kg): 도매가 14,000원 대비 농가 수취가 **+35.0% 향상**(18,900원), 인터넷 실질 최저가 24,800원 대비 소비자 **-23.8% 절감**
  * `JJ-GYUL-12B-3KG` (12브릭스 노지 감귤 3kg): 도매가 9,200원 대비 농가 수취가 **+34.8% 향상**(12,400원), 인터넷 실질 최저가 15,800원 대비 소비자 **-21.5% 절감**
  * 고령 농부 자연어 1줄 출하 엔드포인트: `POST /api/farmers/natural-quote`
  * 위 12,400원 / 18,900원은 **초기 시드 체결가 예시**입니다. 초기 OBI 추천가는 감귤 **12,700원**(농가 +38.0%, 소비자 19.6% 절감), 반시 **19,500원**(+39.3%, 21.4% 절감)입니다. 반시 매도 200박스 추가 시(매도 589 / 매수 290) **19,300원**(+37.9%, 22.2% 절감)으로 변합니다.
  * KAMIS 공영도매시장 및 오픈마켓 후보군은 **2026-11-05 고정 시뮬레이션 벤치마크 스냅샷**이며 실시간 API 수집 자료가 아닙니다. 지역 효과는 현장 실증이 아닌 **시뮬레이션 기반 기대 효과**입니다.
  * 전체 인구는 **행정안전부 주민등록인구통계·경상북도 청도군**(41.3%는 2023-08 말 보도 인용값), 농가 인구는 **통계청 2020 농림어업총조사·청도군**, 비용 구조는 **한국농수산식품유통공사(aT) 2023년 농산물 유통실태조사**를 참조합니다. 모집단·품목·경로별 범위를 구분하며 출처 없는 일괄 비용률은 사용하지 않습니다([출처 상세](./cheongdo-social-issues.md#3-통계-출처기준시점-및-검증-범위)).
  * **기존 6단계 수기 입력 대비 3단계 워크플로우 축소 기대치**는 사용자 시간 실측이 아닙니다. **서버 파이프라인 약 5~15ms**는 결정론적 웜 실행의 설계 참고 범위(이번 테스트 실측값·보장값 아님)이며 요청별 실제 서버 시간은 `elapsedMs`입니다. 사용자 입력·검토·승인 시간은 포함하지 않습니다.

### 2.3 CRIT-03: Azure 클라우드 통합 (18%)
* **요구 사항**:
  * 애플리케이션 특성에 부합하는 Azure 리소스를 Infrastructure as Code(Bicep)와 컨테이너 파이프라인으로 구성해야 합니다.
* **검증 경로**:
  * Bicep 템플릿: `infra/main.bicep` (Azure Container Apps 단일 리더 레플리카 `minReplicas: 1, maxReplicas: 1`, Azure Container Registry, User-Assigned Managed Identity, Log Analytics, Application Insights)
  * 컨테이너 및 배포 워크플로: `Dockerfile`, `.github/workflows/deploy-azure.yml`

### 2.4 CRIT-04: 기능적 완성도 (16%)
* **요구 사항**:
  * 별도 로그인이나 외부 API 키 설정 없이 즉시 전체 기능을 체험하고 검증할 수 있어야 합니다.
* **검증 경로**:
  * 호가 매칭 및 장바구니 배송 엔진: `src/Gamsdaq.Api/Matching/MarketEngineService.cs`
  * 자동화 검증 테스트: `tests/Gamsdaq.Tests/GamsdaqEngineTests.cs` (**149개 단위·경계값·동시성 테스트**, `dotnet test Gamsdaq.sln --configuration Release`)

### 2.5 CRIT-05: 사용자 경험 (UX) (12%)
* **요구 사항**:
  * 복잡한 농산물 스펙과 시세 정보를 누구나 직관적으로 이해하고 거래할 수 있는 화면을 제공해야 합니다.
* **검증 경로**:
  * 프론트엔드: `TypeScript + Vite + Zero-Radius CSS Design System (src/gamsdaq-web)`
  * 라이트 모드(`#FFFFFF`), 엄격한 3색 제한(`#E12343`, `#1B64DA`, 무채색), `border-radius: 0px`, 이모지 배제, `Pretendard` 고정폭 숫자(`tabular-nums`)

### 2.6 CRIT-06: 책임 있는 AI (Responsible AI) (6%)
* **요구 사항**:
  * 프롬프트 인젝션 방어, 가격 가드레일, AI 판단 근거 투명 공개, 최종 주문 전 사용자 확인 절차를 갖추어야 합니다.
* **검증 경로**:
  * 보안 가드레일: `src/Gamsdaq.Api/Security/PromptShieldGuardrail.cs`
  * 교차 감사 에이전트: `AuditorGuardrailAgent` 및 `audit_quote_invariants` 도구
  * 감사 신뢰 경계: 모델 플래너 인자보다 신뢰된 상태(`null` 포함)가 항상 우선합니다. 감귤 `로얄과` + `특등급`/`특`, 반시 `대과` + `특품` 토큰을 모두 충족하고 하위·혼합 등급이 없어야 합니다.
  * **알려진 프롬프트 인젝션 및 비규격 패턴 결정론적 차단 (회귀 테스트 검증)**으로 범위를 한정합니다. **시드 벤치마크 후보군(10건) 기준 미끼 상품 100% 필터링**(4/4건)이며, 미지 공격이나 실제 오픈마켓 전체에 대한 보장이 아닙니다.
  * 요청별 검증 작업 사본에서만 가격 변경·주문 취소·예약금 해제를 계산합니다. `STEP-4`는 `[감사 대기]`, `STEP-5 AUDIT_PASSED` 직전에 시장 버전 확인과 단일 잠금으로 확정합니다. 감사 실패·예외·취소·스트림 조기 종료 시 체크포인트를 복원하며, 동시 주문·초기화가 발생하면 확정하지 않고 `AUDIT_FAILED`로 반환합니다.
  * 체크포인트는 티커·검증 후보뿐 아니라 양방향 FIFO 주문 전체(잔량·최초 시각·지갑 예약 여부), 전체 가상 예수금과 예약금을 깊은 복사합니다. 구현 자료구조는 `_asks`/`_bids`, `_virtualBalance`/`_reservedBalance`이며 별도 `_orders`/`_portfolios` 필드는 없습니다.
  * Human-in-the-Loop 주문 승인: `confirmedByUser: true` 검증 및 프론트엔드 승인 모달

### 2.7 CRIT-07: 창의성 및 혁신성 (5%)
* **요구 사항**:
  * 기존 정찰제 오픈마켓의 한계를 넘어서는 독창적인 문제 해결 방식을 제시해야 합니다.
* **검증 경로**:
  * 농산물 표준 티커화 + 4-Gate 미끼 상품 제거 알고리즘 + 실시간 Price-Time Priority 상생 호가창 결합 (`TRD.md` §1~§3)
