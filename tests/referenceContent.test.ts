// Regression test for the factual accuracy of skill/references/*.md prose
// itself (Codex audit, Low #4). Deterministic, no API calls — reads the
// file directly and checks its wording against the actual statute.
import { readFileSync } from 'fs'
import { join } from 'path'

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

const businessStructures = readFileSync(
  join(process.cwd(), 'skill', 'references', 'business-structures.md'),
  'utf8',
)

// 26 U.S.C. § 83(b)(2): "notified... not later than 30 days after the date
// of such transfer" — the statute's clock starts at TRANSFER, not at
// "grant" (a grant and a transfer are commonly the same moment for founder
// stock, but the reference should track the statute's actual language
// rather than the colloquial "stock grant" phrasing, which reads as if the
// clock started at a boardroom decision rather than the transfer itself).
check(
  /within 30 days after the restricted stock is transferred/i.test(businessStructures),
  'REGRESSION (Codex): the 83(b) deadline sentence uses statute-matching "transfer" wording, not "stock grant"',
)
check(
  !/within 30 days of the stock grant/i.test(businessStructures),
  'the old "within 30 days of the stock grant" phrasing no longer appears',
)

console.log(`\n${failures === 0 ? 'PASS' : 'FAIL'}: ${checks} checks run, ${failures} failed`)
if (failures > 0) process.exit(1)
