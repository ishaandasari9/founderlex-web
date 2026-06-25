export type DoorRenderMode = '3d' | '3d-lite' | '2d'

function canUseWebGL(): boolean {
  if (typeof window === 'undefined') return false
  try {
    const canvas = document.createElement('canvas')
    const ctx =
      canvas.getContext('webgl2') ??
      canvas.getContext('webgl') ??
      canvas.getContext('experimental-webgl')
    return !!ctx
  } catch {
    return false
  }
}

function prefersReducedMotion(): boolean {
  if (typeof window === 'undefined') return false
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches
}

function isMobileViewport(): boolean {
  if (typeof window === 'undefined') return false
  return window.matchMedia('(max-width: 768px)').matches
}

function isCoarsePointer(): boolean {
  if (typeof window === 'undefined') return false
  return window.matchMedia('(pointer: coarse)').matches
}

function deviceMemoryGb(): number | null {
  const nav = navigator as Navigator & { deviceMemory?: number }
  return typeof nav.deviceMemory === 'number' ? nav.deviceMemory : null
}

function isVeryLowPower(): boolean {
  const cores = typeof navigator.hardwareConcurrency === 'number'
    ? navigator.hardwareConcurrency
    : 4
  const memory = deviceMemoryGb()
  const tinyScreen = typeof window !== 'undefined' && window.innerWidth < 360

  if (cores <= 2 && memory !== null && memory <= 2) return true
  if (tinyScreen && cores <= 2) return true
  return false
}

function isLowPowerDevice(): boolean {
  // Lite 3D on phones/tablets only — keep full 3D on laptops/desktops
  if (isMobileViewport() || isCoarsePointer()) return true

  const memory = deviceMemoryGb()
  if (memory !== null && memory <= 2) return true
  return false
}

/** Client-only: pick 3D full, 3D lite, or 2D fallback. */
export function getDoorRenderMode(): DoorRenderMode {
  if (prefersReducedMotion()) return '2d'
  if (!canUseWebGL()) return '2d'
  if (isVeryLowPower()) return '2d'
  if (isLowPowerDevice()) return '3d-lite'
  return '3d'
}

export function subscribeReducedMotion(onChange: (reduced: boolean) => void): () => void {
  if (typeof window === 'undefined') return () => {}
  const mq = window.matchMedia('(prefers-reduced-motion: reduce)')
  const handler = () => onChange(mq.matches)
  mq.addEventListener('change', handler)
  return () => mq.removeEventListener('change', handler)
}
