// Meta / product questions about FounderLex itself — "what can you do?",
// "are you free?", "what documents do you make?", "are you a lawyer?" — are
// not legal-safety claims. There is nothing for the A2 runtime verifier to
// check in "FounderLex drafts 15 starter documents and is free to use," yet
// such an answer used to be routed through the verifier anyway (its draft is
// long and names documents, so isSmallTalkDraft returns false). That meant a
// verifier timeout or a malformed verifier verdict (both fail closed, by
// design) could replace a perfectly good product answer with the safety
// fallback — i.e. the tool refusing to say what it does. That's the
// meta-question "refusal" bug.
//
// This detector marks a message as a clear product/meta question so
// lib/chat.ts can skip the verifier for it (same treatment small talk gets)
// and answer directly. Layers that still run: the out-of-scope guard
// (lib/outOfScopeGuard.ts) runs FIRST, before any of this, so a criminal /
// dispute / securities / immigration / tax message is still intercepted; and
// the layer-4 forbidden-assertion backstop (finalizeChatResponse) still runs
// AFTER, so an answer that somehow asserts a legal-safety verdict is still
// caught. Only the middle verifier layer is skipped, and only for a message
// that is unambiguously about the product.
//
// Deliberately conservative in two ways so it can never swallow a real legal
// question:
//   1. Every pattern is tool-referential ("do YOU", "are YOU", "does THIS
//      /IT/FOUNDERLEX") — "what documents do I need for a contractor?" is a
//      legal question and does NOT match, while "what documents do you make?"
//      does.
//   2. A length cap: genuine meta questions are short. A long message that
//      happens to contain a meta-ish phrase plus a substantive legal ask
//      falls through to the normal grounded+verified pipeline.

const META_MAX_CHARS = 80

const META_PATTERNS: RegExp[] = [
  // Capability — "what can you do", "what do you make/draft/help with"
  /\bwhat (?:can|do) you (?:do|make|draft|generate|create|help|offer|provide|produce)\b/i,
  /\b(?:what|how) can you help\b/i,
  // Document/template catalog — tool-referential ("do you"), never "do I"
  /\bwhat (?:documents|docs|templates|kinds? of documents|types? of documents|sort of documents) (?:do|can) you\b/i,
  /\bhow many (?:documents|docs|templates) (?:do|can) you\b/i,
  /\bwhich (?:documents|docs|templates) (?:do|can) you\b/i,
  // Identity / what-is
  /\bwhat (?:are you|is this|is founderlex)\b/i,
  /\bwhat(?:'s| is) founderlex\b/i,
  /\bwho are you\b/i,
  /\bare you an? (?:ai|bot|human|real person|lawyer|attorney)\b/i,
  /\bare you a (?:real )?(?:lawyer|attorney)\b/i,
  /\bwho (?:made|built|created) you\b/i,
  // How it works
  /\bhow (?:do|does) (?:you|this|it|founderlex) work\b/i,
  // Pricing. Bare "is it free" is intentionally excluded — "it" is ambiguous
  // ("is an EIN free, is IT free?" is a legal fact question, not a product
  // one). "is this free" / "are you free" / "is founderlex free" / "is it
  // free to use" are unambiguously about the tool.
  /\b(?:are you|is this|is founderlex) free\b/i,
  /\bis it free to use\b/i,
  /\bhow much (?:do|does) (?:you|this|founderlex) cost\b/i,
  /\bis there (?:a|any) (?:cost|fee|charge)\b/i,
  /\bdo i (?:have to |need to )?pay\b/i,
  /\bwhat(?:'s| is) the (?:cost|price|pricing)\b/i,
  /\bis it free to use\b/i,
]

export function isMetaProductQuestion(message: string): boolean {
  const trimmed = message.trim()
  if (!trimmed || trimmed.length > META_MAX_CHARS) return false
  return META_PATTERNS.some((p) => p.test(trimmed))
}
