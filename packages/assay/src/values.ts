// Radical Assay: what a VB6 unit's constants, variables, record fields and INI settings hold where the
// unit sets them, so a socket's port or a connection string built from them reads as if the code had
// named it (GAME_PORT = GameData.Port, GameData.Port = 7777; DBnombre = ReadIni(…, "MySQL", "db")).

import { basename } from 'node:path'
import type { RepoFiles } from './files'
import { iniSections } from './runtime'

/** Functions that only convert or trim the value they are given. */
const WRAPPER = /^(?:Trim|LTrim|RTrim|CStr|CInt|CLng|CDbl|Val|UCase|LCase)\$?\s*\(\s*([\s\S]*)\s*\)$/i
/** An assignment starting a statement (a line, or after : or Then): Public Const GAME_PORT = 7777, GameData.IP =
 *  "127.0.0.1", Case "PR": T = "PURCHASE", If x Then T = "NONE". */
const ASSIGNED = /(?:^|:|\bThen\b|\bElse\b)[ \t]*(?:(?:Public|Private|Global|Dim|Static)\s+)?(?:Const\s+)?([A-Za-z_]\w*(?:\.[A-Za-z_]\w*)*)(?:\s+As\s+\w+(?:\s*\*\s*\w+)?)?[ \t]*=[ \t]*([^:\n]+?|"(?:[^"\n]|"")*")[ \t]*(?=$|:(?!\\))/gm
/** A call reading a setting: ReadIni(file, "Section", "key"), GetPrivateProfileString("Section", "key", …). */
const SETTING = /^(\w*(?:ini|PrivateProfile)\w*)\$?\s*\(([\s\S]*)\)$/i

export interface VbValues {
  /** The one value an expression holds, if the unit sets it to one literal (empty settings name none). */
  resolve(expr: string): string | undefined
}

/** The values of the unit's VB code `texts` (comment-free, continuations joined); its INI files are `iniFiles`. */
export function vbValues(files: RepoFiles, texts: string[], iniFiles: string[]): VbValues {
  const assigned = new Map<string, string[]>()
  for (const text of texts) {
    for (const m of text.matchAll(ASSIGNED)) {
      const key = m[1].toLowerCase()
      if (/^(if|elseif|case|for|while|do|set|let|call|with|return)$/.test(key.split('.')[0])) continue
      assigned.set(key, [...(assigned.get(key) ?? []), m[2]])
    }
  }
  const setting = (args: string): string | undefined => {
    const literals = [...args.matchAll(/"((?:[^"]|"")*)"/g)].map((m) => m[1].replace(/""/g, '"'))
    const file = literals.find((l) => /\.ini$/i.test(l))
    const [section, key] = literals.filter((l) => l !== file)
    if (!section || !key) return undefined
    const named = file ? basename(file.replace(/\\/g, '/')).toLowerCase() : undefined
    const candidates = named && iniFiles.some((f) => basename(f).toLowerCase() === named) ? iniFiles.filter((f) => basename(f).toLowerCase() === named) : iniFiles
    for (const f of candidates) {
      for (const s of iniSections(files.read(f)).filter((x) => x.name.toLowerCase() === section.toLowerCase())) {
        // A key given twice: the first that holds a value (server= "" and then server = "192.168.0.105").
        const value = s.entries.find((e) => e.key.toLowerCase() === key.toLowerCase() && e.value.trim())?.value.trim()
        if (value) return value
      }
    }
    return undefined
  }
  const resolve = (expr: string, depth: number, seen: Set<string>): string | undefined => {
    let e = expr.trim()
    for (let w = WRAPPER.exec(e); w; w = WRAPPER.exec(e)) e = w[1].trim()
    const literal = /^"((?:[^"]|"")*)"$/.exec(e)
    if (literal) return literal[1].replace(/""/g, '"').trim() || undefined
    if (/^-?\d+$/.test(e)) return e
    const call = SETTING.exec(e)
    if (call) return setting(call[2])
    if (!/^[A-Za-z_]\w*(?:\.[A-Za-z_]\w*)*\$?$/.test(e) || depth > 6) return undefined
    const key = e.replace(/\$$/, '').replace(/^Me\./i, '').toLowerCase()
    if (seen.has(key)) return undefined
    const values = new Set((assigned.get(key) ?? []).map((v) => resolve(v, depth + 1, new Set([...seen, key]))).filter((v): v is string => v !== undefined))
    return values.size === 1 ? [...values][0] : undefined
  }
  return { resolve: (expr) => resolve(expr, 0, new Set()) }
}

/** A line building a connection string. */
const CONNECTION = /\b(?:Server|Database|Driver|Data Source|DSN|Provider|Initial Catalog|Dbq|Uid|Host)\s*=/i

/** The text with each variable spliced into a connection string ("Server=" & DBservidor & ";…") replaced by the value it
 *  holds; other strings (an SQL query's table) keep their variables. */
export function inlineValues(text: string, values: VbValues): string {
  return text.split('\n').map((line) => (CONNECTION.test(line) ? line.replace(/"\s*&\s*([A-Za-z_][\w.]*\$?)\s*&\s*"/g, (whole, name: string) => {
    const value = values.resolve(name)
    return value === undefined ? whole : value.replace(/"/g, '""')
  }) : line)).join('\n')
}
