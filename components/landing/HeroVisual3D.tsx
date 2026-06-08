'use client'

import { Canvas, useFrame } from '@react-three/fiber'
import { useMemo, useRef } from 'react'
import * as THREE from 'three'

export function HeroVisual3D() {
  return (
    <div className="relative min-h-[430px] w-full overflow-hidden rounded-[1.75rem] bg-[#050816] shadow-[0_40px_120px_rgba(2,6,23,0.28)] sm:min-h-[540px] lg:min-h-[620px]">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_24%_18%,rgba(59,130,246,0.28),transparent_28%),radial-gradient(circle_at_78%_30%,rgba(139,92,246,0.24),transparent_26%),linear-gradient(135deg,#050816,#0f172a_52%,#111827)]" />
      <div className="pointer-events-none absolute inset-0 dashboard-grid-bg opacity-25" />
      <Canvas
        className="!absolute !inset-0 !h-full !w-full"
        camera={{ position: [0, 0.15, 7.5], fov: 42 }}
        dpr={[1, 1.6]}
        gl={{ antialias: true, alpha: true }}
      >
        <ambientLight intensity={0.7} />
        <pointLight position={[-3, 2, 3]} intensity={2.2} color="#3B82F6" />
        <pointLight position={[3, -1, 2]} intensity={1.8} color="#8B5CF6" />
        <SignalWave />
        <NeuralFoam />
        <DataStreamMesh />
        <ParticleField />
      </Canvas>
      <div className="pointer-events-none absolute inset-x-6 bottom-6 hidden items-end justify-between text-white lg:flex">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.35em] text-cyan-200">Neural Tide Layer</p>
          <p className="mt-2 max-w-sm text-sm leading-6 text-slate-300">Assessment, integrity, learning, and operations signals rolling through one adaptive intelligence wave.</p>
        </div>
        <div className="grid gap-2 text-right text-xs text-slate-300">
          <span>Realtime inference</span>
          <span>Adaptive assessment</span>
          <span>Governed evidence</span>
        </div>
      </div>
    </div>
  )
}

function SignalWave() {
  const group = useRef<THREE.Group>(null)
  const curves = useMemo(() => {
    return Array.from({ length: 9 }).map((_, row) => {
      const points: THREE.Vector3[] = []
      for (let i = 0; i < 110; i += 1) {
        const x = -4.2 + i * 0.078
        const shoreBreak = Math.sin(i * 0.11 + row * 0.5) * 0.18
        const y = Math.sin(i * 0.22 + row * 0.72) * (0.34 + row * 0.018) + shoreBreak + (row - 4) * 0.2
        const z = Math.cos(i * 0.15 + row) * 0.58 + Math.sin(i * 0.04) * 0.2
        points.push(new THREE.Vector3(x, y, z))
      }
      return new THREE.CatmullRomCurve3(points)
    })
  }, [])

  useFrame(({ clock, pointer }) => {
    if (!group.current) return
    const elapsed = clock.getElapsedTime()
    group.current.rotation.y = Math.sin(elapsed * 0.48) * 0.2 + pointer.x * 0.08
    group.current.rotation.x = -0.08 - pointer.y * 0.04 + Math.sin(elapsed * 0.34) * 0.035
    group.current.position.x = Math.sin(elapsed * 0.42) * 0.18
    group.current.position.y = Math.sin(elapsed * 0.78) * 0.14
  })

  return (
    <group ref={group}>
      {curves.map((curve, index) => (
        <mesh key={index}>
          <tubeGeometry args={[curve, 144, 0.014 + index * 0.0012, 8, false]} />
          <meshStandardMaterial
            color={index % 2 ? '#8B5CF6' : '#3B82F6'}
            emissive={index % 2 ? '#6D28D9' : '#1D4ED8'}
            emissiveIntensity={0.75}
            transparent
            opacity={0.78}
            roughness={0.26}
            metalness={0.18}
          />
        </mesh>
      ))}
    </group>
  )
}

