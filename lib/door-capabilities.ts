export type DoorRenderMode = '3d' | '3d-lite' | '2d'

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

/** Client-only: pick 3D full or 3D lite. Always attempts WebGL — 2D is only used at runtime if the context is lost. */
export function getDoorRenderMode(): DoorRenderMode {
  if (isVeryLowPower()) return '3d-lite'
  return '3d'
}

export function subscribeReducedMotion(onChange: (reduced: boolean) => void): () => void {
  if (typeof window === 'undefined') return () => {}
  const mq = window.matchMedia('(prefers-reduced-motion: reduce)')
  const handler = () => onChange(mq.matches)
  mq.addEventListener('change', handler)
  return () => mq.removeEventListener('change', handler)
}
