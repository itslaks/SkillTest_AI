function face(seed: number, bg: string, fg: string, accent: string) {
  const left = 33 + (seed % 3)
  const right = 67 - (seed % 3)
  const smile = 58 + (seed % 5)
  const hair = seed % 2 === 0
    ? `<path d="M24 36c8-18 42-22 56 0-2-14-13-24-28-24S27 21 24 36Z" fill="${accent}"/>`
    : `<path d="M20 40c5-19 20-28 37-24 11 3 19 10 23 24-12-8-23-9-34-3-8 4-17 5-26 3Z" fill="${accent}"/>`

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 96 96"><rect width="96" height="96" rx="28" fill="${bg}"/><circle cx="48" cy="50" r="31" fill="${fg}"/><circle cx="${left}" cy="45" r="4" fill="#172033"/><circle cx="${right}" cy="45" r="4" fill="#172033"/><path d="M35 ${smile}c7 9 22 9 29 0" fill="none" stroke="#172033" stroke-width="4" stroke-linecap="round"/>${hair}<circle cx="27" cy="53" r="5" fill="#ff9eb5" opacity=".55"/><circle cx="73" cy="53" r="5" fill="#ff9eb5" opacity=".55"/></svg>`
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`
}

export const DEFAULT_AVATARS = [
  face(1, '#dbeafe', '#fde2c8', '#1d4ed8'),
  face(2, '#fce7f3', '#ffe1c4', '#be185d'),
  face(3, '#dcfce7', '#f6d7b8', '#047857'),
  face(4, '#fef3c7', '#f1c9a8', '#b45309'),
  face(5, '#ede9fe', '#f8d7c6', '#6d28d9'),
  face(6, '#cffafe', '#eac0a4', '#0e7490'),
  face(7, '#e0f2fe', '#f0c6aa', '#0369a1'),
  face(8, '#fee2e2', '#f5d0b5', '#b91c1c'),
  face(9, '#ecfccb', '#ffd8bd', '#3f6212'),
  face(10, '#fae8ff', '#eec3aa', '#a21caf'),
  face(11, '#ccfbf1', '#f4d2b8', '#0f766e'),
  face(12, '#f5f5f4', '#e8b996', '#44403c'),
  face(13, '#e0e7ff', '#fed7aa', '#4338ca'),
  face(14, '#ffedd5', '#f3c7a8', '#c2410c'),
  face(15, '#f0fdf4', '#f8cfb8', '#15803d'),
]
