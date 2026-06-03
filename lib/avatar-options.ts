type AvatarPreset = {
  bg: string
  skin: string
  hair: string
  accessory?: string
  expression?: string
}

function avatar({ bg, skin, hair, accessory = '', expression = 'smile' }: AvatarPreset) {
  const mouth = expression === 'grin'
    ? '<path d="M37 61q11 11 22 0" fill="none" stroke="#1f2937" stroke-width="4" stroke-linecap="round"/><path d="M39 61h18" stroke="#ffffff" stroke-width="3" stroke-linecap="round"/>'
    : '<path d="M38 62q10 8 21 0" fill="none" stroke="#1f2937" stroke-width="4" stroke-linecap="round"/>'

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 96 96">
    <defs>
      <linearGradient id="bg" x1="12" x2="84" y1="10" y2="88"><stop stop-color="${bg}"/><stop offset="1" stop-color="#ffffff"/></linearGradient>
      <filter id="s" x="-20%" y="-20%" width="140%" height="140%"><feDropShadow dx="0" dy="4" stdDeviation="4" flood-opacity=".18"/></filter>
    </defs>
    <rect width="96" height="96" rx="28" fill="url(#bg)"/>
    <circle cx="48" cy="51" r="31" fill="${skin}" filter="url(#s)"/>
    <path d="M20 41c3-19 17-30 36-29 15 1 26 11 29 28-11-8-22-10-34-7-9 2-19 9-31 8Z" fill="${hair}"/>
    <path d="M25 38c8-11 21-16 38-12 8 2 14 6 18 12-11-5-23-5-36-1-8 3-14 3-20 1Z" fill="${hair}" opacity=".55"/>
    <circle cx="36" cy="48" r="4.2" fill="#111827"/>
    <circle cx="61" cy="48" r="4.2" fill="#111827"/>
    <circle cx="34" cy="47" r="1.4" fill="#ffffff"/>
    <circle cx="59" cy="47" r="1.4" fill="#ffffff"/>
    <circle cx="29" cy="56" r="5" fill="#fb7185" opacity=".28"/>
    <circle cx="68" cy="56" r="5" fill="#fb7185" opacity=".28"/>
    ${mouth}
    ${accessory}
  </svg>`
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`
}

const glasses = '<path d="M27 47h18v9H27zM52 47h18v9H52z" fill="none" stroke="#111827" stroke-width="3" rx="4"/><path d="M45 51h7" stroke="#111827" stroke-width="3"/>'
const cap = '<path d="M25 30q23-20 46 0v9H25z" fill="#166534"/><path d="M52 34h30" stroke="#166534" stroke-width="7" stroke-linecap="round"/>'
const hijab = '<path d="M19 50c0-24 14-39 31-39 18 0 30 15 30 39 0 21-12 35-31 35S19 71 19 50Z" fill="#f5e7d8" opacity=".96"/><path d="M31 41c4-11 13-18 27-17 9 1 15 7 18 16-7-6-16-8-27-7-8 1-14 4-18 8Z" fill="#f5e7d8"/>'
const unicorn = '<path d="M47 12l5 15h-10z" fill="#facc15"/><path d="M39 22l-10-8-3 12" fill="#f472b6"/><path d="M57 22l10-8 3 12" fill="#f472b6"/>'

export const DEFAULT_AVATARS = [
  avatar({ bg: '#dbeafe', skin: '#f3c7a6', hair: '#2563eb', accessory: glasses, expression: 'grin' }),
  avatar({ bg: '#dcfce7', skin: '#b7794f', hair: '#2f221c', accessory: cap }),
  avatar({ bg: '#fce7f3', skin: '#e7b98f', hair: '#8b4513', accessory: hijab }),
  avatar({ bg: '#cffafe', skin: '#d1d5db', hair: '#334155', expression: 'grin' }),
  avatar({ bg: '#ede9fe', skin: '#f2c4a3', hair: '#7c3aed', accessory: unicorn, expression: 'grin' }),
  avatar({ bg: '#fef3c7', skin: '#f0c8a8', hair: '#78350f' }),
  avatar({ bg: '#fee2e2', skin: '#8d5524', hair: '#111827', expression: 'grin' }),
  avatar({ bg: '#e0f2fe', skin: '#ffd7b5', hair: '#0f766e', accessory: glasses }),
  avatar({ bg: '#f0fdf4', skin: '#eec39a', hair: '#14532d' }),
  avatar({ bg: '#fae8ff', skin: '#d6a37c', hair: '#a21caf', expression: 'grin' }),
  avatar({ bg: '#ffedd5', skin: '#f5d0b5', hair: '#c2410c' }),
  avatar({ bg: '#f5f5f4', skin: '#c7d2fe', hair: '#312e81', accessory: glasses }),
]
