'use client'

import { useEffect, useMemo, useRef, type CSSProperties } from 'react'
import * as THREE from 'three'
import type { Avatar3DId } from '@/lib/avatar-options'
import { AVATAR_3D_IDS } from '@/lib/avatar-options'

type AvatarDef = {
  id: Avatar3DId
  name: string
  gender: 'male' | 'female'
  skin: string
  hair: string
  outfit: string
  accent: string
  bg: string
  hairStyle: 'short' | 'sweep' | 'wave' | 'bun' | 'curly' | 'crop'
  glasses?: boolean
  facialHair?: 'beard' | 'mustache' | 'goatee'
}

export const AVATAR_3D_DEFS: AvatarDef[] = [
  { id: 'm1', gender: 'male', name: 'Beard Executive', skin: '#f2c3a2', hair: '#3f2a1d', outfit: '#1f2937', accent: '#60a5fa', bg: '#dbeafe', hairStyle: 'sweep', facialHair: 'beard' },
  { id: 'm2', gender: 'male', name: 'Forest Specs', skin: '#b77752', hair: '#20120c', outfit: '#059669', accent: '#34d399', bg: '#dcfce7', hairStyle: 'crop', glasses: true },
  { id: 'm3', gender: 'male', name: 'Cyan Clean Cut', skin: '#d8a27b', hair: '#164e63', outfit: '#0891b2', accent: '#22d3ee', bg: '#cffafe', hairStyle: 'short' },
  { id: 'm4', gender: 'male', name: 'Amber Curly', skin: '#e6aa78', hair: '#78350f', outfit: '#d97706', accent: '#f59e0b', bg: '#fef3c7', hairStyle: 'curly', facialHair: 'mustache' },
  { id: 'm5', gender: 'male', name: 'Crimson Goatee', skin: '#8d5b42', hair: '#020617', outfit: '#dc2626', accent: '#fb7185', bg: '#fee2e2', hairStyle: 'sweep', facialHair: 'goatee' },
  { id: 'm6', gender: 'male', name: 'Teal Polo', skin: '#f1c7a6', hair: '#134e4a', outfit: '#0ea5e9', accent: '#38bdf8', bg: '#e0f2fe', hairStyle: 'crop' },
  { id: 'm7', gender: 'male', name: 'Slate Mentor', skin: '#c99a72', hair: '#1e1b4b', outfit: '#475569', accent: '#818cf8', bg: '#f5f5f4', hairStyle: 'short', glasses: true, facialHair: 'beard' },
  { id: 'f1', gender: 'female', name: 'Rose Waves', skin: '#efc0a0', hair: '#6b3f2a', outfit: '#db2777', accent: '#f472b6', bg: '#fce7f3', hairStyle: 'wave' },
  { id: 'f2', gender: 'female', name: 'Violet Bun', skin: '#efc6a8', hair: '#4c1d95', outfit: '#6d28d9', accent: '#a78bfa', bg: '#ede9fe', hairStyle: 'bun' },
  { id: 'f3', gender: 'female', name: 'Green Curls', skin: '#d29a75', hair: '#14532d', outfit: '#16a34a', accent: '#86efac', bg: '#f0fdf4', hairStyle: 'curly' },
  { id: 'f4', gender: 'female', name: 'Fuchsia Layers', skin: '#a76a4d', hair: '#86198f', outfit: '#c026d3', accent: '#e879f9', bg: '#fae8ff', hairStyle: 'wave' },
  { id: 'f5', gender: 'female', name: 'Orange Coach', skin: '#f5cdb4', hair: '#c2410c', outfit: '#ea580c', accent: '#fb923c', bg: '#ffedd5', hairStyle: 'bun' },
  { id: 'f6', gender: 'female', name: 'Indigo Side Sweep', skin: '#d9a985', hair: '#312e81', outfit: '#4f46e5', accent: '#818cf8', bg: '#e0e7ff', hairStyle: 'sweep' },
  { id: 'f7', gender: 'female', name: 'Mint Specs', skin: '#bd7b55', hair: '#064e3b', outfit: '#0f766e', accent: '#5eead4', bg: '#ccfbf1', hairStyle: 'crop', glasses: true },
]

