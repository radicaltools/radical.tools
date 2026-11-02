import { readFile, stat } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { commandWords } from '@radical/common/check'

/** The sensors a repository configures for its own system, at its root:
 *  `{ "sensors": { "<name>": { "command": "<command line>" } } }`. */
export const SENSORS_FILE = 'radical.sensors.json'

/** The repository's sensors: in the nearest radical.sensors.json from the
 *  model folder up to the repository's root; none without one. */
export async function repositorySensors(folder: string): Promise<{ file: string; sensors: Record<string, string[]> } | null> {
  for (let dir = folder; ; dir = dirname(dir)) {
    const file = join(dir, SENSORS_FILE)
    const text = await readFile(file, 'utf8').catch(() => null)
    if (text !== null) {
      let raw: unknown
      try { raw = JSON.parse(text) } catch (error) { throw new Error(`${file}: ${(error as Error).message}`) }
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
    if (await stat(join(dir, '.git')).then(() => true, () => false) || dirname(dir) === dir) return null
  }
}
