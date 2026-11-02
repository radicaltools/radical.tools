import { setTimeout as delay } from 'node:timers/promises'
import { confluenceBase, type PublishOptions } from './confluence'

export interface FooterComment {
  authorId?: string; createdAt?: string
  id: string; pageId: string; parentCommentId: string | null; status: string
  version: { number: number; createdAt: string; authorId: string }
  body: { storage: { value: string } }
}
export class UncertainCreate extends Error {}
export function commentClient(options: PublishOptions, request: typeof fetch = fetch) {
  const base = confluenceBase(options.url)
  const pagination = new WeakMap<object, string>()
  const authorization = `Basic ${Buffer.from(`${options.email}:${options.token}`).toString('base64')}`
  const api = async (path: string, method = 'GET', body?: unknown): Promise<unknown> => {
    if (!path.startsWith('/') || path.startsWith('//') || path.includes('..')) throw new Error('Unsafe API path.')
    let response: Response
    try {
      for (let attempt = 0; ; attempt++) {
        response = await request(path === '/current-user' ? `${base}/rest/api/user/current` : `${base}/api/v2${path}`, { method, redirect: 'error', signal: AbortSignal.timeout(30_000),
          headers: { Authorization: authorization, Accept: 'application/json', 'Content-Type': 'application/json' },
          ...(body === undefined ? {} : { body: JSON.stringify(body) }) })
        if (method !== 'GET' || response.status !== 429 || attempt >= 3) break
        const retry = response.headers.get('retry-after')
        const seconds = retry === null ? 2 ** attempt : /^\d+(\.\d+)?$/.test(retry) ? Number(retry) : (Date.parse(retry) - Date.now()) / 1000
        if (!Number.isFinite(seconds) || seconds < 0 || seconds > 30) break
        await delay(seconds * 1000)
      }
    } catch { throw method === 'GET' ? new Error('Cannot read Confluence. Check network and credentials.') : new UncertainCreate('Comment outcome uncertain. Check the page and bind the remote comment or explicitly retry.') }
    if (!response.ok) {
      if (method !== 'GET') throw new UncertainCreate(`Comment create returned HTTP ${response.status}; review before retrying.`)
      throw new Error(`Confluence read returned HTTP ${response.status}. Check permissions and retry later.`)
    }
    try {
      const value = await response.json()
      const link = response.headers.get('link')?.match(/<([^>]+)>;\s*rel="?next"?/i)?.[1]
      if (link && value && typeof value === 'object') pagination.set(value, link)
      return value
    } catch { throw method === 'GET' ? new Error('Invalid Confluence response.') : new UncertainCreate('No valid create acknowledgement. Review the page before retrying.') }
  }
  const list = async <T>(path: string): Promise<T[]> => {
    const endpoint = new URL(`${base}/api/v2${path}`).pathname
    const seen = new Set<string>(), results: T[] = []
    let next: string | undefined = path
    while (next) {
      const url = new URL(`${base}/api/v2${next}`)
      url.searchParams.sort()
      if (seen.has(url.href)) throw new Error('Repeated Confluence pagination cursor.')
      seen.add(url.href)
      const page = await api(next) as { results: T[]; _links?: { next?: string } }
      if (!Array.isArray(page.results)) throw new Error('Incomplete Confluence list.')
      results.push(...page.results)
      next = undefined
      const nextLink = page._links?.next ?? pagination.get(page)
      if (nextLink) {
        const cursor = new URL(nextLink, base + '/')
        if (cursor.origin !== new URL(base).origin || cursor.pathname !== endpoint || cursor.username || cursor.password || cursor.hash) throw new Error('Unexpected Confluence pagination URL.')
        next = cursor.pathname.slice('/wiki/api/v2'.length) + cursor.search
      }
    }
    return results
  }
  const comments = async (pageId: string): Promise<FooterComment[]> => {
    const result: FooterComment[] = [], seen = new Map<string, FooterComment>()
    const queue = [{ path: `/pages/${pageId}/footer-comments?body-format=storage&limit=100`, parent: null as string | null }]
    for (let at = 0; at < queue.length; at++) {
      const { path, parent } = queue[at]
      for (const raw of await list<FooterComment>(path)) {
        if (!/^\d+$/.test(raw.id) || raw.status !== 'current' || !Number.isInteger(raw.version?.number) || raw.version.number < 1 || !raw.version.authorId || !Number.isFinite(Date.parse(raw.version.createdAt)) || typeof raw.body?.storage?.value !== 'string' || (raw.pageId !== undefined && raw.pageId !== pageId) || (raw.parentCommentId != null && raw.parentCommentId !== parent)) throw new Error('Invalid comment identity, body or parent; page held for review.')
        let firstVersion = raw.version
        if (raw.version.number > 1) {
          const first = await api(`/footer-comments/${raw.id}?version=1&body-format=storage`) as FooterComment
          if (first.id !== raw.id || first.version?.number !== 1 || !first.version.authorId || !Number.isFinite(Date.parse(first.version.createdAt))) throw new Error('Cannot verify original comment author and timestamp; page held for review.')
          firstVersion = first.version
        }
        const comment = { ...raw, pageId, parentCommentId: parent, authorId: firstVersion.authorId, createdAt: firstVersion.createdAt }
        const previous = seen.get(comment.id)
        if (previous) {
          if (JSON.stringify(previous) !== JSON.stringify(comment)) throw new Error('Conflicting remote comment ID.')
          continue
        }
        seen.set(comment.id, comment); result.push(comment)
        queue.push({ path: `/footer-comments/${comment.id}/children?body-format=storage&limit=100`, parent: comment.id })
      }
    }
    return result
  }
  return { base, api, list, comments }
}
