import { describe, expect, it } from 'vitest'
import schema from '../examples/x.schema.json'
import { createValidator, validateDocument, type DocumentSchemas } from '../src/index.js'

const validate = createValidator({ x: schema })
const body = '## Overview\n\n## Details\n\n### Inputs\n\n### Outputs\n\n## Acceptance\n'
const wrap = (bodyText: string, type = 'x') => `---\ntype: ${type}\n---\n\n${bodyText}`
const check = (text: string) => validate({ uri: 'test.md', text })

describe('JSON Schema document rules', () => {
  it('accepts required headings and subheadings in order', () => {
    expect(check(wrap(body))).toEqual([])
  })

  it('selects schemas by exact type and supports multiple types', () => {
    const schemas: DocumentSchemas = { x: schema, note: {
      type: 'object', properties: { frontmatter: {
        type: 'object', required: ['owner'], properties: { owner: { type: 'string' } },
      } },
    } }
    expect(validateDocument({ uri: 'note.md', text: wrap('## Anything', 'note') }, schemas)
      .some(diagnostic => diagnostic.instancePath === '/frontmatter')).toBe(true)
    expect(check(wrap('## Anything', 'unconfigured'))).toEqual([])
    expect(check(wrap('## Anything', 'X'))).toEqual([])
    expect(check(wrap('## Anything'))).not.toEqual([])
  })

  it('reports missing top-level headings at the frontmatter', () => {
    const text = wrap(body.replace('## Acceptance\n', ''))
    const diagnostic = check(text).find(diagnostic => diagnostic.keyword === 'minItems')!
    expect(diagnostic.instancePath).toBe('/headings')
    expect(text.slice(diagnostic.range.start, diagnostic.range.end)).toBe('---\ntype: x\n---\n')
    expect(diagnostic.uri).toBe('test.md')
    expect(diagnostic.severity).toBe('error')
  })

  it('reports missing subheadings at their parent', () => {
    const text = wrap(body.replace('### Outputs\n', ''))
    const [diagnostic] = check(text)
    expect(diagnostic.keyword).toBe('minItems')
    expect(text.slice(diagnostic.range.start, diagnostic.range.end)).toBe('## Details')
  })

  it('reports swapped sections and subheadings through prefixItems', () => {
    const text = wrap('## Details\n### Outputs\n### Inputs\n## Overview\n## Acceptance')
    expect(check(text).some(diagnostic => diagnostic.instancePath === '/headings/0/title')).toBe(true)
    const swapped = wrap(body.replace('### Inputs\n\n### Outputs', '### Outputs\n\n### Inputs'))
    expect(check(swapped).filter(diagnostic => diagnostic.keyword === 'const')).toHaveLength(2)
  })

  it('does not accept subheadings under another parent or after another section', () => {
    for (const content of [
      '## Overview\n### Inputs\n### Outputs\n## Details\n## Acceptance',
      '## Overview\n## Details\n## Extra\n### Inputs\n### Outputs\n## Acceptance',
    ]) {
      expect(check(wrap(content)).some(diagnostic =>
        diagnostic.keyword === 'minItems' && diagnostic.instancePath === '/headings/1/children')).toBe(true)
    }
  })

  it('checks heading levels and points at the incorrect heading', () => {
    const text = wrap(body.replace('### Inputs', '#### Inputs'))
    const diagnostic = check(text).find(diagnostic => diagnostic.instancePath?.endsWith('/level'))!
    expect(diagnostic.keyword).toBe('const')
    expect(text.slice(diagnostic.range.start, diagnostic.range.end)).toBe('#### Inputs')
  })

  it('rejects duplicates and extra headings according to the example schema', () => {
    for (const extra of ['## Acceptance', '## Extra']) {
      const text = wrap(body + extra)
      const diagnostic = check(text).find(diagnostic => diagnostic.keyword === 'maxItems')!
      expect(text.slice(diagnostic.range.start, diagnostic.range.end)).toBe(extra)
    }
  })

  it('supports arbitrary standard schema constraints on frontmatter', () => {
    const validateOwner = createValidator({ x: {
      type: 'object', properties: { frontmatter: {
        type: 'object', required: ['owner'], properties: { owner: { enum: ['team-a', 'team-b'] } },
      } },
    } })
    expect(validateOwner({ uri: 'x.md', text: '---\ntype: x\nowner: team-a\n---' })).toEqual([])
    expect(validateOwner({ uri: 'x.md', text: '---\ntype: x\nowner: unknown\n---' })[0].keyword).toBe('enum')
  })

  it('reuses compiled schemas without retaining diagnostics between calls', () => {
    const text = wrap(body)
    expect(check(text.replace('### Outputs', '### Wrong'))).not.toEqual([])
    expect(check(text)).toEqual([])
  })
})

