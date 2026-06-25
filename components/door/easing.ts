/** Smooth cinematic ease — matches the 2D door cubic-bezier(.62,0,.30,1) */
export function easeInOutCubic(t: number): number {
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2
}

export function easeOutCubic(t: number): number {
  return 1 - Math.pow(1 - t, 3)
}

export function clamp01(t: number): number {
  return Math.min(1, Math.max(0, t))
}

export function remap(t: number, start: number, end: number): number {
  if (t <= start) return 0
  if (t >= end) return 1
  return (t - start) / (end - start)
}
