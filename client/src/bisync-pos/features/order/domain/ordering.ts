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

/** Food modifiers shown from the permanent Food Modifier button on Register. */
export const FOOD_MODIFIER_GROUPS: ModifierGroup[] = [
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
    id: 'food-prep',
    name: 'Prep notes',
    required: false,
    options: [
      { id: 'no-onion', label: 'No onions' },
      { id: 'sauce-side', label: 'Sauce on the side' },
      { id: 'extra-spicy', label: 'Extra spicy' },
      { id: 'no-salt', label: 'No salt' },
      { id: 'well-done-veg', label: 'Vegetables well done' },
    ],
  },
  {
    id: 'food-allergy',
    name: 'Allergy flags',
    required: false,
    options: [
      { id: 'gluten-free', label: 'Gluten free' },
      { id: 'dairy-free', label: 'Dairy free' },
      { id: 'nut-free', label: 'Nut free' },
    ],
  },
]

/** Beverage modifiers shown from the permanent Beverage Modifier button on Register. */
export const BEVERAGE_MODIFIER_GROUPS: ModifierGroup[] = [
  {
    id: 'drink-temp',
    name: 'Serve',
    required: false,
    options: [
      { id: 'iced', label: 'Iced' },
      { id: 'hot', label: 'Hot' },
      { id: 'room', label: 'Room temperature' },
    ],
  },
  {
    id: 'drink-prep',
    name: 'Prep notes',
    required: false,
    options: [
      { id: 'less-ice', label: 'Less ice' },
      { id: 'no-ice', label: 'No ice' },
      { id: 'extra-shot', label: 'Extra shot' },
      { id: 'decaf', label: 'Decaf' },
      { id: 'oat-milk', label: 'Oat milk' },
      { id: 'no-sugar', label: 'No sugar' },
    ],
  },
]

/** @deprecated Prefer FOOD_MODIFIER_GROUPS / BEVERAGE_MODIFIER_GROUPS */
export const MODIFIER_GROUPS: ModifierGroup[] = FOOD_MODIFIER_GROUPS

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
