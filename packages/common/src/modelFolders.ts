// Where a repository keeps its model (ADR Radical in one .radical folder),
// as Studio (in the browser and on the desktop) and the CLI find it in a
// folder picked to open. One rule, without the file system: each caller asks
// whether a folder holds a model (a radical.md) its own way.

/** The folder of everything Radical keeps in a repository. */
export const RADICAL_DIR = '.radical'
/** The model folder, from the repository's root. */
export const MODEL_FOLDER = `${RADICAL_DIR}/model`
/** The model folder of the old layout. */
export const OLD_MODEL_FOLDER = 'architecture'

/** The folders, from one picked to open (named `name`), that may hold its
 *  model, in the order they are tried ('' is the folder itself): the folder,
 *  the model of a .radical/ folder picked (a picker showing hidden folders
 *  may pick it), the repository's .radical/model (an open dialog hides
 *  .radical/), and architecture/, the old layout the CLI still reads. */
export function modelFolderCandidates(name: string): string[] {
  return name === RADICAL_DIR ? ['', 'model'] : ['', MODEL_FOLDER, OLD_MODEL_FOLDER]
}

/** A folder that holds nothing but hidden entries (.git, .DS_Store): a new
 *  model starts in it, as the MCP server starts one. */
export function startsEmpty(names: string[]): boolean {
  return names.every((name) => name.startsWith('.'))
}

/** Why a folder picked to open is refused: it holds files and no model.
 *  Taken for an empty model, the first edit wrote a second model beside the
 *  repository's code (F-0120). */
export function noModelIn(name: string): string {
  return `"${name}" holds no model: it has no radical.md, and neither has ${MODEL_FOLDER} or ${OLD_MODEL_FOLDER}/ in it. Open the model folder, or an empty folder to start a new model.`
}
