import {
  fromApiUom,
  generateComponentId,
  migrateInventoryUomsIntoComponentAlts,
  resolveDetailConfigForRow,
  serializeDetailConfig,
  toApiUom,
  type AltUnitEntry,
  type ComponentRow,
} from './componentForm';
import {
  componentParStockUomOptions,
  deriveDailyUsageFromParStock,
  exportComponentParStockFields,
  isValidComponentParStockUom,
} from './componentParStock';
import { countComponentTaggedVendors } from './vendorProductTagging';
import { componentMatchesLocations } from './createOrder';
import {
  loadStorageAssignment,
  resolveComponentAreaStorage,
} from './storageAssignment';

export type SmartComponentLocationOption = {
  externalId: string;
  name: string;
};

export type SmartComponentLocationScope = {
  companyLocations: SmartComponentLocationOption[];
  selectedLocationIds: string[];
};

export type SmartComponentImportDraft = {
  componentId: string;
  name: string;
  category: string;
  group: string;
  recipeUom: string;
  inventoryUom: string;
  altRecipeUnits: AltUnitEntry[];
  altInventoryUnits: AltUnitEntry[];
  area: string;
  lastPriceRecipe: number;
  lastPriceInventory: number;
  dailyUsage: number;
  orderFreqDays: number;
  storage: string[];
  storageNote: string;
  locations: string[];
  active: boolean;
  convertFromInventoryQty: string;
  convertToRecipeQty: string;
  parStockUom?: string;
  templateParStock?: number;
  templateLastUpdated?: string;
};

export type SmartComponentMergeCandidate = {
  key: string;
  label: string;
  source: 'template' | 'database';
  draft: SmartComponentImportDraft;
  existing?: ComponentRow;
  templateIndex?: number;
};

export type SmartComponentImportConflict = {
  key: string;
  reason: string;
  candidates: SmartComponentMergeCandidate[];
};

export type SmartComponentImportDeactivation = {
  existing: ComponentRow;
  reason: string;
};

export type SmartComponentMergeDisplay = {
  componentId: string;
  category: string;
  group: string;
  name: string;
  recipeUom: string;
  altRecipeUnit1: string;
  altRecipeConversion1: string;
  altRecipeUnit2: string;
  altRecipeConversion2: string;
  parStock: string;
  parStockUom: string;
  area: string;
  storage: string;
  active: boolean;
  sourceLabel: string;
};

export type SmartComponentFieldChange = {
  field: string;
  label: string;
  before: string;
  after: string;
};

export type SmartComponentImportUpdate = {
  existing: ComponentRow;
  draft: SmartComponentImportDraft;
  changes: SmartComponentFieldChange[];
};

export type SmartComponentImportPlan = {
  creates: SmartComponentImportDraft[];
  updates: SmartComponentImportUpdate[];
  unchanged: ComponentRow[];
  errors: string[];
  conflicts: SmartComponentImportConflict[];
  deactivations: SmartComponentImportDeactivation[];
};

/** My Component template export/import headers (editable catalog fields only). */
export const SMART_COMPONENT_TEMPLATE_HEADERS = [
  'Component ID',
  'Category',
  'Group',
  'Name',
  'Principal Component',
  'Alternate Component Unit 1',
  'Conversion 1',
  'Alternate Component Unit 2',
  'Conversion 2',
  'Alternate Component Unit 3',
  'Conversion 3',
  'Alternate Component Unit 4',
  'Conversion 4',
  'Alternate Component Unit 5',
  'Conversion 5',
  'Par Stock',
  'Par Stock UOM',
  'Area',
  'Storage',
  'Active',
  'Last Updated',
] as const;

const PREVIOUS_TEMPLATE_HEADERS = [
  'Component ID',
  'Category',
  'Group',
  'Name',
  'Principal Component Unit',
  'Alternate Component Unit 1',
  'Conversion 1',
  'Alternate Component Unit 2',
  'Conversion 2',
  'Principal Inventory Unit',
  'Alternate Inventory Unit 1',
  'Alternate inventory conversion 1',
  'Alternate Inventory Unit 2',
  'Alternate inventory conversion 2',
  'Area',
  'Storage',
  'Location',
  'Last Updated',
] as const;

const LEGACY_TEMPLATE_HEADERS = [
  'Component ID',
  'Component Name',
  'Category',
  'Group',
  'Recipe UOM',
  'Inventory UOM',
  'Last Price (Recipe)',
  'Last Price (Inventory)',
  'Daily Usage',
  'Order Freq (days)',
  'Storage',
  'Storage Note',
  'Locations',
  'Active',
  'Last Updated',
] as const;

const TEMPLATE_FIELD_LABELS: Record<string, string> = {
  componentId: 'Component ID',
  category: 'Category',
  group: 'Group',
  name: 'Name',
  recipeUOM: 'Principal Component',
  altRecipeUnit1: 'Alternate Component Unit 1',
  altRecipeConversion1: 'Conversion 1',
  altRecipeUnit2: 'Alternate Component Unit 2',
  altRecipeConversion2: 'Conversion 2',
  altRecipeUnit3: 'Alternate Component Unit 3',
  altRecipeConversion3: 'Conversion 3',
  altRecipeUnit4: 'Alternate Component Unit 4',
  altRecipeConversion4: 'Conversion 4',
  altRecipeUnit5: 'Alternate Component Unit 5',
  altRecipeConversion5: 'Conversion 5',
  // Legacy import labels retained for merge compare of older files only.
  inventoryUOM: 'Principal Inventory Unit (legacy)',
  principalInventoryConversion: 'Principal inventory Conversion (legacy)',
  altInventoryUnit1: 'Alternate Inventory Unit 1 (legacy)',
  altInventoryConversion1: 'Alternate inventory conversion 1 (legacy)',
  altInventoryUnit2: 'Alternate Inventory Unit 2 (legacy)',
  altInventoryConversion2: 'Alternate inventory conversion 2 (legacy)',
  lastPriceRecipe: 'Last UOM Price',
  dailyUsage: 'Daily Usage',
  orderFreqDays: 'Order Freq (days)',
  parStock: 'Par Stock',
  parStockUom: 'Par Stock UOM',
  area: 'Area',
  storage: 'Storage',
  locations: 'Location',
  active: 'Active',
  lastUpdated: 'Last Updated',
};

type TemplateColumnAccessor = {
  variant: 'revised' | 'previous';
  value: (aliases: string[], fallbackIndex: number) => string;
};

