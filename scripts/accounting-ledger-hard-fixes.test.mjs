/**
 * Source-level invariants for the accounting ledger hard-fix pass.
 * Guards C1 tenant/auth, C2 opening balances, C3 posting accounts, and SoD.
 */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = rel => fs.readFileSync(path.join(root, rel), 'utf8');

const access = read('src/Bisync.Api/Tenancy/AccountingAccess.cs');
const middleware = read('src/Bisync.Api/Tenancy/TenantContextMiddleware.cs');
const tenantQuery = read('src/Bisync.Api/Tenancy/TenantQuery.cs');
const ledger = read('src/Bisync.Api/Services/LedgerPostingService.cs');
const booksCtrl = read('src/Bisync.Api/Controllers/AccountingBooksController.cs');
const ledgerCtrl = read('src/Bisync.Api/Controllers/AccountingLedgerController.cs');
const internal = read('src/Bisync.Api/Services/AccountingInternalBooksService.cs');
const subledger = read('src/Bisync.Api/Services/AccountingSubledgerService.cs');
const bridge = read('src/Bisync.Api/Services/AccountingBridgeService.cs');
const pack = read('src/Bisync.Api/Services/MalaysiaAccountingPackService.cs');
const panels = read('client/src/components/accounting/AccountingBooksPanels.tsx');
const workspace = read('client/src/components/accounting/AccountingWorkspace.tsx');
const arch = read('docs/ACCOUNTING_ARCHITECTURE.md');

assert.match(access, /Sign in required for Books/, 'Books API requires a signed-in user');
assert.match(access, /Company does not match your signed-in tenant/, 'foreign companyId is 403 for non-admins');
assert.match(ledgerCtrl, /TryGate/, 'ledger controller uses the tenant gate');
assert.match(booksCtrl, /TryGate/, 'books controller uses the tenant gate');
assert.doesNotMatch(ledgerCtrl, /ResolveCompanyId\(tenant, companyId\)/, 'ledger must not prefer query companyId');
assert.doesNotMatch(booksCtrl, /ResolveCompanyId\(tenant, companyId\)/, 'books must not prefer query companyId');

assert.match(middleware, /locked to their home tenant/, 'middleware comment locks non-admin company');
assert.match(middleware, /tenant\.IsPlatformAdmin \|\| tenant\.CompanyId is null/, 'header company only for admin or unset tenant');
assert.match(tenantQuery, /tenant\.CompanyId is > 0 \? tenant\.CompanyId/, 'TenantQuery prefers verified tenant over query');

assert.match(ledger, /\("1510", "Accumulated depreciation"/, 'seed accum dep');
assert.match(ledger, /\("2400", "Deferred revenue"/, 'seed deferred revenue');
assert.match(ledger, /\("5810", "Depreciation expense"/, 'seed dep expense');
assert.match(ledger, /\("2010", "Trade payables control"/, 'seed trade AP control');
assert.match(ledger, /OpeningDrMinor = openDr/, 'new period balances copy prior closing');
assert.match(ledger, /RollForwardOpeningsAsync/, 'soft-close rolls openings');
assert.match(ledger, /ON CONFLICT \("CompanyId", "Series", "FiscalYear"\)/, 'doc counter is atomic');
assert.match(ledger, /FOR UPDATE/, 'period balance row is locked');
assert.match(ledger, /FunctionalCurrency/, 'functional currency is persisted');
assert.match(ledger, /EnsurePeriodsForYearAsync/, 'periods can be created for the posting year');

assert.match(ledgerCtrl, /basis = "closing-balance"/, 'TB reports closing-balance basis');
assert.match(ledgerCtrl, /openingDr/, 'TB exposes opening columns');

assert.match(internal, /\("2400", "D"/, 'rev rec debits deferred revenue');
assert.doesNotMatch(internal, /\("1200", "D", amount, "Contract liability/, 'rev rec must not debit deposits asset');
assert.match(internal, /\("5810", "D", amountMajor, "Depreciation expense"\)/, 'depreciation expense account');
assert.match(internal, /\("1510", "C", amountMajor, "Accumulated depreciation"\)/, 'accum dep contra');
assert.doesNotMatch(internal, /\("1500", "C"/, 'depreciation must not credit gross FA');
assert.match(internal, /bookId == "ifrs"/, 'only IFRS book posts to primary GL');
assert.match(internal, /item\.OpenMinor -= minor/, 'bank match reduces open balance');
assert.match(internal, /group\.JournalId = journal\.Id/, 'bank match stores the cash journal');

assert.match(subledger, /ar\.credit_note\.posted/, 'AR credit note has its own SLA event');
assert.match(subledger, /docSeries: journalSeries/, 'open-item journals use ARJ/APJ, not the item series');
assert.match(subledger, /AreComplementaryKinds/, 'apply rejects invoice-to-invoice');
assert.match(subledger, /VoidOpenItemAsync/, 'void exists');
assert.match(subledger, /i\.Kind == "invoice" \|\| i\.Kind == "bill"/, 'aging is invoices/bills only');

assert.match(bridge, /ap_control/, 'purchase bridge uses AP control role');
assert.doesNotMatch(bridge, /\("2000", "C"/, 'purchase bridge must not hardcode 2000');

assert.match(pack, /ar\.credit_note\.posted/, 'pack seeds credit-note SLA');
assert.match(pack, /deferred_revenue/, 'pack maps deferred revenue role');
assert.match(
  pack,
  /countryCode\.Equals\("MY"/,
  'Malaysia GET/ensure is country-gated',
);

assert.doesNotMatch(panels, /setApprover\('approver'\)/, 'UI must not default a free-text approver');
assert.doesNotMatch(panels, /setActor\(subledger === 'ap' \? 'clerk'/, 'UI must not default clerk');
assert.match(panels, /accountingVoidOpenItem/, 'UI can void an unused open item');
assert.match(panels, /accountingBankSuggest/, 'bank suggest is wired');
assert.match(panels, /getFullYear\(\)/, 'Books dates use local calendar day');
assert.match(workspace, /getFullYear\(\)/, 'workspace dates use local calendar day');
assert.doesNotMatch(workspace, /toISOString\(\)\.slice\(0, 10\)/, 'workspace must not use UTC today');

assert.match(arch, /Phase C1 — Malaysia-first full Books surface 🟡/, 'architecture must not mark C1 complete');
assert.match(arch, /Phase C2 — Internal depth \(no external connections\) 🟡/, 'architecture must not mark C2 complete');
assert.match(arch, /opening-balance roll-forward/, 'architecture documents opening roll-forward');

console.log('accounting-ledger-hard-fixes.test.mjs: ok');
