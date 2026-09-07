import { describe, it, expect } from 'vitest'
import { composeEarsSentence, resolveEarsSubject, parseEarsSentence } from '../src/renderer/src/types/metamodel'

describe('composeEarsSentence', () => {
  it('ubiquitous with subject: "<Subject> shall <action>."', () => {
    const { sentence, complete } = composeEarsSentence({ ears_type: 'ubiquitous', action: 'respond within 1s' }, 'the API Gateway')
    expect(sentence).toBe('The API Gateway shall respond within 1s.')
    expect(complete).toBe(true)
  })

  it('ubiquitous without subject defaults to "the system"', () => {
    const { sentence } = composeEarsSentence({ ears_type: 'ubiquitous', action: 'respond within 1s' })
    expect(sentence).toBe('The system shall respond within 1s.')
  })

  it('ubiquitous incomplete (no action)', () => {
    const { sentence, complete } = composeEarsSentence({ ears_type: 'ubiquitous' })
    expect(sentence).toContain('‹action›')
    expect(complete).toBe(false)
  })

  it('event-driven: "When <trigger>, <subject> shall <action>."', () => {
    const { sentence, complete } = composeEarsSentence({ ears_type: 'event-driven', trigger: 'a request is received', action: 'validate input' }, 'the API')
    expect(sentence).toBe('When a request is received, the API shall validate input.')
    expect(complete).toBe(true)
  })

  it('event-driven incomplete (missing trigger)', () => {
    const { sentence, complete } = composeEarsSentence({ ears_type: 'event-driven', action: 'validate' })
    expect(sentence).toContain('‹trigger›')
    expect(complete).toBe(false)
  })

  it('state-driven: "While <precondition>, <subject> shall <action>."', () => {
    const { sentence, complete } = composeEarsSentence({ ears_type: 'state-driven', precondition: 'the system is running', action: 'log metrics' }, 'the Monitor')
    expect(sentence).toBe('While the system is running, the Monitor shall log metrics.')
    expect(complete).toBe(true)
  })

  it('unwanted-behaviour: "If <condition>, then <subject> shall <action>."', () => {
    const { sentence, complete } = composeEarsSentence({ ears_type: 'unwanted-behaviour', unwanted_condition: 'disk is full', action: 'alert admin' }, 'the System')
    expect(sentence).toBe('If disk is full, then the System shall alert admin.')
    expect(complete).toBe(true)
  })

  it('optional: "Where <feature>, <subject> shall <action>."', () => {
    const { sentence, complete } = composeEarsSentence({ ears_type: 'optional', feature: 'offline mode is enabled', action: 'cache data locally' }, 'the App')
    expect(sentence).toBe('Where offline mode is enabled, the App shall cache data locally.')
    expect(complete).toBe(true)
  })

  it('complex: combines precondition + trigger', () => {
    const { sentence, complete } = composeEarsSentence({ ears_type: 'complex', precondition: 'in degraded mode', trigger: 'a new request arrives', action: 'queue request' }, 'the Service')
    expect(sentence).toBe('While in degraded mode, when a new request arrives, the Service shall queue request.')
    expect(complete).toBe(true)
  })

  it('complex: unwanted_condition + feature alone (no precondition/trigger) still renders', () => {
    const { sentence, complete } = composeEarsSentence({ ears_type: 'complex', unwanted_condition: 'the disk is full', feature: 'archiving is enabled', action: 'purge old logs' }, 'the Service')
    expect(sentence).toBe('If the disk is full, where archiving is enabled, the Service shall purge old logs.')
    expect(complete).toBe(true)
  })

  it('defaults to ubiquitous for unknown type', () => {
    const { sentence } = composeEarsSentence({ action: 'do something' })
    expect(sentence).toBe('The system shall do something.')
  })
})

