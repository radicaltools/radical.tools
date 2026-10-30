// ─── Model cache ─────────────────────────────────────────────────────────────
//
// A model folder's files kept in .radical/cache/ (ADR Model cache beside the
// model), so a folder opens by reading a few files and then only the files
// whose stamp moved:
//
//   • model.json: each model file's stamp and content, under an id;
//   • changes.json: the files written or read since model.json was written
//     (and those gone), for that id: the cache keeps up with saves without
//     model.json being written again whole;
//   • views.json: what each view's filter gives, for one structure of the
//     model (see viewIndexKey in viewPipeline).
//
// It is derived, never the source; deleting it is always safe, and whatever
// reads the folder writes it again (MdFolderSession).

import { SELECTION_DIR } from './canvasSelection'

/** Where a folder keeps its cache, relative to the folder. */
export const MODEL_CACHE_DIR = `${SELECTION_DIR}/cache`
export const MODEL_CACHE_FILE = `${MODEL_CACHE_DIR}/model.json`

/** The files of the cache. */
export type ModelCacheName = 'model.json' | 'changes.json' | 'views.json'
export const MODEL_CACHE_NAMES: ReadonlySet<string> = new Set<ModelCacheName>(['model.json', 'changes.json', 'views.json'])

/** Bumped when what the cache holds changes: a cache of another version is
 *  rebuilt, never read. */
export const MODEL_CACHE_VERSION = 2

/** Each model file as the cache keeps it. */
export type ModelCacheFiles = Record<string, { stamp: string; content: string }>

/** The cache as read: model.json with changes.json applied. */
export interface ModelCache {
  /** model.json's id, which changes.json names. */
  id: string
  /** model.json's files, as written. */
  base: ModelCacheFiles
  /** The files as the cache has them now. */
  files: ModelCacheFiles
}

interface ModelCacheJson {
  format: 'radical-model-cache'
  version: number
  id: string
  files: ModelCacheFiles
}

interface ModelCacheChangesJson {
  format: 'radical-model-cache-changes'
  version: number
  base: string
  files: ModelCacheFiles
  removed: string[]
}

function parse<T>(text: string | null | undefined): Partial<T> | null {
  if (!text) return null
  try {
    const json = JSON.parse(text) as Partial<T>
    return json && typeof json === 'object' ? json : null
  } catch {
    return null
  }
}

// Each content copied out of the text it was parsed from: as parsed, the
// contents held on to that text, and a model of 21,000 elements opened from
// its cache took twice the memory it took read file by file.
const encoder = new TextEncoder()
const decoder = new TextDecoder()

function readFiles(files: unknown): ModelCacheFiles | null {
  if (!files || typeof files !== 'object') return null
  for (const entry of Object.values(files as ModelCacheFiles)) {
    if (!entry || typeof entry.stamp !== 'string' || typeof entry.content !== 'string') return null
    entry.content = decoder.decode(encoder.encode(entry.content))
  }
  return files as ModelCacheFiles
}

/** The cache from model.json and changes.json, or null when model.json is
 *  no cache of this version (missing, cut short, of another version or
 *  another kind). A changes.json made for another model.json, or broken,
 *  is left out. */
export function readModelCache(model: string | null | undefined, changes?: string | null): ModelCache | null {
  const json = parse<ModelCacheJson>(model)
  if (!json || json.format !== 'radical-model-cache' || json.version !== MODEL_CACHE_VERSION || typeof json.id !== 'string') return null
  const base = readFiles(json.files)
  if (!base) return null
  const files: ModelCacheFiles = { ...base }
  const delta = parse<ModelCacheChangesJson>(changes)
  if (delta && delta.format === 'radical-model-cache-changes' && delta.version === MODEL_CACHE_VERSION && delta.base === json.id && Array.isArray(delta.removed)) {
    const changed = readFiles(delta.files)
    if (changed) {
      Object.assign(files, changed)
      for (const path of delta.removed) delete files[path]
    }
  }
  return { id: json.id, base, files }
}

/** model.json for `files`, under `id`. */
export function writeModelCache(files: ModelCacheFiles, id: string): string {
  const json: ModelCacheJson = { format: 'radical-model-cache', version: MODEL_CACHE_VERSION, id, files }
  return ascii(JSON.stringify(json))
}

/** changes.json: how `files` differ from model.json's `base` (id `baseId`). */
export function writeModelCacheChanges(baseId: string, base: ModelCacheFiles, files: ModelCacheFiles): string {
  const changed: ModelCacheFiles = {}
  for (const [path, entry] of Object.entries(files)) if (base[path]?.stamp !== entry.stamp) changed[path] = entry
  const removed = Object.keys(base).filter((path) => !(path in files))
  const json: ModelCacheChangesJson = { format: 'radical-model-cache-changes', version: MODEL_CACHE_VERSION, base: baseId, files: changed, removed }
  return ascii(JSON.stringify(json))
}

/** How many files changes.json for `files` would name. */
export function modelCacheChangeCount(base: ModelCacheFiles, files: ModelCacheFiles): number {
  let n = 0
  for (const [path, entry] of Object.entries(files)) if (base[path]?.stamp !== entry.stamp) n++
  for (const path of Object.keys(base)) if (!(path in files)) n++
  return n
}

// In ASCII, every other character as \uXXXX: a text of one byte a
// character, parsed faster than one holding any other.
function ascii(text: string): string {
  return text.replace(/[\u007f-￿]/g, (c) => `\\u${c.charCodeAt(0).toString(16).padStart(4, '0')}`)
}

// ─── View index ──────────────────────────────────────────────────────────────

/** What each view's filter gives, for one structure of a model: the views
 *  by the key of their chain, their elements as places in `ids`. */
export interface ViewIndex {
  structure: string
  ids: string[]
  views: Record<string, number[]>
}

interface ViewIndexJson extends ViewIndex {
  format: 'radical-view-index'
  version: number
}

export function readViewIndex(text: string | null | undefined): ViewIndex | null {
  const json = parse<ViewIndexJson>(text)
  if (!json || json.format !== 'radical-view-index' || json.version !== MODEL_CACHE_VERSION) return null
  if (typeof json.structure !== 'string' || !Array.isArray(json.ids) || !json.views || typeof json.views !== 'object') return null
  return { structure: json.structure, ids: json.ids, views: json.views }
}

export function writeViewIndex(index: ViewIndex): string {
  const json: ViewIndexJson = { format: 'radical-view-index', version: MODEL_CACHE_VERSION, ...index }
  return ascii(JSON.stringify(json))
}
