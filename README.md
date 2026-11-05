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
| **5** | [**`TRD.md`**](./TRD.md) | • **TECHNICAL & ALGORITHM**: 인터넷 실질 최저가 판정 4-Gate 알고리즘(`GATE-01`~`GATE-04`), 결정론적 벤치마크 스냅샷 및 수식($P_{\text{eff}}, P_{\text{opt}}$)<br>• 5대 에이전트 분배·결정론적 Tool 위임(9종)·Maker-Checker 교차 검증·Azure Container Apps(`minReplicas: 1, maxReplicas: 1`, Bicep) 설계 | **#1 Copilot SDK + MS Agent Framework (25%)**<br>**#3 Azure 클라우드 통합 (18%)** |
| **6** | [**`AGENTS.md`**](./AGENTS.md) | • **GOVERNANCE & SAFETY**: 코딩 에이전트 및 런타임 5대 에이전트의 **What / Why / How** 명세<br>• 에이전트별 **`MUST` / `SHOULD` / `MUST NOT`** 행동 수칙 및 3대 안전 불변식 | **#1 에이전트 오케스트레이션 깊이 (25%)**<br>**#6 책임 있는 AI, 보안 및 신뢰 (6%)** |

---

## 2. 테스트 대상 2대 표준 품목 (Virtual Trading Tickers)

실제 결제를 발생시키지 않는 안전한 **가상 거래(Paper Trading)** 환경에서 아래 2개 핵심 농산물 티커의 실시간 최저가 검증과 호가 자동 매칭을 시뮬레이션합니다.

| 티커 코드 | 표준 품목명 | 산지 도매 기준가 ($P_{\text{wholesale}}$) | AI 검증 인터넷 실질 최저가 ($P_{\text{retail}}$) | 감스닥 AI 추천 상생 호가 ($P_{\text{opt}}$) | 양측 상생 효과 |
|---|---|---:|---:|---:|---|
| **`JJ-GYUL-12B-3KG`** | **12브릭스 노지 감귤 3kg (로얄과)** | 9,200원 | 15,800원 | **12,400원** | 농부 **+3,200원(+34.8%)** 수익 상승<br>소비자 **-3,400원(-21.5%)** 비용 절감 |
| **`CD-BANSI-13B-5KG`** | **청도 명품 반시 대과 5kg (13Brix+)** | 14,000원 | 24,800원 | **18,900원** | 농부 **+4,900원(+35.0%)** 수익 상승<br>소비자 **-5,900원(-23.8%)** 비용 절감 |

---

## 3. 로컬 실행 및 테스트 검증 방법 (Quick Start & Verification)

별도의 로그인, 회원가입, 외부 오픈마켓 API 키 없이 즉시 빌드 및 실행할 수 있습니다.

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