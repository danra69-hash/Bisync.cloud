import type { Vendor } from '../api';
import {
  VENDOR_PRODUCT_CATALOG,
  deactivateVendorProducts,
  formatDeliveryUnitPath,
  inferCatalogProductPolicyTag,
  loadImportedVendorProducts,
  parseDeliveryUnitPath,
  parseVendorProductTemplateCsv,
  persistVendorProductUpdate,
  reactivateVendorProducts,
  saveImportedVendorProducts,
  type VendorProductCatalogItem,
  type VendorProductImportDraft,
} from './vendorProductCatalog';
import { formatCountryNumber } from '../utils/numberFormat';

export type VendorProductImportOptions = {
  /** When set, drafts without Vendor ID inherit this vendor (per-vendor panel). */
  defaultVendor?: Pick<Vendor, 'externalId' | 'name'>;
  /** Known vendors for multi-vendor CSV validation / apply. */
  vendors?: Array<Pick<Vendor, 'externalId' | 'name'>>;
};

export type VendorProductFieldChange = {
  field: string;
  label: string;
  before: string;
  after: string;
};

export type VendorProductImportUpdate = {
  existing: VendorProductCatalogItem;
  draft: VendorProductImportDraft;
  changes: VendorProductFieldChange[];
};

export type VendorProductImportDeactivation = {
  existing: VendorProductCatalogItem;
  reason: string;
};

export type VendorProductMergeCandidate = {
  key: string;
  label: string;
  source: 'template' | 'database';
  draft: VendorProductImportDraft;
  existing?: VendorProductCatalogItem;
  templateIndex?: number;
};

export type VendorProductImportConflict = {
  key: string;
  reason: string;
  candidates: VendorProductMergeCandidate[];
};

export type VendorProductImportPlan = {
  creates: VendorProductImportDraft[];
  updates: VendorProductImportUpdate[];
  unchanged: VendorProductCatalogItem[];
  errors: string[];
  conflicts: VendorProductImportConflict[];
  deactivations: VendorProductImportDeactivation[];
};

export type VendorProductMergeDisplay = {
  vendorProductId: string;
  productName: string;
  group: string;
  specification: string;
  deliveryUnit: string;
  price: string;
  sourceLabel: string;
};

const TEMPLATE_FIELD_LABELS: Record<string, string> = {
  vendorProductId: 'Vendor Product ID',
  productName: 'Product Name',
  group: 'Group',
  specification: 'Specification',
  deliveryUnit: 'Delivery Unit',
  price: 'Price',
};

export const VENDOR_PRODUCT_MERGE_COMPARE_FIELDS: Array<{ key: keyof VendorProductMergeDisplay; label: string }> = [
  { key: 'vendorProductId', label: 'Vendor Product ID' },
  { key: 'productName', label: 'Product Name' },
  { key: 'group', label: 'Group' },
  { key: 'specification', label: 'Specification' },
  { key: 'deliveryUnit', label: 'Delivery Unit' },
  { key: 'price', label: 'Price' },
];

function draftDefaults(): Pick<VendorProductImportDraft, 'active'> {
  return { active: true };
}

function vendorScopeKey(draft: Pick<VendorProductImportDraft, 'vendorExternalId' | 'productName'>): string {
  const vendor = (draft.vendorExternalId || '').trim().toUpperCase();
  return `${vendor}::${draft.productName.trim().toLowerCase()}`;
}

function normalizeDraft(
  draft: VendorProductImportDraft,
  defaultVendor?: Pick<Vendor, 'externalId' | 'name'>,
): VendorProductImportDraft {
  const vendorExternalId = (draft.vendorExternalId || defaultVendor?.externalId || '').trim().toUpperCase() || undefined;
  const vendorName = (draft.vendorName || defaultVendor?.name || '').trim() || undefined;
  const group = draft.group.trim() || draft.category?.trim() || 'Dry Goods';
  return {
    ...draftDefaults(),
    ...draft,
    vendorExternalId,
    vendorName,
    category: draft.category?.trim() || undefined,
    vendorProductId: draft.vendorProductId?.trim().toUpperCase() || undefined,
    productName: draft.productName.trim(),
    group,
    specification: draft.specification.trim(),
    deliveryUnitText: draft.deliveryUnitText.trim(),
    deliveryPrice: draft.deliveryPrice,
  };
}

