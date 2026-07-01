import { renderTemplate } from '../lib/renderTemplate'

interface Case {
  name: string
  template: string
  scope: Record<string, unknown>
  expected: string
}

const cases: Case[] = [
  {
    name: 'plain var substitution',
    template: 'Hello {{name}}.',
    scope: { name: 'Alex' },
    expected: 'Hello Alex.',
  },
  {
    name: 'unknown var falls back to TO BE COMPLETED placeholder',
    template: 'State: {{state}}.',
    scope: {},
    expected: 'State: [TO BE COMPLETED: state].',
  },
  {
    name: 'if block renders when true',
    template: 'A{% if flag %} and B{% endif %}.',
    scope: { flag: true },
    expected: 'A and B.',
  },
  {
    name: 'if block is stripped when false',
    template: 'A{% if flag %} and B{% endif %}.',
    scope: { flag: false },
    expected: 'A.',
  },
  {
    name: 'for loop over 2 items',
    template: '{% for founder in founders %}\n- {{founder.name}}\n{% endfor %}',
    scope: { founders: [{ name: 'Alex' }, { name: 'Bri' }] },
    expected: '- Alex\n- Bri',
  },
  {
    name: 'for loop over 3 items renders 3, not 2',
    template: '{% for founder in founders %}\n- {{founder.name}}: {{founder.equity_pct}}%\n{% endfor %}',
    scope: {
      founders: [
        { name: 'Alex', equity_pct: 33.3 },
        { name: 'Bri', equity_pct: 33.3 },
        { name: 'Cass', equity_pct: 33.3 },
      ],
    },
    expected: '- Alex: 33.3%\n- Bri: 33.3%\n- Cass: 33.3%',
  },
  {
    name: 'for loop directly followed by a table row does not insert a blank line (would break Markdown table parsing)',
    template: '| Founder |\n|---|\n{% for founder in founders %}\n| {{founder.name}} |\n{% endfor %}',
    scope: { founders: [{ name: 'Alex' }, { name: 'Bri' }, { name: 'Cass' }] },
    expected: '| Founder |\n|---|\n| Alex |\n| Bri |\n| Cass |',
  },
  {
    name: 'no leaked tags when combining for + if (founders-agreement equity section shape)',
    template: [
      '{% for founder in founders %}',
      '- **{{founder.name}}:** {{founder.equity_pct}}%',
      '{% endfor %}',
      '{% if equal_equity %}',
      '> Equal split note.',
      '{% endif %}',
    ].join('\n'),
    scope: {
      founders: [
        { name: 'Alex', equity_pct: 33.3 },
        { name: 'Bri', equity_pct: 33.3 },
        { name: 'Cass', equity_pct: 33.3 },
      ],
      equal_equity: true,
    },
    expected: [
      '- **Alex:** 33.3%',
      '- **Bri:** 33.3%',
      '- **Cass:** 33.3%',
      '',
      '> Equal split note.',
      '',
    ].join('\n'),
  },
]

let failures = 0

for (const c of cases) {
  const actual = renderTemplate(c.template, c.scope)
  const hasLeakedTags = /\{%|%\}|\{\{|\}\}/.test(actual)
  const pass = actual === c.expected && !hasLeakedTags

  if (pass) {
    console.log(`PASS  ${c.name}`)
  } else {
    failures++
    console.log(`FAIL  ${c.name}`)
    console.log(`      expected: ${JSON.stringify(c.expected)}`)
    console.log(`      got:      ${JSON.stringify(actual)}`)
  }
}

console.log(`\n${cases.length - failures}/${cases.length} passed`)
if (failures > 0) process.exit(1)
