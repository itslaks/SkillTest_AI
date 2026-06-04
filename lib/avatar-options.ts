type AvatarPreset = {
  bg1: string
  bg2: string
  skin1: string
  skin2: string
  hair1: string
  hair2: string
  shirt: string
  accent: string
  style?: 'sweep' | 'crop' | 'wave' | 'short' | 'bun' | 'curly'
}

function avatar({ bg1, bg2, skin1, skin2, hair1, hair2, shirt, accent, style = 'sweep' }: AvatarPreset) {
  const hairShape = {
    sweep: `<path d="M25 41c2-18 17-31 37-27 15 3 24 16 22 33-13-9-25-12-37-9-8 2-15 5-22 3Z" fill="url(#hair)"/><path d="M29 39c9-12 22-17 38-11 6 2 11 6 14 12-12-5-22-5-31-2-10 3-16 4-21 1Z" fill="#fff" opacity=".13"/>`,
    crop: `<path d="M22 44c1-19 15-32 34-32 18 0 30 13 31 32-15-7-28-8-41-4-9 3-17 4-24 4Z" fill="url(#hair)"/><path d="M25 40c9-15 32-20 50-4-14-3-25-2-35 2-6 2-11 3-15 2Z" fill="#fff" opacity=".12"/>`,
    wave: `<path d="M18 49c0-23 15-38 34-38 18 0 31 14 31 36 0 17-7 31-18 36 5-18 2-32-8-41-10 6-23 7-39 7Z" fill="url(#hair)"/><path d="M27 38c7-13 20-18 36-12 7 2 13 7 17 13-10-5-20-6-30-3-9 3-16 4-23 2Z" fill="#fff" opacity=".14"/>`,
    short: `<path d="M24 39c3-17 16-27 33-26 16 1 27 11 29 27-13-7-26-9-38-6-8 2-16 5-24 5Z" fill="url(#hair)"/>`,
    bun: `<circle cx="73" cy="30" r="12" fill="url(#hair)"/><path d="M20 49c0-24 15-38 35-38 18 0 30 13 31 35-14-8-27-10-40-6-10 3-18 6-26 9Z" fill="url(#hair)"/>`,
    curly: `<path d="M19 48c-3-22 12-39 33-40 23-1 38 17 35 39-10-7-20-9-31-7-13 2-24 5-37 8Z" fill="url(#hair)"/><g fill="url(#hair)"><circle cx="26" cy="33" r="10"/><circle cx="38" cy="22" r="10"/><circle cx="53" cy="19" r="11"/><circle cx="68" cy="25" r="10"/><circle cx="78" cy="38" r="9"/></g>`,
  }[style]

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 112 112">
    <defs>
      <linearGradient id="bg" x1="12" x2="100" y1="8" y2="108"><stop stop-color="${bg1}"/><stop offset="1" stop-color="${bg2}"/></linearGradient>
      <linearGradient id="skin" x1="32" x2="76" y1="25" y2="83"><stop stop-color="${skin1}"/><stop offset="1" stop-color="${skin2}"/></linearGradient>
      <linearGradient id="hair" x1="24" x2="84" y1="10" y2="52"><stop stop-color="${hair1}"/><stop offset="1" stop-color="${hair2}"/></linearGradient>
      <radialGradient id="shine" cx="34%" cy="24%" r="70%"><stop stop-color="#fff" stop-opacity=".62"/><stop offset=".55" stop-color="#fff" stop-opacity=".08"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></radialGradient>
      <filter id="soft" x="-30%" y="-30%" width="160%" height="160%"><feDropShadow dx="0" dy="10" stdDeviation="9" flood-color="#111827" flood-opacity=".18"/></filter>
    </defs>
    <rect width="112" height="112" rx="36" fill="url(#bg)"/>
    <circle cx="38" cy="28" r="30" fill="url(#shine)"/>
    <ellipse cx="56" cy="96" rx="34" ry="10" fill="#111827" opacity=".13"/>
    <path d="M24 101c4-20 17-31 32-31s28 11 32 31H24Z" fill="${shirt}" filter="url(#soft)"/>
    <circle cx="56" cy="50" r="33" fill="url(#skin)" filter="url(#soft)"/>
    ${hairShape}
    <path d="M33 47c5-3 10-3 15 0" fill="none" stroke="${hair2}" stroke-width="3.2" stroke-linecap="round" opacity=".45"/>
    <path d="M64 47c5-3 10-3 15 0" fill="none" stroke="${hair2}" stroke-width="3.2" stroke-linecap="round" opacity=".45"/>
    <circle cx="43" cy="53" r="3.8" fill="#111827"/>
    <circle cx="70" cy="53" r="3.8" fill="#111827"/>
    <circle cx="42" cy="52" r="1.2" fill="#fff"/>
    <circle cx="69" cy="52" r="1.2" fill="#fff"/>
    <path d="M51 58c1.5 1.2 3.1 1.8 5 1.8s3.5-.6 5-1.8" fill="none" stroke="#8b5e4a" stroke-width="2.2" stroke-linecap="round" opacity=".5"/>
    <path d="M47 68c5.3 4.8 13 4.8 18 0" fill="none" stroke="#1f2937" stroke-width="3.4" stroke-linecap="round"/>
    <circle cx="34" cy="62" r="5.5" fill="${accent}" opacity=".18"/>
    <circle cx="78" cy="62" r="5.5" fill="${accent}" opacity=".18"/>
    <path d="M35 93c9 8 33 8 42 0" fill="none" stroke="#fff" stroke-opacity=".35" stroke-width="7" stroke-linecap="round"/>
  </svg>`

  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`
}

