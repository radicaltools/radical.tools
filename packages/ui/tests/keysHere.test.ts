import { describe, it, expect } from 'vitest'
import { keepKeysHere } from '../src/components/keysHere'

/** Whether keepKeysHere stopped a key. */
function stopped(key: string, mods: { metaKey?: boolean; ctrlKey?: boolean } = {}): boolean {
  let stop = false
  keepKeysHere({ key, metaKey: !!mods.metaKey, ctrlKey: !!mods.ctrlKey, stopPropagation: () => { stop = true } })
  return stop
}

describe('keys kept in a panel or a field', () => {
  // F-0068: F5 and Cmd/Ctrl+P kept from Studio reached the browser (reload, print).
  it('lets F5 and Cmd/Ctrl+P go on to Studio and keeps every other key', () => {
    expect(stopped('F5')).toBe(false)
    expect(stopped('p', { metaKey: true })).toBe(false)
    expect(stopped('P', { ctrlKey: true })).toBe(false)
    for (const key of ['p', 'Delete', 'Backspace', 'ArrowLeft', 'Escape', 'Enter', 'z']) expect(stopped(key), key).toBe(true)
    expect(stopped('z', { metaKey: true })).toBe(true)
  })
})