function productToDraft(product: VendorProductCatalogItem): VendorProductImportDraft {
  return normalizeDraft({
    vendorExternalId: product.vendorExternalId,
    vendorName: product.vendorName,
    vendorProductId: product.id,
    productName: product.productName,
    group: product.group,
    specification: product.specification,
    deliveryUnitText: formatDeliveryUnitPath(product.delivery),
    deliveryPrice: product.deliveryPrice,
    productPolicyTag: product.productPolicyTag,
    active: true,
  });
}

function buildComparable(draft: VendorProductImportDraft, countryCode = 'MY'): Record<keyof typeof TEMPLATE_FIELD_LABELS, string> {
  return {
    vendorProductId: draft.vendorProductId || '',
    productName: draft.productName,
    group: draft.group,
    specification: draft.specification,
    deliveryUnit: draft.deliveryUnitText,
    price: draft.deliveryPrice > 0 ? formatCountryNumber(draft.deliveryPrice, countryCode) : '',
  };
}

function diffProduct(existing: VendorProductCatalogItem, draft: VendorProductImportDraft): VendorProductFieldChange[] {
  const before = buildComparable(productToDraft(existing));
  const after = buildComparable(draft);
  const changes: VendorProductFieldChange[] = [];

  for (const field of Object.keys(TEMPLATE_FIELD_LABELS) as Array<keyof typeof TEMPLATE_FIELD_LABELS>) {
    if (before[field] !== after[field]) {
      changes.push({
        field,
        label: TEMPLATE_FIELD_LABELS[field] ?? field,
        before: before[field],
        after: after[field],
      });
    }
  }

  return changes;
}

function mergeDraftWithExisting(
  draft: VendorProductImportDraft,
  existing: VendorProductCatalogItem,
): VendorProductImportDraft {
  return {
    ...draft,
    vendorExternalId: draft.vendorExternalId || existing.vendorExternalId,
    vendorName: draft.vendorName || existing.vendorName,
    vendorProductId: draft.vendorProductId || existing.id,
    // New template omits Specification — preserve DB value when CSV cell is blank.
    specification: draft.specification.trim() || existing.specification,
    active: draft.active !== false,
  };
}

type ConflictNodeId = `t:${number}` | `e:${string}`;

function conflictNodeFind(parent: Map<ConflictNodeId, ConflictNodeId>, node: ConflictNodeId): ConflictNodeId {
  const current = parent.get(node) ?? node;
  if (current === node) return node;
  const root = conflictNodeFind(parent, current);
  parent.set(node, root);
  return root;
}

function conflictNodeUnion(
  parent: Map<ConflictNodeId, ConflictNodeId>,
  a: ConflictNodeId,
  b: ConflictNodeId,
) {
  const rootA = conflictNodeFind(parent, a);
  const rootB = conflictNodeFind(parent, b);
  if (rootA !== rootB) parent.set(rootB, rootA);
}

