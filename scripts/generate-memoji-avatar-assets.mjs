import { access, mkdir } from 'node:fs/promises'
import path from 'node:path'
import sharp from 'sharp'

const outDir = path.join(process.cwd(), 'public', 'avatars', 'memoji')
const size = 4096

const avatars = [
  { id: 'm1', name: 'Executive Mentor', skin: '#f2c3a2', hair: '#3f2a1d', outfit: '#1f2937', accent: '#60a5fa', bg: '#dbeafe', hairStyle: 'sweep', facialHair: 'beard' },
  { id: 'm2', name: 'Operations Lead', skin: '#b77752', hair: '#20120c', outfit: '#059669', accent: '#34d399', bg: '#dcfce7', hairStyle: 'crop', glasses: true },
  { id: 'm3', name: 'Systems Specialist', skin: '#d8a27b', hair: '#164e63', outfit: '#0891b2', accent: '#22d3ee', bg: '#cffafe', hairStyle: 'short' },
  { id: 'm4', name: 'Learning Coach', skin: '#e6aa78', hair: '#78350f', outfit: '#d97706', accent: '#f59e0b', bg: '#fef3c7', hairStyle: 'curly', facialHair: 'mustache' },
  { id: 'm5', name: 'Security Analyst', skin: '#8d5b42', hair: '#020617', outfit: '#dc2626', accent: '#fb7185', bg: '#fee2e2', hairStyle: 'sweep', facialHair: 'goatee' },
  { id: 'm6', name: 'Cloud Engineer', skin: '#f1c7a6', hair: '#134e4a', outfit: '#0ea5e9', accent: '#38bdf8', bg: '#e0f2fe', hairStyle: 'crop' },
  { id: 'm7', name: 'Program Manager', skin: '#c99a72', hair: '#1e1b4b', outfit: '#475569', accent: '#818cf8', bg: '#f5f5f4', hairStyle: 'short', glasses: true, facialHair: 'beard' },
  { id: 'f1', name: 'Product Strategist', skin: '#efc0a0', hair: '#6b3f2a', outfit: '#db2777', accent: '#f472b6', bg: '#fce7f3', hairStyle: 'wave' },
  { id: 'f2', name: 'Delivery Manager', skin: '#efc6a8', hair: '#4c1d95', outfit: '#6d28d9', accent: '#a78bfa', bg: '#ede9fe', hairStyle: 'bun' },
  { id: 'f3', name: 'Data Coach', skin: '#d29a75', hair: '#14532d', outfit: '#16a34a', accent: '#86efac', bg: '#f0fdf4', hairStyle: 'curly' },
  { id: 'f4', name: 'Design Lead', skin: '#a76a4d', hair: '#86198f', outfit: '#c026d3', accent: '#e879f9', bg: '#fae8ff', hairStyle: 'wave' },
  { id: 'f5', name: 'Training Partner', skin: '#f5cdb4', hair: '#c2410c', outfit: '#ea580c', accent: '#fb923c', bg: '#ffedd5', hairStyle: 'bun' },
  { id: 'f6', name: 'AI Specialist', skin: '#d9a985', hair: '#312e81', outfit: '#4f46e5', accent: '#818cf8', bg: '#e0e7ff', hairStyle: 'sweep' },
  { id: 'f7', name: 'Quality Lead', skin: '#bd7b55', hair: '#064e3b', outfit: '#0f766e', accent: '#5eead4', bg: '#ccfbf1', hairStyle: 'crop', glasses: true },
]