function normalizeTemplateHeader(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, ' ');
}

function buildTemplateColumnAccessor(
  headers: string[],
  cols: string[],
  variant: 'revised' | 'previous',
): TemplateColumnAccessor {
  const indexByHeader = new Map<string, number>();
  headers.forEach((header, index) => {
    indexByHeader.set(normalizeTemplateHeader(header), index);
  });

  return {
    variant,
    value: (aliases, fallbackIndex) => {
      for (const alias of aliases) {
        const index = indexByHeader.get(normalizeTemplateHeader(alias));
        if (index !== undefined) return cols[index]?.trim() ?? '';
      }
      // Negative fallback means "optional / absent in older templates" — do not
      // read another column by position (that mis-maps Par Stock, Storage, etc.).
      if (fallbackIndex < 0) return '';
      return cols[fallbackIndex]?.trim() ?? '';
    },
  };
}

function detectTemplateVariant(headers: string[]): 'revised' | 'previous' {
  const normalized = new Set(headers.map(normalizeTemplateHeader));
  if (normalized.has('par stock') || normalized.has('principal inventory conversion')) {
    return 'revised';
  }
  return 'previous';
}

function parseCsvLine(line: string): string[] {
  const values: string[] = [];
  let current = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (ch === ',' && !inQuotes) {
      values.push(current.trim());
      current = '';
    } else {
      current += ch;
    }
  }
  values.push(current.trim());
  return values.map(v => v.replace(/^"|"$/g, '').trim());
}

function isLegacyTemplateHeader(cols: string[]): boolean {
  return (cols[1]?.toLowerCase() ?? '').includes('component name');
}

function isTemplateHeader(cols: string[]): boolean {
  const first = cols[0]?.toLowerCase() ?? '';
  return first.includes('component id');
}

function formatListField(values: string[]): string {
  return values.filter(Boolean).join('; ');
}

function parseListField(raw: string): string[] {
  if (!raw.trim()) return [];
  return raw.split(/[;|]/).map(v => v.trim()).filter(Boolean);
}

function parseActive(raw: string): boolean {
  const value = raw.trim().toLowerCase();
  if (!value) return true;
  return ['yes', 'y', 'true', '1', 'active'].includes(value);
}

function formatDisplayDate(value?: string): string {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleString();
}

function normalizeUom(value: string): string {
  const trimmed = value.trim();
  if (!trimmed) return '';
  return toApiUom(fromApiUom(trimmed) || trimmed);
}

function getScopedLocations(scope?: SmartComponentLocationScope): SmartComponentLocationOption[] {
  if (!scope || scope.selectedLocationIds.length === 0) return [];
  const selected = new Set(scope.selectedLocationIds);
  return scope.companyLocations.filter(location => selected.has(location.externalId));
}

function resolveTemplateLocationNames(
  componentLocations: string[],
  scope?: SmartComponentLocationScope,
): string {
  const scoped = getScopedLocations(scope);
  if (scoped.length === 0) {
    if (componentLocations.includes('all')) return 'All';
    return formatListField(componentLocations);
  }

  if (componentLocations.includes('all')) {
    return formatListField(scoped.map(location => location.name));
  }

  const matched = scoped.filter(location => componentLocations.includes(location.externalId));
  return formatListField(matched.map(location => location.name));
}

export function resolveLocationsFromTemplate(
  rawLocations: string[],
  scope?: SmartComponentLocationScope,
): string[] {
  if (!scope || scope.selectedLocationIds.length === 0) {
    if (rawLocations.length === 0) return ['all'];
    const lower = rawLocations.map(value => value.trim().toLowerCase());
    if (lower.includes('all')) return ['all'];
    return rawLocations;
  }

  const scoped = getScopedLocations(scope);
  const nameToId = new Map(
    scoped.map(location => [location.name.trim().toLowerCase(), location.externalId]),
  );
  const idSet = new Set(scoped.map(location => location.externalId));
  const resolved: string[] = [];

  for (const value of rawLocations) {
    const trimmed = value.trim();
    if (!trimmed) continue;
    const lower = trimmed.toLowerCase();
    if (lower === 'all') {
      return scoped.length === scope.companyLocations.length
        ? ['all']
        : scoped.map(location => location.externalId);
    }
    const byName = nameToId.get(lower);
    if (byName) {
      resolved.push(byName);
      continue;
    }
    if (idSet.has(trimmed)) {
      resolved.push(trimmed);
    }
  }

  const unique = [...new Set(resolved)];
  if (unique.length === 0) {
    return scoped.length === scope.companyLocations.length
      ? ['all']
      : scoped.map(location => location.externalId);
  }

  const allCompanyIds = scope.companyLocations.map(location => location.externalId);
  if (allCompanyIds.length > 0 && allCompanyIds.every(id => unique.includes(id))) {
    return ['all'];
  }

  return unique;
}

function filterRowsForLocationScope(
  rows: ComponentRow[],
  scope?: SmartComponentLocationScope,
): ComponentRow[] {
  if (!scope || scope.selectedLocationIds.length === 0) return rows;
  return rows.filter(row => componentMatchesLocations(row, scope.selectedLocationIds));
}

function resolveRowLocationExternalIds(
  row: ComponentRow,
  scope?: SmartComponentLocationScope,
): string[] {
  if (!scope || scope.selectedLocationIds.length === 0) {
    return row.locations.filter(location => location !== 'all');
  }

  const scoped = getScopedLocations(scope);
  if (row.locations.includes('all')) {
    return scoped.map(location => location.externalId);
  }

  const matched = scoped.filter(location => row.locations.includes(location.externalId));
  if (matched.length === 0) {
    return row.locations.filter(location => location !== 'all');
  }

  return matched.map(location => location.externalId);
}

function resolveTemplateArea(
  row: ComponentRow,
  scope?: SmartComponentLocationScope,
): string {
  const assignment = loadStorageAssignment();
  const locationIds = resolveRowLocationExternalIds(row, scope);
  return resolveComponentAreaStorage(row.storage, locationIds, assignment).areas;
}

function formatAltUnitPair(
  alt: AltUnitEntry | undefined,
): [unit: string, conversion: string] {
  if (!alt?.unit?.trim()) return ['', ''];
  const unit = fromApiUom(alt.unit) || alt.unit;
  const fromQty = alt.fromQty?.trim() || '1';
  const qty = alt.qty?.trim() || '';
  if (!qty) return [unit, ''];
  const conversion = fromQty === '1' ? qty : `${fromQty} = ${qty}`;
  return [unit, conversion];
}

