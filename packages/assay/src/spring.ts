// Radical Assay: a Spring Cloud Config server's files are other applications' configuration. Each file in its
// search locations (classpath:/shared) is the configuration of the application it is named for, and
// application.yml that of every application taking its configuration from the server.

import { basename } from 'node:path'
import type { Unit } from './facts'
import { dirOf, owner, type RepoFiles } from './files'
import { load } from './yaml'

/** A Spring Boot unit's own settings files. */
const SETTINGS = /(^|\/)(application|bootstrap)(-[\w-]+)?\.(ya?ml|properties)$/

/** What a settings text sets at a dotted key (spring.application.name), in YAML or properties. */
function setting(text: string, key: string): string | undefined {
  const property = new RegExp(`^\\s*${key.replace(/\./g, '\\.')}\\s*[=:]\\s*(\\S+)`, 'm').exec(text)?.[1]
  if (property) return property
  try {
    let value: unknown = load(text)
    for (const k of key.split('.')) value = value && typeof value === 'object' ? (value as Record<string, unknown>)[k] : undefined
    return typeof value === 'string' ? value : undefined
  } catch { return undefined }
}

/** Settings a client library reads, by their key, and the dependencies that bring the library. */
const LIBRARY_SETTINGS: Array<[RegExp, RegExp]> = [
  [/^spring\.rabbitmq\b/, /amqp|rabbit/i],
  [/^spring\.(data\.)?mongodb\b/, /mongo/i],
  [/^spring\.(data\.)?redis\b/, /redis/i],
  [/^spring\.kafka\b/, /kafka/i],
  [/^spring\.datasource\b/, /jdbc|jpa|r2dbc|mybatis|hibernate/i],
  [/^eureka\.client\b/, /eureka/i],
  [/^(spring\.)?security\.oauth2\b/, /oauth2/i],
]

/** The dotted key each line of a YAML or properties text sets or lies under. */
function keysOf(text: string): string[] {
  const stack: Array<{ indent: number; key: string }> = []
  return text.split('\n').map((line) => {
    const property = /^\s*([\w.-]+)\s*[=:]/.exec(line)
    const yaml = /^(\s*)(?:-\s+)?([\w.-]+)\s*:/.exec(line)
    if (yaml) {
      const indent = yaml[1].length
      while (stack.length && stack[stack.length - 1].indent >= indent) stack.pop()
      stack.push({ indent, key: yaml[2] })
      return stack.map((s) => s.key).join('.')
    }
    if (property && /=/.test(line)) return property[1]
    return stack.map((s) => s.key).join('.')
  })
}

/** A config server's file as the unit reads it: the settings of client libraries the unit does not depend on left out
 *  (lines emptied, so lines keep their numbers). */
export function settingsFor(files: RepoFiles, file: string, unit: Unit): string {
  const text = files.read(file)
  const prefix = unit.path === '.' ? '' : `${unit.path}/`
  const manifest = ['pom.xml', 'build.gradle', 'build.gradle.kts'].map((m) => files.read(`${prefix}${m}`)).join('\n')
  const keys = keysOf(text)
  return text.split('\n').map((line, i) => (LIBRARY_SETTINGS.some(([key, library]) => key.test(keys[i]) && !library.test(manifest)) ? '' : line)).join('\n')
}

const read = new WeakMap<RepoFiles, Map<string, Unit[]>>()

/** The units each file of a config server's search locations configures (none: a file of no other unit). */
export function springConfigOwners(files: RepoFiles, units: Unit[]): Map<string, Unit[]> {
  const known = read.get(files)
  if (known) return known
  const out = new Map<string, Unit[]>()
  read.set(files, out)
  const own = (u: Unit): string[] => files.list.filter((f) => owner(units, f)?.id === u.id)
  const settings = new Map(units.map((u) => [u.id, own(u).filter((f) => SETTINGS.test(f) && !/\/test\//.test(f))]))
  const servers = units.filter((u) => own(u).some((f) => /\.(java|kt)$/.test(f) && /@EnableConfigServer\b/.test(files.read(f))))
  if (!servers.length) return out
  // The application each unit is, and whether it takes its configuration from a config server.
  const nameOf = new Map<string, string>()
  const clients = new Set<string>()
  for (const u of units) {
    for (const f of settings.get(u.id) ?? []) {
      const text = files.read(f)
      const name = setting(text, 'spring.application.name')
      if (name && !nameOf.has(u.id)) nameOf.set(u.id, name)
      if (setting(text, 'spring.cloud.config.uri') || /configserver:/.test(setting(text, 'spring.config.import') ?? '')) clients.add(u.id)
    }
  }
  for (const server of servers) {
    const root = server.path === '.' ? '' : `${server.path}/`
    const locations = (settings.get(server.id) ?? []).flatMap((f) => (setting(files.read(f), 'spring.cloud.config.server.native.search-locations') ?? '').split(','))
      .map((l) => /^classpath:\/?(.*?)\/?$/.exec(l.trim())?.[1]).filter((l): l is string => l !== undefined)
      .map((l) => `${root}src/main/resources${l ? `/${l}` : ''}`)
    for (const file of files.list.filter((f) => locations.includes(dirOf(f)) && /\.(ya?ml|properties)$/.test(f))) {
      // The server's own settings beside them stay its own.
      if ((settings.get(server.id) ?? []).includes(file) && !/(^|\/)shared\//.test(file)) continue
      const name = basename(file).replace(/\.(ya?ml|properties)$/, '')
      const configured = name === 'application'
        ? units.filter((u) => u.id !== server.id && clients.has(u.id))
        : units.filter((u) => u.id !== server.id && [...nameOf.entries()].some(([id, n]) => id === u.id && (name === n || name.startsWith(`${n}-`))))
      out.set(file, configured)
    }
  }
  return out
}
