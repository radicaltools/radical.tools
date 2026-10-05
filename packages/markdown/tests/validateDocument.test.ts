import { describe, expect, it } from 'vitest'
import { lint } from 'markdownlint/sync'
import config from '../examples/config.json'
import { createValidator, validateDocument, type MarkdownlintRule, type ValidatorOptions } from '../src/index.js'

const body = '# Example document\n\n## Overview\n\n## Details\n\n### Inputs\n\n### Outputs\n\n## Acceptance\n'
const wrap = (content: string, type = 'x') => `---\ntype: ${type}\n---\n\n${content}`
const headingOptions: ValidatorOptions = {
  markdownlint: { default: false }, types: config.types,
}
const checkHeadings = (text: string) => validateDocument({ uri: 'test.md', text }, headingOptions)
const check = (text: string, options: ValidatorOptions = {}) => validateDocument({ uri: 'test.md', text }, options)
const metadataOnly = { markdownlint: { default: false } }

describe('markdownlint defaults', () => {
  it('matches upstream defaults for ordinary Markdown', () => {
    const text = '# Hello\n\nText with trailing spaces   \n'
    const upstream = lint({ strings: { document: text } }).document
    expect(check(text).map(diagnostic => diagnostic.code)).toEqual(upstream.map(error => error.ruleNames[0]))
    expect(check(text).some(diagnostic => diagnostic.code === 'MD009')).toBe(true)
    expect(check(text).every(diagnostic => diagnostic.source === 'markdownlint')).toBe(true)
  })

  it('lints documents without type metadata and unknown document types', () => {
    expect(check('Hello\n').some(diagnostic => diagnostic.code === 'MD041')).toBe(true)
    expect(check(wrap('Hello\n', 'unknown'), headingOptions)).toEqual([])
    expect(check(wrap('Hello\n', 'unknown')).some(diagnostic => diagnostic.code === 'MD041')).toBe(true)
  })

  it('accepts caller configuration and preserves upstream severities', () => {
    expect(check('# Hello\n\nText   \n', { markdownlint: { MD009: false } })).toEqual([])
    const [diagnostic] = check('# Hello\n\nText   \n', { markdownlint: { default: false, MD009: 'warning' } })
    expect(diagnostic.code).toBe('MD009')
    expect(diagnostic.severity).toBe('warning')
  })

  it('supports upstream inline rule suppression', () => {
    expect(check('# Hello\n\n<!-- markdownlint-disable MD009 -->\nText   \n')).toEqual([])
  })
})

describe('type-specific rules built on MD043', () => {
  it('accepts the example with upstream defaults plus type overrides', () => {
    expect(check(wrap(body), config)).toEqual([])
  })

  it('reports incorrect heading order, nesting levels, names, and missing headings', () => {
    for (const invalid of [
      body.replace('## Overview\n\n## Details', '## Details\n\n## Overview'),
      body.replace('### Inputs', '#### Inputs'),
      body.replace('### Inputs\n\n### Outputs', '### Outputs\n\n### Inputs'),
      body.replace('### Inputs', '### Unknown'),
      body.replace('## Acceptance\n', ''),
      body.replace('## Details\n\n### Inputs\n\n### Outputs', '### Inputs\n\n### Outputs\n\n## Details'),
    ]) {
      expect(checkHeadings(wrap(invalid)).map(diagnostic => diagnostic.code)).toEqual(['MD043'])
    }
  })

  it('reports an extra or duplicate heading', () => {
    expect(checkHeadings(wrap(body + '\n## Overview\n'))[0].code).toBe('MD043')
  })

  it('keeps base rules active while adding or overriding a type rule', () => {
    const text = wrap(body.replace('## Overview', '## overview') + '\nTrailing spaces   \n')
    const diagnostics = check(text, { ...config, markdownlint: { MD013: false } })
    expect(diagnostics.some(diagnostic => diagnostic.code === 'MD043')).toBe(true)
    expect(diagnostics.some(diagnostic => diagnostic.code === 'MD009')).toBe(true)
    const options: ValidatorOptions = { ...config, markdownlint: { MD009: false }, types: {
      ...config.types, x: { markdownlint: { ...config.types.x.markdownlint, MD009: true } },
    } }
    expect(check(text, options).some(diagnostic => diagnostic.code === 'MD009')).toBe(true)
  })

  it('selects by exact type and isolates types from one another', () => {
    const options: ValidatorOptions = { ...headingOptions, types: {
      ...config.types, decision: { markdownlint: { MD043: { headings: ['# Decision'] } } },
    } }
    expect(check(wrap('# Decision\n', 'decision'), options)).toEqual([])
    expect(check(wrap(body), options)).toEqual([])
    expect(check(wrap('# Anything\n', 'X'), options)).toEqual([])
  })

  it('supports MD043 wildcard headings', () => {
    const options: ValidatorOptions = { markdownlint: {
      default: false, MD043: { headings: ['?', '## Overview', '*', '## Acceptance'], match_case: true },
    } }
    expect(check('# Any title\n\n## Overview\n\n### Optional\n\n## Acceptance\n', options)).toEqual([])
  })

  it('reuses a validator without carrying type settings between documents', () => {
    const validate = createValidator(headingOptions)
    expect(validate({ uri: 'x.md', text: wrap('# Wrong\n') })[0].code).toBe('MD043')
    expect(validate({ uri: 'plain.md', text: '# Wrong\n' })).toEqual([])
    expect(validate({ uri: 'x.md', text: wrap(body) })).toEqual([])
  })
})

