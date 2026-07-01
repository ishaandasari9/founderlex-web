export type ConfirmFieldKey = 'company_name' | 'state' | 'structure' | 'description' | 'founders'

export interface ConfirmField {
  key: ConfirmFieldKey
  label: string
  type: 'text' | 'founders'
}

const SCALAR_GROUPS: { key: ConfirmFieldKey; label: string; templateVars: string[] }[] = [
  { key: 'company_name', label: 'Company name', templateVars: ['company_name', 'party_1_name', 'organization_name'] },
  { key: 'state', label: 'State', templateVars: ['state_of_formation', 'governing_state', 'state_of_incorporation'] },
  { key: 'structure', label: 'Business structure', templateVars: ['business_structure'] },
  { key: 'description', label: 'What the company does', templateVars: ['business_description'] },
]

const FOUNDERS_LOOP_RE = /\{%\s*for\s+\w+\s+in\s+founders\s*%\}/

export function getRelevantFields(templateRaw: string): ConfirmField[] {
  const fields: ConfirmField[] = []

  for (const group of SCALAR_GROUPS) {
    const used = group.templateVars.some((v) =>
      new RegExp(`\\{\\{\\s*${v}\\s*\\}\\}`).test(templateRaw),
    )
    if (used) fields.push({ key: group.key, label: group.label, type: 'text' })
  }

  if (FOUNDERS_LOOP_RE.test(templateRaw)) {
    fields.push({ key: 'founders', label: 'Founders', type: 'founders' })
  }

  return fields
}