function parseAltUnitPair(unit: string, conversion: string): AltUnitEntry | null {
  const trimmedUnit = unit.trim();
  if (!trimmedUnit) return null;

  const conv = conversion.trim();
  if (!conv) {
    return { unit: trimmedUnit, fromQty: '1', qty: '' };
  }

  if (conv.includes('=')) {
    const [left, right] = conv.split('=').map(part => part.trim());
    return {
      unit: trimmedUnit,
      fromQty: left || '1',
      qty: right || '',
    };
  }

  return { unit: trimmedUnit, fromQty: '1', qty: conv };
}

function parseAltUnitsFromColumns(...unitAndConversions: string[]): AltUnitEntry[] {
  const units: AltUnitEntry[] = [];
  for (let i = 0; i + 1 < unitAndConversions.length; i += 2) {
    const entry = parseAltUnitPair(unitAndConversions[i] ?? '', unitAndConversions[i + 1] ?? '');
    if (entry) units.push(entry);
  }
  return units;
}

function formatPrincipalInventoryConversion(
  convertFromInventoryQty: string,
  convertToRecipeQty: string,
): string {
  const fromQty = convertFromInventoryQty?.trim() || '1';
  const qty = convertToRecipeQty?.trim() || '';
  if (!qty || qty === '1') return '';
  return fromQty === '1' ? qty : `${fromQty} = ${qty}`;
}

function parsePrincipalInventoryConversion(
  conversion: string,
): { convertFromInventoryQty: string; convertToRecipeQty: string } {
  const conv = conversion.trim();
  if (!conv) {
    return { convertFromInventoryQty: '1', convertToRecipeQty: '1' };
  }

  if (conv.includes('=')) {
    const [left, right] = conv.split('=').map(part => part.trim());
    return {
      convertFromInventoryQty: left || '1',
      convertToRecipeQty: right || '1',
    };
  }

  return { convertFromInventoryQty: '1', convertToRecipeQty: conv };
}

function applyParStockFromTemplate(
  draft: SmartComponentImportDraft,
  parStockRaw: string,
  parStockUomRaw: string,
): SmartComponentImportDraft {
  const parStock = parseFloat(String(parStockRaw).replace(/[^0-9.-]/g, '')) || 0;
  if (parStock <= 0) return draft;

  const recipeUom = fromApiUom(draft.recipeUom) || draft.recipeUom;
  const parStockUom = (fromApiUom(parStockUomRaw) || parStockUomRaw || recipeUom).trim();
  const orderFreqDays = draft.orderFreqDays > 0 ? draft.orderFreqDays : 7;
  const dailyUsage = deriveDailyUsageFromParStock(parStock, parStockUom, orderFreqDays, {
    recipeUom: draft.recipeUom,
    inventoryUom: draft.inventoryUom,
    altRecipeUnits: draft.altRecipeUnits,
    altInventoryUnits: draft.altInventoryUnits,
    convertFromInventoryQty: draft.convertFromInventoryQty,
    convertToRecipeQty: draft.convertToRecipeQty,
  });

  if (dailyUsage === null) return { ...draft, parStockUom };

  return {
    ...draft,
    dailyUsage,
    orderFreqDays,
    parStockUom,
  };
}

function blankImportDraftDefaults(): Pick<
  SmartComponentImportDraft,
  | 'lastPriceRecipe'
  | 'lastPriceInventory'
  | 'dailyUsage'
  | 'orderFreqDays'
  | 'storageNote'
  | 'active'
  | 'convertFromInventoryQty'
  | 'convertToRecipeQty'
> {
  return {
    lastPriceRecipe: 0,
    lastPriceInventory: 0,
    dailyUsage: 0,
    orderFreqDays: 7,
    storageNote: '',
    active: true,
    convertFromInventoryQty: '1',
    convertToRecipeQty: '1',
  };
}

function mergeDraftWithExisting(
  draft: SmartComponentImportDraft,
  existing: ComponentRow,
): SmartComponentImportDraft {
  const detail = resolveDetailConfigForRow(existing);
  const merged: SmartComponentImportDraft = {
    ...draft,
    lastPriceRecipe: draft.lastPriceRecipe > 0 ? draft.lastPriceRecipe : existing.lastPriceRecipe,
    lastPriceInventory: draft.lastPriceInventory > 0 ? draft.lastPriceInventory : existing.lastPriceInventory,
    orderFreqDays: draft.orderFreqDays > 0 ? draft.orderFreqDays : existing.orderFreqDays,
    storageNote: draft.storageNote || existing.storageNote || '',
    active: draft.active,
    convertFromInventoryQty: draft.convertFromInventoryQty || detail.convertFromInventoryQty || '1',
    convertToRecipeQty: draft.convertToRecipeQty || detail.convertToRecipeQty || '1',
    dailyUsage: draft.dailyUsage > 0 ? draft.dailyUsage : existing.dailyUsage,
    // Location is no longer on the download template — keep existing when omitted.
    locations: draft.locations.length > 0 ? draft.locations : existing.locations,
  };

  if (draft.templateParStock !== undefined && draft.templateParStock > 0) {
    return applyParStockFromTemplate(
      merged,
      String(draft.templateParStock),
      draft.parStockUom || fromApiUom(existing.recipeUOM) || existing.recipeUOM,
    );
  }

  return merged;
}

export function prepareImportDraftForSave(draft: SmartComponentImportDraft): SmartComponentImportDraft {
  if (draft.templateParStock !== undefined && draft.templateParStock > 0) {
    return applyParStockFromTemplate(
      draft,
      String(draft.templateParStock),
      draft.parStockUom || draft.recipeUom,
    );
  }
  return draft;
}

function rowToCsvLine(row: ComponentRow, scope?: SmartComponentLocationScope): string[] {
  const detail = resolveDetailConfigForRow(row);
  const migrated = migrateInventoryUomsIntoComponentAlts({
    recipeUnit: fromApiUom(row.recipeUOM),
    inventoryUnit: fromApiUom(row.inventoryUOM),
    altRecipeUnits: detail.altRecipeUnits,
    altInventoryUnits: detail.altInventoryUnits,
    convertFromInventoryQty: detail.convertFromInventoryQty,
    convertToRecipeQty: detail.convertToRecipeQty,
  });
  const altPairs = [0, 1, 2, 3, 4].map(i => formatAltUnitPair(migrated.altRecipeUnits[i]));
  const parStockFields = exportComponentParStockFields(row);

  return [
    row.componentId || '',
    row.category,
    row.group,
    row.name,
    migrated.recipeUnit,
    ...altPairs.flatMap(pair => [pair[0], pair[1]]),
    parStockFields.parStock,
    parStockFields.parStockUom,
    resolveTemplateArea(row, scope),
    formatListField(row.storage),
    row.active ? 'Yes' : 'No',
    formatDisplayDate(row.updatedAt),
  ];
}

