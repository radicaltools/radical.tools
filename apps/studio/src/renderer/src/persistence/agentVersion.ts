// ─── Agent on another version ────────────────────────────────────────────────
//
// An agent writing the open folder over MCP records its server's product
// version in .radical/agent-activity.json (agentActivity). Each time Studio
// loads a change made outside it, it reads that file, and when the server is
// of another version than Studio's it says so once per model and version:
// builds of different versions may read and write the model differently (a
// Claude Desktop server running from an old worktree, an npx install that
// kept its version). Two builds of one version from other commits are the
// same version. Imported for its side effects by main.tsx (and by the test
// setup).

import { buildInfo, compareVersions, displayVersion, releaseOf, type BuildInfo } from '@radical/common/version'
import { useDiagramStore } from '@radical/ui/store/diagramStore'
import { documents } from '../store/documentStore'
import { onOutsideEditLoaded } from './autosave'

let studio: BuildInfo = buildInfo()

/** Studio's build, as tests set it. */
export function setStudioBuild(info: BuildInfo): void {
  studio = info
}

/** Each model with the server versions it was told about. */
const told = new Map<string, Set<string>>()

/** What Studio says about an agent whose MCP server is of `server`, or null
 *  when it is of Studio's version. */
export function agentVersionNotice(server: string, info: BuildInfo = studio): string | null {
  const order = compareVersions(server, info.version)
  if (order === 0) return null
  const which = order < 0 ? 'older' : 'newer'
  const update = order < 0 ? ' Update the agent\'s MCP server to the version of Studio.' : ' Update Studio to the version of the server.'
  return `The agent edits this model through radical-mcp ${server}, ${which} than Studio ${displayVersion(info)}. Builds of different versions may read and write the model differently.${update}`
}

onOutsideEditLoaded(() => {
  const id = documents.getActiveId()
  if (!id) return
  void documents.readAgentActivity(id).then((activity) => {
    const server = activity?.radical
    if (!server || documents.getActiveId() !== id) return
    const notice = agentVersionNotice(server)
    const versions = told.get(id) ?? new Set<string>()
    if (!notice || versions.has(releaseOf(server))) return
    versions.add(releaseOf(server))
    told.set(id, versions)
    useDiagramStore.getState().pushNotification(notice, 'warning')
  }).catch(() => {})
})
