import { api } from '../api';
import { DEMO_PASSWORD } from '../context/currentUserContext';
import { EMPTY_COMPONENT_DETAIL_CONFIG, serializeDetailConfig } from './componentForm';
import { calcCogsPercentValue, calcProductCogs } from './productForm';
import { allRmsTaskIds } from './userAccess';
import { hrApi } from '../modules/hr/api';
import { purgeQaOperationalData } from './devConsoleApi';

export type QaStatus = 'pending' | 'running' | 'pass' | 'fail' | 'warn';

export type QaIrregularity = {
  id: string;
  label: string;
  expected: string | number;
  actual: string | number;
  severity: 'fail' | 'warn';
};

export type QaFixAction = {
  id: string;
  label: string;
  description: string;
};

export type QaTaskResult = {
  id: string;
  label: string;
  status: QaStatus;
  detail?: string;
  startedAt?: string;
  finishedAt?: string;
  durationMs?: number;
  /** Structured verification facts for the detail panel */
  facts?: Record<string, string | number | boolean | null>;
  irregularities?: QaIrregularity[];
  /** Fix actions the user can execute from the issue panel */
  fixActions?: QaFixAction[];
};

export type QaRunResult = {
  tasks: QaTaskResult[];
  status: 'passed' | 'failed' | 'warning';
  summary: string;
  context: PowerQaContext;
};

export type PowerQaComponent = {
  index: number;
  name: string;
  componentId: string;
  ingredientId: number;
  vendorExternalId: string;
  vendorName: string;
  catalogId: string;
  catalogName: string;
  unitPrice: number;
};

export type PowerQaContext = {
  runKey: string;
  companyId?: number;
  companyName?: string;
  restaurantLocationId?: number;
  restaurantExternalId?: string;
  kitchenLocationId?: number;
  kitchenExternalId?: string;
  employeeId?: number;
  adminUserId?: number;
  adminEmail?: string;
  adminPassword?: string;
  adminName?: string;
  components: PowerQaComponent[];
  subProduct?: { id: number; productId: string; name: string; totalCost: number; yieldQuantity: number; yieldUom: string };
  finishedProduct?: { id: number; productId: string; name: string; totalCost: number; rrp: number; cogs: number; cogsPercent: number | null };
  purchaseOrders: { id: number; vendorName: string; deliveryDate: string; unitPrice: number; priceChangedAtReceive: boolean }[];
  cashPurchaseComponentId?: string;
};

type TaskUpdate = (patch: Partial<QaTaskResult>) => void;
type TaskFn = (ctx: PowerQaContext, update: TaskUpdate) => Promise<void>;

type TaskDef = {
  id: string;
  label: string;
  run: TaskFn;
};

const RESTAURANT = 'Restaurant / Cafe / Bistro / Kiosk';
const CENTRAL_KITCHEN = 'Central Kitchen / Warehouse (supply only)';
const COGS_TOLERANCE = 0.05;
const PCT_TOLERANCE = 0.15;

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

function daysAgoIso(days: number): string {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - days);
  return d.toISOString().slice(0, 10);
}

function approxEqual(a: number, b: number, tolerance = COGS_TOLERANCE): boolean {
  return Math.abs(a - b) <= tolerance;
}

async function assert(condition: boolean, message: string): Promise<void> {
  if (!condition) throw new Error(message);
}

function softFail(message: string): never {
  throw Object.assign(new Error(message), { soft: true });
}

function deliveryJson(orderUnit = 'Kg', orderQty = 1): string {
  return JSON.stringify({
    orderUnit,
    orderQty,
    packUnit: orderUnit,
    packQty: 1,
    unitUnit: '',
    unitQty: 0,
  });
}

function tagDetailJson(opts: {
  catalogId: string;
  vendorName: string;
  productName: string;
  price: number;
  locationExternalIds: string[];
  uom?: string;
}): string {
  const uom = opts.uom ?? 'Kg';
  return serializeDetailConfig({
    ...EMPTY_COMPONENT_DETAIL_CONFIG,
    taggedVendorProductIds: [opts.catalogId],
    vendorProductPrincipalQty: { [opts.catalogId]: '1' },
    vendorProductLossYield: { [opts.catalogId]: '0' },
    vendorProductComponentUom: { [opts.catalogId]: uom },
    vendorProductLocations: { [opts.catalogId]: opts.locationExternalIds },
    vendor: opts.vendorName,
    vendorProduct: opts.productName,
    deliveryUnitPrice: String(opts.price),
  });
}

function defaultFixActions(stepId: string): QaFixAction[] {
  return [
    { id: `retry:${stepId}`, label: 'Retry this step', description: 'Re-run only this failed step using current QA context.' },
    { id: 'rerun-full', label: 'Re-run full QA', description: 'Start a fresh power-user automation from step 1.' },
    { id: 'cleanup', label: 'Purge QA data (keep history)', description: 'Delete disposable QA company/records from DB. Dev Console history rows are kept.' },
  ];
}

const COMPONENT_NAMES = ['QA Flour', 'QA Butter', 'QA Yeast', 'QA Salt', 'QA Sugar'] as const;
const VENDOR_SUFFIX = ['Alpha', 'Bravo', 'Charlie', 'Delta', 'Echo'] as const;

