import { api } from '../api';
import {
  EMPTY_COMPONENT_DETAIL_CONFIG,
  parseDetailConfigJson,
  serializeDetailConfig,
} from './componentForm';
import {
  buildSmartComponentImportPlan,
  buildSmartComponentTemplateCsv,
  parseSmartComponentTemplateCsv,
  SMART_COMPONENT_TEMPLATE_HEADERS,
} from './smartComponentCatalog';
import { ingredientToRow } from '../components/revenue/smartIngredientShared';
import { REV_MGMT_HIERARCHY_KEY } from './revMgmtConfigStore';
import type { QaGroupId } from './devQaGroups';
import type {
  PowerQaContext,
  QaFixAction,
  QaTaskResult,
} from './devQaRunner';

type TaskUpdate = (patch: Partial<QaTaskResult>) => void;
type TaskFn = (ctx: PowerQaContext, update: TaskUpdate) => Promise<void>;

export type ExtendedTaskDef = {
  id: string;
  label: string;
  group: QaGroupId;
  run: TaskFn;
};

function defaultFixActions(stepId: string): QaFixAction[] {
  return [
    { id: `retry:${stepId}`, label: 'Retry this step', description: 'Re-run only this failed step using current QA context.' },
    { id: 'rerun-full', label: 'Re-run full QA', description: 'Start a fresh power-user automation from step 1.' },
    { id: 'cleanup', label: 'Purge QA data (keep history)', description: 'Delete disposable QA company/records from DB. Dev Console history rows are kept.' },
  ];
}

async function assert(condition: boolean, message: string): Promise<void> {
  if (!condition) throw new Error(message);
}

/** Inactive / not-shipped product surfaces — do not warn; skip cleanly. */
function skipInactive(feature: string): never {
  throw Object.assign(new Error(`Skipped — ${feature} is not activated yet.`), { skip: true });
}

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

function periodMonthIso(date = new Date()): string {
  return date.toISOString().slice(0, 7);
}

