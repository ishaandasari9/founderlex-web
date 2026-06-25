'use client'

import React, { useCallback, useEffect, useRef, useState } from 'react'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import type { Camera, PointLight } from 'three'
import type { DoorRenderMode } from '../../lib/door-capabilities'
import DoorModel from './DoorModel'
import { clamp01, easeInOutCubic, easeOutCubic, remap } from './easing'

const CREAM = '#F7F2EB'
const WARM_LIGHT = '#FFF8EE'

const DURATION = { full: 2.0, lite: 1.6 } as const

type TransitionDir = 'enter' | 'exit'

function WarmLights({ lite, openAmountRef }: { lite: boolean; openAmountRef: React.RefObject<number> }) {
  const light = useRef<PointLight>(null)
  useFrame(() => {
    if (light.current) {
      light.current.intensity = 0.4 + (openAmountRef.current ?? 0) * (lite ? 1.1 : 1.8)
    }
  })

  return (
    <>
      <ambientLight intensity={lite ? 0.78 : 0.62} color={WARM_LIGHT} />
      <directionalLight
        position={[2.2, 4.2, 2.8]}
        intensity={lite ? 1.05 : 1.35}
        color={WARM_LIGHT}
        castShadow={!lite}
        shadow-mapSize={lite ? [512, 512] : [1024, 1024]}
      />
      <directionalLight position={[-2.5, 2.2, 1.5]} intensity={0.28} color="#F0DCBC" />
      <pointLight ref={light} position={[0, 0.8, -1.8]} color="#FFFDF8" distance={lite ? 5 : 7} />
    </>
  )
}

function applyFrame(
  t: number,
  lite: boolean,
  openAmount: React.MutableRefObject<number>,
  camera: Camera,
  camStart: { x: number; y: number; z: number },
  camEnd: { x: number; y: number; z: number },
) {
  const doorPhase = easeInOutCubic(remap(t, 0, lite ? 0.55 : 0.5))
  openAmount.current = doorPhase

  const walkT = easeOutCubic(remap(t, lite ? 0.2 : 0.15, 1))
  camera.position.set(
    camStart.x + (camEnd.x - camStart.x) * walkT,
    camStart.y + (camEnd.y - camStart.y) * walkT,
    camStart.z + (camEnd.z - camStart.z) * walkT,
  )
  camera.lookAt(0, 0.02 + walkT * 0.04, -1.2 - walkT * 0.8)
}

