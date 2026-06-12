/**
 * One-time asset fetcher: builds public/avatars/3d/ from Microsoft Fluent
 * Emoji 3D person heads (MIT licensed, github.com/microsoft/fluentui-emoji).
 * Downloads PNGs from jsDelivr, converts to 256x256 transparent WebP.
 *
 * Run: node scripts/fetch-3d-avatars.js
 */
const fs = require('fs')
const path = require('path')
const sharp = require('sharp')

const CDN = 'https://cdn.jsdelivr.net/gh/microsoft/fluentui-emoji@main/assets'

// (folder, fileSlug, [tones]) — tones use folder-name casing; file suffix is lowercased.
const CANDIDATES = [
  ['Man', 'man', ['Light', 'Medium', 'Dark']],
  ['Woman', 'woman', ['Light', 'Medium', 'Dark']],
  ['Person', 'person', ['Light', 'Medium-Dark']],
  ['Boy', 'boy', ['Light', 'Medium']],
  ['Girl', 'girl', ['Light', 'Medium-Dark']],
  ['Man beard', 'man_beard', ['Light', 'Medium', 'Dark']],
  ['Person beard', 'person_beard', ['Medium-Light']],
  ['Man curly hair', 'man_curly_hair', ['Light', 'Medium-Dark']],
  ['Woman curly hair', 'woman_curly_hair', ['Light', 'Medium', 'Dark']],
  ['Person curly hair', 'person_curly_hair', ['Medium-Light']],
  ['Man red hair', 'man_red_hair', ['Default', 'Medium']],
  ['Woman red hair', 'woman_red_hair', ['Default', 'Medium']],
  ['Person red hair', 'person_red_hair', ['Light']],
  ['Man white hair', 'man_white_hair', ['Light', 'Dark']],
  ['Woman white hair', 'woman_white_hair', ['Light', 'Dark']],
  ['Person white hair', 'person_white_hair', ['Medium']],
  ['Man blond hair', 'man_blond_hair', ['Default', 'Medium-Dark']],
  ['Woman blond hair', 'woman_blond_hair', ['Default', 'Medium-Dark']],
  ['Person blond hair', 'person_blond_hair', ['Light']],
  ['Old man', 'old_man', ['Light', 'Medium']],
  ['Old woman', 'old_woman', ['Light', 'Medium']],
  ['Older person', 'older_person', ['Medium-Light', 'Dark']],
  ['Child', 'child', ['Light', 'Medium']],
]

async function main() {
  const outDir = path.join(__dirname, '..', 'public', 'avatars', '3d')
  fs.mkdirSync(outDir, { recursive: true })

  const manifest = []
  let index = 0
  let failures = []

  for (const [folder, slug, tones] of CANDIDATES) {
    for (const tone of tones) {
      const toneFile = tone.toLowerCase()
      const url = `${CDN}/${encodeURIComponent(folder)}/${encodeURIComponent(tone)}/3D/${slug}_3d_${toneFile}.png`
      try {
        const res = await fetch(url)
        if (!res.ok) throw new Error(`HTTP ${res.status}`)
        const buf = Buffer.from(await res.arrayBuffer())
        index += 1
        const id = `avatar-${String(index).padStart(2, '0')}`
        const outPath = path.join(outDir, `${id}.webp`)
        await sharp(buf)
          .resize(256, 256, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
          .webp({ quality: 86, alphaQuality: 90 })
          .toFile(outPath)
        const description = `${folder.toLowerCase()}${tone === 'Default' ? '' : `, ${tone.toLowerCase().replace('-', ' ')} skin tone`}`
        manifest.push({ id, source: `${folder} / ${tone}`, alt: `3D avatar of a ${description}` })
        console.log(`OK  ${id}  <- ${folder} / ${tone}`)
      } catch (err) {
        failures.push(`${folder}/${tone}: ${err.message}`)
        console.warn(`SKIP ${folder} / ${tone}: ${err.message}`)
      }
    }
  }

  fs.writeFileSync(path.join(outDir, 'manifest.json'), JSON.stringify(manifest, null, 2))
  console.log(`\nDownloaded ${manifest.length} avatars, ${failures.length} skipped.`)
  if (manifest.length < 30) {
    console.error('FEWER THAN 30 AVATARS — add more candidates')
    process.exit(1)
  }
}

main().catch((err) => { console.error(err); process.exit(1) })
