import { execFileSync } from 'node:child_process'
import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { checkPlan, extractRepository, factIndex, linkRepositories, parsePlan } from '../src/index'

/** A git repository of `files` (path → text) in a fresh folder. */
function repo(name: string, files: Record<string, string>): string {
  const dir = join(mkdtempSync(join(tmpdir(), 'assay-routines-')), name)
  for (const [path, text] of Object.entries(files)) {
    mkdirSync(dirname(join(dir, path)), { recursive: true })
    writeFileSync(join(dir, path), text)
  }
  execFileSync('git', ['init', '-q'], { cwd: dir })
  return dir
}

const routines = (facts: ReturnType<typeof extractRepository>) => facts.routines.filter((r) => !r.called).map((r) => [r.unit?.split(':unit:')[1], r.name, r.kind, r.evidence.line])

describe('radical assay: stored routines and the code calling them', () => {
  it("reads a repository of an Oracle schema alone: its tables and its PL/SQL, a package's members, a procedure, a trigger, and what each touches", () => {
    const facts = extractRepository(repo('hr', {
      'db/hr_tables.sql': [
        'CREATE TABLE departments (',
        '  department_id NUMBER(4) PRIMARY KEY,',
        '  department_name VARCHAR2(30) NOT NULL',
        ');',
        'CREATE TABLE employees (',
        '  employee_id NUMBER(6) PRIMARY KEY,',
        '  department_id NUMBER(4)',
        ');',
        'ALTER TABLE employees ADD ( CONSTRAINT emp_dept_fk FOREIGN KEY (department_id) REFERENCES departments );',
        'CREATE GLOBAL TEMPORARY TABLE emp_staging ( employee_id NUMBER(6) ) ON COMMIT DELETE ROWS;',
        'CREATE TABLE job_history ( employee_id NUMBER(6), start_date DATE );',
        '',
      ].join('\n'),
      'db/emp_pkg.pks': 'CREATE OR REPLACE PACKAGE emp_pkg AS\n  PROCEDURE hire(p_id NUMBER, p_dept NUMBER);\n  FUNCTION headcount(p_dept NUMBER) RETURN NUMBER;\nEND emp_pkg;\n/\n',
      'db/emp_pkg.pkb': [
        'CREATE OR REPLACE PACKAGE BODY emp_pkg AS',
        '  PROCEDURE hire(p_id NUMBER, p_dept NUMBER) IS',
        '  BEGIN',
        "    INSERT INTO employees (employee_id, department_id) VALUES (p_id, p_dept); -- not FROM jobs",
        '  END hire;',
        '  FUNCTION headcount(p_dept NUMBER) RETURN NUMBER IS',
        '    n NUMBER;',
        '  BEGIN',
        '    SELECT COUNT(*) INTO n FROM employees WHERE department_id = p_dept;',
        '    RETURN n;',
        '  END headcount;',
        'END emp_pkg;',
        '/',
        'CREATE OR REPLACE PROCEDURE transfer(p_id NUMBER, p_dept NUMBER) AS',
        'BEGIN',
        "  UPDATE employees SET department_id = p_dept WHERE employee_id = p_id;",
        '  emp_pkg.hire(p_id, p_dept);',
        'END;',
        '/',
        'CREATE OR REPLACE TRIGGER update_job_history',
        '  AFTER UPDATE OF department_id ON employees FOR EACH ROW',
        'BEGIN',
        '  INSERT INTO job_history (employee_id, start_date) VALUES (:old.employee_id, SYSDATE);',
        'END;',
        '/',
        '',
      ].join('\n'),
    }))
    expect(facts.units.map((u) => [u.path, u.stack])).toEqual([['db', 'sql']])
    expect(facts.tables.map((t) => t.table).sort()).toEqual(['departments', 'emp_staging', 'employees', 'job_history'])
    expect(facts.tables.find((t) => t.table === 'employees')?.references?.map((r) => [r.column, r.table])).toEqual([['department_id', 'departments']])
    expect(routines(facts)).toEqual([
      ['db', 'emp_pkg', 'package', 1], ['db', 'emp_pkg.hire', 'procedure', 2], ['db', 'emp_pkg.headcount', 'function', 6],
      ['db', 'transfer', 'procedure', 14], ['db', 'update_job_history', 'trigger', 20],
    ])
    const of = (name: string) => facts.routines.find((r) => r.name === name)!
    expect([of('emp_pkg.hire').writes, of('emp_pkg.headcount').reads, of('transfer').writes, of('transfer').calls, of('update_job_history').table, of('update_job_history').writes, of('emp_pkg').dialect])
      .toEqual([['employees'], ['employees'], ['employees'], ['emp_pkg.hire'], 'employees', ['job_history'], 'Oracle'])
  })

  it("reads SQL Server's procedures, PostgreSQL's functions and triggers, and MySQL's procedures", () => {
    const facts = extractRepository(repo('shops', {
      'mssql/orders.sql': 'CREATE TABLE dbo.orders (id INT IDENTITY(1,1) PRIMARY KEY, status NVARCHAR(20));\nGO\nCREATE OR ALTER PROCEDURE dbo.usp_close_order @id INT AS\nBEGIN\n  UPDATE dbo.orders SET status = N\'closed\' WHERE id = @id;\nEND\nGO\n',
      'pg/schema.sql': 'CREATE TABLE film (film_id SERIAL PRIMARY KEY, last_update TIMESTAMP);\nCREATE OR REPLACE FUNCTION last_updated() RETURNS trigger AS $$\nBEGIN\n  NEW.last_update = now();\n  RETURN NEW;\nEND $$ LANGUAGE plpgsql;\nCREATE TRIGGER last_updated BEFORE UPDATE ON film FOR EACH ROW EXECUTE FUNCTION last_updated();\n',
      'mysql/rewards.sql': 'CREATE TABLE payment (payment_id INT AUTO_INCREMENT PRIMARY KEY, amount DECIMAL(5,2));\nDELIMITER //\nCREATE PROCEDURE rewards_report(IN min_amount DECIMAL(5,2))\nBEGIN\n  SELECT * FROM payment WHERE amount > min_amount;\nEND //\nDELIMITER ;\n',
    }))
    expect(routines(facts)).toEqual([
      ['mssql', 'usp_close_order', 'procedure', 3],
      ['mysql', 'rewards_report', 'procedure', 3],
      ['pg', 'last_updated', 'function', 2], ['pg', 'last_updated', 'trigger', 7],
    ])
    expect(facts.routines.find((r) => r.name === 'usp_close_order')?.writes).toEqual(['orders'])
    expect(facts.routines.find((r) => r.kind === 'trigger')).toMatchObject({ table: 'film', calls: ['last_updated'], dialect: 'PostgreSQL' })
  })

  it("links the code calling a routine to it: JDBC, Spring's SimpleJdbcCall, JPA, ADO.NET, Dapper, VB6, Python, and one the database holds", () => {
    const facts = extractRepository(repo('calls', {
      'db/pkg.pks': 'CREATE OR REPLACE PACKAGE hr_api AS\n  PROCEDURE raise_salary(p_id NUMBER);\nEND hr_api;\n/\n',
      'java/pom.xml': '<project><artifactId>java</artifactId></project>',
      'java/src/main/java/a/Hr.java': [
        'package a;',
        'class Hr {',
        '  void raise() { conn.prepareCall("{call hr_api.raise_salary(?)}"); }',
        '  void report() { new SimpleJdbcCall(dataSource).withCatalogName("REPORTS").withProcedureName("MONTHLY_TOTALS").execute(params); }',
        '  @Procedure(procedureName = "audit_login") void audit(String user);',
        '  void plsql() { conn.prepareCall("BEGIN :r := hr_api.raise_salary(:id); END;"); }',
        '}',
        '',
      ].join('\n'),
      'net/Shop.csproj': '<Project Sdk="Microsoft.NET.Sdk"></Project>',
      'net/Orders.cs': 'class Orders {\n  void Close() {\n    var cmd = new SqlCommand("dbo.usp_close_order", conn);\n    cmd.CommandType = CommandType.StoredProcedure;\n  }\n  void List() => conn.Query<Order>("usp_list_orders", new { id }, commandType: CommandType.StoredProcedure);\n}\n',
      'vb/Shop.vbp': 'Type=Exe\r\nModule=modDb; modDb.bas\r\nName="Shop"\r\n',
      'vb/modDb.bas': 'Attribute VB_Name = "modDb"\r\nSub Post()\r\n  cmd.CommandText = "sp_post_invoice"\r\n  cmd.CommandType = adCmdStoredProc\r\nEnd Sub\r\n',
      'py/requirements.txt': 'oracledb\n',
      'py/main.py': 'cursor.callproc("billing.close_month", [2026, 11])\nlabel = "Call us"\n',
      'java/src/main/resources/mappers/HrMapper.xml': '<mapper namespace="a.HrMapper">\n  <update id="close" statementType="CALLABLE">{call hr_api.close_month(#{id})}</update>\n</mapper>\n',
    }))
    expect(facts.routineCalls.map((c) => [c.unit.split(':unit:')[1], c.routine, c.via])).toEqual([
      ['java', 'hr_api.raise_salary', 'JDBC'], ['java', 'reports.monthly_totals', 'Spring SimpleJdbcCall'], ['java', 'audit_login', 'JPA'],
      ['java', 'hr_api.close_month', 'JDBC'],
      ['net', 'dbo.usp_close_order', 'ADO.NET'], ['net', 'usp_list_orders', 'ADO.NET'],
      ['py', 'billing.close_month', 'DB-API'],
      ['vb', 'sp_post_invoice', 'ADO'],
    ])
    const links = linkRepositories([facts]).filter((l) => l.kind === 'routine').map((l) => [l.from.split(':unit:')[1], l.to.split(':routine:').pop()])
    expect(links).toContainEqual(['java', 'db:hr_api.raise_salary'])
    // Beside the units' code, the package is the database's: no unit's.
    expect(facts.routines.find((r) => r.name === 'hr_api.raise_salary')).toMatchObject({ kind: 'procedure' })
    expect(facts.routines.find((r) => r.name === 'hr_api.raise_salary')?.unit).toBeUndefined()
    expect(facts.routines.filter((r) => r.called).map((r) => r.name).sort()).toEqual(['audit_login', 'billing.close_month', 'dbo.usp_close_order', 'hr_api.close_month', 'reports.monthly_totals', 'sp_post_invoice', 'usp_list_orders'])
    // A plan relates the caller to the database holding the routine, on the routine link.
    const all = linkRepositories([facts])
    const link = all.find((l) => l.kind === 'routine' && l.to.endsWith(':hr_api.raise_salary'))!
    const { plan } = parsePlan({
      elements: [
        { key: 'java', type: 'container', label: 'Java app', units: ['calls:unit:java'], facts: ['calls:unit:java'], confidence: 'observed' },
        { key: 'hr', type: 'database', label: 'HR database', facts: [link.to], confidence: 'inferred' },
      ],
      relations: [
        { from: 'java', to: 'hr', relationType: 'interacts', label: 'calls hr_api.raise_salary', facts: [link.id], confidence: 'observed' },
        // The call of another routine, which the HR database does not hold, backs no relation to it.
        { from: 'java', to: 'hr', relationType: 'interacts', label: 'calls audit_login', facts: [all.find((l) => l.to.endsWith(':audit_login'))!.id], confidence: 'observed' },
      ],
    })
    expect(checkPlan(plan, factIndex([facts], all), () => false)).toEqual([
      'relations[1] (java → hr): the links and dependencies it cites join neither of its ends to the other',
      'relations[1] (java → hr): observed, but cites no dependency or observed link that states it',
    ])
  })

  it("reads a package's members only, not their local subprograms, past strings holding -- and q'[…]', and a database's final state", () => {
    const facts = extractRepository(repo('lib', {
      'ora/pdf.pkb': [
        'CREATE OR REPLACE PACKAGE BODY pdf AS',
        '  FUNCTION header RETURN VARCHAR2 IS',
        "    l_xsl VARCHAR2(200) := '<xsl:stylesheet>",
        "      <!-- -- not a comment -->",
        "    </xsl:stylesheet>';",
        "    l_q VARCHAR2(20) := q'[it's]';",
        '    PROCEDURE show_line IS',
        '    BEGIN',
        "      l_q := CASE WHEN l_q IS NULL THEN 'a' ELSE CASE WHEN 1 = 1 THEN 'b' END END;",
        '    END show_line;',
        '  BEGIN',
        '    show_line;',
        '    RETURN l_xsl;',
        '  END header;',
        '  PROCEDURE add_page IS',
        '  BEGIN',
        '    NULL;',
        '  END add_page;',
        'END pdf;',
        '/',
        '',
      ].join('\n'),
      'ora/install.sql': '@helpers.sql\nCREATE TABLE pages (id NUMBER(6));\nDROP PACKAGE xdb.install_helper;\n',
      'ora/helpers.sql': 'CREATE OR REPLACE PACKAGE install_helper AS\n  PROCEDURE run;\nEND install_helper;\n/\n',
      'ora/zz_teardown.sql': 'DROP TABLE pages;\nDROP PACKAGE pdf;\n',
      'demos/pdf_demo.sql': 'CREATE TABLE demo_log (id NUMBER(6));\nBEGIN\n  pdf.add_page;\n  INSERT INTO demo_log VALUES (1);\nEND;\n/\n',
    }))
    expect(routines(facts).map((r) => r[1])).toEqual(['pdf', 'pdf.header', 'pdf.add_page'])
    expect(facts.tables.map((t) => t.table)).toEqual(['demo_log', 'pages'])
    expect(facts.routineCalls.map((c) => [c.unit.split(':unit:')[1], c.routine])).toEqual([['demos', 'pdf.add_page']])
    expect(linkRepositories([facts]).filter((l) => l.to.endsWith(':unit:ora')).map((l) => [l.kind, l.from.split(':unit:')[1]])).toEqual([['routine', 'demos']])
  })

  it("reads Oracle's schemas referencing each other's tables, a Sqitch project beside the apps, PGDATABASE, and the functions a query selects", () => {
    const schemas = extractRepository(repo('schemas', {
      'hr/hr_cre.sql': 'CREATE TABLE employees (employee_id NUMBER(6) PRIMARY KEY);\n',
      'hr/hr_drop.sql': 'DROP TABLE employees;\n',
      'oe/oe_cre.sql': [
        'CREATE TABLE orders (order_id NUMBER(12), sales_rep_id NUMBER(6));',
        'CREATE TABLE categories_tab OF category_typ;',
        'ALTER TABLE orders ADD ( CONSTRAINT orders_pk PRIMARY KEY (order_id), CONSTRAINT orders_rep_fk FOREIGN KEY (sales_rep_id) REFERENCES hr.employees(employee_id) );',
        '',
      ].join('\n'),
      'oe/doe.sql': 'DROP TABLE orders;\nDROP TABLE categories_tab;\n',
    }))
    expect(schemas.tables.map((t) => [t.unit.split(':unit:')[1], t.table]).sort()).toEqual([['hr', 'employees'], ['oe', 'categories_tab'], ['oe', 'orders']])
    expect(linkRepositories([schemas]).map((l) => [l.kind, l.from.split(':unit:')[1], l.to.split(':unit:')[1]])).toEqual([['data', 'oe', 'hr']])

    const game = extractRepository(repo('game', {
      'schema/sqitch.plan': '%project=game\n\nplayers 2026-01-01T00:00:00Z dev <dev@example.com>\n',
      'schema/deploy/players.sql': [
        'CREATE TABLE player (id SERIAL PRIMARY KEY);',
        'CREATE TABLE event (id BIGINT) PARTITION BY RANGE (id);',
        'CREATE TABLE event_default PARTITION OF event DEFAULT;',
        'CREATE SEQUENCE tic_seq;',
        'CREATE FUNCTION register_player(name TEXT) RETURNS INTEGER AS $$ BEGIN INSERT INTO player DEFAULT VALUES; RETURN 1; END $$ LANGUAGE plpgsql;',
        '',
      ].join('\n'),
      'schema/revert/players.sql': 'DROP TABLE player;\nDROP FUNCTION register_player;\n',
      'tic/go.mod': 'module example.com/tic\n\ngo 1.22\n\nrequire github.com/jackc/pgx/v5 v5.6.0\n',
      'tic/main.go': 'package main\n\nfunc main() {\n\tconn.QueryRow(ctx, "SELECT last_value FROM tic_seq")\n\tconn.Exec(ctx, "SELECT register_player($1), count(*) FROM player", name)\n\tconn.QueryRow(ctx, "SELECT planet INTO target FROM player")\n}\n',
      'docker/compose.yml': 'services:\n  tic:\n    build:\n      context: ../tic\n    environment:\n      PGHOST: /var/run/postgresql\n      PGDATABASE: game\n',
      'web/package.json': '{ "name": "web", "scripts": { "start": "vite" } }',
      'web/src/seo.ts': "export const ld = { '@context': 'https://schema.org' }\n",
    }))
    expect(game.units.map((u) => [u.path, u.stack])).toEqual([['schema', 'sql'], ['tic', 'go'], ['web', 'npm']])
    // (The code naming a table holds it too: tic's player.)
    expect(game.tables.map((t) => [t.unit.split(':unit:')[1], t.table]).sort()).toEqual([['schema', 'event'], ['schema', 'event_default'], ['schema', 'player'], ['tic', 'player']])
    expect(game.databases.map((d) => [d.unit?.split(':unit:')[1], d.engine, d.name])).toEqual([['tic', 'PostgreSQL', 'game']])
    expect(game.routineCalls.map((c) => [c.unit.split(':unit:')[1], c.routine, c.via])).toEqual([['tic', 'register_player', 'SQL function']])
    expect(linkRepositories([game]).filter((l) => l.kind === 'address')).toEqual([])
  })

  it("reads an Ant project, the routine names a constant holds, and no SQL in a VB comment, an annotation or a caption", () => {
    const facts = extractRepository(repo('apps', {
      'ant/build.xml': '<?xml version="1.0"?>\n<project name="Payroll" default="default" basedir=".">\n  <import file="nbproject/build-impl.xml"/>\n</project>\n',
      'ant/nbproject/project.xml': '<project/>',
      'ant/nbproject/project.properties': 'file.reference.ojdbc6.jar=lib/ojdbc6.jar\nmain.class=pay.Main\n',
      'ant/src/pay/Dao.java': [
        'package pay;',
        'interface Names { String F_RAISE = "F_RAISE_SALARY"; }',
        'class Dao {',
        '  void raise() { new SimpleJdbcCall(ds).withFunctionName(Names.F_RAISE).execute(); }',
        '  @Tool(description = "List the owners") void owners() { }',
        '  static final String CAPTION = "Call failed (%1)";',
        '}',
        '',
      ].join('\n'),
      'ant/src/jdbc.properties': 'url=jdbc:oracle:thin:@localhost:1521:XE\n',
      'vb/App.vbp': 'Type=Exe\r\nModule=modMain; modMain.bas\r\nName="App"\r\n',
      'vb/modMain.bas': 'Attribute VB_Name = "modMain"\r\nSub Main()\r\n  \' Call OldRoutine(1)\r\n  Select Case cmd\r\n    Case "/PASSWORD"\r\n      Call frmPassword.Show(1)\r\n  End Select\r\nEnd Sub\r\n',
    }))
    expect(facts.units.map((u) => [u.path, u.stack, u.kind])).toEqual([['ant', 'ant', 'app'], ['vb', 'vb6', 'app']])
    expect(facts.routineCalls.map((c) => [c.unit.split(':unit:')[1], c.routine, c.via])).toEqual([['ant', 'f_raise_salary', 'Spring SimpleJdbcCall']])
    expect(facts.databases.map((d) => [d.engine, d.name])).toEqual([['Oracle', 'XE']])
  })

  it('reads the Oracle database a JDBC URL, a TNS descriptor, an Easy Connect string and makedsn name', () => {
    const facts = extractRepository(repo('ora', {
      'svc/pom.xml': '<project><artifactId>svc</artifactId></project>',
      'svc/src/main/resources/application.properties': 'spring.datasource.url=jdbc:oracle:thin:@//dbhost.corp:1521/ORCLPDB1\nlegacy.url=jdbc:oracle:thin:@olddb:1521:LEGACY\n',
      'net/Billing.csproj': '<Project Sdk="Microsoft.NET.Sdk"></Project>',
      'net/appsettings.json': '{ "ConnectionStrings": { "Billing": "User Id=billing;Password=x;Data Source=(DESCRIPTION=(ADDRESS=(PROTOCOL=TCP)(HOST=billing-db)(PORT=1521))(CONNECT_DATA=(SERVICE_NAME=BILLPDB)))" } }',
      'py/requirements.txt': 'oracledb\n',
      'py/main.py': 'conn = oracledb.connect(user="u", password=pw, dsn="reports-db:1521/REPORTS")\nold = cx_Oracle.makedsn("archive-db", 1521, service_name="ARCH")\n',
    }))
    expect(facts.databases.map((d) => [d.unit?.split(':unit:')[1], d.engine, d.server, d.name]).sort()).toEqual([
      ['net', 'Oracle', 'billing-db', 'BILLPDB'],
      ['py', 'Oracle', 'archive-db', 'ARCH'], ['py', 'Oracle', 'reports-db', 'REPORTS'],
      ['svc', 'Oracle', 'dbhost.corp', 'ORCLPDB1'], ['svc', 'Oracle', 'olddb', 'LEGACY'],
    ])
  })
})
