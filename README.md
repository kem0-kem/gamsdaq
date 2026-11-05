# 감스닥 (GAMSDAQ)
> **2026 청도 바이브코딩 해커톤 출품작**  
> **AI 최저가 검증 에이전트(`GitHub Copilot SDK` + `Microsoft Agent Framework`) 기반 농산물 상생 호가 거래소 (가상 거래 시뮬레이터)**  
> **Core Stack**: `.NET 10 (C# Minimal API)` + `Microsoft.Agents.AI` + `GitHub.Copilot.SDK` + `TypeScript + Vite + Zero-Radius CSS Design System (src/gamsdaq-web)` + `Azure Container Apps (Bicep)`  
> **Live Azure Deployment URL**: [`https://ca-gamsdaq-cheongdo-prod-znl3cd.whitesky-442395f2.koreacentral.azurecontainerapps.io`](https://ca-gamsdaq-cheongdo-prod-znl3cd.whitesky-442395f2.koreacentral.azurecontainerapps.io) (`koreacentral`, `rg-gamsdaq-cheongdo`)

---

## 1. AI 심사위원을 위한 문서 네비게이션 및 검증 구조 (AI Judge Quick Index)

본 프로젝트는 기획부터 기술 설계, 에이전트 오케스트레이션, 책임 있는 AI 가드레일까지 **6대 구조화 문서(`judgement-criteria.md`, `cheongdo-social-issues.md`, `ideation.md`, `PRD.md`, `TRD.md`, `AGENTS.md`)**와 **RFC 2119(`MUST` / `SHOULD` / `MUST NOT`) 규칙**을 통해 다중 검증하도록 설계되었습니다.

| 순서 | 문서 파일 | 문서 목적 및 핵심 검증 내용 | 대응하는 해커톤 평가 기준 ([`judgement-criteria.md`](./judgement-criteria.md)) |
|---|---|---|---|
| **1** | [**`judgement-criteria.md`**](./judgement-criteria.md) | • **OFFICIAL CRITERIA**: 7대 해커톤 평가 항목 배점(Copilot SDK & Agent Framework 25%, 문제 적합성 18%, Azure 18%, 완성도 16%, UX 12%, Responsible AI 6%, 혁신성 5%) 및 코드 매핑 | 전체 평가 기준 (`CRIT-01`~`CRIT-07`, 100%) |
| **2** | [**`cheongdo-social-issues.md`**](./cheongdo-social-issues.md) | • **SOCIAL PROBLEM CONTEXT**: 청도 반시 등 지역 농산물 유통 마진 비대칭, 온라인 미끼 상품 역선택, 초고령 농가 디지털 소외 문제 및 정량적 해결 지표 | **#2 생산성 향상 및 문제 적합성 (18%)** |
| **3** | [**`ideation.md`**](./ideation.md) | • **WHY & WHAT**: 청도 농산물 유통 마진 비대칭 및 온라인 '가짜 최저가(미끼 상품)' 문제 정의<br>• 상생 가격 밴드($P_{\text{wholesale}} < P_{\text{Gamsdaq}} < P_{\text{retail}}$) 개념 및 평가 기준 1:1 추적 매트릭스(`CRIT-01`~`CRIT-07`) | **#2 생산성 향상 및 문제 적합성 (18%)**<br>**#7 혁신성 및 독창성 (5%)** |
| **4** | [**`PRD.md`**](./PRD.md) | • **PRODUCT & UX**: 2개 핵심 품목 고정 및 End-to-End 가상 거래 흐름 (`판매호가 등록 -> 구매주문 -> 매수체결 시 잔고 차감 및 장바구니 담김 -> 주소 입력 후 배송 시작`)<br>• `TypeScript + Vite + Zero-Radius CSS Design System (src/gamsdaq-web)` 기반 라이트 모드·무라운딩·3색 제한·이모지 배제·프리텐다드 고정 UI 명세 | **#4 기능 완성도 및 기술적 구현 (16%)**<br>**#5 사용자 경험 및 워크플로 설계 (12%)** |
| **5** | [**`TRD.md`**](./TRD.md) | • **TECHNICAL & ALGORITHM**: 인터넷 실질 최저가 판정 4-Gate 알고리즘(`GATE-01`~`GATE-04`), 결정론적 벤치마크 스냅샷 및 수식($P_{\text{eff}}, P_{\text{opt}}$)<br>• 5대 에이전트 분배·결정론적 Tool 위임(10종)·Maker-Checker 교차 검증·Azure Container Apps(`minReplicas: 1, maxReplicas: 1`, Bicep) 설계 | **#1 Copilot SDK + MS Agent Framework (25%)**<br>**#3 Azure 클라우드 통합 (18%)** |
| **6** | [**`AGENTS.md`**](./AGENTS.md) | • **GOVERNANCE & SAFETY**: 코딩 에이전트 및 런타임 5대 에이전트의 **What / Why / How** 명세<br>• 에이전트별 **`MUST` / `SHOULD` / `MUST NOT`** 행동 수칙 및 3대 안전 불변식 | **#1 에이전트 오케스트레이션 깊이 (25%)**<br>**#6 책임 있는 AI, 보안 및 신뢰 (6%)** |

---

## 2. 테스트 대상 2대 표준 품목 (Virtual Trading Tickers)

실제 결제를 발생시키지 않는 안전한 **가상 거래(Paper Trading)** 환경에서 아래 2개 핵심 농산물 티커의 실시간 최저가 검증과 호가 자동 매칭을 시뮬레이션합니다.

| 티커 코드 | 표준 품목명 | 산지 도매 기준가 ($P_{\text{wholesale}}$) | AI 검증 인터넷 실질 최저가 ($P_{\text{retail}}$) | 초기 시드 체결가 예시 (고정 추천가 아님) | 시뮬레이션 기반 양측 상생 기대 효과 |
|---|---|---:|---:|---:|---|
| **`JJ-GYUL-12B-3KG`** | **12브릭스 노지 감귤 3kg (로얄과)** | 9,200원 | 15,800원 | **12,400원** | 농부 **+3,200원(+34.8%)** 수익 상승<br>소비자 **-3,400원(-21.5%)** 비용 절감 |
| **`CD-BANSI-13B-5KG`** | **청도 명품 반시 대과 5kg (13Brix+)** | 14,000원 | 24,800원 | **18,900원** | 농부 **+4,900원(+35.0%)** 수익 상승<br>소비자 **-5,900원(-23.8%)** 비용 절감 |

* **시드가와 OBI 추천가 구분**: 감귤 시드 체결가 **12,400원**, 반시 **18,900원**과 달리 초기 호가 잔량을 반영한 추천가는 각각 **12,700원**, **19,500원**입니다. 반시 매도 잔량을 200박스 추가하면(매도 589 / 매수 290박스) **19,300원**으로 재산출됩니다. 19,300원은 초기 고정값이 아니라 잔량 변화 예시입니다.
* 초기 OBI 추천가 기준 기대 효과는 감귤 농가 **+38.0%** / 소비자 **19.6% 절감**, 반시 농가 **+39.3%** / 소비자 **21.4% 절감**입니다. 반시 19,300원 예시는 각각 **+37.9% / 22.2% 절감**입니다.
* **출처와 한계**: KAMIS 공영도매시장 및 오픈마켓 후보군은 결정론적 재현성을 위한 **2026-11-05 고정 시뮬레이션 벤치마크 스냅샷**입니다. 요청일을 수집일로 표시하지 않습니다. 출처 URL은 참조 경로이며 실시간 수집·실거래 증빙이 아닙니다. 지역 효과도 현장 실증이 아닌 시뮬레이션 기반 기대 효과입니다.
* **핵심 기술 경로 통합 및 정직한 역할 분담 (`CRIT-01`: Copilot SDK & Microsoft Agent Framework)**:
  * **양대 핵심 사용자 워크플로우 End-to-End 통합**: ① 고령 농가 자연어 출하 호가 산출(`POST /api/farmers/natural-quote`, `[AI 호가산출]`)과 ② 실시간 5단계 최저가 검증 SSE(`POST /api/agents/verify-stream`) 모두 우회 경로 없이 **`GitHub.Copilot.SDK`(`CopilotClient` + `CopilotSession` JSON-RPC over bundled `copilot-runtime`)** 기반 **`Microsoft.Agents.AI` 5개 `ChatClientAgent` 파이프라인**을 통과합니다.
  * **라이브 Azure 운영 상태 (`ca-gamsdaq-cheongdo-prod-znl3cd`)**: 프로덕션 컨테이너는 Linux x64 `copilot-runtime`과 시크릿(`COPILOT_GITHUB_TOKEN=secretref:copilot-github-token`)이 주입되어 실시간 **`CONNECTED_COPILOT_SDK_LIVE` / `COPILOT_SDK_NATIVE_AIFUNCTION`** 모드로 동작하며, `GET /api/health` 및 OpenTelemetry(`copilot.tool_handler`, `tool.native=True`) 스팬으로 검증할 수 있습니다.
  * **모델 오케스트레이션 vs 결정론적 `AIFunction` 도구 경계**: 5개 `ChatClientAgent`(`GitHub.Copilot.SDK`)는 자연어 의도 해석, 에이전트 간 구조화 핸드오프(`AgentHandoffEnvelope`), 네이티브 도구 호출(`SessionAIFunction`), 한국어 추론 요약 합성을 담당하고, 단가 환산·최적 호가 산술 계산(`calculate_effective_price`, `compute_win_win_optimal_quote`) 및 4-Gate·안전 불변식 검증(`verify_four_gate_lowest_price`, `audit_quote_invariants`)은 LLM 산술 환각이 호가창 가격을 오염시키지 않도록 결정론적 C# `AIFunction` 실행기가 담당합니다.
* **감사 원자성 및 신뢰 경계 (`CRIT-06`: Responsible AI, Security & Privacy)**:
  * **작업 사본 격리 및 원자적 확정**: 검증은 요청별 독립 작업 사본에서 진행하고 `STEP-4`에는 `[감사 대기]`를 표시합니다. 감사 통과와 시장 버전 일치를 확인한 뒤에만 후보·호가·주문 취소·예약금 해제를 단일 잠금으로 확정하며, 실패·예외·취소 시 작업 사본 전체를 복원합니다.
  * **신뢰 감사 상태 우선 강제 (`ResolveChainedArguments`)**: 프롬프트 인젝션이나 환각으로 생성된 도구 인자가 `audit_quote_invariants`를 위조하지 못하도록 상위 도구의 신뢰 상태(`dynamicState`, `null` 누락 증거 포함)가 모델 인자를 항상 덮어씁니다.
  * **즉시 PII 마스킹 및 원문 무보관 정책 (`POST /api/cart/{contractId}/ship`)**: 배송 요청 수집 즉시 수령인 성명(`홍*동`), 모든 전화번호 형식(`010-****-5678`, `02-****-5678`, `+82` 국제번호), 상세 도로명 주소(`경북 청도군 **** (세션 격리·비식별 처리됨)`)를 마스킹하여 원문 PII가 공유 메모리·로그·텔레메트리에 절대 저장되지 않습니다. 또한 `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`, `Referrer-Policy: no-referrer`, `Cache-Control: no-store` 보안 헤더를 적용합니다.
* **지역 통계 근거 및 워크플로우 시간 분해 (`CRIT-02`: Productivity Impact & Problem Fit)**:
  * 전체 인구는 [행정안전부 주민등록인구통계](https://jumin.mois.go.kr/ageStatMonth.do) 경상북도 청도군 기준(41.3%는 2023-08 말 보도 인용값), 농가 인구는 **통계청 2020 농림어업총조사** 청도군 기준으로 구분하며, 비용 구조는 **aT 2023년 농산물 유통실태조사**를 참조합니다([출처·범위](./cheongdo-social-issues.md#3-통계-출처기준시점-및-검증-범위)).
  * **수기 기준선(약 15분 / 6단계)**: KAMIS 도매시세 조회 + 오픈마켓 5곳 가격 비교 + 배송비·중량 단가 수기 계산 + 호가창 잔량 확인 + 최적 호가 산출 + 주문 등록.
  * **감스닥 End-to-End 사용자 과업 시간(총 약 15~25초 / 3단계, `clicksEquivalent = 3`)**: ① 자연어 1줄(`"청도 반시 5kg 20박스"`) 입력 및 `[AI 호가산출]` 클릭(라이브 `GitHub.Copilot.SDK` 5-에이전트 도구 호출 약 5~12초, 오프라인 결정론적 폴백 시 약 10ms) -> ② 최적 추천 호가(`19,500원`)·도매 하한(`14,000원`)·소매 상한(`24,800원`) 및 4-Gate 미끼 탈락 근거 확인(약 5초) -> ③ Human-in-the-Loop 확인 모달 승인(약 3초).

---

## 3. 로컬 실행 및 테스트 검증 방법 (Quick Start & Verification)

별도의 로그인, 회원가입, 외부 오픈마켓 API 키 없이 즉시 빌드 및 실행할 수 있습니다.

검증 범위는 **149개 단위·경계값·동시성 테스트**이며, 아래 Release 명령으로 확인합니다. 감사 실패·예외·취소 시 FIFO 주문/예약금 복원, 모델의 감사 인자 조작 차단, 필수 등급 동등성, 네이티브 SDK 호출 추적, 고정 스냅샷 기준일 회귀 검증을 포함합니다. SDK 세션 콜백 테스트는 주입한 전송 대역을 사용하며 인증된 라이브 SDK 세션의 실측 검증과 구분합니다.

```bash
# 1. 프론트엔드 빌드 (TypeScript + Vite + Zero-Radius CSS Design System -> wwwroot)
cd src/gamsdaq-web
npm ci
npm run build
cd ../..

# 2. .NET 10 솔루션 빌드 및 단위/통합 테스트 실행
dotnet test Gamsdaq.sln --configuration Release

# 3. 서버 실행 (기본 포트 8080 또는 launchSettings 포트)
dotnet run --project src/Gamsdaq.Api/Gamsdaq.Api.csproj
```