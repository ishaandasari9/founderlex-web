// Shared helper for delimiting untrusted content (a pasted document, a
// search query, or any other founder- or third-party-supplied text) from
// developer instructions in a model prompt, so the model has an explicit
// boundary and can be instructed to treat everything inside as data, never
// as instructions. Originally lived only in lib/explainForm.ts as
// wrapUntrustedDocument; generalized here so other features (e.g. live web
// search) can reuse the exact same pattern instead of re-implementing it.
//
// Neutralizes any literal occurrence of the same delimiter tag inside the
// content itself, so untrusted content can't fake an early close and inject
// text the model would treat as outside the delimited block.
export function wrapUntrustedContent(text: string, tag: string): string {
  const neutralized = text.replace(new RegExp(`</?${tag}>`, 'gi'), '[removed matching tag]')
  return `<${tag}>\n${neutralized}\n</${tag}>`
}