export function Avatar3D({
  avatarId = 'm1',
  size = 80,
  className,
  interactive = false,
}: {
  avatarId?: Avatar3DId | string | null
  size?: number
  className?: string
  interactive?: boolean
}) {
  const mountRef = useRef<HTMLDivElement>(null)
  const def = useMemo(
    () => AVATAR_3D_DEFS.find((item) => item.id === avatarId) || AVATAR_3D_DEFS[0],
    [avatarId]
  )

  useEffect(() => {
    const mount = mountRef.current
    if (!mount) return

    const width = Math.max(24, size)
    const height = Math.max(24, size)
    const scene = new THREE.Scene()
    scene.background = new THREE.Color(def.bg)

    const camera = new THREE.PerspectiveCamera(34, width / height, 0.1, 100)
    camera.position.set(0, 0.1, 6.2)

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true })
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
    renderer.setSize(width, height)
    renderer.shadowMap.enabled = true
    renderer.shadowMap.type = THREE.PCFSoftShadowMap
    mount.appendChild(renderer.domElement)

    const ambient = new THREE.AmbientLight(0xffffff, 2.2)
    const key = new THREE.DirectionalLight(0xffffff, 2.8)
    key.position.set(3, 4, 5)
    const rim = new THREE.DirectionalLight(def.accent, 1.2)
    rim.position.set(-4, 2, 4)
    scene.add(ambient, key, rim)

    const avatar = buildAvatar(def)
    scene.add(avatar)

    let frame = 0
    let raf = 0
    const animate = () => {
      frame += 0.018
      avatar.rotation.y = Math.sin(frame) * (interactive ? 0.22 : 0.08)
      avatar.position.y = Math.sin(frame * 1.4) * 0.025
      renderer.render(scene, camera)
      raf = requestAnimationFrame(animate)
    }
    animate()

    return () => {
      cancelAnimationFrame(raf)
      mount.removeChild(renderer.domElement)
      avatar.traverse((object) => {
        if (object instanceof THREE.Mesh) {
          object.geometry.dispose()
          const material = object.material
          if (Array.isArray(material)) material.forEach((item) => item.dispose())
          else material.dispose()
        }
      })
      renderer.dispose()
    }
  }, [def, interactive, size])

  const style: CSSProperties = {
    width: size,
    height: size,
    borderRadius: Math.max(12, size * 0.24),
    overflow: 'hidden',
  }

  return <div ref={mountRef} className={className} style={style} aria-label={def.name} />
}

export function AvatarPicker({
  value,
  onChange,
}: {
  value?: Avatar3DId | null
  onChange: (id: Avatar3DId) => void
}) {
  const groups = [
    { label: 'Male', ids: AVATAR_3D_IDS.filter((id) => id.startsWith('m')) },
    { label: 'Female', ids: AVATAR_3D_IDS.filter((id) => id.startsWith('f')) },
  ]

  return (
    <div className="space-y-3">
      {groups.map((group) => (
        <div key={group.label} className="space-y-2">
          <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-zinc-500">{group.label} presets</p>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-7">
            {group.ids.map((id) => {
              const def = AVATAR_3D_DEFS.find((item) => item.id === id) || AVATAR_3D_DEFS[0]
              return (
                <button
                  key={id}
                  type="button"
                  onClick={() => onChange(id)}
                  className={`rounded-2xl border bg-white p-1.5 shadow-sm transition-all ${
                    value === id ? 'border-black ring-2 ring-black/15' : 'border-zinc-200 hover:border-zinc-400 hover:shadow-md'
                  }`}
                  aria-label={`Choose ${def.name}`}
                  title={def.name}
                >
                  <AvatarPresetPreview def={def} />
                </button>
              )
            })}
          </div>
        </div>
      ))}
    </div>
  )
}