function detectImportConflicts(
  drafts: VendorProductImportDraft[],
  existingProducts: VendorProductCatalogItem[],
): VendorProductImportConflict[] {
  const parent = new Map<ConflictNodeId, ConflictNodeId>();
  const nodes = new Set<ConflictNodeId>();

  const register = (node: ConflictNodeId) => {
    nodes.add(node);
    if (!parent.has(node)) parent.set(node, node);
  };

  const byName = new Map<string, number[]>();
  const byId = new Map<string, number[]>();

  drafts.forEach((draft, index) => {
    register(`t:${index}`);
    const nameKey = vendorScopeKey(draft);
    const idKey = draft.vendorProductId?.trim().toUpperCase() ?? '';
    if (draft.productName.trim()) {
      if (!byName.has(nameKey)) byName.set(nameKey, []);
      byName.get(nameKey)!.push(index);
    }
    if (idKey) {
      if (!byId.has(idKey)) byId.set(idKey, []);
      byId.get(idKey)!.push(index);
    }
  });

  // Template↔template duplicates only (same Vendor Product ID or same vendor+name).
  for (const indices of byName.values()) {
    if (indices.length < 2) continue;
    for (let i = 1; i < indices.length; i++) {
      conflictNodeUnion(parent, `t:${indices[0]}`, `t:${indices[i]}`);
    }
  }

  for (const indices of byId.values()) {
    if (indices.length < 2) continue;
    for (let i = 1; i < indices.length; i++) {
      conflictNodeUnion(parent, `t:${indices[0]}`, `t:${indices[i]}`);
    }
  }

  const existingByScopedName = new Map(
    existingProducts
      .filter(product => product.productName.trim())
      .map(product => [
        `${product.vendorExternalId.trim().toUpperCase()}::${product.productName.trim().toLowerCase()}`,
        product,
      ]),
  );
  const existingById = new Map(
    existingProducts
      .filter(product => product.id.trim())
      .map(product => [product.id.trim().toUpperCase(), product]),
  );

  // Ambiguous template↔database: same vendor+name but different / missing IDs.
  // Clean Vendor Product ID matches are updates, not merge conflicts.
  drafts.forEach((draft, index) => {
    const productId = draft.vendorProductId?.trim().toUpperCase() ?? '';
    if (productId && existingById.has(productId)) return;

    const scoped = vendorScopeKey(draft);
    const existingByProductName = scoped ? existingByScopedName.get(scoped) : undefined;
    if (!existingByProductName) return;

    register(`e:${existingByProductName.id}`);
    conflictNodeUnion(parent, `t:${index}`, `e:${existingByProductName.id}`);
  });

  const grouped = new Map<ConflictNodeId, ConflictNodeId[]>();
  for (const node of nodes) {
    const root = conflictNodeFind(parent, node);
    if (!grouped.has(root)) grouped.set(root, []);
    grouped.get(root)!.push(node);
  }

  const conflicts: VendorProductImportConflict[] = [];

  for (const groupNodes of grouped.values()) {
    if (groupNodes.length < 2) continue;

    const candidates: VendorProductMergeCandidate[] = [];
    for (const node of groupNodes) {
      if (node.startsWith('t:')) {
        const templateIndex = Number(node.slice(2));
        const draft = drafts[templateIndex];
        if (!draft) continue;
        candidates.push({
          key: node,
          label: `Template row ${templateIndex + 1}`,
          source: 'template',
          draft,
          templateIndex,
        });
        continue;
      }

      const existingId = node.slice(2);
      const existing = existingProducts.find(product => product.id === existingId);
      if (!existing) continue;
      candidates.push({
        key: node,
        label: `Database · ${existing.id}`,
        source: 'database',
        draft: productToDraft(existing),
        existing,
      });
    }

    if (candidates.length < 2) continue;

    const displayName = candidates[0]?.draft.productName || 'Unknown';
    const displayId = candidates.find(candidate => candidate.draft.vendorProductId)?.draft.vendorProductId;
    const reason = displayId
      ? `Duplicate vendor product "${displayName}" (${displayId})`
      : `Duplicate vendor product name: ${displayName}`;

    conflicts.push({
      key: `conflict-${conflicts.length + 1}-${displayName.trim().toLowerCase().replace(/\s+/g, '-')}`,
      reason,
      candidates,
    });
  }

  return conflicts;
}

function blockedTemplateIndices(conflicts: VendorProductImportConflict[]): Set<number> {
  const blocked = new Set<number>();
  for (const conflict of conflicts) {
    for (const candidate of conflict.candidates) {
      if (candidate.source === 'template' && candidate.templateIndex !== undefined) {
        blocked.add(candidate.templateIndex);
      }
    }
  }
  return blocked;
}

