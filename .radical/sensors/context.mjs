// What the sensors of .radical/sensors/sensors.json share: the --context
// radical sense run gives them, with the element's paths from the
// repository's .radical/radical.json (ADR The repository maps the model to
// its code), and the workspaces those paths are in.

import { existsSync } from 'node:fs'
import { dirname, join, relative } from 'node:path'

const ROOT = join(import.meta.dirname, '../..')

/** The --context radical sense run gives a sensor, or null without one. */
export function sensorContext(argv = process.argv.slice(2)) {
  const i = argv.indexOf('--context')
  return i < 0 ? null : JSON.parse(argv[i + 1])
}

/** The context's element; exits 2, naming the element, when the
 *  repository's .radical/radical.json gives it no paths. */
export function measuredElement(context) {
  const element = context?.element
  if (!element) fail('no element in --context: run this sensor with radical sense run')
  if (!element.paths?.length) fail(`no paths for ${element.type} "${element.label}" (${element.id}) in .radical/radical.json`, 2)
  return element
}

/** The workspaces the element's paths are in (the nearest package.json at or
 *  above each); '*' for one built from the repository's root. */
export function workspacesOf(element) {
  if (element.paths.some((path) => path === '.' || path === '')) return '*'
  const found = new Set()
  for (const path of element.paths) {
    for (let dir = join(ROOT, path); dir !== ROOT && dir.startsWith(ROOT); dir = dirname(dir)) {
      if (existsSync(join(dir, 'package.json'))) { found.add(relative(ROOT, dir).split('\\').join('/')); break }
    }
  }
  return [...found]
}

/** Says what is wrong and exits with `code`. */
export function fail(message, code = 1) {
  console.error(message)
  process.exit(code)
}
