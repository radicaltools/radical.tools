// ─── Other models not fetched ────────────────────────────────────────────────
//
// A model folder's deps.json names the models it depends on, and
// `radical federation fetch` writes their elements into the folder's
// .radical/federation.json, which Studio shows beside the model's own
// (documentStore). Studio never fetches: opened without them, or with a
// deps.json that does not read, a model says so once per open, naming the
// command that fetches them. Imported for its side effects by main.tsx (and
// by the test setup).

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
  if (others.fetchedUnreadable) return { message: `The other models fetched into .radical/federation.json do not read in this version of Studio. ${FETCH} again to see them.`, severity: 'warning' }
  if (others.fetched) return null
  const list = names.length === 1 ? names[0] : `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}`
  return { message: `This model depends on ${list}, which are not fetched yet. ${FETCH} to see them.`, severity: 'info' }
}

/** The document told about this open; a reload of it (an outside edit, a
 *  fetch) does not tell again. */
let toldFor: string | null = null

onDocumentLoaded((id) => {
  if (id !== documents.getActiveId() || id === toldFor) return
  toldFor = id
  const notice = otherModelsNotice(documents.otherModels(id))
  if (notice) useDiagramStore.getState().pushNotification(notice.message, notice.severity)
})
