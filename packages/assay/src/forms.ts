// ─── Radical Assay: the screens a desktop application's form files state ─────
//
// A VB6 form file states its screen exactly: the form's caption and size,
// each control with its kind, caption and position (in twips, from the
// container it sits in), and the code behind it, which shows other forms
// (ADR Assay reads desktop screens from their form files). Each form is a
// screen fact of its unit, as an explored web page is, with what a low-fi
// wireframe needs and the forms its handlers open; nothing runs.

import type { ScreenFact } from './explore'
import type { Unit } from './facts'
import { RepoFiles, lineAt, owner } from './files'
import { withoutVbComments } from './code'

/** A control of a form, its position from the form's top left, in twips. */
export interface FormControl {
  /** The control's class without its library: CommandButton, TextBox, Label, Frame, ListView, … */
  kind: string
  name: string
  caption?: string
  left: number
  top: number
  width: number
  height: number
}

/** What a form file states of its screen, beside the screen fact's controls. */
export interface FormLayout {
  width: number
  height: number
  controls: FormControl[]
}

/** A form another form's code opens, from a control's or menu item's handler (none: on loading). */
export interface FormOpen {
  form: string
  via?: string
  /** Opened by a key pressed in the control (KeyPress, KeyDown), not a click. */
  key?: boolean
  line: number
}

const ROLE: Record<string, string> = {
  CommandButton: 'button', TextBox: 'textbox', RichTextBox: 'textbox', MaskEdBox: 'textbox', ComboBox: 'combobox', DataCombo: 'combobox',
  CheckBox: 'checkbox', OptionButton: 'radio', ListBox: 'list', ListView: 'list', DataList: 'list', TreeView: 'tree',
  MSFlexGrid: 'grid', MSHFlexGrid: 'grid', DataGrid: 'grid', Menu: 'menuitem',
}
/** A control's role by its class: the standard ones, and any button library's. */
const roleOf = (kind: string): string | undefined => ROLE[kind] ?? (/button/i.test(kind) ? 'button' : undefined)
/** Controls the user never sees. */
const INVISIBLE = /^(Timer|Adodc|Data|Winsock|Inet|CommonDialog|ImageList|MSComm|MAPISession|MAPIMessages)$/

const caption = (text: string): string => text.replace(/""/g, '"').replace(/&&/g, '\u0000').replace(/&/g, '').replace(/\u0000/g, '&').trim()

/** Each form of the repository's VB6 units, as a screen fact. */
export function readForms(files: RepoFiles, repo: string, units: Unit[]): ScreenFact[] {
  const forms: Array<{ screen: ScreenFact; code: string; codeLine: number; unit: Unit }> = []
  // The forms each project lists (Form=, UserDocument=): a form file it does not list is no screen of it.
  const listed = new Map<string, Set<string>>()
  for (const u of units.filter((x) => x.stack === 'vb6' && /\.vbp$/i.test(x.evidence.file))) {
    const dir = u.path === '.' ? '' : `${u.path}/`
    const names = [...files.read(u.evidence.file).matchAll(/^(?:Form|UserDocument)=(.+?)\s*$/gim)].map((m) => `${dir}${m[1].trim().replace(/\\/g, '/')}`.toLowerCase())
    if (names.length) listed.set(u.id, new Set(names))
  }
  for (const file of files.list.filter((f) => /\.(frm|dob)$/i.test(f))) {
    const unit = owner(units, file)
    if (!unit || unit.stack !== 'vb6') continue
    if (listed.has(unit.id) && !listed.get(unit.id)!.has(file.toLowerCase())) continue
    const text = files.read(file)
    const read = readForm(text, file)
    if (!read) continue
    // Two files declaring one form name are two screens.
    const base = `${repo}:screen:${unit.path}:${read.name}`
    const id = forms.some((f) => f.screen.id === base) ? `${base}@${file.slice(file.lastIndexOf('/') + 1)}` : base
    forms.push({ unit, code: text.slice(read.codeAt), codeLine: lineAt(text, read.codeAt), screen: { id, ...read.screen } })
  }
  // A form opens another of its own unit by its name.
  for (const f of forms) {
    const names = new Set(forms.filter((o) => o.unit === f.unit && o !== f).map((o) => o.screen.route.toLowerCase()))
    const opens = formOpens(f.code, f.codeLine, names)
    if (opens.length) f.screen.opens = opens.map((o) => ({ ...o, form: forms.find((x) => x.unit === f.unit && x.screen.route.toLowerCase() === o.form)!.screen.route }))
  }
  return forms.map((f) => f.screen)
}

