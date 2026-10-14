import { describe, it, expect } from 'vitest'
import { normalizeViewFolder, viewFolderPaths, viewFolderRenameTarget, viewFolderTree } from '../src/c4'
import { moveViewFolder, renameViewFolder, type ModelState } from '../src/model'

const view = (name: string, folder?: string) => ({ name, ...(folder !== undefined ? { folder } : {}) })

describe('view folders', () => {
  it('keeps a folder path trimmed, without empty segments', () => {
    expect(normalizeViewFolder(' C4 / Components/ ')).toBe('C4/Components')
    expect(normalizeViewFolder('//')).toBe('')
    expect(normalizeViewFolder(undefined)).toBe('')
  })

  it('lists the views as a tree in the model order: a folder stands where its first view does', () => {
    const tree = viewFolderTree([
      view('Wiki'),
      view('Studio', 'C4/Components'),
      view('Containers', 'C4'),
      view('Domain map', 'Conceptual'),
      view('Context', 'C4'),
      view('Hub', 'C4/Components'),
    ])
    expect(tree.views.map((v) => v.name)).toEqual(['Wiki'])
    expect(tree.count).toBe(6)
    expect(tree.folders.map((f) => [f.path, f.count])).toEqual([['C4', 4], ['Conceptual', 1]])
    expect(viewFolderTree([view('Map', 'Conceptual'), view('Studio', 'C4')]).folders.map((f) => f.path)).toEqual(['Conceptual', 'C4'])
    // Folders and views interleave: a folder stands where its first view does.
    const entries = viewFolderTree([view('Overview', 'C4'), view('Studio', 'C4/Components'), view('Context', 'C4')]).folders[0].entries
    expect(entries.map((e) => ('folder' in e ? `folder ${e.folder.name}` : e.view.name))).toEqual(['Overview', 'folder Components', 'Context'])
    const c4 = tree.folders[0]
    expect(c4.views.map((v) => v.name)).toEqual(['Containers', 'Context'])
    expect(c4.folders.map((f) => [f.name, f.path, f.views.map((v) => v.name)])).toEqual([
      ['Components', 'C4/Components', ['Studio', 'Hub']],
    ])
  })

  it('makes the folders above a nested one, though no view sits in them', () => {
    const tree = viewFolderTree([view('Deep', 'a/b/c')])
    expect(tree.folders[0]).toMatchObject({ path: 'a', count: 1, views: [] })
    expect(tree.folders[0].folders[0].folders[0]).toMatchObject({ path: 'a/b/c', name: 'c', count: 1 })
    expect(viewFolderPaths([view('Deep', 'a/b/c'), view('Top'), view('Other', 'A2')])).toEqual(['a', 'a/b', 'a/b/c', 'A2'])
  })

  it('renames a folder, and its views and subfolders move along', () => {
    const state = { views: {
      a: { id: 'a', name: 'A', folder: 'C4/Components', nodeIds: [] },
      b: { id: 'b', name: 'B', folder: 'C4/Components/Deep', nodeIds: [] },
      c: { id: 'c', name: 'C', folder: 'C4/Componentsish', nodeIds: [] },
      d: { id: 'd', name: 'D', folder: 'C4', nodeIds: [] },
    } } as unknown as ModelState
    expect(renameViewFolder(state, 'C4/Components', ' Parts ')).toBe('C4/Parts')
    expect(Object.values(state.views).map((v) => v.folder)).toEqual(['C4/Parts', 'C4/Parts/Deep', 'C4/Componentsish', 'C4'])
    expect(renameViewFolder(state, 'C4', 'Model')).toBe('Model')
    expect(Object.values(state.views).map((v) => v.folder)).toEqual(['Model/Parts', 'Model/Parts/Deep', 'Model/Componentsish', 'Model'])
    const views = Object.values(state.views)
    expect(viewFolderRenameTarget(views, 'Model', 'a/b')).toBeNull()
    expect(viewFolderRenameTarget(views, 'Model', '  ')).toBeNull()
    expect(viewFolderRenameTarget(views, 'Nowhere', 'X')).toBeNull()
  })

  it('moves a folder up or down among the folders beside it, with all its views', () => {
    const v = (id: string, folder?: string) => [id, { id, name: id, nodeIds: [], ...(folder ? { folder } : {}) }]
    const state = { views: Object.fromEntries([
      v('top'), v('ctx', 'C4'), v('map', 'Conceptual'), v('studio', 'C4/Components'), v('hub', 'C4/Components'), v('dec', 'Governance'), v('model', 'Conceptual'),
    ]) } as unknown as ModelState
    const folders = () => viewFolderTree(Object.values(state.views)).folders.map((f) => f.path)
    expect(folders()).toEqual(['C4', 'Conceptual', 'Governance'])
    expect(moveViewFolder(state, 'Conceptual', -1)).toBe(true)
    expect(folders()).toEqual(['Conceptual', 'C4', 'Governance'])
    expect(Object.keys(state.views)).toEqual(['top', 'map', 'model', 'ctx', 'studio', 'hub', 'dec'])
    expect(moveViewFolder(state, 'C4', 1)).toBe(true)
    expect(folders()).toEqual(['Conceptual', 'Governance', 'C4'])
    expect(moveViewFolder(state, 'Conceptual', -1)).toBe(false)
    expect(moveViewFolder(state, 'C4/Components', 1)).toBe(false)
  })
})
