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
        <DataStreamMesh />
        <ParticleField />
      </Canvas>
      <div className="pointer-events-none absolute inset-x-6 bottom-6 hidden items-end justify-between text-white lg:flex">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.35em] text-cyan-200">AI Signal Layer</p>
          <p className="mt-2 max-w-sm text-sm leading-6 text-slate-300">Assessment, integrity, learning, and operations signals flowing through one intelligence plane.</p>
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
    return Array.from({ length: 7 }).map((_, row) => {
      const points: THREE.Vector3[] = []
      for (let i = 0; i < 90; i += 1) {
        const x = -3.8 + i * 0.085
        const y = Math.sin(i * 0.18 + row * 0.8) * 0.36 + (row - 3) * 0.22
        const z = Math.cos(i * 0.12 + row) * 0.46
        points.push(new THREE.Vector3(x, y, z))
      }
      return new THREE.CatmullRomCurve3(points)
    })
  }, [])

  useFrame(({ clock, pointer }) => {
    if (!group.current) return
    const elapsed = clock.getElapsedTime()
    group.current.rotation.y = Math.sin(elapsed * 0.18) * 0.16 + pointer.x * 0.08
    group.current.rotation.x = -0.1 - pointer.y * 0.04
    group.current.position.y = Math.sin(elapsed * 0.35) * 0.08
  })

  return (
    <group ref={group}>
      {curves.map((curve, index) => (
        <mesh key={index}>
          <tubeGeometry args={[curve, 128, 0.012 + index * 0.001, 8, false]} />
          <meshStandardMaterial
            color={index % 2 ? '#8B5CF6' : '#3B82F6'}
            emissive={index % 2 ? '#6D28D9' : '#1D4ED8'}
            emissiveIntensity={0.75}
            transparent
            opacity={0.72}
            roughness={0.26}
            metalness={0.18}
          />
        </mesh>
      ))}
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
    mesh.current.rotation.z = Math.sin(clock.getElapsedTime() * 0.16) * 0.04
    mesh.current.rotation.y = clock.getElapsedTime() * 0.045
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
    group.current.rotation.y = -clock.getElapsedTime() * 0.025
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