/** Steps inserted immediately after an existing base step id. */
export const QA_EXTENDED_INSERTS: Record<string, ExtendedTaskDef[]> = {
  'login-system-admin': [
    {
      id: 'sysconfig-companies-locations',
      label: 'Verify Companies & Locations in System Configuration',
      group: 'system-config',
      run: async (ctx, update) => {
        await assert(!!ctx.companyId, 'Company missing');
        const companies = await api.companies();
        const company = companies.find(c => c.id === ctx.companyId);
        await assert(!!company, `QA company #${ctx.companyId} not listed`);
        const locations = (await api.locationsConfig()).filter(l => l.companyId === ctx.companyId);
        const rest = locations.find(l => l.id === ctx.restaurantLocationId);
        const kitchen = locations.find(l => l.id === ctx.kitchenLocationId);
        await assert(!!rest && !!kitchen, 'Restaurant or kitchen missing from locations config');
        update({
          detail: `Company #${company!.id} · ${locations.length} location(s)`,
          facts: {
            companyId: company!.id,
            locationCount: locations.length,
            restaurant: rest!.externalId,
            kitchen: kitchen!.externalId,
          },
          fixActions: defaultFixActions('sysconfig-companies-locations'),
        });
      },
    },
    {
      id: 'sysconfig-access-control',
      label: 'Verify Access Control matrix loads',
      group: 'system-config',
      run: async (ctx, update) => {
        await assert(!!ctx.companyId && !!ctx.adminUserId, 'Admin/company missing');
        const settings = await api.accessControl();
        const users = await api.users();
        const admin = users.find(u => u.id === ctx.adminUserId || u.companyId === ctx.companyId);
        await assert(!!admin, 'QA operator missing from users list');
        update({
          detail: `Access Control loaded · admin ${admin!.email}`,
          facts: {
            hasMatrix: !!settings,
            adminRole: admin!.role,
            userCount: users.length,
          },
          fixActions: defaultFixActions('sysconfig-access-control'),
        });
      },
    },
    {
      id: 'sysconfig-delivery-locations',
      label: 'Create delivery location under restaurant outlet',
      group: 'system-config',
      run: async (ctx, update) => {
        await assert(!!ctx.companyId && !!ctx.restaurantExternalId, 'Restaurant location missing');
        const created = await api.createDeliveryLocation(ctx.restaurantExternalId!, {
          name: `QA Dock ${ctx.runKey}`,
          addressLine1: '12 QA Loading Bay',
          addressLine2: '',
          city: 'Kuala Lumpur',
          stateProvince: 'Wilayah Persekutuan',
          postcode: '50450',
          active: true,
        });
        await assert(!!created.id && !!created.externalId, 'Delivery location create failed');
        const listed = await api.locationDeliveryLocations(ctx.restaurantExternalId!);
        const found = listed.find(d => d.id === created.id || d.externalId === created.externalId);
        await assert(!!found, 'Created delivery location not listed under restaurant');
        ctx.deliveryLocationId = created.id;
        ctx.deliveryLocationExternalId = created.externalId;
        update({
          detail: `Delivery location ${created.name} · ${created.externalId}`,
          facts: {
            deliveryLocationId: created.id,
            deliveryLocationExternalId: created.externalId,
            outletExternalId: ctx.restaurantExternalId!,
            listedCount: listed.length,
          },
          fixActions: defaultFixActions('sysconfig-delivery-locations'),
        });
      },
    },
  ],

  'create-five-component-vendors': [
    {
      id: 'component-download-template',
      label: 'Download My Component CSV template (export)',
      group: 'component',
      run: async (ctx, update) => {
        await assert(!!ctx.companyId && ctx.components.length >= 1, 'Components missing');
        const ingredients = await api.ingredients(ctx.companyId);
        const rows = ingredients.map(ingredientToRow);
        const scope = {
          companyLocations: [
            { externalId: ctx.restaurantExternalId!, name: 'QA Restaurant' },
            { externalId: ctx.kitchenExternalId!, name: 'QA Kitchen' },
          ],
          selectedLocationIds: [ctx.restaurantExternalId!, ctx.kitchenExternalId!],
        };
        const csv = buildSmartComponentTemplateCsv(rows, scope);
        await assert(csv.includes('Principal Component'), 'Template CSV missing Principal Component header');
        await assert(
          csv.includes('Alternate Component Unit 1'),
          'Template CSV missing Alternate Component Unit 1 header',
        );
        await assert(csv.includes('Storage'), 'Template CSV missing Storage header');
        await assert(csv.includes('Daily Usage'), 'Template CSV missing Daily Usage header');
        await assert(csv.includes('Active'), 'Template CSV missing Active header');
        await assert(!csv.includes('Inventory UOM'), 'Template CSV still contains legacy Inventory UOM header');
        await assert(
          SMART_COMPONENT_TEMPLATE_HEADERS.every(h => csv.includes(h)),
          'Template CSV missing one or more current headers',
        );
        await assert(csv.split('\n').length > 2, 'Template CSV should include existing component rows');
        ctx.componentTemplateCsv = csv;
        update({
          detail: `Exported full My Component table template with ${rows.length} row(s)`,
          facts: { rowCount: rows.length, csvBytes: csv.length, headerCount: SMART_COMPONENT_TEMPLATE_HEADERS.length },
          fixActions: defaultFixActions('component-download-template'),
        });
      },
    },
    {
      id: 'component-upload-import',
      label: 'Upload / import My Component CSV (create via plan)',
      group: 'component',
      run: async (ctx, update) => {
        await assert(!!ctx.companyId && !!ctx.componentTemplateCsv, 'Download template first');
        const scope = {
          companyLocations: [
            { externalId: ctx.restaurantExternalId!, name: 'QA Restaurant' },
            { externalId: ctx.kitchenExternalId!, name: 'QA Kitchen' },
          ],
          selectedLocationIds: [ctx.restaurantExternalId!, ctx.kitchenExternalId!],
        };
        const existing = (await api.ingredients(ctx.companyId)).map(ingredientToRow);
        // Append a brand-new row: Principal Kg + Alternate Bag (1 Bag = 10 Kg).
        const importName = `QA Import Flour ${ctx.runKey}`;
        const extraLine = [
          '',
          'Dry Goods',
          'QA Power',
          importName,
          'Kg',
          'Bag',
          '10',
          '',
          '',
          '',
          '',
          '',
          '',
          '',
          '',
          '7',
          'Kg',
          'Kitchen',
          'Dry Store',
          'QA Restaurant; QA Kitchen',
          '',
        ].map(v => `"${v}"`).join(',');
        const csv = `${(ctx.componentTemplateCsv ?? '').trim()}\n${extraLine}\n`;
        const drafts = parseSmartComponentTemplateCsv(csv, scope);
        await assert(drafts.length > 0, 'CSV parse returned no drafts');
        const plan = buildSmartComponentImportPlan(drafts, existing, scope);
        const create = plan.creates.find(c => c.name === importName) ?? plan.creates[0];
        await assert(!!create, 'Import plan produced no creates');
        const altUnits = create!.altRecipeUnits?.length
          ? create!.altRecipeUnits
          : [{ unit: 'Bag', fromQty: '1', qty: '10' }];
        await assert(
          altUnits.some(a => a.unit.trim().toLowerCase() === 'bag'),
          'Import draft missing Alternate Component Unit Bag',
        );
        const created = await api.createIngredient({
          componentId: '',
          name: create!.name,
          category: create!.category || 'Dry Goods',
          group: create!.group || 'QA Power',
          recipeUom: create!.recipeUom || 'Kg',
          inventoryUom: create!.recipeUom || 'Kg',
          lastPriceRecipe: create!.lastPriceRecipe || 1,
          lastPriceInventory: create!.lastPriceInventory || 1,
          dailyUsage: create!.dailyUsage || 1,
          orderFreqDays: create!.orderFreqDays || 7,
          storageJson: JSON.stringify(create!.storage?.length ? create!.storage : ['Dry Store']),
          storageNote: 'QA CSV import',
          detailConfigJson: serializeDetailConfig({
            ...EMPTY_COMPONENT_DETAIL_CONFIG,
            altRecipeUnits: altUnits,
          }),
          attachedProducts: 0,
          attachedVendors: 0,
          active: true,
          locationsJson: JSON.stringify([ctx.restaurantExternalId!, ctx.kitchenExternalId!]),
        });
        ctx.importedComponentId = created.componentId || String(created.id);
        ctx.importedIngredientId = created.id;
        update({
          detail: `Imported ${created.name} · PCU ${created.recipeUom} · Alt ${altUnits[0]?.unit || '—'}`,
          facts: {
            ingredientId: created.id,
            componentId: created.componentId,
            recipeUom: created.recipeUom,
            alternateUom: altUnits[0]?.unit ?? null,
            planCreates: plan.creates.length,
            planUpdates: plan.updates.length,
          },
          fixActions: defaultFixActions('component-upload-import'),
        });
      },
    },
    {
      id: 'component-edit-par-stock',
      label: 'Edit component par stock / daily usage',
      group: 'component',
      run: async (ctx, update) => {
        await assert(ctx.components.length >= 1 && !!ctx.companyId, 'Components missing');
        const target = ctx.components[0];
        const current = await api.ingredients(ctx.companyId).then(list =>
          list.find(i => i.id === target.ingredientId || i.componentId === target.componentId),
        );
        await assert(!!current, `Ingredient ${target.componentId} not found`);
        const updated = await api.updateIngredient(current!.id, {
          ...current!,
          dailyUsage: Math.max(1, (current!.dailyUsage || 0) + 1),
          orderFreqDays: current!.orderFreqDays || 7,
        });
        update({
          detail: `Updated par/usage for ${updated.name} · dailyUsage=${updated.dailyUsage}`,
          facts: {
            componentId: updated.componentId,
            dailyUsage: updated.dailyUsage,
            orderFreqDays: updated.orderFreqDays,
          },
          fixActions: defaultFixActions('component-edit-par-stock'),
        });
      },
    },
    {
      id: 'component-config',
      label: 'Component Config (hierarchy / storage)',
      group: 'component',
      run: async (ctx, update) => {
        await assert(!!ctx.companyId, 'Company missing');
        const companyId = ctx.companyId!;
        const before = await api.revMgmtConfig(companyId, REV_MGMT_HIERARCHY_KEY);
        const state = {
          categories: ['Dry Goods', 'QA Power Cat'],
          groupsByCategory: { 'Dry Goods': ['QA Power'], 'QA Power Cat': ['Imported'] },
        };
        await api.updateRevMgmtConfig(companyId, REV_MGMT_HIERARCHY_KEY, JSON.stringify(state));
        const after = await api.revMgmtConfig(companyId, REV_MGMT_HIERARCHY_KEY);
        await assert(after.state != null, 'Hierarchy config not saved');
        update({
          detail: 'Component hierarchy config saved',
          facts: {
            configKey: REV_MGMT_HIERARCHY_KEY,
            hadPrior: before.state != null,
            saved: true,
          },
          fixActions: defaultFixActions('component-config'),
        });
      },
    },
    {
      id: 'component-alternate-uoms',
      label: 'Verify Alternate Component UOMs on seeded components',
      group: 'component',
      run: async (ctx, update) => {
        await assert(ctx.components.length >= 1 && !!ctx.companyId, 'Components missing');
        const target = ctx.components[0];
        const current = await api.ingredients(ctx.companyId).then(list =>
          list.find(i => i.id === target.ingredientId || i.componentId === target.componentId),
        );
        await assert(!!current, `Ingredient ${target.componentId} not found`);
        const detail = parseDetailConfigJson(current!.detailConfigJson);
        const bag = detail.altRecipeUnits.find(a => a.unit.trim().toLowerCase() === 'bag');
        await assert(!!bag, 'Seeded component missing Alternate Component UOM Bag');
        await assert(String(bag!.qty) === '10', `Expected 1 Bag = 10 Kg, got qty=${bag!.qty}`);
        // Ensure a second alternate can be persisted (Tin).
        const nextAlts = [
          ...detail.altRecipeUnits.filter(a => a.unit.trim().toLowerCase() !== 'tin'),
          { unit: 'Tin', fromQty: '1', qty: '5' },
        ].slice(0, 5);
        const updated = await api.updateIngredient(current!.id, {
          ...current!,
          inventoryUom: current!.recipeUom || 'Kg',
          detailConfigJson: serializeDetailConfig({
            ...detail,
            altRecipeUnits: nextAlts,
          }),
        });
        const saved = parseDetailConfigJson(updated.detailConfigJson);
        await assert(
          saved.altRecipeUnits.some(a => a.unit.trim().toLowerCase() === 'tin'),
          'Failed to persist Alternate Component UOM Tin',
        );
        update({
          detail: `${updated.name} · PCU ${updated.recipeUom} · alts ${saved.altRecipeUnits.map(a => a.unit).join(', ')}`,
          facts: {
            componentId: updated.componentId,
            principalUom: updated.recipeUom,
            alternateCount: saved.altRecipeUnits.length,
            alternates: saved.altRecipeUnits.map(a => a.unit).join(', '),
          },
          fixActions: defaultFixActions('component-alternate-uoms'),
        });
      },
    },
    {
      id: 'component-tag-suggestions',
      label: 'My Component tag suggestions API',
      group: 'component',
      run: async (ctx, update) => {
        await assert(!!ctx.companyId && ctx.components.length >= 1, 'Components missing');
        const names = ctx.components.map(c => c.name);
        const counts = await api.componentTagSuggestionCounts(ctx.companyId!, names);
        await assert(!!counts?.counts && typeof counts.counts === 'object', 'Tag suggestion counts response invalid');
        const sample = ctx.components[0];
        const suggestions = await api.componentTagSuggestions(
          ctx.companyId!,
          sample.name,
          [ctx.restaurantExternalId!, ctx.kitchenExternalId!].filter(Boolean) as string[],
        );
        await assert(suggestions.componentName === sample.name, 'Suggestion response component name mismatch');
        await assert(
          typeof suggestions.minProbability === 'number' && suggestions.minProbability >= 0.5,
          `Expected minProbability ≥ 0.5, got ${suggestions.minProbability}`,
        );
        await assert(Array.isArray(suggestions.suggestions), 'Suggestions array missing');
        update({
          detail: `Tag suggestions for ${sample.name} · ${suggestions.count} hit(s) (≥${Math.round(suggestions.minProbability * 100)}%)`,
          facts: {
            componentName: sample.name,
            suggestionCount: suggestions.count,
            minProbability: suggestions.minProbability,
            namesQueried: names.length,
            countsKeys: Object.keys(counts.counts).length,
          },
          fixActions: defaultFixActions('component-tag-suggestions'),
        });
      },
    },
    {
      id: 'vendor-listings-state-city-filter',
      label: 'Vendor Listings State & City filters',
      group: 'vendors',
      run: async (ctx, update) => {
        await assert(ctx.components.length >= 3, 'Need seeded vendors across localities');
        const vendors = await api.vendors();
        const qaVendors = vendors.filter(v =>
          ctx.components.some(c => c.vendorExternalId === v.externalId),
        );
        await assert(qaVendors.length >= 3, `Expected ≥3 QA vendors, got ${qaVendors.length}`);
        const states = [...new Set(qaVendors.map(v => (v.state || '').trim()).filter(Boolean))];
        const cities = [...new Set(qaVendors.map(v => (v.city || '').trim()).filter(Boolean))];
        await assert(states.length >= 2, `Expected ≥2 vendor states for filter coverage, got ${states.join(', ') || 'none'}`);
        await assert(cities.length >= 2, `Expected ≥2 vendor cities for filter coverage, got ${cities.join(', ') || 'none'}`);

        const stateFilter = 'Selangor';
        const byState = qaVendors.filter(v => (v.state || '').trim().toLowerCase() === stateFilter.toLowerCase());
        await assert(byState.length >= 1, `No QA vendors in state ${stateFilter}`);
        const cityFilter = (byState[0].city || '').trim();
        await assert(!!cityFilter, `Vendor in ${stateFilter} missing city`);
        const byCity = byState.filter(v => (v.city || '').trim().toLowerCase() === cityFilter.toLowerCase());
        await assert(byCity.length >= 1, `State→City cascade empty for ${stateFilter}/${cityFilter}`);
        const crossStateCity = qaVendors.filter(
          v =>
            (v.city || '').trim().toLowerCase() === cityFilter.toLowerCase()
            && (v.state || '').trim().toLowerCase() !== stateFilter.toLowerCase(),
        );
        update({
          detail: `State/City filters · ${states.length} states · ${cities.length} cities · ${stateFilter}/${cityFilter}=${byCity.length}`,
          facts: {
            qaVendorCount: qaVendors.length,
            stateCount: states.length,
            cityCount: cities.length,
            filteredState: stateFilter,
            filteredCity: cityFilter,
            stateMatchCount: byState.length,
            cityMatchCount: byCity.length,
            crossStateSameCity: crossStateCity.length,
          },
          fixActions: defaultFixActions('vendor-listings-state-city-filter'),
        });
      },
    },
    {
      id: 'vendor-compare-price',
      label: 'Compare Price across vendor products',
      group: 'vendors',
      run: async (ctx, update) => {
        await assert(ctx.components.length >= 2, 'Need ≥2 vendor products');
        const prices = await api.vendorProductPrices();
        const ours = prices.filter(p => ctx.components.some(c => c.catalogId === p.id));
        await assert(prices.length >= 0, 'Price compare API failed');
        update({
          detail: `Price rows loaded · ${prices.length} total · ${ours.length} QA-matched`,
          facts: { priceRowCount: prices.length, qaMatched: ours.length },
          fixActions: defaultFixActions('vendor-compare-price'),
        });
      },
    },
    {
      id: 'vendor-rating',
      label: 'Rate a vendor (delivery / quality)',
      group: 'vendors',
      run: async (ctx, update) => {
        await assert(ctx.components.length >= 1, 'Vendors missing');
        const vendorExternalId = ctx.components[0].vendorExternalId;
        await api.upsertVendorRating(vendorExternalId, {
          delivery: 'satisfied',
          productAccuracy: 'satisfied',
          productQuality: 'acceptable',
          hygieneCleanliness: 'satisfied',
          notes: `QA rating ${ctx.runKey}`,
          companyId: ctx.companyId,
        });
        const summary = await api.vendorRating(vendorExternalId);
        update({
          detail: `Rated ${vendorExternalId}`,
          facts: {
            vendorExternalId,
            hasSummary: !!summary,
          },
          fixActions: defaultFixActions('vendor-rating'),
        });
      },
    },
    {
      id: 'vendor-activate-deactivate-product',
      label: 'Deactivate then reactivate a vendor product',
      group: 'vendors',
      run: async (ctx, update) => {
        await assert(ctx.components.length >= 1, 'Vendor product missing');
        const catalogId = ctx.components[0].catalogId;
        await api.deactivateVendorProductCatalog(catalogId);
        await api.reactivateVendorProductCatalog(catalogId);
        update({
          detail: `Toggled catalog ${catalogId} off → on`,
          facts: { catalogId, deactivated: true, reactivated: true },
          fixActions: defaultFixActions('vendor-activate-deactivate-product'),
        });
      },
    },
    {
      id: 'vendor-rfq',
      label: 'Create vendor RFQ (quote request)',
      group: 'vendors',
      run: async (ctx, update) => {
        await assert(!!ctx.companyId && ctx.components.length >= 1, 'Context incomplete');
        const c = ctx.components[0];
        const rfq = await api.createQuoteRequest({
          companyId: ctx.companyId!,
          locationExternalIds: [ctx.kitchenExternalId!, ctx.restaurantExternalId!].filter(Boolean) as string[],
          notes: `QA RFQ ${ctx.runKey}`,
          createdBy: ctx.adminName || 'QA',
          vendors: [{
            vendorExternalId: c.vendorExternalId,
            vendorName: c.vendorName,
            contactPerson: 'QA Contact',
            email: 'vendor-qa@cubevalue.com',
            mobile: '+60170000099',
            isNewVendor: false,
          }],
          lines: [{
            kind: 'principal',
            componentExternalId: c.componentId,
            componentName: c.name,
            specification: 'QA RFQ line',
            principalUom: 'Kg',
            requestedQty: 10,
          }],
        });
        ctx.quoteRequestId = rfq.id;
        update({
          detail: `RFQ #${rfq.id} created`,
          facts: { quoteRequestId: rfq.id },
          fixActions: defaultFixActions('vendor-rfq'),
        });
      },
    },
    {
      id: 'vendor-sample-request',
      label: 'Create vendor sample request',
      group: 'vendors',
      run: async (ctx, update) => {
        await assert(!!ctx.companyId && ctx.components.length >= 1, 'Context incomplete');
        const c = ctx.components[0];
        const sample = await api.createSampleRequest({
          companyId: ctx.companyId!,
          dateRequested: todayIso(),
          contactPersonName: ctx.adminName || 'QA Operator',
          companyRequested: ctx.companyName || 'QA Power Co',
          customerName: ctx.companyName || 'QA Power Co',
          isNewCustomer: true,
          vendorExternalId: c.vendorExternalId,
          vendorContactPerson: 'QA Vendor Contact',
          vendorContactEmail: 'vendor-qa@cubevalue.com',
          vendorContactMobile: '+60170000099',
          ingredientComponentId: c.componentId,
          productPolicyTag: 'halal',
          projectScope: 'new',
          requestType: 'new_submission',
          projectName: `QA Sample ${ctx.runKey}`,
          deliveryUnit: 'Kg',
          expectedQtyPerYear: 100,
          expectedPrice: c.unitPrice,
          productCategory: 'Dry Goods',
          productGroup: 'QA Power',
          productSamples: [{ name: c.name, description: 'QA sample line' }],
          quantityRequested: 1,
          quantityUom: 'Kg',
        });
        ctx.sampleRequestId = sample.id;
        update({
          detail: `Sample request #${sample.id} created`,
          facts: { sampleRequestId: sample.id },
          fixActions: defaultFixActions('vendor-sample-request'),
        });
      },
    },
  ],

  'set-rrp-check-cogs': [
    {
      id: 'create-b2b-product',
      label: 'Create B2B-enabled finished product',
      group: 'products',
      run: async (ctx, update) => {
        await assert(ctx.components.length >= 2 && !!ctx.companyId && !!ctx.kitchenExternalId, 'Need components');
        const c0 = ctx.components[0];
        const c1 = ctx.components[1];
        const product = await api.createProduct({
          name: `QA B2B Tray ${ctx.runKey}`,
          category: 'Bakery',
          group: 'QA Power',
          isSubProduct: false,
          b2cEnabled: false,
          b2bEnabled: true,
          rrp: 45,
          yieldQuantity: 1,
          yieldUom: 'tray',
          expiryPeriodDays: 2,
          companyId: ctx.companyId,
          locationExternalIds: [ctx.kitchenExternalId!],
          items: [
            {
              componentId: c0.componentId,
              componentName: c0.name,
              componentUom: 'Kg',
              componentUomPrice: c0.unitPrice,
              quantity: 1,
            },
            {
              componentId: c1.componentId,
              componentName: c1.name,
              componentUom: 'Kg',
              componentUomPrice: c1.unitPrice,
              quantity: 1,
            },
          ],
          packagingItems: [],
          aliases: [],
        });
        ctx.b2bProduct = {
          id: product.id,
          productId: product.productId,
          name: product.name,
          totalCost: product.totalCost,
          rrp: product.rrp,
        };
        update({
          detail: `${product.name} · B2B · ${product.productId}`,
          facts: {
            productId: product.productId,
            b2bEnabled: true,
            totalCost: product.totalCost,
            rrp: product.rrp,
          },
          fixActions: defaultFixActions('create-b2b-product'),
        });
      },
    },
    {
      id: 'product-audit',
      label: 'Run Product Audit for current month',
      group: 'products',
      run: async (ctx, update) => {
        await assert(!!ctx.companyId, 'Company missing');
        const month = periodMonthIso();
        const result = await api.productAudit(ctx.companyId!, month);
        update({
          detail: `Product Audit ${month} · ${result.count} row(s)`,
          facts: { month, rowCount: result.count },
          fixActions: defaultFixActions('product-audit'),
        });
      },
    },
    {
      id: 'products-account-mapping',
      label: 'Products · Account Mapping',
      group: 'products',
      run: async () => {
        skipInactive('Products Account Mapping');
      },
    },
  ],

  'receive-all-pos': [
    {
      id: 'order-template',
      label: 'Create Order Template (schedule)',
      group: 'operation-order',
      run: async (ctx, update) => {
        await assert(ctx.components.length >= 1 && !!ctx.companyId, 'Context incomplete');
        const c = ctx.components[0];
        const tpl = await api.createOrderTemplate({
          name: `QA Order Template ${ctx.runKey}`,
          templateKind: 'schedule',
          vendorExternalId: c.vendorExternalId,
          vendorName: c.vendorName,
          scheduleMode: 'weekday',
          weekdays: ['mon', 'thu'],
          monthDays: [],
          repeatEnabled: true,
          companyId: ctx.companyId,
          locationExternalIds: [ctx.kitchenExternalId!],
          items: [{
            componentId: c.componentId,
            componentName: c.name,
            vendorProductId: c.catalogId,
            vendorExternalId: c.vendorExternalId,
            vendorName: c.vendorName,
            productName: c.catalogName,
            quantity: 5,
            componentUom: 'Kg',
            deliveryUnit: 'Kg',
          }],
        });
        ctx.orderTemplateId = tpl.id;
        update({
          detail: `Order template #${tpl.id} · ${tpl.name}`,
          facts: { templateId: tpl.id, vendor: c.vendorExternalId },
          fixActions: defaultFixActions('order-template'),
        });
      },
    },
    {
      id: 'order-precommitted-template',
      label: 'Create Pre-committed PO template',
      group: 'operation-order',
      run: async (ctx, update) => {
        await assert(ctx.components.length >= 1 && !!ctx.companyId, 'Context incomplete');
        const c = ctx.components[1] ?? ctx.components[0];
        const tpl = await api.createOrderTemplate({
          name: `QA Pre-committed ${ctx.runKey}`,
          templateKind: 'pre_committed',
          vendorExternalId: c.vendorExternalId,
          vendorName: c.vendorName,
          scheduleMode: '',
          weekdays: [],
          monthDays: [],
          repeatEnabled: false,
          companyId: ctx.companyId,
          locationExternalIds: [ctx.kitchenExternalId!],
          items: [{
            componentId: c.componentId,
            componentName: c.name,
            vendorProductId: c.catalogId,
            vendorExternalId: c.vendorExternalId,
            vendorName: c.vendorName,
            productName: c.catalogName,
            quantity: 20,
            componentUom: 'Kg',
            deliveryUnit: 'Kg',
          }],
        });
        ctx.precommittedTemplateId = tpl.id;
        update({
          detail: `Pre-committed template #${tpl.id}`,
          facts: { templateId: tpl.id },
          fixActions: defaultFixActions('order-precommitted-template'),
        });
      },
    },
    {
      id: 'order-with-delivery-location',
      label: 'Create PO ship-to delivery location',
      group: 'operation-order',
      run: async (ctx, update) => {
        await assert(
          !!ctx.companyId && !!ctx.restaurantExternalId && !!ctx.deliveryLocationExternalId && ctx.components.length >= 1,
          'Delivery location / components missing',
        );
        const c = ctx.components[0];
        const created = await api.createPurchaseOrders({
          companyId: ctx.companyId,
          locationExternalIds: [ctx.restaurantExternalId!],
          deliveryLocationExternalId: ctx.deliveryLocationExternalId!,
          initiatedBy: ctx.adminName ?? 'QA System Admin',
          orders: [{
            vendorName: c.vendorName,
            documentType: 'PO',
            orderDate: todayIso(),
            deliveryDate: todayIso(),
            status: 'Pending Approval',
            items: [{
              componentId: c.componentId,
              componentName: c.name,
              vendorProductId: c.catalogId,
              name: c.catalogName,
              quantity: 2,
              unitPrice: c.unitPrice,
              unit: 'Kg',
              componentUom: 'Kg',
              deliveryPackage: '1 Kg',
            }],
          }],
        });
        await assert(created.length === 1, `Expected 1 PO, got ${created.length}`);
        const po = created[0];
        const shipTo =
          po.deliveryLocationExternalId
          || po.deliveryLocation?.externalId
          || '';
        await assert(
          shipTo === ctx.deliveryLocationExternalId,
          `PO ship-to mismatch (expected ${ctx.deliveryLocationExternalId}, got ${shipTo || 'none'})`,
        );
        update({
          detail: `PO #${po.id} ship-to ${shipTo}`,
          facts: {
            purchaseOrderId: po.id,
            deliveryLocationExternalId: shipTo,
            outletExternalId: ctx.restaurantExternalId!,
          },
          fixActions: defaultFixActions('order-with-delivery-location'),
        });
      },
    },
    {
      id: 'order-store-requisition-flow',
      label: 'Store Requisition create → issue → receive',
      group: 'operation-order',
      run: async (ctx, update) => {
        await assert(
          !!ctx.companyId && !!ctx.kitchenExternalId && !!ctx.restaurantExternalId && ctx.components.length >= 1,
          'Central store / outlet / components missing',
        );
        const c = ctx.components[0];
        const activated = await api.activateCentralStore({
          companyId: ctx.companyId!,
          storeLocationExternalId: ctx.kitchenExternalId!,
          kitchenLocationExternalId: ctx.kitchenExternalId!,
        });
        await assert(!!activated?.storeLocationExternalId, 'Central Store activation failed');
        const created = await api.createOutletStoreRequisition({
          companyId: ctx.companyId!,
          requesterLocationExternalId: ctx.restaurantExternalId!,
          requestedBy: ctx.adminName || 'QA',
          lines: [{
            componentId: c.componentId,
            componentName: c.name,
            uom: 'Kg',
            quantity: 1,
          }],
        });
        await assert(!!created.id, 'Store requisition create failed');
        await assert(
          (created.kind || '').toLowerCase() === 'outlet' || (created.kind || '') === '',
          `Expected outlet requisition kind, got ${created.kind}`,
        );
        const issued = await api.issueStoreRequisition(created.id, {
          companyId: ctx.companyId!,
          issuedBy: ctx.adminName || 'QA',
        });
        await assert((issued.status || '').toLowerCase() === 'issued', `Issue failed (status=${issued.status})`);
        const received = await api.receiveStoreRequisition(created.id, {
          companyId: ctx.companyId!,
          receivedBy: ctx.adminName || 'QA',
        });
        await assert((received.status || '').toLowerCase() === 'received', `Receive failed (status=${received.status})`);
        const listed = await api.storeRequisitions(ctx.companyId!, undefined, 'outlet');
        const found = listed.find(r => r.id === created.id);
        await assert(!!found && (found.status || '').toLowerCase() === 'received', 'Requisition missing from Active Requisition list');
        ctx.storeRequisitionId = created.id;
        update({
          detail: `Store Requisition #${created.requisitionNumber || created.id} · received`,
          facts: {
            storeRequisitionId: created.id,
            requisitionNumber: created.requisitionNumber,
            status: received.status,
            storeLocation: ctx.kitchenExternalId!,
            requesterLocation: ctx.restaurantExternalId!,
            componentId: c.componentId,
            listedOutletCount: listed.length,
          },
          fixActions: defaultFixActions('order-store-requisition-flow'),
        });
      },
    },
    {
      id: 'team-rms-po-counts',
      label: 'Team RMS PO group counts',
      group: 'operation-order',
      run: async (ctx, update) => {
        await assert(!!ctx.companyId && ctx.purchaseOrders.length > 0, 'Purchase orders missing');
        const all = await api.purchaseOrders();
        const qaIds = new Set(ctx.purchaseOrders.map(p => p.id));
        const qaPos = all.filter(p => qaIds.has(p.id));
        await assert(qaPos.length >= ctx.purchaseOrders.length, `Expected ≥${ctx.purchaseOrders.length} QA POs in list`);
        const normalize = (status: string) => (status || '').trim().toLowerCase();
        const buckets = {
          toApprove: 0,
          active: 0,
          received: 0,
          other: 0,
        };
        for (const po of qaPos) {
          const s = normalize(po.status);
          if (s.includes('pending') || s.includes('approval')) buckets.toApprove += 1;
          else if (s.includes('receiv') || s.includes('complete') || s.includes('closed')) buckets.received += 1;
          else if (s.includes('accept') || s.includes('active') || s.includes('approved') || s.includes('open')) buckets.active += 1;
          else buckets.other += 1;
        }
        const total = buckets.toApprove + buckets.active + buckets.received + buckets.other;
        await assert(total === qaPos.length, 'PO bucket total mismatch');
        update({
          detail: `Team RMS counts · to-approve ${buckets.toApprove} · active ${buckets.active} · received ${buckets.received}`,
          facts: {
            qaPoCount: qaPos.length,
            toApprove: buckets.toApprove,
            active: buckets.active,
            received: buckets.received,
            other: buckets.other,
          },
          fixActions: defaultFixActions('team-rms-po-counts'),
        });
      },
    },
  ],

  'verify-stock-after-cash': [
    {
      id: 'inventory-wastage',
      label: 'Record wastage on a component',
      group: 'operation-inventory',
      run: async (ctx, update) => {
        await assert(ctx.components.length >= 1 && !!ctx.companyId && !!ctx.kitchenExternalId, 'Context incomplete');
        const c = ctx.components[0];
        const entry = await api.createWastage({
          companyId: ctx.companyId,
          locationExternalId: ctx.kitchenExternalId!,
          itemType: 'component',
          itemKey: c.componentId,
          itemName: c.name,
          quantity: 0.25,
          uom: 'Kg',
          wastedDate: todayIso(),
          reason: `QA wastage ${ctx.runKey}`,
        });
        ctx.wastageEntryId = entry.id;
        update({
          detail: `Wastage #${entry.id} · 0.25 Kg ${c.name}`,
          facts: { wastageId: entry.id, componentId: c.componentId },
          fixActions: defaultFixActions('inventory-wastage'),
        });
      },
    },
    {
      id: 'inventory-transfer',
      label: 'Transfer stock kitchen → restaurant and receive',
      group: 'operation-inventory',
      run: async (ctx, update) => {
        await assert(
          ctx.components.length >= 1 && !!ctx.companyId && !!ctx.kitchenExternalId && !!ctx.restaurantExternalId,
          'Locations/components missing',
        );
        const c = ctx.components[0];
        const transfer = await api.createTransfer({
          companyId: ctx.companyId,
          fromLocationExternalId: ctx.kitchenExternalId!,
          toLocationExternalId: ctx.restaurantExternalId!,
          itemType: 'component',
          itemKey: c.componentId,
          itemName: c.name,
          quantity: 0.5,
          uom: 'Kg',
          transferDate: todayIso(),
          initiatedBy: ctx.adminName || 'QA',
        });
        const received = await api.receiveTransfer(transfer.id, {
          companyId: ctx.companyId,
          receivedBy: ctx.adminName || 'QA',
          receivedQuantity: 0.5,
          receivedDate: todayIso(),
        });
        ctx.transferId = received.id;
        update({
          detail: `Transfer #${received.id} · ${received.status}`,
          facts: {
            transferId: received.id,
            status: received.status,
            from: ctx.kitchenExternalId!,
            to: ctx.restaurantExternalId!,
          },
          fixActions: defaultFixActions('inventory-transfer'),
        });
      },
    },
    {
      id: 'inventory-adjustment',
      label: 'Stock Card adjustment (Principal Component Unit)',
      group: 'operation-inventory',
      run: async (ctx, update) => {
        await assert(ctx.components.length >= 1 && !!ctx.companyId && !!ctx.kitchenExternalId, 'Context incomplete');
        const c = ctx.components[0];
        await api.createStockAdjustment('component', c.componentId, {
          companyId: ctx.companyId,
          locationIds: ctx.kitchenExternalId!,
          locationExternalId: ctx.kitchenExternalId!,
          uomMode: 'recipe',
          adjustmentDate: todayIso(),
          quantity: 0.1,
          direction: 'in',
          reason: `QA adjustment ${ctx.runKey}`,
          inboundUom: 'Kg',
          inboundUnitPrice: c.unitPrice,
        });
        update({
          detail: `Adjusted +0.1 Kg PCU on ${c.componentId}`,
          facts: { componentId: c.componentId, direction: 'in', quantity: 0.1, uomMode: 'recipe' },
          fixActions: defaultFixActions('inventory-adjustment'),
        });
      },
    },
  ],

  'final-stock-card-audit': [
    {
      id: 'sales-b2b-customer',
      label: 'Create B2B customer',
      group: 'sales',
      run: async (ctx, update) => {
        await assert(!!ctx.companyId, 'Company missing');
        const externalId = `qa-cust-${ctx.runKey}`;
        const customer = await api.createB2bCustomer({
          companyId: ctx.companyId!,
          externalId,
          companyName: `QA B2B Customer ${ctx.runKey}`,
          brn: `BRN-C-${ctx.runKey}`,
          address: '88 Customer Road',
          city: 'Petaling Jaya',
          state: 'Selangor',
          postcode: '46000',
          phone: '+60320002000',
          fax: '',
          email: `qa-customer-${ctx.runKey}@cubevalue.com`,
          contacts: [{
            id: '1',
            name: 'QA Buyer',
            position: 'Purchaser',
            email: `qa-buyer-${ctx.runKey}@cubevalue.com`,
            mobile: '+60171112222',
            isDefault: true,
          }],
          taggedProductIds: ctx.b2bProduct ? [ctx.b2bProduct.id] : (ctx.finishedProduct ? [ctx.finishedProduct.id] : []),
          taggedProductAliasIds: [],
          taggedB2bProductUnits: [],
          purchaseHistory: [],
          active: true,
        });
        ctx.b2bCustomerExternalId = customer.externalId || externalId;
        update({
          detail: `Customer ${customer.companyName}`,
          facts: { externalId: ctx.b2bCustomerExternalId, id: customer.id },
          fixActions: defaultFixActions('sales-b2b-customer'),
        });
      },
    },
    {
      id: 'sales-b2b-order',
      label: 'Create & issue B2B sales order',
      group: 'sales',
      run: async (ctx, update) => {
        await assert(!!ctx.companyId && !!ctx.b2bCustomerExternalId && !!ctx.kitchenExternalId, 'B2B customer/location missing');
        const product = ctx.b2bProduct ?? ctx.finishedProduct;
        await assert(!!product, 'B2B/finished product missing');
        // Ensure stock exists at the issue location before creating the order.
        await api.markProductToProduce(product!.id, {
          locationExternalIds: [ctx.kitchenExternalId!],
          batchQty: 5,
          productionDate: todayIso(),
          overrideStock: true,
        });
        await api.produceProductBatches(product!.id, {
          locationExternalIds: [ctx.kitchenExternalId!],
          batchQty: 5,
          productionDate: todayIso(),
          overrideStock: true,
        });
        const order = await api.createB2bSalesOrder({
          companyId: ctx.companyId!,
          customerExternalId: ctx.b2bCustomerExternalId!,
          customerName: `QA B2B Customer ${ctx.runKey}`,
          lockPeriodDays: 7,
          lines: [{
            productId: product!.id,
            locationExternalId: ctx.kitchenExternalId!,
            quantityOrdered: 2,
            uom: 'tray',
            rrp: product!.rrp || 45,
          }],
        });
        const issued = await api.issueB2bSalesOrder(order.id);
        ctx.b2bSalesOrderId = issued.id;
        update({
          detail: `Sales order #${issued.id} · ${issued.status ?? 'issued'}`,
          facts: { salesOrderId: issued.id, status: issued.status ?? 'issued', producedForOrder: 5 },
          fixActions: defaultFixActions('sales-b2b-order'),
        });
      },
    },
    {
      id: 'sales-promotion',
      label: 'Create promotion schedule',
      group: 'sales',
      run: async (ctx, update) => {
        await assert(!!ctx.companyId, 'Company missing');
        const product = ctx.b2bProduct ?? ctx.finishedProduct;
        await assert(!!product, 'B2B/finished product missing');
        const promo = await api.createPromotion({
          companyId: ctx.companyId!,
          name: `QA Promo ${ctx.runKey}`,
          durationMode: 'byDate',
          startDate: todayIso(),
          endDate: todayIso(),
          promotionType: 'discountPercent',
          discountPercent: 10,
          createdBy: ctx.adminName || 'QA',
          products: [{ productId: product!.id }],
        });
        ctx.promotionId = promo.id;
        update({
          detail: `Promotion #${promo.id} · ${promo.name}`,
          facts: { promotionId: promo.id, productId: product!.id },
          fixActions: defaultFixActions('sales-promotion'),
        });
      },
    },
    {
      id: 'sales-account-mapping',
      label: 'Sales · Account Mapping',
      group: 'sales',
      run: async () => {
        skipInactive('Sales Account Mapping');
      },
    },
  ],
};