function rowToDraft(
  cols: string[],
  scope?: SmartComponentLocationScope,
  headers: string[] = [...SMART_COMPONENT_TEMPLATE_HEADERS],
): SmartComponentImportDraft | null {
  const variant = detectTemplateVariant(headers);
  const accessor = buildTemplateColumnAccessor(headers, cols, variant);
  const get = (aliases: string[], fallbackIndex: number) => accessor.value(aliases, fallbackIndex);

  const name = get(['Name'], 3);
  if (!name) return null;

  const recipeUom = get(['Principal Component', 'Principal Component Unit'], 4);
  if (!recipeUom) return null;
  // Legacy templates may still include Principal Inventory Unit; fold into component alts on save.
  const inventoryUom = get(['Principal Inventory Unit'], 9) || recipeUom;

  const principalInventoryConversion = parsePrincipalInventoryConversion(
    get(['Principal inventory Conversion'], 10),
  );
  const storage = parseListField(get(['Storage'], 18));
  const hasLocationColumn = headers.some(h => {
    const key = normalizeTemplateHeader(h);
    return key === 'location' || key === 'locations';
  });
  const locations = hasLocationColumn
    ? resolveLocationsFromTemplate(
      parseListField(get(['Location', 'Locations'], -1)),
      scope,
    )
    : [];
  const parStockRaw = get(['Par Stock'], 15);
  const parStockUomRaw = get(['Par Stock UOM'], 16);
  const templateParStock = parseFloat(String(parStockRaw).replace(/[^0-9.-]/g, '')) || 0;
  // Optional / removed-from-template columns — header-name only (fallback -1).
  const lastPriceRecipe = parseFloat(String(get(['Last UOM Price', 'Last Price (Recipe)'], -1)).replace(/[^0-9.-]/g, '')) || 0;
  const dailyUsageRaw = get(['Daily Usage'], -1);
  const dailyUsage = parseFloat(String(dailyUsageRaw).replace(/[^0-9.-]/g, '')) || 0;
  const orderFreqRaw = get(['Order Freq (days)', 'Order Freq'], -1);
  const orderFreqDays = parseInt(String(orderFreqRaw).replace(/[^0-9]/g, ''), 10) || 7;
  const activeRaw = get(['Active'], 19);

  const altRecipeUnits = parseAltUnitsFromColumns(
    get(['Alternate Component Unit 1', 'Unit Alternate Component Unit 1'], 5),
    get(['Conversion 1'], 6),
    get(['Alternate Component Unit 2'], 7),
    get(['Conversion 2'], 8),
    get(['Alternate Component Unit 3'], 9),
    get(['Conversion 3'], 10),
    get(['Alternate Component Unit 4'], 11),
    get(['Conversion 4'], 12),
    get(['Alternate Component Unit 5'], 13),
    get(['Conversion 5'], 14),
  );

  const draftRow: SmartComponentImportDraft = {
    ...blankImportDraftDefaults(),
    componentId: get(['Component ID'], 0).toUpperCase(),
    category: get(['Category'], 1) || 'Food',
    group: get(['Group'], 2) || 'Dry Goods',
    name,
    recipeUom,
    inventoryUom: recipeUom,
    altRecipeUnits,
    // Legacy inventory columns still parsed so migrateInventoryUomsIntoComponentAlts can fold them.
    altInventoryUnits: parseAltUnitsFromColumns(
      get(['Alternate Inventory Unit 1'], variant === 'revised' ? 11 : 10),
      get(['Alternate inventory conversion 1'], variant === 'revised' ? 12 : 11),
      get(['Alternate Inventory Unit 2'], variant === 'revised' ? 13 : 12),
      get(['Alternate inventory conversion 2'], variant === 'revised' ? 14 : 13),
    ),
    convertFromInventoryQty: inventoryUom !== recipeUom
      ? principalInventoryConversion.convertFromInventoryQty
      : '1',
    convertToRecipeQty: inventoryUom !== recipeUom
      ? principalInventoryConversion.convertToRecipeQty
      : '1',
    lastPriceRecipe,
    dailyUsage,
    orderFreqDays,
    storage,
    locations,
    active: activeRaw ? parseActive(activeRaw) : true,
    templateParStock: templateParStock > 0 ? templateParStock : undefined,
    parStockUom: parStockUomRaw || undefined,
    templateLastUpdated: get(['Last Updated'], 20) || undefined,
    area: get(['Area'], 17) || resolveTemplateArea(
      { storage, locations } as ComponentRow,
      scope,
    ),
  };

  if (templateParStock > 0) {
    return applyParStockFromTemplate(draftRow, parStockRaw, parStockUomRaw || recipeUom);
  }

  return draftRow;
}

function rowToDraftLegacy(cols: string[], scope?: SmartComponentLocationScope): SmartComponentImportDraft | null {
  if (cols.length < 14) return null;

  const name = cols[1]?.trim() ?? '';
  if (!name) return null;

  const recipeUom = cols[4]?.trim() ?? '';
  if (!recipeUom) return null;
  const inventoryUom = cols[5]?.trim() || recipeUom;

  return {
    componentId: cols[0]?.trim().toUpperCase() ?? '',
    name,
    category: cols[2]?.trim() || 'Food',
    group: cols[3]?.trim() || 'Dry Goods',
    recipeUom,
    inventoryUom,
    altRecipeUnits: [],
    altInventoryUnits: [],
    lastPriceRecipe: parseFloat(String(cols[6]).replace(/[^0-9.-]/g, '')) || 0,
    lastPriceInventory: parseFloat(String(cols[7]).replace(/[^0-9.-]/g, '')) || 0,
    dailyUsage: parseFloat(String(cols[8]).replace(/[^0-9.-]/g, '')) || 0,
    orderFreqDays: parseInt(String(cols[9]).replace(/[^0-9]/g, ''), 10) || 7,
    storage: parseListField(cols[10] ?? ''),
    storageNote: cols[11]?.trim() ?? '',
    locations: resolveLocationsFromTemplate(parseListField(cols[12] ?? ''), scope),
    active: parseActive(cols[13] ?? 'Yes'),
    convertFromInventoryQty: '1',
    convertToRecipeQty: '1',
    templateLastUpdated: cols[14]?.trim() || undefined,
    area: '',
  };
}

