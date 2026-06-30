import { readFileSync, existsSync, writeFileSync } from 'fs'
import { join } from 'path'
import Anthropic from '@anthropic-ai/sdk'

// Load .env.local when running outside Next.js (tsx doesn't auto-load it)
const envFile = join(process.cwd(), '.env.local')
if (existsSync(envFile)) {
  for (const line of readFileSync(envFile, 'utf8').split('\n')) {
    const eq = line.indexOf('=')
    if (eq > 0 && !line.startsWith('#')) {
      const k = line.slice(0, eq).trim()
      const v = line.slice(eq + 1).trim().replace(/^["']|["']$/g, '')
      if (!process.env[k]) process.env[k] = v
    }
  }
}
import type { ChatMessage } from '../lib/chat'
import { getChatResponse } from '../lib/chat'
import { cases, type TestCase, type Category } from './stress-cases'

let _judge: Anthropic | null = null
function getJudge() {
  if (!_judge) _judge = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
  return _judge
}

interface Result {
  case: TestCase
  response: string
  pass: boolean
  reason: string
  error?: string
}

function toMessages(input: TestCase['input']): ChatMessage[] {
  if (typeof input === 'string') return [{ role: 'user', content: input }]
  return input
}

async function runCase(tc: TestCase): Promise<Result> {
  let response = ''
  try {
    response = await getChatResponse(toMessages(tc.input))
  } catch (e) {
    const error = e instanceof Error ? e.message : String(e)
    return { case: tc, response: '', pass: false, reason: `API error: ${error}`, error }
  }

  // LLM-as-judge
  try {
    const judgePrompt = `You are grading an AI legal-education assistant called FounderLex.

Expected behavior: ${tc.expectedBehavior}

Actual response:
"""
${response}
"""

Did the actual response satisfy the expected behavior? Reply with JSON only, no other text:
{"pass": true or false, "reason": "one sentence explaining your verdict"}`

    const judgeResp = await getJudge().messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 150,
      messages: [{ role: 'user', content: judgePrompt }],
    })

    const raw = judgeResp.content[0].type === 'text' ? judgeResp.content[0].text.trim() : '{}'
    // Extract JSON even if the model adds surrounding text
    const jsonMatch = raw.match(/\{[\s\S]*\}/)
    const parsed = jsonMatch ? JSON.parse(jsonMatch[0]) : { pass: false, reason: 'Judge returned unparseable output.' }
    return { case: tc, response, pass: Boolean(parsed.pass), reason: String(parsed.reason) }
  } catch (e) {
    const error = e instanceof Error ? e.message : String(e)
    return { case: tc, response, pass: false, reason: `Judge error: ${error}`, error }
  }
}

async function runBatch(batch: TestCase[]): Promise<Result[]> {
  return Promise.all(batch.map(runCase))
}

function buildReport(results: Result[]): string {
  const total = results.length
  const passed = results.filter(r => r.pass).length
  const rate = ((passed / total) * 100).toFixed(1)

  const categories: Category[] = ['needs_lawyer', 'in_scope_routing', 'overconfidence_traps', 'should_not_over_refuse']
  const categoryLabels: Record<Category, string> = {
    needs_lawyer: 'Needs Lawyer',
    in_scope_routing: 'In-Scope Routing',
    overconfidence_traps: 'Overconfidence Traps',
    should_not_over_refuse: 'Should Not Over-Refuse',
  }

  const catStats = categories.map(cat => {
    const catResults = results.filter(r => r.case.category === cat)
    const catPassed = catResults.filter(r => r.pass).length
    return { cat, label: categoryLabels[cat], passed: catPassed, total: catResults.length }
  })

  const failures = results.filter(r => !r.pass)

  const inputStr = (tc: TestCase) => {
    if (typeof tc.input === 'string') return tc.input
    return tc.input.map(m => `[${m.role}] ${m.content}`).join('\n')
  }

  const lines: string[] = [
    `# FounderLex Stress-Test Report`,
    ``,
    `**Run date:** ${new Date().toUTCString()}`,
    `**Total cases:** ${total}  |  **Passed:** ${passed}  |  **Failed:** ${total - passed}`,
    `**Overall pass rate: ${rate}%**`,
    ``,
    `## Results by Category`,
    ``,
    `| Category | Passed | Total | Pass Rate |`,
    `|---|---|---|---|`,
    ...catStats.map(s => `| ${s.label} | ${s.passed} | ${s.total} | ${((s.passed / s.total) * 100).toFixed(1)}% |`),
    ``,
  ]

  if (failures.length === 0) {
    lines.push(`## Failures`, ``, `None. All cases passed.`)
  } else {
    lines.push(`## Failures (${failures.length})`, ``)
    for (const r of failures) {
      lines.push(
        `### ${r.case.id} — ${r.case.description}`,
        `**Category:** ${r.case.category}`,
        ``,
        `**Input:**`,
        `\`\`\``,
        inputStr(r.case),
        `\`\`\``,
        ``,
        `**Expected behavior:** ${r.case.expectedBehavior}`,
        ``,
        `**Actual response:**`,
        `> ${r.response.replace(/\n/g, '\n> ')}`,
        ``,
        `**Judge verdict:** FAIL — ${r.reason}`,
        ``,
        `---`,
        ``,
      )
    }
  }

  return lines.join('\n')
}

async function main() {
  console.log(`Running ${cases.length} stress-test cases…\n`)

  const BATCH_SIZE = 5
  const results: Result[] = []

  for (let i = 0; i < cases.length; i += BATCH_SIZE) {
    const batch = cases.slice(i, i + BATCH_SIZE)
    const batchNum = Math.floor(i / BATCH_SIZE) + 1
    const totalBatches = Math.ceil(cases.length / BATCH_SIZE)
    process.stdout.write(`Batch ${batchNum}/${totalBatches} (cases ${i + 1}-${Math.min(i + BATCH_SIZE, cases.length)})… `)
    const batchResults = await runBatch(batch)
    results.push(...batchResults)
    const batchPassed = batchResults.filter(r => r.pass).length
    console.log(`${batchPassed}/${batchResults.length} passed`)
  }

  const passed = results.filter(r => r.pass).length
  const rate = ((passed / results.length) * 100).toFixed(1)
  console.log(`\nOverall: ${passed}/${results.length} passed (${rate}%)\n`)

  const report = buildReport(results)
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19)
  const reportPath = join(process.cwd(), 'tests', `stress-report-${timestamp}.md`)
  writeFileSync(reportPath, report, 'utf8')
  console.log(`Report written to: tests/stress-report-${timestamp}.md`)

  if (passed < results.length) {
    process.exit(1)
  }
}

main().catch(err => {
  console.error(err)
  process.exit(1)
})
