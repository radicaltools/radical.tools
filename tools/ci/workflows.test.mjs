// The checks of tools/ci/workflows.mjs, the CI/CD pipeline pack's fitness
// functions over .github/workflows: each against sample workflows that pass
// and fail, and against this repository's own workflows, which must pass.
import { describe, expect, it } from 'vitest'
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { checkCloudKeys, checkConcurrency, checkDeployBuild, checkMirror, loadWorkflows } from './workflows.mjs'

const ROOT = join(import.meta.dirname, '../..')
const OURS = loadWorkflows(ROOT)
const PKG = JSON.parse(readFileSync(join(ROOT, 'package.json'), 'utf8'))

/** A repository with these workflow files ({ 'ci.yml': text }). */
function repo(files) {
  const root = mkdtempSync(join(tmpdir(), 'radical-workflows-'))
  mkdirSync(join(root, '.github/workflows'), { recursive: true })
  for (const [name, text] of Object.entries(files)) writeFileSync(join(root, '.github/workflows', name), text)
  return loadWorkflows(root)
}

const CI = `name: CI
on:
  pull_request:
concurrency:
  group: ci-\${{ github.event.pull_request.number || github.ref }}
  cancel-in-progress: true
jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - run: npm ci
      - run: npm run lint
      - run: npm run test -- --reporter=dot
  ci:
    if: always()
    needs: [test]
    runs-on: ubuntu-latest
    steps:
      - run: echo '\${{ toJSON(needs) }}' | jq -e 'all(.[]; .result == "success")'
`

const DEPLOY = `name: Deploy
on:
  push:
    branches: [main]
permissions:
  id-token: write
  contents: read
jobs:
  deploy:
    runs-on: ubuntu-latest
    concurrency:
      group: deploy-production
      cancel-in-progress: false
    steps:
      - uses: actions/checkout@v4
      - run: npm ci
      - run: npm test
      - run: npm run build:web
      - uses: aws-actions/configure-aws-credentials@v4
        with:
          role-to-assume: \${{ secrets.AWS_DEPLOY_ROLE_ARN }}
          aws-region: eu-west-1
      - run: aws s3 sync out/ s3://\${{ secrets.S3_BUCKET }}/ --delete
      - run: aws cloudfront create-invalidation --distribution-id \${{ secrets.CLOUDFRONT_DISTRIBUTION_ID }} --paths "/*"
`

describe('Superseded runs cancelled, deploys never', () => {
  it('passes the repository\'s own workflows', () => {
    expect(checkConcurrency(OURS)).toEqual([])
  })

  it('Superseded run cancelled: passes a pull-request workflow that cancels superseded runs and a deploy that queues', () => {
    const release = `on:
  push: { tags: ['v*'] }
  pull_request:
concurrency:
  group: release-\${{ github.event.pull_request.number || github.ref }}
  cancel-in-progress: \${{ github.event_name == 'pull_request' }}
jobs:
  build: { runs-on: ubuntu-latest, steps: [{ run: npm run dist }] }
`
    expect(checkConcurrency(repo({ 'ci.yml': CI, 'deploy.yml': DEPLOY, 'release.yml': release }))).toEqual([])
  })

  it('Superseded run cancelled: finds a pull-request workflow that does not cancel its superseded runs', () => {
    expect(checkConcurrency(repo({ 'ci.yml': CI.replace('cancel-in-progress: true', 'cancel-in-progress: false') }))).toEqual([
      '.github/workflows/ci.yml: runs on pull requests without concurrency.cancel-in-progress: true, so a superseded run goes on',
    ])
    expect(checkConcurrency(repo({ 'lint.yml': 'on: [pull_request]\njobs:\n  lint: { runs-on: ubuntu-latest, steps: [{ run: npm run lint }] }\n' }))).toHaveLength(1)
  })

  it('Superseded run cancelled: finds a deploy outside a concurrency group, or in one that cancels it halfway', () => {
    const noGroup = DEPLOY.replace(/    concurrency:\n.*\n.*\n/, '')
    expect(checkConcurrency(repo({ 'deploy.yml': noGroup }))).toEqual([
      '.github/workflows/deploy.yml: job deploy deploys outside a concurrency group, so two deploys can overlap',
    ])
    expect(checkConcurrency(repo({ 'deploy.yml': DEPLOY.replace('cancel-in-progress: false', 'cancel-in-progress: true') }))).toEqual([
      '.github/workflows/deploy.yml: job deploy deploys in a concurrency group that may cancel it in progress, so a newer run can cut it off halfway',
    ])
    // A job with an environment deploys, whatever its steps.
    const env = 'on: [push]\njobs:\n  ship: { runs-on: ubuntu-latest, environment: production, steps: [{ run: ./ship.sh }] }\n'
    expect(checkConcurrency(repo({ 'ship.yml': env }))).toHaveLength(1)
  })
})

