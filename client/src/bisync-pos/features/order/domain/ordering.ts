export type Course = 'appetizer' | 'main' | 'dessert' | 'drink'

export type AllergyTag =
  | 'gluten'
  | 'dairy'
  | 'nuts'
  | 'shellfish'
  | 'egg'
  | 'soy'

export type ModifierOption = {
  id: string
  label: string
  priceCents?: number
}

export type ModifierGroup = {
  id: string
  name: string
  required: boolean
  options: ModifierOption[]
}

/** Common restaurant modifiers — portable domain for Flutter later. */
export const MODIFIER_GROUPS: ModifierGroup[] = [
  {
    id: 'temp',
    name: 'Temperature',
    required: false,
    options: [
      { id: 'rare', label: 'Rare' },
      { id: 'med-rare', label: 'Medium rare' },
      { id: 'medium', label: 'Medium' },
      { id: 'well', label: 'Well done' },
    ],
  },
  {
    id: 'sides',
    name: 'Prep notes',
    required: false,
    options: [
      { id: 'no-onion', label: 'No onions' },
      { id: 'sauce-side', label: 'Sauce on the side' },
      { id: 'extra-spicy', label: 'Extra spicy' },
    ],
  },
]

export const COURSE_LABEL: Record<Course, string> = {
  appetizer: 'Appetizers',
  main: 'Mains',
  dessert: 'Desserts',
  drink: 'Drinks',
}

export type EightySixItem = {
  productId: string
  name: string
  status: 'low' | '86'
  note?: string
}

export const MOCK_EIGHTY_SIX: EightySixItem[] = [
  { productId: 'p1', name: 'Shrimp Basil Salad', status: '86', note: 'No shrimp' },
  { productId: 'p8', name: 'Tomato Bisque', status: 'low', note: 'Last 3 bowls' },
  { productId: 'p12', name: 'Pepperoni Slice', status: '86' },
]
