'use client'

import { useEffect, useMemo, useRef, type CSSProperties } from 'react'
import * as THREE from 'three'
import type { Avatar3DId } from '@/lib/avatar-options'
import { AVATAR_3D_IDS } from '@/lib/avatar-options'

type AvatarDef = {
  id: Avatar3DId
  name: string
  skin: string
  hair: string
  outfit: string
  accent: string
  bg: string
  hairStyle: 'short' | 'sweep' | 'wave' | 'bun' | 'curly' | 'crop'
  glasses?: boolean
}

export const AVATAR_3D_DEFS: AvatarDef[] = [
  { id: 'm1', name: 'Aero Blue', skin: '#f2c3a2', hair: '#1f2937', outfit: '#2563eb', accent: '#60a5fa', bg: '#dbeafe', hairStyle: 'sweep' },
  { id: 'm2', name: 'Forest Pro', skin: '#b77752', hair: '#2f1d14', outfit: '#059669', accent: '#34d399', bg: '#dcfce7', hairStyle: 'crop' },
  { id: 'm3', name: 'Cyan Focus', skin: '#d8a27b', hair: '#164e63', outfit: '#0891b2', accent: '#22d3ee', bg: '#cffafe', hairStyle: 'short', glasses: true },
  { id: 'm4', name: 'Amber Lead', skin: '#e6aa78', hair: '#78350f', outfit: '#d97706', accent: '#f59e0b', bg: '#fef3c7', hairStyle: 'curly' },
  { id: 'm5', name: 'Crimson Edge', skin: '#8d5b42', hair: '#020617', outfit: '#dc2626', accent: '#fb7185', bg: '#fee2e2', hairStyle: 'sweep' },
  { id: 'm6', name: 'Teal Sprint', skin: '#f1c7a6', hair: '#134e4a', outfit: '#0ea5e9', accent: '#38bdf8', bg: '#e0f2fe', hairStyle: 'crop' },
  { id: 'm7', name: 'Slate Mentor', skin: '#c99a72', hair: '#1e1b4b', outfit: '#475569', accent: '#818cf8', bg: '#f5f5f4', hairStyle: 'short', glasses: true },
  { id: 'f1', name: 'Rose Analyst', skin: '#efc0a0', hair: '#6b3f2a', outfit: '#db2777', accent: '#f472b6', bg: '#fce7f3', hairStyle: 'wave' },
  { id: 'f2', name: 'Violet Ops', skin: '#efc6a8', hair: '#4c1d95', outfit: '#6d28d9', accent: '#a78bfa', bg: '#ede9fe', hairStyle: 'bun' },
  { id: 'f3', name: 'Green Craft', skin: '#d29a75', hair: '#14532d', outfit: '#16a34a', accent: '#86efac', bg: '#f0fdf4', hairStyle: 'curly' },
  { id: 'f4', name: 'Fuchsia Core', skin: '#a76a4d', hair: '#86198f', outfit: '#c026d3', accent: '#e879f9', bg: '#fae8ff', hairStyle: 'wave' },
  { id: 'f5', name: 'Orange Coach', skin: '#f5cdb4', hair: '#c2410c', outfit: '#ea580c', accent: '#fb923c', bg: '#ffedd5', hairStyle: 'bun' },
  { id: 'f6', name: 'Indigo Calm', skin: '#d9a985', hair: '#312e81', outfit: '#4f46e5', accent: '#818cf8', bg: '#e0e7ff', hairStyle: 'sweep' },
  { id: 'f7', name: 'Mint Sharp', skin: '#bd7b55', hair: '#064e3b', outfit: '#0f766e', accent: '#5eead4', bg: '#ccfbf1', hairStyle: 'crop', glasses: true },
  { id: 'x1', name: 'Prism Guide', skin: '#e4b38f', hair: '#111827', outfit: '#9333ea', accent: '#facc15', bg: '#fef9c3', hairStyle: 'curly' },
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
  return (
    <div className="grid grid-cols-5 gap-2 sm:grid-cols-8">
      {AVATAR_3D_IDS.map((id) => (
        <button
          key={id}
          type="button"
          onClick={() => onChange(id)}
          className={`rounded-2xl border bg-white p-1 shadow-sm transition-all ${
            value === id ? 'border-black ring-2 ring-black/10' : 'border-zinc-200 hover:border-zinc-400'
          }`}
          aria-label={`Choose ${AVATAR_3D_DEFS.find((item) => item.id === id)?.name || id}`}
          title={AVATAR_3D_DEFS.find((item) => item.id === id)?.name || id}
        >
          <Avatar3D avatarId={id} size={42} />
        </button>
      ))}
    </div>
  )
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