export function buildVendorProductImportPlan(
  drafts: VendorProductImportDraft[],
  existingProducts: VendorProductCatalogItem[],
  options: VendorProductImportOptions = {},
): VendorProductImportPlan {
  const vendorsById = new Map(
    (options.vendors ?? [])
      .filter(vendor => vendor.externalId)
      .map(vendor => [vendor.externalId.trim().toUpperCase(), vendor]),
  );
  const normalizedDrafts = drafts.map(draft => normalizeDraft(draft, options.defaultVendor));
  const conflicts = detectImportConflicts(normalizedDrafts, existingProducts);
  const blocked = blockedTemplateIndices(conflicts);

  const plan: VendorProductImportPlan = {
    creates: [],
    updates: [],
    unchanged: [],
    errors: [],
    conflicts,
    deactivations: [],
  };

  const byProductId = new Map(
    existingProducts
      .filter(product => product.id)
      .map(product => [product.id.trim().toUpperCase(), product]),
  );
  const byScopedName = new Map(
    existingProducts.map(product => [
      `${product.vendorExternalId.trim().toUpperCase()}::${product.productName.trim().toLowerCase()}`,
      product,
    ]),
  );
  const seenIds = new Map<string, string>();

  for (let index = 0; index < normalizedDrafts.length; index++) {
    if (blocked.has(index)) continue;

    const rawDraft = normalizedDrafts[index];
    const productId = rawDraft.vendorProductId?.trim().toUpperCase() ?? '';
    const nameKey = rawDraft.productName.trim().toLowerCase();
    const vendorId = rawDraft.vendorExternalId?.trim().toUpperCase() ?? '';

    if (!rawDraft.productName.trim()) {
      plan.errors.push('Skipped row with empty product name.');
      continue;
    }

    if (!rawDraft.deliveryUnitText.trim()) {
      plan.errors.push(`"${rawDraft.productName}" is missing delivery unit.`);
      continue;
    }

    if (!parseDeliveryUnitPath(rawDraft.deliveryUnitText)) {
      plan.errors.push(`"${rawDraft.productName}" has an invalid delivery unit format.`);
      continue;
    }

    if (rawDraft.deliveryPrice <= 0) {
      plan.errors.push(`"${rawDraft.productName}" must have a price greater than zero.`);
      continue;
    }

    if (vendorId && vendorsById.size > 0 && !vendorsById.has(vendorId)) {
      plan.errors.push(`"${rawDraft.productName}" references unknown Vendor ID ${vendorId}.`);
      continue;
    }

    if (!vendorId && !options.defaultVendor && !productId) {
      plan.errors.push(`"${rawDraft.productName}" is missing Vendor ID (required for new products).`);
      continue;
    }

    if (productId) {
      const priorName = seenIds.get(productId);
      if (priorName && priorName !== nameKey) {
        plan.errors.push(`Duplicate Vendor Product ID in template with different names: ${productId}`);
        continue;
      }
      seenIds.set(productId, nameKey);
    }

    const existing = productId
      ? byProductId.get(productId)
      : byScopedName.get(vendorScopeKey(rawDraft));

    // Fill vendor name from catalog of known vendors when CSV name is blank.
    const vendorMeta = vendorId ? vendorsById.get(vendorId) : undefined;
    const withVendorName: VendorProductImportDraft = {
      ...rawDraft,
      vendorName: rawDraft.vendorName || vendorMeta?.name || existing?.vendorName,
    };

    const draft = existing ? mergeDraftWithExisting(withVendorName, existing) : withVendorName;

    if (existing) {
      const changes = diffProduct(existing, draft);
      if (changes.length === 0) {
        plan.unchanged.push(existing);
      } else {
        plan.updates.push({ existing, draft, changes });
      }
      continue;
    }

    if (!draft.vendorExternalId) {
      plan.errors.push(`"${draft.productName}" is missing Vendor ID (required for new products).`);
      continue;
    }

    plan.creates.push(draft);
  }

  return plan;
}