function AvatarPresetPreview({ def }: { def: AvatarDef }) {
  const hasBeard = def.facialHair === 'beard'
  const hasMustache = def.facialHair === 'mustache' || def.facialHair === 'goatee' || hasBeard
  const hasGoatee = def.facialHair === 'goatee'

  return (
    <svg viewBox="0 0 112 88" role="img" aria-label={def.name} className="h-20 w-full rounded-xl bg-white">
      <defs>
        <radialGradient id={`${def.id}-face`} cx="42%" cy="28%" r="72%">
          <stop offset="0%" stopColor="#fff2df" />
          <stop offset="58%" stopColor={def.skin} />
          <stop offset="100%" stopColor="#b87555" />
        </radialGradient>
        <linearGradient id={`${def.id}-shirt`} x1="0" x2="1" y1="0" y2="1">
          <stop offset="0%" stopColor={def.accent} />
          <stop offset="100%" stopColor={def.outfit} />
        </linearGradient>
      </defs>
      <rect width="112" height="88" rx="18" fill={def.bg} />
      <ellipse cx="56" cy="84" rx="35" ry="22" fill={`url(#${def.id}-shirt)`} />
      <path d="M35 67 Q56 75 77 67 L81 88 H31 Z" fill={`url(#${def.id}-shirt)`} />
      <circle cx="56" cy="40" r="28" fill={`url(#${def.id}-face)`} />
      <ellipse cx="31" cy="42" rx="5.5" ry="8" fill={def.skin} />
      <ellipse cx="81" cy="42" rx="5.5" ry="8" fill={def.skin} />
      <HairSvg def={def} />
      <path d="M41 34 Q47 30 52 34" fill="none" stroke={def.hair} strokeWidth="3" strokeLinecap="round" />
      <path d="M60 34 Q66 30 72 34" fill="none" stroke={def.hair} strokeWidth="3" strokeLinecap="round" />
      <circle cx="45" cy="42" r="4.5" fill="#111827" />
      <circle cx="67" cy="42" r="4.5" fill="#111827" />
      <circle cx="43.5" cy="40.5" r="1.4" fill="#fff" />
      <circle cx="65.5" cy="40.5" r="1.4" fill="#fff" />
      {def.glasses && (
        <g fill="none" stroke="#111827" strokeWidth="2">
          <circle cx="45" cy="42" r="8" />
          <circle cx="67" cy="42" r="8" />
          <path d="M53 42 H59" />
        </g>
      )}
      <path d="M54 43 Q52 50 57 50" fill="none" stroke="#b87555" strokeWidth="2" strokeLinecap="round" />
      {hasMustache && <path d="M45 55 Q56 50 67 55" fill="none" stroke={def.hair} strokeWidth="5" strokeLinecap="round" />}
      {hasBeard && <path d="M34 52 Q56 82 78 52 Q73 73 56 76 Q39 73 34 52Z" fill={def.hair} opacity="0.92" />}
      {hasGoatee && <path d="M51 60 Q56 69 61 60 Q58 73 56 74 Q54 73 51 60Z" fill={def.hair} opacity="0.95" />}
      <path d="M48 58 Q56 64 64 58" fill="none" stroke="#7f1d1d" strokeWidth="2.4" strokeLinecap="round" />
      <circle cx="38" cy="52" r="4" fill={def.accent} opacity="0.26" />
      <circle cx="74" cy="52" r="4" fill={def.accent} opacity="0.26" />
    </svg>
  )
}

