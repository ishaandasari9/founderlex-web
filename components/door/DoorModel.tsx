'use client'

import React, { useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { RoundedBox } from '@react-three/drei'
import type { Group, Mesh, MeshBasicMaterial } from 'three'

const RED = '#DB1A1A'
const RED_DARK = '#C01616'
const CREAM = '#F7F2EB'
const INK = '#2A2420'
const WARM_GLOW = '#FBEFD7'

export interface DoorModelProps {
  openAmountRef: React.RefObject<number>
  lite: boolean
  interactive: boolean
  onActivate: () => void
}

export default function DoorModel({ openAmountRef, lite, interactive, onActivate }: DoorModelProps) {
  const hinge = useRef<Group>(null)
  const innerGlow = useRef<Mesh>(null)
  const segments = lite ? 12 : 24

  useFrame(() => {
    const open = openAmountRef.current ?? 0
    if (hinge.current) {
      hinge.current.rotation.y = -open * 1.65
    }
    if (innerGlow.current) {
      const mat = innerGlow.current.material as MeshBasicMaterial
      mat.opacity = 0.45 + open * 0.5
    }
  })

  return (
    <group position={[0, -0.05, 0]}>
      {/* Warm halo behind doorway */}
      <mesh position={[0, 0.1, -0.55]}>
        <planeGeometry args={[2.2, 2.6]} />
        <meshBasicMaterial color="#FBEFD7" transparent opacity={0.35} />
      </mesh>

      <mesh position={[-0.62, 0.05, -0.02]} castShadow={!lite}>
        <boxGeometry args={[0.12, 2.35, 0.18]} />
        <meshStandardMaterial color={INK} roughness={0.55} />
      </mesh>
      <mesh position={[0.62, 0.05, -0.02]} castShadow={!lite}>
        <boxGeometry args={[0.12, 2.35, 0.18]} />
        <meshStandardMaterial color={INK} roughness={0.55} />
      </mesh>
      <mesh position={[0, 1.22, -0.02]} castShadow={!lite}>
        <boxGeometry args={[1.36, 0.12, 0.18]} />
        <meshStandardMaterial color={INK} roughness={0.55} />
      </mesh>

      <mesh position={[0, 0.2, -2.4]}>
        <planeGeometry args={[4.5, 3.2]} />
        <meshBasicMaterial color={WARM_GLOW} />
      </mesh>
      <mesh ref={innerGlow} position={[0, 0.15, -1.15]}>
        <planeGeometry args={[1.05, 2.25]} />
        <meshBasicMaterial color="#FFFDF8" transparent opacity={0.55} />
      </mesh>

      <mesh receiveShadow={!lite} rotation={[-Math.PI / 2, 0, 0]} position={[0, -1.12, 0.2]}>
        <planeGeometry args={[5.5, 5]} />
        <meshStandardMaterial color="#EDE4D6" roughness={0.94} />
      </mesh>

      <group ref={hinge} position={[-0.52, 0, 0.04]}>
        <group
          onClick={e => {
            if (!interactive) return
            e.stopPropagation()
            onActivate()
          }}
        >
          <RoundedBox
            args={[1.04, 2.18, 0.11]}
            radius={0.07}
            smoothness={lite ? 2 : 4}
            position={[0.52, 0, 0]}
            castShadow={!lite}
          >
            <meshStandardMaterial
              color={RED}
              roughness={0.32}
              metalness={0.06}
              emissive="#8B1010"
              emissiveIntensity={0.08}
            />
          </RoundedBox>

          <mesh position={[0.52, 0.52, 0.058]}>
            <boxGeometry args={[0.72, 0.72, 0.01]} />
            <meshStandardMaterial color={RED_DARK} roughness={0.45} transparent opacity={0.35} />
          </mesh>
          <mesh position={[0.52, -0.38, 0.058]}>
            <boxGeometry args={[0.72, 0.88, 0.01]} />
            <meshStandardMaterial color={RED_DARK} roughness={0.45} transparent opacity={0.35} />
          </mesh>

          <mesh position={[0.88, 0.02, 0.07]}>
            <sphereGeometry args={[0.042, segments, segments]} />
            <meshStandardMaterial color={CREAM} roughness={0.28} />
          </mesh>
        </group>
      </group>
    </group>
  )
}
