type Scope = Record<string, unknown>

const FOR_RE = /\{%\s*for\s+(\w+)\s+in\s+(\w+)\s*%\}([\s\S]*?)\{%\s*endfor\s*%\}/g
const IF_RE = /\{%\s*if\s+(\w+)\s*%\}([\s\S]*?)\{%\s*endif\s*%\}/g
const VAR_RE = /\{\{([\w.]+)\}\}/g

function resolvePath(scope: Scope, path: string): unknown {
  return path.split('.').reduce<unknown>((acc, key) => {
    if (acc && typeof acc === 'object') return (acc as Record<string, unknown>)[key]
    return undefined
  }, scope)
}

function isEmpty(value: unknown): boolean {
  return value === undefined || value === null || value === ''
}

function evalFor(template: string, scope: Scope): string {
  return template.replace(FOR_RE, (_match, loopVar: string, arrayKey: string, inner: string) => {
    const arr = scope[arrayKey]
    if (!Array.isArray(arr)) return ''
    const trimmed = inner.replace(/^\n/, '').replace(/\n$/, '')
    const rendered = arr.map((item) => renderTemplate(trimmed, { ...scope, [loopVar]: item }))
    return rendered.join('\n')
  })
}

function evalIf(template: string, scope: Scope): string {
  return template.replace(IF_RE, (_match, condVar: string, inner: string) => {
    return scope[condVar] ? renderTemplate(inner, scope) : ''
  })
}

function substituteVars(template: string, scope: Scope): string {
  return template.replace(VAR_RE, (_match, path: string) => {
    const value = resolvePath(scope, path)
    if (isEmpty(value)) return `[TO BE COMPLETED: ${path.replace(/[._]/g, ' ')}]`
    return String(value)
  })
}

export function renderTemplate(template: string, scope: Scope): string {
  const afterFor = evalFor(template, scope)
  const afterIf = evalIf(afterFor, scope)
  return substituteVars(afterIf, scope)
}