function HairSvg({ def }: { def: AvatarDef }) {
  if (def.hairStyle === 'bun') {
    return (
      <g fill={def.hair}>
        <circle cx="78" cy="25" r="10" />
        <path d="M30 34 Q34 13 56 13 Q77 13 82 34 Q67 24 56 25 Q44 24 30 34Z" />
        <path d="M29 38 Q42 21 64 20 Q55 35 32 43Z" opacity="0.85" />
      </g>
    )
  }
  if (def.hairStyle === 'curly') {
    return (
      <g fill={def.hair}>
        {[31, 39, 48, 57, 66, 75, 82].map((x, index) => (
          <circle key={x} cx={x} cy={25 + (index % 2) * 2} r="8" />
        ))}
        <path d="M30 36 Q35 12 56 13 Q78 13 83 36 Q65 27 56 29 Q45 27 30 36Z" />
      </g>
    )
  }
  if (def.hairStyle === 'wave') {
    return <path d="M29 36 Q31 14 55 13 Q79 12 84 36 Q65 28 52 30 Q39 30 29 36Z M31 34 Q50 13 77 20 Q64 34 34 42Z" fill={def.hair} />
  }
  if (def.hairStyle === 'sweep') {
    return <path d="M29 35 Q34 13 57 13 Q80 14 84 36 Q66 24 54 27 Q43 29 30 39Z M33 31 Q55 7 80 26 Q60 33 37 43Z" fill={def.hair} />
  }
  if (def.hairStyle === 'crop') {
    return <path d="M29 35 Q32 15 56 14 Q80 15 83 35 Q69 28 56 29 Q43 28 29 35Z M33 31 H79 Q72 20 56 20 Q40 20 33 31Z" fill={def.hair} />
  }
  return <path d="M30 34 Q35 14 56 14 Q77 14 82 34 Q68 27 56 28 Q44 27 30 34Z" fill={def.hair} />
}

function material(color: string, roughness = 0.48, metalness = 0.04) {
  return new THREE.MeshStandardMaterial({ color, roughness, metalness })
}

function sphere(radius: number, color: string, scale: [number, number, number] = [1, 1, 1]) {
  const mesh = new THREE.Mesh(new THREE.SphereGeometry(radius, 48, 48), material(color))
  mesh.scale.set(...scale)
  mesh.castShadow = true
  mesh.receiveShadow = true
  return mesh
}

function capsule(radius: number, height: number, color: string, scale: [number, number, number] = [1, 1, 1]) {
  const mesh = new THREE.Mesh(new THREE.CapsuleGeometry(radius, height, 32, 48), material(color))
  mesh.scale.set(...scale)
  mesh.castShadow = true
  return mesh
}

function buildAvatar(def: AvatarDef) {
  const group = new THREE.Group()
  group.position.y = -0.55

  const torso = capsule(0.72, 0.9, def.outfit, [1.22, 1, 0.85])
  torso.position.y = -1.45
  group.add(torso)

  const neck = sphere(0.24, def.skin, [1, 0.82, 1])
  neck.position.y = -0.7
  group.add(neck)

  const head = sphere(1.05, def.skin, [0.95, 1.05, 0.9])
  head.position.y = 0.12
  group.add(head)

  addHair(group, def)
  addFace(group, def)

  const shine = sphere(0.08, '#ffffff', [1, 0.35, 1])
  shine.position.set(-0.38, 0.46, 0.88)
  shine.material = new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 0.08, metalness: 0, transparent: true, opacity: 0.85 })
  group.add(shine)

  return group
}

