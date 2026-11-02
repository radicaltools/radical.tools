import { readFile } from 'node:fs/promises'
import { commandWords, isSensorName } from '@radical/common/check'
import { OLD_SENSORS_FILE, SENSORS_FILE, findRepositoryFile, repositoryFileRoot } from '@radical/node-files/repositoryLayout'

export { SENSORS_FILE }

/** A sensor of the repository: a command it runs, or a built-in adapter of
 *  radical sense and the arguments it runs it with. */
export type RepositorySensor = { command: string[] } | { adapter: string; args: string[] }

/** The repository's sensors: in .radical/sensors/sensors.json, or
 *  radical.sensors.json at the root of the old layout, the nearest from the
 *  model folder up to the repository's root; none without one. Each names
 *  its command or its adapter and arguments, run from `root` (the
 *  repository's root): `{ "sensors": { "<name>": { "command": "<command
 *  line>" }, "<name>": { "adapter": "playwright", "args": ["…"] } } }`. */
export async function repositorySensors(folder: string): Promise<{ file: string; root: string; sensors: Record<string, RepositorySensor> } | null> {
  const found = await findRepositoryFile(folder, SENSORS_FILE, OLD_SENSORS_FILE)
  if (!found) return null
  const file = found.path
  let raw: unknown
  try { raw = JSON.parse(await readFile(file, 'utf8')) } catch (error) { throw new Error(`${file}: ${(error as Error).message}`) }
  const listed = (raw as { sensors?: unknown })?.sensors
  if (!listed || typeof listed !== 'object') throw new Error(`${file}: no "sensors" object`)
  const words = (v: unknown): string[] | null =>
    typeof v === 'string' ? commandWords(v) : Array.isArray(v) && v.every((w) => typeof w === 'string') ? v as string[] : null
  const sensors: Record<string, RepositorySensor> = {}
  for (const [name, sensor] of Object.entries(listed as Record<string, { command?: unknown; adapter?: unknown; args?: unknown }>)) {
    if (typeof sensor?.adapter === 'string') {
      if (!isSensorName(sensor.adapter)) throw new Error(`${file}: sensor ${name} names no adapter of radical sense: ${sensor.adapter}`)
      const args = sensor.args === undefined ? [] : words(sensor.args)
      if (!args) throw new Error(`${file}: sensor ${name}'s args are no list of words`)
      sensors[name] = { adapter: sensor.adapter, args }
      continue
    }
    const command = words(sensor?.command)
    if (!command?.length) throw new Error(`${file}: sensor ${name} has no command and no adapter`)
    sensors[name] = { command }
  }
  return { file, root: repositoryFileRoot(file), sensors }
}
