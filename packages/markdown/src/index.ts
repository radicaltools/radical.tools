import { Ajv2020, type AnySchema } from 'ajv/dist/2020.js'
import type { Configuration, Rule } from 'markdownlint'
import { lint } from 'markdownlint/sync'
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

export type JsonSchema = AnySchema
export type MarkdownlintConfig = Configuration
export type MarkdownlintRule = Rule

export interface TypeRules {
  /** Standard markdownlint configuration, overriding the base configuration per rule. */
  markdownlint?: MarkdownlintConfig
  /** Optional JSON Schema draft 2020-12 applied directly to frontmatter. */
  frontmatterSchema?: JsonSchema
}

export interface ValidatorOptions {
  /** Standard markdownlint configuration. Omit to use upstream defaults. */
  markdownlint?: MarkdownlintConfig
  /** Type keys match frontmatter.type exactly. Unknown and absent types use base rules. */
  types?: Readonly<Record<string, TypeRules>>
  /** Optional metadata schema applied to every document, including plain Markdown as {}. */
  frontmatterSchema?: JsonSchema
  /** Standard markdownlint custom rules for company-specific extensions. */
  customRules?: readonly MarkdownlintRule[]
}

export interface Diagnostic {
  code: string
  source: 'markdownlint' | 'frontmatter'
  message: string
  severity: 'error' | 'warning'
  uri: string
  range: SourceRange
  /** JSON Pointer into frontmatter, for schema diagnostics. */
  instancePath?: string
  schemaPath?: string
  keyword?: string
}

interface FrontmatterResult {
  value: Record<string, unknown>
  range: SourceRange
  diagnostics: Diagnostic[]
}

function readFrontmatter({ uri, text }: MarkdownDocument): FrontmatterResult {
  const result: FrontmatterResult = { value: {}, range: { start: 0, end: 0 }, diagnostics: [] }
  const report = (code: string, message: string, range = result.range): void => {
    result.diagnostics.push({ code, source: 'frontmatter', message, severity: 'error', uri, range })
  }
  const opening = /^(?:\uFEFF)?---[ \t]*(?:\r\n|\n|\r|$)/.exec(text)
  if (!opening) return result
  const yamlStart = opening[0].length
  const closing = /^(?:---|\.\.\.)[ \t]*(?:\r\n|\n|\r|$)/m.exec(text.slice(yamlStart))
  result.range = { start: 0, end: yamlStart }
  if (!closing) {
    report('FRONTMATTER_INVALID', 'Frontmatter is missing its closing delimiter.')
    return result
  }
  const yamlEnd = yamlStart + closing.index
  result.range.end = yamlEnd + closing[0].length
  // Normalize bare CR without changing YAML source offsets.
  const yaml = parseDocument(text.slice(yamlStart, yamlEnd).replace(/\r(?!\n)/g, '\n'))
  if (yaml.errors.length) {
    for (const error of yaml.errors) {
      report('FRONTMATTER_INVALID', error.message, {
        start: Math.min(yamlStart + error.pos[0], yamlEnd),
        end: Math.min(yamlStart + error.pos[1], yamlEnd),
      })
    }
    return result
  }
  // An empty frontmatter block is equivalent to absent metadata.
  if (yaml.contents === null) return result
  if (!isMap(yaml.contents)) {
    report('FRONTMATTER_INVALID', 'Frontmatter must be a YAML mapping.')
    return result
  }
  try {
    result.value = JSON.parse(JSON.stringify(yaml.toJS({ maxAliasCount: 100 }))) as Record<string, unknown>
  } catch {
    report('FRONTMATTER_INVALID', 'Frontmatter could not be resolved safely.')
  }
  return result
}

/**
 * Build a reusable validator: markdownlint defaults, type overrides, optional metadata schemas.
 * Configuration errors throw; document errors return diagnostics. No files or remote schemas are loaded.
 */