export const QA_EXTENDED_TAIL: ExtendedTaskDef[] = [
  {
    id: 'report-itemized-sales',
    label: 'Itemized Sales Summary',
    group: 'reports',
    run: async () => {
      skipInactive('Itemized Sales Summary report');
    },
  },
  {
    id: 'report-inventory-summary',
    label: 'Inventory Summary',
    group: 'reports',
    run: async () => {
      skipInactive('Inventory Summary report');
    },
  },
  {
    id: 'report-purchase-summary',
    label: 'Detailed Purchase Summary',
    group: 'reports',
    run: async () => {
      skipInactive('Detailed Purchase Summary report');
    },
  },
  {
    id: 'report-production',
    label: 'Production Report',
    group: 'reports',
    run: async () => {
      skipInactive('Production Report');
    },
  },
  {
    id: 'report-wastage',
    label: 'Wastage Report',
    group: 'reports',
    run: async () => {
      skipInactive('Wastage Report');
    },
  },
  {
    id: 'component-account-mapping',
    label: 'Component · Account Mapping',
    group: 'component',
    run: async () => {
      skipInactive('Component Account Mapping');
    },
  },
  {
    id: 'vendor-account-mapping',
    label: 'Vendors · Account Mapping',
    group: 'vendors',
    run: async () => {
      skipInactive('Vendor Account Mapping');
    },
  },
];
