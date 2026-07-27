import { api, setApiTenantCompanyId, type AppUser } from '../api';
import { DEMO_PASSWORD } from '../context/currentUserContext';
import { EMPTY_COMPONENT_DETAIL_CONFIG, serializeDetailConfig } from './componentForm';
import { CURRENT_EULA_VERSION } from './eula';
import { CURRENT_PRIVACY_POLICY_VERSION } from './privacyPolicy';
import { CURRENT_DPA_VERSION } from './dpa';
import { calcCogsPercentValue, calcProductCogs } from './productForm';
import { priceLocationLine, sumPricedLines } from './subscriptionPricing';
import { allRmsTaskIds } from './userAccess';
import { purgeQaOperationalData } from './devConsoleApi';
import { QA_GROUP_LABEL, type QaGroupId } from './devQaGroups';
import { QA_EXTENDED_INSERTS, QA_EXTENDED_TAIL } from './devQaExtendedSteps';

/** Fixed platform operator used for every Automated QA run (never disposable). */
export const QA_OPERATOR_EMAIL = 'ms@cubevalue.com';
const QA_OPERATOR_PASSWORDS = [DEMO_PASSWORD, '12345678'] as const;
const QA_OPERATOR_MOBILE = '+60170000001';

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
  /** Product area group (Setup, Component, Operation · Order, …). */
  group?: string;
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
  /** Registered owner (steps A–E) before System Admin exists. */
  ownerUserId?: number;
  ownerEmail?: string;
  ownerPassword?: string;
  ownerName?: string;
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
  /** Extra HR employee created in step G (beyond System Admin). */
  hrStaffEmployeeId?: number;
  hrStaffEmail?: string;
  hrStaffName?: string;
  provisionedDatabaseName?: string;
  cogsAuditHistoryRunId?: string;
  components: PowerQaComponent[];
  subProduct?: { id: number; productId: string; name: string; totalCost: number; yieldQuantity: number; yieldUom: string };
  finishedProduct?: { id: number; productId: string; name: string; totalCost: number; rrp: number; cogs: number; cogsPercent: number | null };
  purchaseOrders: { id: number; vendorName: string; deliveryDate: string; unitPrice: number; priceChangedAtReceive: boolean }[];
  cashPurchaseComponentId?: string;
  componentTemplateCsv?: string;
  importedComponentId?: string;
  importedIngredientId?: number;
  quoteRequestId?: number;
  sampleRequestId?: number;
  b2bProduct?: { id: number; productId: string; name: string; totalCost: number; rrp: number };
  orderTemplateId?: number;
  precommittedTemplateId?: number;
  wastageEntryId?: number;
  transferId?: number;
  b2bCustomerExternalId?: string;
  b2bSalesOrderId?: number;
  promotionId?: number;
};

type TaskUpdate = (patch: Partial<QaTaskResult>) => void;
type TaskFn = (ctx: PowerQaContext, update: TaskUpdate) => Promise<void>;

