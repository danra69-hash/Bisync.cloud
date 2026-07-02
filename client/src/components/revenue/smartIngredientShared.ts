import type { Ingredient } from '../../api';
import {
  readDetailConfigJsonFromIngredient,
  resolveDetailConfigForRow,
  resolveDetailConfigJsonForSave,
  serializeDetailConfig,
  type ComponentRow,
} from '../../data/componentForm';

export function ingredientToRow(i: Ingredient): ComponentRow {
  let storage: string[] = [];
  try { storage = JSON.parse(i.storageJson); } catch { storage = []; }
  let locations: string[] = [];
  try { locations = JSON.parse(i.locationsJson); } catch { locations = ['all']; }
  const detailConfigJson = readDetailConfigJsonFromIngredient(i);
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
    attachedVendors: i.attachedVendors,
    active: i.active,
    locations,
    detailConfigJson,
    detailConfig: resolveDetailConfigForRow({ detailConfigJson }),
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
    attachedVendors: detailConfig.taggedVendorProductIds.length || merged.attachedVendors,
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
      attachedVendors: detailConfig.taggedVendorProductIds.length || savedRow.attachedVendors,
    };
  }

  if (sentHasTags && !savedHasTags) {
    return {
      ...savedRow,
      detailConfig: sentConfig,
      detailConfigJson: resolveDetailConfigJsonForSave({ detailConfig: sentConfig }),
      attachedVendors: sentConfig.taggedVendorProductIds.length,
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