export function buildSmartComponentTemplateCsv(
  existingRows: ComponentRow[],
  scope?: SmartComponentLocationScope,
): string {
  const scopedRows = filterRowsForLocationScope(existingRows, scope);
  const sorted = [...scopedRows].sort((a, b) =>
    (a.componentId || a.name).localeCompare(b.componentId || b.name),
  );
  const rows = sorted.length > 0
    ? sorted.map(row => rowToCsvLine(row, scope))
    : [[
      '',
      'Food',
      'Proteins',
      'Sample Chicken Breast',
      'Gr',
      'Kg',
      '1000',
      '',
      '',
      '',
      '',
      '',
      '',
      '',
      '',
      '14',
      'Gr',
      'Kitchen',
      'Chiller',
      'Yes',
      '',
    ]];

  return [SMART_COMPONENT_TEMPLATE_HEADERS, ...rows]
    .map(row => row.map(value => `"${String(value).replace(/"/g, '""')}"`).join(','))
    .join('\n');
}

export function downloadSmartComponentTemplateCsv(
  existingRows: ComponentRow[],
  scope?: SmartComponentLocationScope,
): void {
  const blob = new Blob([buildSmartComponentTemplateCsv(existingRows, scope)], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = 'smart-component-template.csv';
  link.click();
  URL.revokeObjectURL(url);
}

export function parseSmartComponentTemplateCsv(
  text: string,
  scope?: SmartComponentLocationScope,
): SmartComponentImportDraft[] {
  const lines = text.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
  if (lines.length <= 1) return [];

  const headerCols = parseCsvLine(lines[0]);
  const legacy = isLegacyTemplateHeader(headerCols);
  const hasHeader = isTemplateHeader(headerCols) || legacy;
  const templateHeaders = legacy
    ? [...LEGACY_TEMPLATE_HEADERS]
    : hasHeader
      ? headerCols
      : [...SMART_COMPONENT_TEMPLATE_HEADERS];
  const dataLines = hasHeader ? lines.slice(1) : lines;

  return dataLines
    .map(parseCsvLine)
    .map(cols => (legacy ? rowToDraftLegacy(cols, scope) : rowToDraft(cols, scope, templateHeaders)))
    .filter((draft): draft is SmartComponentImportDraft => draft !== null);
}

type TemplateComparable = Record<keyof typeof TEMPLATE_FIELD_LABELS, string>;

function buildTemplateComparable(
  row: {
    componentId: string;
    name: string;
    category: string;
    group: string;
    recipeUOM: string;
    inventoryUOM: string;
    storage: string[];
    locations: string[];
    updatedAt?: string;
    altRecipeUnits: AltUnitEntry[];
    altInventoryUnits: AltUnitEntry[];
    convertFromInventoryQty?: string;
    convertToRecipeQty?: string;
    lastPriceRecipe?: number;
    dailyUsage?: number;
    orderFreqDays?: number;
    parStockUom?: string;
    active?: boolean;
  },
  scope?: SmartComponentLocationScope,
): TemplateComparable {
  const altRecipe0 = formatAltUnitPair(row.altRecipeUnits[0]);
  const altRecipe1 = formatAltUnitPair(row.altRecipeUnits[1]);
  const altRecipe2 = formatAltUnitPair(row.altRecipeUnits[2]);
  const altRecipe3 = formatAltUnitPair(row.altRecipeUnits[3]);
  const altRecipe4 = formatAltUnitPair(row.altRecipeUnits[4]);
  const altInventory0 = formatAltUnitPair(row.altInventoryUnits[0]);
  const altInventory1 = formatAltUnitPair(row.altInventoryUnits[1]);
  const parStockFields = row.dailyUsage !== undefined && row.orderFreqDays !== undefined
    ? exportComponentParStockFields(
      {
        componentId: row.componentId,
        name: row.name,
        category: row.category,
        group: row.group,
        recipeUOM: row.recipeUOM,
        inventoryUOM: row.inventoryUOM,
        lastPriceRecipe: row.lastPriceRecipe ?? 0,
        lastPriceInventory: 0,
        dailyUsage: row.dailyUsage,
        orderFreqDays: row.orderFreqDays,
        storage: row.storage,
        attachedProducts: 0,
        attachedVendors: 0,
        active: row.active ?? true,
        locations: row.locations,
        detailConfig: {
          altRecipeUnits: row.altRecipeUnits,
          altInventoryUnits: row.altInventoryUnits,
          convertFromInventoryQty: row.convertFromInventoryQty || '1',
          convertToRecipeQty: row.convertToRecipeQty || '1',
          taggedVendorProductIds: [],
          vendorProductPrincipalQty: {},
          vendorProductLossYield: {},
          vendorProductComponentUom: {},
          vendorProductLocations: {},
          vendor: '',
          vendorProduct: '',
          deliveryUnitPrice: '',
        },
      },
      row.parStockUom,
    )
    : { parStock: '', parStockUom: '' };

  return {
    componentId: row.componentId || '',
    category: row.category,
    group: row.group,
    name: row.name,
    recipeUOM: fromApiUom(row.recipeUOM),
    altRecipeUnit1: altRecipe0[0],
    altRecipeConversion1: altRecipe0[1],
    altRecipeUnit2: altRecipe1[0],
    altRecipeConversion2: altRecipe1[1],
    altRecipeUnit3: altRecipe2[0],
    altRecipeConversion3: altRecipe2[1],
    altRecipeUnit4: altRecipe3[0],
    altRecipeConversion4: altRecipe3[1],
    altRecipeUnit5: altRecipe4[0],
    altRecipeConversion5: altRecipe4[1],
    inventoryUOM: fromApiUom(row.inventoryUOM),
    principalInventoryConversion: formatPrincipalInventoryConversion(
      row.convertFromInventoryQty || '1',
      row.convertToRecipeQty || '1',
    ),
    altInventoryUnit1: altInventory0[0],
    altInventoryConversion1: altInventory0[1],
    altInventoryUnit2: altInventory1[0],
    altInventoryConversion2: altInventory1[1],
    lastPriceRecipe: row.lastPriceRecipe && row.lastPriceRecipe > 0 ? String(row.lastPriceRecipe) : '',
    dailyUsage: row.dailyUsage && row.dailyUsage > 0 ? String(row.dailyUsage) : '',
    orderFreqDays: row.orderFreqDays && row.orderFreqDays > 0 ? String(row.orderFreqDays) : '',
    parStock: parStockFields.parStock,
    parStockUom: parStockFields.parStockUom,
    area: resolveTemplateArea(
      {
        storage: row.storage,
        locations: row.locations,
      } as ComponentRow,
      scope,
    ),
    storage: formatListField(row.storage),
    locations: resolveTemplateLocationNames(row.locations, scope),
    active: row.active === false ? 'No' : 'Yes',
    lastUpdated: formatDisplayDate(row.updatedAt),
  };
}

function draftToComparableRow(draft: SmartComponentImportDraft): ComponentRow {
  const migrated = migrateInventoryUomsIntoComponentAlts({
    recipeUnit: fromApiUom(draft.recipeUom) || draft.recipeUom,
    inventoryUnit: fromApiUom(draft.inventoryUom) || draft.inventoryUom || draft.recipeUom,
    altRecipeUnits: draft.altRecipeUnits,
    altInventoryUnits: draft.altInventoryUnits,
    convertFromInventoryQty: draft.convertFromInventoryQty || '1',
    convertToRecipeQty: draft.convertToRecipeQty || '1',
  });
  return {
    componentId: draft.componentId,
    name: draft.name,
    category: draft.category,
    group: draft.group,
    recipeUOM: normalizeUom(migrated.recipeUnit),
    inventoryUOM: normalizeUom(migrated.inventoryUnit),
    lastPriceRecipe: draft.lastPriceRecipe,
    lastPriceInventory: draft.lastPriceInventory,
    dailyUsage: draft.dailyUsage,
    orderFreqDays: draft.orderFreqDays,
    storage: draft.storage.length > 0 ? draft.storage : ['Dry Store'],
    storageNote: draft.storageNote,
    attachedProducts: 0,
    attachedVendors: 0,
    active: draft.active,
    locations: draft.locations.length > 0 ? draft.locations : ['all'],
    detailConfig: {
      altRecipeUnits: migrated.altRecipeUnits,
      altInventoryUnits: [],
      convertFromInventoryQty: '1',
      convertToRecipeQty: '1',
      taggedVendorProductIds: [],
      vendorProductPrincipalQty: {},
      vendorProductLossYield: {},
      vendorProductComponentUom: {},
      vendorProductLocations: {},
      vendor: '',
      vendorProduct: '',
      deliveryUnitPrice: '',
    },
  };
}

function diffRows(
  existing: ComponentRow,
  draft: SmartComponentImportDraft,
  scope?: SmartComponentLocationScope,
): SmartComponentFieldChange[] {
  const existingDetail = resolveDetailConfigForRow(existing);
  const before = buildTemplateComparable(
    {
      ...existing,
      altRecipeUnits: existingDetail.altRecipeUnits,
      altInventoryUnits: existingDetail.altInventoryUnits,
      convertFromInventoryQty: existingDetail.convertFromInventoryQty,
      convertToRecipeQty: existingDetail.convertToRecipeQty,
      lastPriceRecipe: existing.lastPriceRecipe,
      dailyUsage: existing.dailyUsage,
      orderFreqDays: existing.orderFreqDays,
      active: existing.active,
    },
    scope,
  );
  const next = buildTemplateComparable(
    {
      ...draftToComparableRow(draft),
      altRecipeUnits: draft.altRecipeUnits,
      altInventoryUnits: draft.altInventoryUnits,
      convertFromInventoryQty: draft.convertFromInventoryQty,
      convertToRecipeQty: draft.convertToRecipeQty,
      lastPriceRecipe: draft.lastPriceRecipe,
      dailyUsage: draft.dailyUsage,
      orderFreqDays: draft.orderFreqDays,
      parStockUom: draft.parStockUom,
      active: draft.active,
    },
    scope,
  );

  const changes: SmartComponentFieldChange[] = [];
  for (const field of Object.keys(TEMPLATE_FIELD_LABELS) as Array<keyof typeof TEMPLATE_FIELD_LABELS>) {
    if (field === 'lastUpdated') continue;
    const beforeValue = before[field];
    const afterValue = next[field];
    if (beforeValue !== afterValue) {
      changes.push({
        field,
        label: TEMPLATE_FIELD_LABELS[field] ?? field,
        before: beforeValue,
        after: afterValue,
      });
    }
  }

  return changes;
}

type ConflictNodeId = `t:${number}` | `e:${number}`;

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

export function existingRowToImportDraft(
  row: ComponentRow,
  scope?: SmartComponentLocationScope,
): SmartComponentImportDraft {
  const detail = resolveDetailConfigForRow(row);
  const comparable = buildTemplateComparable(
    {
      componentId: row.componentId,
      name: row.name,
      category: row.category,
      group: row.group,
      recipeUOM: row.recipeUOM,
      inventoryUOM: row.inventoryUOM,
      storage: row.storage,
      locations: row.locations,
      updatedAt: row.updatedAt,
      altRecipeUnits: detail.altRecipeUnits,
      altInventoryUnits: detail.altInventoryUnits,
      convertFromInventoryQty: detail.convertFromInventoryQty,
      convertToRecipeQty: detail.convertToRecipeQty,
      lastPriceRecipe: row.lastPriceRecipe,
      dailyUsage: row.dailyUsage,
      orderFreqDays: row.orderFreqDays,
      active: row.active,
    },
    scope,
  );

  return {
    componentId: row.componentId,
    name: row.name,
    category: row.category,
    group: row.group,
    recipeUom: comparable.recipeUOM,
    inventoryUom: comparable.inventoryUOM,
    altRecipeUnits: detail.altRecipeUnits,
    altInventoryUnits: detail.altInventoryUnits,
    convertFromInventoryQty: detail.convertFromInventoryQty || '1',
    convertToRecipeQty: detail.convertToRecipeQty || '1',
    area: comparable.area,
    lastPriceRecipe: row.lastPriceRecipe,
    lastPriceInventory: row.lastPriceInventory,
    dailyUsage: row.dailyUsage,
    orderFreqDays: row.orderFreqDays,
    storage: row.storage,
    storageNote: row.storageNote ?? '',
    locations: row.locations,
    active: row.active,
    parStockUom: comparable.parStockUom || undefined,
  };
}

export function buildMergeDisplayFromDraft(
  draft: SmartComponentImportDraft,
  sourceLabel: string,
): SmartComponentMergeDisplay {
  const migrated = migrateInventoryUomsIntoComponentAlts({
    recipeUnit: fromApiUom(draft.recipeUom) || draft.recipeUom,
    inventoryUnit: fromApiUom(draft.inventoryUom) || draft.inventoryUom || draft.recipeUom,
    altRecipeUnits: draft.altRecipeUnits,
    altInventoryUnits: draft.altInventoryUnits,
    convertFromInventoryQty: draft.convertFromInventoryQty,
    convertToRecipeQty: draft.convertToRecipeQty,
  });
  const altRecipe0 = formatAltUnitPair(migrated.altRecipeUnits[0]);
  const altRecipe1 = formatAltUnitPair(migrated.altRecipeUnits[1]);
  const parStockFields = exportComponentParStockFields(
    {
      componentId: draft.componentId,
      name: draft.name,
      category: draft.category,
      group: draft.group,
      recipeUOM: normalizeUom(migrated.recipeUnit),
      inventoryUOM: normalizeUom(migrated.inventoryUnit),
      lastPriceRecipe: draft.lastPriceRecipe,
      lastPriceInventory: draft.lastPriceInventory,
      dailyUsage: draft.dailyUsage,
      orderFreqDays: draft.orderFreqDays,
      storage: draft.storage,
      attachedProducts: 0,
      attachedVendors: 0,
      active: draft.active,
      locations: draft.locations,
      detailConfig: {
        altRecipeUnits: migrated.altRecipeUnits,
        altInventoryUnits: [],
        convertFromInventoryQty: '1',
        convertToRecipeQty: '1',
        taggedVendorProductIds: [],
        vendorProductPrincipalQty: {},
        vendorProductLossYield: {},
        vendorProductComponentUom: {},
        vendorProductLocations: {},
        vendor: '',
        vendorProduct: '',
        deliveryUnitPrice: '',
      },
    },
    draft.parStockUom,
  );
  return {
    componentId: draft.componentId || '—',
    category: draft.category,
    group: draft.group,
    name: draft.name,
    recipeUom: migrated.recipeUnit || draft.recipeUom,
    altRecipeUnit1: altRecipe0[0],
    altRecipeConversion1: altRecipe0[1],
    altRecipeUnit2: altRecipe1[0],
    altRecipeConversion2: altRecipe1[1],
    parStock: parStockFields.parStock || '—',
    parStockUom: parStockFields.parStockUom || '—',
    area: draft.area || '—',
    storage: formatListField(draft.storage),
    active: draft.active,
    sourceLabel,
  };
}

export const MERGE_COMPARE_FIELDS: Array<{ key: keyof SmartComponentMergeDisplay; label: string }> = [
  { key: 'componentId', label: 'Component ID' },
  { key: 'category', label: 'Category' },
  { key: 'group', label: 'Group' },
  { key: 'name', label: 'Name' },
  { key: 'recipeUom', label: 'Principal Component' },
  { key: 'altRecipeUnit1', label: 'Alternate Component Unit 1' },
  { key: 'altRecipeConversion1', label: 'Conversion 1' },
  { key: 'altRecipeUnit2', label: 'Alternate Component Unit 2' },
  { key: 'altRecipeConversion2', label: 'Conversion 2' },
  { key: 'parStock', label: 'Par Stock' },
  { key: 'parStockUom', label: 'Par Stock UOM' },
  { key: 'area', label: 'Area' },
  { key: 'storage', label: 'Storage' },
  { key: 'active', label: 'Active' },
];

function detectImportConflicts(
  drafts: SmartComponentImportDraft[],
  existingRows: ComponentRow[],
  scope?: SmartComponentLocationScope,
): SmartComponentImportConflict[] {
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
    const nameKey = draft.name.trim().toLowerCase();
    if (nameKey) {
      if (!byName.has(nameKey)) byName.set(nameKey, []);
      byName.get(nameKey)!.push(index);
    }
    const componentId = draft.componentId.trim().toUpperCase();
    if (componentId) {
      if (!byId.has(componentId)) byId.set(componentId, []);
      byId.get(componentId)!.push(index);
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
    existingRows
      .filter(row => row.name.trim())
      .map(row => [row.name.trim().toLowerCase(), row]),
  );
  const existingById = new Map(
    existingRows
      .filter(row => row.componentId.trim())
      .map(row => [row.componentId.trim().toUpperCase(), row]),
  );

  drafts.forEach((draft, index) => {
    const nameKey = draft.name.trim().toLowerCase();
    const componentId = draft.componentId.trim().toUpperCase();
    const existingByComponentId = componentId ? existingById.get(componentId) : undefined;
    const existingByComponentName = nameKey ? existingByName.get(nameKey) : undefined;

    if (existingByComponentId) return;

    if (existingByComponentName) {
      if (!existingByComponentName.id) return;
      register(`e:${existingByComponentName.id}`);
      conflictNodeUnion(parent, `t:${index}`, `e:${existingByComponentName.id}`);
    }
  });

  const grouped = new Map<ConflictNodeId, ConflictNodeId[]>();
  for (const node of nodes) {
    const root = conflictNodeFind(parent, node);
    if (!grouped.has(root)) grouped.set(root, []);
    grouped.get(root)!.push(node);
  }

  const conflicts: SmartComponentImportConflict[] = [];

  for (const groupNodes of grouped.values()) {
    if (groupNodes.length < 2) continue;

    const candidates: SmartComponentMergeCandidate[] = [];
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

      const existingId = Number(node.slice(2));
      const existing = existingRows.find(row => row.id === existingId);
      if (!existing) continue;
      candidates.push({
        key: node,
        label: `Database · ${existing.componentId || existing.name}`,
        source: 'database',
        draft: existingRowToImportDraft(existing, scope),
        existing,
      });
    }

    if (candidates.length < 2) continue;

    const displayName = candidates[0]?.draft.name || 'Unknown';
    const displayId = candidates.find(c => c.draft.componentId)?.draft.componentId;
    const reason = displayId
      ? `Duplicate name and component ID for "${displayName}" (${displayId})`
      : `Duplicate component name in template: ${displayName}`;

    conflicts.push({
      key: `conflict-${conflicts.length + 1}-${displayName.trim().toLowerCase().replace(/\s+/g, '-')}`,
      reason,
      candidates,
    });
  }

  return conflicts;
}