type TaskDef = {
  id: string;
  label: string;
  group: string;
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

function periodMonthIso(date = new Date()): string {
  return date.toISOString().slice(0, 7);
}

function extractActivationToken(activationUrl: string): string {
  const match = activationUrl.match(/\/activate\/([^/?#]+)/i);
  if (!match?.[1]) throw new Error(`Activation URL missing token: ${activationUrl}`);
  return decodeURIComponent(match[1]);
}

function setApiTenantUserId(userId: number | null | undefined) {
  if (userId == null || userId <= 0) {
    localStorage.removeItem('bisync.currentUserId');
    return;
  }
  localStorage.setItem('bisync.currentUserId', String(userId));
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

async function tryLoginQaOperator(): Promise<{ user: AppUser; password: string } | null> {
  for (const password of QA_OPERATOR_PASSWORDS) {
    try {
      const user = await api.login(QA_OPERATOR_EMAIL, password);
      if (user?.id) return { user, password };
    } catch {
      // try next password
    }
  }
  return null;
}

async function ensureQaOperatorAccount(): Promise<{ user: AppUser; password: string; registered: boolean }> {
  const existing = await tryLoginQaOperator();
  if (existing) return { ...existing, registered: false };

  const password = DEMO_PASSWORD;
  try {
    const registered = await api.register({
      surname: 'Cubevalue',
      givenName: 'MS',
      email: QA_OPERATOR_EMAIL,
      mobile: QA_OPERATOR_MOBILE,
      password,
      confirmPassword: password,
      acceptedEula: true,
      eulaVersion: CURRENT_EULA_VERSION,
      acceptedPrivacyPolicy: true,
      privacyPolicyVersion: CURRENT_PRIVACY_POLICY_VERSION,
      acceptedDpa: true,
      dpaVersion: CURRENT_DPA_VERSION,
    });
    if (registered.activationUrl) {
      const token = extractActivationToken(registered.activationUrl);
      await api.confirmActivation(token);
    }
  } catch (err) {
    // Account may already exist with an unknown password — surface a clear error after retry.
    const retry = await tryLoginQaOperator();
    if (retry) return { ...retry, registered: false };
    throw new Error(
      err instanceof Error
        ? `Could not sign in as ${QA_OPERATOR_EMAIL}: ${err.message}`
        : `Could not sign in as ${QA_OPERATOR_EMAIL}`,
    );
  }

  const user = await api.login(QA_OPERATOR_EMAIL, password);
  return { user, password, registered: true };
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

const BASE_TASKS: TaskDef[] = [
  {
    id: 'register-activate',
    label: 'Sign in as QA operator (ms@cubevalue.com)',
    group: 'setup',
    run: async (ctx, update) => {
      // Stay on the control plane through company/location onboarding. A stale
      // X-Bisync-Company-Id from a prior provisioned QA company would route
      // /api/companies and /api/users into a tenant DB while /api/auth stays
      // on the control plane — breaking location onboarding.
      setApiTenantCompanyId(null);
      const { user, password, registered } = await ensureQaOperatorAccount();
      await assert(user.active !== false, `${QA_OPERATOR_EMAIL} is not active`);
      ctx.ownerUserId = user.id;
      ctx.ownerEmail = QA_OPERATOR_EMAIL;
      ctx.ownerPassword = password;
      ctx.ownerName = user.fullName || 'MS Cubevalue';
      // Admin credentials are the same fixed operator for the rest of the run.
      ctx.adminUserId = user.id;
      ctx.adminEmail = QA_OPERATOR_EMAIL;
      ctx.adminPassword = password;
      ctx.adminName = ctx.ownerName;
      setApiTenantUserId(user.id);
      update({
        detail: registered
          ? `Registered and activated ${QA_OPERATOR_EMAIL} · user #${user.id}`
          : `Signed in as ${QA_OPERATOR_EMAIL} · user #${user.id}`,
        facts: {
          userId: user.id,
          email: QA_OPERATOR_EMAIL,
          registeredNewAccount: registered,
          companyId: user.companyId,
        },
        fixActions: defaultFixActions('register-activate'),
      });
    },
  },
  {
    id: 'company-onboarding',
    label: 'Company onboarding',
    group: 'setup',
    run: async (ctx, update) => {
      await assert(!!ctx.ownerUserId, 'QA operator missing — complete sign-in first');
      setApiTenantCompanyId(null);
      const name = `QA Power Co ${ctx.runKey}`;
      const companyPayload = {
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
        email: QA_OPERATOR_EMAIL,
        active: true,
        businessTypesJson: JSON.stringify([RESTAURANT, CENTRAL_KITCHEN]),
        vendorPolicyTagsJson: JSON.stringify(['halal', 'muslim-friendly']),
        modulesJson: JSON.stringify(['RMS']),
      };
      const accessJson = JSON.stringify({
        modules: ['RMS'],
        superAdmin: true,
        rms: {
          enabled: true,
          tasks: Object.fromEntries(allRmsTaskIds().map(id => [id, true])),
        },
      });

      // Always create a fresh QA company on the control plane. Auth complete-company
      // onboarding early-returns when the operator still has a CompanyId from a prior
      // run/purge, which reuses leftover locations and tenant DBs.
      const company = await api.createCompany(companyPayload);
      const user = await api.updateUser(ctx.ownerUserId!, {
        employeeId: null,
        fullName: ctx.ownerName || 'MS Cubevalue',
        email: QA_OPERATOR_EMAIL,
        role: 'Company Admin',
        phone: QA_OPERATOR_MOBILE,
        active: true,
        companyId: company.id,
        locationIdsJson: '[]',
        accessJson,
      });

      await assert(user.companyId === company.id, 'Operator was not assigned to the new QA company');
      const verifyUsers = await api.users();
      const verified = verifyUsers.find(u => u.id === ctx.ownerUserId);
      await assert(
        verified?.companyId === company.id,
        `Control-plane operator missing company #${company.id} (has ${verified?.companyId ?? 'null'})`,
      );

      ctx.companyId = company.id;
      ctx.companyName = company.name || name;
      setApiTenantCompanyId(company.id);
      setApiTenantUserId(user.id);
      update({
        detail: `Onboarded ${ctx.companyName} (#${company.id}) under ${QA_OPERATOR_EMAIL}`,
        facts: {
          companyId: company.id,
          name: ctx.companyName,
          ownerUserId: user.id,
          operatorEmail: QA_OPERATOR_EMAIL,
          businessTypes: 'Restaurant + Central Kitchen',
          modules: 'RMS',
        },
        fixActions: defaultFixActions('company-onboarding'),
      });
    },
  },
  {
    id: 'location-onboarding',
    label: 'Location onboarding (Restaurant Halal)',
    group: 'setup',
    run: async (ctx, update) => {
      await assert(!!ctx.ownerUserId && !!ctx.companyId, 'Owner/company missing');
      // Stay on the control plane until the restaurant exists, then set the tenant header.
      setApiTenantCompanyId(null);
      const accessJson = JSON.stringify({
        modules: ['RMS'],
        superAdmin: true,
        rms: {
          enabled: true,
          tasks: Object.fromEntries(allRmsTaskIds().map(id => [id, true])),
        },
      });
      const controlUsers = await api.users();
      let controlMe = controlUsers.find(u => u.id === ctx.ownerUserId);
      if (
        controlMe?.companyId !== ctx.companyId
        || (controlMe?.locationIdsJson != null && controlMe.locationIdsJson !== '[]')
      ) {
        controlMe = await api.updateUser(ctx.ownerUserId!, {
          employeeId: null,
          fullName: ctx.ownerName || 'MS Cubevalue',
          email: QA_OPERATOR_EMAIL,
          role: 'Company Admin',
          phone: QA_OPERATOR_MOBILE,
          active: true,
          companyId: ctx.companyId!,
          locationIdsJson: '[]',
          accessJson,
        });
      }
      await assert(
        controlMe?.companyId === ctx.companyId,
        `Register a company before adding a location (control-plane companyId=${controlMe?.companyId ?? 'null'}, expected=${ctx.companyId})`,
      );

      // Create the restaurant directly. Auth complete-location-onboarding skips creation
      // when leftover location assignments still point at the company.
      setApiTenantCompanyId(ctx.companyId);
      const restaurant = await api.createLocationConfig({
        companyId: ctx.companyId!,
        name: `QA Restaurant ${ctx.runKey}`,
        addressLine1: '12 Food Street',
        addressLine2: '',
        city: 'Kuala Lumpur',
        stateProvince: 'Wilayah Persekutuan',
        postcode: '50000',
        principalContactUserId: ctx.ownerUserId!,
        businessTypesJson: JSON.stringify([RESTAURANT]),
        vendorPolicyTagsJson: JSON.stringify(['halal']),
        modulesJson: JSON.stringify(['RMS']),
      });
      await api.updateUser(ctx.ownerUserId!, {
        employeeId: null,
        fullName: ctx.ownerName || 'MS Cubevalue',
        email: QA_OPERATOR_EMAIL,
        role: 'Company Admin',
        phone: QA_OPERATOR_MOBILE,
        active: true,
        companyId: ctx.companyId!,
        locationIdsJson: JSON.stringify([restaurant.id]),
        accessJson,
      });
      ctx.restaurantLocationId = restaurant.id;
      ctx.restaurantExternalId = restaurant.externalId;
      update({
        detail: `${restaurant.name} · ${restaurant.externalId} (halal)`,
        facts: {
          restaurantId: restaurant.id,
          restaurant: restaurant.externalId,
          restaurantPolicy: 'halal',
          controlPlaneCompanyId: controlMe?.companyId ?? null,
        },
        fixActions: defaultFixActions('location-onboarding'),
      });
    },
  },
  {
    id: 'create-kitchen-location',
    label: 'Add Central Kitchen location (Muslim Friendly)',
    group: 'setup',
    run: async (ctx, update) => {
      await assert(!!ctx.companyId && !!ctx.restaurantLocationId, 'Company/restaurant missing');
      const kitchen = await api.createLocationConfig({
        companyId: ctx.companyId!,
        name: `QA Central Kitchen ${ctx.runKey}`,
        addressLine1: '88 Supply Road',
        addressLine2: '',
        city: 'Shah Alam',
        stateProvince: 'Selangor',
        postcode: '40000',
        principalContactUserId: ctx.ownerUserId ?? null,
        businessTypesJson: JSON.stringify([CENTRAL_KITCHEN]),
        vendorPolicyTagsJson: JSON.stringify(['muslim-friendly']),
        modulesJson: JSON.stringify(['RMS']),
      });
      ctx.kitchenLocationId = kitchen.id;
      ctx.kitchenExternalId = kitchen.externalId;
      update({
        detail: `${kitchen.name} · ${kitchen.externalId} (muslim-friendly)`,
        facts: {
          kitchenId: kitchen.id,
          kitchen: kitchen.externalId,
          kitchenPolicy: 'muslim-friendly',
        },
        fixActions: defaultFixActions('create-kitchen-location'),
      });
    },
  },
  {
    id: 'payment-continue',
    label: 'Payment Continue (types, modules, pricing)',
    group: 'setup',
    run: async (ctx, update) => {
      await assert(
        !!ctx.companyId && !!ctx.restaurantLocationId && !!ctx.kitchenLocationId,
        'Company and both locations required before payment',
      );
      const companies = await api.companies();
      const company = companies.find(c => c.id === ctx.companyId);
      await assert(!!company, 'QA company not found for payment save');
      const updatedCompany = await api.updateCompany(company!.id, {
        ...company!,
        businessTypesJson: JSON.stringify([RESTAURANT, CENTRAL_KITCHEN]),
        modulesJson: JSON.stringify(['RMS']),
      });
      const locs = await api.locationsConfig();
      const restaurant = locs.find(l => l.id === ctx.restaurantLocationId);
      const kitchen = locs.find(l => l.id === ctx.kitchenLocationId);
      await assert(!!restaurant && !!kitchen, 'Payment locations missing');
      await api.updateLocationConfig(restaurant!.id, {
        name: restaurant!.name,
        companyId: ctx.companyId!,
        addressLine1: restaurant!.addressLine1,
        addressLine2: restaurant!.addressLine2,
        city: restaurant!.city,
        stateProvince: restaurant!.stateProvince,
        postcode: restaurant!.postcode,
        principalContactUserId: restaurant!.principalContactUserId,
        secondaryContactUserId: restaurant!.secondaryContactUserId ?? null,
        businessTypesJson: JSON.stringify([RESTAURANT]),
        vendorPolicyTagsJson: '[]',
        modulesJson: '[]',
      });
      await api.updateLocationConfig(kitchen!.id, {
        name: kitchen!.name,
        companyId: ctx.companyId!,
        addressLine1: kitchen!.addressLine1,
        addressLine2: kitchen!.addressLine2,
        city: kitchen!.city,
        stateProvince: kitchen!.stateProvince,
        postcode: kitchen!.postcode,
        principalContactUserId: kitchen!.principalContactUserId,
        secondaryContactUserId: kitchen!.secondaryContactUserId ?? null,
        businessTypesJson: JSON.stringify([CENTRAL_KITCHEN]),
        vendorPolicyTagsJson: '[]',
        modulesJson: '[]',
      });

      const priced = [
        priceLocationLine({
          companyId: ctx.companyId!,
          companyName: ctx.companyName ?? updatedCompany.name,
          locationId: restaurant!.id,
          locationName: restaurant!.name,
          locationType: RESTAURANT,
          countryCode: updatedCompany.countryCode || 'MY',
        }),
        priceLocationLine({
          companyId: ctx.companyId!,
          companyName: ctx.companyName ?? updatedCompany.name,
          locationId: kitchen!.id,
          locationName: kitchen!.name,
          locationType: CENTRAL_KITCHEN,
          countryCode: updatedCompany.countryCode || 'MY',
        }),
      ];
      const totals = sumPricedLines(priced);
      const irregularities: QaIrregularity[] = [];
      if (priced[0].amount !== 300 || priced[0].currency !== 'MYR') {
        irregularities.push({
          id: 'price-restaurant',
          label: 'Restaurant subscription MYR',
          expected: 300,
          actual: `${priced[0].currency} ${priced[0].amount}`,
          severity: 'fail',
        });
      }
      if (priced[1].amount !== 450 || priced[1].currency !== 'MYR') {
        irregularities.push({
          id: 'price-kitchen',
          label: 'Central Kitchen subscription MYR',
          expected: 450,
          actual: `${priced[1].currency} ${priced[1].amount}`,
          severity: 'fail',
        });
      }
      update({
        detail: `Profiles saved · bill MYR ${totals.myr} (rest ${priced[0].amount} + kitchen ${priced[1].amount})`,
        facts: {
          companyModules: 'RMS',
          restaurantTier: priced[0].tier,
          kitchenTier: priced[1].tier,
          totalMyr: totals.myr,
          gateway: 'deferred (Continue only)',
        },
        irregularities,
        fixActions: defaultFixActions('payment-continue'),
      });
      if (irregularities.length) {
        throw new Error(`Payment pricing assert failed: ${irregularities.map(i => i.label).join('; ')}`);
      }
    },
  },
  {
    id: 'provision-company-db',
    label: 'Provision company operational DB',
    group: 'setup',
    run: async (ctx, update) => {
      await assert(!!ctx.companyId, 'Company missing');
      let result: Awaited<ReturnType<typeof api.provisionCompanyDb>> | null = null;
      let lastErr: unknown;
      for (let attempt = 1; attempt <= 3; attempt++) {
        try {
          result = await api.provisionCompanyDb({
            companyId: ctx.companyId,
            userId: ctx.ownerUserId,
          });
          lastErr = null;
          break;
        } catch (err) {
          lastErr = err;
          const msg = err instanceof Error ? err.message : String(err);
          const transient = /transient|broken pipe|timeout|terminat|too many connections/i.test(msg);
          if (!transient || attempt === 3) throw err;
          update({ detail: `Provision attempt ${attempt} failed (transient) — retrying…` });
          await new Promise(r => setTimeout(r, 1500 * attempt));
        }
      }
      if (!result) throw lastErr instanceof Error ? lastErr : new Error('Company DB provision failed');
      setApiTenantCompanyId(result.companyId || ctx.companyId);
      ctx.provisionedDatabaseName = result.databaseName;
      const irregularities: QaIrregularity[] = [];
      if (result.skippedByFeatureFlag) {
        irregularities.push({
          id: 'provision-skipped',
          label: 'Company DB provision feature flag',
          expected: 'enabled',
          actual: result.message || 'skipped',
          severity: 'warn',
        });
      }
      if (!result.skippedByFeatureFlag && !result.provisioned && !result.alreadyProvisioned) {
        irregularities.push({
          id: 'not-provisioned',
          label: 'Company DB provisioned',
          expected: 'true',
          actual: result.message || 'false',
          severity: 'fail',
        });
      }
      const expectedDb = `bisync_c_${ctx.companyId}`;
      if (!result.skippedByFeatureFlag && result.databaseName && result.databaseName !== expectedDb) {
        irregularities.push({
          id: 'db-name',
          label: 'Operational DB name',
          expected: expectedDb,
          actual: result.databaseName,
          severity: 'warn',
        });
      }
      update({
        detail: result.message || `DB ${result.databaseName}`,
        facts: {
          companyId: result.companyId,
          databaseName: result.databaseName,
          archiveDatabaseName: result.archiveDatabaseName,
          provisioned: result.provisioned,
          alreadyProvisioned: result.alreadyProvisioned,
          skippedByFeatureFlag: result.skippedByFeatureFlag,
        },
        irregularities,
        fixActions: defaultFixActions('provision-company-db'),
      });
      if (irregularities.some(i => i.severity === 'fail')) {
        throw new Error(irregularities.filter(i => i.severity === 'fail').map(i => `${i.label}: ${i.actual}`).join('; '));
      }
      if (irregularities.some(i => i.severity === 'warn')) {
        softFail(irregularities.filter(i => i.severity === 'warn').map(i => `${i.label} (${i.actual})`).join('; '));
      }
    },
  },
  {
    id: 'create-system-admin',
    label: 'Grant System Admin rights to QA operator',
    group: 'system-config',
    run: async (ctx, update) => {
      await assert(!!ctx.companyId && !!ctx.restaurantLocationId && !!ctx.kitchenLocationId, 'Org context missing');
      await assert(!!ctx.ownerUserId, 'QA operator user missing');
      const email = QA_OPERATOR_EMAIL;
      const name = ctx.ownerName || 'MS Cubevalue';
      const accessJson = JSON.stringify({
        modules: ['RMS'],
        superAdmin: true,
        rms: {
          enabled: true,
          tasks: Object.fromEntries(allRmsTaskIds().map(id => [id, true])),
        },
      });
      const user = await api.updateUser(ctx.ownerUserId!, {
        employeeId: null,
        fullName: name,
        email,
        role: 'System Admin',
        phone: QA_OPERATOR_MOBILE,
        active: true,
        companyId: ctx.companyId!,
        locationIdsJson: JSON.stringify([ctx.restaurantLocationId, ctx.kitchenLocationId]),
        accessJson,
      });
      ctx.employeeId = user.employeeId ?? undefined;
      ctx.adminUserId = user.id;
      ctx.adminEmail = email;
      ctx.adminPassword = ctx.ownerPassword || DEMO_PASSWORD;
      ctx.adminName = name;
      update({
        detail: `${name} · ${email} granted System Admin on QA company`,
        facts: {
          userId: user.id,
          email,
          superAdmin: true,
          rmsTasks: allRmsTaskIds().length,
          companyId: ctx.companyId!,
        },
        fixActions: defaultFixActions('create-system-admin'),
      });
    },
  },
  {
    id: 'login-system-admin',
    label: 'Log in as QA operator (ms@cubevalue.com)',
    group: 'setup',
    run: async (ctx, update) => {
      await assert(!!ctx.adminEmail && !!ctx.adminPassword, 'QA operator credentials missing');
      const user = await api.login(ctx.adminEmail!, ctx.adminPassword!);
      await assert(
        user.email.toLowerCase() === QA_OPERATOR_EMAIL,
        `Expected ${QA_OPERATOR_EMAIL}, got ${user.email}`,
      );
      setApiTenantUserId(user.id);
      setApiTenantCompanyId(ctx.companyId);
      ctx.adminUserId = user.id;
      update({
        detail: `Authenticated as ${user.fullName} (${user.email})`,
        facts: { userId: user.id, email: user.email, role: user.role, operator: QA_OPERATOR_EMAIL },
        fixActions: defaultFixActions('login-system-admin'),
      });
    },
  },
  {
    id: 'create-first-component-vendor',
    label: 'Add Component + Vendor + Vendor Product (seed #1)',
    group: 'component',
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
    label: 'Create 5 Components + Vendors + Vendor Products',
    group: 'component',
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
    label: 'Create Sub-Product using 3 components',
    group: 'products',
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
    label: 'Create Product utilizing all 5 components (incl. sub-product)',
    group: 'products',
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
    label: 'Add RRP and verify COGS / COGS%',
    group: 'products',
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
    label: 'Open POs to all test vendors (5 POs each)',
    group: 'operation-order',
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
    label: 'Vendors accept POs (1 simulated price change)',
    group: 'operation-order',
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
    label: 'Receive all vendor products',
    group: 'operation-order',
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
        await api.receivePurchaseOrder(meta.id, {
          items,
          vendorDoNumber: `QA-DO-${meta.id}`,
          productQualityRating: 'Satisfied',
          hygieneRating: 'Satisfied',
        });
        await api.reconcilePurchaseOrder(meta.id, {
          items,
          productQualityRating: 'Satisfied',
          hygieneRating: 'Satisfied',
        });
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
    label: 'Verify STOCK CARD after PO receipts',
    group: 'operation-inventory',
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
    label: 'Cash-purchase one component',
    group: 'operation-order',
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
    label: 'Verify cash purchase on STOCK CARD',
    group: 'operation-inventory',
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
    label: 'Produce product (2 batches) + offline sales for FIFO',
    group: 'operation-production',
    run: async (ctx, update) => {
      await assert(!!ctx.finishedProduct && !!ctx.subProduct && !!ctx.restaurantExternalId && !!ctx.kitchenExternalId, 'Product/location missing');
      const productId = ctx.finishedProduct!.id;
      const subId = ctx.subProduct!.id;
      const loc = ctx.kitchenExternalId!;

      // Finished BOM consumes the sub-product — produce enough sub stock first.
      // Sub InStock is incremented by batchQty (not yieldQuantity).
      await api.markProductToProduce(subId, {
        locationExternalIds: [loc],
        batchQty: 20,
        productionDate: daysAgoIso(6),
        overrideStock: true,
      });
      await api.produceProductBatches(subId, {
        locationExternalIds: [loc],
        batchQty: 20,
        productionDate: daysAgoIso(6),
        overrideStock: true,
      });

      // Produce two finished batches on different dates to create product FIFO layers
      await api.markProductToProduce(productId, {
        locationExternalIds: [loc],
        batchQty: 8,
        productionDate: daysAgoIso(5),
        overrideStock: true,
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
        overrideStock: true,
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
        salesChannel: 'offline',
      });
      await api.recordProductSale(productId, {
        locationExternalIds: [loc],
        quantitySold: 3,
        salesChannel: 'offline',
      });

      update({
        detail: `Produced 8+6 · sold 5+3 offline · pre-sale onHand=${beforeSale.onHandQty}`,
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
    label: 'Final STOCK CARD audit (PO + cash + produce + sales / FIFO)',
    group: 'operation-inventory',
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
  {
    id: 'cogs-audit-history',
    label: 'Confirm inventory + COGS Audit History',
    group: 'reports',
    run: async (ctx, update) => {
      await assert(!!ctx.companyId && !!ctx.kitchenExternalId && ctx.components.length > 0, 'Stock context missing for COGS audit');
      const period = periodMonthIso();
      const locIds = [ctx.kitchenExternalId!];
      const irregularities: QaIrregularity[] = [];

      const stockRows = await api.stockCards(ctx.companyId, locIds, {
        itemType: 'component',
        uomMode: 'inventory',
        period,
      });
      const qaComponentIds = new Set(ctx.components.map(c => c.componentId));
      const lines = stockRows
        .filter(row => qaComponentIds.has(row.itemKey) || row.itemType === 'component')
        .slice(0, 20)
        .map(row => ({
          itemType: row.itemType,
          itemKey: row.itemKey,
          itemName: row.name,
          groupName: row.group || 'QA',
          uom: row.uom || 'Kg',
          systemQty: row.onHandQty,
          countedQty: row.onHandQty,
        }));
      await assert(lines.length > 0, 'No stock card lines available to count for COGS audit');

      const saved = await api.saveInventoryCount({
        sessionType: 'full',
        companyId: ctx.companyId,
        locationIds: locIds.join(','),
        periodMonth: period,
        uomMode: 'inventory',
        itemTypeFilter: 'component',
        groupFilter: 'All',
        countDate: todayIso(),
        savedBy: ctx.adminName ?? 'QA Power',
        lines,
      });
      await assert(!!saved.session?.id, 'Inventory save did not return a session');

      const confirmed = await api.confirmInventoryCount(
        saved.session.id,
        ctx.adminName ?? 'QA Power',
        todayIso(),
      );
      await assert(confirmed.session?.status?.toLowerCase().includes('confirm') || !!confirmed.session?.confirmedAt,
        `Inventory confirm failed (status=${confirmed.session?.status ?? 'unknown'})`);

      const summary = await api.cogsAuditSummary(ctx.companyId, locIds, {
        period,
        uomMode: 'inventory',
        itemType: 'component',
      });
      const history = await api.cogsAuditSystemHistory(50);
      const match = history.find(h =>
        (h.companyId != null && h.companyId === ctx.companyId)
        || (ctx.companyName != null && h.companyName === ctx.companyName)
        || (h.locationExternalId === ctx.kitchenExternalId && h.periodMonth === period),
      );
      if (!match) {
        irregularities.push({
          id: 'history-missing',
          label: 'COGS Audit History entry after inventory confirm',
          expected: `company ${ctx.companyId} / ${period}`,
          actual: `none in ${history.length} recent runs`,
          severity: 'warn',
        });
      } else {
        ctx.cogsAuditHistoryRunId = match.runId;
      }

      update({
        detail: match
          ? `Inventory confirmed · COGS history ${match.runId}`
          : `Inventory confirmed · live summary ok but history row missing`,
        facts: {
          periodMonth: period,
          inventorySessionId: saved.session.id,
          inventoryStatus: confirmed.session?.status ?? null,
          summaryIngredientCount: summary.ingredientCount,
          summaryRows: summary.rows?.length ?? 0,
          historyRunId: match?.runId ?? null,
          historyTrigger: match?.trigger ?? null,
        },
        irregularities,
        fixActions: defaultFixActions('cogs-audit-history'),
      });

      if (irregularities.some(i => i.severity === 'fail')) {
        throw new Error(irregularities.filter(i => i.severity === 'fail').map(i => i.label).join('; '));
      }
      if (irregularities.some(i => i.severity === 'warn')) {
        softFail(irregularities.filter(i => i.severity === 'warn').map(i => i.label).join('; '));
      }
    },
  },
] as TaskDef[];

function assembleQaTasks(base: TaskDef[]): TaskDef[] {
  const out: TaskDef[] = [];
  for (const step of base) {
    out.push(step);
    const extras = QA_EXTENDED_INSERTS[step.id];
    if (extras?.length) {
      for (const extra of extras) {
        out.push(extra as TaskDef);
      }
    }
  }
  for (const extra of QA_EXTENDED_TAIL) {
    out.push(extra as TaskDef);
  }
  return out;
}

const TASKS: TaskDef[] = assembleQaTasks(BASE_TASKS);

export function createPendingTasks(): QaTaskResult[] {
  return TASKS.map(t => ({
    id: t.id,
    label: t.label,
    group: QA_GROUP_LABEL[(t.group as QaGroupId)] ?? t.group,
    status: 'pending' as const,
    fixActions: defaultFixActions(t.id),
  }));
}

export function getPowerQaTaskDefs(): { id: string; label: string; group: string }[] {
  return TASKS.map(t => ({
    id: t.id,
    label: t.label,
    group: QA_GROUP_LABEL[(t.group as QaGroupId)] ?? t.group,
  }));
}

export function getQaGroupOrder(): string[] {
  return TASKS.map(t => QA_GROUP_LABEL[(t.group as QaGroupId)] ?? t.group)
    .filter((g, i, arr) => arr.indexOf(g) === i);
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