function addFace(group: THREE.Group, def: AvatarDef) {
  const eyeMat = material('#101827', 0.2)
  for (const x of [-0.36, 0.36]) {
    const eye = new THREE.Mesh(new THREE.SphereGeometry(0.08, 24, 24), eyeMat)
    eye.position.set(x, 0.2, 0.88)
    group.add(eye)

    const glint = new THREE.Mesh(new THREE.SphereGeometry(0.022, 12, 12), material('#ffffff', 0.05))
    glint.position.set(x - 0.025, 0.23, 0.94)
    group.add(glint)
  }

  const smile = new THREE.Mesh(new THREE.TorusGeometry(0.24, 0.025, 12, 48, Math.PI), material('#5b2d25', 0.25))
  smile.rotation.x = Math.PI
  smile.position.set(0, -0.2, 0.91)
  group.add(smile)

  if (def.facialHair) {
    const hairMat = material(def.hair, 0.42)
    if (def.facialHair === 'beard') {
      const beard = new THREE.Mesh(new THREE.SphereGeometry(0.68, 36, 36), hairMat)
      beard.scale.set(0.9, 0.55, 0.28)
      beard.position.set(0, -0.34, 0.83)
      group.add(beard)
      const cutout = sphere(0.34, def.skin, [1, 0.55, 0.28])
      cutout.position.set(0, -0.25, 0.92)
      group.add(cutout)
    }
    if (def.facialHair === 'mustache' || def.facialHair === 'beard' || def.facialHair === 'goatee') {
      const mustache = new THREE.Mesh(new THREE.TorusGeometry(0.2, 0.035, 10, 36, Math.PI), hairMat)
      mustache.rotation.x = Math.PI
      mustache.position.set(0, -0.1, 0.95)
      group.add(mustache)
    }
    if (def.facialHair === 'goatee') {
      const goatee = sphere(0.16, def.hair, [0.85, 1.25, 0.35])
      goatee.position.set(0, -0.34, 0.92)
      group.add(goatee)
    }
  }

  const cheekMat = new THREE.MeshStandardMaterial({ color: def.accent, roughness: 0.4, transparent: true, opacity: 0.38 })
  for (const x of [-0.58, 0.58]) {
    const cheek = new THREE.Mesh(new THREE.SphereGeometry(0.12, 24, 24), cheekMat)
    cheek.scale.set(1, 0.5, 0.25)
    cheek.position.set(x, -0.1, 0.86)
    group.add(cheek)
  }

  if (def.glasses) {
    const glassMat = material('#111827', 0.18)
    for (const x of [-0.34, 0.34]) {
      const ring = new THREE.Mesh(new THREE.TorusGeometry(0.19, 0.018, 12, 42), glassMat)
      ring.position.set(x, 0.2, 0.91)
      group.add(ring)
    }
    const bridge = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.025, 0.025), glassMat)
    bridge.position.set(0, 0.2, 0.91)
    group.add(bridge)
  }
}

function addHair(group: THREE.Group, def: AvatarDef) {
  const hairMat = material(def.hair, 0.38)
  const cap = new THREE.Mesh(new THREE.SphereGeometry(1.08, 48, 48, 0, Math.PI * 2, 0, Math.PI * 0.52), hairMat)
  cap.scale.set(0.98, 0.76, 0.92)
  cap.position.set(0, 0.55, 0.02)
  cap.rotation.x = -0.08
  group.add(cap)

  if (def.hairStyle === 'bun') {
    const bun = sphere(0.35, def.hair)
    bun.position.set(0.72, 0.55, -0.38)
    group.add(bun)
  }

  if (def.hairStyle === 'curly') {
    for (let index = 0; index < 8; index++) {
      const curl = sphere(0.24, def.hair)
      const angle = (index / 8) * Math.PI * 2
      curl.position.set(Math.cos(angle) * 0.75, 0.55 + Math.sin(index) * 0.1, Math.sin(angle) * 0.42 + 0.18)
      group.add(curl)
    }
  }

  if (def.hairStyle === 'wave' || def.hairStyle === 'sweep') {
    const fringe = new THREE.Mesh(new THREE.SphereGeometry(0.5, 32, 32), hairMat)
    fringe.scale.set(1.25, 0.42, 0.52)
    fringe.rotation.z = def.hairStyle === 'wave' ? -0.28 : 0.25
    fringe.position.set(def.hairStyle === 'wave' ? -0.25 : 0.22, 0.63, 0.62)
    group.add(fringe)
  }

  if (def.hairStyle === 'crop' || def.hairStyle === 'short') {
    const front = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.18, 0.35), hairMat)
    front.position.set(0, 0.57, 0.72)
    front.rotation.x = -0.18
    group.add(front)
  }
}
