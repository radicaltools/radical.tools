# radical CLI

The `radical` command line for Radical Markdown model folders.

## radical check

```sh
npm run build -w @radicaltools/cli
node apps/cli/dist/index.js check path/to/model
```

Checks one model folder and prints what it finds:

- **the folder**: a valid `radical.md`, JSON sidecars that parse, no git
  conflict markers, node files with an id and a type, no duplicate ids, and
  views, sequences and slides that point at things the model has;
- **the metamodel**: the Validation list Studio shows and `get_issues`
  returns over MCP, with the same severities;
- **completeness**: requirements verified by a scenario, satisfied by an
  element, derived from a need; needs with requirements; accepted ADRs with
  a fitness function and their date, context, decision and consequences;
  fitness functions linked and with a threshold.

`radical check --list-rules` lists every rule. It reads the files only and
never writes the model.

Exit status: 0 no errors (warnings allowed), 1 errors, 2 the check could not
run. `--format json` prints the result as JSON, `--format github` as GitHub
Actions annotations.

### Config

`radical-check.json` in the working directory (or `--config <file>`) sets
rules by id, or one kind of metamodel issue by `metamodel/<code>`:

```json
{
  "rules": {
    "metamodel": "error",
    "adr-incomplete": "off",
    "requirement-without-scenario": { "severity": "error", "max": 104 }
  }
}
```

With `max`, up to that many findings pass as warnings and one more fails the
check, so an existing model can adopt a rule before every gap is closed.
`--ratchet` lowers each `max` to the count found now and writes the config
back; it never raises one.
