'use client'

import React, { useState, useRef, useEffect, useCallback, Suspense, useSyncExternalStore, useMemo } from 'react'
import dynamic from 'next/dynamic'
import {
  ArrowRight, ArrowLeft, ArrowUp,
  MessageSquareText, BookOpen, FileText, ShieldCheck, Download, ShieldAlert, Lock,
  Map as MapIcon, Calendar, DollarSign, GitCompare, Search, Package, Mail, PanelLeft, PanelRight,
  ChevronLeft, ChevronRight, X, Check, Circle, CircleDot,
} from 'lucide-react'
import { marked } from 'marked'
import JSZip from 'jszip'
import { validateProfile, emptyProfile, type FounderProfile } from '@/lib/founderProfile'
import type { ConfirmField } from '@/lib/confirmationFields'
import { buildLawyerReviewEmail, extractBlanks, type GeneratedDoc } from '@/lib/lawyerReviewEmail'
import ConfirmDocPanel, { type ConfirmPanelState } from '@/components/ConfirmDocPanel'
import ConfirmPackPanel, { type ConfirmPackPanelState } from '@/components/ConfirmPackPanel'
import ConsentGate from '@/components/ConsentGate'
import TutorialPrompt from '@/components/TutorialPrompt'
import TutorialTour, { type TutorialStep } from '@/components/TutorialTour'
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
import { STARTER_SUGGESTIONS } from './starterSuggestions'

// ── React Bits — SSR disabled (motion/react needs window) ────────────────────
// Cast to any to bypass TypeScript inference quirks from .jsx component files
const BorderGlow = dynamic(() => import('../components/BorderGlow'), { ssr: false }) as React.ComponentType<any>
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
  role: 'user' | 'bot' | 'doc-card' | 'doc-artifact' | 'checklist-card' | 'redflag-card'
  text: string
  template?: string
  filled?: string
  flags?: RedFlag[]
  isLoading?: boolean
  citations?: CitationLink[]
  // doc-card only: whether the reply that produced this card recommended 2+
  // documents together (vs. just this one). Captured at creation time from
  // detectTemplates(reply) rather than re-derived later from profile state —
  // profile.recommended_documents is extracted by a separate model call
  // BEFORE this reply is generated (app/api/chat/route.ts calls
  // extractProfile() ahead of getChatResponse()), so it can still lag behind
  // the very reply that first recommends multiple documents together.
  multiRecommended?: boolean
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

// ── Download helpers ───────────────────────────────────────────────────────────
function downloadBase64(b64: string, name: string, mime: string) {
  const bytes = atob(b64)
  const arr = new Uint8Array(bytes.length)
  for (let i = 0; i < bytes.length; i++) arr[i] = bytes.charCodeAt(i)
  const url = URL.createObjectURL(new Blob([arr], { type: mime }))
  const a = document.createElement('a')
  a.href = url; a.download = name; a.click()
  URL.revokeObjectURL(url)
}

function downloadBlob(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url; a.download = name; a.click()
  URL.revokeObjectURL(url)
}

type GenerateResult = {
  ok: boolean
  error?: string
  filled?: string
  docx_b64?: string
  docx_name?: string
  pdf_b64?: string
  pdf_name?: string
}

// Fetches the filled preview + docx/pdf payloads but never triggers a
// download itself — generating a document should feel like Claude
// producing an artifact: the caller renders the preview, and download is a
// distinct, explicit action the user takes only when ready.
async function generateDocument(
  templateName: string,
  profile: FounderProfile | null
): Promise<GenerateResult> {
  try {
    const res = await fetch('/api/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ template_name: templateName, profile }),
    })
    const data = await res.json()
    if (data.error) return { ok: false, error: data.error }

    return {
      ok: true,
      filled: data.filled,
      docx_b64: data.docx_b64,
      docx_name: data.docx_name,
      pdf_b64: data.pdf_b64,
      pdf_name: data.pdf_name,
    }
  } catch (e: unknown) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) }
  }
}

// Session docs carry download payloads for instant re-download in the preview panel.
type SessionGeneratedDoc = GeneratedDoc & {
  docx_b64?: string
  docx_name?: string
  pdf_b64?: string
  pdf_name?: string
}

// Upserts by template so regenerating a document (the "Update draft" path)
// refreshes the existing entry everywhere it's referenced — the preview
// panel, its tabs, and any inline chat artifact — instead of appending a
// stale duplicate alongside the fresh one.
function upsertGeneratedDoc(prev: SessionGeneratedDoc[], doc: SessionGeneratedDoc): SessionGeneratedDoc[] {
  const idx = prev.findIndex(d => d.template === doc.template)
  if (idx === -1) return [...prev, doc]
  const next = [...prev]
  next[idx] = doc
  return next
}

// Plain-English "what's included" + outstanding-blanks memo for the
// client-built zip below — a smaller, dependency-free stand-in for
// lib/founderPack.ts's buildCoverMemo. That helper can't be imported here:
// lib/founderPack.ts transitively imports lib/generateDocument.ts (fs,
// pdfkit, html-to-docx), which can't be bundled for the browser. Reuses
// extractBlanks from lib/lawyerReviewEmail.ts, which page.tsx already
// imports client-side with no such issue.
function buildClientCoverMemo(docs: SessionGeneratedDoc[], profile: FounderProfile | null): string {
  const companyName = profile?.company_name || 'your company'
  const lines: string[] = []
  lines.push(`Your FounderLex documents — ${docs.length} document${docs.length === 1 ? '' : 's'} for ${companyName}`)
  lines.push('')
  lines.push("What's included:")
  for (const d of docs) lines.push(`- ${d.label}`)

  const blanksByDoc = docs
    .map(d => ({ label: d.label, blanks: extractBlanks(d.filled) }))
    .filter(d => d.blanks.length > 0)

  lines.push('')
  if (blanksByDoc.length > 0) {
    lines.push('Blanks still need filling in before any of these are ready to sign or file:')
    for (const d of blanksByDoc) lines.push(`- ${d.label}: ${d.blanks.join('; ')}`)
  } else {
    lines.push(
      'No [TO BE COMPLETED] blanks are left in these drafts based on what you told FounderLex — but double-check every field before relying on them.',
    )
  }

  lines.push('')
  lines.push(
    'Have a licensed attorney review every document in this pack before you sign, file, or send it to anyone. FounderLex is an educational tool, not a law firm, and nothing here is legal advice.',
  )
  return lines.join('\n')
}

