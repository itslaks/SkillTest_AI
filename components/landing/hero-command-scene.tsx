'use client'

import { Canvas, useFrame } from '@react-three/fiber'
import { useMemo, useRef } from 'react'
import * as THREE from 'three'

const nodes = [
  { label: 'Batch', value: '24', position: [-2.4, 0.85, 0.2], color: '#22d3ee' },
  { label: 'Attendance', value: '94%', position: [-0.75, -0.35, 0.55], color: '#a78bfa' },
  { label: 'AI', value: 'Live', position: [0.95, 0.55, -0.1], color: '#34d399' },
  { label: 'Reports', value: 'Ready', position: [2.35, -0.62, 0.3], color: '#f59e0b' },
] as const

export function HeroCommandScene() {
  return (
    <div className="relative min-h-[430px] w-full overflow-hidden rounded-[1.75rem] bg-[#06080d] shadow-[0_40px_120px_rgba(2,6,23,0.28)] sm:min-h-[540px] lg:min-h-[620px]">
      <Canvas
        className="!absolute !inset-0 !h-full !w-full"
        style={{ position: 'absolute', inset: 0, height: '100%', width: '100%' }}
        camera={{ position: [0, 0.35, 6.5], fov: 45 }}
        dpr={[1, 1.5]}
        gl={{ antialias: true, alpha: true, powerPreference: 'high-performance' }}
      >
        <color attach="background" args={['#06080d']} />
        <ambientLight intensity={0.62} />
        <directionalLight position={[3, 4, 5]} intensity={2.2} color="#ffffff" />
        <pointLight position={[-3.5, 1.8, 3]} intensity={1.8} color="#38bdf8" />
        <pointLight position={[3, -2, 2.5]} intensity={1.5} color="#f59e0b" />
        <CommandLattice />
      </Canvas>

      <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(180deg,rgba(255,255,255,0.04),transparent_28%,rgba(0,0,0,0.28)),radial-gradient(circle_at_50%_20%,rgba(255,255,255,0.08),transparent_34%)]" />
      <div className="pointer-events-none absolute inset-0 dashboard-grid-bg opacity-45" />

      <div className="relative z-10 flex min-h-[430px] flex-col justify-between p-5 text-white sm:min-h-[540px] sm:p-6 lg:min-h-[620px]">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.35em] text-cyan-100">Mavericks Command Lattice</p>
            <p className="mt-2 max-w-sm text-sm leading-6 text-slate-300">
              Live training signals connected from assignment to evidence.
            </p>
          </div>
          <span className="rounded-full border border-emerald-300/30 bg-emerald-300/10 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.24em] text-emerald-100">
            Active
          </span>
        </div>

        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {nodes.map((node) => (
            <div key={node.label} className="min-w-0 rounded-xl border border-white/12 bg-white/[0.075] p-3 backdrop-blur-md">
              <p className="text-[10px] font-semibold uppercase tracking-[0.24em] text-slate-300">{node.label}</p>
              <p className="mt-2 text-xl font-semibold text-white">{node.value}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

function CommandLattice() {
  const group = useRef<THREE.Group>(null)
  const ring = useRef<THREE.Group>(null)
  const elapsedRef = useRef(0)
  const lineGeometry = useMemo(() => {
    const points: number[] = []
    for (let i = 0; i < nodes.length - 1; i += 1) {
      points.push(...nodes[i].position, ...nodes[i + 1].position)
    }
    points.push(...nodes[0].position, ...nodes[2].position, ...nodes[1].position, ...nodes[3].position)
    const geometry = new THREE.BufferGeometry()
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(points, 3))
    return geometry
  }, [])

  useFrame(({ pointer }, delta) => {
    elapsedRef.current += delta
    const elapsed = elapsedRef.current
    if (group.current) {
      group.current.rotation.y = Math.sin(elapsed * 0.22) * 0.18 + pointer.x * 0.12
      group.current.rotation.x = -0.12 + Math.sin(elapsed * 0.18) * 0.05 - pointer.y * 0.06
      group.current.position.y = Math.sin(elapsed * 0.5) * 0.08
    }
    if (ring.current) {
      ring.current.rotation.z = elapsed * 0.18
      ring.current.rotation.y = elapsed * 0.08
    }
  })

  return (
    <group ref={group}>
      <group ref={ring}>
        <mesh rotation={[Math.PI / 2, 0, 0]}>
          <torusGeometry args={[2.15, 0.012, 12, 128]} />
          <meshStandardMaterial color="#38bdf8" emissive="#075985" emissiveIntensity={0.7} metalness={0.55} roughness={0.28} />
        </mesh>
        <mesh rotation={[Math.PI / 2.35, 0.28, 0.55]}>
          <torusGeometry args={[1.45, 0.01, 12, 128]} />
          <meshStandardMaterial color="#a78bfa" emissive="#4c1d95" emissiveIntensity={0.55} metalness={0.5} roughness={0.3} />
        </mesh>
      </group>

      <lineSegments geometry={lineGeometry}>
        <lineBasicMaterial color="#94a3b8" transparent opacity={0.46} />
      </lineSegments>

      {nodes.map((node, index) => (
        <SignalNode key={node.label} {...node} index={index} />
      ))}

      <mesh position={[0, 0.08, -0.38]} rotation={[-0.35, 0.22, 0]}>
        <boxGeometry args={[1.38, 0.82, 0.08]} />
        <meshStandardMaterial color="#e2e8f0" emissive="#155e75" emissiveIntensity={0.14} metalness={0.62} roughness={0.18} />
      </mesh>
      <mesh position={[0, 0.1, -0.31]} rotation={[-0.35, 0.22, 0]}>
        <planeGeometry args={[1.08, 0.54]} />
        <meshStandardMaterial color="#0f172a" emissive="#0891b2" emissiveIntensity={0.42} metalness={0.25} roughness={0.32} />
      </mesh>
    </group>
  )
}

function SignalNode({
  position,
  color,
  index,
}: {
  position: readonly [number, number, number]
  color: string
  index: number
}) {
  const node = useRef<THREE.Group>(null)
  const elapsedRef = useRef(0)

  useFrame((_, delta) => {
    elapsedRef.current += delta
    const elapsed = elapsedRef.current
    if (node.current) {
      node.current.position.y = position[1] + Math.sin(elapsed * 1.15 + index) * 0.08
      node.current.rotation.y = elapsed * 0.38 + index
    }
  })

  return (
    <group ref={node} position={[position[0], position[1], position[2]]}>
      <mesh>
        <octahedronGeometry args={[0.24, 0]} />
        <meshStandardMaterial color={color} emissive={color} emissiveIntensity={0.42} metalness={0.75} roughness={0.18} />
      </mesh>
      <mesh rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[0.42, 0.007, 8, 72]} />
        <meshStandardMaterial color={color} emissive={color} emissiveIntensity={0.34} transparent opacity={0.7} />
      </mesh>
    </group>
  )
}