function blockedTemplateIndices(conflicts: SmartComponentImportConflict[]): Set<number> {
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

export function applyMergeResolutions(
  plan: SmartComponentImportPlan,
  resolutions: Record<string, string>,
  existingRows: ComponentRow[],
  scope?: SmartComponentLocationScope,
): SmartComponentImportPlan {
  const nextPlan: SmartComponentImportPlan = {
    creates: [...plan.creates],
    updates: [...plan.updates],
    unchanged: [...plan.unchanged],
    errors: [...plan.errors],
    conflicts: [],
    deactivations: [...plan.deactivations],
  };

  const existingByComponentId = new Map(
    existingRows.filter(r => r.componentId).map(r => [r.componentId.trim().toUpperCase(), r]),
  );
  const existingByName = new Map(
    existingRows.map(r => [r.name.trim().toLowerCase(), r]),
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
      if (loser.source === 'database' && loser.existing?.id) {
        nextPlan.deactivations.push({
          existing: loser.existing,
          reason: `Not selected during merge for "${conflict.reason}"`,
        });
      }
    }

    const winnerDraft = { ...winner.draft, active: true };
    const targetExisting = winner.existing
      ?? (winnerDraft.componentId
        ? existingByComponentId.get(winnerDraft.componentId.trim().toUpperCase())
        : undefined)
      ?? existingByName.get(winnerDraft.name.trim().toLowerCase());

    if (targetExisting?.id) {
      const mergedDraft = mergeDraftWithExisting(winnerDraft, targetExisting);
      const changes = diffRows(targetExisting, mergedDraft, scope);
      nextPlan.updates.push({
        existing: targetExisting,
        draft: { ...mergedDraft, active: true },
        changes: changes.length > 0
          ? changes
          : [{
            field: 'active',
            label: 'Active',
            before: targetExisting.active ? 'Yes' : 'No',
            after: 'Yes',
          }],
      });
      continue;
    }

    nextPlan.creates.push(winnerDraft);
  }

  return nextPlan;
}