async function createOneComponentBundle(
  ctx: PowerQaContext,
  index: number,
  locationExternalIds: string[],
): Promise<PowerQaComponent> {
  const suffix = `${ctx.runKey}-${index + 1}`;
  const name = `${COMPONENT_NAMES[index]} ${suffix}`;
  const vendorExternalId = `QA-V-${suffix}`;
  const vendorName = `QA Vendor ${VENDOR_SUFFIX[index]} ${ctx.runKey}`;
  const unitPrice = 4 + index; // 4..8
  const catalogName = `${COMPONENT_NAMES[index]} Pack`;

  const ingredient = await api.createIngredient({
    componentId: '',
    name,
    category: 'Dry Goods',
    group: 'QA Power',
    recipeUom: 'Kg',
    inventoryUom: 'Kg',
    lastPriceRecipe: unitPrice,
    lastPriceInventory: unitPrice,
    dailyUsage: 2,
    orderFreqDays: 7,
    storageJson: JSON.stringify(['Dry Store']),
    storageNote: 'QA automated component',
    detailConfigJson: serializeDetailConfig(EMPTY_COMPONENT_DETAIL_CONFIG),
    attachedProducts: 0,
    attachedVendors: 0,
    active: true,
    locationsJson: JSON.stringify(locationExternalIds),
  });

  await api.createVendor({
    externalId: vendorExternalId,
    name: vendorName,
    type: 'offline',
    brn: `QA${suffix}`,
    products: catalogName,
    city: 'Kuala Lumpur',
    state: 'Wilayah Persekutuan',
    address: `${index + 1} QA Industrial Park`,
    contactPerson: `${VENDOR_SUFFIX[index]} Contact`,
    contactPosition: 'Sales',
    mobile: `+6012${String(1000000 + index).slice(0, 7)}`,
    email: `qa.vendor.${index + 1}.${ctx.runKey.toLowerCase()}@bisync.dev`,
    productPolicyTag: index % 2 === 0 ? 'halal' : 'muslim-friendly',
  });

  const catalog = await api.createVendorProductCatalog({
    id: `QA-VP-${suffix}`,
    vendorExternalId,
    vendorName,
    productName: catalogName,
    group: 'QA Power',
    specification: `Automated catalog for ${name}`,
    deliveryPrice: unitPrice,
    deliveryJson: deliveryJson('Kg', 1),
    productPolicyTag: index % 2 === 0 ? 'halal' : 'muslim-friendly',
    active: true,
  });

  await api.engageVendor(vendorExternalId, {
    contacts: [{
      name: `${VENDOR_SUFFIX[index]} Contact`,
      position: 'Sales',
      mobile: `+6012${String(1000000 + index).slice(0, 7)}`,
      email: `qa.vendor.${index + 1}.${ctx.runKey.toLowerCase()}@bisync.dev`,
      isDefault: true,
    }],
  });

  const tagged = {
    ...ingredient,
    lastPriceRecipe: unitPrice,
    lastPriceInventory: unitPrice,
    attachedVendors: 1,
    detailConfigJson: tagDetailJson({
      catalogId: catalog.id,
      vendorName,
      productName: catalogName,
      price: unitPrice,
      locationExternalIds,
    }),
  };
  await api.updateIngredient(ingredient.id, tagged);

  return {
    index,
    name,
    componentId: ingredient.componentId,
    ingredientId: ingredient.id,
    vendorExternalId,
    vendorName,
    catalogId: catalog.id,
    catalogName,
    unitPrice,
  };
}

