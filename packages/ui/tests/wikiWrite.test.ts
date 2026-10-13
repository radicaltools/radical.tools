import { describe, it, expect } from 'vitest'
import { elementFromLine, writtenLines } from '../src/components/wikiWrite'

describe('writtenLines', () => {
  it('drops empty lines and the markers of the list the text was copied from', () => {
    expect(writtenLines('- one\n\n* two\r\n3. three\n4) four\n- [ ] five\n[x] six\n  • seven  ')).toEqual([
      'one', 'two', 'three', 'four', 'five', 'six', 'seven',
    ])
  })

  it('keeps a line that only starts like a marker', () => {
    expect(writtenLines('-5 degrees\n2024 was the year')).toEqual(['-5 degrees', '2024 was the year'])
  })
})

describe('elementFromLine', () => {
  it('reads a requirement as its sentence', () => {
    expect(elementFromLine('requirement', 'If the card is declined, the system shall keep the basket')).toEqual({
      label: 'Keep the basket if the card is declined',
      ears_type: 'unwanted-behaviour',
      unwanted_condition: 'the card is declined',
      action: 'keep the basket',
    })
  })

  it('names any other element by the line, as written', () => {
    expect(elementFromLine('container', 'iOS app')).toEqual({ label: 'iOS app' })
  })

  it('keeps a long line whole in the description', () => {
    const line = 'We need the monthly statement to reach every customer by post and by e-mail before the fifth working day'
    const element = elementFromLine('need', line)
    expect(element.label).toBe('We need the monthly statement to reach every customer by post…')
    expect(element.description).toBe(line)
  })
})