export function allMergeConflictsResolved(
  conflicts: SmartComponentImportConflict[],
  resolutions: Record<string, string>,
): boolean {
  return conflicts.every(conflict => Boolean(resolutions[conflict.key]));
}

function validateDraftParStock(draft: SmartComponentImportDraft): string | null {
  if (draft.templateParStock === undefined || draft.templateParStock <= 0) return null;

  const source = {
    recipeUom: draft.recipeUom,
    inventoryUom: draft.inventoryUom,
    altRecipeUnits: draft.altRecipeUnits,
    altInventoryUnits: draft.altInventoryUnits,
  };
  const parStockUom = (draft.parStockUom || fromApiUom(draft.recipeUom) || draft.recipeUom).trim();
  if (!isValidComponentParStockUom(parStockUom, source)) {
    const allowed = componentParStockUomOptions(source).join(', ');
    return `Par Stock UOM "${parStockUom}" for "${draft.name}" must be one of: ${allowed}`;
  }

  const dailyUsage = deriveDailyUsageFromParStock(
    draft.templateParStock,
    parStockUom,
    draft.orderFreqDays > 0 ? draft.orderFreqDays : 7,
    {
      ...source,
      convertFromInventoryQty: draft.convertFromInventoryQty,
      convertToRecipeQty: draft.convertToRecipeQty,
    },
  );
  if (dailyUsage === null) {
    return `Unable to convert Par Stock for "${draft.name}" using UOM "${parStockUom}".`;
  }

  return null;
}

