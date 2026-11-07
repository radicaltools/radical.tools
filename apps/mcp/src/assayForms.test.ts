import { execFileSync } from 'node:child_process'
import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { FolderModel } from './folderModel'

const form = (name: string, title: string, controls: string[], code: string[]): string => [
  'VERSION 5.00', `Begin VB.Form ${name}`, `   Caption = "${title}"`, '   ClientHeight = 3000', '   ClientWidth = 6000', ...controls, 'End', `Attribute VB_Name = "${name}"`, ...code, '',
].join('\r\n')

/** A VB6 point of sale (sign-in → main → report) beside an empty central model. */
async function central() {
  const code = join(mkdtempSync(join(tmpdir(), 'assay-forms-')), 'code')
  const files: Record<string, string> = {
    'POS.vbp': 'Type=Exe\r\nForm=frmLogin.frm\r\nForm=frmMain.frm\r\nForm=frmReport.frm\r\nName="POS"\r\n',
    'frmLogin.frm': form('frmLogin', 'Program Login', [
      '   Begin VB.TextBox txtUser', '      Left = 1200', '      Top = 300', '      Width = 2000', '      Height = 315', '   End',
      '   Begin VB.CommandButton cmdOK', '      Caption = "&OK"', '      Left = 3840', '      Top = 2400', '      Width = 1215', '      Height = 375', '   End',
    ], ['Private Sub cmdOK_Click()', '  frmMain.Show', 'End Sub']),
    'frmMain.frm': form('frmMain', 'Shop', [
      '   Begin VB.Menu mnuReports', '      Caption = "&Reports"', '      Begin VB.Menu mnuDaily', '         Caption = "&Daily report"', '      End', '   End',
    ], ['Private Sub mnuDaily_Click()', '  frmReport.Show vbModal', 'End Sub']),
    'frmReport.frm': form('frmReport', 'Daily report', [], []),
  }
  for (const [path, text] of Object.entries(files)) {
    mkdirSync(dirname(join(code, 'pos', path)), { recursive: true })
    writeFileSync(join(code, 'pos', path), text)
  }
  execFileSync('git', ['init', '-q'], { cwd: join(code, 'pos') })
  const root = join(dirname(code), 'architecture')
  mkdirSync(root)
  execFileSync('git', ['init', '-q'], { cwd: root })
  const model = await FolderModel.open(join(root, '.radical', 'model'))
  const call = async (name: string, input: unknown = {}) => model.call(name, input)
  const nodes = async () => JSON.parse((await call('search_model', { query: 'LIST NODES' })).text).rows as Array<{ id: string; type: string; label: string } & Record<string, unknown>>
  const relations = async () => JSON.parse((await call('search_model', { query: 'LIST RELATIONS' })).text).rows as Array<{ relationType: string; sourceLabel: string; targetLabel: string } & Record<string, unknown>>
  return { code, root, call, nodes, relations, model }
}

describe('Radical Assay over MCP: desktop screens', () => {
  it('writes mockups of forms with wireframes drawn from them, joined where one form\'s code opens another', async () => {
    const { call, nodes, relations } = await central()
    const started = await call('assay_start', { directories: ['../code'] })
    expect(started.text).toContain('pos (../code/pos, no commit): 1 unit, 3 forms, 6 entry points.')
    const screens = JSON.parse((await call('assay_facts', { repository: 'pos', kind: 'screens' })).text).facts
    expect(screens.map((s: { id: string; opens?: unknown[] }) => [s.id, s.opens?.length ?? 0])).toEqual([['pos:screen:.:frmLogin', 1], ['pos:screen:.:frmMain', 1], ['pos:screen:.:frmReport', 0]])
    const applied = await call('assay_apply', { plan: {
      elements: [
        { key: 'pos', type: 'system', label: 'Point of sale', facts: ['pos:unit:.'], confidence: 'inferred' },
        { key: 'app', type: 'container', label: 'POS app', parent: 'pos', units: ['pos:unit:.'], facts: ['pos:unit:.'], confidence: 'observed' },
      ],
      mockups: [
        { key: 'm-login', label: 'Sign in', screen: 'pos:screen:.:frmLogin', presentedBy: 'app', parent: 'pos' },
        { key: 'm-main', label: 'Main menu', screen: 'pos:screen:.:frmMain', presentedBy: 'app', parent: 'pos' },
        { key: 'm-report', label: 'Daily report', screen: 'pos:screen:.:frmReport', presentedBy: 'app', parent: 'pos' },
      ],
    } })
    expect(applied.ok).toBe(true)
    const mockups = (await nodes()).filter((n) => n.type === 'mockup')
    expect(mockups.map((m) => [m.label, m.screen]).sort()).toEqual([['Daily report', 'frmReport'], ['Main menu', 'frmMain'], ['Sign in', 'frmLogin']])
    const node = await call('search_model', { query: `GET NODE ${mockups.find((m) => m.label === 'Sign in')!.id}` })
    expect(JSON.parse(node.text).node.wireframe).toMatch(/^<svg xmlns="http:\/\/www.w3.org\/2000\/svg"[\s\S]*>OK<\/text>/)
    expect((await relations()).filter((r) => r.relationType === 'navigates-to').map((r) => [r.sourceLabel, r.targetLabel, r.description]).sort()).toEqual([
      ['Main menu', 'Daily report', 'chooses "Daily report"'], ['Sign in', 'Main menu', 'clicks "OK"'],
    ])
    expect((await call('get_issues')).text).toMatch(/^No issues/)
  })
})
