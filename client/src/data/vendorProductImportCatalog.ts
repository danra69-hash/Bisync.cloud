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

function normalizeDraft(draft: VendorProductImportDraft): VendorProductImportDraft {
  return {
    ...draftDefaults(),
    ...draft,
    vendorProductId: draft.vendorProductId?.trim().toUpperCase() || undefined,
    productName: draft.productName.trim(),
    group: draft.group.trim() || 'Dry Goods',
    specification: draft.specification.trim(),
    deliveryUnitText: draft.deliveryUnitText.trim(),
    deliveryPrice: draft.deliveryPrice,
  };
}

function productToDraft(product: VendorProductCatalogItem): VendorProductImportDraft {
  return normalizeDraft({
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

function buildComparable(draft: VendorProductImportDraft): Record<keyof typeof TEMPLATE_FIELD_LABELS, string> {
  return {
    vendorProductId: draft.vendorProductId || '',
    productName: draft.productName,
    group: draft.group,
    specification: draft.specification,
    deliveryUnit: draft.deliveryUnitText,
    price: draft.deliveryPrice > 0 ? draft.deliveryPrice.toFixed(2) : '',
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
    vendorProductId: draft.vendorProductId || existing.id,
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
    const nameKey = draft.productName.trim().toLowerCase();
    const idKey = draft.vendorProductId?.trim().toUpperCase() ?? '';
    if (nameKey) {
      if (!byName.has(nameKey)) byName.set(nameKey, []);
      byName.get(nameKey)!.push(index);
    }
    if (idKey) {
      if (!byId.has(idKey)) byId.set(idKey, []);
      byId.get(idKey)!.push(index);
    }
  });

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

  const existingByName = new Map(
    existingProducts
      .filter(product => product.productName.trim())
      .map(product => [product.productName.trim().toLowerCase(), product]),
  );
  const existingById = new Map(
    existingProducts
      .filter(product => product.id.trim())
      .map(product => [product.id.trim().toUpperCase(), product]),
  );

  drafts.forEach((draft, index) => {
    const nameKey = draft.productName.trim().toLowerCase();
    const productId = draft.vendorProductId?.trim().toUpperCase() ?? '';
    const existingByProductId = productId ? existingById.get(productId) : undefined;
    const existingByProductName = nameKey ? existingByName.get(nameKey) : undefined;

    if (existingByProductId) {
      register(`e:${existingByProductId.id}`);
      conflictNodeUnion(parent, `t:${index}`, `e:${existingByProductId.id}`);
    } else if (existingByProductName) {
      register(`e:${existingByProductName.id}`);
      conflictNodeUnion(parent, `t:${index}`, `e:${existingByProductName.id}`);
    }
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
): VendorProductImportPlan {
  const normalizedDrafts = drafts.map(normalizeDraft);
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
  const byName = new Map(
    existingProducts.map(product => [product.productName.trim().toLowerCase(), product]),
  );
  const seenIds = new Map<string, string>();

  for (let index = 0; index < normalizedDrafts.length; index++) {
    if (blocked.has(index)) continue;

    const rawDraft = normalizedDrafts[index];
    const productId = rawDraft.vendorProductId?.trim().toUpperCase() ?? '';
    const nameKey = rawDraft.productName.trim().toLowerCase();

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
      : byName.get(nameKey);

    const draft = existing ? mergeDraftWithExisting(rawDraft, existing) : rawDraft;

    if (existing) {
      const changes = diffProduct(existing, draft);
      if (changes.length === 0) {
        plan.unchanged.push(existing);
      } else {
        plan.updates.push({ existing, draft, changes });
      }
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
  vendor: Vendor,
  existing?: VendorProductCatalogItem,
): VendorProductCatalogItem | null {
  const delivery = parseDeliveryUnitPath(draft.deliveryUnitText);
  if (!delivery) return null;

  const id = draft.vendorProductId?.trim().toUpperCase() || existing?.id;
  if (!id) return null;

  return {
    id,
    vendorExternalId: vendor.externalId,
    vendorName: vendor.name,
    productName: draft.productName.trim(),
    group: draft.group.trim() || 'Dry Goods',
    specification: draft.specification.trim(),
    deliveryPrice: draft.deliveryPrice,
    delivery,
    imageUrl: existing?.imageUrl ?? `https://picsum.photos/seed/${id.toLowerCase()}/80/80`,
    productPolicyTag: draft.productPolicyTag
      ?? existing?.productPolicyTag
      ?? inferCatalogProductPolicyTag({
        vendorExternalId: vendor.externalId,
        group: draft.group,
        specification: draft.specification,
      }, vendor.productPolicyTag),
  };
}

export function applyVendorProductImportPlan(
  plan: VendorProductImportPlan,
  vendor: Vendor,
): { created: number; updated: number; deactivated: number } {
  let created = 0;
  let updated = 0;
  let deactivated = 0;

  const activeCreates = plan.creates.filter(draft => draft.active !== false);
  if (activeCreates.length > 0) {
    const added = saveImportedVendorProducts(vendor.externalId, vendor.name, activeCreates);
    created += added.length;
  }

  for (const update of plan.updates) {
    if (update.draft.active === false) continue;
    const product = draftToCatalogProduct(update.draft, vendor, update.existing);
    if (!product) continue;
    persistVendorProductUpdate(product);
    reactivateVendorProducts([product.id]);
    updated += 1;
  }

  const deactivateIds = plan.deactivations.map(item => item.existing.id);
  if (deactivateIds.length > 0) {
    deactivateVendorProducts(deactivateIds);
    deactivated += deactivateIds.length;
  }

  return { created, updated, deactivated };
}

export function parseVendorProductImportCsv(text: string): VendorProductImportDraft[] {
  return parseVendorProductTemplateCsv(text).map(draft => normalizeDraft(draft));
}

export function allVendorProductIds(): Set<string> {
  return new Set([
    ...VENDOR_PRODUCT_CATALOG.map(product => product.id),
    ...loadImportedVendorProducts().map(product => product.id),
  ]);
}
