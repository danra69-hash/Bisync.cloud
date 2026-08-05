# Bisync customer AI — per-tenant daily & monthly usage (AgentCore)

**Status:** Planning estimate  
**Calculator:** [AWS Pricing Calculator → Bedrock AgentCore](https://calculator.aws/#/createCalculator/bedrockagentcore)  
**Pricing refs:** [AgentCore pricing](https://aws.amazon.com/bedrock/agentcore/pricing/) · Claude Sonnet 4.6 $3/$15 per 1M in/out · Claude Haiku 4.5 $1/$5 per 1M in/out  
**See also:** `docs/Bisync-AgentCore-AI-Light-to-Heavy.pdf` (light → very heavy bands).

**Aligned with:** prior 1,000-location AWS stack (`docs/Bisync-AWS-Architecture-1000-Locations.pdf`) and platform AgentCore note (`docs/Bisync-AgentCore-AI-Usage-Estimate.md`)

Currency: **USD**, On-Demand, excludes tax / AWS Support / shared Knowledge Base (OpenSearch) which is platform-shared, not billed per tenant.

A **tenant** = one Bisync company (customer account). Month = **30 days**.

---

## 1. Customer workloads (linked to their Bisync data)

| Code | Customer need | Typical agent pattern | Model |
|---|---|---|---|
| **A** | Questions on **current revenue** | Tool Q&A over live sales/revenue APIs | Sonnet |
| **B** | **Purchase / sales forecast** (internal + external) | Tools + Code Interpreter + Web Search | Sonnet |
| **C** | **Vendor product → component** suggestive tags (trend) | Interactive classify + light batch | Haiku |
| **D** | **Reports & how-to** | Guided help + NL report assembly | 70% Haiku / 30% Sonnet |

---

## 2. Daily usage assumptions **per tenant**

| Workload | SMB (1–2 loc) | Mid (3–10 loc) | Enterprise (10–50 loc) |
|---|---:|---:|---:|
| A Revenue Q&A | **8** / day | **25** / day | **60** / day |
| B Forecast | **1** / day | **3** / day | **8** / day |
| C Tag suggest (interactive) | **5** / day | **15** / day | **40** / day |
| D Reports / how-to | **10** / day | **20** / day | **45** / day |
| C′ Batch SKUs tagged | **20** / day | **80** / day | **250** / day |
| **Sessions / day** (batch ≈ 10 SKUs/session) | **~26** | **~71** | **~178** |
| **Sessions / month** | **~780** | **~2,130** | **~5,340** |

Token profiles (per session): A 6k/1.2k · B 10k/2.5k · C 2.5k/0.4k · D 4k/0.8k · batch 1.5k/0.2k. Prompt cache ~20–30% on repeated system/report context.

---

## 3. Cost **per tenant** — daily & monthly

AgentCore platform lines included: Runtime, Gateway, Memory (STM + light LTM), Code Interpreter (B only), Web Search (B only), Policy.  
**Not** included per tenant: shared OpenSearch/KB (~$400–830 / env shared across all tenants).

| Tenant profile | Sessions/day | **AI $/day** | **AI $/month** | Model $/mo | AgentCore $/mo |
|---|---:|---:|---:|---:|---:|
| **SMB (1–2 locations)** | ~26 | **~$0.50** | **~$15** | ~$13.50 | ~$1.60 |
| **Mid (3–10 locations)** | ~71 | **~$1.42** | **~$42** | ~$38 | ~$4.40 |
| **Enterprise (10–50 loc)** | ~178 | **~$3.47** | **~$104** | ~$93 | ~$11 |

### Per-location view (same Mid tenant ÷ 5 locations)

| | Daily | Monthly |
|---|---:|---:|
| Mid tenant total | ~$1.42 | ~$42 |
| **Per location** | **~$0.28** | **~$8.50** |

### Cost by use case — Mid tenant (~$/month)

| Use case | Daily sessions | ~/day | ~/month | Share |
|---|---:|---:|---:|---:|
| A Current revenue | 25 | ~$0.65 | **~$19.50** | ~46% |
| B Forecast | 3 | ~$0.27 | **~$8.10** | ~19% |
| C Tags (interactive + batch) | 15 + 8 | ~$0.10 | **~$3.00** | ~7% |
| D Reports / how-to | 20 | ~$0.25 | **~$7.50** | ~18% |
| AgentCore overhead | — | ~$0.15 | **~$4.40** | ~10% |
| **Total** | **~71** | **~$1.42** | **~$42** | 100% |

Forecast (B) is the premium path mainly because of Web Search (**$7 / 1,000 queries**) and longer Sonnet contexts.

---

## 4. Monthly rollups (for budgeting)

| Mix | Tenants | Profile | Platform AI $/mo (tokens + AgentCore) |
|---|---:|---|---:|
| Pilot | 20 | SMB | **~$300** |
| Early SaaS | 100 | Mid | **~$4,200** |
| Steady | 200 | Mid | **~$8,500** |
| Scale | 500 Mid + 50 Ent | mixed | **~$26,200** |
| Prior PDF style (1,000 locations ≈ ~200 Mid) | ~200 Mid | | **~$8.5k** tokens+AgentCore (+ shared KB ~$0.5–0.8k) ≈ **~$9–10k** |

Compare: earlier equal-traffic UAT+Prod AI add-on was ~$4.5k–$54k/yr depending on assumptions; **per-tenant metering** shows Mid customers at **~$42/mo each**, so commercial AI surcharge of **$49–99 / tenant / mo** leaves healthy margin.

---

## 5. Calculator inputs **per Mid tenant / month**

Enter these in [bedrockagentcore](https://calculator.aws/#/createCalculator/bedrockagentcore), then **× N tenants** (or scale sessions):

| Component | Per Mid tenant / month |
|---|---|
| Runtime sessions | **~2,130** (~71/day × 30) · ~16 s active @ 1 vCPU · 1.5 GB × ~40 s |
| Gateway invocations | **~5,300** (×2.5 tools/session) |
| Memory STM events | **~6,400** (×3/session) |
| Memory LTM records | **~5** stored · **~850** retrievals |
| Code Interpreter sessions | **~90** (3 forecasts/day) |
| Web Search queries | **~135** (1.5 × forecasts) |
| Policy auth requests | **~5,300** |
| Bedrock tokens (separate line) | Sonnet: A+B+30% D · Haiku: C+70% D+batch (see §2) |

**SMB:** scale × ~0.37 · **Enterprise:** scale × ~2.5.

---

## 6. Suggested commercial packaging

| Plan | Included AI / day | Est. AWS cost / mo | Suggested list add-on |
|---|---|---:|---:|
| SMB | ~25 sessions | ~$15 | **$29 / mo** |
| Growth (Mid) | ~70 sessions | ~$42 | **$79 / mo** |
| Enterprise | ~180 sessions | ~$104 | **$199 / mo** (fair use) |

Soft caps: Web Search ≤ 5 queries/day (SMB) / 15 (Mid); forecasts HQ-role only; Haiku for how-to + tagging.

---

## 7. Disclaimer

Estimates only. Actual cost tracks measured sessions, token lengths, cache hit rate, and whether Knowledge Base is shared or per-tenant. Re-run after a 2–4 week pilot with CloudWatch/Bedrock usage metrics per `company_id`.
