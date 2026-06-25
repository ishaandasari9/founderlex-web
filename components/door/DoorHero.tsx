'use client'

import React, { useEffect, useRef, useState, Suspense } from 'react'
import dynamic from 'next/dynamic'
import {
  getDoorRenderMode,
  subscribeReducedMotion,
  type DoorRenderMode,
} from '../../lib/door-capabilities'
import DoorInside2D from './DoorInside2D'
import DoorHeroLoader from './DoorHeroLoader'

const BorderGlow = dynamic(() => import('../BorderGlow'), { ssr: false }) as React.ComponentType<{
  loop?: boolean
  loopSpeed?: number
  backgroundColor?: string
  borderRadius?: number
  glowRadius?: number
  coneSpread?: number
  glowIntensity?: number
  glowColor?: string
  colors?: string[]
  fillOpacity?: number
  innerStyle?: React.CSSProperties
  children?: React.ReactNode
}>

const DoorScene3D = dynamic(() => import('./DoorScene3D'), {
  ssr: false,
  loading: () => <DoorHeroLoader />,
})

const SWING_MS = 800

export interface DoorHeroProps {
  enterSignal: number
  exitSignal: number
  onEnterApp: () => void
  onExitComplete: () => void
  onRequestEnter: () => void
  onTransitionActive?: (active: boolean) => void
}

function Door2DWithGlow({
  onEnterApp,
  onExitComplete,
  onRequestEnter,
  onTransitionActive,
  enterSignal,
  exitSignal,
}: DoorHeroProps) {
  const [swingOpen, setSwingOpen] = useState(false)
  const lastEnter = useRef(0)
  const lastExit = useRef(0)

  useEffect(() => {
    if (enterSignal > lastEnter.current) {
      lastEnter.current = enterSignal
      setSwingOpen(true)
      onTransitionActive?.(true)
      const timer = window.setTimeout(() => {
        onTransitionActive?.(false)
        onEnterApp()
      }, SWING_MS)
      return () => window.clearTimeout(timer)
    }
  }, [enterSignal, onEnterApp, onTransitionActive])

  useEffect(() => {
    if (exitSignal > lastExit.current) {
      lastExit.current = exitSignal
      setSwingOpen(false)
      onTransitionActive?.(true)
      const timer = window.setTimeout(() => {
        onTransitionActive?.(false)
        onExitComplete()
      }, SWING_MS)
      return () => window.clearTimeout(timer)
    }
  }, [exitSignal, onExitComplete, onTransitionActive])

  // After exit completes we're back on the door page — ensure door starts closed
  useEffect(() => {
    if (enterSignal === 0 && exitSignal === 0) {
      setSwingOpen(false)
    }
  }, [enterSignal, exitSignal])

  const door = <DoorInside2D swingOpen={swingOpen} onClick={onRequestEnter} />

  return (
    <Suspense
      fallback={
        <div style={{ width: 'min(440px, 86vw)', height: 'clamp(300px, 46vh, 440px)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          {door}
        </div>
      }
    >
      <BorderGlow
        loop
        loopSpeed={0.3}
        backgroundColor="transparent"
        borderRadius={200}
        glowRadius={50}
        coneSpread={30}
        glowIntensity={1.8}
        glowColor="35 85 73"
        colors={['#F0DCBC', '#FBEFD7', '#E7CFA9']}
        fillOpacity={0}
        innerStyle={{ overflow: 'visible', background: 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
      >
        {door}
      </BorderGlow>
    </Suspense>
  )
}

export default function DoorHero({
  enterSignal,
  exitSignal,
  onEnterApp,
  onExitComplete,
  onRequestEnter,
  onTransitionActive,
}: DoorHeroProps) {
  const [mode, setMode] = useState<DoorRenderMode | null>(null)
  const [force2D, setForce2D] = useState(false)
  const [immersive, setImmersive] = useState(false)

  useEffect(() => {
    setMode(getDoorRenderMode())
    return subscribeReducedMotion(reduced => {
      if (reduced) setForce2D(true)
    })
  }, [])

  if (mode === null) {
    return <DoorHeroLoader />
  }

  if (force2D || mode === '2d') {
    return (
      <Door2DWithGlow
        enterSignal={enterSignal}
        exitSignal={exitSignal}
        onEnterApp={onEnterApp}
        onExitComplete={onExitComplete}
        onRequestEnter={onRequestEnter}
        onTransitionActive={onTransitionActive}
      />
    )
  }

  return (
    <Suspense fallback={<DoorHeroLoader />}>
      <BorderGlow
        loop
        loopSpeed={0.3}
        backgroundColor="transparent"
        borderRadius={200}
        glowRadius={50}
        coneSpread={30}
        glowIntensity={1.8}
        glowColor="35 85 73"
        colors={['#F0DCBC', '#FBEFD7', '#E7CFA9']}
        fillOpacity={0}
        innerStyle={{
          overflow: 'visible',
          background: 'transparent',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <DoorScene3D
          mode={mode}
          enterSignal={enterSignal}
          exitSignal={exitSignal}
          immersive={immersive}
          onTransitionStart={() => {
            setImmersive(true)
            onTransitionActive?.(true)
          }}
          onEnterApp={() => {
            setImmersive(false)
            onTransitionActive?.(false)
            onEnterApp()
          }}
          onExitComplete={() => {
            setImmersive(false)
            onTransitionActive?.(false)
            onExitComplete()
          }}
          onWebGLLost={() => setForce2D(true)}
          onRequestEnter={onRequestEnter}
        />
      </BorderGlow>
    </Suspense>
  )
}