/** A form file's screen: its name, caption, size and controls, and where its code starts. */
export function readForm(text: string, file: string): { name: string; codeAt: number; screen: Omit<ScreenFact, 'id'> } | null {
  // A form, an MDI form, or an ActiveX document (a page a browser hosts).
  const head = /^\s*Begin\s+VB\.(?:Form|MDIForm|UserDocument)\s+(\w+)/m.exec(text)
  if (!head) return null
  const begin = head.index + head[0].indexOf('Begin')
  const lines = text.slice(begin).split('\n')
  // Each block's own properties, its position made absolute through the containers it sits in.
  const stack: Array<{ kind: string; name: string; props: Record<string, string>; x: number; y: number; line: number }> = []
  const controls: FormControl[] = []
  const shown: ScreenFact['controls'] = []
  let width = 0
  let height = 0
  let title = ''
  let offset = begin
  let end = text.length
  // What the user can click: a control with a Click handler, whatever its kind.
  const clickable = new Set([...withoutVbComments(text).matchAll(/^\s*(?:(?:Private|Public)\s+)?Sub\s+(\w+?)_(?:Click|DblClick)\s*\(/gim)].map((m) => m[1].toLowerCase()))
  for (const raw of lines) {
    const line = raw.replace(/\r$/, '')
    const lineStart = offset
    offset += raw.length + 1
    const block = /^\s*Begin\s+([\w.]+)\s+(\w+)/.exec(line)
    if (block) {
      const parent = stack[stack.length - 1]
      // A container's position is its children's origin; the form's is none.
      const px = parent && stack.length > 1 ? parent.x + num(parent.props.Left) : 0
      const py = parent && stack.length > 1 ? parent.y + num(parent.props.Top) : 0
      stack.push({ kind: block[1].split('.').pop()!, name: block[2], props: {}, x: px, y: py, line: lineAt(text, lineStart) })
      continue
    }
    if (/^\s*End\s*$/.test(line)) {
      const b = stack.pop()
      if (!b) continue
      if (!stack.length) {
        // The form itself: its client area, its caption.
        width = num(b.props.ClientWidth) || num(b.props.Width)
        height = num(b.props.ClientHeight) || num(b.props.Height)
        title = b.props.Caption !== undefined ? caption(b.props.Caption) : b.name
        end = offset
        break
      }
      const name = b.props.Index !== undefined ? `${b.name}(${b.props.Index})` : b.name
      // Custom button libraries (LaVolpe's, Argentum's) keep the caption in TX.
      const given = b.props.Caption ?? b.props.TX ?? b.props.Text
      const cap = given !== undefined ? caption(given) : undefined
      if (b.kind === 'Menu') {
        if (cap && cap !== '-') shown.push({ ref: name, role: 'menuitem', name: cap })
        continue
      }
      if (INVISIBLE.test(b.kind) || b.props.Visible === '0') continue
      const left = b.x + num(b.props.Left)
      // A control parked off the form (a tab page not shown) is no part of the screen.
      if (left < 0) continue
      controls.push({ kind: b.kind, name, ...(cap ? { caption: cap } : {}), left, top: b.y + num(b.props.Top), width: num(b.props.Width), height: num(b.props.Height) })
      const role = roleOf(b.kind) ?? (clickable.has(b.name.toLowerCase()) ? 'button' : undefined)
      if (role) shown.push({ ref: name, role, name: cap || name })
      continue
    }
    const prop = /^\s*(\w+)\s*=\s*(?:"((?:[^"]|"")*)"|([^'\s]+))/.exec(line)
    const top = stack[stack.length - 1]
    if (prop && top && !(prop[1] in top.props)) top.props[prop[1]] = prop[2] ?? prop[3]
  }
  const text_ = controls.filter((c) => c.kind === 'Label' && c.caption).map((c) => c.caption!).join(' · ').slice(0, 300)
  return {
    name: head[1],
    codeAt: end,
    screen: {
      url: file, route: head[1], title, headings: [], ...(text_ ? { text: text_ } : {}), controls: shown,
      source: 'form', form: { width, height, controls },
      evidence: { file, line: lineAt(text, begin) },
    },
  }
}