export function buildSmartComponentImportPlan(
  drafts: SmartComponentImportDraft[],
  existingRows: ComponentRow[],
  scope?: SmartComponentLocationScope,
): SmartComponentImportPlan {
  const conflicts = detectImportConflicts(drafts, existingRows, scope);
  const blocked = blockedTemplateIndices(conflicts);

  const plan: SmartComponentImportPlan = {
    creates: [],
    updates: [],
    unchanged: [],
    errors: [],
    conflicts,
    deactivations: [],
  };

  const byComponentId = new Map(
    existingRows
      .filter(row => row.componentId)
      .map(row => [row.componentId.trim().toUpperCase(), row]),
  );
  const byName = new Map(
    existingRows.map(row => [row.name.trim().toLowerCase(), row]),
  );
  const seenIds = new Map<string, string>();

  for (let index = 0; index < drafts.length; index++) {
    if (blocked.has(index)) continue;

    const rawDraft = drafts[index];
    const parStockError = validateDraftParStock(rawDraft);
    if (parStockError) {
      plan.errors.push(parStockError);
      continue;
    }

    const componentId = rawDraft.componentId.trim().toUpperCase();
    const nameKey = rawDraft.name.trim().toLowerCase();

    if (componentId) {
      const priorName = seenIds.get(componentId);
      if (priorName && priorName !== nameKey) {
        plan.errors.push(`Duplicate Component ID in template with different names: ${componentId}`);
        continue;
      }
      seenIds.set(componentId, nameKey);
    }

    const existing = componentId
      ? byComponentId.get(componentId)
      : byName.get(nameKey);

    const draft = existing ? mergeDraftWithExisting(rawDraft, existing) : rawDraft;

    if (existing) {
      const changes = diffRows(existing, draft, scope);
      if (changes.length === 0) {
        plan.unchanged.push(existing);
      } else {
        plan.updates.push({ existing, draft, changes });
      }
      continue;
    }

    if (!draft.name.trim()) {
      plan.errors.push('Skipped row with empty component name.');
      continue;
    }

    plan.creates.push(draft);
  }

  return plan;
}

export function draftToComponentRow(
  draft: SmartComponentImportDraft,
  existingComponentIds: string[],
  existing?: ComponentRow,
): ComponentRow {
  const comparable = draftToComparableRow(draft);
  const existingDetail = resolveDetailConfigForRow(existing ?? {});
  const componentId = draft.componentId.trim().toUpperCase()
    || existing?.componentId
    || generateComponentId(undefined, existingComponentIds);

  const detailConfig = {
    ...existingDetail,
    ...(comparable.detailConfig ?? {}),
  };

  return {
    ...comparable,
    id: existing?.id,
    componentId,
    attachedProducts: existing?.attachedProducts ?? 0,
    attachedVendors: countComponentTaggedVendors({ detailConfig }),
    detailConfig,
    detailConfigJson: serializeDetailConfig(detailConfig),
    createdAt: existing?.createdAt,
    updatedAt: existing?.updatedAt,
    storageNote: existing?.storageNote ?? draft.storageNote,
  };
}

export { LEGACY_TEMPLATE_HEADERS, PREVIOUS_TEMPLATE_HEADERS };
