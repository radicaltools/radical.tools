import { afterEach, describe, expect, it } from 'vitest'
import { useDiagramStore } from '@radical/ui/store/diagramStore'
import { canvasKeysOff } from '@radical/ui/components/keysHere'
import { keysTakenByDialog } from '../src/renderer/src/components/dialogKeys'

// One rule for "something else has the keys", asked by the canvas's keys
// (Delete, Esc: canvasKeysOff) and by Studio's shortcuts (F5, Cmd/Ctrl+P,
// Ctrl/Cmd+Z, Cmd+=, Alt+←: keysTakenByDialog).

/** An element as the gate reads it: its tag, attributes and parent. */
interface FakeElement {
  nodeName: string
  hasAttribute(name: string): boolean
  closest(selector: string): FakeElement | null
}

function element(nodeName: string, attrs: Record<string, string> = {}, parent: FakeElement | null = null): FakeElement {
  const matches = (sel: string): boolean => {
    const attr = /^\[(\w+)(?:="([^"]*)")?\]$/.exec(sel)
    if (attr) return attr[2] === undefined ? attr[1] in attrs : attrs[attr[1]] === attr[2]
    if (sel.startsWith('.')) return (attrs.class ?? '').split(' ').includes(sel.slice(1))
    return sel.toUpperCase() === nodeName
  }
  const self: FakeElement = {
    nodeName,
    hasAttribute: (name) => name in attrs,
    closest: (selector) => (selector.split(',').some((s) => matches(s.trim())) ? self : parent?.closest(selector) ?? null),
  }
  return self
}

const canvas = element('DIV', { class: 'react-flow__node' })
const forgePanel = element('DIV', { class: 'forge-panel', role: 'dialog' })
const exploreMenu = element('DIV', { class: 'explore-menu', role: 'menu' })

/** Whether the canvas and Studio's shortcuts leave a key on `target` alone. */
const gates = (target: FakeElement) => ({
  canvas: canvasKeysOff({ target: target as unknown as EventTarget }),
  studio: keysTakenByDialog(target as unknown as EventTarget),
})

afterEach(() => { useDiagramStore.setState({ pendingDelete: null, nodeWizard: null }) })

describe('one rule for the keys something else has', () => {
  // F-0171: the Delete prompt was no dialog to either gate: Cmd/Ctrl+P
  // switched the view behind it (Hide then hid from another view), F5
  // started the presentation under it and Ctrl/Cmd+Z undid a step.
  it('gives the keys to the Delete prompt while it asks, as to the other modal dialogs', () => {
    expect(gates(canvas)).toEqual({ canvas: false, studio: false })
    useDiagramStore.setState({ pendingDelete: { nodeIds: ['payments'], edgeIds: [] } })
    expect(gates(canvas)).toEqual({ canvas: true, studio: true })
    useDiagramStore.setState({ pendingDelete: { nodeIds: [], edgeIds: ['r1'] } })
    expect(gates(canvas)).toEqual({ canvas: true, studio: true })
    // Asked for nothing, it is not drawn and keeps nothing.
    useDiagramStore.setState({ pendingDelete: { nodeIds: [], edgeIds: [] } })
    expect(gates(canvas)).toEqual({ canvas: false, studio: false })
  })

  // F-0173: Delete pressed on a button of Radical Forge opened the canvas's
  // delete prompt under the panel, for the element selected behind it, while
  // F5 and Ctrl/Cmd+Z were already kept there.
  it('keeps the canvas\'s keys out of a dialog or a menu that leaves the canvas usable, as Studio\'s shortcuts', () => {
    const cases: Array<[string, FakeElement, { canvas: boolean; studio: boolean }]> = [
      ['a button of Radical Forge', element('BUTTON', {}, forgePanel), { canvas: true, studio: true }],
      ['Radical Forge\'s description', element('TEXTAREA', {}, forgePanel), { canvas: true, studio: true }],
      ['a row of the Explore menu', element('BUTTON', { role: 'menuitem' }, exploreMenu), { canvas: true, studio: true }],
      // A field keeps the canvas's keys; F5 and Cmd/Ctrl+P go on to Studio.
      ['a field of the properties card', element('INPUT', {}, element('DIV', { class: 'right-panel' })), { canvas: true, studio: false }],
      ['an element on the canvas', canvas, { canvas: false, studio: false }],
    ]
    for (const [where, target, expected] of cases) expect(gates(target), where).toEqual(expected)
  })
})
