'use client'

import React, { useState, useRef, useEffect, useCallback, Suspense } from 'react'
import dynamic from 'next/dynamic'
import {
  ArrowRight, ArrowLeft, ArrowUp,
  MessageSquareText, BookOpen, FileText, ShieldCheck, Download, ShieldAlert, Lock,
} from 'lucide-react'
import { validateProfile, emptyProfile, type FounderProfile } from '@/lib/founderProfile'
import type { ConfirmField } from '@/lib/confirmationFields'
import { buildLawyerReviewEmail, type GeneratedDoc } from '@/lib/lawyerReviewEmail'
import ConfirmDocPanel, { type ConfirmPanelState } from '@/components/ConfirmDocPanel'
import ConfirmPackPanel, { type ConfirmPackPanelState } from '@/components/ConfirmPackPanel'
import ConsentGate from '@/components/ConsentGate'
import LawyerReviewEmailPanel from '@/components/LawyerReviewEmailPanel'
import NameSearchPanel from '@/components/NameSearchPanel'
import ReadAloudButton from '@/components/ReadAloudButton'
import MicButton from '@/components/MicButton'
import ExplainFormPanel from '@/components/ExplainFormPanel'
import DeadlinesPanel from '@/components/DeadlinesPanel'
import CostEstimatePanel from '@/components/CostEstimatePanel'
import ComparePanel from '@/components/ComparePanel'
import RoadmapPanel from '@/components/RoadmapPanel'
import RedFlagCard from '@/components/RedFlagCard'
import { detectRedFlags, checkAssistantOverstep, type RedFlag } from '@/lib/redFlags'
import BeforeYouSignChecklist from '@/components/BeforeYouSignChecklist'
import CitationChip, { type CitationLink } from '@/components/CitationChip'
import { TEMPLATE_LABELS, detectTemplates, resolveRecommendedTemplates } from '@/lib/templateMeta'

// ── React Bits — SSR disabled (motion/react needs window) ────────────────────
// Cast to any to bypass TypeScript inference quirks from .jsx component files
const BorderGlow = dynamic(() => import('../components/BorderGlow'), { ssr: false }) as React.ComponentType<any>
const TiltedCard  = dynamic(() => import('../components/TiltedCard'),  { ssr: false }) as React.ComponentType<any>
const Counter     = dynamic(() => import('../components/Counter'),      { ssr: false }) as React.ComponentType<any>
const GlassCard   = dynamic(() => import('../components/about/GlassCard'), { ssr: false }) as React.ComponentType<{
  children: React.ReactNode
  className?: string
  style?: React.CSSProperties
  onClick?: () => void
}>
const DocumentMarquee = dynamic(() => import('../components/about/DocumentMarquee'), { ssr: false }) as React.ComponentType<{
  items: { key: string; label: string; category: string; color: string }[]
}>
const DoorHero    = dynamic(() => import('../components/door/DoorHero'), {
  ssr: false,
  loading: () => (
    <div
      style={{
        width: 'min(440px, 86vw)',
        height: 'clamp(300px, 46vh, 440px)',
        borderRadius: 24,
        background: '#F7F2EB',
      }}
      aria-hidden
    />
  ),
}) as React.ComponentType<{
  enterSignal: number
  exitSignal: number
  onEnterApp: () => void
  onExitComplete: () => void
  onRequestEnter: () => void
  onTransitionActive?: (active: boolean) => void
}>

// ── Types ────────────────────────────────────────────────────────────────────
type Act = 'door' | 'about' | 'chat'
interface Msg {
  role: 'user' | 'bot' | 'doc-card' | 'checklist-card' | 'redflag-card'
  text: string
  template?: string
  filled?: string
  flags?: RedFlag[]
  isLoading?: boolean
  citations?: CitationLink[]
}

// ── Brand tokens ─────────────────────────────────────────────────────────────
const RED     = '#DB1A1A'
const CREAM   = '#F7F2EB'
const INK     = '#2A2420'
const TILE    = '#F2EAE0'
const MUTED   = '#6F655B'
const FAINT   = '#9B8F82'
const FAINTER = '#B9AC9C'
const WHITE   = '#FFFFFF'

const BRICOLAGE  = 'var(--font-bricolage), sans-serif'
const NEWSREADER = 'var(--font-newsreader), Georgia, serif'
const MONO       = 'var(--font-mono), monospace'

// Template metadata (labels, keyword detection) now lives in
// lib/templateMeta.ts — B2 needs it server-side too, to resolve
// FounderProfile.recommended_documents (free text) down to template_name
// keys, using the exact same keyword list this file already used for
// doc-card detection, not a second copy.

// ── Download helper ───────────────────────────────────────────────────────────
function downloadBase64(b64: string, name: string, mime: string) {
  const bytes = atob(b64)
  const arr = new Uint8Array(bytes.length)
  for (let i = 0; i < bytes.length; i++) arr[i] = bytes.charCodeAt(i)
  const url = URL.createObjectURL(new Blob([arr], { type: mime }))
  const a = document.createElement('a')
  a.href = url; a.download = name; a.click()
  URL.revokeObjectURL(url)
}

async function generateAndDownload(
  templateName: string,
  profile: FounderProfile | null
): Promise<{ ok: boolean; error?: string; filled?: string }> {
  try {
    const res = await fetch('/api/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ template_name: templateName, profile }),
    })
    const data = await res.json()
    if (data.error) return { ok: false, error: data.error }

    if (data.pdf_b64)  downloadBase64(data.pdf_b64,  data.pdf_name  || 'document.pdf',  'application/pdf')
    if (data.docx_b64) downloadBase64(data.docx_b64, data.docx_name || 'document.docx', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document')
    return { ok: true, filled: data.filled }
  } catch (e: unknown) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) }
  }
}

// B2 Founder Pack: same fetch-and-download shape as generateAndDownload
// above, but hits /api/founder-pack and downloads one zip instead of a
// docx/pdf pair. Returns the cover memo + doc list on success so the caller
// can surface them in the chat.
async function generateFounderPackAndDownload(
  profile: FounderProfile | null
): Promise<{ ok: boolean; error?: string; coverMemo?: string; docs?: { template_name: string; label: string; filled: string }[] }> {
  try {
    const res = await fetch('/api/founder-pack', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ profile }),
    })
    const data = await res.json()
    if (data.error) return { ok: false, error: data.error }

    if (data.zip_b64) downloadBase64(data.zip_b64, data.zip_name || 'founder-pack.zip', 'application/zip')
    return { ok: true, coverMemo: data.cover_memo, docs: data.docs }
  } catch (e: unknown) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) }
  }
}

// ── Door glyph ───────────────────────────────────────────────────────────────
function DoorGlyph({ w = 21, h = 24, panelTop = 8, outerR = 11, innerR = 5 }:
  { w?: number; h?: number; panelTop?: number; outerR?: number; innerR?: number }) {
  return (
    <span style={{ position: 'relative', display: 'inline-block', width: w, height: h, flexShrink: 0 }}>
      <span style={{ position: 'absolute', inset: 0, borderRadius: `${outerR}px ${outerR}px 3px 3px`, background: INK }} />
      <span style={{ position: 'absolute', left: Math.round(w * 0.24), right: Math.round(w * 0.24), bottom: 0, top: panelTop, borderRadius: `${innerR}px ${innerR}px 1px 1px`, background: RED }} />
    </span>
  )
}

