'use client'

import React, { useEffect, useState } from 'react'
import { Check, Circle, CircleDot, Radar, ShieldCheck } from 'lucide-react'
import ApiDisclaimerBanner from '@/components/ApiDisclaimerBanner'

const RED     = '#DB1A1A'
const INK     = '#2A2420'
const MUTED   = '#6F655B'
const FAINT   = '#9B8F82'
const TILE    = '#F2EAE0'
const SUCCESS = '#3F9D6A'

type PanelPhase = 'entering' | 'visible' | 'exiting'
type StepStatus = 'done' | 'current' | 'upcoming' | 'ongoing'

interface RoadmapStep {
  id: string
  title: string
  whatItIs: string
  nextAction: string
  status: StepStatus
}

interface Roadmap {
  headline: string
  steps: RoadmapStep[]
  disclaimer: string
}

function StepIcon({ status }: { status: StepStatus }) {
  if (status === 'done') {
    return (
      <span style={{
        width: 28, height: 28, borderRadius: '50%', flexShrink: 0,
        background: 'rgba(63,157,106,0.14)', border: `1.5px solid ${SUCCESS}`,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        <Check size={14} color={SUCCESS} strokeWidth={2.5} aria-hidden />
      </span>
    )
  }
  if (status === 'current') {
    return (
      <span style={{
        width: 28, height: 28, borderRadius: '50%', flexShrink: 0,
        background: 'rgba(219,26,26,0.10)', border: `2px solid ${RED}`,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        boxShadow: '0 0 0 4px rgba(219,26,26,0.08)',
      }}>
        <CircleDot size={14} color={RED} strokeWidth={2.5} aria-hidden />
      </span>
    )
  }
  if (status === 'ongoing') {
    return (
      <span style={{
        width: 28, height: 28, borderRadius: '50%', flexShrink: 0,
        background: TILE, border: '1.5px dashed rgba(42,36,32,0.28)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        <Radar size={13} color={MUTED} strokeWidth={2} aria-hidden />
      </span>
    )
  }
  return (
    <span style={{
      width: 28, height: 28, borderRadius: '50%', flexShrink: 0,
      background: '#FFFFFF', border: '1.5px solid rgba(42,36,32,0.16)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
    }}>
      <Circle size={10} color={FAINT} strokeWidth={2} fill={FAINT} aria-hidden />
    </span>
  )
}

function TimelineStep({ step, isLast }: { step: RoadmapStep; isLast: boolean }) {
  const isCurrent = step.status === 'current'
  const isDone = step.status === 'done'
  const isUpcoming = step.status === 'upcoming'
  const isOngoing = step.status === 'ongoing'

  return (
    <div style={{ display: 'flex', gap: 14, alignItems: 'stretch' }}>
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: 28, flexShrink: 0 }}>
        <StepIcon status={step.status} />
        {!isLast && (
          <span style={{
            flex: 1,
            width: 2,
            minHeight: 16,
            marginTop: 4,
            background: isDone ? 'rgba(63,157,106,0.35)' : 'rgba(42,36,32,0.12)',
            borderRadius: 1,
          }} />
        )}
      </div>

      <article style={{
        flex: 1,
        marginBottom: isLast ? 0 : 14,
        padding: '12px 14px',
        borderRadius: 12,
        border: isCurrent
          ? `1.5px solid rgba(219,26,26,0.40)`
          : isOngoing
            ? '1.5px dashed rgba(42,36,32,0.22)'
            : '1px solid rgba(42,36,32,0.12)',
        background: isCurrent
          ? 'rgba(219,26,26,0.05)'
          : isUpcoming
            ? 'rgba(247,242,235,0.65)'
            : '#FFFFFF',
        opacity: isUpcoming ? 0.72 : 1,
      }}>
        <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '6px 10px', marginBottom: 6 }}>
          <h3 style={{
            margin: 0,
            fontFamily: 'var(--font-bricolage), sans-serif',
            fontWeight: isCurrent ? 700 : 600,
            fontSize: 14.5,
            lineHeight: 1.25,
            color: isDone ? MUTED : INK,
            textDecoration: isDone ? 'line-through' : 'none',
          }}>
            {step.title}
          </h3>
          {isOngoing && (
            <span style={{
              fontFamily: 'var(--font-mono), monospace',
              fontSize: 9.5,
              letterSpacing: '0.08em',
              textTransform: 'uppercase',
              color: MUTED,
              background: TILE,
              borderRadius: 999,
              padding: '3px 8px',
            }}>
              Keep on your radar
            </span>
          )}
          {isCurrent && (
            <span style={{
              fontFamily: 'var(--font-mono), monospace',
              fontSize: 9.5,
              letterSpacing: '0.08em',
              textTransform: 'uppercase',
              color: RED,
              background: 'rgba(219,26,26,0.08)',
              borderRadius: 999,
              padding: '3px 8px',
            }}>
              Up next
            </span>
          )}
        </div>
        <p style={{ margin: '0 0 8px', fontFamily: 'var(--font-newsreader), Georgia, serif', fontSize: 13.5, lineHeight: 1.55, color: isUpcoming ? MUTED : INK }}>
          {step.whatItIs}
        </p>
        <p style={{ margin: 0, fontFamily: 'var(--font-newsreader), Georgia, serif', fontSize: 13, lineHeight: 1.5, color: MUTED }}>
          <strong style={{ fontWeight: 600, color: isUpcoming ? FAINT : INK }}>Next:</strong> {step.nextAction}
        </p>
      </article>
    </div>
  )
}

