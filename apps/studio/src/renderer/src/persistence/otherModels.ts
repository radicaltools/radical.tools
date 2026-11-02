// ─── The other models of a federation ────────────────────────────────────────
//
// A model folder's deps.json names the models it depends on, and
// `radical federation fetch` writes their elements into the folder's
// .state/federation.json, which Studio shows beside the model's own
// (documentStore). Studio never fetches: opened without them, or with a
// deps.json that does not read, a model says so once per open, naming the
// command that fetches them. The toolbar's button lists them with their
// versions (otherModelsSummary, kept for the active document in
// useOtherModelsStore). Imported for its side effects by main.tsx (and by
// the test setup).

import { create } from 'zustand'
import { useDiagramStore } from '@radical/ui/store/diagramStore'
import { documents, type OtherModels } from '../store/documentStore'
import { onDocumentLoaded } from './autosave'

const FETCH = 'Run radical federation fetch in the model folder'

/** What Studio says about a model's federation when it is opened, or null
 *  when there is nothing to say (no deps.json, or the others fetched). */
export function otherModelsNotice(others: OtherModels): { message: string; severity: 'info' | 'warning' } | null {
  if (others.depsError) return { message: `${others.depsError} The models it names cannot be shown.`, severity: 'warning' }
  const names = others.deps?.dependencies.map((d) => d.name) ?? []
  if (!names.length) return null
  if (others.fetchedUnreadable) return { message: `The other models fetched into .state/federation.json do not read in this version of Studio. ${FETCH} again to see them.`, severity: 'warning' }
  if (others.fetched) return null
  const list = names.length === 1 ? names[0] : `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}`
  return { message: `This model depends on ${list}, which are not fetched yet. ${FETCH} to see them.`, severity: 'info' }
}

/** Where one other model stands: fetched at the version deps.json pins,
 *  not fetched, or fetched at another (a ref or repository changed in
 *  deps.json since the fetch). */
export type OtherModelStatus = 'ok' | 'not-fetched' | 'pinned-anew'

export interface OtherModelRow {
  name: string
  /** The branch, tag or commit deps.json pins. */
  pinned: string
  /** The commit fetched (short), or the ref fetched where it is not the
   *  pin; null when it is not fetched. */
  fetched: string | null
  /** The model whose deps.json pins it; absent for this model's own. */
  via?: string
  status: OtherModelStatus
}

export interface OtherModelsSummary {
  /** This model's own first, each followed by the models fetched through it. */
  rows: OtherModelRow[]
  /** What is wrong, a sentence each, for the reader to fetch again. */
  problems: string[]
  /** When they were fetched (ISO 8601). */
  fetchedAt?: string
}

/** The other models a model depends on, with the versions deps.json pins
 *  and those fetched, and what is wrong; null for a model with no deps.json. */
/** What was fetched: the short commit, after the version latest resolved to. */
const fetchedShown = (got: { commit: string; resolved?: string }): string =>
  got.resolved ? `${got.resolved} · ${got.commit.slice(0, 7)}` : got.commit.slice(0, 7)

export function otherModelsSummary(others: OtherModels): OtherModelsSummary | null {
  if (others.depsError) return { rows: [], problems: [others.depsError] }
  if (!others.deps) return null
  const file = others.fetched
  const problems: string[] = []
  if (others.fetchedUnreadable) problems.push('The other models fetched into .state/federation.json do not read in this version of Studio.')
  else if (!file) problems.push('Nothing is fetched yet.')
  const rows: OtherModelRow[] = others.deps.dependencies.map((dep) => {
    const got = file?.dependencies.find((d) => d.name === dep.name && !d.via)
    if (!got) {
      if (file) problems.push(`${dep.name} is not fetched.`)
      return { name: dep.name, pinned: dep.ref, fetched: null, status: 'not-fetched' }
    }
    if (got.ref !== dep.ref) {
      problems.push(`${dep.name} is pinned at ${dep.ref} but ${got.ref} is fetched.`)
      return { name: dep.name, pinned: dep.ref, fetched: got.ref, status: 'pinned-anew' }
    }
    if (got.repo !== dep.repo) {
      problems.push(`${dep.name} is pinned to ${dep.repo} but fetched from ${got.repo}.`)
      return { name: dep.name, pinned: dep.ref, fetched: got.commit.slice(0, 7), status: 'pinned-anew' }
    }
    return { name: dep.name, pinned: dep.ref, fetched: fetchedShown(got), status: 'ok' }
  })
  // The models fetched through another, each after the one that names it
  // (and the others it names).
  for (const got of file?.dependencies.filter((d) => d.via) ?? []) {
    const row: OtherModelRow = { name: got.name, pinned: got.ref, fetched: fetchedShown(got), via: got.via, status: 'ok' }
    const parent = rows.findIndex((r) => r.name === got.via)
    if (parent < 0) { rows.push(row); continue }
    let at = parent + 1
    while (at < rows.length && rows[at].via) at++
    rows.splice(at, 0, row)
  }
  return { rows, problems, ...(file?.fetchedAt ? { fetchedAt: file.fetchedAt } : {}) }
}

/** The active document's other models, as its last load read them. */
export const useOtherModelsStore = create<{ summary: OtherModelsSummary | null }>()(() => ({ summary: null }))

/** The document told about this open; a reload of it (an outside edit, a
 *  fetch) does not tell again. */
let toldFor: string | null = null

onDocumentLoaded((id) => {
  if (id !== documents.getActiveId()) return
  // Each load, a reload too: a fetch or a pull that changed deps.json
  // reloads the document (followFederation).
  useOtherModelsStore.setState({ summary: otherModelsSummary(documents.otherModels(id)) })
  if (id === toldFor) return
  toldFor = id
  const notice = otherModelsNotice(documents.otherModels(id))
  if (notice) useDiagramStore.getState().pushNotification(notice.message, notice.severity)
})