function CinematicRig({
  mode,
  enterSignal,
  exitSignal,
  onAnimatingChange,
  onTransitionStart,
  onEnterApp,
  onExitComplete,
  onRequestEnter,
}: {
  mode: Exclude<DoorRenderMode, '2d'>
  enterSignal: number
  exitSignal: number
  onAnimatingChange?: (animating: boolean) => void
  onTransitionStart?: () => void
  onEnterApp: () => void
  onExitComplete: () => void
  onRequestEnter: () => void
}) {
  const lite = mode === '3d-lite'
  const duration = lite ? DURATION.lite : DURATION.full
  const { camera } = useThree()

  const progress = useRef(0)
  const openAmount = useRef(0)
  const active = useRef(false)
  const direction = useRef<TransitionDir | null>(null)
  const consumedEnter = useRef(0)
  const consumedExit = useRef(0)
  const [canInteract, setCanInteract] = useState(true)

  const camStart = { x: 0, y: 0.12, z: lite ? 3.5 : 3.2 }
  const camEnd = { x: 0, y: 0.05, z: lite ? -0.3 : -0.5 }

  const applyAt = useCallback((t: number) => {
    applyFrame(t, lite, openAmount, camera, camStart, camEnd)
  }, [camera, lite])

  const finishIdle = useCallback(() => {
    progress.current = 0
    direction.current = null
    active.current = false
    setCanInteract(true)
    applyAt(0)
    onAnimatingChange?.(false)
  }, [applyAt, onAnimatingChange])

  const startTransition = useCallback((dir: TransitionDir) => {
    if (active.current) return
    direction.current = dir
    active.current = true
    setCanInteract(false)
    progress.current = dir === 'enter' ? 0 : 1
    applyAt(progress.current)
    onTransitionStart?.()
    onAnimatingChange?.(true)
  }, [applyAt, onAnimatingChange, onTransitionStart])

  // Pick up new enter/exit signals
  useEffect(() => {
    if (enterSignal > consumedEnter.current) {
      startTransition('enter')
    }
  }, [enterSignal, startTransition])

  useEffect(() => {
    if (exitSignal > consumedExit.current) {
      startTransition('exit')
    }
  }, [exitSignal, startTransition])

  useFrame((_, delta) => {
    const dir = direction.current
    if (!active.current || !dir) return

    const step = delta / duration
    progress.current = clamp01(
      dir === 'enter' ? progress.current + step : progress.current - step,
    )
    applyAt(progress.current)

    if (dir === 'enter' && progress.current >= 1 && enterSignal > consumedEnter.current) {
      consumedEnter.current = enterSignal
      active.current = false
      direction.current = null
      onAnimatingChange?.(false)
      onEnterApp()
      return
    }

    if (dir === 'exit' && progress.current <= 0 && exitSignal > consumedExit.current) {
      consumedExit.current = exitSignal
      finishIdle()
      onExitComplete()
    }
  })

  return (
    <>
      <color attach="background" args={[CREAM]} />
      <fog attach="fog" args={[CREAM, lite ? 3.5 : 4, lite ? 8 : 10]} />
      <WarmLights lite={lite} openAmountRef={openAmount} />
      <DoorModel
        openAmountRef={openAmount}
        lite={lite}
        interactive={canInteract}
        onActivate={onRequestEnter}
      />
    </>
  )
}

export interface DoorScene3DProps {
  mode: Exclude<DoorRenderMode, '2d'>
  enterSignal: number
  exitSignal: number
  immersive: boolean
  onAnimatingChange?: (animating: boolean) => void
  onTransitionStart?: () => void
  onEnterApp: () => void
  onExitComplete: () => void
  onRequestEnter: () => void
  onReady?: () => void
  onWebGLLost?: () => void
}

export default function DoorScene3D({
  mode,
  enterSignal,
  exitSignal,
  immersive,
  onAnimatingChange,
  onTransitionStart,
  onEnterApp,
  onExitComplete,
  onRequestEnter,
  onReady,
  onWebGLLost,
}: DoorScene3DProps) {
  const lite = mode === '3d-lite'

  return (
    <div
      className={`door-hero-canvas${immersive ? ' door-hero-canvas--immersive' : ''}`}
      style={{
        position: immersive ? 'fixed' : 'relative',
        inset: immersive ? 0 : undefined,
        zIndex: immersive ? 300 : undefined,
        width: immersive ? '100%' : 'min(440px, 86vw)',
        height: immersive ? '100%' : 'clamp(300px, 46vh, 440px)',
        borderRadius: immersive ? 0 : 24,
        overflow: 'hidden',
        touchAction: 'manipulation',
      }}
    >
      <Canvas
        dpr={lite ? [1, 1.5] : [1, 2]}
        shadows={!lite}
        frameloop="always"
        gl={{
          antialias: !lite,
          alpha: false,
          powerPreference: lite ? 'low-power' : 'high-performance',
        }}
        camera={{ fov: 42, near: 0.1, far: 20, position: [0, 0.12, lite ? 3.5 : 3.2] }}
        onCreated={({ gl }) => {
          gl.domElement.addEventListener('webglcontextlost', e => {
            e.preventDefault()
            onWebGLLost?.()
          })
          onReady?.()
        }}
      >
        <CinematicRig
          mode={mode}
          enterSignal={enterSignal}
          exitSignal={exitSignal}
          onAnimatingChange={onAnimatingChange}
          onTransitionStart={onTransitionStart}
          onEnterApp={onEnterApp}
          onExitComplete={onExitComplete}
          onRequestEnter={onRequestEnter}
        />
      </Canvas>
    </div>
  )
}
