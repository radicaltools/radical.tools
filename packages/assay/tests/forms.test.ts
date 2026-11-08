import { execFileSync } from 'node:child_process'
import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { extractRepository, formWireframe } from '../src/index'

/** A git repository of `files` (path → text) in a fresh folder. */
export function repo(name: string, files: Record<string, string>): string {
  const dir = join(mkdtempSync(join(tmpdir(), 'assay-forms-')), name)
  for (const [path, text] of Object.entries(files)) {
    mkdirSync(dirname(join(dir, path)), { recursive: true })
    writeFileSync(join(dir, path), text)
  }
  execFileSync('git', ['init', '-q'], { cwd: dir })
  return dir
}

const block = (kind: string, name: string, props: Record<string, string | number>, inner = ''): string =>
  [`   Begin ${kind} ${name}`, ...Object.entries(props).map(([k, v]) => `      ${k} = ${typeof v === 'string' ? `"${v}"` : v}`), inner, '   End'].filter(Boolean).join('\r\n')

/** The forms of a small point of sale: sign-in → main → report. */
export const POS_FORMS: Record<string, string> = {
  'POS.vbp': 'Type=Exe\r\nForm=frmLogin.frm\r\nForm=frmMain.frm\r\nForm=frmReport.frm\r\nName="POS"\r\n',
  'frmLogin.frm': [
    'VERSION 5.00', 'Object = "{0}#1.0#0"; "LVbuttons.ocx"', 'Begin VB.Form frmLogin', '   Caption = "Program Login"', '   ClientHeight = 3000', '   ClientWidth = 6000',
    block('VB.Frame', 'fraUser', { Caption: 'Account', Left: 120, Top: 120, Width: 4000, Height: 1800 }, [
      block('VB.Label', 'lblUser', { Caption: 'Username:', Left: 100, Top: 300, Width: 1000, Height: 255 }),
      block('VB.TextBox', 'txtUser', { Left: 1200, Top: 300, Width: 2000, Height: 315 }),
    ].join('\r\n')),
    block('LVbuttons.LaVolpeButton', 'cmdLogin', { Left: 3840, Top: 2400, Width: 1215, Height: 375, TX: '&Login' }),
    block('VB.Timer', 'tmrIdle', { Interval: 60000, Left: 0, Top: 0 }),
    block('VB.TextBox', 'txtHidden', { Left: -99999, Top: 0, Width: 100, Height: 100 }),
    'End',
    'Attribute VB_Name = "frmLogin"',
    'Private Sub cmdLogin_Click()', "  ' frmNowhere.Show (a comment)", '  frmMain.Show', '  Unload Me', 'End Sub', '',
  ].join('\r\n'),
  'frmMain.frm': [
    'VERSION 5.00', 'Begin VB.Form frmMain', '   Caption = "Shop"', '   ClientHeight = 6000', '   ClientWidth = 9000',
    block('VB.Menu', 'mnuReports', { Caption: '&Reports' }, block('VB.Menu', 'mnuDaily', { Caption: '&Daily report' })),
    'End',
    'Attribute VB_Name = "frmMain"',
    'Private Sub Form_Load()', '  frmLogin.Show', 'End Sub',
    'Private Sub mnuDaily_Click()', '  Load frmReport', '  frmReport.Show vbModal', 'End Sub',
    'Private Sub txtCode_KeyPress(KeyAscii As Integer)', '  If KeyAscii = 13 Then frmLogin.Show', 'End Sub', '',
  ].join('\r\n'),
  'frmReport.frm': ['VERSION 5.00', 'Begin VB.Form frmReport', '   Caption = "Daily report"', '   ClientHeight = 3000', '   ClientWidth = 4000', 'End', 'Attribute VB_Name = "frmReport"', ''].join('\r\n'),
}

describe('radical assay: desktop screens from their form files', () => {
  it("reads each form as a screen: caption, size, controls at their positions, and the forms its code opens through which control", () => {
    // A form file the project does not list is no screen of it.
    const facts = extractRepository(repo('pos', { ...POS_FORMS, 'old/frmStray.frm': 'VERSION 5.00\r\nBegin VB.Form frmStray\r\nEnd\r\n' }))
    expect(facts.screens.map((s) => [s.id, s.route, s.title, s.source, s.evidence])).toEqual([
      ['pos:screen:.:frmLogin', 'frmLogin', 'Program Login', 'form', { file: 'frmLogin.frm', line: 3 }],
      ['pos:screen:.:frmMain', 'frmMain', 'Shop', 'form', { file: 'frmMain.frm', line: 2 }],
      ['pos:screen:.:frmReport', 'frmReport', 'Daily report', 'form', { file: 'frmReport.frm', line: 2 }],
    ])
    const login = facts.screens[0]
    // A control in a frame sits where the frame puts it; a timer and a control parked off the form are no part of the screen.
    expect(login.form).toEqual({ width: 6000, height: 3000, controls: [
      { kind: 'Label', name: 'lblUser', caption: 'Username:', left: 220, top: 420, width: 1000, height: 255 },
      { kind: 'TextBox', name: 'txtUser', left: 1320, top: 420, width: 2000, height: 315 },
      { kind: 'Frame', name: 'fraUser', caption: 'Account', left: 120, top: 120, width: 4000, height: 1800 },
      { kind: 'LaVolpeButton', name: 'cmdLogin', caption: 'Login', left: 3840, top: 2400, width: 1215, height: 375 },
    ] })
    expect(login.controls).toEqual([{ ref: 'txtUser', role: 'textbox', name: 'txtUser' }, { ref: 'cmdLogin', role: 'button', name: 'Login' }])
    expect(login.text).toBe('Username:')
    // Opened from a button's handler and from a menu item's; a form named in a comment opens nothing.
    expect(login.opens).toEqual([{ form: 'frmMain', via: 'cmdLogin', line: 49 }])
    // A form showing others as it loads is no step of the user's; a key pressed in a control is.
    expect(facts.screens[1].opens).toEqual([{ form: 'frmReport', via: 'mnuDaily', line: 18 }, { form: 'frmLogin', via: 'txtCode', key: true, line: 22 }])
    expect(facts.screens[1].controls).toEqual([{ ref: 'mnuDaily', role: 'menuitem', name: 'Daily report' }, { ref: 'mnuReports', role: 'menuitem', name: 'Reports' }])
  })

  it('draws a form as a low-fi wireframe of its controls at their positions, inert and small', () => {
    const login = extractRepository(repo('pos', POS_FORMS)).screens[0]
    const svg = formWireframe(login)!
    expect(svg).toMatch(/^<svg xmlns="http:\/\/www.w3.org\/2000\/svg" viewBox="0 0 400 300"/)
    expect(svg).toContain('>Program Login</text>')
    expect(svg).toContain('>Login</text>')
    expect(svg).toContain('>Account</text>')
    expect(svg).not.toMatch(/<script|href=|on\w+=/)
    // Scaled to 400 wide: the button at 3840 twips of 6000 is at 256.
    expect(svg).toContain('<rect x="256" y="178" width="81" height="25" rx="2"')
    expect(formWireframe({ title: 'x', form: { width: 0, height: 0, controls: [] } })).toBeNull()
  })
})