describe('Markdown parsing and locations', () => {
  it('ignores headings in fenced/indented code, blockquotes, lists, and HTML comments', () => {
    const fake = '```md\n## Overview\n```\n\n    ## Overview\n\n> ## Overview\n\n- ## Overview\n\n<!--\n## Overview\n-->\n'
    expect(check(wrap(fake + body))).toEqual([])
    expect(check(wrap(fake))).not.toEqual([])
  })

  it('supports setext headings, closing hashes, and inline formatting', () => {
    expect(check(wrap(body.replace('## Overview', '**Overview**\n------------')
      .replace('### Inputs', '### `Inputs` ###')))).toEqual([])
  })

  it('normalizes whitespace but keeps title case significant', () => {
    expect(check(wrap(body.replace('## Overview', '##   Overview   ')))).toEqual([])
    expect(check(wrap(body.replace('## Overview', '## overview')))).not.toEqual([])
  })

  it.each(['\n', '\r\n', '\r'])('preserves original UTF-16 offsets with %j line endings', newline => {
    const text = wrap('😀 Intro\n' + body.replace('### Inputs', '#### Inputs')).split('\n').join(newline)
    const diagnostic = check(text).find(diagnostic => diagnostic.instancePath?.endsWith('/level'))!
    expect(diagnostic.range).toEqual({
      start: text.indexOf('#### Inputs'), end: text.indexOf('#### Inputs') + '#### Inputs'.length,
    })
  })

  it('accepts a BOM and YAML end marker', () => {
    expect(check(`\uFEFF---\ntype: x\n...\n${body}`)).toEqual([])
  })

  it('retains a level-one document title in the heading tree', () => {
    const withTitle = createValidator({ x: {
      type: 'object', properties: { headings: {
        type: 'array', minItems: 1, maxItems: 1, prefixItems: [{
          type: 'object', properties: { level: { const: 1 }, children: schema.properties.headings },
        }],
      } },
    } })
    expect(withTitle({ uri: 'x.md', text: wrap('# Title\n' + body) })).toEqual([])
  })
})

describe('frontmatter', () => {
  it('ignores ordinary Markdown and does not require an id', () => {
    expect(check('')).toEqual([])
    expect(check('# Hello')).toEqual([])
    expect(check(wrap(body))).toEqual([])
  })

  it.each(['', '123', 'null', '[]', '{}', '" "'])('rejects invalid type %j', type => {
    expect(check(wrap(body, type)).map(diagnostic => diagnostic.code)).toEqual(['TYPE_MISSING'])
  })

  it('reports a missing type', () => {
    expect(check('---\nid: hello\n---\n')[0].code).toBe('TYPE_MISSING')
  })

  it.each(['---\ntype: [\n---\n', '---\ntype: x\ntype: y\n---\n', '---\n- x\n---\n', '---\n---\n'])
    ('reports malformed or non-mapping YAML', text => {
      const diagnostics = check(text)
      expect(diagnostics.length).toBeGreaterThan(0)
      expect(diagnostics.every(diagnostic => diagnostic.code === 'FRONTMATTER_INVALID')).toBe(true)
      expect(diagnostics.every(diagnostic => diagnostic.range.start >= 0 && diagnostic.range.end <= text.length)).toBe(true)
    })

  it('reports an unclosed frontmatter block', () => {
    expect(check('---\ntype: x')[0].code).toBe('FRONTMATTER_INVALID')
    expect(check('---')[0].code).toBe('FRONTMATTER_INVALID')
  })

  it('reports circular YAML aliases instead of allowing cyclic schema input', () => {
    expect(check('---\ntype: x\nloop: &loop { self: *loop }\n---')[0].code).toBe('FRONTMATTER_INVALID')
  })
})

describe('schema configuration', () => {
  it('resolves references to supplied schemas regardless of registration order', () => {
    const validate = createValidator({
      x: { $ref: 'urn:example:shape' },
      shape: { ...schema, $id: 'urn:example:shape' },
    })
    expect(validate({ uri: 'x.md', text: wrap(body) })).toEqual([])
  })

  it('throws at creation for invalid schemas and unsupported keywords', () => {
    expect(() => createValidator({ x: { type: 'nonexistent' } })).toThrow()
    expect(() => createValidator({ x: { magicHeadings: true } })).toThrow()
  })

  it('rejects async schemas and unresolved remote references', () => {
    expect(() => createValidator({ x: { $async: true, type: 'object' } })).toThrow('synchronous')
    expect(() => createValidator({ x: { $ref: 'https://example.test/schema' } })).toThrow()
  })
})