describe('resolveEarsSubject', () => {
  it('returns source label from satisfies relation', () => {
    const relations = { r1: { sourceId: 'sys1', targetId: 'req1', relationType: 'satisfies' } }
    const nodes = { sys1: { label: 'Payment Service' }, req1: { label: 'REQ-001' } }
    expect(resolveEarsSubject('req1', relations, nodes)).toBe('Payment Service')
  })

  it('returns undefined when no satisfies relation exists', () => {
    const relations = { r1: { sourceId: 'sys1', targetId: 'req1', relationType: 'derives' } }
    const nodes = { sys1: { label: 'Payment Service' }, req1: { label: 'REQ-001' } }
    expect(resolveEarsSubject('req1', relations, nodes)).toBeUndefined()
  })
})

describe('parseEarsSentence', () => {
  it('plain sentence with shall → ubiquitous', () => {
    const parsed = parseEarsSentence('The system shall log every failed login attempt.')
    expect(parsed).toEqual({ ears_type: 'ubiquitous', action: 'log every failed login attempt' })
  })

  it('no shall/must at all → ubiquitous, whole text becomes the action', () => {
    const parsed = parseEarsSentence('Log every failed login attempt')
    expect(parsed).toEqual({ ears_type: 'ubiquitous', action: 'Log every failed login attempt' })
  })

  it('when-clause → event-driven', () => {
    const parsed = parseEarsSentence('When the user clicks save, the system shall persist the document.')
    expect(parsed).toEqual({ ears_type: 'event-driven', action: 'persist the document', trigger: 'the user clicks save' })
  })

  it('whenever is recognized as a trigger keyword', () => {
    const parsed = parseEarsSentence('Whenever a payment fails, the system shall notify the admin.')
    expect(parsed.ears_type).toBe('event-driven')
    expect(parsed.trigger).toBe('a payment fails')
  })

  it('while-clause → state-driven', () => {
    const parsed = parseEarsSentence('While the battery level is low, the device shall dim the screen.')
    expect(parsed).toEqual({ ears_type: 'state-driven', action: 'dim the screen', precondition: 'the battery level is low' })
  })

  it('if-clause → unwanted-behaviour, "then" boilerplate is discarded', () => {
    const parsed = parseEarsSentence('If the connection times out, then the client must retry.')
    expect(parsed).toEqual({ ears_type: 'unwanted-behaviour', action: 'retry', unwanted_condition: 'the connection times out' })
  })

  it('where-clause → optional', () => {
    const parsed = parseEarsSentence('Where offline mode is enabled, the app shall cache data locally.')
    expect(parsed).toEqual({ ears_type: 'optional', action: 'cache data locally', feature: 'offline mode is enabled' })
  })

  it('two clauses → complex', () => {
    const parsed = parseEarsSentence('While in degraded mode, when a new request arrives, the service shall queue it.')
    expect(parsed).toEqual({
      ears_type: 'complex',
      action: 'queue it',
      precondition: 'in degraded mode',
      trigger: 'a new request arrives',
    })
  })

  it('empty input', () => {
    expect(parseEarsSentence('   ')).toEqual({ ears_type: 'ubiquitous', action: '' })
  })

  it('splits at the LAST shall/must, so "must" inside the condition clause does not confuse the split', () => {
    const parsed = parseEarsSentence('If the request must be retried, the system shall queue it.')
    expect(parsed).toEqual({
      ears_type: 'unwanted-behaviour',
      action: 'queue it',
      unwanted_condition: 'the request must be retried',
    })
  })

  it('roundtrips through composeEarsSentence back to an equivalent sentence', () => {
    const parsed = parseEarsSentence('When the user clicks save, the system shall persist the document.')
    const { sentence } = composeEarsSentence(parsed)
    expect(sentence).toBe('When the user clicks save, the system shall persist the document.')
  })

  it('roundtrips an if+where complex sentence', () => {
    const parsed = parseEarsSentence('If the disk is full, where archiving is enabled, the system shall purge old logs.')
    const { sentence } = composeEarsSentence(parsed)
    expect(sentence).toBe('If the disk is full, where archiving is enabled, the system shall purge old logs.')
  })
})
