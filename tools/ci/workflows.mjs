#!/usr/bin/env node
// What the CI/CD pipeline pack asks of the workflows under .github/workflows,
// read as YAML (js-yaml) and checked without running them. Each check
// returns its problems, one sentence each naming the file and the job:
//
//   concurrency   "Superseded runs cancelled, deploys never": a workflow run
//                 by pull requests cancels its superseded runs; a job that
//                 deploys is in a concurrency group that never cancels it.
//   deploy-build  "Deploys take the build's digest", for a static site: only
//                 deploy.yml deploys; its deploy job uploads what it built
//                 earlier in the same job, builds nothing once it began to
//                 upload, and nothing in deploy.yml is built twice.
//   cloud-keys    "No stored cloud keys, tight trust": every cloud sign-in
//                 assumes a role through OIDC (role-to-assume, id-token:
//                 write); no step passes a stored key, no secret or variable
//                 is named like a cloud key. With --secrets also the names of
//                 the repository's and its environments' secrets (gh).
//   mirror        "CI runs what verify runs": every run step of ci.yml is
//                 npm ci or npm run <script>, and npm run verify runs each of
//                 those scripts. The gate job ci and the jobs that write to
//                 the repository (contents: write) are left out: they check
//                 nothing a developer would run.
//
//   npm run check:workflows                        every check
//   node tools/ci/workflows.mjs <check>… [--root <dir>] [--secrets]
//
// Exits 1 with the problems printed. tools/ci/workflows.test.mjs runs each
// check on sample workflows and on the repository's own.

import { spawnSync } from 'node:child_process'
import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
import yaml from 'js-yaml'

const ROOT = resolve(import.meta.dirname, '../..')

/** The workflow files of a repository, parsed. */
export function loadWorkflows(root = ROOT) {
  const dir = join(root, '.github/workflows')
  if (!existsSync(dir)) return []
  return readdirSync(dir).filter((f) => /\.ya?ml$/.test(f)).sort().map((name) => {
    const text = readFileSync(join(dir, name), 'utf8')
    return { name, file: `.github/workflows/${name}`, text, doc: yaml.load(text) ?? {} }
  })
}

/** The events a workflow runs on. */
export function events(doc) {
  const on = doc?.on
  if (typeof on === 'string') return [on]
  if (Array.isArray(on)) return on
  return on && typeof on === 'object' ? Object.keys(on) : []
}

const jobsOf = (doc) => Object.entries(doc?.jobs && typeof doc.jobs === 'object' ? doc.jobs : {})
const stepsOf = (job) => (Array.isArray(job?.steps) ? job.steps : [])
const runOf = (step) => (typeof step?.run === 'string' ? step.run : '')
const usesOf = (step) => (typeof step?.uses === 'string' ? step.uses : '')

/** Actions that sign in to a cloud. */
const CLOUD_LOGIN = /^(aws-actions\/configure-aws-credentials|azure\/login|google-github-actions\/auth)@/
/** Commands that upload to a cloud or change what it serves. */
const DEPLOY_RUN = /\b(aws\s+(s3|s3api|cloudfront)|az\s+storage|gsutil|gcloud\s+storage)\s/
/** Commands that build what is deployed. */
const BUILD_RUN = /\bnpm run (build[\w:-]*|dist)\b(\s+-w\s+\S+)?|\b(?:vite|electron-vite) build\b|\b(?:docker|podman) (?:buildx )?build\b|\bbuildah (?:bud|build)\b/g

const isDeployStep = (step) => CLOUD_LOGIN.test(usesOf(step)) || DEPLOY_RUN.test(runOf(step))
const buildsOf = (step) => [
  ...[...runOf(step).matchAll(BUILD_RUN)].map((m) => m[0].replace(/\s+/g, ' ')),
  ...(/^docker\/build-push-action@/.test(usesOf(step)) ? [usesOf(step).split('@')[0]] : []),
]
/** A job that deploys: one with an environment, or one that signs in to a
 *  cloud or uploads to it. */
export const isDeployJob = (job) => !!job?.environment || stepsOf(job).some(isDeployStep)

const PULL_REQUEST = ['pull_request', 'pull_request_target']

/** Whether a concurrency setting cancels a run superseded by a newer push to
 *  the pull request: true, or an expression true on pull_request events. */
function cancelsOnPullRequests(concurrency) {
  const cancel = concurrency && typeof concurrency === 'object' ? concurrency['cancel-in-progress'] : undefined
  return cancel === true || (typeof cancel === 'string' && /github\.event_name\s*==\s*'pull_request'/.test(cancel))
}