// ── Arch pip ─────────────────────────────────────────────────────────────────
function ArchPip() {
  return <span style={{ display: 'inline-block', flexShrink: 0, width: 14, height: 8, borderRadius: '8px 8px 0 0', background: RED }} />
}

// ── Wordmark ─────────────────────────────────────────────────────────────────
function Wordmark({ size = 25 }: { size?: number }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 11 }}>
      <DoorGlyph />
      <span style={{ fontFamily: BRICOLAGE, fontWeight: 700, fontSize: size, letterSpacing: '-0.01em', color: INK }}>
        Founder<span style={{ color: RED }}>Lex</span>
      </span>
    </div>
  )
}

// ── CTA button ───────────────────────────────────────────────────────────────
function CtaButton({ children, onClick, lg = false }: { children: React.ReactNode; onClick: () => void; lg?: boolean }) {
  const [hov, setHov] = useState(false)
  const [act, setAct] = useState(false)
  return (
    <button onClick={onClick}
      onMouseEnter={() => setHov(true)} onMouseLeave={() => { setHov(false); setAct(false) }}
      onMouseDown={() => setAct(true)} onMouseUp={() => setAct(false)}
      className={lg ? 'cta-button--lg' : undefined}
      style={{
        display: 'inline-flex', alignItems: 'center', gap: 9,
        fontFamily: BRICOLAGE, fontWeight: 600, fontSize: lg ? 18 : 17, color: CREAM,
        background: act ? '#B11414' : hov ? '#C21717' : RED,
        padding: lg ? '16px 30px' : '15px 26px', borderRadius: 13, border: 'none',
        boxShadow: '0 18px 32px -14px rgba(219,26,26,0.65)',
        transform: act ? 'translateY(1px)' : hov ? 'translateY(-1px)' : 'none',
        transition: 'background .18s ease, transform .18s ease', cursor: 'pointer',
      }}>
      {children}
    </button>
  )
}

// ── Suggestion chip ───────────────────────────────────────────────────────────
function Chip({ label, onSelect }: { label: string; onSelect: (t: string) => void }) {
  const [hov, setHov] = useState(false)
  return (
    <button onClick={() => onSelect(label)} onMouseEnter={() => setHov(true)} onMouseLeave={() => setHov(false)}
      style={{
        fontFamily: BRICOLAGE, fontWeight: 500, fontSize: 13.5, color: INK,
        background: hov ? TILE : WHITE, border: `1px solid ${hov ? 'rgba(42,36,32,0.30)' : 'rgba(42,36,32,0.16)'}`,
        borderRadius: 999, padding: '8px 14px', cursor: 'pointer',
        transition: 'background .15s ease, border-color .15s ease',
      }}>
      {label}
    </button>
  )
}

// ── Back link ─────────────────────────────────────────────────────────────────
function BackLink({ label, onClick }: { label: string; onClick: () => void }) {
  const [hov, setHov] = useState(false)
  return (
    <button onClick={onClick} onMouseEnter={() => setHov(true)} onMouseLeave={() => setHov(false)}
      className="about-back-link"
      style={{
        position: 'absolute', top: 20, left: 22,
        display: 'inline-flex', alignItems: 'center', gap: 7,
        fontFamily: MONO, fontSize: 12, letterSpacing: '0.04em', color: hov ? RED : FAINT,
        background: 'none', border: 'none', cursor: 'pointer', transition: 'color .15s ease',
      }}>
      <ArrowLeft size={14} strokeWidth={1.8} /> {label}
    </button>
  )
}

// ── Send button ───────────────────────────────────────────────────────────────
function SendButton({ onClick, disabled }: { onClick: () => void; disabled?: boolean }) {
  const [hov, setHov] = useState(false)
  const [act, setAct] = useState(false)
  return (
    <button onClick={onClick} aria-label="Send" disabled={disabled}
      onMouseEnter={() => setHov(true)} onMouseLeave={() => { setHov(false); setAct(false) }}
      onMouseDown={() => setAct(true)} onMouseUp={() => setAct(false)}
      style={{
        flexShrink: 0, width: 40, height: 40, borderRadius: 11, border: 'none',
        background: disabled ? FAINT : act ? '#B11414' : hov ? '#C21717' : RED,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        cursor: disabled ? 'not-allowed' : 'pointer',
        boxShadow: disabled ? 'none' : '0 8px 16px -8px rgba(219,26,26,0.70)',
        transform: act ? 'translateY(1px)' : hov ? 'translateY(-1px)' : 'none',
        transition: 'background .15s ease, transform .15s ease',
      }}>
      <ArrowUp size={18} color={CREAM} strokeWidth={2} aria-hidden />
    </button>
  )
}

// ── Back link (chat header, inline) ──────────────────────────────────────────
function BackChatLink({ onClick }: { onClick: () => void }) {
  const [hov, setHov] = useState(false)
  return (
    <button onClick={onClick} onMouseEnter={() => setHov(true)} onMouseLeave={() => setHov(false)}
      style={{
        display: 'inline-flex', alignItems: 'center', gap: 5,
        fontFamily: MONO, fontSize: 11, letterSpacing: '0.04em', color: hov ? RED : FAINT,
        background: 'none', border: 'none', cursor: 'pointer', transition: 'color .15s ease',
      }}>
      <ArrowLeft size={13} strokeWidth={1.8} /> Back
    </button>
  )
}

