/**
 * 3D avatar preset library.
 *
 * Assets: public/avatars/3d/avatar-NN.webp — 256×256 transparent-background
 * 3D memoji-style heads derived from Microsoft Fluent Emoji 3D (MIT licensed,
 * github.com/microsoft/fluentui-emoji). Regenerate with
 * `node scripts/fetch-3d-avatars.js`.
 *
 * Storage format: profiles.avatar_url stores `avatar3d:<id>`. Only the id is
 * persisted — asset paths are resolved at render time, so the asset base can
 * change without touching user records.
 */

export const AVATAR_3D_PREFIX = 'avatar3d:'
export const AVATAR_ASSET_BASE = '/avatars/3d'

const AVATAR_COUNT = 40

export const AVATAR_3D_IDS = Array.from(
  { length: AVATAR_COUNT },
  (_, index) => `avatar-${String(index + 1).padStart(2, '0')}`,
)

export type Avatar3DId = string

export type Avatar3DMeta = {
  id: Avatar3DId
  /** Short, neutral display label — the avatar image is the focus, not the title. */
  name: string
  /** Descriptive alt text for accessibility. */
  alt: string
}

/** Accessible descriptions per asset (source: Fluent Emoji person variants). */
const AVATAR_ALTS: string[] = [
  'man with brown hair, light skin tone',
  'man with dark hair, medium skin tone',
  'man with dark hair, dark skin tone',
  'woman with long hair, light skin tone',
  'woman with long hair, medium skin tone',
  'woman with long hair, dark skin tone',
  'person with short hair, light skin tone',
  'person with short hair, medium-dark skin tone',
  'boy with short hair, light skin tone',
  'boy with short hair, medium skin tone',
  'girl with pigtails, light skin tone',
  'girl with pigtails, medium-dark skin tone',
  'man with a beard, light skin tone',
  'man with a beard, medium skin tone',
  'man with a beard, dark skin tone',
  'person with a beard, medium-light skin tone',
  'man with curly hair, light skin tone',
  'man with curly hair, medium-dark skin tone',
  'woman with curly hair, light skin tone',
  'woman with curly hair, medium skin tone',
  'woman with curly hair, dark skin tone',
  'person with curly hair, medium-light skin tone',
  'man with red hair',
  'man with red hair, medium skin tone',
  'woman with red hair',
  'woman with red hair, medium skin tone',
  'person with red hair, light skin tone',
  'man with white hair, light skin tone',
  'man with white hair, dark skin tone',
  'woman with white hair, light skin tone',
  'woman with white hair, dark skin tone',
  'person with white hair, medium skin tone',
  'older man, light skin tone',
  'older man, medium skin tone',
  'older woman, light skin tone',
  'older woman, medium skin tone',
  'older person, medium-light skin tone',
  'older person, dark skin tone',
  'young person, light skin tone',
  'young person, medium skin tone',
]

export const AVATAR_3D_LIBRARY: Avatar3DMeta[] = AVATAR_3D_IDS.map((id, index) => ({
  id,
  name: `Avatar ${index + 1}`,
  alt: `3D avatar of a ${AVATAR_ALTS[index] || 'person'}`,
}))

export const DEFAULT_AVATAR_3D_ID: Avatar3DId = 'avatar-01'
export const DEFAULT_AVATAR_VALUE = toAvatar3DValue(DEFAULT_AVATAR_3D_ID)

/**
 * Legacy preset ids (the removed flat 2D set) mapped to the closest new 3D
 * head, so existing profiles keep a sensible avatar without a forced reset.
 * Database migration 044 rewrites stored values; this map also resolves any
 * un-migrated value at render time.
 */
const LEGACY_AVATAR_3D_MAP: Record<string, Avatar3DId> = {
  m1: 'avatar-13', // Executive Mentor (beard) → bearded man, light
  m2: 'avatar-03', // Operations Lead → man, dark
  m3: 'avatar-02', // Systems Specialist → man, medium
  m4: 'avatar-17', // Learning Coach (curly) → curly-haired man, light
  m5: 'avatar-15', // Security Analyst → bearded man, dark
  m6: 'avatar-01', // Cloud Engineer → man, light
  m7: 'avatar-14', // Program Manager (beard) → bearded man, medium
  f1: 'avatar-04', // Product Strategist → woman, light
  f2: 'avatar-05', // Delivery Manager → woman, medium
  f3: 'avatar-20', // Data Coach (curly) → curly-haired woman, medium
  f4: 'avatar-21', // Design Lead → curly-haired woman, dark
  f5: 'avatar-25', // Training Partner → red-haired woman
  f6: 'avatar-19', // AI Specialist → curly-haired woman, light
  f7: 'avatar-06', // Quality Lead → woman, dark
}

export function toAvatar3DValue(id: Avatar3DId | string) {
  return `${AVATAR_3D_PREFIX}${id}`
}

export function getAvatar3DId(value?: string | null): Avatar3DId | null {
  if (!value?.startsWith(AVATAR_3D_PREFIX)) return null
  const id = value.slice(AVATAR_3D_PREFIX.length)
  if (AVATAR_3D_IDS.includes(id)) return id
  // Old stored values resolve to their mapped 3D replacement.
  return LEGACY_AVATAR_3D_MAP[id] ?? null
}

export function isAvatar3DValue(value?: string | null) {
  return Boolean(getAvatar3DId(value))
}

export function getSafeAvatar3DId(value?: string | null): Avatar3DId {
  return getAvatar3DId(value) || DEFAULT_AVATAR_3D_ID
}

export function getAvatar3DMeta(id?: Avatar3DId | string | null): Avatar3DMeta {
  return AVATAR_3D_LIBRARY.find((item) => item.id === id)
    || AVATAR_3D_LIBRARY.find((item) => item.id === LEGACY_AVATAR_3D_MAP[String(id)])
    || AVATAR_3D_LIBRARY[0]
}

export function getAvatar3DAsset(id?: Avatar3DId | string | null) {
  return `${AVATAR_ASSET_BASE}/${getAvatar3DMeta(id).id}.webp`
}

export const DEFAULT_AVATARS = AVATAR_3D_IDS.map(toAvatar3DValue)
