import { describe, it, expect } from 'vitest'
import { composeEarsSentence, resolveEarsSubject, parseEarsSentence, requirementFromLine, labelFromText } from '../src/metamodel/index'

describe('composeEarsSentence', () => {
  it('ubiquitous with subject: "<Subject> shall <action>."', () => {
    const { sentence, complete } = composeEarsSentence({ ears_type: 'ubiquitous', action: 'respond within 1s' }, 'the API Gateway')
    expect(sentence).toBe('The API Gateway shall respond within 1s.')
    expect(complete).toBe(true)
  })

  it('an action that is a clause of its own keeps its subject and one full stop', () => {
    const action = 'The wiki view shall show an overview page.'
    expect(composeEarsSentence({ ears_type: 'ubiquitous', action }, '@radical/ui').sentence)
      .toBe('The wiki view shall show an overview page.')
    expect(composeEarsSentence({ ears_type: 'event-driven', trigger: 'a view opens', action }, '@radical/ui').sentence)
      .toBe('When a view opens, the wiki view shall show an overview page.')
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

  it('no shall, must, should or will at all → ubiquitous, whole text becomes the action', () => {
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
    const parsed = parseEarsSentence('While the battery level is low, the device shall dim the screen.', 'The device')
    expect(parsed).toEqual({ ears_type: 'state-driven', action: 'dim the screen', precondition: 'the battery level is low' })
  })

  it('if-clause → unwanted-behaviour, "then" boilerplate is discarded', () => {
    const parsed = parseEarsSentence('If the connection times out, then the client must retry.', 'the client')
    expect(parsed).toEqual({ ears_type: 'unwanted-behaviour', action: 'retry', unwanted_condition: 'the connection times out' })
  })

  it('where-clause → optional', () => {
    const parsed = parseEarsSentence('Where offline mode is enabled, the app shall cache data locally.', 'the app')
    expect(parsed).toEqual({ ears_type: 'optional', action: 'cache data locally', feature: 'offline mode is enabled' })
  })

  it('two clauses → complex', () => {
    const parsed = parseEarsSentence('While in degraded mode, when a new request arrives, the service shall queue it.', 'the service')
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

  it('splits at the shall of the main clause, so "must" inside the condition clause does not confuse the split', () => {
    const parsed = parseEarsSentence('If the request must be retried, the system shall queue it.')
    expect(parsed).toEqual({
      ears_type: 'unwanted-behaviour',
      action: 'queue it',
      unwanted_condition: 'the request must be retried',
    })
  })

  // No word of a sentence is dropped: what the fields have no place for
  // stays in the action, as a clause of its own.
  const written = (sentence: string, subject?: string): string =>
    composeEarsSentence({ ...parseEarsSentence(sentence, subject) }, subject).sentence

  it('keeps a subject that is not the system, and says "shall" for must, should and will', () => {
    expect(parseEarsSentence('While the battery level is low, the device shall dim the screen.')).toEqual({
      ears_type: 'state-driven', action: 'the device shall dim the screen', precondition: 'the battery level is low',
    })
    expect(written('The Payments Service must reject a transfer above the daily limit')).toBe(
      'The Payments Service shall reject a transfer above the daily limit.',
    )
    expect(written('The system should encrypt data at rest')).toBe('The system shall encrypt data at rest.')
    expect(written('Users will be able to export their statements')).toBe('Users shall be able to export their statements.')
  })

  it('keeps the commas of a condition, and a condition that opens with no clause word', () => {
    expect(parseEarsSentence('When the user, being logged in, clicks save, the system shall persist the document')).toEqual({
      ears_type: 'event-driven', action: 'persist the document', trigger: 'the user, being logged in, clicks save',
    })
    expect(written('After three failed logins, the system shall lock the account')).toBe(
      'After three failed logins, the system shall lock the account.',
    )
    expect(written('In case of fire, the system shall unlock all doors')).toBe('In case of fire, the system shall unlock all doors.')
  })

  it('reads a sentence with no comma before "the system", in any case of letters', () => {
    expect(parseEarsSentence('When the user clicks save the system shall persist the document')).toEqual({
      ears_type: 'event-driven', action: 'persist the document', trigger: 'the user clicks save',
    })
    expect(parseEarsSentence('If the card is declined then the system shall keep the basket')).toEqual({
      ears_type: 'unwanted-behaviour', action: 'keep the basket', unwanted_condition: 'the card is declined',
    })
    expect(written('WHEN a payment fails THE SYSTEM SHALL retry it')).toBe('When a payment fails, the system shall retry it.')
    expect(parseEarsSentence('When the user, being logged in, clicks save the system shall persist the document')).toEqual({
      ears_type: 'event-driven', action: 'persist the document', trigger: 'the user, being logged in, clicks save',
    })
    // A subject that only ends in "the system" is a subject.
    expect(written('When a payment fails, the user that runs the system shall be told')).toBe(
      'When a payment fails, the user that runs the system shall be told.',
    )
  })

  it('keeps a sentence whole when it cannot tell the condition from the subject', () => {
    expect(parseEarsSentence('When a payment fails the gateway must retry it')).toEqual({
      ears_type: 'ubiquitous', action: 'When a payment fails the gateway shall retry it',
    })
  })

  it('takes a "shall" inside the action for part of the action', () => {
    expect(written('The system shall show a list of what the user shall pay')).toBe(
      'The system shall show a list of what the user shall pay.',
    )
  })

  it('reads the other ways a condition opens, and "and when" as a second condition', () => {
    expect(written('As soon as the order ships, the system shall e-mail the tracking link')).toBe(
      'When the order ships, the system shall e-mail the tracking link.',
    )
    expect(parseEarsSentence('While the account is locked and when the user signs in, the system shall show how to unlock it')).toEqual({
      ears_type: 'complex', action: 'show how to unlock it', precondition: 'the account is locked', trigger: 'the user signs in',
    })
  })

  it('leaves the action empty when nothing follows "shall"', () => {
    expect(parseEarsSentence('When a payment fails, the system shall:')).toEqual({
      ears_type: 'event-driven', action: '', trigger: 'a payment fails',
    })
  })

  it('roundtrips through composeEarsSentence back to an equivalent sentence', () => {
    const parsed = parseEarsSentence('When the user clicks save, the system shall persist the document.')
    const { sentence } = composeEarsSentence({ ...parsed })
    expect(sentence).toBe('When the user clicks save, the system shall persist the document.')
  })

  it('roundtrips an if+where complex sentence', () => {
    const parsed = parseEarsSentence('If the disk is full, where archiving is enabled, the system shall purge old logs.')
    const { sentence } = composeEarsSentence({ ...parsed })
    expect(sentence).toBe('If the disk is full, where archiving is enabled, the system shall purge old logs.')
  })
})

describe('requirementFromLine', () => {
  it('names an EARS sentence by its action and condition, and fills its fields', () => {
    expect(requirementFromLine('When the user clicks save, the system shall persist the document.')).toEqual({
      label: 'Persist the document when the user clicks save',
      fields: { ears_type: 'event-driven', trigger: 'the user clicks save', action: 'persist the document' },
    })
  })

  it('keeps a subject other than the system, so the sentence reads as written', () => {
    const { label, fields } = requirementFromLine('While offline, the wiki view shall show the last saved pages')
    expect(label).toBe('Show the last saved pages while offline')
    expect(fields.action).toBe('the wiki view shall show the last saved pages')
    expect(requirementFromLine('The system shall show a list of what the user shall pay').label).toBe(
      'Show a list of what the user shall pay',
    )
    expect(composeEarsSentence(fields).sentence).toBe('While offline, the wiki view shall show the last saved pages.')
  })

  it('names it by the action alone when the condition would make the name too long', () => {
    const { label } = requirementFromLine('If the daily limit of the account is exceeded by the amount of the transfer, the system shall refuse the transfer')
    expect(label).toBe('Refuse the transfer')
  })

  it('keeps a line that is no EARS sentence as its name, with no sentence made up', () => {
    expect(requirementFromLine('Users can reset their password')).toEqual({
      label: 'Users can reset their password',
      fields: {},
    })
  })

  it('keeps a long line whole in the description when its name is cut', () => {
    const line = 'Customers want to see every payment of the last two years in one list without paging through it'
    const { label, fields } = requirementFromLine(line)
    expect(label).toBe('Customers want to see every payment of the last two years in…')
    expect(fields).toEqual({ description: line })
  })
})

describe('labelFromText', () => {
  it('cuts at a word and drops closing punctuation', () => {
    expect(labelFromText('iOS app.')).toBe('iOS app')
    expect(labelFromText('one two three four', 12)).toBe('one two…')
  })
})

describe('"…, then the system shall …"', () => {
  // The sentence Studio itself composes for an unwanted-behaviour
  // requirement. With a comma before it, "then" was read as the end of the
  // condition: the condition was kept as "the daily limit is exceeded, then",
  // and each rewrite added one more ", then".
  const cases: Array<[string, Record<string, string>]> = [
    ['If the daily limit is exceeded, then the system shall refuse the transfer.',
      { ears_type: 'unwanted-behaviour', unwanted_condition: 'the daily limit is exceeded', action: 'refuse the transfer' }],
    ['When the user signs in, then the system shall show the dashboard.',
      { ears_type: 'event-driven', trigger: 'the user signs in', action: 'show the dashboard' }],
    ['While the engine runs, if the oil pressure drops, then the system shall stop the engine.',
      { precondition: 'the engine runs', unwanted_condition: 'the oil pressure drops', action: 'stop the engine' }],
  ]
  for (const [sentence, fields] of cases) {
    it(sentence, () => {
      const parsed = parseEarsSentence(sentence)
      expect(parsed).toMatchObject(fields)
      for (const value of Object.values(parsed)) {
        if (typeof value === 'string') expect(value).not.toMatch(/,?\s*then$/i)
      }
    })
  }

  it('written again without a change, it stays the sentence it was', () => {
    let fields: Record<string, unknown> = { ...parseEarsSentence('If the daily limit is exceeded, then the system shall refuse the transfer.') }
    const first = composeEarsSentence(fields).sentence
    for (let i = 0; i < 3; i++) fields = { ...parseEarsSentence(composeEarsSentence(fields).sentence) }
    expect(composeEarsSentence(fields).sentence).toBe(first)
    expect(first).toBe('If the daily limit is exceeded, then the system shall refuse the transfer.')
  })
})

describe('a state-driven requirement that points at a state', () => {
  // The wizard's Sentence step writes the precondition text, and the state
  // picked afterwards only stood in for an empty text: the sentence kept
  // the words typed and did not follow a rename of the state. The state
  // takes the place of the text, as the metamodel says.
  it('reads by the state, also when it has a precondition text', () => {
    const node = { ears_type: 'state-driven', precondition: 'the order is confirmed', action: 'ship the order' }
    expect(composeEarsSentence(node, undefined, 'the Order is Confirmed').sentence)
      .toBe('While the Order is Confirmed, the system shall ship the order.')
    expect(composeEarsSentence(node).sentence).toBe('While the order is confirmed, the system shall ship the order.')
  })
})
