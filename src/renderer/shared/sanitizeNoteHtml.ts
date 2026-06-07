const ALLOWED_TAGS = new Set(['B', 'STRONG', 'I', 'EM', 'U', 'BR', 'DIV', 'P', 'SPAN'])

function clean(node: Node) {
  const children = Array.from(node.childNodes)
  for (const child of children) {
    if (child.nodeType === Node.ELEMENT_NODE) {
      const el = child as HTMLElement
      clean(el)
      if (ALLOWED_TAGS.has(el.tagName)) {
        while (el.attributes.length) el.removeAttribute(el.attributes[0].name)
      } else {
        while (el.firstChild) el.parentNode?.insertBefore(el.firstChild, el)
        el.parentNode?.removeChild(el)
      }
    } else if (child.nodeType !== Node.TEXT_NODE) {
      node.removeChild(child)
    }
  }
}

// Restricts note HTML to a small inline-formatting whitelist (bold/italic/underline + line breaks)
// before it's rendered with dangerouslySetInnerHTML on the projector.
export function sanitizeNoteHtml(html: string): string {
  const doc = new DOMParser().parseFromString(html, 'text/html')
  clean(doc.body)
  return doc.body.innerHTML
}

export function noteHtmlToPlainText(html: string): string {
  const doc = new DOMParser().parseFromString(html, 'text/html')
  return doc.body.textContent ?? ''
}
