import { compiler, RuleType } from 'markdown-to-jsx/html'
import { type DiagramData, type DiagramView } from '@radical/common/c4'
import { type ChainRow } from '@radical/common/viewPipeline'
import { createWikiDocument, type WikiField, type WikiPage as DocumentPage } from '@radical/common/wikiDocument'
import { documentMetamodel } from '@radical/common/model'
import { escapeMarkdown, keepLineBreaks } from '@radical/common/markdown'

export interface WikiExport {
  title: string
  viewId: string
  marker: string
  markdown: string
  storage: string
  html: string
  elementCount: number
  warnings: string[]
  pages: WikiPage[]
  landingStorage: string
}

export interface WikiPage { nodeId: string; label: string; parentNodeId?: string; childIds: string[]; storage: string }

export const xml = (value: string): string => value
  .replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, '')
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;').replace(/'/g, '&#39;')

export const anchorOf = (id: string): string => `radical-${Buffer.from(id).toString('hex')}`
export const markerOf = (viewId: string): string => `radical-wiki-${Buffer.from(viewId).toString('hex')}`
export const anchor = (id: string): string => `<ac:structured-macro ac:name="anchor" ac:schema-version="1"><ac:parameter ac:name="">${xml(id)}</ac:parameter></ac:structured-macro>`
const anchorLink = (id: string, label: string): string => `<ac:link ac:anchor="${xml(id)}"><ac:plain-text-link-body><![CDATA[${label.replace(/]]>/g, ']]]]><![CDATA[>')}]]></ac:plain-text-link-body></ac:link>`

