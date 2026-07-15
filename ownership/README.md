# Structure ownership

This repo tracks **who owns each platform structure** (pages, shells, API controllers) without renaming runtime classes for authorship.

## Why

Renaming `HomePage` to `dr_homepage` alone does **not** stop another developer from deploying a replacement. Ownership must be:

1. Declared uniquely (`dr.*` ids)
2. Verified in CI
3. Protected against unauthorized override

## Files

| File | Purpose |
|------|---------|
| `ownership/structure-ownership.json` | Source of truth for structural IDs, owners, paths, symbols, routes |
| `scripts/verify-structure-ownership.mjs` | Fails on collisions, missing files/symbols, unregistered pages/controllers, protected-field overrides |
| `.github/CODEOWNERS` | Requests review from platform owner on structure paths |
| `.cursor/rules/structure-ownership.mdc` | Agent guidance |

## Commands

```powershell
# From repo root
node scripts/verify-structure-ownership.mjs

# Against a base branch (also runs in CI PRs)
node scripts/verify-structure-ownership.mjs --base origin/master
```

## Adding a new page/controller

1. Create the technical file/symbol normally.
2. Append a unique entry:

```json
{
  "id": "dr.page.my-feature",
  "kind": "client-page",
  "path": "client/src/components/revenue/MyFeaturePage.tsx",
  "symbol": "MyFeaturePage",
  "route": "/revenue/my-feature",
  "owner": "alice",
  "ownerEmail": "alice@example.com",
  "createdAt": "2026-07-15"
}
```

3. Run the verifier.
4. Open a PR. Protected ownership changes to existing `dr.*` entries must be approved by the platform owner (`dra`).

## Override behavior

The verifier **fails** when another change tries to:

- Reuse an existing ownership id
- Reuse a route under the same kind
- Register a second structure at the same path+symbol
- Change owner/path/symbol/route of an existing id without intentional manifest update
- Delete an ownership id
- Add a page/controller file without registering it
