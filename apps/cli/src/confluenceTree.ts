import { createHash } from 'node:crypto'
import { confluenceClient, hasWikiMarker, publishWiki, type Page, type PublishOptions } from './confluence'
import { anchorOf, markerOf, xml, type WikiExport } from './wikiExport'

type Mapping = Record<string, { id: string; title: string; sourceHash?: string; version?: number }>
interface Property { id: string; key: string; version: { number: number }; value: { schema: number; viewId: string; pages: Mapping } }
const PREFIX = 'radical.wiki.pages.'
const digest = (text: string) => createHash('sha256').update(text).digest('hex')
const bucketOf = (id: string) => digest(id)[0]

/** A canonical page for each element; shared scenarios link from every parent. */
export function treePlan(document: WikiExport) {
  const bases = document.pages.map((p) => `${document.title.slice(0, 80)} · ${p.label.slice(0, 150)}`)
  const counts = new Map<string, number>()
  for (const title of bases) counts.set(title, (counts.get(title) ?? 0) + 1)
  const titles = new Map(document.pages.map((p, i) => [p.nodeId, bases[i] + (counts.get(bases[i])! > 1 ? ` (${digest(p.nodeId).slice(0, 8)})` : '')]))
  const anchors = new Map([...titles].map(([id, title]) => [anchorOf(id), title]))
  const pageLink = (nodeId: string): string => `<ac:link><ri:page ri:content-title="${xml(titles.get(nodeId)!)}" /><ac:plain-text-link-body><![CDATA[${document.pages.find((p) => p.nodeId === nodeId)!.label.replace(/]]>/g, ']]]]><![CDATA[>')}]]></ac:plain-text-link-body></ac:link>`
  const nativeLinks = (storage: string): string => storage.replace(/<ac:link ac:anchor="([^"]*)">([\s\S]*?)<\/ac:link>/g, (original, id: string, body: string) => {
    const title = anchors.get(id)
    return title ? `<ac:link><ri:page ri:content-title="${xml(title)}" />${body}</ac:link>` : original
  })
  return {
    landingStorage: nativeLinks(document.landingStorage),
    pages: document.pages.map((p) => ({
      ...p, title: titles.get(p.nodeId)!,
      marker: markerOf(`${document.viewId}:${p.nodeId}`),
      storage: nativeLinks(p.storage) + (p.childIds.length ? `<h2>Pages</h2><ul>${p.childIds.map((id) => `<li>${pageLink(id)}</li>`).join('')}</ul>` : ''),
    })),
  }
}