const TASKS: TaskDef[] = [
  {
    id: 'create-company',
    label: '1. Create new Company',
    run: async (ctx, update) => {
      const name = `QA Power Co ${ctx.runKey}`;
      const company = await api.createCompany({
        name,
        brn: `BRN${ctx.runKey}`,
        gstTin: `GST${ctx.runKey}`,
        countryCode: 'MY',
        addressLine1: '100 QA Boulevard',
        addressLine2: 'Level 2',
        city: 'Kuala Lumpur',
        stateProvince: 'Wilayah Persekutuan',
        postcode: '50000',
        phone: '+60 3-2000 1000',
        fax: '',
        email: `qa.power.${ctx.runKey.toLowerCase()}@bisync.dev`,
        active: true,
        businessTypesJson: JSON.stringify([RESTAURANT, CENTRAL_KITCHEN]),
        vendorPolicyTagsJson: JSON.stringify(['halal', 'muslim-friendly']),
        modulesJson: JSON.stringify(['RMS', 'POS', 'HRM', 'Accounting']),
      });
      ctx.companyId = company.id;
      ctx.companyName = company.name;
      update({
        detail: `Created ${company.name} (#${company.id})`,
        facts: {
          companyId: company.id,
          name: company.name,
          businessTypes: 'Restaurant + Central Kitchen',
          vendorPolicies: 'halal + muslim-friendly',
          modules: 'RMS, POS, HRM, Accounting',
        },
        fixActions: defaultFixActions('create-company'),
      });
    },
  },
  {
    id: 'create-locations',
    label: '2. Create 2 Locations (Restaurant Halal + Central Kitchen Muslim Friendly)',
    run: async (ctx, update) => {
      await assert(!!ctx.companyId, 'Company missing');
      const restaurant = await api.createLocationConfig({
        companyId: ctx.companyId!,
        name: `QA Restaurant ${ctx.runKey}`,
        addressLine1: '12 Food Street',
        addressLine2: '',
        city: 'Kuala Lumpur',
        stateProvince: 'Wilayah Persekutuan',
        postcode: '50000',
        principalContactUserId: null,
        businessTypesJson: JSON.stringify([RESTAURANT]),
        vendorPolicyTagsJson: JSON.stringify(['halal']),
        modulesJson: JSON.stringify(['RMS', 'POS', 'HRM']),
      });
      const kitchen = await api.createLocationConfig({
        companyId: ctx.companyId!,
        name: `QA Central Kitchen ${ctx.runKey}`,
        addressLine1: '88 Supply Road',
        addressLine2: '',
        city: 'Shah Alam',
        stateProvince: 'Selangor',
        postcode: '40000',
        principalContactUserId: null,
        businessTypesJson: JSON.stringify([CENTRAL_KITCHEN]),
        vendorPolicyTagsJson: JSON.stringify(['muslim-friendly']),
        modulesJson: JSON.stringify(['RMS', 'POS', 'HRM']),
      });
      ctx.restaurantLocationId = restaurant.id;
      ctx.restaurantExternalId = restaurant.externalId;
      ctx.kitchenLocationId = kitchen.id;
      ctx.kitchenExternalId = kitchen.externalId;
      update({
        detail: `${restaurant.name} (halal) · ${kitchen.name} (muslim-friendly)`,
        facts: {
          restaurant: restaurant.externalId,
          restaurantPolicy: 'halal',
          kitchen: kitchen.externalId,
          kitchenPolicy: 'muslim-friendly',
        },
        fixActions: defaultFixActions('create-locations'),
      });
    },
  },
  {
    id: 'create-system-admin',
    label: '3. Create System Admin user with all rights',
    run: async (ctx, update) => {
      await assert(!!ctx.companyId && !!ctx.restaurantLocationId && !!ctx.kitchenLocationId, 'Org context missing');
      const departments = await hrApi.org.departments.list();
      const department = departments.find(d => d.name === 'People')
        ?? departments.find(d => d.name === 'Operations')
        ?? departments[0];
      await assert(!!department, 'No HR department available — seed org tree first');
      const email = `qa.admin.${ctx.runKey.toLowerCase()}@bisync.dev`;
      const name = `QA System Admin ${ctx.runKey}`;
      const mobile = `+6012${ctx.runKey.slice(-7)}`;
      // Employee create syncs a linked AppUser — grant System Admin rights via update (or create if missing).
      const employee = await hrApi.employees.create({
        name,
        email,
        mobile,
        department: department.name,
        departmentId: department.id,
        divisionId: department.divisionId,
        position: 'System Admin',
        joinDate: todayIso(),
        fingerprintEnrolled: false,
        faceRecognitionEnrolled: false,
        isShiftEmployee: false,
        posEnabled: true,
        bisyncEnabled: true,
        active: true,
        companyId: ctx.companyId!,
        workingHoursPerDay: 8,
      });
      const accessJson = JSON.stringify({
        modules: ['RMS', 'POS', 'HRM', 'Accounting'],
        superAdmin: true,
        rms: {
          enabled: true,
          tasks: Object.fromEntries(allRmsTaskIds().map(id => [id, true])),
        },
      });
      const userPayload = {
        employeeId: employee.id,
        fullName: name,
        email,
        role: 'System Admin',
        phone: mobile,
        active: true,
        companyId: ctx.companyId!,
        locationIdsJson: JSON.stringify([ctx.restaurantLocationId, ctx.kitchenLocationId]),
        accessJson,
      };
      const existing = (await api.users()).find(u => u.employeeId === employee.id || u.email === email);
      const user = existing
        ? await api.updateUser(existing.id, userPayload)
        : await api.createUser(userPayload);
      ctx.employeeId = employee.id;
      ctx.adminUserId = user.id;
      ctx.adminEmail = email;
      ctx.adminPassword = DEMO_PASSWORD;
      ctx.adminName = name;
      update({
        detail: `${name} · ${email} (default password ${DEMO_PASSWORD})`,
        facts: {
          userId: user.id,
          employeeId: employee.id,
          email,
          superAdmin: true,
          rmsTasks: allRmsTaskIds().length,
        },
        fixActions: defaultFixActions('create-system-admin'),
      });
    },
  },
  {
    id: 'login-system-admin',
    label: '4. Log in with System Admin credentials',
    run: async (ctx, update) => {
      await assert(!!ctx.adminEmail && !!ctx.adminPassword, 'Admin credentials missing');
      const user = await api.login(ctx.adminEmail!, ctx.adminPassword!);
      await assert(user.id === ctx.adminUserId || user.email === ctx.adminEmail, 'Logged-in user does not match QA admin');
      update({
        detail: `Authenticated as ${user.fullName} (${user.email})`,
        facts: { userId: user.id, email: user.email, role: user.role },
        fixActions: defaultFixActions('login-system-admin'),
      });
    },
  },
  {
    id: 'create-first-component-vendor',
    label: '5–7. Add Component, Vendor, Vendor Product, Engage & Tag (seed #1)',
    run: async (ctx, update) => {
      await assert(!!ctx.restaurantExternalId && !!ctx.kitchenExternalId, 'Locations missing');
      const locs = [ctx.restaurantExternalId!, ctx.kitchenExternalId!];
      const bundle = await createOneComponentBundle(ctx, 0, locs);
      ctx.components = [bundle];
      update({
        detail: `${bundle.name} ← ${bundle.vendorName} / ${bundle.catalogName}`,
        facts: {
          componentId: bundle.componentId,
          vendor: bundle.vendorExternalId,
          catalogId: bundle.catalogId,
          engagedAndTagged: true,
          unitPrice: bundle.unitPrice,
        },
        fixActions: defaultFixActions('create-first-component-vendor'),
      });
    },
  },
  {
    id: 'create-five-component-vendors',
    label: '8. Create 5 Components + Vendors + Vendor Products (engaged & tagged)',
    run: async (ctx, update) => {
      await assert(!!ctx.restaurantExternalId && !!ctx.kitchenExternalId, 'Locations missing');
      const locs = [ctx.restaurantExternalId!, ctx.kitchenExternalId!];
      const bundles: PowerQaComponent[] = [];
      for (let i = 0; i < 5; i++) {
        // Reuse #1 if already created in prior step
        if (i === 0 && ctx.components[0]) {
          bundles.push(ctx.components[0]);
          continue;
        }
        bundles.push(await createOneComponentBundle(ctx, i, locs));
        update({ detail: `Created ${i + 1}/5 component-vendor bundles…` });
      }
      ctx.components = bundles;
      update({
        detail: `5 components + 5 vendors + 5 catalog products ready`,
        facts: {
          components: bundles.map(b => b.componentId).join(', '),
          vendors: bundles.map(b => b.vendorExternalId).join(', '),
        },
        fixActions: defaultFixActions('create-five-component-vendors'),
      });
    },
  },
  {
    id: 'create-sub-product',
    label: '9. Create Sub-Product using 3 components',
    run: async (ctx, update) => {
      await assert(ctx.components.length >= 3 && !!ctx.companyId && !!ctx.kitchenExternalId, 'Need ≥3 components');
      const used = ctx.components.slice(0, 3);
      const items = used.map(c => ({
        componentId: c.componentId,
        componentName: c.name,
        componentUom: 'Kg',
        componentUomPrice: c.unitPrice,
        quantity: 1,
      }));
      const expectedCost = used.reduce((s, c) => s + c.unitPrice, 0);
      const product = await api.createProduct({
        name: `QA Dough Sub ${ctx.runKey}`,
        category: 'Bakery',
        group: 'QA Power',
        isSubProduct: true,
        b2cEnabled: false,
        b2bEnabled: false,
        rrp: 0,
        yieldQuantity: 5,
        yieldUom: 'Kg',
        expiryPeriodDays: 3,
        companyId: ctx.companyId,
        locationExternalIds: [ctx.kitchenExternalId!, ctx.restaurantExternalId!],
        items,
        packagingItems: [],
        aliases: [],
      });
      const irregularities: QaIrregularity[] = [];
      if (!approxEqual(product.totalCost, expectedCost)) {
        irregularities.push({
          id: 'sub-cogs',
          label: 'Sub-product totalCost vs BOM',
          expected: expectedCost,
          actual: product.totalCost,
          severity: 'fail',
        });
      }
      ctx.subProduct = {
        id: product.id,
        productId: product.productId,
        name: product.name,
        totalCost: product.totalCost,
        yieldQuantity: product.yieldQuantity,
        yieldUom: product.yieldUom,
      };
      if (irregularities.some(i => i.severity === 'fail')) {
        update({ irregularities, facts: { productId: product.productId, totalCost: product.totalCost, expectedCost }, fixActions: defaultFixActions('create-sub-product') });
        throw new Error(`Sub-product COGS irregular: expected ${expectedCost}, got ${product.totalCost}`);
      }
      update({
        detail: `${product.name} · totalCost=${product.totalCost}`,
        facts: { productId: product.productId, totalCost: product.totalCost, expectedCost, components: used.map(c => c.componentId).join(', ') },
        irregularities,
        fixActions: defaultFixActions('create-sub-product'),
      });
    },
  },
  {
    id: 'create-finished-product',
    label: '10. Create Product utilizing all 5 components (incl. sub-product)',
    run: async (ctx, update) => {
      await assert(ctx.components.length === 5 && !!ctx.subProduct && !!ctx.companyId, 'Need 5 components + sub-product');
      // Use components 3,4 (index 3,4) as direct BOM + sub-product (which embeds 0,1,2) + also include all 5:
      // User asked: product utilizing all 5 components including using one sub-product.
      // Sub uses 0,1,2. Finished product uses sub + components 3 and 4, and we also add refs... 
      // To "utilize all 5": sub covers 0-2, lines for 3 and 4. That's all 5.
      const c3 = ctx.components[3];
      const c4 = ctx.components[4];
      const sub = ctx.subProduct!;
      const subBatchCogs = calcProductCogs(sub.totalCost, 0, { isSubProduct: true, b2bEnabled: false, b2cEnabled: false });
      const items = [
        {
          componentId: sub.productId,
          componentName: sub.name,
          componentUom: sub.yieldUom,
          componentUomPrice: subBatchCogs,
          quantity: 1,
        },
        {
          componentId: c3.componentId,
          componentName: c3.name,
          componentUom: 'Kg',
          componentUomPrice: c3.unitPrice,
          quantity: 1,
        },
        {
          componentId: c4.componentId,
          componentName: c4.name,
          componentUom: 'Kg',
          componentUomPrice: c4.unitPrice,
          quantity: 1,
        },
      ];
      const expectedCost = subBatchCogs + c3.unitPrice + c4.unitPrice;
      const product = await api.createProduct({
        name: `QA Bun Finished ${ctx.runKey}`,
        category: 'Bakery',
        group: 'QA Power',
        isSubProduct: false,
        b2cEnabled: true,
        b2bEnabled: false,
        rrp: 0,
        yieldQuantity: 1,
        yieldUom: 'pcs',
        expiryPeriodDays: 2,
        companyId: ctx.companyId,
        locationExternalIds: [ctx.restaurantExternalId!, ctx.kitchenExternalId!],
        items,
        packagingItems: [],
        aliases: [],
        posEnabled: true,
      });
      ctx.finishedProduct = {
        id: product.id,
        productId: product.productId,
        name: product.name,
        totalCost: product.totalCost,
        rrp: product.rrp,
        cogs: product.totalCost,
        cogsPercent: null,
      };
      const irregularities: QaIrregularity[] = [];
      if (!approxEqual(product.totalCost, expectedCost, 0.1)) {
        irregularities.push({
          id: 'finished-cogs',
          label: 'Finished product totalCost vs BOM',
          expected: Number(expectedCost.toFixed(4)),
          actual: product.totalCost,
          severity: 'warn',
        });
      }
      update({
        detail: `${product.name} (#${product.id}) totalCost=${product.totalCost}`,
        facts: {
          productId: product.productId,
          totalCost: product.totalCost,
          expectedCost: Number(expectedCost.toFixed(4)),
          usesSubProduct: sub.productId,
          directComponents: `${c3.componentId}, ${c4.componentId}`,
        },
        irregularities,
        fixActions: defaultFixActions('create-finished-product'),
      });
      if (irregularities.some(i => i.severity === 'fail')) {
        throw new Error('Finished product COGS check failed');
      }
    },
  },
  {
    id: 'set-rrp-check-cogs',
    label: '11. Add RRP and verify COGS / COGS%',
    run: async (ctx, update) => {
      await assert(!!ctx.finishedProduct, 'Finished product missing');
      const current = await api.product(ctx.finishedProduct!.id);
      const rrp = Math.max(20, Math.ceil(current.totalCost * 2.5));
      const updated = await api.updateProduct(current.id, {
        name: current.name,
        category: current.category,
        group: current.group,
        isSubProduct: false,
        b2cEnabled: true,
        b2bEnabled: false,
        rrp,
        yieldQuantity: current.yieldQuantity,
        yieldUom: current.yieldUom,
        companyId: current.companyId,
        locationExternalIds: current.locationExternalIds ?? [ctx.restaurantExternalId!],
        items: current.items.map(i => ({
          componentId: i.componentId,
          componentName: i.componentName,
          componentUom: i.componentUom,
          componentUomPrice: i.componentUomPrice,
          quantity: i.quantity,
        })),
        packagingItems: (current.packagingItems ?? []).map(i => ({
          componentId: i.componentId,
          componentName: i.componentName,
          componentUom: i.componentUom,
          componentUomPrice: i.componentUomPrice,
          quantity: i.quantity,
        })),
        aliases: [],
        posEnabled: true,
      });
      const cogs = calcProductCogs(updated.totalCost, updated.packagingCost ?? 0, {
        isSubProduct: false,
        b2cEnabled: true,
        b2bEnabled: false,
      });
      const cogsPct = calcCogsPercentValue(cogs, rrp);
      const expectedPct = (cogs / rrp) * 100;
      const irregularities: QaIrregularity[] = [];
      if (cogsPct == null) {
        irregularities.push({ id: 'cogs-pct-null', label: 'COGS%', expected: expectedPct, actual: 'null', severity: 'fail' });
      } else if (!approxEqual(cogsPct, expectedPct, PCT_TOLERANCE)) {
        irregularities.push({ id: 'cogs-pct', label: 'COGS%', expected: Number(expectedPct.toFixed(2)), actual: Number(cogsPct.toFixed(2)), severity: 'fail' });
      }
      if (rrp <= cogs) {
        irregularities.push({ id: 'rrp-vs-cogs', label: 'RRP should exceed COGS', expected: `> ${cogs}`, actual: rrp, severity: 'fail' });
      }
      ctx.finishedProduct = {
        ...ctx.finishedProduct!,
        totalCost: updated.totalCost,
        rrp,
        cogs,
        cogsPercent: cogsPct,
      };
      update({
        detail: `RRP=${rrp} · COGS=${cogs.toFixed(2)} · COGS%=${cogsPct?.toFixed(2) ?? 'n/a'}%`,
        facts: { rrp, cogs, cogsPercent: cogsPct, totalCost: updated.totalCost },
        irregularities,
        fixActions: defaultFixActions('set-rrp-check-cogs'),
      });
      if (irregularities.some(i => i.severity === 'fail')) {
        throw new Error(`COGS/RRP irregular: ${irregularities.map(i => i.label).join(', ')}`);
      }
    },
  },
  {
    id: 'create-purchase-orders',
    label: '12. Open POs to all test vendors (5 POs each, staggered dates/prices)',
    run: async (ctx, update) => {
      await assert(ctx.components.length === 5 && !!ctx.companyId && !!ctx.kitchenExternalId, 'Context incomplete');
      const createdMeta: PowerQaContext['purchaseOrders'] = [];
      for (const bundle of ctx.components) {
        const orders = Array.from({ length: 5 }, (_, poIndex) => {
          const deliveryDate = daysAgoIso(10 - poIndex * 2); // different dates
          const unitPrice = bundle.unitPrice + poIndex * 0.5; // different prices
          return {
            vendorName: bundle.vendorName,
            documentType: 'PO' as const,
            orderDate: daysAgoIso(12 - poIndex),
            deliveryDate,
            status: 'Pending Approval',
            items: [{
              componentId: bundle.componentId,
              componentName: bundle.name,
              vendorProductId: bundle.catalogId,
              name: bundle.catalogName,
              quantity: 10,
              unitPrice,
              unit: 'Kg',
              componentUom: 'Kg',
              deliveryPackage: '1 Kg',
            }],
          };
        });
        const created = await api.createPurchaseOrders({
          companyId: ctx.companyId,
          locationExternalIds: [ctx.kitchenExternalId!],
          initiatedBy: ctx.adminName ?? 'QA System Admin',
          orders,
        });
        for (let i = 0; i < created.length; i++) {
          const order = created[i];
          const unitPrice = orders[i].items[0].unitPrice;
          createdMeta.push({
            id: order.id,
            vendorName: bundle.vendorName,
            deliveryDate: orders[i].deliveryDate!,
            unitPrice,
            priceChangedAtReceive: false,
          });
        }
        update({ detail: `POs created for ${bundle.vendorName} (${created.length})…` });
      }
      ctx.purchaseOrders = createdMeta;
      await assert(createdMeta.length === 25, `Expected 25 POs, got ${createdMeta.length}`);
      update({
        detail: `Created ${createdMeta.length} POs (5 × 5 vendors)`,
        facts: { poCount: createdMeta.length, vendors: ctx.components.length },
        fixActions: defaultFixActions('create-purchase-orders'),
      });
    },
  },
  {
    id: 'vendor-accept-pos',
    label: '13. Vendors accept POs (1 simulated price change before goods-in)',
    run: async (ctx, update) => {
      await assert(ctx.purchaseOrders.length > 0, 'No POs');
      let accepted = 0;
      const priceChangePoId = ctx.purchaseOrders[0]?.id;
      for (const meta of ctx.purchaseOrders) {
        const approved = await api.approvePurchaseOrder(meta.id, ctx.adminName ?? 'QA System Admin');
        const withToken = approved.vendorShareToken
          ? approved
          : await api.ensureVendorShareToken(meta.id);
        await assert(!!withToken.vendorShareToken, `Missing share token for PO #${meta.id}`);
        await api.acceptVendorOrder(withToken.vendorShareToken!, meta.vendorName);
        if (meta.id === priceChangePoId) {
          meta.priceChangedAtReceive = true;
          meta.unitPrice = Number((meta.unitPrice + 1.25).toFixed(2));
        }
        accepted += 1;
      }
      update({
        detail: `Accepted ${accepted} POs · price-change simulation on PO #${priceChangePoId} (+1.25 at receive)`,
        facts: {
          accepted,
          priceChangePoId: priceChangePoId ?? null,
          note: 'Vendor portal cannot edit price; QA applies changed unitPrice at receive for one PO.',
        },
        fixActions: defaultFixActions('vendor-accept-pos'),
      });
    },
  },
  {
    id: 'receive-all-pos',
    label: '14. Receive all vendor products',
    run: async (ctx, update) => {
      await assert(ctx.purchaseOrders.length > 0, 'No POs');
      let received = 0;
      for (const meta of ctx.purchaseOrders) {
        const order = await api.purchaseOrder(meta.id);
        const items = (order.items ?? []).map(item => ({
          itemId: item.id,
          quantity: item.quantity,
          unitPrice: meta.priceChangedAtReceive ? meta.unitPrice : item.unitPrice,
          componentUom: item.componentUom ?? 'Kg',
          halalCertNo: 'QA-HALAL-001',
        }));
        await api.receivePurchaseOrder(meta.id, { items });
        await api.reconcilePurchaseOrder(meta.id, { items });
        received += 1;
        if (received % 5 === 0) update({ detail: `Received ${received}/${ctx.purchaseOrders.length}…` });
      }
      update({
        detail: `Received + reconciled ${received} POs`,
        facts: { received },
        fixActions: defaultFixActions('receive-all-pos'),
      });
    },
  },
  {
    id: 'verify-stock-after-po',
    label: '15. Verify STOCK CARD after PO receipts',
    run: async (ctx, update) => {
      await assert(ctx.components.length === 5 && !!ctx.companyId && !!ctx.kitchenExternalId, 'Context incomplete');
      const irregularities: QaIrregularity[] = [];
      const facts: Record<string, string | number | boolean | null> = {};
      for (const bundle of ctx.components) {
        // 5 POs × 10 Kg = 50 Kg expected
        const detail = await api.stockCardDetail('component', bundle.componentId, ctx.companyId, [ctx.kitchenExternalId!]);
        facts[bundle.componentId] = detail.onHandQty;
        if (!approxEqual(detail.onHandQty, 50, 0.2)) {
          irregularities.push({
            id: `onhand-${bundle.componentId}`,
            label: `${bundle.name} on-hand`,
            expected: 50,
            actual: detail.onHandQty,
            severity: 'fail',
          });
        }
        if ((detail.onHandLayers?.length ?? 0) < 2) {
          irregularities.push({
            id: `layers-${bundle.componentId}`,
            label: `${bundle.name} FIFO layers`,
            expected: '≥2 layers',
            actual: detail.onHandLayers?.length ?? 0,
            severity: 'warn',
          });
        }
      }
      update({
        detail: irregularities.length ? `${irregularities.length} stock irregularities` : 'All 5 components ~50 Kg on-hand',
        facts,
        irregularities,
        fixActions: defaultFixActions('verify-stock-after-po'),
      });
      if (irregularities.some(i => i.severity === 'fail')) {
        throw new Error(`Stock card after PO failed: ${irregularities.filter(i => i.severity === 'fail').map(i => i.label).join('; ')}`);
      }
      if (irregularities.some(i => i.severity === 'warn')) {
        softFail(`Stock layers incomplete: ${irregularities.filter(i => i.severity === 'warn').map(i => i.label).join('; ')}`);
      }
    },
  },
  {
    id: 'cash-purchase',
    label: '16. Cash-purchase one component',
    run: async (ctx, update) => {
      await assert(ctx.components.length > 0 && !!ctx.companyId && !!ctx.kitchenExternalId, 'Context incomplete');
      const bundle = ctx.components[0];
      ctx.cashPurchaseComponentId = bundle.componentId;
      await api.createCashPurchase({
        datePurchased: todayIso(),
        storeName: 'QA Cash Mart',
        componentId: bundle.componentId,
        componentName: bundle.name,
        storeProductName: `${bundle.name} Cash Bag`,
        deliveryUnit: 'Kg',
        deliveryPrice: bundle.unitPrice + 3,
        quantity: 7,
        componentUom: 'Kg',
        companyId: ctx.companyId,
        locationExternalIds: [ctx.kitchenExternalId!],
        receiptNumber: `CASH-${ctx.runKey}`,
      });
      update({
        detail: `Cash purchased 7 Kg of ${bundle.name} @ ${bundle.unitPrice + 3}`,
        facts: { componentId: bundle.componentId, qty: 7, price: bundle.unitPrice + 3 },
        fixActions: defaultFixActions('cash-purchase'),
      });
    },
  },
  {
    id: 'verify-stock-after-cash',
    label: '17. Verify cash purchase on STOCK CARD',
    run: async (ctx, update) => {
      await assert(!!ctx.cashPurchaseComponentId && !!ctx.companyId && !!ctx.kitchenExternalId, 'Cash purchase context missing');
      const detail = await api.stockCardDetail('component', ctx.cashPurchaseComponentId!, ctx.companyId, [ctx.kitchenExternalId!]);
      const irregularities: QaIrregularity[] = [];
      if (!approxEqual(detail.onHandQty, 57, 0.2)) {
        irregularities.push({
          id: 'cash-onhand',
          label: 'On-hand after cash purchase',
          expected: 57,
          actual: detail.onHandQty,
          severity: 'fail',
        });
      }
      update({
        detail: `onHand=${detail.onHandQty} (expect ~57)`,
        facts: { onHandQty: detail.onHandQty, layers: detail.onHandLayers?.length ?? 0 },
        irregularities,
        fixActions: defaultFixActions('verify-stock-after-cash'),
      });
      if (irregularities.some(i => i.severity === 'fail')) {
        throw new Error(`Cash purchase not reflected correctly (on-hand ${detail.onHandQty})`);
      }
    },
  },
  {
    id: 'produce-and-pos-sales',
    label: '18. Produce product (2 dated batches) + POS sales for FIFO',
    run: async (ctx, update) => {
      await assert(!!ctx.finishedProduct && !!ctx.restaurantExternalId && !!ctx.kitchenExternalId, 'Product/location missing');
      const productId = ctx.finishedProduct!.id;
      const loc = ctx.kitchenExternalId!;

      // Produce two batches on different dates to create product FIFO layers
      await api.markProductToProduce(productId, {
        locationExternalIds: [loc],
        batchQty: 8,
        productionDate: daysAgoIso(5),
      });
      await api.produceProductBatches(productId, {
        locationExternalIds: [loc],
        batchQty: 8,
        productionDate: daysAgoIso(5),
        overrideStock: true,
      });
      await api.markProductToProduce(productId, {
        locationExternalIds: [loc],
        batchQty: 6,
        productionDate: daysAgoIso(2),
      });
      await api.produceProductBatches(productId, {
        locationExternalIds: [loc],
        batchQty: 6,
        productionDate: daysAgoIso(2),
        overrideStock: true,
      });

      const beforeSale = await api.stockCardDetail('product', String(productId), ctx.companyId, [loc]);
      await assert(beforeSale.onHandQty >= 10, `Need product stock for sales, on-hand=${beforeSale.onHandQty}`);

      await api.recordProductSale(productId, {
        locationExternalIds: [loc],
        quantitySold: 5,
        salesChannel: 'pos',
      });
      await api.recordProductSale(productId, {
        locationExternalIds: [loc],
        quantitySold: 3,
        salesChannel: 'pos',
      });

      update({
        detail: `Produced 8+6 · sold 5+3 POS · pre-sale onHand=${beforeSale.onHandQty}`,
        facts: {
          batch1: '8 @ daysAgo 5',
          batch2: '6 @ daysAgo 2',
          sold: 8,
          preSaleOnHand: beforeSale.onHandQty,
          layersBeforeSale: beforeSale.onHandLayers?.length ?? 0,
        },
        fixActions: defaultFixActions('produce-and-pos-sales'),
      });
    },
  },
  {
    id: 'final-stock-card-audit',
    label: '19. Final STOCK CARD audit (PO + cash + produce + POS / FIFO)',
    run: async (ctx, update) => {
      await assert(!!ctx.finishedProduct && !!ctx.companyId && !!ctx.kitchenExternalId, 'Context incomplete');
      const loc = [ctx.kitchenExternalId!];
      const irregularities: QaIrregularity[] = [];
      const facts: Record<string, string | number | boolean | null> = {};

      const productDetail = await api.stockCardDetail('product', String(ctx.finishedProduct!.id), ctx.companyId, loc);
      facts.productOnHand = productDetail.onHandQty;
      facts.productLayers = productDetail.onHandLayers?.length ?? 0;
      // 14 produced - 8 sold = 6 expected (if override produce worked from components)
      if (!approxEqual(productDetail.onHandQty, 6, 0.2)) {
        irregularities.push({
          id: 'final-product-onhand',
          label: 'Finished product on-hand after sales',
          expected: 6,
          actual: productDetail.onHandQty,
          severity: productDetail.onHandQty > 0 ? 'warn' : 'fail',
        });
      }

      for (const bundle of ctx.components) {
        const d = await api.stockCardDetail('component', bundle.componentId, ctx.companyId, loc);
        facts[`comp:${bundle.componentId}`] = d.onHandQty;
        if (d.onHandQty < 0) {
          irregularities.push({
            id: `neg-${bundle.componentId}`,
            label: `${bundle.name} negative stock`,
            expected: '≥ 0',
            actual: d.onHandQty,
            severity: 'fail',
          });
        }
      }

      if (ctx.cashPurchaseComponentId) {
        const cash = await api.stockCardDetail('component', ctx.cashPurchaseComponentId, ctx.companyId, loc);
        facts.cashComponentOnHand = cash.onHandQty;
      }

      update({
        detail: irregularities.length
          ? `Audit found ${irregularities.length} irregularity(ies)`
          : `Audit OK · product onHand=${productDetail.onHandQty}`,
        facts,
        irregularities,
        fixActions: defaultFixActions('final-stock-card-audit'),
      });

      if (irregularities.some(i => i.severity === 'fail')) {
        throw new Error(`Final stock audit failed: ${irregularities.filter(i => i.severity === 'fail').map(i => `${i.label} (exp ${i.expected}, got ${i.actual})`).join('; ')}`);
      }
      if (irregularities.some(i => i.severity === 'warn')) {
        softFail(`Final stock audit warnings: ${irregularities.filter(i => i.severity === 'warn').map(i => i.label).join('; ')}`);
      }
    },
  },
];

