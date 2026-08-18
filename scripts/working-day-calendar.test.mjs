/**
 * Working-day accept window: 7 WD after issue (weekends skipped).
 */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

function isWeekend(date) {
  const day = date.getUTCDay();
  return day === 0 || day === 6;
}

function addWorkingDays(startIso, workingDays) {
  const cursor = new Date(`${startIso}T00:00:00Z`);
  let remaining = workingDays;
  while (remaining > 0) {
    cursor.setUTCDate(cursor.getUTCDate() + 1);
    if (!isWeekend(cursor)) remaining -= 1;
  }
  return cursor.toISOString().slice(0, 10);
}

function isPastAcceptDeadline(acceptByInclusive, today) {
  return Boolean(acceptByInclusive) && today > acceptByInclusive;
}

// Monday + 7 working days → next Wednesday
assert.equal(addWorkingDays('2026-08-10', 7), '2026-08-19');
// Friday + 1 working day → Monday
assert.equal(addWorkingDays('2026-08-14', 1), '2026-08-17');
// Accept allowed on the deadline day
assert.equal(isPastAcceptDeadline('2026-08-19', '2026-08-19'), false);
assert.equal(isPastAcceptDeadline('2026-08-19', '2026-08-20'), true);

assert.match(
  fs.readFileSync(path.join(root, 'src/Bisync.Api/Services/WorkingDayCalendar.cs'), 'utf8'),
  /AddWorkingDays/,
);
assert.match(
  fs.readFileSync(path.join(root, 'src/Bisync.Api/Services/PurchaseOrderWorkflow.cs'), 'utf8'),
  /VendorAcceptWorkingDays = 7/,
);
assert.match(
  fs.readFileSync(path.join(root, 'src/Bisync.Api/Services/B2bSalesOrderService.cs'), 'utf8'),
  /WorkingDayCalendar/,
);
assert.match(
  fs.readFileSync(path.join(root, 'src/Bisync.Api/Services/B2bSalesOrderService.cs'), 'utf8'),
  /AddWorkingDays/,
);

console.log('working-day-calendar.test.mjs: ok');
