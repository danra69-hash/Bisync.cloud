# Bisync customer AI — Amazon Bedrock AgentCore usage estimate

**Status:** Planning estimate (not a committed AWS spend)  
**Region (aligned with prior AWS stack):** `ap-southeast-1` (Singapore) — AgentCore list rates below are published global/commercial rates; confirm regional availability in the calculator.  
**Calculator:** [AWS Pricing Calculator → Bedrock AgentCore](https://calculator.aws/#/createCalculator/bedrockagentcore)  
**Pricing reference:** [Amazon Bedrock AgentCore Pricing](https://aws.amazon.com/bedrock/agentcore/pricing/)  
**Prior platform estimate:** `docs/Bisync-AWS-Architecture-1000-Locations.pdf` (UAT+Prod infra + first-pass Bedrock AI ~$2,268 / env / mo)

Currency: **USD**, On-Demand, excludes tax and AWS Support. Model token rates use Claude Sonnet 4.6 ($3 / $15 per 1M in/out) and Claude Haiku 4.5 ($1 / $5 per 1M in/out). Prompt-cache assumed on repeated report/system context where noted.

---

## 1. What this estimate covers

Customer-facing AI linked to **their own Bisync data**, not generic chat:

| # | Customer need | Agent pattern |
|---|---|---|
| A | Questions on **current revenue** | Tool-using Q&A over live sales/revenue APIs + short charts/tables |
| B | **Purchase / sales forecast** from internal + external factors | Multi-step agent: internal history tools + Code Interpreter + Web Search |
| C | **Vendor product → component** suggestive tags (trend-aware) | Classification / ranking agent (mostly Haiku) + optional batch jobs |
| D | Mostly **reports & how-to** | Guided “how do I…” + NL report assembly (mix Haiku / Sonnet) |

This **replaces / extends** the earlier PDF AI surfaces (onboarding, learning, customized reports) with AgentCore Runtime + Gateway tools into Bisync APIs.

---

## 2. Steady-state volume (1,000 locations — Prod)

Aligned with the prior AWS 1,000-location model (~2 requests/min × 16 hrs was the old blend). New mix is more report/forecast heavy:

| Workload | Sessions / mo | Model | Tokens (in / out) | Tools / session (typical) |
|---|---:|---|---|---|
| A Revenue Q&A | 25,000 | Sonnet | 6,000 / 1,200 | Gateway ×2–3 |
| B Forecast | 8,000 | Sonnet | 10,000 / 2,500 | Gateway ×3 + Code Interpreter + Web Search ×1–2 |
| C Tag suggest (interactive) | 15,000 | Haiku | 2,500 / 400 | Gateway ×1–2 |
| D How-to / reports | 20,000 | 70% Haiku / 30% Sonnet | 4,000 / 800 | Gateway ×1 + KB retrieve |
| C′ Batch tagging (new/changed vendor SKUs) | 5,000 sessions (~50k SKUs) | Haiku | 1,500 / 200 | Gateway ×1 |
| **Total interactive + batch sessions** | **~73,000** | | | |

Prior PDF used ~**58,000** blended requests/mo — this plan is ~**+25%** sessions with richer tool use.

---

## 3. AgentCore calculator inputs (copy into the linked calculator)

Use **one environment (Prod)** first; double for identical UAT only if UAT traffic equals Prod (conservative). In practice UAT AI is often **10–25%** of Prod.

### Runtime (all sessions)

| Input | Value | Notes |
|---|---|---|
| Sessions / month | **73,000** | Table above |
| Active CPU time / session | **~16 s** @ 1 vCPU | ~40 s wall clock, ~60% I/O wait (LLM + tools unpaid for CPU) |
| Peak memory | **1.5 GB** for ~40 s | 128 MB minimum applies; bill peak GB-hours |
| Rates | **$0.0895 / vCPU-hr**, **$0.00945 / GB-hr** | Active consumption only |

**≈ $41 / mo** Runtime.

### Gateway

| Input | Value |
|---|---|
| InvokeTool / ListTools / Ping | **~182,500** (= 73k × 2.5) → **$0.91** @ $0.005 / 1k |
| Semantic search (optional) | 0 unless tool catalog search is enabled |
| Tool index | ~20–40 Bisync tools → **&lt; $1 / mo** @ $0.02 / 100 tools |

### Memory

| Input | Value | Cost |
|---|---|---|
| Short-term events | ~3 / session × 73k ≈ **219k** | **~$55** @ $0.25 / 1k |
| Long-term records stored | ~5 / company × 1,000 = **5,000** | **~$4** @ $0.75 / 1k (built-in) |
| Long-term retrievals | ~0.4 / session × 73k ≈ **29k** | **~$15** @ $0.50 / 1k |

### Code Interpreter (forecasts only)

| Input | Value |
|---|---|
| Sessions | **8,000** |
| Active CPU | ~20 s @ 1 vCPU |
| Memory | ~2 GB × 30 s |

**≈ $5 / mo.**

### Web Search (external factors for forecasts)

| Input | Value |
|---|---|
| Queries | **12,000** (8k forecasts × 1.5) |
| Rate | **$7 / 1,000 queries** |

**≈ $84 / mo.**

### Policy (optional but recommended)

| Input | Value |
|---|---|
| Authorization requests | ~182,500 (match Gateway invokes) |
| Rate | **$0.000025 / request** |

**≈ $5 / mo.**

### Identity

**$0** when used through Runtime or Gateway (per AWS).

### Observability

CloudWatch for traces/logs — budget **~$40–80 / mo** at this volume (not an AgentCore line item).

### Browser / Payments / Registry

**Not required** for these four customer workloads → **$0**.

---

## 4. Monthly cost summary (Prod, 1,000 locations)

| Line | ~/mo USD |
|---|---:|
| **Bedrock model tokens** (Sonnet + Haiku, with ~20–30% prompt cache on repeated context) | **~$1,690** |
| AgentCore Runtime + Memory + Gateway + Policy + Code Interpreter | **~$125** |
| AgentCore Web Search | **~$84** |
| Vector / knowledge (OpenSearch Serverless *or* Bedrock Knowledge Base — keep prior-order magnitude) | **~$400–830** |
| CloudWatch observability (AI traces) | **~$50** |
| **AI total (Prod)** | **≈ $2,350 – $2,780** |
| Prior PDF “AI add-on” (Bedrock + OpenSearch + Lambda) | **~$2,268** |

**Headline:** Moving the same class of customer AI onto **AgentCore** stays in the **~$2.4k–$2.8k / Prod / month** band for 1,000 locations. AgentCore platform fees are modest (~$200); **tokens + knowledge store still dominate**.

### UAT + Prod

| Scope | Monthly | Yearly |
|---|---:|---:|
| Prod AI only (mid) | **~$2,500** | **~$30,000** |
| UAT AI @ 20% of Prod | **~$500** | **~$6,000** |
| **UAT + Prod AI** | **~$3,000** | **~$36,000** |
| Prior PDF AI add-on UAT+Prod (equal traffic) | ~$4,535 | ~$54,423 |

If UAT infrastructure stays identical but **AI traffic is cut to ~20%**, AgentCore+token AI is **cheaper than the prior equal-UAT assumption**.

---

## 5. Scenario bands

| Scenario | Sessions / mo | AI $/mo (Prod, mid) | Notes |
|---|---:|---:|---|
| Pilot (~100 locations) | ~7–8k | **~$250–350** | Validate revenue + how-to first; delay Web Search / forecast |
| Steady 1,000 locations | ~73k | **~$2,500** | Full A–D + light batch tagging |
| Stretch ~5,000 locations | ~250–300k | **~$6.5k–9k** | ~4× volume × ~0.7 efficiency (more cache, Haiku routing) |

---

## 6. Cost by customer use case (Prod mid)

| Use case | Driver | ~/mo |
|---|---|---:|
| A Current revenue Q&A | Sonnet tokens + Gateway | **~$780** |
| B Purchase/sales forecast | Sonnet + Web Search + Code Interpreter | **~$590** |
| C Vendor→component tags | Haiku interactive + batch | **~$190** |
| D Reports / how-to | Haiku/Sonnet mix + KB | **~$220–400** (KB shared) |
| AgentCore platform shared | Runtime / Memory / Policy | **~$200** (allocated across A–D) |

**Forecast (B)** is the premium path because of Web Search ($7 / 1k queries) and longer Sonnet contexts — gate it behind roles or daily limits if needed.

---

## 7. Architecture sketch (AgentCore)

```text
Customer (Bisync SPA)
        │
        ▼
 AgentCore Runtime  ──► Bedrock Claude (Haiku | Sonnet)
        │
        ├── Gateway tools ──► Bisync APIs (revenue, PO, sales, vendors, components)
        ├── Memory (session + optional company LTM)
        ├── Code Interpreter (forecast math)
        ├── Web Search (external factors for B only)
        ├── Policy (tenant/company tool allow-list)
        └── Knowledge Base / OpenSearch (how-to + report recipes)
```

Tenant isolation: every Gateway tool call must carry **company/location scope** from the signed Bisync session (same tenancy rules as the AWS target architecture).

---

## 8. How to reproduce in the AWS calculator

1. Open [createCalculator/bedrockagentcore](https://calculator.aws/#/createCalculator/bedrockagentcore).
2. Add **Runtime**: 73,000 sessions; model active CPU ~16 s @ 1 vCPU; memory 1.5 GB × 40 s.
3. Add **Gateway**: ~183k API invocations / month.
4. Add **Memory**: ~219k STM events; 5k LTM records; ~29k retrievals.
5. Add **Code Interpreter**: 8,000 sessions (forecast subset).
6. Add **Web Search**: 12,000 queries.
7. Add **Policy**: ~183k authorization requests (optional).
8. Separately add **Amazon Bedrock** foundation model tokens (or note “tokens billed outside AgentCore”) — Sonnet/Haiku volumes from §2.
9. Keep **OpenSearch Serverless / Knowledge Base** from the prior 1,000-location estimate if RAG how-to stays.

Official share link from the prior core stack (infra + first AI pass):  
https://calculator.aws/#/estimate?id=ed93e08b12ece30328c60d0d20a6a165baf25952

---

## 9. Levers to cut cost without dropping features

1. **Route by intent:** Haiku for how-to + tagging; Sonnet only for revenue narrative and forecasts.  
2. **Prompt cache** system prompts + company report schemas (large win on A/D).  
3. **Cap Web Search** (e.g. 1 query / forecast, or HQ-only).  
4. **Batch tagging offline** with Haiku batch inference (often ~50% token discount) instead of interactive sessions.  
5. **TTL long-term memory** so LTM does not grow unbounded across companies.  
6. **Sample evaluations** ≤5% if AgentCore Evaluations is enabled later.

---

## 10. Disclaimer

AWS Pricing Calculator and list prices are estimates. Actual fees depend on region availability, real token lengths, cache hit rate, Knowledge Base choice, and Support plan. Re-run the AgentCore calculator after a 2–4 week pilot with measured sessions/tokens.