// "Download all": zips whatever is already in generatedDocs — the exact
// same docx_b64/pdf_b64 bytes backing the previews the user is looking at
// — entirely client-side, rather than asking the server to regenerate a
// pack from profileRef.current. Regenerating server-side could silently
// diverge from what's on screen: profileRef.current doesn't include edits
// made only inside the confirm-fields panel, and /api/founder-pack
// resolves its own template set from the profile rather than from whatever
// the user actually confirmed and generated. Building the zip from the
// already-generated bytes makes that drift impossible by construction.
async function buildGeneratedDocsZip(
  docs: SessionGeneratedDoc[],
  profile: FounderProfile | null,
): Promise<{ blob: Blob; name: string } | null> {
  const withFiles = docs.filter(d => d.docx_b64 && d.docx_name && d.pdf_b64 && d.pdf_name)
  if (withFiles.length === 0) return null
  const zip = new JSZip()
  for (const doc of withFiles) {
    zip.file(doc.docx_name!, doc.docx_b64!, { base64: true })
    zip.file(doc.pdf_name!, doc.pdf_b64!, { base64: true })
  }
  zip.file('Cover Memo.txt', buildClientCoverMemo(withFiles, profile))
  const blob = await zip.generateAsync({ type: 'blob' })
  return { blob, name: 'founderlex-documents.zip' }
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

// ── Markdown helpers ──────────────────────────────────────────────────────────
function renderMarkdown(html: string): string {
  return marked.parse(html, { async: false }) as string
}

function markdownExcerpt(md: string, maxLen = 320): string {
  const plain = md
    .replace(/\[TO BE COMPLETED:?[^\]]*\]/g, '[blank]')
    .replace(/[#>*_`[\]()]/g, '')
    .replace(/\n+/g, ' ')
    .trim()
  return plain.length > maxLen ? `${plain.slice(0, maxLen)}…` : plain
}

// ── Bot message with markdown rendering ───────────────────────────────────────
function BotMessageBubble({ text }: { text: string }) {
  const html = useMemo(() => renderMarkdown(text), [text])
  return (
    <div
      className="chat-bubble chat-bubble--bot chat-bubble--markdown"
      dangerouslySetInnerHTML={{ __html: html }}
    />
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

// ── Document card — chat-first draft CTA ────────────────────────────────────
function DocCard({
  template, onGenerate, onRegenerate, generating, alreadyGenerated = false, quantitySelected = false,
}: {
  template: string
  onGenerate: () => void
  onRegenerate?: () => void
  generating: boolean
  alreadyGenerated?: boolean
  quantitySelected?: boolean
}) {
  const label = TEMPLATE_LABELS[template] ?? template

  return (
    <div className="chat-doc-offer">
      <div className="chat-doc-offer__header">
        <span className="chat-doc-offer__icon"><FileText size={18} color={RED} strokeWidth={1.6} /></span>
        <div>
          <span className="chat-doc-offer__eyebrow">Draft in chat</span>
          <h4 className="chat-doc-offer__title">{label}</h4>
        </div>
      </div>
      <p className="chat-doc-offer__desc">
        {alreadyGenerated
          ? 'This document is already drafted — scroll down to review the preview, or update it with anything new you’ve told me since.'
          : quantitySelected
            ? 'Confirm your details on the next screen, then a preview will appear right here in the chat — nothing downloads until you choose to.'
            : 'Choose one or three documents above, then continue here.'}
      </p>
      <div style={{ display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
        <button
          type="button"
          className="chat-doc-offer__btn"
          onClick={generating ? undefined : onGenerate}
          disabled={generating || (!alreadyGenerated && !quantitySelected)}
        >
          {generating ? (
            <><span className="loading-dot" /><span className="loading-dot" /><span className="loading-dot" /></>
          ) : alreadyGenerated ? (
            <><FileText size={14} strokeWidth={2} /> View draft</>
          ) : (
            <><Download size={14} strokeWidth={2} /> Review &amp; generate</>
          )}
        </button>
        {alreadyGenerated && onRegenerate && (
          <button
            type="button"
            className="chat-doc-offer__link"
            onClick={generating ? undefined : onRegenerate}
            disabled={generating}
          >
            Update draft
          </button>
        )}
      </div>
    </div>
  )
}

function DraftQuantityPicker({
  template, selected, onSelect,
}: {
  template: string
  selected: 1 | 3 | null
  onSelect: (q: 1 | 3) => void
}) {
  const label = TEMPLATE_LABELS[template] ?? template
  return (
    <div className="chat-draft-quantity">
      <p className="chat-draft-quantity__prompt">
        Before we fill in the form, how many documents would you like to draft?
      </p>
      <div className="chat-draft-quantity__options">
        <button
          type="button"
          className={`chat-draft-quantity__option${selected === 1 ? ' chat-draft-quantity__option--active' : ''}`}
          onClick={() => onSelect(1)}
        >
          <span className="chat-draft-quantity__option-label">One document</span>
          <span className="chat-draft-quantity__option-desc">
            Draft <strong>{label}</strong> only — preview it here in the chat and in the side panel, download whenever you're ready.
          </span>
        </button>
        <button
          type="button"
          className={`chat-draft-quantity__option${selected === 3 ? ' chat-draft-quantity__option--active' : ''}`}
          onClick={() => onSelect(3)}
        >
          <span className="chat-draft-quantity__option-label">Three documents</span>
          <span className="chat-draft-quantity__option-desc">
            Bundle up to 3 recommended starter docs — opens the side preview panel for each.
          </span>
        </button>
      </div>
    </div>
  )
}

function ChatDocumentArtifact({
  doc, onOpenPreview, onRegenerate, inlineFull = false,
}: {
  doc: SessionGeneratedDoc
  onOpenPreview?: () => void
  onRegenerate?: () => void
  inlineFull?: boolean
}) {
  const excerpt = markdownExcerpt(doc.filled)
  const fullHtml = useMemo(() => renderMarkdown(doc.filled), [doc.filled])
  // docx_b64/pdf_b64 are never persisted across a saved session (they'd
  // blow well past the session payload's size cap) — so a doc-artifact
  // restored after a refresh has the text preview back but not the binary
  // download payloads. Offer a one-click way to regenerate right here
  // instead of leaving the reader stranded on a preview with no visible
  // way to ever download it.
  const hasDownloads = !!doc.docx_b64 || !!doc.pdf_b64
  return (
    <div className="chat-artifact">
      <div className="chat-artifact__header chat-artifact__header--static">
        <span className="chat-artifact__icon"><FileText size={16} color={RED} strokeWidth={1.6} /></span>
        <div className="chat-artifact__meta">
          <span className="chat-artifact__label">Generated document</span>
          <span className="chat-artifact__title">{doc.label}</span>
        </div>
      </div>
      <div className="chat-artifact__paper">
        {inlineFull ? (
          <div
            className="chat-artifact__markdown chat-doc-preview__markdown"
            dangerouslySetInnerHTML={{ __html: fullHtml }}
          />
        ) : (
          <p className="chat-artifact__excerpt">{excerpt}</p>
        )}
      </div>
      <div className="chat-artifact__actions">
        {!inlineFull && onOpenPreview && (
          <button type="button" className="chat-artifact__link" onClick={onOpenPreview}>
            Open in side panel
          </button>
        )}
        {doc.docx_b64 && (
          <button
            type="button"
            className="chat-artifact__link"
            onClick={() => downloadBase64(doc.docx_b64!, doc.docx_name || 'document.docx', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document')}
          >
            Word
          </button>
        )}
        {doc.pdf_b64 && (
          <button
            type="button"
            className="chat-artifact__link"
            onClick={() => downloadBase64(doc.pdf_b64!, doc.pdf_name || 'document.pdf', 'application/pdf')}
          >
            PDF
          </button>
        )}
        {!hasDownloads && onRegenerate && (
          <button type="button" className="chat-artifact__link" onClick={onRegenerate}>
            Regenerate to download
          </button>
        )}
      </div>
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
    <div className="chat-turn chat-turn--bot">
      <DoorGlyph w={28} h={31} panelTop={10} outerR={14} innerR={6} />
      <div className="chat-bubble chat-bubble--bot chat-bubble--loading">
        <span className="loading-dot" />
        <span className="loading-dot" />
        <span className="loading-dot" />
      </div>
    </div>
  )
}

// ── Responsive breakpoint hook ────────────────────────────────────────────────
function useMediaQuery(query: string): boolean {
  const subscribe = useCallback((cb: () => void) => {
    const mql = window.matchMedia(query)
    mql.addEventListener('change', cb)
    return () => mql.removeEventListener('change', cb)
  }, [query])
  return useSyncExternalStore(subscribe, () => window.matchMedia(query).matches, () => false)
}

type RoadmapStepStatus = 'done' | 'current' | 'upcoming' | 'ongoing'
interface RoadmapStepBrief {
  id: string
  title: string
  status: RoadmapStepStatus
  // /api/roadmap already returns this per step (lib/foundingRoadmap.ts) —
  // only pulled in here for the "what's next" callout below; the fuller
  // whatItIs explanation stays exclusive to the full RoadmapPanel modal so
  // this at-a-glance rail doesn't turn into a second copy of it.
  nextAction: string
}

interface RoadmapBrief {
  headline: string
  steps: RoadmapStepBrief[]
}

function RoadmapStepDot({ status }: { status: RoadmapStepStatus }) {
  if (status === 'done') return <Check size={11} color="#3F9D6A" strokeWidth={2.5} aria-hidden />
  if (status === 'current') return <CircleDot size={11} color={RED} strokeWidth={2.5} aria-hidden />
  if (status === 'ongoing') return <Circle size={8} color={MUTED} strokeWidth={2} aria-hidden />
  return <Circle size={8} color={FAINT} strokeWidth={2} fill={FAINT} aria-hidden />
}

function ProgressRail({
  docCount, onOpenFull, onClose,
}: { docCount: number; onOpenFull: () => void; onClose?: () => void }) {
  const [roadmap, setRoadmap] = useState<RoadmapBrief | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    fetch('/api/roadmap')
      .then(res => res.json())
      .then(data => {
        if (cancelled) return
        if (data.roadmap) {
          setRoadmap({
            headline: data.roadmap.headline as string,
            steps: (data.roadmap.steps as RoadmapStepBrief[]).slice(0, 5),
          })
        }
      })
      .catch(() => {})
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [docCount])

  return (
    <div className="chat-rail-section chat-rail-section--progress" data-tutorial="progress-dashboard">
      <div className="chat-rail-section__head-row">
        <button type="button" className="chat-rail-section__head" onClick={onOpenFull}>
          <span className="chat-rail-section__title">Your progress</span>
          <ChevronRight size={14} color={FAINT} strokeWidth={1.8} aria-hidden />
        </button>
        {onClose && (
          <button type="button" className="chat-rail-section__close" onClick={onClose} aria-label="Hide progress">
            <X size={14} strokeWidth={1.8} />
          </button>
        )}
      </div>
      {docCount > 0 && (
        <div className="chat-rail-doc-count">
          <Suspense fallback={<span style={{ fontFamily: BRICOLAGE, fontWeight: 700, fontSize: 22, color: RED }}>{docCount}</span>}>
            <Counter value={docCount} fontSize={22} fontWeight="700" textColor={RED} gap={1} />
          </Suspense>
          <span>{docCount === 1 ? 'document drafted' : 'documents drafted'}</span>
        </div>
      )}
      {loading && (
        <p className="chat-rail-muted">Loading roadmap…</p>
      )}
      {!loading && roadmap && (
        <>
          <p className="chat-rail-headline">{roadmap.headline}</p>
          <ul className="chat-rail-steps">
            {roadmap.steps.filter(s => s.status !== 'ongoing').map(step => (
              <li key={step.id} className={`chat-rail-step chat-rail-step--${step.status}`}>
                <span className="chat-rail-step__icon"><RoadmapStepDot status={step.status} /></span>
                <span className="chat-rail-step__label">{step.title}</span>
              </li>
            ))}
          </ul>
          {(() => {
            const current = roadmap.steps.find(s => s.status === 'current')
            if (!current) return null
            return (
              <div className="chat-rail-next">
                <span className="chat-rail-next__eyebrow">What&apos;s next</span>
                <span className="chat-rail-next__title">{current.title}</span>
                <p className="chat-rail-next__body">{current.nextAction}</p>
              </div>
            )
          })()}
        </>
      )}
    </div>
  )
}

interface ChatToolItem {
  id: string
  label: string
  action: string
  desc: string
  icon: React.ReactNode
  run: () => void
  disabled?: boolean
}

function ToolsNav({
  tools, compact = false, onClose,
}: { tools: ChatToolItem[]; compact?: boolean; onClose?: () => void }) {
  return (
    <nav className="chat-rail-section chat-rail-tools" aria-label="Optional tools" data-tutorial="tool-menu">
      {!compact && (
        <>
          <div className="chat-rail-section__head-row">
            <span className="chat-rail-section__title chat-rail-section__title--static">Optional tools</span>
            {onClose && (
              <button type="button" className="chat-rail-section__close" onClick={onClose} aria-label="Hide optional tools">
                <X size={14} strokeWidth={1.8} />
              </button>
            )}
          </div>
          <p className="chat-tools-intro">
            Extra helpers that open in a panel. Document drafting always happens here in the chat — you don&apos;t need these to generate a doc.
          </p>
        </>
      )}
      <ul className="chat-tools-list">
        {tools.map(t => (
          <li key={t.id}>
            <button
              type="button"
              className="chat-tool-btn"
              disabled={t.disabled}
              title={compact ? `${t.label}: ${t.desc}` : undefined}
              aria-label={`${t.label}. ${t.action}. ${t.desc}`}
              onClick={t.run}
            >
              <span className="chat-tool-btn__icon">{t.icon}</span>
              {!compact && (
                <span className="chat-tool-btn__text">
                  <span className="chat-tool-btn__label">{t.label}</span>
                  <span className="chat-tool-btn__action">{t.action}</span>
                  <span className="chat-tool-btn__desc">{t.desc}</span>
                </span>
              )}
              {compact && <span className="chat-tool-btn__compact-label">{t.label}</span>}
            </button>
          </li>
        ))}
      </ul>
    </nav>
  )
}

function DownloadBtn({
  label, onClick, disabled,
}: { label: string; onClick: () => void; disabled?: boolean }) {
  const [hov, setHov] = useState(false)
  return (
    <button
      type="button"
      className="chat-doc-download-btn"
      disabled={disabled}
      onClick={onClick}
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      style={{
        background: disabled ? TILE : hov ? '#C21717' : RED,
        cursor: disabled ? 'not-allowed' : 'pointer',
        opacity: disabled ? 0.5 : 1,
      }}
    >
      <Download size={14} strokeWidth={2} aria-hidden />
      {label}
    </button>
  )
}

function DocPreviewPanel({
  docs, selectedTemplate, onSelectTemplate, onClose, inDrawer = false, onDownloadAll, downloadingAll = false,
}: {
  docs: SessionGeneratedDoc[]
  selectedTemplate: string | null
  onSelectTemplate: (template: string) => void
  onClose: () => void
  inDrawer?: boolean
  onDownloadAll?: () => void
  downloadingAll?: boolean
}) {
  const selected = docs.find(d => d.template === selectedTemplate) ?? docs[docs.length - 1] ?? null
  const html = useMemo(
    () => (selected?.filled ? renderMarkdown(selected.filled) : ''),
    [selected?.filled],
  )

  if (docs.length === 0) {
    return (
      <div className={`chat-doc-preview ${inDrawer ? 'chat-doc-preview--drawer' : ''}`}>
        <div className="chat-doc-preview__toolbar">
          <span className="chat-doc-preview__eyebrow">Document preview</span>
          <button type="button" className="chat-drawer-close" onClick={onClose} aria-label="Close document preview">
            <X size={18} strokeWidth={1.8} />
          </button>
        </div>
        <div className="chat-doc-preview-empty">
          <FileText size={32} color={FAINT} strokeWidth={1.4} aria-hidden />
          <p>No document yet</p>
          <span>Generate a document from the chat and its preview will appear here — download Word or PDF whenever you're ready.</span>
        </div>
      </div>
    )
  }

  return (
    <div className={`chat-doc-preview ${inDrawer ? 'chat-doc-preview--drawer' : ''}`}>
      <div className="chat-doc-preview__toolbar">
        <div className="chat-doc-preview__toolbar-left">
          <span className="chat-doc-preview__doc-icon"><FileText size={16} color={RED} strokeWidth={1.6} /></span>
          <div>
            <span className="chat-doc-preview__eyebrow">Preview</span>
            {selected && <h3 className="chat-doc-preview__title">{selected.label}</h3>}
          </div>
        </div>
        <div className="chat-doc-preview__toolbar-right">
          {docs.length > 1 && onDownloadAll && (
            <DownloadBtn
              label={downloadingAll ? 'Zipping…' : 'Download all'}
              disabled={downloadingAll}
              onClick={onDownloadAll}
            />
          )}
          <DownloadBtn
            label="Word"
            disabled={!selected?.docx_b64}
            onClick={() => {
              if (selected?.docx_b64) downloadBase64(selected.docx_b64, selected.docx_name || 'document.docx', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document')
            }}
          />
          <DownloadBtn
            label="PDF"
            disabled={!selected?.pdf_b64}
            onClick={() => {
              if (selected?.pdf_b64) downloadBase64(selected.pdf_b64, selected.pdf_name || 'document.pdf', 'application/pdf')
            }}
          />
          <button type="button" className="chat-drawer-close" onClick={onClose} aria-label="Close document preview">
            <X size={18} strokeWidth={1.8} />
          </button>
        </div>
      </div>
      {docs.length > 1 && (
        <div className="chat-doc-tabs" role="tablist">
          {docs.map(d => (
            <button
              key={d.template}
              type="button"
              role="tab"
              aria-selected={d.template === selected?.template}
              className={`chat-doc-tab${d.template === selected?.template ? ' chat-doc-tab--active' : ''}`}
              onClick={() => onSelectTemplate(d.template)}
            >
              {d.label}
            </button>
          ))}
        </div>
      )}
      <div className="chat-doc-preview__canvas">
        <div className="chat-doc-preview__paper">
          {selected && (
            <>
              <div
                className="chat-doc-preview__markdown"
                dangerouslySetInnerHTML={{ __html: html }}
              />
              <details className="chat-doc-preview__checklist-details">
                <summary>Before you sign checklist</summary>
                <div className="chat-doc-preview__checklist">
                  <BeforeYouSignChecklist
                    template={selected.template}
                    label={selected.label}
                    filled={selected.filled}
                  />
                </div>
              </details>
            </>
          )}
        </div>
      </div>
    </div>
  )
}

function LeftRail({
  docCount, tools, expanded, onToggleExpand, onOpenRoadmap, compact,
  progressOpen, toolsOpen, onCloseProgress, onCloseTools, onOpenProgress, onOpenTools,
}: {
  docCount: number
  tools: ChatToolItem[]
  expanded: boolean
  onToggleExpand: () => void
  onOpenRoadmap: () => void
  compact: boolean
  progressOpen: boolean
  toolsOpen: boolean
  onCloseProgress: () => void
  onCloseTools: () => void
  onOpenProgress: () => void
  onOpenTools: () => void
}) {
  return (
    <aside className={`chat-left-rail${compact ? ' chat-left-rail--compact' : ''}${!expanded && !compact ? ' chat-left-rail--collapsed' : ''}`}>
      <div className="chat-left-rail__inner">
        {!compact && (
          <button
            type="button"
            className="chat-rail-toggle"
            onClick={onToggleExpand}
            aria-label={expanded ? 'Collapse sidebar' : 'Expand sidebar'}
          >
            {expanded ? <ChevronLeft size={16} strokeWidth={1.8} /> : <ChevronRight size={16} strokeWidth={1.8} />}
          </button>
        )}
        {(expanded || compact) && (
          <>
            {!compact && progressOpen && (
              <ProgressRail docCount={docCount} onOpenFull={onOpenRoadmap} onClose={onCloseProgress} />
            )}
            {!compact && !progressOpen && (
              <button type="button" className="chat-rail-reopen" onClick={onOpenProgress} data-tutorial="progress-dashboard">
                <MapIcon size={14} color={RED} strokeWidth={1.6} /> Your progress
              </button>
            )}
            {toolsOpen && (
              <ToolsNav tools={tools} compact={compact} onClose={compact ? undefined : onCloseTools} />
            )}
            {!compact && !toolsOpen && (
              <button type="button" className="chat-rail-reopen" onClick={onOpenTools} data-tutorial="tool-menu">
                <BookOpen size={14} color={RED} strokeWidth={1.6} /> Optional tools
              </button>
            )}
          </>
        )}
        {!expanded && !compact && (
          <>
            {toolsOpen && <ToolsNav tools={tools} compact />}
            {!toolsOpen && (
              <button type="button" className="chat-rail-reopen chat-rail-reopen--icon" onClick={onOpenTools} title="Show optional tools" data-tutorial="tool-menu">
                <BookOpen size={16} color={RED} strokeWidth={1.6} />
              </button>
            )}
          </>
        )}
      </div>
    </aside>
  )
}


// ── Quick tour steps ─────────────────────────────────────────────────────────
// Two of these five targets don't reliably exist for a brand-new session —
// a doc-card only appears once the assistant recommends something, and
// "Clear conversation" only renders once messages.length > 0. Rather than
// requiring the exact interactive element to exist yet (and needing a
// skip-if-missing fallback), those two steps point at the stable
// containers that are always mounted (the message list, the header
// actions row) with copy describing what appears there.
const TUTORIAL_STEPS: TutorialStep[] = [
  {
    target: '[data-tutorial="chat-input"]',
    title: 'Ask anything, in your own words',
    body: 'Type what you’re building or a legal-basics question here, then press Enter or tap send. No legal vocabulary needed.',
  },
  {
    target: '[data-tutorial="tool-menu"]',
    title: 'Optional tools',
    body: 'Extra helpers — cost estimates, filing deadlines, name search, and more — live here. You never need them just to draft a document.',
  },
  {
    target: '[data-tutorial="doc-generate"]',
    title: 'Draft a document',
    body: 'When FounderLex recommends a document, a card appears right here. Generating it shows a full preview — nothing downloads until you choose to.',
  },
  {
    target: '[data-tutorial="progress-dashboard"]',
    title: 'Your progress',
    body: 'Track your founding steps, how many documents you’ve drafted, and exactly what’s next — all at a glance.',
  },
  {
    target: '[data-tutorial="clear-conversation"]',
    title: 'Start fresh anytime',
    body: 'Once you’ve chatted, a "Clear conversation" link appears here — it resets your messages, progress, and drafted documents.',
  },
]

// ── Main page ─────────────────────────────────────────────────────────────────
export default function Home() {
  const [act, setAct]               = useState<Act>('door')
  const [draft, setDraft]           = useState('')
  const [messages, setMessages]     = useState<Msg[]>([])
  const [isLoading, setIsLoading]   = useState(false)
  const [profile, setProfile]       = useState<FounderProfile | null>(null)
  const profileRef                  = useRef<FounderProfile | null>(null)
  const [docCount, setDocCount]     = useState(0)
  const [generatedDocs, setGeneratedDocs] = useState<SessionGeneratedDoc[]>([])
  const [previewTemplate, setPreviewTemplate] = useState<string | null>(null)
  const [previewPanelOpen, setPreviewPanelOpen] = useState(false)
  const [sidePreviewEnabled, setSidePreviewEnabled] = useState(false)
  const [leftRailExpanded, setLeftRailExpanded] = useState(true)
  const [progressSectionOpen, setProgressSectionOpen] = useState(true)
  const [toolsSectionOpen, setToolsSectionOpen] = useState(false)
  const [showLeftDrawer, setShowLeftDrawer] = useState(false)
  const [showPreviewDrawer, setShowPreviewDrawer] = useState(false)
  const [draftQuantity, setDraftQuantity] = useState<1 | 3 | null>(null)
  const [draftQuantityTemplate, setDraftQuantityTemplate] = useState<string | null>(null)
  const activeDraftModeRef = useRef<'single' | 'triple'>('single')
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
  const [enterSignal, setEnterSignal]     = useState(0)
  const [exitSignal, setExitSignal]       = useState(0)
  const [doorBusy, setDoorBusy]           = useState(false)
  const [isExitingAbout, setIsExitingAbout] = useState(false)
  const [showConsent, setShowConsent]     = useState(false)
  const [consentGiven, setConsentGiven]   = useState(false)
  const [showTutorialPrompt, setShowTutorialPrompt] = useState(false)
  // null = not running. In-memory only, same as consentGiven above — resets
  // on a real page reload, which is what "never re-triggers once dismissed
  // for the session" means here, consistent with how consent itself works.
  const [tutorialStep, setTutorialStep]   = useState<number | null>(null)

  // Leaving chat (e.g. the header "Back" link) keeps the chat scene mounted
  // at opacity 0 for the cross-fade — without this, the tour would keep
  // highlighting those now-hidden elements over the About/Door screens.
  useEffect(() => {
    if (act !== 'chat') {
      setShowTutorialPrompt(false)
      setTutorialStep(null)
    }
  }, [act])

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

  // Progress panel open by default when entering chat
  useEffect(() => {
    if (act === 'chat') setProgressSectionOpen(true)
  }, [act])

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
    setPackConfirm(null)
    setDocCount(0)
    setGeneratedDocs([])
    setPreviewTemplate(null)
    setPreviewPanelOpen(false)
    setShowPreviewDrawer(false)
    setSidePreviewEnabled(false)
    setDraftQuantity(null)
    setDraftQuantityTemplate(null)
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
        // One card +, only when this reply recommended 2+ documents together,
        // the draft-quantity chooser: "One document" drafts this template,
        // "Three documents" bundles all recommended docs (Founder Pack). When
        // only one document was recommended there is nothing to bundle, so
        // the card goes straight to a single-document draft.
        const multiRecommended = mentionedTemplates.length >= 2
        result.push({ role: 'doc-card', text: '', template: mentionedTemplates[0], multiRecommended })
        setDraftQuantity(multiRecommended ? null : 1)
        setDraftQuantityTemplate(mentionedTemplates[0])
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

  const isWide = useMediaQuery('(min-width: 1280px)')
  const isTablet = useMediaQuery('(min-width: 1024px) and (max-width: 1279px)')
  const isMobile = useMediaQuery('(max-width: 1023px)')

  const openDocPreview = useCallback((template: string) => {
    setPreviewTemplate(template)
    setPreviewPanelOpen(true)
    if (isTablet || isMobile) setShowPreviewDrawer(true)
  }, [isTablet, isMobile])

  const closeDocPreview = useCallback(() => {
    setPreviewPanelOpen(false)
    setShowPreviewDrawer(false)
  }, [])

  const handleOpenTriplePack = useCallback(async (primaryTemplate: string) => {
    const p = profileRef.current
    let templateNames = resolveRecommendedTemplates(p ?? emptyProfile())
    templateNames = [primaryTemplate, ...templateNames.filter(t => t !== primaryTemplate)].slice(0, 3)
    if (templateNames.length === 0) templateNames = [primaryTemplate]
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
      alert(`Could not load document fields: ${e instanceof Error ? e.message : String(e)}`)
    } finally {
      setPackLoadingFields(false)
    }
  }, [])

  const handleStartDraft = useCallback(async (template: string) => {
    if (!draftQuantity || draftQuantityTemplate !== template) return
    activeDraftModeRef.current = draftQuantity === 1 ? 'single' : 'triple'
    if (draftQuantity === 1) {
      await handleOpenConfirm(template)
    } else {
      await handleOpenTriplePack(template)
    }
  }, [draftQuantity, draftQuantityTemplate, handleOpenConfirm, handleOpenTriplePack])

  const handleSelectDraftQuantity = useCallback((template: string, q: 1 | 3) => {
    setDraftQuantity(q)
    setDraftQuantityTemplate(template)
    activeDraftModeRef.current = q === 1 ? 'single' : 'triple'
    if (q === 3) setSidePreviewEnabled(true)
  }, [])

  // Skips the One/Three chooser entirely when only one document is actually
  // recommended for the user's situation — there is nothing to bundle, so
  // offering a "Three documents" option would be misleading.
  const handleStartSingleDraft = useCallback(async (template: string) => {
    activeDraftModeRef.current = 'single'
    setDraftQuantity(1)
    setDraftQuantityTemplate(template)
    await handleOpenConfirm(template)
  }, [handleOpenConfirm])

  const handleConfirmGenerate = useCallback(async () => {
    if (!confirmPanel) return
    setConfirmGenerating(true)
    const effectiveProfile = buildEffectiveProfile(profileRef.current, confirmPanel)
    const result = await generateDocument(confirmPanel.template, effectiveProfile)
    setConfirmGenerating(false)
    if (result.ok) {
      const template = confirmPanel.template
      const label = TEMPLATE_LABELS[template] ?? template
      const filled = result.filled ?? ''
      // Upserting (not appending) means "Update draft" refreshes the same
      // entry everywhere it's shown, so only a genuinely new template
      // increments the "documents drafted" counter.
      const isUpdate = generatedDocs.some(d => d.template === template)
      if (!isUpdate) setDocCount(prev => prev + 1)
      setGeneratedDocs(prev => upsertGeneratedDoc(prev, {
        template,
        label,
        filled,
        docx_b64: result.docx_b64,
        docx_name: result.docx_name,
        pdf_b64: result.pdf_b64,
        pdf_name: result.pdf_name,
      }))
      // Preview-first, download-second applies to every mode now — the
      // right preview panel always opens, in addition to single-doc's
      // existing full inline chat preview.
      setSidePreviewEnabled(true)
      openDocPreview(template)
      const singleMode = activeDraftModeRef.current === 'single'
      setMessages(prev => {
        const next: Msg[] = [
          ...prev,
          {
            role: 'bot',
            text: isUpdate
              ? `Your **${label}** draft is updated — review the refreshed preview below${singleMode ? '' : ' and in the preview panel'}, then download Word or PDF whenever you're ready.`
              : `Your **${label}** preview is ready. Review it below${singleMode ? '' : ' and in the preview panel'}, then download Word or PDF whenever you're ready — nothing downloads automatically.`,
          },
          { role: 'doc-artifact', text: singleMode ? 'inline' : '', template, filled },
          { role: 'checklist-card', text: '', template, filled },
        ]
        const flags = detectRedFlags(filled)
        if (flags.length > 0) next.push({ role: 'redflag-card', text: '', flags })
        persistSession(next, profileRef.current)
        return next
      })
      setConfirmPanel(null)
    } else {
      alert(`Could not generate document: ${result.error ?? 'Unknown error'}`)
    }
  }, [confirmPanel, persistSession, openDocPreview, generatedDocs])

  // ── B2 Founder Pack: same confirm-then-generate gate as a single document
  // (README-v3 B2: "Keep the confirm-contents gate — a batch action
  // shouldn't skip confirmation"), but for every recommended document at
  // once. resolveRecommendedTemplates runs client-side (dependency-free,
  // safe for the browser bundle); the per-template field union still needs
  // a server round trip since reading a template's raw markdown requires
  // fs, so this reuses the EXISTING GET /api/generate?template_name=X
  // endpoint once per resolved template, rather than adding a new one. ────
  const handleOpenFounderPack = useCallback(async () => {
    activeDraftModeRef.current = 'triple'
    setSidePreviewEnabled(true)
    const p = profileRef.current
    // Capped at 3, same as handleOpenTriplePack below and the "up to 3
    // recommended starter docs" copy in the One/Three chooser — not just a
    // UX ceiling. handleConfirmFounderPack now issues one /api/generate
    // POST per template (for real per-doc download payloads) on top of the
    // one GET per template already made here, and /api/generate's rate
    // limit (10/minute) is shared across GET and POST by IP. An uncapped
    // recommended-document list could fan out past that limit and leave
    // some documents silently failing to generate.
    const templateNames = resolveRecommendedTemplates(p ?? emptyProfile()).slice(0, 3)
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

  // Generates every doc in the pack via the same per-template /api/generate
  // endpoint the single-doc flow uses (called once per template, in
  // parallel) rather than /api/founder-pack — that endpoint only ever
  // returns `filled` per doc, never docx_b64/pdf_b64, so individual
  // Word/PDF downloads for a bundled doc were previously unavailable. The
  // zip endpoint is still used, but only on demand, by the separate
  // "Download all" button below.
  const handleConfirmFounderPack = useCallback(async () => {
    if (!packConfirm) return
    setPackGenerating(true)
    const effectiveProfile = buildEffectiveProfile(profileRef.current, packConfirm)
    const results = await Promise.all(
      packConfirm.templateNames.map(async template => ({
        template,
        result: await generateDocument(template, effectiveProfile),
      })),
    )
    setPackGenerating(false)

    const succeeded = results.filter(r => r.result.ok)
    const failed = results.filter(r => !r.result.ok)

    if (succeeded.length === 0) {
      alert(`Could not generate your documents: ${failed[0]?.result.error ?? 'Unknown error'}`)
      return
    }

    const newDocs: SessionGeneratedDoc[] = succeeded.map(({ template, result }) => ({
      template,
      label: TEMPLATE_LABELS[template] ?? template,
      filled: result.filled ?? '',
      docx_b64: result.docx_b64,
      docx_name: result.docx_name,
      pdf_b64: result.pdf_b64,
      pdf_name: result.pdf_name,
    }))

    const newCount = newDocs.filter(d => !generatedDocs.some(g => g.template === d.template)).length
    if (newCount > 0) setDocCount(prev => prev + newCount)
    setGeneratedDocs(prev => newDocs.reduce(upsertGeneratedDoc, prev))
    setSidePreviewEnabled(true)
    openDocPreview(newDocs[0].template)

    setMessages(prev => {
      const failedLabel = failed.length > 0
        ? ` (${failed.map(f => TEMPLATE_LABELS[f.template] ?? f.template).join(', ')} couldn't be generated: ${failed[0].result.error ?? 'unknown error'})`
        : ''
      const next: Msg[] = [
        ...prev,
        {
          role: 'bot',
          text: `${newDocs.length} of ${packConfirm.templateNames.length} documents ${newDocs.length === 1 ? 'is' : 'are'} ready to preview below and in the preview panel${failedLabel}. Download Word or PDF for each whenever you're ready — nothing downloads automatically.`,
        },
        ...newDocs.map(d => ({
          role: 'doc-artifact' as const,
          text: '',
          template: d.template,
          filled: d.filled,
        })),
      ]
      persistSession(next, profileRef.current)
      return next
    })
    setPackConfirm(null)
  }, [packConfirm, persistSession, openDocPreview, generatedDocs])

  const [downloadingAllZip, setDownloadingAllZip] = useState(false)

  // Zips whatever is currently in generatedDocs — built client-side from
  // the same bytes already backing the previews, on demand, only when the
  // user clicks this (never automatically).
  const handleDownloadAllZip = useCallback(async () => {
    setDownloadingAllZip(true)
    try {
      const zip = await buildGeneratedDocsZip(generatedDocs, profileRef.current)
      if (zip) {
        downloadBlob(zip.blob, zip.name)
      } else {
        alert('No downloadable documents yet.')
      }
    } catch (e: unknown) {
      alert(`Could not prepare the zip download: ${e instanceof Error ? e.message : String(e)}`)
    } finally {
      setDownloadingAllZip(false)
    }
  }, [generatedDocs])

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
    // Offered exactly once per session, right after the one-time consent
    // accept — there's no other place that ever sets this true, so
    // dismissing it (skip or finish) means it never comes back this session.
    setShowTutorialPrompt(true)
  }, [])

  const handleConsentDisagree = useCallback(() => {
    setShowConsent(false)
    if (act === 'about') handleBackToDoor()
  }, [act, handleBackToDoor])

  const handleTutorialStart = useCallback(() => {
    setShowTutorialPrompt(false)
    setTutorialStep(0)
  }, [])

  const handleTutorialSkip = useCallback(() => {
    setShowTutorialPrompt(false)
    setTutorialStep(null)
  }, [])

  const handleTutorialNext = useCallback(() => {
    setTutorialStep(i => {
      if (i === null) return null
      if (i >= TUTORIAL_STEPS.length - 1) return null
      return i + 1
    })
  }, [])

  const handleTutorialBack = useCallback(() => {
    setTutorialStep(i => (i === null || i <= 0 ? i : i - 1))
  }, [])

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

  const chatTools: ChatToolItem[] = [
    {
      id: 'progress', label: 'Full roadmap', action: 'Opens a detailed progress panel',
      desc: 'See every founding step with status, what it means, and suggested next actions.',
      icon: <MapIcon size={16} color={RED} strokeWidth={1.6} />, run: () => setShowRoadmap(true),
    },
    {
      id: 'deadlines', label: 'Filing deadlines', action: 'Opens a deadline reference panel',
      desc: 'Typical filing windows and dates for your entity type — educational, not a calendar.',
      icon: <Calendar size={16} color={RED} strokeWidth={1.6} />, run: () => setShowDeadlines(true),
    },
    {
      id: 'cost', label: 'Cost & time', action: 'Opens a cost estimate panel',
      desc: 'Rough fees and timelines for common steps like incorporation and trademark search.',
      icon: <DollarSign size={16} color={RED} strokeWidth={1.6} />, run: () => setShowCostEstimate(true),
    },
    {
      id: 'explain', label: 'Explain a document', action: 'Opens a paste-and-explain form',
      desc: 'Paste any legal form you received and get a plain-English walkthrough of what it says.',
      icon: <BookOpen size={16} color={RED} strokeWidth={1.6} />, run: () => setShowExplainForm(true),
    },
    {
      id: 'compare', label: 'Compare documents', action: 'Opens a side-by-side compare tool',
      desc: 'Upload or paste two versions of a contract to see what changed between them.',
      icon: <GitCompare size={16} color={RED} strokeWidth={1.6} />, run: () => setShowCompare(true),
    },
    {
      id: 'name', label: 'Check a name', action: 'Opens a name availability search',
      desc: 'Search whether a business or nonprofit name may already be taken.',
      icon: <Search size={16} color={RED} strokeWidth={1.6} />, run: () => setShowNameSearch(true),
    },
    {
      id: 'pack', label: packLoadingFields ? 'Founder pack (loading…)' : 'Founder pack', action: 'Bundles up to 3 recommended docs',
      desc: 'Download up to 3 of the documents FounderLex recommended for you in one zip file.',
      icon: <Package size={16} color={RED} strokeWidth={1.6} />, run: handleOpenFounderPack, disabled: packLoadingFields,
    },
    {
      id: 'lawyer', label: 'Email a lawyer', action: generatedDocs.length > 0 ? 'Drafts a review-request email' : 'Unlocks after your first document',
      desc: generatedDocs.length > 0
        ? 'Pre-fills an email asking a lawyer to review the documents you drafted here.'
        : 'Generate at least one document in the chat first.',
      icon: <Mail size={16} color={RED} strokeWidth={1.6} />, run: handleOpenLawyerEmail, disabled: generatedDocs.length === 0,
    },
  ]

  const showLeftRailDesktop = isWide || isTablet
  const leftRailCompact = isTablet
  const showPreviewFixed = isWide && previewPanelOpen
  const showPreviewSlideOver = (isTablet || isMobile) && showPreviewDrawer

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
              { icon: <MessageSquareText size={20} color={RED} strokeWidth={1.6} />, step: '01 · Ask', line: 'Describe what you’re building — no legal vocabulary required.' },
              { icon: <BookOpen size={20} color={RED} strokeWidth={1.6} />, step: '02 · Understand', line: 'Get plain-English answers, honest about limits and when to call a lawyer.' },
              { icon: <FileText size={20} color={RED} strokeWidth={1.6} />, step: '03 · Draft', line: 'Draft starter documents filled in with your details, ready for a lawyer’s review.' },
            ] as const).map(({ icon, step, line }) => (
              <GlassCard key={step} className="about-step-card" style={{ flex: '1 1 240px', minWidth: 230, padding: '24px 22px', display: 'flex', flexDirection: 'column', gap: 11 }}>
                <span style={{ width: 40, height: 40, borderRadius: 11, background: 'rgba(242,234,224,0.65)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>{icon}</span>
                <div style={{ fontFamily: MONO, fontSize: 10, letterSpacing: '0.16em', textTransform: 'uppercase', color: FAINT }}>{step}</div>
                <p style={{ margin: 0, fontSize: 15.5, lineHeight: 1.55, color: INK }}>{line}</p>
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
                  <li>Fundraising, securities, and tax strategy questions</li>
                  <li>Immigration status, and anything criminal or law-enforcement related</li>
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
                  <li><strong>IRS.gov &amp; IRC § 501(c)(3)</strong>: EIN, Form 1023/990, and nonprofit purpose basics</li>
                  <li><strong>USPTO.gov &amp; 35 U.S.C. §§ 101-103</strong>: trademark filing and patentability standards</li>
                  <li><strong>copyright.gov &amp; state Secretary of State offices</strong>: copyright, LLC, and corporation filing</li>
                </ul>
              </GlassCard>

              <GlassCard className="about-trust-card" style={{ padding: '24px 22px', display: 'flex', flexDirection: 'column', gap: 12 }}>
                <span style={{ width: 40, height: 40, borderRadius: 11, background: 'rgba(242,234,224,0.65)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <Lock size={20} color={RED} strokeWidth={1.6} />
                </span>
                <div style={{ fontFamily: MONO, fontSize: 10, letterSpacing: '0.16em', textTransform: 'uppercase', color: FAINT }}>Your conversation</div>
                <h3 style={{ margin: 0, fontFamily: BRICOLAGE, fontWeight: 600, fontSize: 18, lineHeight: 1.2, color: INK }}>Saved privately, on your terms</h3>
                <p style={{ margin: 0, fontSize: 15.5, lineHeight: 1.55, color: MUTED }}>
                  No login required. Your session is saved anonymously so you can pick up where you left off — kept private, never shared or sold, and clearable anytime with <strong style={{ fontWeight: 600, color: INK }}>Clear conversation</strong> in the chat header.
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
      <section className="chat-workspace" style={{
        ...scene('chat', act === 'chat' ? 40 : 5),
        background: CREAM,
      }}>
        <div className={`chat-workspace-grid${isWide && !leftRailExpanded ? ' chat-workspace-grid--rail-collapsed' : ''}${!showPreviewFixed ? ' chat-workspace-grid--no-preview' : ''}`}>
          {/* Left rail — desktop & tablet icon rail */}
          {showLeftRailDesktop && (
            <LeftRail
              docCount={docCount}
              tools={chatTools}
              expanded={leftRailExpanded}
              onToggleExpand={() => setLeftRailExpanded(v => !v)}
              onOpenRoadmap={() => setShowRoadmap(true)}
              compact={leftRailCompact}
              progressOpen={progressSectionOpen}
              toolsOpen={toolsSectionOpen}
              onCloseProgress={() => setProgressSectionOpen(false)}
              onCloseTools={() => setToolsSectionOpen(false)}
              onOpenProgress={() => setProgressSectionOpen(true)}
              onOpenTools={() => setToolsSectionOpen(true)}
            />
          )}

          {/* Center — chat */}
          <main className="chat-center">
            <div className="chat-center-inner">
              <div className="chat-header">
                <div className="chat-header-brand">
                  {isMobile && (
                    <button type="button" className="chat-header-icon-btn" onClick={() => setShowLeftDrawer(true)} aria-label="Open tools">
                      <PanelLeft size={18} strokeWidth={1.8} />
                    </button>
                  )}
                  <DoorGlyph w={16} h={18} panelTop={6} outerR={8} innerR={3} />
                  <span style={{ fontFamily: BRICOLAGE, fontWeight: 700, fontSize: 15, color: INK }}>
                    Founder<span style={{ color: RED }}>Lex</span>
                  </span>
                </div>
                <div className="chat-header-actions" data-tutorial="clear-conversation">
                  {!isWide && previewPanelOpen && (
                    <button
                      type="button"
                      className="chat-header-icon-btn"
                      onClick={() => setShowPreviewDrawer(v => !v)}
                      aria-label="Toggle document preview"
                    >
                      <PanelRight size={18} strokeWidth={1.8} />
                    </button>
                  )}
                  {sidePreviewEnabled && generatedDocs.length > 0 && !previewPanelOpen && (
                    <button
                      type="button"
                      className="chat-header-icon-btn"
                      onClick={() => openDocPreview(generatedDocs[generatedDocs.length - 1].template)}
                      aria-label="Open document preview"
                    >
                      <PanelRight size={18} strokeWidth={1.8} />
                    </button>
                  )}
                  {messages.length > 0 && (
                    <button onClick={handleClearSession} className="chat-clear-btn" type="button">
                      Clear conversation
                    </button>
                  )}
                  <BackChatLink onClick={() => setAct('about')} />
                </div>
              </div>

              <div ref={scrollRef} className="chat-messages" data-tutorial="doc-generate">
                <div className="chat-turn chat-turn--bot">
                  <DoorGlyph w={28} h={31} panelTop={10} outerR={14} innerR={6} />
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 12, maxWidth: '100%' }}>
                    <div className="chat-bubble chat-bubble--bot">
                      Hi, I&apos;m FounderLex. Tell me what you&apos;re building. I&apos;ll explain the legal basics in plain English, help you figure out which documents you need, and draft them with your details. <span style={{ color: MUTED }}>No legal background needed.</span>
                    </div>
                    {messages.length === 0 && !isLoading && (
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                        {STARTER_SUGGESTIONS.slice(0, 4).map(chip => (
                          <Chip key={chip} label={chip} onSelect={sendMessage} />
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                {messages.map((m, i) => {
                  if (m.role === 'doc-card' && m.template) {
                    const existing = generatedDocs.find(d => d.template === m.template)
                    const multiRecommended = !!m.multiRecommended
                    const quantityReady = !multiRecommended || (draftQuantityTemplate === m.template && draftQuantity !== null)
                    return (
                      <div key={i} className="chat-turn chat-turn--bot chat-turn--card">
                        <DoorGlyph w={20} h={22} panelTop={7} outerR={10} innerR={4} />
                        <div className="chat-doc-flow">
                          {!existing && multiRecommended && (
                            <DraftQuantityPicker
                              template={m.template}
                              selected={draftQuantityTemplate === m.template ? draftQuantity : null}
                              onSelect={q => handleSelectDraftQuantity(m.template!, q)}
                            />
                          )}
                          <DocCard
                            template={m.template}
                            alreadyGenerated={!!existing}
                            quantitySelected={quantityReady || !!existing}
                            onGenerate={() => {
                              if (existing) {
                                document.getElementById(`doc-artifact-${m.template}`)?.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
                              } else if (multiRecommended) {
                                handleStartDraft(m.template!)
                              } else {
                                handleStartSingleDraft(m.template!)
                              }
                            }}
                            onRegenerate={existing ? () => {
                              activeDraftModeRef.current = 'single'
                              handleOpenConfirm(m.template!)
                            } : undefined}
                            generating={generatingTpl === m.template || packLoadingFields}
                          />
                        </div>
                      </div>
                    )
                  }
                  if (m.role === 'doc-artifact' && m.template) {
                    const stored = generatedDocs.find(d => d.template === m.template)
                    const doc: SessionGeneratedDoc | null = stored ?? (m.filled ? {
                      template: m.template,
                      label: TEMPLATE_LABELS[m.template] ?? m.template,
                      filled: m.filled,
                    } : null)
                    if (!doc) return null
                    const inlineFull = m.text === 'inline'
                    return (
                      <div key={i} id={`doc-artifact-${m.template}`} className="chat-turn chat-turn--bot chat-turn--card">
                        <DoorGlyph w={20} h={22} panelTop={7} outerR={10} innerR={4} />
                        <ChatDocumentArtifact
                          doc={doc}
                          inlineFull={inlineFull}
                          onOpenPreview={inlineFull ? undefined : () => openDocPreview(m.template!)}
                          onRegenerate={() => {
                            activeDraftModeRef.current = 'single'
                            handleOpenConfirm(m.template!)
                          }}
                        />
                      </div>
                    )
                  }
                  if (m.role === 'checklist-card' && m.template) {
                    // Same "prefer the live doc, fall back to this
                    // message's own snapshot" precedence as doc-artifact
                    // above, so a checklist next to a since-regenerated
                    // draft reflects the current content, not stale items.
                    const stored = generatedDocs.find(d => d.template === m.template)
                    return (
                      <div key={i} className="chat-turn chat-turn--bot chat-turn--card">
                        <DoorGlyph w={20} h={22} panelTop={7} outerR={10} innerR={4} />
                        <BeforeYouSignChecklist
                          template={m.template}
                          label={TEMPLATE_LABELS[m.template] ?? m.template}
                          filled={stored?.filled ?? m.filled ?? ''}
                        />
                      </div>
                    )
                  }
                  if (m.role === 'redflag-card' && m.flags) {
                    return (
                      <div key={i} className="chat-turn chat-turn--bot chat-turn--card">
                        <DoorGlyph w={20} h={22} panelTop={7} outerR={10} innerR={4} />
                        <RedFlagCard flags={m.flags} />
                      </div>
                    )
                  }
                  if (m.isLoading) return <LoadingBubble key={i} />
                  if (m.role === 'user') {
                    return (
                      <div key={i} className="chat-turn chat-turn--user">
                        <div className="chat-bubble chat-bubble--user">{m.text}</div>
                      </div>
                    )
                  }
                  return (
                    <div key={i} className="chat-turn chat-turn--bot">
                      <DoorGlyph w={20} h={22} panelTop={7} outerR={10} innerR={4} />
                      <div className="chat-bot-content">
                        <BotMessageBubble text={m.text} />
                        <div className="chat-bot-actions">
                          <CitationChip citations={m.citations} />
                          <ReadAloudButton text={m.text} iconOnly className="chat-read-aloud-btn" />
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>

              <div className="chat-input-area">
                <div className="chat-input-bar" data-tutorial="chat-input">
                  <input
                    value={draft}
                    onChange={e => setDraft(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(draft) } }}
                    aria-label="Ask FounderLex a question"
                    placeholder="Describe what you're building, or ask a legal-basics question…"
                    disabled={isLoading}
                  />
                  <MicButton value={draft} onChange={setDraft} disabled={isLoading} />
                  <SendButton onClick={() => sendMessage(draft)} disabled={isLoading || !draft.trim()} />
                </div>
                <p className="chat-input-disclaimer">
                  <ShieldCheck size={12} color={FAINT} strokeWidth={1.6} aria-hidden />
                  Educational, not legal advice. Session saved anonymously — clear anytime.
                </p>
              </div>
            </div>
          </main>

          {/* Right — document preview (desktop) */}
          {showPreviewFixed && (
            <DocPreviewPanel
              docs={generatedDocs}
              selectedTemplate={previewTemplate}
              onSelectTemplate={setPreviewTemplate}
              onClose={closeDocPreview}
              onDownloadAll={handleDownloadAllZip}
              downloadingAll={downloadingAllZip}
            />
          )}
        </div>

        {/* Mobile left drawer */}
        {isMobile && showLeftDrawer && (
          <>
            <div className="chat-drawer-backdrop" onClick={() => setShowLeftDrawer(false)} />
            <div className="chat-drawer chat-drawer--left">
              <div className="chat-drawer__header">
                <span>Sidebar</span>
                <button type="button" className="chat-drawer-close" onClick={() => setShowLeftDrawer(false)} aria-label="Close sidebar">
                  <X size={18} strokeWidth={1.8} />
                </button>
              </div>
              {progressSectionOpen ? (
                <ProgressRail
                  docCount={docCount}
                  onOpenFull={() => { setShowLeftDrawer(false); setShowRoadmap(true) }}
                  onClose={() => setProgressSectionOpen(false)}
                />
              ) : (
                <button type="button" className="chat-rail-reopen" onClick={() => setProgressSectionOpen(true)}>
                  <MapIcon size={14} color={RED} strokeWidth={1.6} /> Your progress
                </button>
              )}
              {toolsSectionOpen ? (
                <ToolsNav tools={chatTools} onClose={() => setToolsSectionOpen(false)} />
              ) : (
                <button type="button" className="chat-rail-reopen" onClick={() => setToolsSectionOpen(true)}>
                  <BookOpen size={14} color={RED} strokeWidth={1.6} /> Optional tools
                </button>
              )}
            </div>
          </>
        )}

        {/* Tablet / mobile preview slide-over */}
        {showPreviewSlideOver && (
          <>
            <div className="chat-drawer-backdrop" onClick={() => setShowPreviewDrawer(false)} />
            <div className="chat-drawer chat-drawer--right">
              <DocPreviewPanel
                docs={generatedDocs}
                selectedTemplate={previewTemplate}
                onSelectTemplate={setPreviewTemplate}
                onClose={closeDocPreview}
                onDownloadAll={handleDownloadAllZip}
                downloadingAll={downloadingAllZip}
                inDrawer
              />
            </div>
          </>
        )}
      </section>

      {showConsent && (
        <ConsentGate
          onAgree={handleConsentAgree}
          onDisagree={handleConsentDisagree}
        />
      )}

      {/* Tour only offered where the persistent left rail exists — mobile's
          drawer-based layout would need its own set of targets, out of
          scope for this pass. */}
      {showTutorialPrompt && isWide && act === 'chat' && (
        <TutorialPrompt onStart={handleTutorialStart} onSkip={handleTutorialSkip} />
      )}

      {tutorialStep !== null && isWide && act === 'chat' && (
        <TutorialTour
          steps={TUTORIAL_STEPS}
          currentStep={tutorialStep}
          onNext={handleTutorialNext}
          onBack={handleTutorialBack}
          onSkip={handleTutorialSkip}
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