/** Keeps the mapping in Confluence properties, in small independently versioned buckets. */
export async function publishTree(document: WikiExport, options: PublishOptions, request: typeof fetch = fetch, progress: (message: string) => void = () => {}) {
  const plan = treePlan(document)
  const { api, base } = confluenceClient(options, request)
  const landing = await publishWiki({ ...document, storage: plan.landingStorage }, options, request)
  progress(`Confluence tree: ${landing.url} (${document.elementCount} element pages).`)
  let spaceId = options.spaceId
  if (!spaceId) spaceId = ((await api(`/pages/${landing.id}`)) as Page).spaceId
  if (!spaceId || !/^\d+$/.test(spaceId)) throw new Error('Confluence returned an invalid destination space.')
  const mapping: Mapping = Object.create(null)
  const properties = new Map<string, Property>()
  let next: string | undefined = `/pages/${landing.id}/properties?limit=100`
  const seen = new Set<string>()
  while (next) {
    if (seen.has(next)) throw new Error('Confluence repeated a property-list cursor.')
    seen.add(next)
    const list = await api(next) as { results: Property[]; _links?: { next?: string } }
    if (!Array.isArray(list.results)) throw new Error('Confluence returned an invalid publication mapping.')
    for (const p of list.results) {
      if (!p.key.startsWith(PREFIX)) continue
      if (p.value?.schema !== 1 || p.value.viewId !== document.viewId || !p.value.pages || typeof p.value.pages !== 'object') throw new Error('The publication mapping belongs to a different wiki or has an unsupported format.')
      for (const [id, entry] of Object.entries(p.value.pages)) {
        if (!entry || typeof entry.id !== 'string' || !/^\d+$/.test(entry.id) || typeof entry.title !== 'string' || PREFIX + bucketOf(id) !== p.key) throw new Error('Confluence publication mapping is invalid.')
        mapping[id] = entry
      }
      properties.set(p.key, p)
    }
    next = undefined
    if (list._links?.next) {
      const url = new URL(list._links.next, base)
      if (url.origin !== new URL(base).origin || url.pathname !== `/wiki/api/v2/pages/${landing.id}/properties`) throw new Error('Confluence returned an unexpected mapping pagination URL.')
      next = url.pathname.slice('/wiki/api/v2'.length) + url.search
    }
  }
  const dirty = new Set<string>()
  const checkpoint = async () => {
    for (const key of [...dirty]) {
      const value = { schema: 1, viewId: document.viewId, pages: Object.fromEntries(Object.entries(mapping).filter(([id]) => PREFIX + bucketOf(id) === key)) }
      if (Buffer.byteLength(JSON.stringify(value), 'utf8') > 30_000) throw new Error('A publication mapping bucket exceeds the Confluence property size limit.')
      const previous = properties.get(key)
      const saved = await api(`/pages/${landing.id}/properties${previous ? `/${previous.id}` : ''}`, previous ? 'PUT' : 'POST', {
        key, value, ...(previous ? { version: { number: previous.version.number + 1 } } : {}),
      }) as Property
      if (!saved.id || !Number.isInteger(saved.version?.number)) throw new Error('Confluence did not confirm the saved publication mapping.')
      properties.set(key, saved); dirty.delete(key)
    }
  }
  let created = 0, updated = 0, unchanged = 0, completed = 0
  const pageByNode = new Map(plan.pages.map((p) => [p.nodeId, p]))
  const depthOf = (id: string, trail = new Set<string>()): number => {
    if (trail.has(id)) throw new Error('The exported page hierarchy contains a cycle.')
    trail.add(id)
    const parent = pageByNode.get(id)?.parentNodeId
    return parent ? depthOf(parent, trail) + 1 : 0
  }
  const depths = new Map<number, typeof plan.pages>()
  for (const p of plan.pages) {
    const depth = depthOf(p.nodeId)
    const pages = depths.get(depth) ?? []; pages.push(p); depths.set(depth, pages)
  }
  try {
    for (const [, pages] of [...depths].sort(([a], [b]) => a - b)) {
      for (let at = 0; at < pages.length; at += 32) {
        const batch = pages.slice(at, at + 32)
        // At most four writes in flight; always finish a batch before checkpointing.
        for (let start = 0; start < batch.length; start += 4) {
          const outcomes = await Promise.allSettled(batch.slice(start, start + 4).map(async (page) => {
            const parentId = page.parentNodeId ? mapping[page.parentNodeId]?.id : landing.id
            if (!parentId) throw new Error('An exported parent page has not been published.')
            let id = mapping[page.nodeId]?.id
            // Recover an interrupted create whose checkpoint was not saved.
            if (!id && landing.action !== 'created') {
              const query = new URLSearchParams({ 'space-id': spaceId!, title: page.title, status: 'current', limit: '2' })
              const found = await api(`/pages?${query}`) as { results?: Page[]; _links?: { next?: string } }
              if (!Array.isArray(found.results) || found.results.length > 1 || found._links?.next) throw new Error(`Cannot unambiguously recover page "${page.title}".`)
              id = found.results[0]?.id
            }
            const body = { representation: 'storage', value: page.storage }
            const sourceHash = digest(page.storage)
            let version: number
            if (id) {
              const current = await api(`/pages/${encodeURIComponent(id)}?body-format=storage`) as Page
              if (current.id !== id || current.status !== 'current' || current.spaceId !== spaceId || !Number.isInteger(current.version?.number) || !hasWikiMarker(current.body?.storage?.value ?? '', page.marker)) throw new Error(`Page "${page.title}" is not a managed export of this element. It was not changed.`)
              version = current.version.number
              if (current.title === page.title && current.parentId === parentId && (current.body?.storage?.value === page.storage || (mapping[page.nodeId]?.sourceHash === sourceHash && mapping[page.nodeId]?.version === version))) unchanged++
              else {
                await api(`/pages/${id}`, 'PUT', { id, status: 'current', title: page.title, parentId, body, version: { number: current.version.number + 1, message: 'Published from Radical.' } })
                updated++; version++
              }
            } else {
              const saved = await api('/pages', 'POST', { spaceId, parentId, title: page.title, status: 'current', body }) as Page
              if (typeof saved.id !== 'string' || !/^\d+$/.test(saved.id)) throw new Error('Confluence returned no element page ID. Rerun to recover the publication.')
              id = saved.id; version = saved.version?.number ?? 1; created++
            }
            if (mapping[page.nodeId]?.id !== id || mapping[page.nodeId]?.title !== page.title || mapping[page.nodeId]?.version !== version || mapping[page.nodeId]?.sourceHash !== sourceHash) {
              mapping[page.nodeId] = { id, title: page.title, version, sourceHash }; dirty.add(PREFIX + bucketOf(page.nodeId))
            }
            completed++
          }))
          const failure = outcomes.find((r) => r.status === 'rejected')
          if (failure?.status === 'rejected') throw failure.reason
        }
        await checkpoint()
        progress(`Confluence tree: ${completed}/${plan.pages.length} element pages (${created} created, ${updated} updated, ${unchanged} unchanged).`)
      }
    }
  } catch (error) {
    // Keep successful sibling writes so a rerun can resume. Title+marker lookup
    // also recovers a create if the mapping write itself was interrupted.
    try { await checkpoint() } catch { /* preserve the original error */ }
    throw new Error(`${(error as Error).message} Tree publication stopped at ${completed}/${plan.pages.length}; rerun with --page-id ${landing.id} to resume.`)
  }
  const stale = Object.keys(mapping).filter((id) => !pageByNode.has(id)).length
  if (stale) progress(`Confluence tree: ${stale} previously exported pages are no longer in this view; they were kept.`)
  return { ...landing, created, updated, unchanged, pageCount: plan.pages.length + 1 }
}