export const DEFAULT_AVATARS = [
  avatar({ bg1: '#dbeafe', bg2: '#c7d2fe', skin1: '#ffd9bd', skin2: '#e9a879', hair1: '#2f3b52', hair2: '#111827', shirt: '#2563eb', accent: '#60a5fa', style: 'sweep' }),
  avatar({ bg1: '#dcfce7', bg2: '#bbf7d0', skin1: '#c78b62', skin2: '#8d5524', hair1: '#3b2f2f', hair2: '#1f1717', shirt: '#059669', accent: '#34d399', style: 'crop' }),
  avatar({ bg1: '#fce7f3', bg2: '#fbcfe8', skin1: '#f2c7a8', skin2: '#d8956f', hair1: '#6b3f2a', hair2: '#3b241a', shirt: '#db2777', accent: '#f472b6', style: 'wave' }),
  avatar({ bg1: '#cffafe', bg2: '#bae6fd', skin1: '#f1d0b5', skin2: '#bf8b67', hair1: '#164e63', hair2: '#082f49', shirt: '#0891b2', accent: '#22d3ee', style: 'short' }),
  avatar({ bg1: '#ede9fe', bg2: '#ddd6fe', skin1: '#f7d0b3', skin2: '#c98d66', hair1: '#7c3aed', hair2: '#3b0764', shirt: '#6d28d9', accent: '#a78bfa', style: 'bun' }),
  avatar({ bg1: '#fef3c7', bg2: '#fde68a', skin1: '#f1b98c', skin2: '#a9633a', hair1: '#78350f', hair2: '#451a03', shirt: '#d97706', accent: '#f59e0b', style: 'curly' }),
  avatar({ bg1: '#fee2e2', bg2: '#fecaca', skin1: '#9a6748', skin2: '#5f3728', hair1: '#1f2937', hair2: '#020617', shirt: '#dc2626', accent: '#fb7185', style: 'sweep' }),
  avatar({ bg1: '#e0f2fe', bg2: '#bfdbfe', skin1: '#ffd9bd', skin2: '#e5a076', hair1: '#0f766e', hair2: '#134e4a', shirt: '#0ea5e9', accent: '#38bdf8', style: 'crop' }),
  avatar({ bg1: '#f0fdf4', bg2: '#d9f99d', skin1: '#edc6a5', skin2: '#b87952', hair1: '#14532d', hair2: '#052e16', shirt: '#16a34a', accent: '#86efac', style: 'short' }),
  avatar({ bg1: '#fae8ff', bg2: '#f5d0fe', skin1: '#d6a37c', skin2: '#915f42', hair1: '#a21caf', hair2: '#581c87', shirt: '#c026d3', accent: '#e879f9', style: 'wave' }),
  avatar({ bg1: '#ffedd5', bg2: '#fed7aa', skin1: '#f7d7bf', skin2: '#cc8c64', hair1: '#c2410c', hair2: '#7c2d12', shirt: '#ea580c', accent: '#fb923c', style: 'bun' }),
  avatar({ bg1: '#f5f5f4', bg2: '#e7e5e4', skin1: '#c7d2fe', skin2: '#8da2e8', hair1: '#312e81', hair2: '#1e1b4b', shirt: '#475569', accent: '#818cf8', style: 'curly' }),
]
