import type { Ingredient } from '../../api';
import {
  readDetailConfigJsonFromIngredient,
  resolveDetailConfigForRow,
  resolveDetailConfigJsonForSave,
  serializeDetailConfig,
  type ComponentRow,
} from '../../data/componentForm';
import { parseComponentStorageJson } from '../../data/storageAssignment';
import { countComponentTaggedVendors } from '../../data/vendorProductTagging';

function parseLocationsJson(json: string | null | undefined): string[] {
  if (!json?.trim()) return ['all'];
  try {
    const parsed = JSON.parse(json) as unknown;
    if (Array.isArray(parsed)) {
      const values = parsed.map(value => String(value).trim()).filter(Boolean);
      return values.length > 0 ? values : ['all'];
    }
    if (typeof parsed === 'string') {
      const value = parsed.trim();
      return value ? [value] : ['all'];
    }
  } catch {
    const trimmed = json.trim();
    if (trimmed) return [trimmed];
  }
  return ['all'];
}

export function ingredientToRow(i: Ingredient): ComponentRow {
  const storage = parseComponentStorageJson(i.storageJson);
  const locations = parseLocationsJson(i.locationsJson);
  const detailConfigJson = readDetailConfigJsonFromIngredient(i);
  const detailConfig = resolveDetailConfigForRow({ detailConfigJson });
  return {
    id: i.id,
    componentId: i.componentId ?? '',
    name: i.name,
    category: i.category,
    group: i.group,
    recipeUOM: i.recipeUom,
    inventoryUOM: i.inventoryUom,
    lastPriceRecipe: i.lastPriceRecipe,
    lastPriceInventory: i.lastPriceInventory,
    dailyUsage: i.dailyUsage,
    orderFreqDays: i.orderFreqDays,
    storage,
    storageNote: i.storageNote ?? '',
    attachedProducts: i.attachedProducts,
    attachedVendors: countComponentTaggedVendors({ detailConfig, detailConfigJson }),
    active: i.active,
    locations,
    detailConfigJson,
    detailConfig,
    createdAt: i.createdAt,
    updatedAt: i.updatedAt,
  };
}

export function rowToIngredient(row: ComponentRow, partial: Partial<ComponentRow> = {}): Ingredient {
  const merged = { ...row, ...partial };
  const detailConfig = resolveDetailConfigForRow(merged);
  const detailConfigJson = resolveDetailConfigJsonForSave(row, partial);
  return {
    id: merged.id ?? 0,
    componentId: merged.componentId,
    name: merged.name,
    category: merged.category,
    group: merged.group,
    recipeUom: merged.recipeUOM,
    inventoryUom: merged.inventoryUOM,
    lastPriceRecipe: merged.lastPriceRecipe,
    lastPriceInventory: merged.lastPriceInventory,
    dailyUsage: merged.dailyUsage,
    orderFreqDays: merged.orderFreqDays,
    storageJson: JSON.stringify(merged.storage),
    storageNote: merged.storageNote ?? '',
    detailConfigJson,
    attachedProducts: merged.attachedProducts,
    attachedVendors: countComponentTaggedVendors({ detailConfig, detailConfigJson }),
    active: merged.active,
    locationsJson: JSON.stringify(merged.locations),
  };
}

export function mergeSavedRow(saved: Ingredient, sent: ComponentRow): ComponentRow {
  const savedRow = ingredientToRow(saved);
  const sentConfig = resolveDetailConfigForRow(sent);
  const savedConfig = resolveDetailConfigForRow(savedRow);

  const sentHasTags = sentConfig.taggedVendorProductIds.length > 0;
  const savedHasTags = savedConfig.taggedVendorProductIds.length > 0;
  const tagsAdded = sentConfig.taggedVendorProductIds.length > savedConfig.taggedVendorProductIds.length;
  const sentHasPrice = sent.lastPriceRecipe > 0 || sent.lastPriceInventory > 0;
  const savedMissingPrice = savedRow.lastPriceRecipe === 0 && savedRow.lastPriceInventory === 0;

  if (tagsAdded || (sentHasTags && sentHasPrice && (savedMissingPrice || !savedHasTags))) {
    const detailConfig = sentConfig.taggedVendorProductIds.length >= savedConfig.taggedVendorProductIds.length
      ? sentConfig
      : savedConfig;

    return {
      ...savedRow,
      lastPriceRecipe: sent.lastPriceRecipe > 0 ? sent.lastPriceRecipe : savedRow.lastPriceRecipe,
      lastPriceInventory: sent.lastPriceInventory > 0 ? sent.lastPriceInventory : savedRow.lastPriceInventory,
      detailConfig,
      detailConfigJson: serializeDetailConfig(detailConfig),
      attachedVendors: countComponentTaggedVendors({ detailConfig, detailConfigJson: serializeDetailConfig(detailConfig) }),
    };
  }

  if (sentHasTags && !savedHasTags) {
    return {
      ...savedRow,
      detailConfig: sentConfig,
      detailConfigJson: resolveDetailConfigJsonForSave({ detailConfig: sentConfig }),
      attachedVendors: countComponentTaggedVendors({ detailConfig: sentConfig, detailConfigJson: resolveDetailConfigJsonForSave({ detailConfig: sentConfig }) }),
      lastPriceRecipe: sent.lastPriceRecipe > 0 ? sent.lastPriceRecipe : savedRow.lastPriceRecipe,
      lastPriceInventory: sent.lastPriceInventory > 0 ? sent.lastPriceInventory : savedRow.lastPriceInventory,
    };
  }

  if (sentHasPrice && sent.lastPriceRecipe !== savedRow.lastPriceRecipe) {
    return {
      ...savedRow,
      lastPriceRecipe: sent.lastPriceRecipe,
      lastPriceInventory: sent.lastPriceInventory > 0 ? sent.lastPriceInventory : savedRow.lastPriceInventory,
    };
  }

  return savedRow;
}
