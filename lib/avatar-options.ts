export const AVATAR_3D_PREFIX = 'avatar3d:'

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
  'x1',
] as const

export type Avatar3DId = (typeof AVATAR_3D_IDS)[number]

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

export const DEFAULT_AVATARS = AVATAR_3D_IDS.map(toAvatar3DValue)
