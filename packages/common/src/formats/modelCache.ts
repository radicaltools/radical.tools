// ─── Model cache ─────────────────────────────────────────────────────────────
//
// A model folder's files kept in one file, .radical/cache/model.json (ADR
// Model cache beside the model): each model file's stamp and content, so a
// folder opens by reading one file and then only the files whose stamp
// moved. It is derived, never the source; deleting it is always safe, and
// whatever reads the folder writes it again (MdFolderSession).

import { SELECTION_DIR } from './canvasSelection'

/** Where a folder keeps its cache, relative to the folder. */
export const MODEL_CACHE_FILE = `${SELECTION_DIR}/cache/model.json`

/** Bumped when what the cache holds changes: a cache of another version is
 *  rebuilt, never read. */
export const MODEL_CACHE_VERSION = 1

/** Each model file as the cache keeps it. */
export type ModelCacheFiles = Record<string, { stamp: string; content: string }>

interface ModelCacheJson {
  format: 'radical-model-cache'
  version: number
  files: ModelCacheFiles
}

/** The files a cache holds, or null when it is no cache of this version
 *  (missing, cut short, of another version or another kind). */
export function readModelCache(text: string | null | undefined): ModelCacheFiles | null {
  if (!text) return null
  let json: Partial<ModelCacheJson>
  try { json = JSON.parse(text) as Partial<ModelCacheJson> } catch { return null }
  if (!json || json.format !== 'radical-model-cache' || json.version !== MODEL_CACHE_VERSION) return null
  const files = json.files
  if (!files || typeof files !== 'object') return null
  // Each content copied out of the text it was parsed from: as parsed, the
  // contents held on to that text, and a model of 21,000 elements opened
  // from its cache took twice the memory it took read file by file.
  const encoder = new TextEncoder()
  const decoder = new TextDecoder()
  for (const entry of Object.values(files)) {
    if (!entry || typeof entry.stamp !== 'string' || typeof entry.content !== 'string') return null
    entry.content = decoder.decode(encoder.encode(entry.content))
  }
  return files
}

/** The cache of `files`. */
export function writeModelCache(files: ModelCacheFiles): string {
  const json: ModelCacheJson = { format: 'radical-model-cache', version: MODEL_CACHE_VERSION, files }
  // In ASCII, every other character as \uXXXX: a text of one byte a
  // character, parsed faster than one holding any other.
  return JSON.stringify(json).replace(/[\u007f-\uffff]/g, (c) => `\\u${c.charCodeAt(0).toString(16).padStart(4, '0')}`)
}
