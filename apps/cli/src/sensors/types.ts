// ─── radical sense: the adapter interface ────────────────────────────────────
//
// A sensor adapter turns one tool's output into measurements: values with
// their units, never verdicts. It takes no threshold and fails on no value;
// the conditions in the model decide (radical check). To add a tool, write
// one module that exports a SensorAdapter, list it in registry.ts and give
// it a fixture of the tool's real output: the contract test runs every
// adapter in the registry on its fixture.

import type { ParseArgsConfig } from 'node:util'

/** One value an adapter read, before radical sense adds the labels given
 *  on the command line. */
export interface SensorValue {
  metric: string
  value: number
  unit?: string
  labels?: Record<string, string>
}

export interface SensorInput {
  /** The words after the adapter's name (and after --, for a command). */
  args: string[]
  /** The adapter's own options, parsed. */
  options: Record<string, string | boolean | string[] | undefined>
  /** The working directory the paths are relative to. */
  cwd: string
}

export interface SensorAdapter {
  name: string
  /** What it reads, in one line, for --list. */
  description: string
  /** Its arguments and options, for --help. */
  usage: string
  /** Its own options (never a threshold: values are judged in the model). */
  options?: NonNullable<ParseArgsConfig['options']>
  /** Throws, with a message for people, when it cannot measure. */
  measure(input: SensorInput): Promise<SensorValue[]>
  /** What the contract test runs it on: its input, and files to put in a
   *  temporary working directory first (a copy of the tool's real output). */
  fixture: { args: string[]; options?: SensorInput['options']; files?: Record<string, string> }
}