export function checkConcurrency(workflows) {
  const problems = []
  for (const wf of workflows) {
    if (events(wf.doc).some((e) => PULL_REQUEST.includes(e)) && !cancelsOnPullRequests(wf.doc.concurrency)) {
      problems.push(`${wf.file}: runs on pull requests without concurrency.cancel-in-progress: true, so a superseded run goes on`)
    }
    for (const [id, job] of jobsOf(wf.doc)) {
      if (!isDeployJob(job)) continue
      const c = job.concurrency ?? wf.doc.concurrency
      if (c == null) problems.push(`${wf.file}: job ${id} deploys outside a concurrency group, so two deploys can overlap`)
      else if (typeof c === 'object' && c['cancel-in-progress'] !== undefined && c['cancel-in-progress'] !== false) {
        problems.push(`${wf.file}: job ${id} deploys in a concurrency group that may cancel it in progress, so a newer run can cut it off halfway`)
      }
    }
  }
  return problems
}

export function checkDeployBuild(workflows, { deployWorkflow = 'deploy.yml' } = {}) {
  const problems = []
  for (const wf of workflows) {
    const built = new Map()
    for (const [id, job] of jobsOf(wf.doc)) {
      const steps = stepsOf(job)
      for (const step of steps) for (const b of buildsOf(step)) built.set(b, [...(built.get(b) ?? []), id])
      const first = steps.findIndex(isDeployStep)
      if (first < 0) continue
      if (wf.name !== deployWorkflow) {
        problems.push(`${wf.file}: job ${id} deploys; only ${deployWorkflow} deploys, so that what is served is what it built`)
        continue
      }
      if (!steps.slice(0, first).some((s) => buildsOf(s).length)) {
        problems.push(`${wf.file}: job ${id} deploys what it did not build: it builds nothing before it begins to upload`)
      }
      for (const step of steps.slice(first + 1)) {
        for (const b of buildsOf(step)) problems.push(`${wf.file}: job ${id} builds again (${b}) after it began to upload; it must upload what it built and tested before`)
      }
      for (const step of steps) {
        if (/^actions\/download-artifact@/.test(usesOf(step)) && step.with?.['run-id']) {
          problems.push(`${wf.file}: job ${id} deploys an artifact of another run (download-artifact run-id)`)
        }
      }
    }
    if (wf.name !== deployWorkflow) continue
    for (const [b, jobs] of built) if (jobs.length > 1) problems.push(`${wf.file}: builds ${b} ${jobs.length} times (job ${[...new Set(jobs)].join(', job ')}); a deploy builds once`)
  }
  return problems
}

/** Names cloud keys go by, as secrets or variables. */
export const CLOUD_KEY_NAME = /^(AWS_ACCESS_KEY_ID|AWS_SECRET_ACCESS_KEY|AWS_SESSION_TOKEN|AZURE_CLIENT_SECRET|AZURE_CREDENTIALS|GCP_SA_KEY|GCP_CREDENTIALS|GOOGLE_CREDENTIALS|GOOGLE_APPLICATION_CREDENTIALS)$|ACCESS_KEY|SECRET_KEY|SECRET_ACCESS|SA_KEY|SERVICE_ACCOUNT_KEY|CLIENT_SECRET/
/** Inputs of cloud sign-in actions that take a stored key. */
const KEY_INPUTS = ['aws-access-key-id', 'aws-secret-access-key', 'aws-session-token', 'credentials_json', 'creds', 'client-secret']

const grantsIdToken = (permissions) => permissions === 'write-all' || (permissions && typeof permissions === 'object' && permissions['id-token'] === 'write')