export function buildMergeDisplayFromDraft(
  draft: VendorProductImportDraft,
  sourceLabel: string,
): VendorProductMergeDisplay {
  const comparable = buildComparable(draft);
  return {
    vendorProductId: comparable.vendorProductId || '—',
    productName: comparable.productName,
    group: comparable.group,
    specification: comparable.specification || '—',
    deliveryUnit: comparable.deliveryUnit || '—',
    price: comparable.price || '—',
    sourceLabel,
  };
}

export function applyMergeResolutions(
  plan: VendorProductImportPlan,
  resolutions: Record<string, string>,
  existingProducts: VendorProductCatalogItem[],
): VendorProductImportPlan {
  const nextPlan: VendorProductImportPlan = {
    creates: [...plan.creates],
    updates: [...plan.updates],
    unchanged: [...plan.unchanged],
    errors: [...plan.errors],
    conflicts: [],
    deactivations: [...plan.deactivations],
  };

  const existingByProductId = new Map(
    existingProducts.filter(product => product.id).map(product => [product.id.trim().toUpperCase(), product]),
  );
  const existingByName = new Map(
    existingProducts.map(product => [product.productName.trim().toLowerCase(), product]),
  );

  for (const conflict of plan.conflicts) {
    const winnerKey = resolutions[conflict.key];
    if (!winnerKey) {
      nextPlan.conflicts.push(conflict);
      continue;
    }

    const winner = conflict.candidates.find(candidate => candidate.key === winnerKey);
    if (!winner) {
      nextPlan.errors.push(`Merge conflict "${conflict.reason}" has no selected winner.`);
      nextPlan.conflicts.push(conflict);
      continue;
    }

    for (const loser of conflict.candidates) {
      if (loser.key === winnerKey) continue;
      if (loser.source === 'database' && loser.existing) {
        nextPlan.deactivations.push({
          existing: loser.existing,
          reason: `Not selected during merge for "${conflict.reason}"`,
        });
      }
    }

    const winnerDraft = normalizeDraft({ ...winner.draft, active: true });
    const targetExisting = winner.existing
      ?? (winnerDraft.vendorProductId
        ? existingByProductId.get(winnerDraft.vendorProductId.trim().toUpperCase())
        : undefined)
      ?? existingByName.get(winnerDraft.productName.trim().toLowerCase());

    if (targetExisting) {
      const mergedDraft = mergeDraftWithExisting(winnerDraft, targetExisting);
      const changes = diffProduct(targetExisting, mergedDraft);
      nextPlan.updates.push({
        existing: targetExisting,
        draft: mergedDraft,
        changes: changes.length > 0
          ? changes
          : [{
            field: 'productName',
            label: 'Product Name',
            before: targetExisting.productName,
            after: mergedDraft.productName,
          }],
      });
      continue;
    }

    nextPlan.creates.push(winnerDraft);
  }

  return nextPlan;
}

export function draftToCatalogProduct(
  draft: VendorProductImportDraft,
  vendor: Pick<Vendor, 'externalId' | 'name' | 'productPolicyTag'>,
  existing?: VendorProductCatalogItem,
): VendorProductCatalogItem | null {
  const delivery = parseDeliveryUnitPath(draft.deliveryUnitText);
  if (!delivery) return null;

  const id = draft.vendorProductId?.trim().toUpperCase() || existing?.id;
  if (!id) return null;

  const vendorExternalId = (draft.vendorExternalId || vendor.externalId).trim();
  const vendorName = (draft.vendorName || vendor.name).trim();

  return {
    id,
    vendorExternalId,
    vendorName,
    productName: draft.productName.trim(),
    group: draft.group.trim() || 'Dry Goods',
    specification: draft.specification.trim(),
    deliveryPrice: draft.deliveryPrice,
    delivery,
    imageUrl: existing?.imageUrl ?? `https://picsum.photos/seed/${id.toLowerCase()}/80/80`,
    productPolicyTag: draft.productPolicyTag
      ?? existing?.productPolicyTag
      ?? inferCatalogProductPolicyTag({
        vendorExternalId,
        group: draft.group,
        specification: draft.specification,
      }, vendor.productPolicyTag),
  };
}

