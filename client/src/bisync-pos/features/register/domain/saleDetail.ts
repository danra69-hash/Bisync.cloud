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
}

export type PosSaleVariableDetail = {
  variableMode: 'combination' | 'replacement' | 'weight'
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
  if (detail.variableMode === 'replacement') {
    const parts = (detail.replacementSelections ?? []).map(s => {
      const chosen = s.chosenComponentName || s.chosenComponentId
      const base = s.baseComponentName || s.baseComponentId
      if (s.chosenComponentId === s.baseComponentId) return base
      return `${base} → ${chosen}`
    })
    return parts.join(', ')
  }
  return ''
}
