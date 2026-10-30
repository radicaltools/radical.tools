// The sensor adapters radical sense knows, by name. A contributed adapter
// is one line here (and its module, with a fixture).

import { commandAdapter } from './command'
import { jsonAdapter } from './json'
import type { SensorAdapter } from './types'

export const SENSOR_ADAPTERS: SensorAdapter[] = [commandAdapter, jsonAdapter]

export const sensorAdapter = (name: string): SensorAdapter | undefined => SENSOR_ADAPTERS.find((a) => a.name === name)
