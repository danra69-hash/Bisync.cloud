# Bisync customer AI cost — light to heavy (per tenant)

**Status:** Planning estimate · Generated 2026-08-05  
**Calculator:** [AWS Bedrock AgentCore](https://calculator.aws/#/createCalculator/bedrockagentcore)  
**Rates:** AgentCore Runtime $0.0895/vCPU-hr · $0.00945/GB-hr · Web Search $7/1k · Gateway $0.005/1k · Memory STM $0.25/1k · Claude Sonnet 4.6 $3/$15 per 1M · Claude Haiku 4.5 $1/$5 per 1M  

Currency: **USD** · Month = **30 days** · **Per Bisync company (tenant)**  
Includes: Bedrock tokens + AgentCore (Runtime, Gateway, Memory, Code Interpreter, Web Search, Policy)  
Excludes: tax, AWS Support, shared Knowledge Base / OpenSearch (~$400–830/env shared)

---

## Workloads (customer-linked)

| Code | Need | Model |
|---|---|---|
| **A** | Current **revenue** Q&A | Sonnet |
| **B** | **Purchase / sales forecast** (internal + external) | Sonnet + Code Interpreter + Web Search |
| **C** | **Vendor → component** suggestive tags | Haiku (+ batch) |
| **D** | **Reports & how-to** | 70% Haiku / 30% Sonnet |

---

## Daily usage by scenario (per tenant)

| Workload | Light | Moderate | Heavy | Very heavy |
|---|---:|---:|---:|---:|
| A Revenue Q&A | 3 | 12 | 35 | 80 |
| B Forecast | 0 | 1 | 4 | 10 |
| C Tag suggest | 2 | 8 | 25 | 50 |
| D Reports / how-to | 4 | 12 | 30 | 60 |
| C′ Batch SKUs / day | 5 | 30 | 120 | 400 |
| **Sessions / day** | **~9.5** | **~36** | **~106** | **~240** |
| **Sessions / month** | **~285** | **~1,080** | **~3,180** | **~7,200** |

Typical fit: Light = quiet single site · Moderate = small multi-site · Heavy = busy group · Very heavy = HQ + many outlets.

---

## Cost per tenant — daily & monthly

| Scenario | Sessions/day | **$/day** | **$/month** | Model $/mo | AgentCore $/mo |
|---|---:|---:|---:|---:|---:|
| **Light** | ~9.5 | **~$0.16** | **~$4.90** | ~$4.40 | ~$0.45 |
| **Moderate** | ~36 | **~$0.68** | **~$20** | ~$18 | ~$2.00 |
| **Heavy** | ~106 | **~$2.02** | **~$61** | ~$54 | ~$6.40 |
| **Very heavy** | ~240 | **~$4.58** | **~$137** | ~$123 | ~$15 |

**Range to quote:** about **$5 → $140 / tenant / month** from light to very heavy.

### Per location (illustrative)

| Scenario | Assumed locations | $/location / month |
|---|---:|---:|
| Light | 1 | ~$4.90 |
| Moderate | 3 | ~$6.80 |
| Heavy | 8 | ~$7.60 |
| Very heavy | 20 | ~$6.90 |

---

## Heavy scenario — cost by use case (/month)

| Use case | Sessions/day | ~/month | Share of ~$61 |
|---|---:|---:|---:|
| A Current revenue | 35 | **~$33** | ~54% |
| B Forecast (+ Web Search) | 4 | **~$9** | ~15% |
| C Tags (interactive + batch) | 25 + 12 | **~$4** | ~7% |
| D Reports / how-to | 30 | **~$10** | ~16% |
| AgentCore overhead | — | **~$6** | ~10% |

Revenue Q&A dominates because it is high-frequency Sonnet traffic. Forecast is expensive per call (Web Search) but lower volume.

---

## Fleet rollups (monthly AI spend)

| Mix | Tenants × scenario | ~$/month |
|---|---|---:|
| Pilot | 20 × Light | **~$100** |
| Early | 50 × Moderate | **~$1,000** |
| Growth | 100 × Moderate + 20 × Heavy | **~$3,200** |
| Scale | 200 × Moderate + 50 × Heavy + 10 × Very heavy | **~$8,400** |
| Aggressive | 300 × Heavy | **~$18,300** |

---

## Suggested commercial AI add-on

| Plan | Maps to | AWS cost / mo | Suggested list |
|---|---|---:|---:|
| Starter | Light | ~$5 | **$19 / mo** |
| Standard | Moderate | ~$20 | **$49 / mo** |
| Plus | Heavy | ~$61 | **$99 / mo** |
| Enterprise | Very heavy (fair use) | ~$137 | **$199 / mo** |

---

## AgentCore calculator inputs (scale from Moderate)

| Component | Moderate / mo | Heavy (×~3) | Very heavy (×~6.7) |
|---|---:|---:|---:|
| Runtime sessions | ~1,080 | ~3,180 | ~7,200 |
| Gateway invokes | ~2,700 | ~8,000 | ~18,000 |
| STM events | ~3,200 | ~9,500 | ~21,600 |
| Web Search queries | ~45 | ~180 | ~450 |
| Code Interpreter | ~30 | ~120 | ~300 |

Open [bedrockagentcore](https://calculator.aws/#/createCalculator/bedrockagentcore), enter one scenario, then multiply by tenant count. Add Bedrock token lines separately (Sonnet for A/B, Haiku for C/D).

---

## Disclaimer

Estimates only. Actual cost depends on measured sessions, token lengths, prompt-cache hit rate, and whether Knowledge Base is shared. Validate with a 2–4 week pilot and meter by `company_id`.