/** Render Markdown with the same parser as the wiki, without accepting raw HTML. */
function renderMarkdown(source: string, warnings: Set<string>, headingLevel: number): string {
  return compiler(keepLineBreaks(source), {
    disableParsingRawHTML: true, disableFrontmatter: true, wrapper: null,
    sanitizer: (url) => /^(https?:\/\/|mailto:|#)/i.test(url) ? url : null,
    renderRule(next, node, children) {
      if (node.type === RuleType.heading) {
        const level = Math.min(6, headingLevel + node.level)
        return `<h${level}>${children(node.children)}</h${level}>`
      }
      if (node.type === RuleType.link) {
        if (node.target?.startsWith('#radical-')) return anchorLink(node.target.slice(1), node.children.map((c) => c.type === RuleType.text ? c.text : '').join('') || node.target.slice(1))
        if (!node.target) warnings.add('Relative or unsupported Markdown links were rendered as text. Use absolute https links.')
      }
      if (node.type === RuleType.image) {
        if (node.target && /^https?:\/\//i.test(node.target)) return `<ac:image ac:alt="${xml(node.alt ?? '')}"><ri:url ri:value="${xml(node.target)}" /></ac:image>`
        warnings.add('Local or unsupported images were not uploaded. Use an absolute https image URL.')
        return xml(node.alt ?? '(image unavailable)')
      }
      if (node.type === RuleType.gfmTask) return node.completed ? '[x] ' : '[ ] '
      return next()
    },
  })
}

/** Complete wiki projection: focus and interactive reading depth do not truncate an export. */
export function exportWiki(data: DiagramData, view: DiagramView, options: { title?: string; sourceUrl?: string } = {}): WikiExport {
  if (view.kind !== 'wiki') throw new Error(`View "${view.name}" is not a wiki.`)
  const nodes = Object.fromEntries(data.nodes.map((n) => [n.id, n]))
  const wiki = createWikiDocument(view, {
    nodes, relations: Object.fromEntries(data.relations.map((r) => [r.id, r])),
    metamodel: documentMetamodel(data.metamodel, data.nodes),
  })
  const rows = wiki.rows
  const included = new Set(wiki.nodeList.map((n) => n.id))
  const link = (id: string): string => {
    const label = nodes[id]?.label ?? id
    return included.has(id) ? `[${escapeMarkdown(label)}](#${anchorOf(id)})` : escapeMarkdown(label)
  }
  const warnings = new Set<string>()
  const fieldValue = (field: WikiField): string => field.references.length
    ? field.references.map((ref) => link(ref.id)).join(', ')
    : field.markdown ? field.text : escapeMarkdown(field.text)
  const pageMarkdown = (page: DocumentPage): string => {
    const content = [`**${escapeMarkdown(page.typeLabel)}**`]
    for (const field of page.facts) if (field.text) content.push(`**${escapeMarkdown(field.title)}**\n\n${fieldValue(field)}`)
    for (const block of page.blocks) {
      switch (block.kind) {
        case 'lead':
          if (block.field.text) content.push(fieldValue(block.field))
          break
        case 'requirement':
          if (block.requirement.started) content.push(escapeMarkdown(block.requirement.sentence))
          break
        case 'section':
          if (block.field.text) content.push(`**${escapeMarkdown(block.field.title)}**\n\n${fieldValue(block.field)}`)
          break
        case 'relations':
          for (const group of block.groups) content.push(`**${escapeMarkdown(group.label)}${group.label.endsWith(':') ? '' : ':'}** ${group.entries.map(({ relation, other, details }) => {
            const id = group.direction === 'out' ? relation.targetId : relation.sourceId
            return `${other ? link(id) : '(missing)'}${details.length ? ` (${escapeMarkdown(details.join(', '))})` : ''}`
          }).join(', ')}.`)
          break
        case 'wireframe':
          warnings.add('Interactive mockup wireframes are not exported; the element fields are included.')
          break
        case 'contents': break // The export has a document-wide contents list.
        case 'children': break // Rendered as chapters or native child-page links.
      }
    }
    return content.join('\n\n')
  }
  const title = options.title ?? view.name
  const marker = markerOf(view.id)
  const notice = `Generated from Radical. Radical is the source of truth. Edit the model in Radical; publishing again replaces this page's generated content.`
  const source = options.sourceUrl ? `[Open source](${options.sourceUrl})` : ''
  const intro = `${notice}${source ? `\n\n${source}` : ''}`
  const md = [`# ${escapeMarkdown(title)}`, intro, '## Contents']
  const storage = [anchor(marker), renderMarkdown(intro, warnings, 1)]
  const firstRows: ChainRow[] = []
  const listed = new Set<string>()
  for (const row of rows) if (!listed.has(row.node.id)) { listed.add(row.node.id); firstRows.push(row) }
  md.push(firstRows.map((row) => `${'  '.repeat(row.depth)}- ${link(row.node.id)}`).join('\n'))
  type TocItem = { row: ChainRow; children: TocItem[] }
  const toc: TocItem[] = [], stack: TocItem[] = []
  for (const row of firstRows) {
    while (stack.length && stack[stack.length - 1].row.depth >= row.depth) stack.pop()
    const item: TocItem = { row, children: [] }
    ;(stack.length ? stack[stack.length - 1].children : toc).push(item)
    stack.push(item)
  }
  const tocHtml = (items: TocItem[]): string => items.length ? `<ul>${items.map(({ row, children }) => `<li>${anchorLink(anchorOf(row.node.id), row.node.label)}${tocHtml(children)}</li>`).join('')}</ul>` : ''
  if (toc.length) storage.push(`<ac:structured-macro ac:name="expand" ac:schema-version="1"><ac:parameter ac:name="title">Contents (${included.size} elements)</ac:parameter><ac:rich-text-body>${tocHtml(toc)}</ac:rich-text-body></ac:structured-macro>`)
  if (!rows.length) { md.push('No elements in this wiki view.'); storage.push('<p>No elements in this wiki view.</p>') }
  const landingStorage = storage.join('\n')
  const pages: WikiPage[] = [], ancestors: string[] = []
  const rendered = new Set<string>()
  for (const { node, depth } of rows) {
    ancestors.length = depth
    const parentNodeId = ancestors[depth - 1]
    ancestors[depth] = node.id
    const level = Math.min(6, depth + 2)
    if (rendered.has(node.id)) {
      md.push(`${'#'.repeat(level)} ${escapeMarkdown(node.label)}`, `See ${link(node.id)}.`)
      storage.push(`<h${level}>${xml(node.label)}</h${level}><p>See ${anchorLink(anchorOf(node.id), node.label)}.</p>`)
      continue
    }
    rendered.add(node.id)
    md.push(`<a id="${anchorOf(node.id)}"></a>`, `${'#'.repeat(level)} ${escapeMarkdown(node.label)}`)
    storage.push(anchor(anchorOf(node.id)), `<h${level}>${xml(node.label)}</h${level}>`)
    const page = wiki.page(node.id)
    const body = pageMarkdown(wiki.page(node.id, parentNodeId))
    pages.push({ nodeId: node.id, label: node.label, parentNodeId, childIds: [...new Set(page.children.map((n) => n.id))], storage: `${anchor(markerOf(`${view.id}:${node.id}`))}\n${renderMarkdown(intro, warnings, 1)}\n${renderMarkdown(pageMarkdown(page), warnings, 1)}` })
    md.push(body)
    storage.push(renderMarkdown(body, warnings, level))
  }
  const body = storage.join('\n')
  // The preview uses ordinary anchors/images instead of Confluence XML macros.
  const preview = body
    .replace(/<ac:structured-macro ac:name="expand"[^>]*><ac:parameter ac:name="title">([^<]*)<\/ac:parameter><ac:rich-text-body>([\s\S]*?)<\/ac:rich-text-body><\/ac:structured-macro>/g, '<details><summary>$1</summary>$2</details>')
    .replace(/<ac:structured-macro ac:name="anchor"[^>]*><ac:parameter ac:name="">([^<]*)<\/ac:parameter><\/ac:structured-macro>/g, '<a id="$1"></a>')
    .replace(/<ac:link ac:anchor="([^"]*)"><ac:plain-text-link-body><!\[CDATA\[([\s\S]*?)\]\]><\/ac:plain-text-link-body><\/ac:link>/g, (_, id: string, label: string) => `<a href="#${id}">${xml(label.replace(/\]\]\]\]><!\[CDATA\[>/g, ']]>'))}</a>`)
    .replace(/<ac:image ac:alt="([^"]*)"><ri:url ri:value="([^"]*)" \/><\/ac:image>/g, '<img alt="$1" src="$2" />')
  return {
    title, viewId: view.id, marker, elementCount: included.size, markdown: md.join('\n\n') + '\n', storage: body,
    html: `<!doctype html><html lang="en"><head><meta charset="utf-8"/><title>${xml(title)}</title><style>body{max-width:960px;margin:48px auto;padding:0 24px;font:16px/1.65 system-ui;color:#172b4d}h1,h2,h3,h4{line-height:1.25;margin-top:2em}a{color:#075bcc}pre{overflow:auto;padding:16px;background:#f4f5f7}table{border-collapse:collapse}td,th{border:1px solid #ddd;padding:8px}img{max-width:100%}</style></head><body><h1>${xml(title)}</h1>${preview}</body></html>`,
    warnings: [...warnings], pages, landingStorage,
  }
}