describe('Deploys take the build\'s digest', () => {
  it('passes the repository\'s own workflows: only deploy.yml deploys, what its deploy job built once', () => {
    expect(checkDeployBuild(OURS)).toEqual([])
  })

  it('Deploy job cannot rebuild: passes a deploy job that uploads what it built before', () => {
    expect(checkDeployBuild(repo({ 'deploy.yml': DEPLOY, 'ci.yml': CI }))).toEqual([])
  })

  it('Deploy job cannot rebuild: finds a build after the upload began, naming the job', () => {
    const rebuild = DEPLOY.replace('      - run: aws cloudfront', '      - run: npm run build:web\n      - run: aws cloudfront')
    expect(checkDeployBuild(repo({ 'deploy.yml': rebuild }))).toEqual([
      '.github/workflows/deploy.yml: job deploy builds again (npm run build:web) after it began to upload; it must upload what it built and tested before',
      '.github/workflows/deploy.yml: builds npm run build:web 2 times (job deploy); a deploy builds once',
    ])
    const image = DEPLOY.replace('      - run: aws cloudfront', '      - run: docker build -t site .\n      - run: aws cloudfront')
    expect(checkDeployBuild(repo({ 'deploy.yml': image }))[0]).toContain('job deploy builds again (docker build)')
  })

  it('Deploy job cannot rebuild: finds a deploy job that built nothing, a second build in another job, and a deploy from another workflow', () => {
    const nothing = DEPLOY.replace('      - run: npm run build:web\n', '')
    expect(checkDeployBuild(repo({ 'deploy.yml': nothing }))).toEqual([
      '.github/workflows/deploy.yml: job deploy deploys what it did not build: it builds nothing before it begins to upload',
    ])
    const twice = `${DEPLOY}  preview:\n    runs-on: ubuntu-latest\n    steps:\n      - run: npm run build:web\n`
    expect(checkDeployBuild(repo({ 'deploy.yml': twice }))).toEqual([
      '.github/workflows/deploy.yml: builds npm run build:web 2 times (job deploy, job preview); a deploy builds once',
    ])
    expect(checkDeployBuild(repo({ 'deploy.yml': DEPLOY, 'hotfix.yml': DEPLOY.replace('name: Deploy', 'name: Hotfix') }))).toEqual([
      '.github/workflows/hotfix.yml: job deploy deploys; only deploy.yml deploys, so that what is served is what it built',
    ])
  })
})