export default function RoadmapPanel({ onClose }: { onClose: () => void }) {
  const [phase, setPhase] = useState<PanelPhase>('entering')
  const [roadmap, setRoadmap] = useState<Roadmap | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const id = requestAnimationFrame(() => setPhase('visible'))
    return () => cancelAnimationFrame(id)
  }, [])

  const loadRoadmap = async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/roadmap')
      const data = await res.json()
      if (!res.ok || data.error) {
        setError(data.error ?? 'Something went wrong. Please try again.')
        setRoadmap(null)
        return
      }
      setRoadmap(data.roadmap ?? null)
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : String(e))
      setRoadmap(null)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadRoadmap()
  }, [])

  const handleClose = () => {
    if (loading) return
    setPhase('exiting')
    window.setTimeout(onClose, 200)
  }

  const trackableSteps = roadmap?.steps.filter(s => s.status !== 'ongoing') ?? []
  const ongoingSteps = roadmap?.steps.filter(s => s.status === 'ongoing') ?? []

  return (
    <div className={`confirm-panel-backdrop confirm-panel-backdrop--${phase}`} onClick={handleClose}>
      <div
        className={`confirm-panel-modal confirm-panel-modal--${phase}`}
        role="dialog"
        aria-modal="true"
        aria-labelledby="roadmap-panel-title"
        onClick={e => e.stopPropagation()}
      >
        <header className="confirm-panel-header">
          <span className="confirm-panel-eyebrow">Progress tracker</span>
          <h2 id="roadmap-panel-title" className="confirm-panel-title">Your founding roadmap</h2>
          <p className="confirm-panel-subtitle">
            A general guide based on what you&apos;ve told the tool so far — not a complete checklist and not legal advice.
          </p>
        </header>

        <div className="confirm-panel-scroll">
          {loading && (
            <p style={{ margin: 0, fontFamily: 'var(--font-newsreader), Georgia, serif', fontSize: 14.5, color: MUTED }}>
              Building your roadmap…
            </p>
          )}

          {error && (
            <div className="confirm-panel-notice" role="status">
              <span className="confirm-panel-notice-title">Could not load roadmap</span>
              <span className="confirm-panel-notice-text">{error}</span>
            </div>
          )}

          {roadmap && (
            <>
              <p style={{
                margin: '0 0 16px',
                fontFamily: 'var(--font-bricolage), sans-serif',
                fontWeight: 600,
                fontSize: 17,
                lineHeight: 1.35,
                color: INK,
              }}>
                {roadmap.headline}
              </p>

              <ApiDisclaimerBanner text={roadmap.disclaimer} />

              {trackableSteps.length > 0 && (
                <div style={{ marginBottom: ongoingSteps.length > 0 ? 20 : 0 }}>
                  {trackableSteps.map((step, i) => (
                    <TimelineStep
                      key={step.id}
                      step={step}
                      isLast={i === trackableSteps.length - 1 && ongoingSteps.length === 0}
                    />
                  ))}
                </div>
              )}

              {ongoingSteps.length > 0 && (
                <div>
                  <span style={{
                    display: 'block',
                    marginBottom: 12,
                    fontFamily: 'var(--font-mono), monospace',
                    fontSize: 10,
                    letterSpacing: '0.10em',
                    textTransform: 'uppercase',
                    color: FAINT,
                  }}>
                    Ongoing — keep on your radar
                  </span>
                  {ongoingSteps.map((step, i) => (
                    <TimelineStep
                      key={step.id}
                      step={step}
                      isLast={i === ongoingSteps.length - 1}
                    />
                  ))}
                </div>
              )}
            </>
          )}
        </div>

        <div className="confirm-panel-disclaimer">
          <ShieldCheck size={14} color={MUTED} strokeWidth={1.6} aria-hidden />
          <span>
            {roadmap?.disclaimer ?? 'This roadmap is a general, educational guide — not legal advice. Confirm what applies to you with a licensed attorney or CPA.'}
          </span>
        </div>

        <div className="confirm-panel-actions">
          <button type="button" className="confirm-panel-btn confirm-panel-btn--secondary" onClick={handleClose} disabled={loading}>
            Close
          </button>
          <button
            type="button"
            className="confirm-panel-btn confirm-panel-btn--primary"
            onClick={loadRoadmap}
            disabled={loading}
          >
            {loading ? 'Refreshing…' : 'Refresh'}
          </button>
        </div>
      </div>
    </div>
  )
}
