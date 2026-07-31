/** Quantified variable-product detail attached to a POS cart line / sale. */

export type PosSaleCombinationSelection = {
  productId: number
  productCode: string
  productName: string
  quantity: number
}

export type PosSaleReplacementSelection = {
  baseComponentId: string
  baseComponentName: string
  chosenComponentId: string
  chosenComponentName: string
  componentUom: string
  quantity: number
  /** Customer surcharge in major currency units (0 = free). */
  extraCharge?: number
}

export type PosSaleVariableDetail = {
  variableMode: 'combination' | 'replacement' | 'weight' | 'variableComponent'
  enteredWeight?: number
  weightUom?: string
  referenceWeightQty?: number
  combinationSelections?: PosSaleCombinationSelection[]
  replacementSelections?: PosSaleReplacementSelection[]
}

export function summarizeSaleDetail(detail: PosSaleVariableDetail): string {
  if (detail.variableMode === 'weight') {
    const w = detail.enteredWeight
    const uom = detail.weightUom || ''
    return w != null && w > 0 ? `${w} ${uom}`.trim() : ''
  }
  if (detail.variableMode === 'combination') {
    const parts = (detail.combinationSelections ?? []).map(s => {
      const name = s.productName || s.productCode || `#${s.productId}`
      return s.quantity === 1 ? name : `${s.quantity}× ${name}`
    })
    return parts.join(', ')
  }
  if (detail.variableMode === 'replacement' || detail.variableMode === 'variableComponent') {
    const weightPart = detail.enteredWeight != null && detail.enteredWeight > 0
      ? `${detail.enteredWeight} ${detail.weightUom || ''}`.trim()
      : ''
    const parts = (detail.replacementSelections ?? []).map(s => {
      const chosen = s.chosenComponentName || s.chosenComponentId
      const base = s.baseComponentName || s.baseComponentId
      const extra = s.extraCharge && s.extraCharge > 0 ? ` (+${s.extraCharge.toFixed(2)})` : ''
      if (s.chosenComponentId === s.baseComponentId) return base
      return `${base} → ${chosen}${extra}`
    })
    const swapPart = parts.join(', ')
    if (weightPart && swapPart) return `${weightPart} · ${swapPart}`
    return weightPart || swapPart
  }
  return ''
}

export function saleDetailExtraChargeCents(detail?: PosSaleVariableDetail): number {
  if (!detail) return 0
  if (detail.variableMode !== 'variableComponent' && detail.variableMode !== 'replacement') return 0
  const sum = (detail.replacementSelections ?? []).reduce(
    (acc, s) => acc + Math.max(0, Number(s.extraCharge) || 0),
    0,
  )
  return Math.round(sum * 100)
}