describe('No stored cloud keys, tight trust', () => {
  it('passes the repository\'s own workflows: the deploy assumes a role through OIDC', () => {
    expect(checkCloudKeys(OURS)).toEqual([])
  })

  it('Stored key found: passes a deploy that assumes a role with id-token: write', () => {
    expect(checkCloudKeys(repo({ 'deploy.yml': DEPLOY }), { secrets: ['AWS_DEPLOY_ROLE_ARN', 'S3_BUCKET', 'NPM_TOKEN'] })).toEqual([])
  })

  it('Stored key found: finds a stored key passed to the sign-in, and the secret named as a cloud key', () => {
    const keys = DEPLOY.replace('          role-to-assume: ${{ secrets.AWS_DEPLOY_ROLE_ARN }}\n',
      '          aws-access-key-id: ${{ secrets.AWS_ACCESS_KEY_ID }}\n          aws-secret-access-key: ${{ secrets.AWS_SECRET_ACCESS_KEY }}\n')
    expect(checkCloudKeys(repo({ 'deploy.yml': keys }))).toEqual([
      '.github/workflows/deploy.yml: uses the secret AWS_ACCESS_KEY_ID, named as a stored cloud key',
      '.github/workflows/deploy.yml: uses the secret AWS_SECRET_ACCESS_KEY, named as a stored cloud key',
      '.github/workflows/deploy.yml: job deploy signs in with a stored key (aws-access-key-id, aws-secret-access-key)',
      '.github/workflows/deploy.yml: job deploy signs in to AWS without role-to-assume',
    ])
    expect(checkCloudKeys([], { secrets: ['AWS_SECRET_ACCESS_KEY', 'production: GCP_SA_KEY', 'NIGHTLY_TOKEN'] })).toEqual([
      'secret AWS_SECRET_ACCESS_KEY is named as a stored cloud key',
      'secret production: GCP_SA_KEY is named as a stored cloud key',
    ])
  })

  it('Stored key found: finds a key in an environment variable, and a sign-in without id-token: write', () => {
    const env = DEPLOY.replace('      - run: aws s3 sync', '      - env:\n          AWS_SECRET_ACCESS_KEY: ${{ secrets.DEPLOY_KEY }}\n        run: aws s3 sync')
    expect(checkCloudKeys(repo({ 'deploy.yml': env }))).toEqual(['.github/workflows/deploy.yml: job deploy sets AWS_SECRET_ACCESS_KEY, a stored cloud key'])
    expect(checkCloudKeys(repo({ 'deploy.yml': DEPLOY.replace('  id-token: write\n', '') }))).toEqual([
      '.github/workflows/deploy.yml: job deploy signs in to a cloud without permissions id-token: write, so it cannot use OIDC',
    ])
  })
})

describe('CI runs what verify runs', () => {
  it('passes the repository\'s own ci.yml and package.json: every step npm ci or a script npm run verify runs', () => {
    expect(checkMirror(OURS, PKG)).toEqual([])
  })

  const pkg = { scripts: { lint: 'eslint .', test: 'vitest run', verify: 'npm run lint && npm run all', all: 'npm run test' } }

  it('Step outside verify found: passes steps that are npm ci and scripts npm run verify runs, the gate job aside', () => {
    expect(checkMirror(repo({ 'ci.yml': CI }), pkg)).toEqual([])
  })

  it('Step outside verify found: finds a step that runs npx eslint . until it runs a script that verify runs as well', () => {
    const eslint = CI.replace('      - run: npm run lint\n', '      - run: npx eslint .\n')
    expect(checkMirror(repo({ 'ci.yml': eslint }), pkg)).toEqual([
      '.github/workflows/ci.yml: job test runs "npx eslint .", which is neither npm ci nor npm run <script>',
    ])
    const script = CI.replace('      - run: npm run lint\n', '      - run: npm run lint:fast\n')
    expect(checkMirror(repo({ 'ci.yml': script }), { scripts: { ...pkg.scripts, 'lint:fast': 'eslint --cache .' } })).toEqual([
      'CI runs npm run lint:fast (job test), which npm run verify does not',
    ])
    expect(checkMirror(repo({ 'ci.yml': script }), { scripts: { ...pkg.scripts, 'lint:fast': 'eslint --cache .', verify: 'npm run lint:fast && npm run all' } })).toEqual([])
  })

  it('Step outside verify found: finds a missing script and a missing verify; a job that commits to the repository is left out', () => {
    expect(checkMirror(repo({ 'ci.yml': CI }), { scripts: { test: 'vitest run' } })).toEqual([
      '.github/workflows/ci.yml: job test runs npm run lint, which package.json does not have',
      'package.json has no verify script',
    ])
    const commits = `${CI}  baselines:\n    runs-on: ubuntu-latest\n    permissions:\n      contents: write\n    steps:\n      - run: git push origin HEAD\n`
    expect(checkMirror(repo({ 'ci.yml': commits }), pkg)).toEqual([])
  })
})