// ── Document card (TiltedCard wrapper) ───────────────────────────────────────
function DocCard({
  template, onGenerate, generating,
}: { template: string; onGenerate: () => void; generating: boolean }) {
  const label = TEMPLATE_LABELS[template] ?? template

  const overlay = (
    <div style={{
      width: '100%', height: '100%', borderRadius: 14,
      background: WHITE, border: `1px solid rgba(42,36,32,0.12)`,
      boxShadow: '0 8px 32px -12px rgba(42,36,32,0.3)',
      padding: '18px 20px',
      display: 'flex', flexDirection: 'column', justifyContent: 'space-between',
    }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        <span style={{ width: 36, height: 36, borderRadius: 10, background: TILE, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <FileText size={18} color={RED} strokeWidth={1.6} />
        </span>
        <span style={{ fontFamily: BRICOLAGE, fontWeight: 600, fontSize: 15, color: INK, lineHeight: 1.25 }}>{label}</span>
        <span style={{ fontFamily: MONO, fontSize: 10, letterSpacing: '0.12em', textTransform: 'uppercase', color: FAINT }}>PDF + Word</span>
      </div>
      <button onClick={generating ? undefined : onGenerate} disabled={generating}
        style={{
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7,
          background: generating ? TILE : RED, color: generating ? MUTED : CREAM,
          border: 'none', borderRadius: 9, padding: '9px 14px',
          fontFamily: BRICOLAGE, fontWeight: 600, fontSize: 13, cursor: generating ? 'wait' : 'pointer',
          transition: 'background .15s ease',
        }}>
        {generating ? (
          <>
            <span className="loading-dot" /><span className="loading-dot" /><span className="loading-dot" />
          </>
        ) : (
          <><Download size={13} strokeWidth={2} /> Generate &amp; Download</>
        )}
      </button>
    </div>
  )

  return (
    <div className="doc-card-wrap" style={{ flexShrink: 0 }}>
      <Suspense fallback={
        <div style={{ width: 220, height: 160, borderRadius: 14, background: WHITE, border: `1px solid rgba(42,36,32,0.10)`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <span style={{ fontFamily: MONO, fontSize: 11, color: FAINT }}>Loading…</span>
        </div>
      }>
        <TiltedCard
          imageSrc="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='220' height='160'%3E%3Crect width='220' height='160' fill='%23ffffff' rx='14'/%3E%3C/svg%3E"
          containerHeight="160px"
          imageHeight="160px"
          imageWidth="220px"
          rotateAmplitude={6}
          scaleOnHover={1.04}
          displayOverlayContent
          overlayContent={overlay}
        />
      </Suspense>
    </div>
  )
}

// ── Confirmation gate (Human-in-the-loop Gate 2) ─────────────────────────────

// Structural subset both ConfirmPanelState (single-document) and
// ConfirmPackPanelState (B2 Founder Pack) satisfy, so this one function
// builds the effective profile for either confirm gate — no second copy.
interface ProfileEditableFields {
  companyName: string
  state: string
  structure: string
  description: string
  founders: { name: string; equity_pct: number }[]
}

function buildEffectiveProfile(base: FounderProfile | null, panel: ProfileEditableFields): FounderProfile {
  const b = base ?? emptyProfile()
  return {
    ...b,
    company_name: panel.companyName || null,
    state: panel.state || null,
    structure: panel.structure || null,
    product_description: panel.description,
    founders: b.founders.map((f, i) => ({
      ...f,
      name: panel.founders[i]?.name ?? f.name,
      equity_pct: panel.founders[i]?.equity_pct ?? f.equity_pct,
    })),
  }
}

// ── Loading bubble ────────────────────────────────────────────────────────────
function LoadingBubble() {
  return (
    <div style={{ display: 'flex', gap: 11, alignItems: 'flex-start', maxWidth: '90%' }}>
      <DoorGlyph w={28} h={31} panelTop={10} outerR={14} innerR={6} />
      <div style={{
        background: TILE, color: INK,
        padding: '18px 22px',
        borderRadius: '4px 16px 16px 16px',
        display: 'flex', alignItems: 'center', gap: 6,
      }}>
        <span className="loading-dot" />
        <span className="loading-dot" />
        <span className="loading-dot" />
      </div>
    </div>
  )
}


// ── Main page ─────────────────────────────────────────────────────────────────
export default function Home() {
  const [act, setAct]               = useState<Act>('door')
  const [draft, setDraft]           = useState('')
  const [messages, setMessages]     = useState<Msg[]>([])
  const [isLoading, setIsLoading]   = useState(false)
  const [profile, setProfile]       = useState<FounderProfile | null>(null)
  const profileRef                  = useRef<FounderProfile | null>(null)
  const [docCount, setDocCount]     = useState(0)
  const [generatedDocs, setGeneratedDocs] = useState<GeneratedDoc[]>([])
  const [generatingTpl, setGeneratingTpl] = useState<string | null>(null)
  const [confirmPanel, setConfirmPanel]   = useState<ConfirmPanelState | null>(null)
  const [confirmGenerating, setConfirmGenerating] = useState(false)
  const [packConfirm, setPackConfirm]     = useState<ConfirmPackPanelState | null>(null)
  const [packGenerating, setPackGenerating] = useState(false)
  const [packLoadingFields, setPackLoadingFields] = useState(false)
  const [lawyerEmail, setLawyerEmail]     = useState<string | null>(null)
  const [showNameSearch, setShowNameSearch] = useState(false)
  const [showExplainForm, setShowExplainForm] = useState(false)
  const [showDeadlines, setShowDeadlines] = useState(false)
  const [showCostEstimate, setShowCostEstimate] = useState(false)
  const [showCompare, setShowCompare] = useState(false)
  const [showRoadmap, setShowRoadmap] = useState(false)
  const [showTools, setShowTools] = useState(false)
  const [enterSignal, setEnterSignal]     = useState(0)
  const [exitSignal, setExitSignal]       = useState(0)
  const [doorBusy, setDoorBusy]           = useState(false)
  const [isExitingAbout, setIsExitingAbout] = useState(false)
  const [showConsent, setShowConsent]     = useState(false)
  const [consentGiven, setConsentGiven]   = useState(false)

  const HANDOFF_MS = 480

  const scrollRef    = useRef<HTMLDivElement>(null)
  const messagesRef  = useRef<Msg[]>([])

  // Keep refs in sync with state
  useEffect(() => { messagesRef.current = messages }, [messages])
  useEffect(() => { profileRef.current = profile }, [profile])

  // Auto-scroll on new messages
  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight
  }, [messages])

  // Restore a saved session on first load
  useEffect(() => {
    fetch('/api/session')
      .then(res => res.json())
      .then((data: { messages?: Msg[]; profile?: FounderProfile | null }) => {
        if (data.messages && data.messages.length > 0) setMessages(data.messages)
        if (data.profile) setProfile(data.profile)
      })
      .catch(() => {})
  }, [])

  const persistSession = useCallback((msgs: Msg[], prof: FounderProfile | null) => {
    fetch('/api/session', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ messages: msgs, profile: prof }),
    }).catch(() => {})
  }, [])

  const handleClearSession = useCallback(async () => {
    try {
      await fetch('/api/session', { method: 'DELETE' })
    } catch {}
    setMessages([])
    setProfile(null)
    setConfirmPanel(null)
  }, [])


  // ── Send message ────────────────────────────────────────────────────────────
  const sendMessage = useCallback(async (text: string) => {
    const t = text.trim()
    if (!t || isLoading) return

    const currentMsgs = messagesRef.current
    const apiPayload = [
      ...currentMsgs
        .filter(m => (m.role === 'user' || m.role === 'bot') && !m.isLoading)
        .map(m => ({ role: m.role === 'bot' ? 'assistant' as const : 'user' as const, content: m.text })),
      { role: 'user' as const, content: t },
    ]

    setMessages(prev => [...prev, { role: 'user', text: t }, { role: 'bot', text: '', isLoading: true }])
    setIsLoading(true)
    setDraft('')

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: apiPayload, profile: profileRef.current }),
      })
      const data = await res.json()
      const reply: string = data.content || "I'm sorry, I couldn't process that. Could you rephrase?"
      const updatedProfile: FounderProfile | null = data.profile ?? profileRef.current
      if (data.profile) setProfile(data.profile)
      // A3 inline citations — /api/chat only ever includes these for a
      // genuine grounded answer (never a guard refusal or safety fallback),
      // so no extra check is needed here beyond trusting an empty/missing
      // array means no citation, not an error.
      const citations: CitationLink[] | undefined = Array.isArray(data.citations) && data.citations.length > 0 ? data.citations : undefined

      const next = messagesRef.current.filter(m => !m.isLoading)
      const botMsg: Msg = { role: 'bot', text: reply, citations }
      const result: Msg[] = [...next, botMsg]
      // Surface a Generate card only after a current, explicit
      // recommendation. If the assistant is still asking a question, it is
      // gathering context; showing a form at that point makes the flow feel
      // random and rushed.
      const mentionedTemplates = reply.includes('?') ? [] : detectTemplates(reply)
      if (mentionedTemplates.length >= 1 && mentionedTemplates.length <= 4) {
        result.push({ role: 'doc-card', text: '', template: mentionedTemplates[0] })
      }

      const flags = detectRedFlags(t)
      const overstep = checkAssistantOverstep(reply)
      const allFlags = overstep ? [...flags, overstep] : flags
      if (allFlags.length > 0) result.push({ role: 'redflag-card', text: '', flags: allFlags })

      setMessages(result)
      persistSession(result, updatedProfile)
    } catch {
      setMessages(prev => [
        ...prev.filter(m => !m.isLoading),
        { role: 'bot', text: 'Something went wrong. Please check your connection and try again.' },
      ])
    } finally {
      setIsLoading(false)
    }
  }, [isLoading, persistSession])

  // ── Open the confirmation gate for a document (Human-in-the-loop Gate 2) ────
  const handleOpenConfirm = useCallback(async (template: string) => {
    setGeneratingTpl(template)
    try {
      const res = await fetch(`/api/generate?template_name=${encodeURIComponent(template)}`)
      const data = await res.json()
      if (data.error) {
        alert(`Could not load document fields: ${data.error}`)
        return
      }
      const fields: ConfirmField[] = data.fields || []
      const p = profileRef.current
      setConfirmPanel({
        template,
        fields,
        companyName: p?.company_name || '',
        state: p?.state || '',
        structure: p?.structure || '',
        description: p?.product_description || '',
        founders: (p?.founders || []).map(f => ({ name: f.name, equity_pct: f.equity_pct })),
      })
    } catch (e: unknown) {
      alert(`Could not load document fields: ${e instanceof Error ? e.message : String(e)}`)
    } finally {
      setGeneratingTpl(null)
    }
  }, [])

  const handleCancelConfirm = useCallback(() => setConfirmPanel(null), [])

  const handleConfirmGenerate = useCallback(async () => {
    if (!confirmPanel) return
    setConfirmGenerating(true)
    const effectiveProfile = buildEffectiveProfile(profileRef.current, confirmPanel)
    const result = await generateAndDownload(confirmPanel.template, effectiveProfile)
    setConfirmGenerating(false)
    if (result.ok) {
      const label = TEMPLATE_LABELS[confirmPanel.template] ?? confirmPanel.template
      const filled = result.filled ?? ''
      setDocCount(prev => prev + 1)
      setGeneratedDocs(prev => [...prev, { template: confirmPanel.template, label, filled }])
      setMessages(prev => {
        const next: Msg[] = [...prev, { role: 'checklist-card', text: '', template: confirmPanel.template, filled }]
        const flags = detectRedFlags(filled)
        if (flags.length > 0) next.push({ role: 'redflag-card', text: '', flags })
        persistSession(next, profileRef.current)
        return next
      })
      setConfirmPanel(null)
    } else {
      alert(`Could not generate document: ${result.error ?? 'Unknown error'}`)
    }
  }, [confirmPanel, persistSession])

  // ── B2 Founder Pack: same confirm-then-generate gate as a single document
  // (README-v3 B2: "Keep the confirm-contents gate — a batch action
  // shouldn't skip confirmation"), but for every recommended document at
  // once. resolveRecommendedTemplates runs client-side (dependency-free,
  // safe for the browser bundle); the per-template field union still needs
  // a server round trip since reading a template's raw markdown requires
  // fs, so this reuses the EXISTING GET /api/generate?template_name=X
  // endpoint once per resolved template, rather than adding a new one. ────
  const handleOpenFounderPack = useCallback(async () => {
    const p = profileRef.current
    const templateNames = resolveRecommendedTemplates(p ?? emptyProfile())
    if (templateNames.length === 0) {
      alert('No recommended documents yet — chat with FounderLex first so it can recommend what you need.')
      return
    }
    setPackLoadingFields(true)
    try {
      const results = await Promise.all(
        templateNames.map(t => fetch(`/api/generate?template_name=${encodeURIComponent(t)}`).then(r => r.json())),
      )
      const fieldsByKey = new Map<string, ConfirmField>()
      for (const r of results) {
        if (r.error) continue
        for (const f of (r.fields ?? []) as ConfirmField[]) fieldsByKey.set(f.key, f)
      }
      setPackConfirm({
        templateNames,
        fields: Array.from(fieldsByKey.values()),
        companyName: p?.company_name || '',
        state: p?.state || '',
        structure: p?.structure || '',
        description: p?.product_description || '',
        founders: (p?.founders || []).map(f => ({ name: f.name, equity_pct: f.equity_pct })),
      })
    } catch (e: unknown) {
      alert(`Could not load Founder Pack fields: ${e instanceof Error ? e.message : String(e)}`)
    } finally {
      setPackLoadingFields(false)
    }
  }, [])

  const handleCancelFounderPack = useCallback(() => setPackConfirm(null), [])

  const handleConfirmFounderPack = useCallback(async () => {
    if (!packConfirm) return
    setPackGenerating(true)
    const effectiveProfile = buildEffectiveProfile(profileRef.current, packConfirm)
    const result = await generateFounderPackAndDownload(effectiveProfile)
    setPackGenerating(false)
    if (result.ok) {
      setDocCount(prev => prev + (result.docs?.length ?? packConfirm.templateNames.length))
      if (result.docs && result.docs.length > 0) {
        setGeneratedDocs(prev => [
          ...prev,
          ...result.docs!.map(d => ({ template: d.template_name, label: d.label, filled: d.filled })),
        ])
      }
      setMessages(prev => {
        const next: Msg[] = [...prev, { role: 'bot', text: result.coverMemo ?? 'Your Founder Pack is ready and downloading now.' }]
        persistSession(next, profileRef.current)
        return next
      })
      setPackConfirm(null)
    } else {
      alert(`Could not generate your Founder Pack: ${result.error ?? 'Unknown error'}`)
    }
  }, [packConfirm, persistSession])

  const handleOpenLawyerEmail = useCallback(() => {
    setLawyerEmail(buildLawyerReviewEmail(profileRef.current ?? emptyProfile(), generatedDocs))
  }, [generatedDocs])

  const handleCloseLawyerEmail = useCallback(() => setLawyerEmail(null), [])

  const handleStepInside = useCallback(() => {
    if (act !== 'door' || doorBusy) return
    setEnterSignal(s => s + 1)
  }, [act, doorBusy])

  const handleEnterApp = useCallback(() => {
    setAct('about')
  }, [])

  const handleBackToDoor = useCallback(() => {
    if (act !== 'about' || doorBusy) return
    setIsExitingAbout(true)
    setExitSignal(s => s + 1)
  }, [act, doorBusy])

  const handleExitComplete = useCallback(() => {
    setAct('door')
    window.setTimeout(() => setIsExitingAbout(false), HANDOFF_MS)
  }, [])

  // ── Consent gate (one-time, in-session only — never stored/logged/persisted) ─
  const handleRequestChat = useCallback(() => {
    if (consentGiven) { setAct('chat'); return }
    setShowConsent(true)
  }, [consentGiven])

  const handleConsentAgree = useCallback(() => {
    setShowConsent(false)
    setConsentGiven(true)
    setAct('chat')
  }, [])

  const handleConsentDisagree = useCallback(() => {
    setShowConsent(false)
    if (act === 'about') handleBackToDoor()
  }, [act, handleBackToDoor])

  const doorEnterHandoff = doorBusy && act === 'about' && !isExitingAbout
  const doorExitAnim = doorBusy && isExitingAbout
  const showDoorChrome = act === 'door' && !doorBusy

  const scene = (which: Act, z: number): React.CSSProperties => ({
    position: 'absolute', inset: 0, zIndex: z,
    opacity: act === which ? 1 : 0,
    pointerEvents: act === which ? 'auto' : 'none',
    transition: which === 'about' || which === 'door'
      ? `opacity ${HANDOFF_MS}ms ease-in-out`
      : 'opacity .5s ease',
  })

  // All 15 templates organized by category
  const templateCategories = [
    {
      label: 'Product', color: '#3A6EA8',
      items: ['founders_agreement', 'contractor_agreement', 'mutual_nda', 'unilateral_nda', 'advisor_agreement', 'terms_of_service', 'privacy_policy'],
    },
    {
      label: 'Consulting', color: '#5A8A5A',
      items: ['consulting_agreement', 'master_services_agreement', 'sow_template', 'independent_contractor_consulting'],
    },
    {
      label: 'Nonprofit', color: '#8A5A3A',
      items: ['nonprofit_articles', 'nonprofit_bylaws', 'nonprofit_conflict_of_interest', 'donation_acknowledgment_letter'],
    },
  ]

  const allDocuments = templateCategories.flatMap(({ label, color, items }) =>
    items.map(key => ({
      key,
      label: TEMPLATE_LABELS[key],
      category: label,
      color,
    }))
  )

  return (
    <div style={{ position: 'relative', width: '100%', height: '100vh', minHeight: 600, overflow: 'hidden', background: CREAM, color: INK }}>

      {/* Grain overlay */}
      <div aria-hidden style={{
        position: 'absolute', inset: 0, zIndex: 80, pointerEvents: 'none',
        opacity: 0.05, mixBlendMode: 'multiply',
        backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='140' height='140'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='2' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E")`,
        backgroundSize: '140px 140px',
      }} />

      {/* ══════════════════════════════════════════════════════════════════
          ACT 1 — THE DOOR
      ══════════════════════════════════════════════════════════════════ */}
      <section className="door-landing" style={{
        ...scene('door', doorExitAnim || (doorBusy && act === 'door') ? 300 : doorEnterHandoff ? 20 : act === 'door' ? 30 : 0),
        opacity: doorEnterHandoff ? 0 : act === 'door' || doorBusy ? 1 : 0,
        pointerEvents: showDoorChrome ? 'auto' : 'none',
        display: 'flex', flexDirection: 'column', alignItems: 'center',
        justifyContent: 'center', gap: 'clamp(16px,3.5vh,36px)',
        padding: 'clamp(20px,4vh,48px) 24px', background: CREAM,
      }}>
        {showDoorChrome && (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 14, textAlign: 'center' }}>
            <Wordmark size={25} />
            <p className="door-landing-tagline" style={{
              margin: 0,
              display: 'inline-flex',
              alignItems: 'center',
              gap: 9,
              fontFamily: NEWSREADER,
              fontSize: 'clamp(17px,1.9vw,22px)',
              lineHeight: 1.35,
              letterSpacing: '-0.01em',
              color: INK,
              background: WHITE,
              border: '1px solid rgba(42,36,32,0.12)',
              borderRadius: 999,
              padding: '8px 18px',
              boxShadow: '0 10px 24px -18px rgba(42,36,32,0.45)',
            }}>
              <ArchPip /> Startup legal basics, in plain English.
            </p>
          </div>
        )}

        <DoorHero
          enterSignal={enterSignal}
          exitSignal={exitSignal}
          onEnterApp={handleEnterApp}
          onExitComplete={handleExitComplete}
          onRequestEnter={handleStepInside}
          onTransitionActive={setDoorBusy}
        />

        {showDoorChrome && (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 14, textAlign: 'center' }}>
          <CtaButton onClick={handleStepInside}>
            Ask your first question <ArrowRight size={18} strokeWidth={1.8} />
          </CtaButton>
          <span style={{ fontFamily: MONO, fontSize: 11, letterSpacing: '0.16em', textTransform: 'uppercase', color: FAINTER }}>
            No login wall · Free to start
          </span>
        </div>
        )}
      </section>

      {/* ══════════════════════════════════════════════════════════════════
          ACT 2 — ABOUT
      ══════════════════════════════════════════════════════════════════ */}
      <section style={{
        ...scene('about', act === 'about' ? 30 : 10),
        opacity: act === 'about' && !(doorBusy && isExitingAbout) ? 1 : 0,
        pointerEvents: act === 'about' && !(doorBusy && isExitingAbout) ? 'auto' : 'none',
        overflowY: 'auto',
        background: 'radial-gradient(125% 90% at 50% 6%, #FFFDF8 0%, #FBF3E4 30%, #F7F2EB 60%)',
      }}>
        <BackLink label="Back to the door" onClick={handleBackToDoor} />

        <div className="about-glass-layout" style={{
          minHeight: '100%', display: 'flex', flexDirection: 'column',
          alignItems: 'center', justifyContent: 'center',
          gap: 'clamp(28px,4.5vh,46px)',
          padding: 'clamp(72px,10vh,96px) clamp(22px,5vw,40px) clamp(40px,6vh,64px)',
        }}>
          {/* Hero — frosted glass panel */}
          <GlassCard className="about-hero-glass" style={{ width: '100%', maxWidth: 720, padding: 'clamp(28px,4vw,40px) clamp(24px,4vw,36px)' }}>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 18, textAlign: 'center' }}>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 9, fontFamily: MONO, fontSize: 11, letterSpacing: '0.22em', textTransform: 'uppercase', color: FAINT }}>
                <ArchPip /> You&rsquo;re welcome in
              </span>
              <h1 style={{ margin: 0, fontFamily: BRICOLAGE, fontWeight: 600, fontSize: 'clamp(32px,4.8vw,58px)', lineHeight: 1.03, letterSpacing: '-0.025em', color: INK }}>
                FounderLex explains startup legal basics in plain English.
              </h1>
              <p style={{ margin: 0, fontFamily: NEWSREADER, fontSize: 'clamp(18px,1.7vw,21px)', lineHeight: 1.6, color: MUTED, maxWidth: '48ch' }}>
                A guided assistant for first-time founders. Understand the basics, figure out which documents you need, and draft them with your details, with a path to a real lawyer when it&apos;s beyond the basics.
              </p>
            </div>
          </GlassCard>

          {/* Counter stat — only shown after first document is generated */}
          {docCount > 0 && (
            <GlassCard style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '16px 28px' }}>
              <Suspense fallback={<span style={{ fontFamily: BRICOLAGE, fontWeight: 700, fontSize: 36, color: RED }}>{docCount}</span>}>
                <Counter value={docCount} fontSize={36} fontWeight="700" textColor={RED} gap={2} />
              </Suspense>
              <span style={{ fontFamily: BRICOLAGE, fontWeight: 500, fontSize: 16, color: MUTED }}>
                {docCount === 1 ? 'starter document drafted this session' : 'starter documents drafted this session'}
              </span>
            </GlassCard>
          )}

          {/* 3 interactive glass step cards */}
          <div className="about-step-cards" style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'center', gap: 14, width: '100%', maxWidth: 880 }}>
            {([
              { icon: <MessageSquareText size={20} color={RED} strokeWidth={1.6} />, step: '01 · Ask', title: 'Say it in your own words', body: 'Describe what you’re building. No legal vocabulary required.' },
              { icon: <BookOpen size={20} color={RED} strokeWidth={1.6} />, step: '02 · Understand', title: 'Understand the basics', body: 'Plain explanations of what matters and why, honest about limits, and clear when it’s time for a lawyer.' },
              { icon: <FileText size={20} color={RED} strokeWidth={1.6} />, step: '03 · Draft', title: 'Draft with your details', body: 'Starter documents in your words, filled in with your specifics. Yours to review, edit, and take to a lawyer.' },
            ] as const).map(({ icon, step, title, body }) => (
              <GlassCard key={step} className="about-step-card" style={{ flex: '1 1 240px', minWidth: 230, padding: '24px 22px', display: 'flex', flexDirection: 'column', gap: 11 }}>
                <span style={{ width: 40, height: 40, borderRadius: 11, background: 'rgba(242,234,224,0.65)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>{icon}</span>
                <div style={{ fontFamily: MONO, fontSize: 10, letterSpacing: '0.16em', textTransform: 'uppercase', color: FAINT }}>{step}</div>
                <h3 style={{ margin: 0, fontFamily: BRICOLAGE, fontWeight: 600, fontSize: 18, lineHeight: 1.2, color: INK }}>{title}</h3>
                <p style={{ margin: 0, fontSize: 15.5, lineHeight: 1.55, color: MUTED }}>{body}</p>
              </GlassCard>
            ))}
          </div>

          {/* Auto-scrolling document showcase */}
          <div style={{ width: '100%', maxWidth: 920, display: 'flex', flexDirection: 'column', gap: 18 }}>
            <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'baseline', justifyContent: 'space-between', gap: '10px 24px', padding: '0 4px' }}>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 9, fontFamily: MONO, fontSize: 11, letterSpacing: '0.22em', textTransform: 'uppercase', color: FAINT }}>
                <ArchPip /> What we draft
              </span>
              <h2 style={{ margin: 0, fontFamily: BRICOLAGE, fontWeight: 500, fontSize: 'clamp(22px,2.8vw,32px)', lineHeight: 1.04, letterSpacing: '-0.02em', color: INK }}>
                Fifteen starter documents. Built for real founders.
              </h2>
            </div>

            <DocumentMarquee items={allDocuments} />

            <p style={{ margin: 0, fontSize: 15.5, lineHeight: 1.6, color: MUTED, maxWidth: '62ch', padding: '0 4px' }}>
              Covers product, consulting, and nonprofit structures. When something&apos;s beyond the basics, we point you to a real lawyer instead of guessing.
            </p>
          </div>

          {/* Trust & transparency */}
          <div className="about-trust" style={{ width: '100%', maxWidth: 920, display: 'flex', flexDirection: 'column', gap: 18 }}>
            <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'baseline', justifyContent: 'space-between', gap: '10px 24px', padding: '0 4px' }}>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 9, fontFamily: MONO, fontSize: 11, letterSpacing: '0.22em', textTransform: 'uppercase', color: FAINT }}>
                <ArchPip /> Trust &amp; transparency
              </span>
              <h2 style={{ margin: 0, fontFamily: BRICOLAGE, fontWeight: 500, fontSize: 'clamp(22px,2.8vw,32px)', lineHeight: 1.04, letterSpacing: '-0.02em', color: INK }}>
                Honest about what we are, and aren&apos;t.
              </h2>
            </div>

            <div className="about-trust-grid">
              <GlassCard className="about-trust-card" style={{ padding: '24px 22px', display: 'flex', flexDirection: 'column', gap: 12 }}>
                <span style={{ width: 40, height: 40, borderRadius: 11, background: 'rgba(242,234,224,0.65)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <ShieldAlert size={20} color={RED} strokeWidth={1.6} />
                </span>
                <div style={{ fontFamily: MONO, fontSize: 10, letterSpacing: '0.16em', textTransform: 'uppercase', color: FAINT }}>Where we stop</div>
                <h3 style={{ margin: 0, fontFamily: BRICOLAGE, fontWeight: 600, fontSize: 18, lineHeight: 1.2, color: INK }}>What FounderLex can&apos;t do</h3>
                <p style={{ margin: 0, fontSize: 15.5, lineHeight: 1.55, color: MUTED }}>
                  We explain startup legal basics and draft starter documents. We do not give legal advice, and we are not a law firm. When your situation needs a licensed professional, we say so plainly and point you to one.
                </p>
                <ul className="about-trust-list">
                  <li>Active disputes: lawsuits, cease-and-desist letters, or threats of legal action</li>
                  <li>Fundraising and securities questions</li>
                  <li>Immigration and visa status</li>
                  <li>Tax strategy and elections (e.g. S-Corp timing)</li>
                  <li>Anything criminal or law-enforcement related</li>
                </ul>
              </GlassCard>

              <GlassCard className="about-trust-card" style={{ padding: '24px 22px', display: 'flex', flexDirection: 'column', gap: 12 }}>
                <span style={{ width: 40, height: 40, borderRadius: 11, background: 'rgba(242,234,224,0.65)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <BookOpen size={20} color={RED} strokeWidth={1.6} />
                </span>
                <div style={{ fontFamily: MONO, fontSize: 10, letterSpacing: '0.16em', textTransform: 'uppercase', color: FAINT }}>Grounded in real sources</div>
                <h3 style={{ margin: 0, fontFamily: BRICOLAGE, fontWeight: 600, fontSize: 18, lineHeight: 1.2, color: INK }}>Built from primary references</h3>
                <p style={{ margin: 0, fontSize: 15.5, lineHeight: 1.55, color: MUTED }}>
                  Our explanations draw on curated reference material, not invented rules. When we cite a source, it&apos;s one we actually use:
                </p>
                <ul className="about-trust-list about-trust-list--sources">
                  <li><strong>IRS.gov</strong>: EIN, Form 1023, Form 990, 501(c)(3) basics</li>
                  <li><strong>Internal Revenue Code § 501(c)(3)</strong>: nonprofit purpose requirements</li>
                  <li><strong>USPTO.gov</strong>: trademark search and filing</li>
                  <li><strong>copyright.gov</strong>: copyright registration</li>
                  <li><strong>35 U.S.C. §§ 101-103</strong>: patentability standards</li>
                  <li><strong>State Secretary of State offices</strong>: LLC and corporation formation</li>
                </ul>
              </GlassCard>

              <GlassCard className="about-trust-card" style={{ padding: '24px 22px', display: 'flex', flexDirection: 'column', gap: 12 }}>
                <span style={{ width: 40, height: 40, borderRadius: 11, background: 'rgba(242,234,224,0.65)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <Lock size={20} color={RED} strokeWidth={1.6} />
                </span>
                <div style={{ fontFamily: MONO, fontSize: 10, letterSpacing: '0.16em', textTransform: 'uppercase', color: FAINT }}>Your conversation</div>
                <h3 style={{ margin: 0, fontFamily: BRICOLAGE, fontWeight: 600, fontSize: 18, lineHeight: 1.2, color: INK }}>Saved privately, on your terms</h3>
                <p style={{ margin: 0, fontSize: 15.5, lineHeight: 1.55, color: MUTED }}>
                  No login required. Your session is saved anonymously on our server so you can pick up where you left off if you return on the same device. It&apos;s kept private, not shared or sold, and you can clear it anytime with <strong style={{ fontWeight: 600, color: INK }}>Clear conversation</strong> in the chat header.
                </p>
              </GlassCard>
            </div>
          </div>

          {/* Secondary CTA — primary ask-input lives on the door hero */}
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16, textAlign: 'center' }}>
            <CtaButton onClick={handleRequestChat} lg>
              Ask your first question <ArrowRight size={18} strokeWidth={1.8} />
            </CtaButton>
            <span style={{ display: 'flex', alignItems: 'flex-start', gap: 7, maxWidth: '42ch' }}>
              <ShieldCheck size={13} color={MUTED} strokeWidth={1.6} style={{ marginTop: 3, flexShrink: 0 }} aria-hidden />
              <span style={{ fontFamily: MONO, fontSize: 11, lineHeight: 1.7, color: MUTED, textAlign: 'left' }}>
                Educational, not legal advice, and not a law firm. We point you to a real lawyer when it matters.
              </span>
            </span>
          </div>

          {/* Footnote */}
          <p style={{ margin: 0, maxWidth: '76ch', fontFamily: MONO, fontSize: 11, lineHeight: 1.75, color: MUTED, textAlign: 'center', borderTop: '1px solid rgba(42,36,32,0.10)', paddingTop: 'clamp(22px,3vh,30px)' }}>
            FounderLex is a guided assistant that provides legal information and document templates for educational purposes only. It is not a law firm and does not provide legal advice. Using it does not create an attorney-client relationship. For advice about your specific situation, consult a licensed attorney.
          </p>
        </div>
      </section>

      {/* ══════════════════════════════════════════════════════════════════
          ACT 3 — CHAT
      ══════════════════════════════════════════════════════════════════ */}
      <section style={{
        ...scene('chat', act === 'chat' ? 40 : 5),
        background: CREAM, display: 'flex', flexDirection: 'column', alignItems: 'center',
      }}>
        <div style={{ width: '100%', maxWidth: 760, flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0, padding: '0 clamp(14px,3vw,22px)' }}>

          {/* Header */}
          <div className="chat-header" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 4px', borderBottom: '1px solid rgba(42,36,32,0.10)', flexShrink: 0 }}>
            <div className="chat-header-brand" style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
              <DoorGlyph w={16} h={18} panelTop={6} outerR={8} innerR={3} />
              <span style={{ fontFamily: BRICOLAGE, fontWeight: 700, fontSize: 15, color: INK }}>
                Founder<span style={{ color: RED }}>Lex</span>
              </span>
            </div>
            <div className="chat-header-actions" style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
              <span className="chat-header-status" style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontFamily: MONO, fontSize: 10, letterSpacing: '0.10em', textTransform: 'uppercase', color: FAINT }}>
                <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#3F9D6A', flexShrink: 0 }} />
                Here with you
              </span>
              {/* Tools menu — one entry point, each tool labeled + explained */}
              <div style={{ position: 'relative' }}>
                <button onClick={() => setShowTools(v => !v)}
                  className="chat-clear-btn"
                  aria-haspopup="menu" aria-expanded={showTools}
                  style={{
                    display: 'inline-flex', alignItems: 'center', gap: 5,
                    fontFamily: MONO, fontSize: 10, letterSpacing: '0.10em', textTransform: 'uppercase',
                    color: RED, background: 'none', border: 'none', cursor: 'pointer', padding: 0,
                  }}>
                  Tool <span style={{ fontSize: 8, transform: showTools ? 'rotate(180deg)' : 'none', transition: 'transform 0.15s' }}>▾</span>
                </button>
                {showTools && (() => {
                  const TOOLS: { label: string; desc: string; run: () => void; disabled?: boolean; muted?: boolean }[] = [
                    { label: 'Your progress', desc: "Where you are and what's left to do", run: () => setShowRoadmap(true) },
                    { label: 'Filing deadlines', desc: 'Typical dates and windows to know about', run: () => setShowDeadlines(true) },
                    { label: 'Cost & time', desc: 'Rough fees and how long each step takes', run: () => setShowCostEstimate(true) },
                    { label: 'Explain a document', desc: 'Paste any legal form, get it in plain English', run: () => setShowExplainForm(true) },
                    { label: 'Compare two documents', desc: "See what's different between two versions", run: () => setShowCompare(true) },
                    { label: 'Check a name', desc: 'Search if a business or nonprofit name is taken', run: () => setShowNameSearch(true) },
                    { label: packLoadingFields ? 'Founder pack (loading…)' : 'Founder pack', desc: 'Download all your documents in one bundle', run: handleOpenFounderPack, disabled: packLoadingFields },
                    { label: 'Email a lawyer', desc: generatedDocs.length > 0 ? 'Draft a review request for the docs you made' : 'Available once you create a document', run: handleOpenLawyerEmail, disabled: generatedDocs.length === 0 },
                  ]
                  return (
                    <>
                      <div onClick={() => setShowTools(false)} style={{ position: 'fixed', inset: 0, zIndex: 40 }} />
                      <div role="menu" style={{
                        position: 'absolute', top: 'calc(100% + 12px)', right: 0, zIndex: 50, width: 300,
                        background: '#FFFDF9', border: '1px solid rgba(42,36,32,0.14)', borderRadius: 14,
                        boxShadow: '0 14px 40px rgba(42,36,32,0.18)', padding: 7,
                      }}>
                        <div style={{ fontFamily: MONO, fontSize: 9, letterSpacing: '0.12em', textTransform: 'uppercase', color: FAINT, padding: '5px 9px 7px' }}>
                          Optional tools
                        </div>
                        {TOOLS.map((t) => (
                          <button key={t.label} role="menuitem" disabled={t.disabled}
                            onClick={() => { setShowTools(false); t.run() }}
                            onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(219,26,26,0.06)' }}
                            onMouseLeave={(e) => { e.currentTarget.style.background = 'none' }}
                            style={{
                              display: 'block', width: '100%', textAlign: 'left', background: 'none',
                              border: 'none', borderRadius: 9, padding: '9px 10px',
                              cursor: t.disabled ? 'default' : 'pointer', opacity: t.disabled ? 0.5 : 1,
                            }}>
                            <span style={{ display: 'block', fontFamily: BRICOLAGE, fontWeight: 600, fontSize: 13.5, color: INK }}>{t.label}</span>
                            <span style={{ display: 'block', fontFamily: NEWSREADER, fontSize: 12, color: FAINT, marginTop: 2, lineHeight: 1.3 }}>{t.desc}</span>
                          </button>
                        ))}
                      </div>
                    </>
                  )
                })()}
              </div>
              {messages.length > 0 && (
                <button onClick={handleClearSession}
                  className="chat-clear-btn"
                  style={{
                    fontFamily: MONO, fontSize: 10, letterSpacing: '0.10em', textTransform: 'uppercase',
                    color: FAINT, background: 'none', border: 'none', cursor: 'pointer', padding: 0,
                  }}>
                  Clear conversation
                </button>
              )}
              <BackChatLink onClick={() => setAct('about')} />
            </div>
          </div>

          {/* Conversation */}
          <div ref={scrollRef} style={{ flex: 1, minHeight: 0, overflowY: 'auto', padding: '26px 4px 16px', display: 'flex', flexDirection: 'column', gap: 18 }}>

            {/* Greeting */}
            <div style={{ display: 'flex', gap: 11, alignItems: 'flex-start', maxWidth: '90%' }}>
              <DoorGlyph w={28} h={31} panelTop={10} outerR={14} innerR={6} />
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                <div style={{ background: TILE, color: INK, padding: '15px 18px', borderRadius: '4px 16px 16px 16px', fontFamily: NEWSREADER, fontSize: 17, lineHeight: 1.55 }}>
                  Hi, I&apos;m FounderLex. Tell me what you&apos;re building. I&apos;ll explain the legal basics in plain English, help you figure out which documents you need, and draft them with your details. <span style={{ color: MUTED }}>No legal background needed.</span>
                </div>
                {messages.length === 0 && !isLoading && (
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                    {["Splitting equity with a co-founder", "Hiring my first contractor", "Do I need an NDA?", "Starting a nonprofit"].map(chip => (
                      <Chip key={chip} label={chip} onSelect={sendMessage} />
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Message history */}
            {messages.map((m, i) => {
              if (m.role === 'doc-card' && m.template) {
                return (
                  <div key={i} style={{ display: 'flex', paddingLeft: 39 }}>
                    <DocCard
                      template={m.template}
                      onGenerate={() => handleOpenConfirm(m.template!)}
                      generating={generatingTpl === m.template}
                    />
                  </div>
                )
              }
              if (m.role === 'checklist-card' && m.template) {
                return (
                  <div key={i} style={{ display: 'flex', paddingLeft: 39 }}>
                    <BeforeYouSignChecklist
                      template={m.template}
                      label={TEMPLATE_LABELS[m.template] ?? m.template}
                      filled={m.filled ?? ''}
                    />
                  </div>
                )
              }
              if (m.role === 'redflag-card' && m.flags) {
                return (
                  <div key={i} style={{ display: 'flex', paddingLeft: 39 }}>
                    <RedFlagCard flags={m.flags} />
                  </div>
                )
              }
              if (m.isLoading) return <LoadingBubble key={i} />
              return (
                <div key={i} style={{ display: 'flex', justifyContent: m.role === 'user' ? 'flex-end' : 'flex-start' }}>
                  {m.role === 'bot' && <div style={{ marginRight: 11, flexShrink: 0, paddingTop: 4 }}><DoorGlyph w={20} h={22} panelTop={7} outerR={10} innerR={4} /></div>}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6, maxWidth: '82%', alignItems: m.role === 'user' ? 'flex-end' : 'flex-start' }}>
                    <div style={{
                      background: m.role === 'user' ? INK : TILE,
                      color: m.role === 'user' ? CREAM : INK,
                      padding: '14px 17px',
                      borderRadius: m.role === 'user' ? '16px 16px 4px 16px' : '4px 16px 16px 16px',
                      fontFamily: NEWSREADER, fontSize: 16.5, lineHeight: 1.55,
                      whiteSpace: 'pre-wrap',
                    }}>
                      {m.text}
                    </div>
                    {m.role === 'bot' && <CitationChip citations={m.citations} />}
                    {m.role === 'bot' && <ReadAloudButton text={m.text} />}
                  </div>
                </div>
              )
            })}
          </div>

          {/* Input bar */}
          <div style={{ padding: '8px 4px 20px', flexShrink: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, background: WHITE, border: '1px solid rgba(42,36,32,0.14)', borderRadius: 15, padding: '8px 8px 8px 17px', boxShadow: '0 14px 30px -22px rgba(42,36,32,0.5)' }}>
              <input
                value={draft}
                onChange={e => setDraft(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(draft) } }}
                aria-label="Ask FounderLex a question"
                placeholder="Describe what you're building, or ask a legal-basics question…"
                disabled={isLoading}
                style={{ flex: 1, minWidth: 0, border: 'none', outline: 'none', background: 'transparent', fontFamily: NEWSREADER, fontSize: 16, color: INK }}
              />
              <MicButton value={draft} onChange={setDraft} disabled={isLoading} />
              <SendButton onClick={() => sendMessage(draft)} disabled={isLoading || !draft.trim()} />
            </div>
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: 7, marginTop: 10, paddingLeft: 4 }}>
              <ShieldCheck size={12} color={FAINT} strokeWidth={1.6} style={{ marginTop: 2, flexShrink: 0 }} aria-hidden />
              <span style={{ fontFamily: MONO, fontSize: 10.5, lineHeight: 1.6, color: FAINT }}>
                Educational, not legal advice, and not a law firm. I&apos;ll point you to a real lawyer when it matters. Your session is saved anonymously (no login) so you can return later. Use <strong style={{ fontWeight: 500, color: MUTED }}>Clear conversation</strong> anytime.
              </span>
            </div>
          </div>
        </div>
      </section>

      {showConsent && (
        <ConsentGate
          onAgree={handleConsentAgree}
          onDisagree={handleConsentDisagree}
        />
      )}

      {confirmPanel && (
        <ConfirmDocPanel
          panel={confirmPanel}
          validation={validateProfile(buildEffectiveProfile(profile, confirmPanel))}
          generating={confirmGenerating}
          onChange={setConfirmPanel}
          onCancel={handleCancelConfirm}
          onConfirm={handleConfirmGenerate}
        />
      )}

      {packConfirm && (
        <ConfirmPackPanel
          panel={packConfirm}
          validation={validateProfile(buildEffectiveProfile(profile, packConfirm))}
          generating={packGenerating}
          onChange={setPackConfirm}
          onCancel={handleCancelFounderPack}
          onConfirm={handleConfirmFounderPack}
        />
      )}

      {lawyerEmail !== null && (
        <LawyerReviewEmailPanel
          email={lawyerEmail}
          onChange={setLawyerEmail}
          onClose={handleCloseLawyerEmail}
        />
      )}

      {showNameSearch && (
        <NameSearchPanel
          profile={profile}
          onClose={() => setShowNameSearch(false)}
        />
      )}

      {showExplainForm && (
        <ExplainFormPanel onClose={() => setShowExplainForm(false)} />
      )}

      {showDeadlines && (
        <DeadlinesPanel
          profile={profile}
          onClose={() => setShowDeadlines(false)}
        />
      )}

      {showCostEstimate && (
        <CostEstimatePanel
          profile={profile}
          onClose={() => setShowCostEstimate(false)}
        />
      )}

      {showCompare && (
        <ComparePanel onClose={() => setShowCompare(false)} />
      )}

      {showRoadmap && (
        <RoadmapPanel onClose={() => setShowRoadmap(false)} />
      )}
    </div>
  )
}