function hair(def) {
  const common = `fill="${def.hair}" filter="url(#softShadow)"`
  if (def.hairStyle === 'bun') {
    return `
      <circle cx="2820" cy="1110" r="380" ${common}/>
      <path d="M1040 1540 C1110 650 1900 440 2550 760 C3000 980 3160 1370 3090 1760 C2500 1310 1690 1260 1040 1540Z" ${common}/>
      <path d="M1050 1580 C1420 920 2260 700 2920 1110 C2410 1510 1680 1760 1050 1850Z" fill="${def.hair}" opacity=".82"/>
    `
  }
  if (def.hairStyle === 'curly') {
    return `
      ${[1040, 1320, 1620, 1930, 2240, 2540, 2820, 3040].map((x, i) => `<circle cx="${x}" cy="${980 + (i % 2) * 120}" r="330" ${common}/>`).join('')}
      <path d="M960 1610 C1060 640 1840 420 2520 740 C2970 950 3180 1310 3140 1730 C2480 1420 1710 1360 960 1610Z" fill="${def.hair}"/>
    `
  }
  if (def.hairStyle === 'wave') {
    return `<path d="M960 1600 C1030 640 1910 450 2600 780 C3030 990 3210 1370 3130 1760 C2520 1430 1960 1350 1510 1480 C1260 1550 1080 1660 960 1600Z M1010 1510 C1620 520 2670 720 3080 1240 C2360 1570 1640 1810 1040 1900Z" ${common}/>`
  }
  if (def.hairStyle === 'sweep') {
    return `<path d="M980 1580 C1100 650 1910 430 2580 760 C3030 980 3200 1350 3130 1760 C2520 1300 1980 1260 1510 1460 C1230 1580 1070 1720 980 1580Z M1060 1430 C1650 330 2820 710 3110 1260 C2380 1550 1580 1840 1060 1940Z" ${common}/>`
  }
  if (def.hairStyle === 'crop') {
    return `<path d="M980 1580 C1080 720 1840 500 2530 760 C2950 920 3160 1280 3090 1640 C2450 1370 1690 1320 980 1580Z M1110 1380 H2960 C2760 820 2280 650 1840 760 C1460 850 1210 1070 1110 1380Z" ${common}/>`
  }
  return `<path d="M1040 1530 C1140 720 1840 500 2500 750 C2950 930 3130 1290 3070 1650 C2450 1370 1700 1320 1040 1530Z" ${common}/>`
}

function faceDetails(def) {
  const hasBeard = def.facialHair === 'beard'
  const hasMustache = def.facialHair === 'mustache' || def.facialHair === 'goatee' || hasBeard
  const hasGoatee = def.facialHair === 'goatee'
  return `
    <path d="M1390 1560 C1540 1440 1690 1440 1830 1560" fill="none" stroke="${def.hair}" stroke-width="95" stroke-linecap="round"/>
    <path d="M2250 1560 C2400 1440 2570 1440 2720 1560" fill="none" stroke="${def.hair}" stroke-width="95" stroke-linecap="round"/>
    <circle cx="1610" cy="1780" r="122" fill="#111827"/>
    <circle cx="2450" cy="1780" r="122" fill="#111827"/>
    <circle cx="1564" cy="1736" r="38" fill="#ffffff"/>
    <circle cx="2404" cy="1736" r="38" fill="#ffffff"/>
    ${def.glasses ? `
      <g fill="none" stroke="#111827" stroke-width="70" stroke-linecap="round">
        <circle cx="1610" cy="1780" r="265"/>
        <circle cx="2450" cy="1780" r="265"/>
        <path d="M1875 1780 H2185"/>
      </g>
    ` : ''}
    <path d="M1980 1840 C1910 2050 2040 2130 2190 2070" fill="none" stroke="#a7684d" stroke-width="78" stroke-linecap="round"/>
    <ellipse cx="1370" cy="2140" rx="170" ry="95" fill="${def.accent}" opacity=".26"/>
    <ellipse cx="2740" cy="2140" rx="170" ry="95" fill="${def.accent}" opacity=".26"/>
    ${hasMustache ? `<path d="M1640 2290 C1870 2140 2240 2140 2480 2290" fill="none" stroke="${def.hair}" stroke-width="170" stroke-linecap="round"/>` : ''}
    ${hasBeard ? `<path d="M1230 2210 C1510 3230 2550 3230 2850 2210 C2760 2960 2390 3230 2040 3260 C1690 3230 1320 2960 1230 2210Z" fill="${def.hair}" opacity=".94"/>` : ''}
    ${hasGoatee ? `<path d="M1860 2500 C1980 2940 2120 2940 2250 2500 C2200 3130 2080 3220 2050 3230 C2010 3220 1910 3130 1860 2500Z" fill="${def.hair}" opacity=".95"/>` : ''}
    <path d="M1740 2470 C1940 2650 2170 2650 2370 2470" fill="none" stroke="#7f1d1d" stroke-width="82" stroke-linecap="round"/>
  `
}

