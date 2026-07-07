// Plain-English, jargon-free starter questions a first-time founder with no
// idea how to "prompt" an AI can pick instead of facing a blank box. Backs
// the empty-chat suggestion chips in app/page.tsx.
//
// Kept in its own zero-import file (not inline in app/page.tsx) so it can be
// imported directly by a plain tsx test script without dragging in the
// client page's full Next/React/browser dependency graph (dynamic(),
// lucide-react, marked, and a dozen component modules) just to read a
// string array.
export const STARTER_SUGGESTIONS: string[] = [
  "Splitting equity with a co-founder",
  "Hiring my first contractor",
  "Do I need an NDA?",
  "Starting a nonprofit",
  "Do I need Terms of Service for my website?",
  "How do I protect my idea?",
  "What's an LLC and do I need one?",
  "Hiring my first employee",
  "Do I need a contract with a freelancer?",
  "Do I need a Privacy Policy?",
]