export function createPendingTasks(): QaTaskResult[] {
  return TASKS.map(t => ({
    id: t.id,
    label: t.label,
    status: 'pending' as const,
    fixActions: defaultFixActions(t.id),
  }));
}

export function getPowerQaTaskDefs(): { id: string; label: string }[] {
  return TASKS.map(t => ({ id: t.id, label: t.label }));
}

export async function runAutomatedQa(
  _triggeredBy: string,
  onUpdate: (tasks: QaTaskResult[]) => void,
  options?: { startFromId?: string; existingContext?: PowerQaContext },
): Promise<QaRunResult> {
  const runKey = options?.existingContext?.runKey
    ?? new Date().toISOString().replace(/[-:.TZ]/g, '').slice(0, 14);
  const ctx: PowerQaContext = options?.existingContext
    ? { ...options.existingContext, components: [...options.existingContext.components], purchaseOrders: [...options.existingContext.purchaseOrders] }
    : { runKey, components: [], purchaseOrders: [] };

  const tasks = createPendingTasks();
  const startIdx = options?.startFromId
    ? Math.max(0, TASKS.findIndex(t => t.id === options.startFromId))
    : 0;

  // Preserve prior pass results when retrying from a step
  if (options?.startFromId && startIdx > 0) {
    for (let i = 0; i < startIdx; i++) {
      tasks[i] = { ...tasks[i], status: 'pass', detail: 'Skipped (already completed in this session context)' };
    }
  }
  onUpdate([...tasks]);

  for (let i = startIdx; i < TASKS.length; i++) {
    const def = TASKS[i];
    const started = Date.now();
    tasks[i] = { ...tasks[i], status: 'running', startedAt: new Date().toISOString(), irregularities: [], facts: {} };
    onUpdate([...tasks]);

    try {
      await def.run(ctx, patch => {
        tasks[i] = { ...tasks[i], ...patch };
        onUpdate([...tasks]);
      });
      tasks[i] = {
        ...tasks[i],
        status: 'pass',
        finishedAt: new Date().toISOString(),
        durationMs: Date.now() - started,
        fixActions: defaultFixActions(def.id),
      };
    } catch (err) {
      const soft = err && typeof err === 'object' && 'soft' in err && (err as { soft?: boolean }).soft;
      const message = err instanceof Error ? err.message : String(err);
      tasks[i] = {
        ...tasks[i],
        status: soft ? 'warn' : 'fail',
        detail: message,
        finishedAt: new Date().toISOString(),
        durationMs: Date.now() - started,
        fixActions: defaultFixActions(def.id),
      };
      onUpdate([...tasks]);
      if (!soft) break;
      continue;
    }
    onUpdate([...tasks]);
  }

  const hasFail = tasks.some(t => t.status === 'fail');
  const hasWarn = tasks.some(t => t.status === 'warn');
  const pendingLeft = tasks.some(t => t.status === 'pending');
  const status = hasFail || pendingLeft ? 'failed' : hasWarn ? 'warning' : 'passed';
  const passed = tasks.filter(t => t.status === 'pass').length;
  const failed = tasks.filter(t => t.status === 'fail').length;
  const warned = tasks.filter(t => t.status === 'warn').length;
  const summary = `${status.toUpperCase()}: ${passed} pass · ${failed} fail · ${warned} warn · ${ctx.companyName ?? 'n/a'}`;

  return { tasks, status, summary, context: ctx };
}

export async function executeQaFix(
  actionId: string,
  ctx: PowerQaContext,
  onUpdate: (tasks: QaTaskResult[]) => void,
): Promise<QaRunResult | { message: string }> {
  if (actionId === 'cleanup') {
    const result = await purgeQaOperationalData({
      companyIds: ctx.companyId != null ? [ctx.companyId] : undefined,
      purgeAllQaPower: ctx.companyId == null,
    });
    return {
      message: `Purged QA data · companies ${result.companiesDeleted} · kept ${result.historyRowsKept} history row(s). ${result.note}`,
    };
  }
  if (actionId === 'rerun-full') {
    return runAutomatedQa('fix-rerun', onUpdate);
  }
  if (actionId.startsWith('retry:')) {
    const stepId = actionId.slice('retry:'.length);
    return runAutomatedQa('fix-retry', onUpdate, { startFromId: stepId, existingContext: ctx });
  }
  return { message: `Unknown fix action: ${actionId}` };
}
