'use client'

import { Canvas, useFrame } from '@react-three/fiber'
import { Html } from '@react-three/drei'
import { useRef } from 'react'
import * as THREE from 'three'

export function HeroVisual3D() {
  return (
    <div className="relative min-h-[430px] w-full overflow-hidden rounded-[1.75rem] bg-[#07111f] shadow-[0_40px_120px_rgba(2,6,23,0.28)] sm:min-h-[540px] lg:min-h-[620px]">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_24%_18%,rgba(59,130,246,0.32),transparent_26%),radial-gradient(circle_at_78%_26%,rgba(139,92,246,0.28),transparent_24%),linear-gradient(135deg,#07111f,#111827_48%,#172554)]" />
      <div className="pointer-events-none absolute inset-0 dashboard-grid-bg opacity-40" />
      <div className="pointer-events-none absolute inset-0">
        {Array.from({ length: 18 }).map((_, index) => (
          <span
            key={index}
            className="absolute h-1 w-1 rounded-full bg-cyan-200/70"
            style={{
              left: `${(index * 37) % 100}%`,
              top: `${14 + ((index * 19) % 70)}%`,
              animation: `float-slow ${6 + (index % 5)}s ease-in-out infinite`,
            }}
          />
        ))}
      </div>
      <Canvas
        className="!absolute !inset-0 !h-full !w-full"
        camera={{ position: [0, 0.35, 6.8], fov: 42 }}
        dpr={[1, 1.7]}
        gl={{ antialias: true, alpha: true }}
      >
        <ambientLight intensity={0.7} />
        <directionalLight position={[3, 4, 5]} intensity={2.4} color="#ffffff" />
        <pointLight position={[-3, 2, 3]} intensity={2.2} color="#3B82F6" />
        <pointLight position={[3, -1.5, 2]} intensity={1.8} color="#8B5CF6" />
        <ExamDashboard />
      </Canvas>
      <div className="pointer-events-none absolute left-5 top-5 hidden gap-3 lg:grid">
        {['AI Powered', 'Real-time Alerts', '250+ Badges', 'BRD Ready'].map((badge) => (
          <span key={badge} className="rounded-xl border border-white/15 bg-white/10 px-4 py-2 text-xs font-semibold text-white backdrop-blur-md">
            {badge}
          </span>
        ))}
      </div>
    </div>
  )
}

function ExamDashboard() {
  const group = useRef<THREE.Group>(null)

  useFrame(({ clock, pointer }) => {
    const elapsed = clock.getElapsedTime()
    if (!group.current) return
    group.current.position.y = Math.sin(elapsed * 0.65) * 0.08
    group.current.rotation.y = Math.sin(elapsed * 0.28) * 0.16 + pointer.x * 0.1
    group.current.rotation.x = -0.08 - pointer.y * 0.04
  })

  return (
    <group ref={group}>
      <mesh position={[0, 0.08, 0]} rotation={[-0.08, 0, 0]}>
        <boxGeometry args={[3.5, 2.05, 0.12]} />
        <meshStandardMaterial color="#dbeafe" metalness={0.55} roughness={0.2} />
      </mesh>
      <mesh position={[0, 0.08, 0.08]} rotation={[-0.08, 0, 0]}>
        <planeGeometry args={[3.2, 1.75]} />
        <meshStandardMaterial color="#020617" emissive="#1d4ed8" emissiveIntensity={0.35} roughness={0.35} />
      </mesh>
      <mesh position={[0, -1.12, 0.18]} rotation={[0.18, 0, 0]}>
        <boxGeometry args={[2.5, 0.12, 1.1]} />
        <meshStandardMaterial color="#94a3b8" metalness={0.7} roughness={0.22} />
      </mesh>
      <mesh position={[0, -0.72, -0.15]}>
        <boxGeometry args={[0.36, 0.78, 0.18]} />
        <meshStandardMaterial color="#cbd5e1" metalness={0.65} roughness={0.2} />
      </mesh>

      <Html transform position={[0, 0.1, 0.16]} rotation={[-0.08, 0, 0]} distanceFactor={1.55}>
        <div className="w-[300px] rounded-xl border border-cyan-200/20 bg-slate-950/90 p-4 text-white shadow-2xl backdrop-blur-md">
          <p className="text-[10px] font-bold uppercase tracking-[0.24em] text-cyan-200">AI Proctoring Active</p>
          <div className="mt-3 grid gap-2 text-xs">
            <div className="flex items-center justify-between rounded-lg bg-white/8 px-3 py-2"><span>🟢 Gaze Tracking</span><strong>Live</strong></div>
            <div className="flex items-center justify-between rounded-lg bg-white/8 px-3 py-2"><span>🟢 Device Scan</span><strong>Clean</strong></div>
            <div className="grid grid-cols-2 gap-2">
              <div className="rounded-lg border border-white/10 p-3"><span className="text-slate-400">👥 Face Count</span><p className="text-lg font-semibold">1</p></div>
              <div className="rounded-lg border border-white/10 p-3"><span className="text-slate-400">🔒 Integrity</span><p className="text-lg font-semibold">98%</p></div>
            </div>
            <div className="animate-pulse rounded-lg border border-red-300/30 bg-red-500/15 px-3 py-2 text-red-100">Violation flash: none active</div>
          </div>
        </div>
      </Html>

      <OrbitingObject radius={2.25} speed={0.65} color="#3B82F6" shape="camera" />
      <OrbitingObject radius={2.7} speed={0.45} color="#8B5CF6" shape="eye" offset={2.1} />
      <OrbitingObject radius={2.45} speed={0.56} color="#f43f5e" shape="alert" offset={4.2} />
    </group>
  )
}

function OrbitingObject({ radius, speed, color, offset = 0, shape }: { radius: number; speed: number; color: string; offset?: number; shape: 'camera' | 'eye' | 'alert' }) {
  const group = useRef<THREE.Group>(null)

  useFrame(({ clock }) => {
    const angle = clock.getElapsedTime() * speed + offset
    if (!group.current) return
    group.current.position.x = Math.cos(angle) * radius
    group.current.position.z = Math.sin(angle) * 0.55
    group.current.position.y = Math.sin(angle * 1.3) * 0.45
    group.current.rotation.y = angle
  })

  return (
    <group ref={group}>
      {shape === 'camera' && <BoxGeometryMesh color={color} />}
      {shape === 'eye' && (
        <mesh>
          <sphereGeometry args={[0.16, 24, 16]} />
          <meshStandardMaterial color={color} emissive={color} emissiveIntensity={0.55} />
        </mesh>
      )}
      {shape === 'alert' && (
        <mesh>
          <octahedronGeometry args={[0.2, 0]} />
          <meshStandardMaterial color={color} emissive={color} emissiveIntensity={0.6} metalness={0.45} roughness={0.2} />
        </mesh>
      )}
    </group>
  )
}

function BoxGeometryMesh({ color }: { color: string }) {
  return (
    <mesh>
      <boxGeometry args={[0.34, 0.2, 0.2]} />
      <meshStandardMaterial color={color} emissive={color} emissiveIntensity={0.45} />
    </mesh>
  )
}
