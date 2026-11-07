import { execFileSync } from 'node:child_process'
import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { extractRepository, linkRepositories } from '../src/index'

/** A git repository of `files` (path → text) in a fresh folder. */
function repo(name: string, files: Record<string, string>, root = mkdtempSync(join(tmpdir(), 'assay-vb6-'))): string {
  const dir = join(root, name)
  for (const [path, text] of Object.entries(files)) {
    mkdirSync(dirname(join(dir, path)), { recursive: true })
    writeFileSync(join(dir, path), text)
  }
  execFileSync('git', ['init', '-q'], { cwd: dir })
  return dir
}

const vbp = (name: string, extra = '') => `Type=Exe\r\nReference=*\\G{00000205-0000-0010-8000-00AA006D2EA4}#2.5#0#..\\..\\Common Files\\System\\ado\\msado25.tlb#Microsoft ActiveX Data Objects 2.5 Library\r\nForm=frmMain.frm\r\nName="${name}"\r\n${extra}`

describe('radical assay: VB6 applications as they are', () => {
  it('reads the port a server listens on and a client\'s server list from INI settings, and links them by that port', () => {
    const root = mkdtempSync(join(tmpdir(), 'assay-vb6-'))
    const server = repo('game-server', { 'Server.vbp': vbp('GameServer'), 'frmMain.frm': '', 'Server.ini': '[INIT]\r\nDescripcion=Test\r\nStartPort=24582\r\nUrlServer=http://localhost:1337\r\n' }, root)
    const client = repo('game-client', {
      'Client.vbp': vbp('GameClient'), 'frmMain.frm': '',
      'INIT/sinfo.dat': '[INIT]\r\nCant=3\r\n\r\n[S1]\r\nDesc=Main\r\nIP=45.235.98.29\r\nPJ=24582\r\nMundo=Alkon\r\n\r\n[S2]\r\nIP=10.0.0.9\r\nPort=8080\r\n\r\n[S3]\r\nDesc=Local\r\nIP=localhost\r\nPJ=7666\r\n',
      'INIT/Graficos.dat': 'Grh1=1-2-3\r\n',
    }, root)
    const facts = [extractRepository(client), extractRepository(server)]
    expect(facts[1].units[0].ports).toEqual([24582])
    expect(facts[0].addresses.map((a) => [a.host, a.port, a.text, a.evidence.file, a.evidence.line])).toEqual([
      ['45.235.98.29', 24582, 'IP=45.235.98.29 PJ=24582', 'INIT/sinfo.dat', 6],
      ['10.0.0.9', 8080, 'IP=10.0.0.9 Port=8080', 'INIT/sinfo.dat', 11],
      ['localhost', 7666, 'IP=localhost PJ=7666', 'INIT/sinfo.dat', 16],
    ])
    // 24582 is the server's alone; 8080 is everyone's, and 7666 nobody's here.
    expect(linkRepositories(facts).map((l) => [l.kind, l.from, l.to, l.confidence, l.detail])).toEqual([
      ['address', 'game-client:unit:.', 'game-server:unit:.', 'inferred', 'IP=45.235.98.29 PJ=24582'],
    ])
  })

  it('reads a database named by its driver, the tables an SQL file creates and the record source of a data control', () => {
    const dir = repo('billing', {
      'Billing.vbp': vbp('Billing'), 'frmMain.frm': '',
      'modDatabase.bas': 'Public Sub Connect()\r\n    Conn.ConnectionString = "DRIVER={MySQL ODBC 8.0 ANSI Driver};" & _\r\n                            "SERVER=" & Database_Host & ";" & _\r\n                            "DATABASE=" & Database_Name & ";"\r\nEnd Sub\r\n',
      'Fixtures/schema.sql': 'CREATE TABLE account (id INT);\nCREATE TABLE IF NOT EXISTS `invoice` (id INT);\n',
      'frmLogin.frm': 'Begin VB.Form frmLogin\r\n   Begin MSAdodcLib.Adodc Adodc1\r\n      CommandType     =   2\r\n      RecordSource    =   "Users"\r\n   End\r\nEnd\r\n',
    })
    const facts = extractRepository(dir)
    expect(facts.databases.map((d) => [d.engine, d.server, d.name, d.evidence.file])).toEqual([['MySQL', undefined, undefined, 'modDatabase.bas']])
    expect(facts.tables.map((t) => [t.table, t.evidence.file]).sort()).toEqual([['Users', 'frmLogin.frm'], ['account', 'Fixtures/schema.sql'], ['invoice', 'Fixtures/schema.sql']])
    expect(linkRepositories([facts]).map((l) => [l.kind, l.detail])).toEqual([['data', 'MySQL']])
  })

  it('leaves out commands, comments, CI configuration, translations and links opened in the browser', () => {
    const dir = repo('client', {
      'Client.vbp': vbp('Client'), 'frmMain.frm': '',
      'modCommands.bas': 'Public Sub Parse(ByVal s As String)\r\n    If s = "/SALIR" Then Quit\r\n    \' See "http://vbaccelerator.com/strings" for the original\r\nEnd Sub\r\n',
      'modWeb.bas': 'Public Sub Help()\r\n    ShellExecute 0, "open", "https://www.reddit.com/r/game", "", "", 1\r\nEnd Sub\r\nPublic Sub Check()\r\n    Http.Open "GET", "https://api.github.com/repos/x/y/releases/latest", False\r\n    s = Inet1.OpenURL("https://status.example.org/v1/ping")\r\n    u = Url & Ip & "/json/"\r\n    If c = "/_BUG" Then Report\r\nEnd Sub\r\n',
      '.github/config.yml': 'url: https://probot.github.io\n',
      'Lenguajes/english.json': '{ "credits": "https://ffmpeg.org" }\n',
    })
    const facts = extractRepository(dir)
    expect(facts.urls.map((u) => u.path)).toEqual(['/repos/x/y/releases/latest', '/v1/ping'])
    // Inet's OpenURL calls the address; ShellExecute only shows it to the user.
    expect(facts.addresses.map((a) => a.host)).toEqual(['api.github.com', 'status.example.org'])
  })

  it('reads each reference once, by its library, with DirectX among the technologies and the version information as the description', () => {
    const dir = repo('game', {
      'Game.vbp': `${vbp('Game')}Reference=*\\G{E1211242-8E94-11D1-8808-00C04FC2C603}#1.0#0#..\\Windows\\SysWow64\\DX8VB.DLL#DirectX 8 for Visual Basic Type Library\r\nObject={248DD890-BB45-11CF-9ABC-0080C7E7B78D}#1.0#0; MSWINSCK.OCX\r\nVersionFileDescription="Argentum game client"\r\n`,
      'frmMain.frm': '',
    })
    const facts = extractRepository(dir)
    expect(facts.dependencies.map((d) => [d.package, d.file])).toEqual([
      ['DirectX 8 for Visual Basic Type Library', 'DX8VB.DLL'],
      ['MSWINSCK.OCX', undefined],
      ['Microsoft ActiveX Data Objects 2.5 Library', 'msado25.tlb'],
    ])
    expect(facts.units[0]).toMatchObject({ technology: ['ADO', 'DirectX', 'VB6', 'Winsock'], description: 'Argentum game client (VB6 Standard EXE)' })
  })

  it('lists READMEs and changelogs whatever their names', () => {
    const dir = repo('pos', { 'App/POS.vbp': vbp('POS'), 'App/frmMain.frm': '', 'App/README!!.txt': 'Login: admin\n', 'Changelog-server.txt': 'v1\n', 'README.md': '# POS\n' })
    expect(extractRepository(dir).documents.map((d) => d.file)).toEqual(['App/README!!.txt', 'Changelog-server.txt', 'README.md'])
  })
})
