import { readFile } from 'node:fs/promises'
import { commandWords } from '@radical/common/check'
import { OLD_SENSORS_FILE, SENSORS_FILE, findRepositoryFile } from '@radical/node-files/repositoryLayout'

export { SENSORS_FILE }

/** The repository's sensors: in .radical/sensors.json, or radical.sensors.json
 *  at the root of the old layout, the nearest from the model folder up to
 *  the repository's root; none without one. Each names its command:
 *  `{ "sensors": { "<name>": { "command": "<command line>" } } }`. */
export async function repositorySensors(folder: string): Promise<{ file: string; sensors: Record<string, string[]> } | null> {
  const found = await findRepositoryFile(folder, SENSORS_FILE, OLD_SENSORS_FILE)
  if (!found) return null
  const file = found.path
  let raw: unknown
  try { raw = JSON.parse(await readFile(file, 'utf8')) } catch (error) { throw new Error(`${file}: ${(error as Error).message}`) }
  const listed = (raw as { sensors?: unknown })?.sensors
  if (!listed || typeof listed !== 'object') throw new Error(`${file}: no "sensors" object`)
  const sensors: Record<string, string[]> = {}
  for (const [name, sensor] of Object.entries(listed as Record<string, { command?: unknown }>)) {
    const command = sensor?.command
    const words = typeof command === 'string' ? commandWords(command) : Array.isArray(command) && command.every((w) => typeof w === 'string') ? command as string[] : []
    if (!words.length) throw new Error(`${file}: sensor ${name} has no command`)
    sensors[name] = words
  }
  return { file, sensors }
}
