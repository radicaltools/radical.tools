import { describe, it, expect } from 'vitest'
import { defaultStudioSettings, loadStudioSettings, saveStudioSettings, updateStudioSettings } from '../src/studioSettings'

function memoryStorage() {
  const memory = new Map<string, string>()
  return {
    getItem: (k: string) => memory.get(k) ?? null,
    setItem: (k: string, v: string) => { memory.set(k, v) },
  }
}

describe('studio settings', () => {
  // F-0039: a writer that held the settings it read earlier put Focus and
  // Smart fit back on when it saved its own one.
  it('a change keeps the settings another writer changed since', () => {
    const storage = memoryStorage()
    saveStudioSettings(defaultStudioSettings(), storage)
    updateStudioSettings({ selectionFocus: false }, storage)
    updateStudioSettings({ smartFit: false }, storage)
    const next = updateStudioSettings({ nodeWizardOnCreate: false }, storage)
    expect(next).toEqual({ nodeWizardOnCreate: false, smartFit: false, alignKeepsOrder: true, selectionFocus: false, specialKey: 'alt', setupDone: false })
    expect(loadStudioSettings(storage)).toEqual(next)
  })

  it('keeps the special key and the finished setup, and a key it does not know is Alt', () => {
    const storage = memoryStorage()
    updateStudioSettings({ specialKey: 'shift', setupDone: true }, storage)
    expect(loadStudioSettings(storage)).toMatchObject({ specialKey: 'shift', setupDone: true })
    storage.setItem('radical-studio-settings', JSON.stringify({ specialKey: 'f13' }))
    expect(loadStudioSettings(storage)).toMatchObject({ specialKey: 'alt', setupDone: false })
  })
})