describe('diagnostic locations', () => {
  it.each(['\n', '\r\n', '\r'])('preserves UTF-16 offsets and frontmatter lines with %j endings', newline => {
    const text = wrap(body.replace('### Inputs', '#### Inputs')).split('\n').join(newline)
    const [diagnostic] = checkHeadings(text)
    expect(text.slice(diagnostic.range.start, diagnostic.range.end)).toBe('#### Inputs')
    expect(diagnostic.range.start).toBe(text.indexOf('#### Inputs'))
    expect(diagnostic.uri).toBe('test.md')
  })

  it('preserves ranges after non-ASCII text and a BOM', () => {
    const text = '\uFEFF# Hello\n\n😀 text   \n'
    const [diagnostic] = check(text, { markdownlint: { default: false, MD009: true } })
    expect(text.slice(diagnostic.range.start, diagnostic.range.end)).toBe('   ')
    expect(diagnostic.range.start).toBe(text.indexOf('   '))
  })

  it('maps columns on the first line with a BOM', () => {
    const text = '\uFEFF# Hello   \n'
    const [diagnostic] = check(text, { markdownlint: { default: false, MD009: true } })
    expect(text.slice(diagnostic.range.start, diagnostic.range.end)).toBe('   ')
  })

  it('keeps ranges bounded for an empty file and missing headings at EOF', () => {
    for (const text of ['', wrap(body.replace('## Acceptance\n', ''))]) {
      expect(checkHeadings(text).every(diagnostic =>
        diagnostic.range.start >= 0 && diagnostic.range.start <= diagnostic.range.end && diagnostic.range.end <= text.length)).toBe(true)
    }
  })
})

describe('optional frontmatter schemas', () => {
  const schema = { type: 'object', required: ['owner'], properties: { owner: { enum: ['team-a', 'team-b'] } } }

  it('validates frontmatter directly with a type-specific schema', () => {
    const options = { ...metadataOnly, types: { x: { frontmatterSchema: schema } } }
    expect(check('---\ntype: x\nowner: team-a\n---', options)).toEqual([])
    const [diagnostic] = check('---\ntype: x\nowner: unknown\n---', options)
    expect(diagnostic.source).toBe('frontmatter')
    expect(diagnostic.code).toBe('SCHEMA_VALIDATION')
    expect(diagnostic.instancePath).toBe('/owner')
    expect(diagnostic.keyword).toBe('enum')
  })

  it('can require metadata for plain Markdown through the base schema', () => {
    const [diagnostic] = check('# Plain\n', { ...metadataOnly, frontmatterSchema: schema })
    expect(diagnostic.keyword).toBe('required')
    expect(diagnostic.range).toEqual({ start: 0, end: 0 })
  })

  it('applies both base and selected type schemas', () => {
    const options: ValidatorOptions = { ...metadataOnly, frontmatterSchema: schema, types: { x: {
      frontmatterSchema: { type: 'object', required: ['status'], properties: { status: { type: 'string' } } },
    } } }
    expect(check(wrap(body), options).map(diagnostic => diagnostic.keyword)).toEqual(['required', 'required'])
  })

  it('throws for invalid schemas and unresolved references during creation', () => {
    expect(() => createValidator({ frontmatterSchema: { type: 'nonexistent' } })).toThrow()
    expect(() => createValidator({ frontmatterSchema: { $ref: 'https://example.test/schema' } })).toThrow()
    expect(() => createValidator({ frontmatterSchema: { $async: true, type: 'object' } })).toThrow('synchronous')
  })
})

describe('frontmatter parsing', () => {
  it('allows absent type, absent id, and empty metadata', () => {
    expect(check('---\nowner: team-a\n---\n\n# Hello\n')).toEqual([])
    expect(check(wrap(body), config)).toEqual([])
    expect(check('---\n---\n\n# Hello\n')).toEqual([])
  })

  it.each(['null', '123', '[]', '{}', '" "'])('rejects a supplied invalid type %j', type => {
    expect(check(wrap(body, type), metadataOnly)[0].code).toBe('TYPE_INVALID')
  })

  it.each(['---\ntype: [\n---\n', '---\ntype: x\ntype: y\n---\n', '---\n- x\n---\n', '---\ntype: x', '---\ntype: x\nloop: &loop { self: *loop }\n---'])
    ('reports malformed frontmatter', text => {
      const diagnostics = check(text, metadataOnly)
      expect(diagnostics.length).toBeGreaterThan(0)
      expect(diagnostics.every(diagnostic => diagnostic.code === 'FRONTMATTER_INVALID')).toBe(true)
    })

  it('continues base linting after malformed YAML without cascading schema failures', () => {
    const diagnostics = check('---\ntype: [\n---\n\n# Hello   \n', { frontmatterSchema: { type: 'object' } })
    expect(diagnostics.some(diagnostic => diagnostic.code === 'FRONTMATTER_INVALID')).toBe(true)
    expect(diagnostics.some(diagnostic => diagnostic.code === 'MD009')).toBe(true)
    expect(diagnostics.some(diagnostic => diagnostic.code === 'SCHEMA_VALIDATION')).toBe(false)
  })
})

describe('company extensions', () => {
  it('runs standard markdownlint custom rules with the same diagnostic contract', () => {
    const companyRule: MarkdownlintRule = {
      names: ['COMPANY001', 'company-no-todo'], description: 'Unresolved company TODO', tags: ['company'],
      parser: 'micromark', function: (params, onError) => {
        if (params.lines[0].includes('TODO')) onError({ lineNumber: 1 })
      },
    }
    const [diagnostic] = check('# TODO\n', { markdownlint: { default: false, COMPANY001: true }, customRules: [companyRule] })
    expect(diagnostic.code).toBe('COMPANY001')
    expect(diagnostic.source).toBe('markdownlint')
    expect(diagnostic.range).toEqual({ start: 0, end: '# TODO'.length })
  })
})
