/**
 * Whole-receive inbound visibility (not only CN freebies).
 *
 * A multi-line receive can vanish from Stock Card when:
 * 1) LocationIdsJson is empty but LocationExternalId mismatches the selector
 *    → list surfaces the component, summary inbound stays 0 for EVERY line.
 * 2) Stock-card month bounds are UTC while the company operates in MY (UTC+8)
 *    → early-month local receives fall before MonthStart and fold into B/F.
 * 3) Healer only scanned oldest fully-missing POs → recent receives never healed.
 *
 * Mirrors PurchaseMatchesSelectedLocations + company-local month start.
 */
import assert from 'node:assert/strict';

/** Empty JSON must match any selected location (PurchaseMatchesAny parity). */
function purchaseMatchesSelectedLocations(locationIdsJson, locationExternalId, selected) {
  let locs = [];
  try {
    locs = JSON.parse(locationIdsJson || '[]');
    if (!Array.isArray(locs)) locs = [];
  } catch {
    locs = [];
  }
  if (locs.length === 0) return true; // fixed behaviour
  if (locs.some(id => selected.some(s => String(s).toLowerCase() === String(id).toLowerCase())))
    return true;
  if (locationExternalId)
    return selected.some(s => String(s).toLowerCase() === String(locationExternalId).toLowerCase());
  return false;
}

/** Old buggy behaviour: empty JSON + ExternalId required ExternalId match. */
function purchaseMatchesSelectedLocationsLegacy(locationIdsJson, locationExternalId, selected) {
  let locs = [];
  try {
    locs = JSON.parse(locationIdsJson || '[]');
    if (!Array.isArray(locs)) locs = [];
  } catch {
    locs = [];
  }
  if (locs.length > 0) {
    if (locs.some(id => selected.some(s => String(s).toLowerCase() === String(id).toLowerCase())))
      return true;
    return selected.some(s => String(s).toLowerCase() === String(locationExternalId || '').toLowerCase());
  }
  if (locationExternalId)
    return selected.some(s => String(s).toLowerCase() === String(locationExternalId).toLowerCase());
  return true;
}

{
  const selected = ['outlet-a'];
  // Whole receive: empty JSON, ExternalId is a delivery-location id not in selector
  assert.equal(
    purchaseMatchesSelectedLocationsLegacy('[]', 'delivery-wh-1', selected),
    false,
    'legacy hid every purchase on the receive',
  );
  assert.equal(
    purchaseMatchesSelectedLocations('[]', 'delivery-wh-1', selected),
    true,
    'fixed: empty JSON includes purchases for selected locations',
  );
}

/** MY Aug 2026 local month starts 2026-07-31T16:00:00Z */
function startOfLocalDayUtcMy(year, month, day) {
  // Asia/Kuala_Lumpur = UTC+8, no DST
  const localAsUtcMs = Date.UTC(year, month - 1, day, 0, 0, 0) - 8 * 3600 * 1000;
  return new Date(localAsUtcMs);
}

{
  const monthStartUtc = Date.UTC(2026, 7, 1, 0, 0, 0); // Aug 1 00:00 UTC (old)
  const monthStartLocal = startOfLocalDayUtcMy(2026, 8, 1); // Aug 1 00:00 MY
  const receiveEarlyAugLocal = startOfLocalDayUtcMy(2026, 8, 1).getTime() + 2 * 3600 * 1000; // Aug 1 02:00 MY

  assert.ok(receiveEarlyAugLocal < monthStartUtc, 'early MY morning is still July 31 UTC');
  assert.ok(receiveEarlyAugLocal >= monthStartLocal.getTime(), 'company-local August includes it');
}

console.log('stockcard-whole-receive-inbound.test.mjs: OK');