function resolveApplyVendor(
  draft: VendorProductImportDraft,
  existing: VendorProductCatalogItem | undefined,
  defaultVendor: Vendor | undefined,
  vendorsById: Map<string, Vendor>,
): Vendor | null {
  const vendorId = (draft.vendorExternalId || existing?.vendorExternalId || defaultVendor?.externalId || '')
    .trim()
    .toUpperCase();
  if (vendorId && vendorsById.has(vendorId)) return vendorsById.get(vendorId)!;
  if (defaultVendor && (!vendorId || defaultVendor.externalId.trim().toUpperCase() === vendorId)) {
    return defaultVendor;
  }
  if (vendorId && (draft.vendorName || existing?.vendorName)) {
    // Synthetic vendor shell when CSV has ID+name but vendor list wasn't passed.
    return {
      id: 0,
      externalId: vendorId,
      name: draft.vendorName || existing?.vendorName || vendorId,
      type: '',
      brn: '',
      products: '',
      city: '',
      state: '',
      address: '',
      contactPerson: '',
      contactPosition: '',
      mobile: '',
      email: '',
      contactsJson: '[]',
      engaged: false,
    };
  }
  return defaultVendor ?? null;
}

export async function applyVendorProductImportPlan(
  plan: VendorProductImportPlan,
  vendorOrOptions: Vendor | (VendorProductImportOptions & { defaultVendor?: Vendor }),
): Promise<{ created: number; updated: number; deactivated: number }> {
  const options: VendorProductImportOptions & { defaultVendor?: Vendor } =
    'externalId' in vendorOrOptions
      ? { defaultVendor: vendorOrOptions, vendors: [vendorOrOptions] }
      : vendorOrOptions;

  const defaultVendor = options.defaultVendor;
  const vendorsById = new Map(
    (options.vendors ?? (defaultVendor ? [defaultVendor] : []))
      .filter(vendor => vendor.externalId)
      .map(vendor => [vendor.externalId.trim().toUpperCase(), vendor as Vendor]),
  );

  let created = 0;
  let updated = 0;
  let deactivated = 0;

  const activeCreates = plan.creates.filter(draft => draft.active !== false);
  const createsByVendor = new Map<string, { vendor: Vendor; drafts: VendorProductImportDraft[] }>();
  for (const draft of activeCreates) {
    const vendor = resolveApplyVendor(draft, undefined, defaultVendor, vendorsById);
    if (!vendor) {
      throw new Error(`Cannot create "${draft.productName}" — Vendor ID is missing or unknown.`);
    }
    const key = vendor.externalId.trim().toUpperCase();
    const bucket = createsByVendor.get(key) ?? { vendor, drafts: [] };
    bucket.drafts.push(draft);
    createsByVendor.set(key, bucket);
  }

  for (const { vendor, drafts } of createsByVendor.values()) {
    const added = await saveImportedVendorProducts(vendor.externalId, vendor.name, drafts);
    created += added.length;
  }

  for (const update of plan.updates) {
    if (update.draft.active === false) continue;
    const vendor = resolveApplyVendor(update.draft, update.existing, defaultVendor, vendorsById);
    if (!vendor) continue;
    const product = draftToCatalogProduct(update.draft, vendor, update.existing);
    if (!product) continue;
    await persistVendorProductUpdate(product);
    await reactivateVendorProducts([product.id]);
    updated += 1;
  }

  const deactivateIds = plan.deactivations.map(item => item.existing.id);
  if (deactivateIds.length > 0) {
    await deactivateVendorProducts(deactivateIds);
    deactivated += deactivateIds.length;
  }

  return { created, updated, deactivated };
}

export function parseVendorProductImportCsv(
  text: string,
  defaultVendor?: Pick<Vendor, 'externalId' | 'name'>,
): VendorProductImportDraft[] {
  return parseVendorProductTemplateCsv(text).map(draft => normalizeDraft(draft, defaultVendor));
}

export function allVendorProductIds(): Set<string> {
  return new Set([
    ...VENDOR_PRODUCT_CATALOG.map(product => product.id),
    ...loadImportedVendorProducts().map(product => product.id),
  ]);
}