export function checkCloudKeys(workflows, { secrets = [] } = {}) {
  const problems = []
  for (const wf of workflows) {
    for (const name of new Set([...wf.text.matchAll(/\bsecrets\.([A-Za-z_][A-Za-z0-9_]*)|\bsecrets\[\s*'([^']+)'\s*\]/g)].map((m) => m[1] ?? m[2]))) {
      if (CLOUD_KEY_NAME.test(name)) problems.push(`${wf.file}: uses the secret ${name}, named as a stored cloud key`)
    }
    const envNames = (env, where) => {
      for (const name of Object.keys(env && typeof env === 'object' ? env : {})) {
        if (CLOUD_KEY_NAME.test(name)) problems.push(`${wf.file}: ${where} sets ${name}, a stored cloud key`)
      }
    }
    envNames(wf.doc.env, 'the workflow')
    for (const [id, job] of jobsOf(wf.doc)) {
      envNames(job.env, `job ${id}`)
      for (const step of stepsOf(job)) {
        envNames(step.env, `job ${id}`)
        const given = KEY_INPUTS.filter((k) => step.with && typeof step.with === 'object' && k in step.with)
        if (given.length) problems.push(`${wf.file}: job ${id} signs in with a stored key (${given.join(', ')})`)
        if (!CLOUD_LOGIN.test(usesOf(step))) continue
        if (usesOf(step).startsWith('aws-actions/') && !step.with?.['role-to-assume']) {
          problems.push(`${wf.file}: job ${id} signs in to AWS without role-to-assume`)
        }
        if (!grantsIdToken(job.permissions ?? wf.doc.permissions)) {
          problems.push(`${wf.file}: job ${id} signs in to a cloud without permissions id-token: write, so it cannot use OIDC`)
        }
      }
    }
  }
  for (const name of secrets) if (CLOUD_KEY_NAME.test(name.replace(/^.*: /, ''))) problems.push(`secret ${name} is named as a stored cloud key`)
  return problems
}

/** The scripts `npm run <name>` reaches from `name`, through the scripts it
 *  runs in turn. */
export function scriptsRun(scripts, name, seen = new Set()) {
  for (const m of (scripts?.[name] ?? '').matchAll(/\bnpm run ([\w:.-]+)/g)) {
    if (seen.has(m[1])) continue
    seen.add(m[1])
    scriptsRun(scripts, m[1], seen)
  }
  return seen
}

const NPM_CI = /^npm ci( --[\w-]+)*$/
const NPM_RUN = /^npm run ([\w:.-]+)( -- .+)?$/

export function checkMirror(workflows, pkg, { mirrored = ['ci.yml'], gate = 'ci' } = {}) {
  const problems = []
  const ran = new Map()
  for (const name of mirrored) {
    const wf = workflows.find((w) => w.name === name)
    if (!wf) { problems.push(`.github/workflows/${name} is missing`); continue }
    for (const [id, job] of jobsOf(wf.doc)) {
      if (id === gate) continue
      const p = job.permissions
      if (p === 'write-all' || (p && typeof p === 'object' && p.contents === 'write')) continue
      for (const step of stepsOf(job)) {
        const run = runOf(step).trim()
        if (!run) continue
        if (NPM_CI.test(run)) continue
        const m = NPM_RUN.exec(run)
        if (!m) { problems.push(`${wf.file}: job ${id} runs "${run.split('\n')[0]}${run.includes('\n') ? ' …' : ''}", which is neither npm ci nor npm run <script>`); continue }
        if (!pkg.scripts?.[m[1]]) problems.push(`${wf.file}: job ${id} runs npm run ${m[1]}, which package.json does not have`)
        else ran.set(m[1], id)
      }
    }
  }
  if (!pkg.scripts?.verify) problems.push('package.json has no verify script')
  else {
    const verify = scriptsRun(pkg.scripts, 'verify')
    for (const [name, id] of ran) if (!verify.has(name)) problems.push(`CI runs npm run ${name} (job ${id}), which npm run verify does not`)
  }
  return problems
}

export const CHECKS = {
  concurrency: (wfs) => checkConcurrency(wfs),
  'deploy-build': (wfs) => checkDeployBuild(wfs),
  'cloud-keys': (wfs, o) => checkCloudKeys(wfs, o),
  mirror: (wfs, o) => checkMirror(wfs, o.pkg),
}

/** The names of the repository's secrets and its environments' secrets,
 *  read with the GitHub CLI (it must be signed in with admin rights). */
function remoteSecrets(root) {
  const gh = (...args) => {
    const r = spawnSync('gh', args, { cwd: root, encoding: 'utf8' })
    if (r.status !== 0) throw new Error(`gh ${args.join(' ')}: ${r.stderr.trim() || r.error?.message}`)
    return r.stdout.split('\n').map((l) => l.trim()).filter(Boolean)
  }
  const names = gh('secret', 'list', '--json', 'name', '--jq', '.[].name')
  const [repo] = gh('repo', 'view', '--json', 'nameWithOwner', '--jq', '.nameWithOwner')
  for (const env of gh('api', `repos/${repo}/environments`, '--jq', '.environments[].name')) {
    names.push(...gh('secret', 'list', '--env', env, '--json', 'name', '--jq', '.[].name').map((n) => `${env}: ${n}`))
  }
  return names
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const args = process.argv.slice(2)
  const take = (flag) => { const i = args.indexOf(flag); if (i < 0) return undefined; const [, v] = args.splice(i, 2); return v }
  const root = resolve(take('--root') ?? ROOT)
  const withSecrets = args.includes('--secrets')
  const names = args.filter((a) => !a.startsWith('--'))
  const unknown = names.filter((n) => !CHECKS[n])
  if (unknown.length) { console.error(`No check ${unknown.join(', ')}; the checks: ${Object.keys(CHECKS).join(', ')}`); process.exit(2) }
  try {
    const workflows = loadWorkflows(root)
    const pkg = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'))
    const secrets = withSecrets ? remoteSecrets(root) : []
    let failed = 0
    for (const name of names.length ? names : Object.keys(CHECKS)) {
      const problems = CHECKS[name](workflows, { pkg, secrets })
      if (problems.length) { failed++; console.log(`✖ ${name}\n${problems.map((p) => `  ${p}`).join('\n')}`) }
      else console.log(`✔ ${name}`)
    }
    process.exit(failed ? 1 : 0)
  } catch (error) {
    console.error(error.message)
    process.exit(2)
  }
}
