// The sensor adapters radical sense knows, by name. A contributed adapter
// is one line here (and its module, with a fixture).

import { commandAdapter } from './command'
import { githubActionsAdapter } from './github-actions'
import { jsonAdapter } from './json'
import { lighthouseAdapter } from './lighthouse'
import { machineAdapter } from './machine'
import { playwrightAdapter } from './playwright'
import type { SensorAdapter } from './types'

export const SENSOR_ADAPTERS: SensorAdapter[] = [commandAdapter, githubActionsAdapter, jsonAdapter, lighthouseAdapter, machineAdapter, playwrightAdapter]

export const sensorAdapter = (name: string): SensorAdapter | undefined => SENSOR_ADAPTERS.find((a) => a.name === name)
