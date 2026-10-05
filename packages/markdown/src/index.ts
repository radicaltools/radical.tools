import { Ajv2020, type AnySchema, type ErrorObject } from 'ajv/dist/2020.js'
import { fromMarkdown } from 'mdast-util-from-markdown'
import { isMap, parseDocument } from 'yaml'

/** Zero-based UTF-16 offsets into the original text. End is exclusive. */
export interface SourceRange {
  start: number
  end: number
}

export interface MarkdownDocument {
  uri: string
  text: string
}

export interface Heading {
  title: string
  level: number
  children: Heading[]
}

/** The JSON representation evaluated by a document's schema. */
export interface DocumentStructure {
  frontmatter: Record<string, unknown>
  headings: Heading[]
}

export type JsonSchema = AnySchema
/** Keys match frontmatter.type exactly. Schemas use JSON Schema draft 2020-12. */
export type DocumentSchemas = Readonly<Record<string, JsonSchema>>

export interface Diagnostic {
  code: 'FRONTMATTER_INVALID' | 'TYPE_MISSING' | 'SCHEMA_VALIDATION'
  message: string
  severity: 'error'
  uri: string
  range: SourceRange
  /** JSON Pointer into DocumentStructure, for schema diagnostics. */
  instancePath?: string
  schemaPath?: string
  keyword?: string
}

interface TextNode {
  type: string
  value?: string
  alt?: string | null
  children?: readonly TextNode[]
}

const headingText = (node: TextNode): string =>
  node.children ? node.children.map(headingText).join('') : node.value ?? node.alt ?? ''

function locateError(error: ErrorObject, ranges: Map<string, SourceRange>): SourceRange {
  let path = error.instancePath
  // Point at the first excess heading, rather than only its parent section.
  if (error.keyword === 'maxItems' || error.keyword === 'items') {
    const extra = `${path}/${error.params.limit}`
    if (ranges.has(extra)) path = extra
  }
  while (!ranges.has(path)) path = path.slice(0, path.lastIndexOf('/'))
  return ranges.get(path)!
}

/**
 * Compile schemas once, then validate document text on each editor change.
 * Invalid schemas throw during creation. Invalid documents return diagnostics.
 * No filesystem access, editor dependency, or remote schema loading is performed.
 */
export function createValidator(schemas: DocumentSchemas = {}): (document: MarkdownDocument) => Diagnostic[] {
  const ajv = new Ajv2020({ allErrors: true, strict: true })
  for (const [type, schema] of Object.entries(schemas)) ajv.addSchema(schema, type)
  const validators = new Map(Object.keys(schemas).map(type => {
    const validator = ajv.getSchema(type)!
    if ('$async' in validator && validator.$async) throw new TypeError('Document schemas must be synchronous.')
    return [type, validator] as const
  }))

  return ({ text, uri }) => {
    const diagnostics: Diagnostic[] = []
    const report = (code: Diagnostic['code'], message: string, range: SourceRange): void => {
      diagnostics.push({ code, message, severity: 'error', uri, range })
    }
    const opening = /^(?:\uFEFF)?---[ \t]*(?:\r\n|\n|\r|$)/.exec(text)
    if (!opening) return diagnostics
    const yamlStart = opening[0].length
    const closing = /^(?:---|\.\.\.)[ \t]*(?:\r\n|\n|\r|$)/m.exec(text.slice(yamlStart))
    if (!closing) {
      report('FRONTMATTER_INVALID', 'Frontmatter is missing its closing delimiter.', { start: 0, end: yamlStart })
      return diagnostics
    }
    const yamlEnd = yamlStart + closing.index
    const bodyStart = yamlEnd + closing[0].length
    const frontmatterRange = { start: 0, end: bodyStart }
    // Normalize bare CR without changing string length or source offsets.
    const yaml = parseDocument(text.slice(yamlStart, yamlEnd).replace(/\r(?!\n)/g, '\n'))
    if (yaml.errors.length) {
      for (const error of yaml.errors) {
        report('FRONTMATTER_INVALID', error.message, {
          start: Math.min(yamlStart + error.pos[0], yamlEnd),
          end: Math.min(yamlStart + error.pos[1], yamlEnd),
        })
      }
      return diagnostics
    }
    if (!isMap(yaml.contents)) {
      report('FRONTMATTER_INVALID', 'Frontmatter must be a YAML mapping.', frontmatterRange)
      return diagnostics
    }
    let frontmatter: Record<string, unknown>
    try {
      // JSON Schema consumes JSON data, so circular YAML aliases are invalid here.
      frontmatter = JSON.parse(JSON.stringify(yaml.toJS({ maxAliasCount: 100 }))) as Record<string, unknown>
    } catch {
      report('FRONTMATTER_INVALID', 'Frontmatter could not be resolved safely.', frontmatterRange)
      return diagnostics
    }
    if (typeof frontmatter.type !== 'string' || !frontmatter.type.trim()) {
      report('TYPE_MISSING', 'Frontmatter field "type" must be a non-empty string.', frontmatterRange)
      return diagnostics
    }
    const validator = validators.get(frontmatter.type)
    if (!validator) return diagnostics

    const headings: Heading[] = []
    const stack: Heading[] = []
    const headingRanges = new Map<Heading, SourceRange>()
    for (const node of fromMarkdown(text.slice(bodyStart)).children) {
      // Only document-level headings count; headings inside quotes, lists, or code do not.
      if (node.type !== 'heading') continue
      const heading: Heading = {
        title: headingText(node).trim().replace(/\s+/g, ' '),
        level: node.depth,
        children: [],
      }
      while (stack.length && stack[stack.length - 1].level >= heading.level) stack.pop()
      const siblings = stack.length ? stack[stack.length - 1].children : headings
      siblings.push(heading)
      stack.push(heading)
      headingRanges.set(heading, {
        start: bodyStart + (node.position?.start.offset ?? 0),
        end: bodyStart + (node.position?.end.offset ?? 0),
      })
    }
    const ranges = new Map<string, SourceRange>([
      ['', frontmatterRange], ['/frontmatter', frontmatterRange], ['/headings', frontmatterRange],
    ])
    const mapRanges = (nodes: Heading[], path: string): void => {
      nodes.forEach((heading, index) => {
        const headingPath = `${path}/${index}`
        ranges.set(headingPath, headingRanges.get(heading)!)
        ranges.set(`${headingPath}/children`, headingRanges.get(heading)!)
        mapRanges(heading.children, `${headingPath}/children`)
      })
    }
    mapRanges(headings, '/headings')
    const structure: DocumentStructure = { frontmatter, headings }
    if (!validator(structure)) {
      for (const error of validator.errors ?? []) {
        const detail = error.keyword === 'const' ? ` ${JSON.stringify(error.params.allowedValue)}` : ''
        diagnostics.push({
          code: 'SCHEMA_VALIDATION',
          message: `${error.instancePath || '/'}: ${error.message ?? 'Schema validation failed'}${detail}`,
          severity: 'error', uri,
          range: locateError(error, ranges),
          instancePath: error.instancePath,
          schemaPath: error.schemaPath,
          keyword: error.keyword,
        })
      }
    }
    return diagnostics
  }
}

/** Convenience for one-off validation. Use createValidator to reuse compiled schemas. */
export function validateDocument(document: MarkdownDocument, schemas: DocumentSchemas = {}): Diagnostic[] {
  return createValidator(schemas)(document)
}
