import type { BuildInfo } from '@radical/common/version'

type Env = Record<string, string | undefined>

export function buildInfo(packageDir: string, env?: Env, now?: Date): BuildInfo
export function buildDefine(packageDir: string, env?: Env, now?: Date): { __RADICAL_BUILD__: string }
