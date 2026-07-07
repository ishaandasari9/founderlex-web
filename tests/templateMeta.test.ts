// Regression test for lib/templateMeta.ts (B2 prereq — consolidated out of
// app/page.tsx so it's usable server-side to resolve
// FounderProfile.recommended_documents into template_name keys).
// Deterministic, no API calls.
import { TEMPLATE_LABELS, TEMPLATE_KEYWORDS, detectTemplate, detectTemplates } from '../lib/templateMeta'
import { TEMPLATE_FILES } from '../lib/generateDocument'

let checks = 0
let failures = 0

function check(condition: boolean, message: string) {
  checks++
  if (condition) {
    console.log(`PASS  ${message}`)
  } else {
    console.log(`FAIL  ${message}`)
    failures++
  }
}

// ── Stays in sync with the 15 templates the generator actually knows about ──
const templateFileKeys = Object.keys(TEMPLATE_FILES).sort()
const labelKeys = Object.keys(TEMPLATE_LABELS).sort()
const keywordKeys = Object.keys(TEMPLATE_KEYWORDS).sort()
check(
  JSON.stringify(labelKeys) === JSON.stringify(templateFileKeys),
  'TEMPLATE_LABELS has exactly one entry per TEMPLATE_FILES key (no drift between the two)',
)
check(
  JSON.stringify(keywordKeys) === JSON.stringify(templateFileKeys),
  'TEMPLATE_KEYWORDS has exactly one entry per TEMPLATE_FILES key (no drift between the two)',
)

// ── detectTemplate: realistic free-text phrasings a chat reply or a
// recommended_documents entry might use ────────────────────────────────────
check(detectTemplate("You'll want a Founders' Agreement to lock in equity.") === 'founders_agreement', 'detects "Founders\' Agreement"')
check(detectTemplate('A Mutual NDA covers this.') === 'mutual_nda', 'detects "Mutual NDA" via "non-disclosure agreement" keyword')
check(detectTemplate('Get a Contractor Agreement in place.') === 'contractor_agreement', 'detects "Contractor Agreement"')
check(detectTemplate('You need Articles of Incorporation first.') === 'nonprofit_articles', 'detects "Articles of Incorporation"')
check(detectTemplate('A Statement of Work locks in scope.') === 'sow_template', 'detects "Statement of Work"')
check(detectTemplate('This is just small talk, nothing document-related.') === null, 'returns null for text mentioning no known template')
check(detectTemplate('') === null, 'returns null for an empty string')

// ── detectTemplates: UI doc-card detection should ignore corrections or
// apologies that mention a document only to say it was the wrong one.
check(
  JSON.stringify(detectTemplates("You're right, my bad, I mentioned a Founders' Agreement but I shouldn't have, since you're the sole founder.")) === '[]',
  'does not surface a card for a corrected-away Founders Agreement mention',
)
check(
  JSON.stringify(detectTemplates("I didn't generate a Founders Agreement for you, and I should not recommend it for a solo founder.")) === '[]',
  'does not surface a card for a negated Founders Agreement mention',
)
check(
  JSON.stringify(detectTemplates("Since you have two co-founders building a product, the Founders' Agreement is your most important first document.")) === JSON.stringify(['founders_agreement']),
  'still surfaces a card for an affirmative Founders Agreement recommendation',
)
// Regression (live Chrome test): an intensifier adverb between the article and
// the ranking word ("your SINGLE most important") used to defeat detection, so
// no Generate card surfaced even though the reply told the user to click one.
check(
  JSON.stringify(detectTemplates("The Founders' Agreement is your single most important early document because it locks in the 50/50 split and vesting.")) === JSON.stringify(['founders_agreement']),
  'surfaces a card when an intensifier ("single") sits before the ranking word',
)
check(
  JSON.stringify(detectTemplates("The Mutual NDA is the absolute first thing you should set up before those conversations.")) === JSON.stringify(['mutual_nda']),
  'surfaces a card for "the absolute first thing" intensifier phrasing',
)
// Regression (live nonprofit flow): multi-document recommendations list the
// docs after a cue ("the three documents you need: X, Y, Z"), which the
// adjacency patterns missed entirely, so NO card surfaced and the user
// couldn't generate anything.
check(
  JSON.stringify(detectTemplates("Perfect. I'm going to recommend the three documents you need to get started: Articles of Incorporation, Nonprofit Bylaws, and Conflict of Interest Policy. These are starter templates FounderLex will generate for you.")) === JSON.stringify(['nonprofit_articles', 'nonprofit_bylaws', 'nonprofit_conflict_of_interest']),
  'surfaces a card for every doc in a list-style multi-document recommendation',
)
check(
  JSON.stringify(detectTemplates("For getting started, you need three key documents: Articles of Incorporation, Bylaws, and a Conflict of Interest Policy. Would you like me to generate them?")) === '[]',
  'does NOT surface cards while the list-style recommendation is still a question',
)
// Regression (second live nonprofit reply): "you need to start with ... : X, and
// Y ... you'll also need Z", with "Bylaws" written bare (not "Nonprofit Bylaws").
check(
  JSON.stringify(detectTemplates("You need to start with two state-level documents before the IRS stuff comes in: Articles of Incorporation, which you file with your state, and Bylaws, which are your internal operating rules. Once those are in place, you'll also need a Conflict of Interest Policy because the IRS looks for that on the 501c3 application.")) === JSON.stringify(['nonprofit_articles', 'nonprofit_bylaws', 'nonprofit_conflict_of_interest']),
  'surfaces all three cards for a bare-"Bylaws" nonprofit recommendation phrased as "you need ... you will also need"',
)
check(
  JSON.stringify(detectTemplates("Once your LLC is formed, we can also help you draft starter documents like Terms of Service and a Privacy Policy if you're collecting customer data, or a Founders' Agreement if you bring on co-founders later.")) === '[]',
  'does not surface a card for future hypothetical document mentions',
)
check(
  JSON.stringify(detectTemplates("What I can help with is explaining what you need to think about as you're setting up, like whether you have IP to protect, if you'll be sharing confidential info with clients before contracts are signed, or if you need terms of service for the websites you're selling.")) === '[]',
  'does not surface a card for exploratory follow-up topic menus',
)
check(
  JSON.stringify(detectTemplates("Once your LLC is formed, I can help you with the contracts and policies that matter for your business, like terms of service for your clients, any confidentiality agreements if you're sharing your process or tools, or client service contracts.")) === '[]',
  'does not surface a card for broad post-formation topic menus',
)
check(
  JSON.stringify(detectTemplates('To point you to the right document, are you collecting customer data, hiring someone, or just trying to understand LLC formation first?')) === '[]',
  'does not surface a card while the assistant is still asking clarifying questions',
)
check(
  JSON.stringify(detectTemplates('Since you collect customer data and sell directly through the site, Terms of Service is a foundational document for your current situation.')) === JSON.stringify(['terms_of_service']),
  'surfaces a card for an explicit current Terms of Service recommendation',
)

console.log(`\n${failures === 0 ? 'PASS' : 'FAIL'}: ${checks} checks run, ${failures} failed`)
if (failures > 0) process.exit(1)