function NeuralFoam() {
  const group = useRef<THREE.Group>(null)
  const nodes = useMemo(() => Array.from({ length: 36 }).map((_, index) => {
    const x = -3.6 + (index % 12) * 0.65
    const row = Math.floor(index / 12)
    return {
      x,
      y: Math.sin(index * 0.85) * 0.7 + (row - 1) * 0.35,
      z: Math.cos(index * 0.7) * 0.85,
      size: 0.018 + (index % 4) * 0.006,
    }
  }), [])

  useFrame(({ clock }) => {
    if (!group.current) return
    const elapsed = clock.getElapsedTime()
    group.current.rotation.y = Math.sin(elapsed * 0.36) * 0.12
    group.current.position.x = Math.sin(elapsed * 0.9) * 0.22
    group.current.position.y = Math.cos(elapsed * 0.72) * 0.1
  })

  return (
    <group ref={group}>
      {nodes.map((node, index) => (
        <mesh key={`foam-${index}`} position={[node.x, node.y, node.z]}>
          <sphereGeometry args={[node.size, 12, 8]} />
          <meshStandardMaterial color={index % 3 === 0 ? '#67E8F9' : '#C4B5FD'} emissive={index % 3 === 0 ? '#0891B2' : '#7C3AED'} emissiveIntensity={1.15} />
        </mesh>
      ))}
      {nodes.slice(0, 24).map((node, index) => {
        const next = nodes[index + 1]
        if (!next) return null
        const curve = new THREE.CatmullRomCurve3([
          new THREE.Vector3(node.x, node.y, node.z),
          new THREE.Vector3((node.x + next.x) / 2, (node.y + next.y) / 2 + 0.08, (node.z + next.z) / 2),
          new THREE.Vector3(next.x, next.y, next.z),
        ])
        return (
          <mesh key={`link-${index}`}>
            <tubeGeometry args={[curve, 16, 0.0035, 5, false]} />
            <meshBasicMaterial color="#93C5FD" transparent opacity={0.28} />
          </mesh>
        )
      })}
    </group>
  )
}

function DataStreamMesh() {
  const mesh = useRef<THREE.Points>(null)
  const { positions, colors } = useMemo(() => {
    const count = 420
    const positions = new Float32Array(count * 3)
    const colors = new Float32Array(count * 3)
    const colorA = new THREE.Color('#60A5FA')
    const colorB = new THREE.Color('#A78BFA')
    for (let i = 0; i < count; i += 1) {
      const t = i / count
      positions[i * 3] = (Math.random() - 0.5) * 7
      positions[i * 3 + 1] = Math.sin(t * Math.PI * 8) * 1.25 + (Math.random() - 0.5) * 0.5
      positions[i * 3 + 2] = (Math.random() - 0.5) * 1.7
      const color = colorA.clone().lerp(colorB, t)
      colors[i * 3] = color.r
      colors[i * 3 + 1] = color.g
      colors[i * 3 + 2] = color.b
    }
    return { positions, colors }
  }, [])

  useFrame(({ clock }) => {
    if (!mesh.current) return
    mesh.current.rotation.z = Math.sin(clock.getElapsedTime() * 0.38) * 0.06
    mesh.current.rotation.y = clock.getElapsedTime() * 0.11
    mesh.current.position.x = Math.sin(clock.getElapsedTime() * 0.62) * 0.2
  })

  return (
    <points ref={mesh}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" args={[positions, 3]} />
        <bufferAttribute attach="attributes-color" args={[colors, 3]} />
      </bufferGeometry>
      <pointsMaterial size={0.028} vertexColors transparent opacity={0.82} depthWrite={false} />
    </points>
  )
}

function ParticleField() {
  const group = useRef<THREE.Group>(null)
  useFrame(({ clock }) => {
    if (!group.current) return
    group.current.rotation.y = -clock.getElapsedTime() * 0.085
    group.current.position.y = Math.sin(clock.getElapsedTime() * 0.7) * 0.08
  })

  return (
    <group ref={group}>
      {Array.from({ length: 28 }).map((_, index) => {
        const angle = (index / 28) * Math.PI * 2
        const radius = 2.4 + (index % 5) * 0.18
        return (
          <mesh key={index} position={[Math.cos(angle) * radius, Math.sin(index * 1.7) * 0.7, Math.sin(angle) * 0.6]}>
            <sphereGeometry args={[0.025 + (index % 3) * 0.008, 12, 8]} />
            <meshStandardMaterial color={index % 2 ? '#A78BFA' : '#67E8F9'} emissive={index % 2 ? '#7C3AED' : '#0891B2'} emissiveIntensity={0.9} />
          </mesh>
        )
      })}
    </group>
  )
}