const num = (v: string | undefined): number => (v === undefined ? 0 : Number.parseFloat(v) || 0)

/** The forms `code` (a form's code, from line `firstLine`) opens: X.Show or Load X, in a handler of a control, a menu item or the form. */
export function formOpens(code: string, firstLine: number, forms: Set<string>): FormOpen[] {
  const out: FormOpen[] = []
  let handler: string | undefined
  let event: string | undefined
  withoutVbComments(code).split('\n').forEach((line, i) => {
    // What the user does to open a form: a control's or menu item's Click, a key pressed in a control. A form showing
    // others as it loads (a hidden main form) is no step of the user's.
    const sub = /^\s*(?:(?:Private|Public|Friend|Static)\s+)*Sub\s+(\w+?)_(Click|DblClick|KeyPress|KeyDown)\s*\(/i.exec(line)
    if (sub && !/^(Form|MDIForm)$/i.test(sub[1])) { handler = sub[1]; event = sub[2]; return }
    if (/^\s*(?:(?:Private|Public|Friend|Static)\s+)*(Sub|Function)\s+\w+/i.test(line)) { handler = undefined; return }
    for (const m of line.matchAll(/\b(\w+)\.Show\b|\bLoad\s+(\w+)\b/gi)) {
      const form = (m[1] ?? m[2]).toLowerCase()
      if (!handler || !forms.has(form) || out.some((o) => o.form === form && o.via === handler)) continue
      out.push({ form, via: handler, ...(/^key/i.test(event ?? '') ? { key: true } : {}), line: firstLine + i })
    }
  })
  return out
}

const esc = (s: string): string => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
const clip = (s: string, n: number): string => (s.length > n ? `${s.slice(0, n - 1)}…` : s)

/** A low-fi SVG wireframe of a form, 400 × 300, drawn from its controls at their positions. */
export function formWireframe(screen: Pick<ScreenFact, 'title' | 'form'>, size = { width: 400, height: 300 }): string | null {
  const form = screen.form
  if (!form || !form.width || !form.height) return null
  const bar = 18
  const scale = Math.min(size.width / form.width, (size.height - bar) / form.height)
  const w = Math.round(form.width * scale)
  const h = Math.round(form.height * scale) + bar
  const p = (n: number) => Math.round(n * scale * 10) / 10
  const font = 9
  const out: string[] = [
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${size.width} ${size.height}" font-family="sans-serif" font-size="${font}">`,
    `<rect x="0.5" y="0.5" width="${w - 1}" height="${h - 1}" fill="#fff" stroke="#333"/>`,
    `<rect x="0.5" y="0.5" width="${w - 1}" height="${bar}" fill="#ccc" stroke="#333"/>`,
    `<text x="6" y="13">${esc(clip(screen.title, 50))}</text>`,
  ]
  // Containers first, so what sits in them is drawn over them; at most what a stored wireframe holds.
  const order = [...form.controls].sort((a, b) => Number(b.kind === 'Frame' || b.kind === 'PictureBox') - Number(a.kind === 'Frame' || a.kind === 'PictureBox')).slice(0, 150)
  for (const c of order) {
    const x = p(c.left)
    const y = p(c.top) + bar
    const cw = Math.max(p(c.width), 2)
    const ch = Math.max(p(c.height), 2)
    const chars = Math.max(3, Math.floor(cw / (font * 0.55)))
    const label = c.caption ? esc(clip(c.caption, chars)) : ''
    const mid = y + ch / 2 + font / 3
    switch (roleOf(c.kind) ?? c.kind) {
      case 'button':
        out.push(`<rect x="${x}" y="${y}" width="${cw}" height="${ch}" rx="2" fill="#eee" stroke="#333"/>`, label && `<text x="${x + cw / 2}" y="${mid}" text-anchor="middle">${label}</text>`)
        break
      case 'textbox':
      case 'combobox':
        out.push(`<rect x="${x}" y="${y}" width="${cw}" height="${ch}" fill="#fff" stroke="#777"/>`)
        if (roleOf(c.kind) === 'combobox') out.push(`<path d="M${x + cw - 9} ${y + ch / 2 - 2}l3 4 3-4z" fill="#555"/>`)
        break
      case 'checkbox':
      case 'radio':
        out.push(roleOf(c.kind) === 'radio' ? `<circle cx="${x + 5}" cy="${y + ch / 2}" r="3.5" fill="#fff" stroke="#333"/>` : `<rect x="${x + 1.5}" y="${y + ch / 2 - 3.5}" width="7" height="7" fill="#fff" stroke="#333"/>`, label && `<text x="${x + 13}" y="${mid}">${label}</text>`)
        break
      case 'list':
      case 'grid':
      case 'tree': {
        out.push(`<rect x="${x}" y="${y}" width="${cw}" height="${ch}" fill="#fff" stroke="#777"/>`)
        for (let row = 1; row <= Math.min(4, Math.floor(ch / 12)); row++) out.push(`<line x1="${x + 3}" y1="${y + row * 11}" x2="${x + cw - 3}" y2="${y + row * 11}" stroke="#ccc"/>`)
        break
      }
      case 'Label':
        if (label) out.push(`<text x="${x}" y="${y + Math.min(ch, 12) - 2}" fill="#333">${label}</text>`)
        break
      case 'Frame':
        out.push(`<rect x="${x}" y="${y + 4}" width="${cw}" height="${Math.max(ch - 4, 2)}" fill="none" stroke="#999"/>`, label && `<text x="${x + 6}" y="${y + 7}" fill="#555">${label}</text>`)
        break
      case 'Image':
      case 'PictureBox':
        out.push(`<rect x="${x}" y="${y}" width="${cw}" height="${ch}" fill="#eee" stroke="#999"/>`)
        if (c.kind === 'Image' || !form.controls.some((o) => o !== c && o.left >= c.left && o.top >= c.top && o.left < c.left + c.width && o.top < c.top + c.height)) out.push(`<path d="M${x} ${y}L${x + cw} ${y + ch}M${x + cw} ${y}L${x} ${y + ch}" stroke="#ccc"/>`)
        break
      case 'Shape':
      case 'Line':
        out.push(`<rect x="${x}" y="${y}" width="${cw}" height="${ch}" fill="none" stroke="#bbb"/>`)
        break
      default:
        out.push(`<rect x="${x}" y="${y}" width="${cw}" height="${ch}" fill="#f5f5f5" stroke="#999" stroke-dasharray="3 2"/>`, `<text x="${x + 3}" y="${y + Math.min(ch, 12) - 2}" fill="#777" font-size="7">${esc(clip(c.caption || c.kind, chars))}</text>`)
    }
  }
  out.push('</svg>')
  const svg = out.filter(Boolean).join('')
  return svg.length <= 20_000 ? svg : null
}
