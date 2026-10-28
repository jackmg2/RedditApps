type Child = Node | string | number | null | undefined | false

type Listeners = {[event: string]: (ev: Event) => void}

/** Attributes by name; booleans toggle presence. `on` adds listeners. */
type Props = {
  class?: string
  on?: Listeners
  [attr: string]: string | boolean | undefined | Listeners
}

/**
 * Tiny element builder. Strings become text nodes, so user content is never
 * parsed as HTML (spec §10: textContent, never innerHTML).
 */
export function el<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  props: Props = {},
  ...children: Child[]
): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag)
  for (const [name, value] of Object.entries(props)) {
    if (name === 'on') {
      for (const [ev, fn] of Object.entries(value as Listeners))
        node.addEventListener(ev, fn)
    } else if (name === 'class') node.className = value as string
    else if (value === undefined) continue
    else if (typeof value === 'boolean') {
      if (value) node.setAttribute(name, '')
    } else node.setAttribute(name, String(value))
  }
  append(node, ...children)
  return node
}

export function append(parent: Node, ...children: Child[]): void {
  for (const child of children) {
    if (child === null || child === undefined || child === false) continue
    parent.appendChild(
      child instanceof Node ? child : document.createTextNode(String(child)),
    )
  }
}

export function clear(node: Node): void {
  while (node.firstChild) node.removeChild(node.firstChild)
}

export function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(n < 10240 ? 1 : 0)} KB`
  return `${(n / 1024 / 1024).toFixed(1)} MB`
}

export function formatDate(ms: number): string {
  return new Date(ms).toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  })
}

/** Renders plain text with blank-line paragraphs and "- " bullet lists. */
export function renderPlainText(text: string): DocumentFragment {
  const frag = document.createDocumentFragment()
  for (const block of text.split(/\n\s*\n/)) {
    const lines = block.split('\n').filter(l => l.trim())
    if (!lines.length) continue
    if (lines.every(l => /^\s*[-•]\s/.test(l))) {
      const ul = el('ul')
      for (const l of lines)
        ul.append(el('li', {}, l.replace(/^\s*[-•]\s/, '')))
      frag.append(ul)
    } else frag.append(el('p', {}, lines.join('\n')))
  }
  return frag
}

/** Modal overlay; resolves when closed. `build` gets a close callback. */
export function modal(
  build: (close: () => void) => HTMLElement,
  opts: {dismissable?: boolean} = {},
): Promise<void> {
  return new Promise(resolve => {
    const backdrop = el('div', {class: 'modal-backdrop', role: 'dialog'})
    const close = (): void => {
      backdrop.remove()
      resolve()
    }
    const box = el('div', {class: 'modal'}, build(close))
    backdrop.append(box)
    if (opts.dismissable !== false)
      backdrop.addEventListener('click', ev => {
        if (ev.target === backdrop) close()
      })
    document.body.append(backdrop)
  })
}

export function isTouchDevice(): boolean {
  return (
    matchMedia('(pointer: coarse)').matches ||
    'ontouchstart' in document.documentElement
  )
}