export function createValidator(options: ValidatorOptions = {}): (document: MarkdownDocument) => Diagnostic[] {
  const baseConfig = { ...options.markdownlint }
  const types = new Map(Object.entries(options.types ?? {}))
  const ajv = new Ajv2020({ allErrors: true, strict: true })
  if (options.frontmatterSchema !== undefined) ajv.addSchema(options.frontmatterSchema, 'base')
  for (const [type, rules] of types) {
    if (rules.frontmatterSchema !== undefined) ajv.addSchema(rules.frontmatterSchema, `type:${type}`)
  }
  const schemaKeys = [
    ...(options.frontmatterSchema !== undefined ? ['base'] : []),
    ...[...types].filter(([, rules]) => rules.frontmatterSchema !== undefined).map(([type]) => `type:${type}`),
  ]
  const schemas = new Map(schemaKeys.map(key => {
    const validator = ajv.getSchema(key)!
    if ('$async' in validator && validator.$async) throw new TypeError('Frontmatter schemas must be synchronous.')
    return [key, validator] as const
  }))

  return document => {
    const { text, uri } = document
    const frontmatter = readFrontmatter(document)
    const diagnostics = [...frontmatter.diagnostics]
    const type = frontmatter.value.type
    if (type !== undefined && (typeof type !== 'string' || !type.trim())) {
      diagnostics.push({
        code: 'TYPE_INVALID', source: 'frontmatter',
        message: 'Frontmatter field "type" must be a non-empty string when supplied.',
        severity: 'error', uri, range: frontmatter.range,
      })
    }
    const typeRules = typeof type === 'string' ? types.get(type) : undefined
    const config = { ...baseConfig, ...typeRules?.markdownlint }
    // Normalize input for the engine; map its line/column results back to the original text.
    const bomLength = text.startsWith('\uFEFF') ? 1 : 0
    const lintText = text.slice(bomLength).replace(/\r\n|\r/g, '\n')
    const lineStarts = [0]
    for (const match of text.matchAll(/\r\n|\r|\n/g)) lineStarts.push(match.index! + match[0].length)
    const lines = text.split(/\r\n|\r|\n/)
    const errors = lint({
      strings: { document: lintText }, config,
      customRules: options.customRules ? [...options.customRules] : undefined,
      frontMatter: /^---[ \t]*\n[\s\S]*?^(?:---|\.\.\.)[ \t]*(?:\n|$)/m,
    }).document
    for (const error of errors) {
      const index = Math.max(0, Math.min(error.lineNumber - 1, lines.length - 1))
      const lineStart = lineStarts[index] + (index === 0 ? bomLength : 0)
      const lineEnd = lineStarts[index] + lines[index].length
      const start = Math.min(lineStart + (error.errorRange ? error.errorRange[0] - 1 : 0), lineEnd)
      const end = error.errorRange ? Math.min(start + error.errorRange[1], lineEnd) : lineEnd
      diagnostics.push({
        code: error.ruleNames[0], source: 'markdownlint',
        message: error.ruleDescription + (error.errorDetail ? `: ${error.errorDetail}` : ''),
        severity: error.severity, uri, range: { start, end },
      })
    }
    // Malformed YAML already has parser diagnostics; avoid cascading schema failures.
    if (!frontmatter.diagnostics.length) {
      for (const key of ['base', ...(typeRules ? [`type:${type}`] : [])]) {
        const validator = schemas.get(key)
        if (!validator || validator(frontmatter.value)) continue
        for (const error of validator.errors ?? []) {
          const detail = error.keyword === 'const' ? ` ${JSON.stringify(error.params.allowedValue)}` : ''
          diagnostics.push({
            code: 'SCHEMA_VALIDATION', source: 'frontmatter',
            message: `${error.instancePath || '/'}: ${error.message ?? 'Schema validation failed'}${detail}`,
            severity: 'error', uri, range: frontmatter.range,
            instancePath: error.instancePath, schemaPath: error.schemaPath, keyword: error.keyword,
          })
        }
      }
    }
    return diagnostics
  }
}

/** Convenience for one-off validation. Use createValidator for repeated editor changes. */
export function validateDocument(document: MarkdownDocument, options: ValidatorOptions = {}): Diagnostic[] {
  return createValidator(options)(document)
}
