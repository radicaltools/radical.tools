// ─── Radical Assay: what Directory.Build files add to a .NET project ─────────
//
// MSBuild imports the Directory.Build.props and Directory.Build.targets
// nearest above a project. Their ProjectReference items, under conditions on
// the project's name and path, are references of the project as if its own
// file named them. Conditions are read for what such files usually test
// (EndsWith, StartsWith, Contains, ==, !=, and, or, !); a condition read no
// further adds nothing.

import { RepoFiles, dirOf, escapeRe, lineAt, resolveFrom } from './files'

export interface BuildReference { name: string; path: string; file: string; line: number }

const BUILD_FILES = ['Directory.Build.props', 'Directory.Build.targets']

/** The file of that name nearest above the folder, the folder's own first. */
function nearest(files: RepoFiles, dir: string, name: string): string | undefined {
  for (let d = dir; ; d = dirOf(d)) {
    const file = d === '.' ? name : `${d}/${name}`
    if (files.has(file)) return file
    if (d === '.') return undefined
  }
}

/** A value with its properties filled in; undefined when one is unknown. A path from the build file's folder starts with '/'. */
function expand(value: string, props: Map<string, string>): string | undefined {
  let unknown = false
  const out = value.replace(/\$\(([\w.]+)\)/g, (_, name: string) => {
    const v = props.get(name)
    if (v === undefined) unknown = true
    return v ?? ''
  })
  return unknown ? undefined : out
}

/** A condition's truth, or undefined when it says more than this reads. */
export function condition(text: string, props: Map<string, string>): boolean | undefined {
  let s = text.replace(/\$\(\[System\.IO\.Path\]::DirectorySeparatorChar\)/g, '/')
  let unknown = false
  s = s.replace(/\$\((\w+)\.(EndsWith|StartsWith|Contains)\('([^']*)'\)\)/g, (_, name: string, method: string, arg: string) => {
    const v = props.get(name)
    if (v === undefined) { unknown = true; return 'false' }
    const a = arg.replace(/\\/g, '/')
    return String(method === 'EndsWith' ? v.endsWith(a) : method === 'StartsWith' ? v.startsWith(a) : v.includes(a))
  })
  const filled = expand(s, props)
  if (unknown || filled === undefined) return undefined
  s = filled.replace(/'([^']*)'\s*(==|!=)\s*'([^']*)'/g, (_, a: string, op: string, b: string) => String(op === '==' ? a.toLowerCase() === b.toLowerCase() : a.toLowerCase() !== b.toLowerCase()))
  const tokens = s.match(/true|false|and|or|!|\(|\)|\S+/gi) ?? []
  let i = 0
  const peek = (): string | undefined => tokens[i]?.toLowerCase()
  const primary = (): boolean | undefined => {
    const t = peek()
    i++
    if (t === 'true') return true
    if (t === 'false') return false
    if (t === '!') { const v = primary(); return v === undefined ? undefined : !v }
    if (t === '(') { const v = or(); if (peek() !== ')') return undefined; i++; return v }
    return undefined
  }
  const and = (): boolean | undefined => {
    let v = primary()
    while (peek() === 'and') { i++; const w = primary(); v = v === undefined || w === undefined ? undefined : v && w }
    return v
  }
  const or = (): boolean | undefined => {
    let v = and()
    while (peek() === 'or') { i++; const w = and(); v = v === undefined || w === undefined ? undefined : v || w }
    return v
  }
  const result = or()
  return i === tokens.length ? result : undefined
}

/** The project files a path names, its * and ** matched against the repository's files. */
function matching(files: RepoFiles, path: string): string[] {
  if (!path.includes('*')) return files.has(path) ? [path] : []
  const segs = path.split('/')
  const re = new RegExp(`^${segs.map((seg, i) => (seg === '**' ? '(?:[^/]+/)*' : escapeRe(seg).replace(/\\\*/g, '[^/]*') + (i < segs.length - 1 ? '/' : ''))).join('')}$`, 'i')
  return files.list.filter((f) => re.test(f))
}

/** The projects the Directory.Build files above a project add to it as references. */
export function buildReferences(files: RepoFiles, project: string): BuildReference[] {
  const dir = dirOf(project)
  const name = project.slice(project.lastIndexOf('/') + 1).replace(/\.\w+$/, '')
  const out: BuildReference[] = []
  for (const buildFile of BUILD_FILES.map((f) => nearest(files, dir, f)).filter((f): f is string => !!f)) {
    const text = files.read(buildFile)
    if (!text) continue
    const here = dirOf(buildFile)
    const props = new Map<string, string>([
      ['MSBuildProjectName', name], ['MSBuildProjectFile', project.slice(project.lastIndexOf('/') + 1)],
      ['MSBuildProjectFullPath', `/${project}`], ['MSBuildProjectDirectory', `/${dir === '.' ? '' : dir}`],
      ['MSBuildThisFileDirectory', `/${here === '.' ? '' : `${here}/`}`],
    ])
    // Properties the file sets, in order: a later one may use an earlier one.
    for (const group of text.matchAll(/<PropertyGroup\b[^>]*>([\s\S]*?)<\/PropertyGroup>/g)) {
      for (const p of group[1].matchAll(/<(\w+)(?:\s[^>]*)?>([^<]*)<\/\1>/g)) {
        const v = expand(p[2].trim(), props)
        if (v !== undefined && !props.has(p[1])) props.set(p[1], v)
      }
    }
    for (const group of text.matchAll(/<ItemGroup\b([^>]*)>([\s\S]*?)<\/ItemGroup>/g)) {
      const when = /Condition\s*=\s*"([^"]*)"/.exec(group[1])?.[1]
      if (when !== undefined && condition(when, props) !== true) continue
      const start = group.index! + group[0].indexOf(group[2])
      for (const item of group[2].matchAll(/<ProjectReference\s+Include\s*=\s*"([^"]+)"/g)) {
        for (const include of item[1].split(';').map((x) => x.trim()).filter(Boolean)) {
          const value = expand(include, props)
          if (value === undefined) continue
          const unixy = value.replace(/\\/g, '/')
          const path = unixy.startsWith('/') ? resolveFrom('.', unixy.slice(1)) : resolveFrom(dir, unixy)
          if (!path) continue
          for (const target of matching(files, path)) {
            if (target === project) continue
            out.push({ name: target.slice(target.lastIndexOf('/') + 1).replace(/\.\w+$/, ''), path: target, file: buildFile, line: lineAt(text, start + item.index!) })
          }
        }
      }
    }
  }
  return out
}
