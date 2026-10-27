export const CATEGORIES = [
  { id: 'top', label: '上衣' },
  { id: 'bottom', label: '下装' },
  { id: 'outer', label: '外套' },
  { id: 'shoes', label: '鞋子' },
  { id: 'accessory', label: '配饰' },
] as const

export type Category = (typeof CATEGORIES)[number]['id']
export type Warmth = 'light' | 'medium' | 'warm'
export type Style = 'casual' | 'smart' | 'sport'
export type Purpose = 'daily' | 'work' | 'date' | 'outdoor' | 'sport'

export const COLORS = [
  { id: 'black', label: '黑色', hex: '#303431', family: 'neutral' },
  { id: 'white', label: '白色', hex: '#f5f5f0', family: 'neutral' },
  { id: 'gray', label: '灰色', hex: '#8c928d', family: 'neutral' },
  { id: 'navy', label: '藏蓝', hex: '#384e67', family: 'cool' },
  { id: 'blue', label: '蓝色', hex: '#7696ad', family: 'cool' },
  { id: 'green', label: '绿色', hex: '#697f6c', family: 'earth' },
  { id: 'brown', label: '棕色', hex: '#89705c', family: 'earth' },
  { id: 'red', label: '红色', hex: '#aa5d58', family: 'warm' },
  { id: 'pink', label: '粉色', hex: '#dba5a5', family: 'warm' },
  { id: 'other', label: '其他', hex: 'conic-gradient(#748e9f, #a98d74, #d09d9f, #748e9f)', family: 'other' },
] as const

export type Color = (typeof COLORS)[number]['id']

export const PURPOSES: { id: Purpose; label: string; detail: string }[] = [
  { id: 'daily', label: '日常出门', detail: '自在、好走' },
  { id: 'work', label: '通勤上班', detail: '得体、利落' },
  { id: 'date', label: '约会聚会', detail: '有一点心思' },
  { id: 'outdoor', label: '户外走走', detail: '舒适、耐穿' },
  { id: 'sport', label: '运动健身', detail: '轻便、灵活' },
]

export interface WardrobeItem {
  id: string
  name: string
  category: Category
  color: Color
  warmth: Warmth
  style: Style
  rainSafe: boolean
  image: string
  imagePath?: string
  createdAt: number
}

export interface Weather {
  source: 'live' | 'manual'
  city: string
  temperature: number
  feelsLike: number
  min: number | null
  max: number | null
  rainChance: number | null
  code: number | null
  wind: number | null
  fetchedAt: number | null
}

export interface Outfit {
  itemIds: string[]
  score: number
  reasons: string[]
}

export interface SavedOutfit {
  id: string
  itemIds: string[]
  purpose: Purpose
  temperature: number
  createdAt: number
}

export const categoryLabel = (id: Category) => CATEGORIES.find((item) => item.id === id)?.label ?? id
export const colorLabel = (id: Color) => COLORS.find((item) => item.id === id)?.label ?? id
