import { decodeEntity } from 'markdown-to-jsx/entities'
import { compiler, RuleType } from 'markdown-to-jsx/html'

const escape = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
const safeLink = (s: string) => { try { const u = new URL(s); return ['https:', 'http:'].includes(u.protocol) && !u.username && !u.password } catch { return false } }
const decode = (s: string): string => {
  if (/&(?!(?:#x[0-9a-f]+|#\d+|[a-z][a-z0-9]+);)/i.test(s)) throw new Error('Unsupported entity')
  return s.replace(/&(#x[0-9a-f]+|#\d+|[a-z][a-z0-9]+);/gi, (_, entity: string) => {
    if (entity.startsWith('#')) {
      const code = entity[1].toLowerCase() === 'x' ? parseInt(entity.slice(2), 16) : Number(entity.slice(1))
      if (!Number.isInteger(code) || code <= 0 || code > 0x10ffff || (code >= 0xd800 && code <= 0xdfff)) throw new Error('Invalid character reference')
      return String.fromCodePoint(code)
    }
    const decoded = decodeEntity(entity)
    if (decoded === undefined) throw new Error('Unsupported entity')
    return decoded
  })
}
const mdText = (s: string) => s.replace(/[\\`*_{}\[\]()#+.!|<>~\-]/g, '\\$&')

/** Deliberately small subset. Unsupported bodies are held with their source link. */
export function storageToMarkdown(storage: string): string {
  const stack: Array<{ tag: string; href?: string }> = []
  let out = ''
  const tokens = storage.match(/<[^>]*>|[^<]+/g) ?? []
  if (tokens.join('') !== storage) throw new Error('Malformed content')
  for (const token of tokens) {
    if (!token.startsWith('<')) {
      const text = decode(token)
      if (stack.some((s) => s.tag === 'code')) { if (text.includes('`') || text.includes('\n')) throw new Error('Unsupported code'); out += text }
      else out += mdText(text)
      continue
    }
    if (/^<br\s*\/?\s*>$/i.test(token)) { out += '  \n'; continue }
    const match = /^<(\/)?(p|strong|b|em|i|code|a)([^>]*)>$/i.exec(token)
    if (!match) throw new Error('Unsupported content')
    const [, closing, rawTag, attrs] = match, tag = rawTag.toLowerCase()
    if (closing) {
      if (attrs.trim() || stack.at(-1)?.tag !== tag) throw new Error('Malformed content')
      const top = stack.pop()!
      out += tag === 'p' ? '\n\n' : ['strong', 'b'].includes(tag) ? '**' : ['em', 'i'].includes(tag) ? '*' : tag === 'code' ? '`' : `](${top.href})`
    } else {
      if (stack.some((s) => s.tag === 'code' || (tag === 'a' && s.tag === 'a'))) throw new Error('Unsupported nesting')
      let href: string | undefined
      if (tag === 'a') {
        const attribute = /^\s+href=(?:"([^"]*)"|'([^']*)')\s*$/.exec(attrs)
        href = attribute ? decode(attribute[1] ?? attribute[2]) : undefined
        if (!href || !safeLink(href) || /[\s()\\]/.test(href)) throw new Error('Unsafe or unsupported link')
      } else if (attrs.trim() && !(tag === 'p' && /^\s+local-id=(?:"[a-z0-9-]{1,128}"|'[a-z0-9-]{1,128}')\s*$/i.test(attrs))) throw new Error('Unsupported attributes')
      stack.push({ tag, href })
      out += tag === 'p' ? '' : ['strong', 'b'].includes(tag) ? '**' : ['em', 'i'].includes(tag) ? '*' : tag === 'code' ? '`' : '['
    }
  }
  if (stack.length || !out.trim() || storage.includes('<') && !storage.match(/<[^>]*>/)) throw new Error('Empty or malformed content')
  return out.trim()
}
export function markdownToStorage(source: string): string {
  if (!source.trim() || /[\u0000-\u0008\u000b\u000c\u000e-\u001f]/.test(source)) throw new Error('Unsupported empty or control content')
  const allowed = new Set<number>([RuleType.text, RuleType.paragraph, RuleType.breakLine, RuleType.textFormatted, RuleType.codeInline, RuleType.link])
  const result = compiler(source, { wrapper: null, forceBlock: true, disableParsingRawHTML: false, disableFrontmatter: true,
    renderRule(next, node, children) {
      if (!allowed.has(node.type)) throw new Error('Unsupported Markdown; use paragraphs, bold, italic, inline code and HTTP(S) links')
      if (node.type === RuleType.link) {
        if (!node.target || !safeLink(node.target)) throw new Error('Unsupported link')
        return `<a href="${escape(node.target)}">${children(node.children)}</a>`
      }
      return next()
    } })
  // Verify the emitted subset, including formatting variants the parser may add.
  storageToMarkdown(result)
  return result
}
