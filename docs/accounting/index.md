# Accounting docs index

## Binding (Bisync)

- [`../ACCOUNTING_ARCHITECTURE.md`](../ACCOUNTING_ARCHITECTURE.md) — Bisync-adapted ADRs and phase status
- [`accounting-saas-architecture.html`](./accounting-saas-architecture.html) — Bisync-shaped overview

## Upstream package (imported 18 Aug 2026)

Full developer documentation from `Accounting-20260817T180621Z-1-001`:

| Doc | Path |
|---|---|
| README / reading order | [`upstream/00-README.md`](./upstream/00-README.md) |
| Phase 1 core accounting | [`upstream/01-phase1-core-accounting.md`](./upstream/01-phase1-core-accounting.md) |
| Localisation pack framework | [`upstream/02-localisation-pack-framework.md`](./upstream/02-localisation-pack-framework.md) |
| **Malaysia pack (active in product)** | [`upstream/03-pack-malaysia.md`](./upstream/03-pack-malaysia.md) |
| Singapore / AU / ID / TH / US | [`upstream/04`](./upstream/04-pack-singapore.md)–[`08`](./upstream/08-pack-united-states.md) |
| Phase 3 depth | [`upstream/09-phase3-depth-and-scale.md`](./upstream/09-phase3-depth-and-scale.md) |
| Delivery backlog | [`upstream/10-delivery-backlog.md`](./upstream/10-delivery-backlog.md) |
| Blueprint | [`upstream/architecture-blueprint.md`](./upstream/architecture-blueprint.md) |
| Phase 0 Python skeleton (reference) | [`upstream/phase0-ref/ledger-phase0.tar.gz`](./upstream/phase0-ref/ledger-phase0.tar.gz) |

**Product rule:** Malaysia pack is wired into Books. Other country packs are mirrored in **Dev Console → Ref & Library → Accounting localisation packs** for later wiring — do not activate them in runtime until the pack framework ports are implemented.
