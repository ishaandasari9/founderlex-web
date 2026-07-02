// The model doesn't reliably honor "no markdown" instructions over a longer
// structured reply, so strip it in code instead of trusting the prompt.
// Line breaks are preserved (unlike lib/speech.ts's stripper, which collapses
// them for speech pacing) since this text is read on screen, not spoken.
// Originally lived only in lib/explainForm.ts; extracted so other features
// (e.g. live web search) can reuse it instead of re-implementing it.
export function stripMarkdownFormatting(text: string): string {
  return text
    .replace(/\*\*(.+?)\*\*/g, '$1')
    .replace(/\*(.+?)\*/g, '$1')
    .replace(/^#{1,6}\s+/gm, '')
    .replace(/\s*—\s*/g, ', ')
    .replace(/\s*–\s*/g, ', ')
}