function svg(def) {
  return `
  <svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 4096 4096" role="img" aria-label="${def.name}">
    <defs>
      <radialGradient id="bg" cx="36%" cy="22%" r="88%">
        <stop offset="0%" stop-color="#ffffff"/>
        <stop offset="40%" stop-color="${def.bg}"/>
        <stop offset="100%" stop-color="${def.accent}"/>
      </radialGradient>
      <radialGradient id="skin" cx="39%" cy="25%" r="74%">
        <stop offset="0%" stop-color="#fff4e6"/>
        <stop offset="52%" stop-color="${def.skin}"/>
        <stop offset="100%" stop-color="#9f6045"/>
      </radialGradient>
      <linearGradient id="outfit" x1="900" y1="2820" x2="3190" y2="4096" gradientUnits="userSpaceOnUse">
        <stop offset="0%" stop-color="${def.accent}"/>
        <stop offset="100%" stop-color="${def.outfit}"/>
      </linearGradient>
      <filter id="softShadow" x="-30%" y="-30%" width="160%" height="160%">
        <feDropShadow dx="0" dy="95" stdDeviation="90" flood-color="#0f172a" flood-opacity=".22"/>
      </filter>
      <filter id="avatarShadow" x="-30%" y="-30%" width="160%" height="160%">
        <feDropShadow dx="0" dy="150" stdDeviation="130" flood-color="#0f172a" flood-opacity=".32"/>
      </filter>
      <filter id="innerGlow" x="-20%" y="-20%" width="140%" height="140%">
        <feGaussianBlur stdDeviation="18" result="blur"/>
        <feComposite in="SourceGraphic" in2="blur" operator="over"/>
      </filter>
    </defs>
    <rect width="4096" height="4096" rx="920" fill="url(#bg)"/>
    <circle cx="640" cy="540" r="620" fill="#ffffff" opacity=".34"/>
    <circle cx="3530" cy="740" r="470" fill="#ffffff" opacity=".18"/>
    <ellipse cx="2048" cy="3720" rx="1240" ry="250" fill="#0f172a" opacity=".18"/>
    <g filter="url(#avatarShadow)">
      <path d="M1130 3280 C1270 2640 2810 2640 2970 3280 L3260 4096 H840Z" fill="url(#outfit)"/>
      <path d="M1480 3000 C1760 3210 2350 3210 2630 3000 L2790 4096 H1320Z" fill="url(#outfit)" opacity=".92"/>
      <rect x="1770" y="2520" width="560" height="660" rx="260" fill="url(#skin)"/>
      <ellipse cx="2048" cy="1700" rx="940" ry="1080" fill="url(#skin)" filter="url(#innerGlow)"/>
      <ellipse cx="1015" cy="1840" rx="190" ry="300" fill="${def.skin}"/>
      <ellipse cx="3080" cy="1840" rx="190" ry="300" fill="${def.skin}"/>
      ${hair(def)}
      ${faceDetails(def)}
      <ellipse cx="1610" cy="1040" rx="610" ry="190" fill="#ffffff" opacity=".2" transform="rotate(-18 1610 1040)"/>
    </g>
    <path d="M560 710 C900 270 1570 190 2060 350" fill="none" stroke="#ffffff" stroke-width="80" stroke-linecap="round" opacity=".45"/>
  </svg>`
}

await mkdir(outDir, { recursive: true })

for (const avatar of avatars) {
  const file = path.join(outDir, `${avatar.id}.webp`)
  try {
    await access(file)
    console.log(`skipped ${file}`)
    continue
  } catch {
    // Generate missing assets only.
  }
  await sharp(Buffer.from(svg(avatar)))
    .resize(size, size)
    .webp({ quality: 88, effort: 2 })
    .toFile(file)
  console.log(`generated ${file}`)
}
