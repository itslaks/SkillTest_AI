export const AVATAR_3D_PREFIX = 'avatar3d:'
export const AVATAR_ASSET_BASE = '/avatars/memoji'

export const AVATAR_3D_IDS = [
  'm1',
  'm2',
  'm3',
  'm4',
  'm5',
  'm6',
  'm7',
  'f1',
  'f2',
  'f3',
  'f4',
  'f5',
  'f6',
  'f7',
] as const

export type Avatar3DId = (typeof AVATAR_3D_IDS)[number]

export type Avatar3DMeta = {
  id: Avatar3DId
  name: string
  group: 'Professional' | 'Creative'
  skin: string
  hair: string
  outfit: string
  accent: string
  bg: string
  hairStyle: 'short' | 'sweep' | 'wave' | 'bun' | 'curly' | 'crop'
  glasses?: boolean
  facialHair?: 'beard' | 'mustache' | 'goatee'
}

export const AVATAR_3D_LIBRARY: Avatar3DMeta[] = [
  { id: 'm1', group: 'Professional', name: 'Executive Mentor', skin: '#f2c3a2', hair: '#3f2a1d', outfit: '#1f2937', accent: '#60a5fa', bg: '#dbeafe', hairStyle: 'sweep', facialHair: 'beard' },
  { id: 'm2', group: 'Professional', name: 'Operations Lead', skin: '#b77752', hair: '#20120c', outfit: '#059669', accent: '#34d399', bg: '#dcfce7', hairStyle: 'crop', glasses: true },
  { id: 'm3', group: 'Professional', name: 'Systems Specialist', skin: '#d8a27b', hair: '#164e63', outfit: '#0891b2', accent: '#22d3ee', bg: '#cffafe', hairStyle: 'short' },
  { id: 'm4', group: 'Creative', name: 'Learning Coach', skin: '#e6aa78', hair: '#78350f', outfit: '#d97706', accent: '#f59e0b', bg: '#fef3c7', hairStyle: 'curly', facialHair: 'mustache' },
  { id: 'm5', group: 'Creative', name: 'Security Analyst', skin: '#8d5b42', hair: '#020617', outfit: '#dc2626', accent: '#fb7185', bg: '#fee2e2', hairStyle: 'sweep', facialHair: 'goatee' },
  { id: 'm6', group: 'Professional', name: 'Cloud Engineer', skin: '#f1c7a6', hair: '#134e4a', outfit: '#0ea5e9', accent: '#38bdf8', bg: '#e0f2fe', hairStyle: 'crop' },
  { id: 'm7', group: 'Professional', name: 'Program Manager', skin: '#c99a72', hair: '#1e1b4b', outfit: '#475569', accent: '#818cf8', bg: '#f5f5f4', hairStyle: 'short', glasses: true, facialHair: 'beard' },
  { id: 'f1', group: 'Creative', name: 'Product Strategist', skin: '#efc0a0', hair: '#6b3f2a', outfit: '#db2777', accent: '#f472b6', bg: '#fce7f3', hairStyle: 'wave' },
  { id: 'f2', group: 'Professional', name: 'Delivery Manager', skin: '#efc6a8', hair: '#4c1d95', outfit: '#6d28d9', accent: '#a78bfa', bg: '#ede9fe', hairStyle: 'bun' },
  { id: 'f3', group: 'Creative', name: 'Data Coach', skin: '#d29a75', hair: '#14532d', outfit: '#16a34a', accent: '#86efac', bg: '#f0fdf4', hairStyle: 'curly' },
  { id: 'f4', group: 'Creative', name: 'Design Lead', skin: '#a76a4d', hair: '#86198f', outfit: '#c026d3', accent: '#e879f9', bg: '#fae8ff', hairStyle: 'wave' },
  { id: 'f5', group: 'Professional', name: 'Training Partner', skin: '#f5cdb4', hair: '#c2410c', outfit: '#ea580c', accent: '#fb923c', bg: '#ffedd5', hairStyle: 'bun' },
  { id: 'f6', group: 'Professional', name: 'AI Specialist', skin: '#d9a985', hair: '#312e81', outfit: '#4f46e5', accent: '#818cf8', bg: '#e0e7ff', hairStyle: 'sweep' },
  { id: 'f7', group: 'Professional', name: 'Quality Lead', skin: '#bd7b55', hair: '#064e3b', outfit: '#0f766e', accent: '#5eead4', bg: '#ccfbf1', hairStyle: 'crop', glasses: true },
]

export const DEFAULT_AVATAR_3D_ID: Avatar3DId = 'm1'
export const DEFAULT_AVATAR_VALUE = toAvatar3DValue(DEFAULT_AVATAR_3D_ID)

export function toAvatar3DValue(id: Avatar3DId | string) {
  return `${AVATAR_3D_PREFIX}${id}`
}

export function getAvatar3DId(value?: string | null): Avatar3DId | null {
  if (!value?.startsWith(AVATAR_3D_PREFIX)) return null
  const id = value.slice(AVATAR_3D_PREFIX.length)
  return AVATAR_3D_IDS.includes(id as Avatar3DId) ? id as Avatar3DId : null
}

export function isAvatar3DValue(value?: string | null) {
  return Boolean(getAvatar3DId(value))
}

export function getSafeAvatar3DId(value?: string | null): Avatar3DId {
  return getAvatar3DId(value) || DEFAULT_AVATAR_3D_ID
}

export function getAvatar3DMeta(id?: Avatar3DId | string | null) {
  return AVATAR_3D_LIBRARY.find((item) => item.id === id) || AVATAR_3D_LIBRARY[0]
}

export function getAvatar3DAsset(id?: Avatar3DId | string | null) {
  return `${AVATAR_ASSET_BASE}/${getAvatar3DMeta(id).id}.webp`
}

export const DEFAULT_AVATARS = AVATAR_3D_IDS.map(toAvatar3DValue)
