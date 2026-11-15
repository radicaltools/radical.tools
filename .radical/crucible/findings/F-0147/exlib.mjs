// A scratch project with .radical/crucible/crucible.json and one prepared
// round of one run, for radical explore verify (nothing is served).
import { join, mkdirSync, writeFileSync } from './flib.mjs'

export function project(root, runs = [1]) {
  mkdirSync(join(root, ".radical", "crucible"), { recursive: true })
  const rounds = join(root, '.radical', 'crucible', 'rounds')
  writeFileSync(join(root, '.radical', 'crucible', 'crucible.json'), JSON.stringify({ findings: '.radical/crucible/findings', explore: { rounds: '.radical/crucible/rounds', serve: [] } }))
  const name = `round-${runs[0]}-${runs[runs.length - 1]}`
  const entries = runs.map((run) => {
    const folder = join(rounds, name, `run-${run}`)
    mkdirSync(folder, { recursive: true })
    return { run, folder, ports: { app: 4900 + run, hub: 5000 + run, other: 5100 + run }, verified: [] }
  })
  writeFileSync(join(rounds, name, 'round.json'), JSON.stringify({ round: name, from: runs[0], to: runs[runs.length - 1], commit: 'abc1234', created: new Date().toISOString(), runs: entries }, null, 2))
  return { round: join(rounds, name), runFolder: (run) => entries.find((e) => e.run === run).folder }
}
