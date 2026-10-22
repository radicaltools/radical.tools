import type { PackSpec } from '../../src/packSpec'

const FORCES = 'This element is built by us from source code, open-source dependencies and a base image, and shipped as an artifact. The forces: most of what runs is code we did not write, and known vulnerabilities in it are exploited within days of disclosure; a dependency resolved fresh on every build can change under us, through a compromised maintainer, a typosquatted name or a malicious release; a build that anyone with CI access can alter, or whose output nobody can trace to a commit, ships whatever an attacker puts in it; base images carry hundreds of operating-system packages we never use; and when the next widespread vulnerability is announced, the first question is which of our running versions contain it.'
const BUILD = ['adr-slsa-l1', 'adr-slsa-l2', 'adr-slsa-l3']
const DEPS = ['adr-deps-gate', 'adr-deps-sla']

const pack: PackSpec = {
  id: 'concern-supply-chain',
  name: 'Software supply chain',
  group: 'security',
  description: 'What goes into what we build and ship: vulnerable dependencies, pinning and where packages come from, build provenance (SLSA), SBOMs and base images.',
  tags: ['security', 'supply-chain', 'dependencies', 'sca', 'sbom', 'slsa', 'provenance', 'containers'],
  concern: {
    id: 'supply-chain',
    trigger: 'LIST NODES WHERE external != true AND (type = "container" OR type = "webapp")',
    why: 'we build and ship these elements from code, dependencies and base images we did not all write, so what may go into them and how their builds are trusted has to be decided.',
  },
  sources: [
    { title: 'SLSA v1.0, Security levels', url: 'https://slsa.dev/spec/v1.0/levels' },
    { title: 'OpenSSF Scorecard', url: 'https://scorecard.dev/' },
    { title: 'NIST SP 800-218, Secure Software Development Framework (SSDF) 1.1', url: 'https://csrc.nist.gov/pubs/sp/800/218/final' },
    { title: 'OWASP Top 10 2021, A06 Vulnerable and Outdated Components', url: 'https://owasp.org/Top10/A06_2021-Vulnerable_and_Outdated_Components/' },
    { title: 'CycloneDX specification', url: 'https://cyclonedx.org/' },
    { title: 'SPDX specification', url: 'https://spdx.dev/' },
    { title: 'OSV-Scanner documentation', url: 'https://google.github.io/osv-scanner/' },
    { title: 'Sigstore', url: 'https://www.sigstore.dev/' },
  ],
  questions: [
    {
      key: 'SCA', title: 'Vulnerable dependencies', label: 'What happens to a change that brings in a known vulnerability?',
      hint: 'Blocking stops new vulnerabilities at the door but can stall work on a finding nobody can fix yet; deadlines alone let the backlog grow.',
      default: 'gate',
      options: [
        { value: 'gate', label: 'the merge is blocked on high and critical findings with a fix', description: 'A required check refuses a pull request that adds or upgrades to a dependency with a known high or critical vulnerability that has a fixed version; existing findings have deadlines. Pick it for anything internet-facing or holding personal or payment data.' },
        { value: 'sla', label: 'it is reported, and fixed within deadlines', description: 'Findings are reported on the pull request and in a dashboard but do not block; each severity has a deadline. Pick it for internal tools, or for a codebase with a large backlog you are working through before switching to blocking.' },
      ],
    },
    {
      key: 'PINNING', title: 'Pinning', label: 'How are dependencies pinned and fetched?',
      hint: 'A dependency resolved fresh on every build can change under you; the stricter the pin, the more update pull requests a bot has to open.',
      default: 'hash',
      options: [
        { value: 'lockfile', label: 'lockfiles, installed exactly', description: 'Every package manager has a committed lockfile and CI installs exactly it (npm ci, pip install --require-hashes, go mod verify). Pick it as the minimum for every project.' },
        { value: 'hash', label: 'everything pinned by hash', description: 'Lockfiles with integrity hashes, CI actions pinned to commit SHAs and base images to sha256 digests, updated by Renovate or Dependabot pull requests. Pick it for anything you ship to production; it is what OpenSSF Scorecard\'s Pinned-Dependencies checks.' },
        { value: 'proxy', label: 'only from our own registry proxy', description: 'Builds fetch packages only through an internal proxy (Artifactory, Nexus, AWS CodeArtifact, Azure Artifacts) with no other egress, and new releases enter only after a waiting period. Pick it in regulated environments or where malicious package releases are a demonstrated threat.' },
      ],
    },
    {
      key: 'SLSA', title: 'Build provenance', label: 'Which SLSA build level do the builds reach?',
      hint: 'Provenance says which source and which build produced an artifact; the higher the level, the harder it is to forge, and the more the deployment can refuse.',
      default: 'l2',
      options: [
        { value: 'l1', label: 'SLSA Build L1: provenance exists', description: 'The build records how each artifact was made (BuildKit provenance attestations), unsigned. Pick it as the first step for builds that are not yet on a hosted CI.' },
        { value: 'l2', label: 'SLSA Build L2: signed provenance from a hosted build', description: 'Builds run only on hosted CI, which signs the provenance (GitHub artifact attestations, GitLab SLSA provenance, cosign keyless); the deployment verifies it. Pick it for production services; it is a few lines of CI configuration.' },
        { value: 'l3', label: 'SLSA Build L3: hardened, isolated builds', description: 'Provenance is produced by an isolated job the build steps cannot influence (slsa-github-generator reusable workflows), and the cluster admits only images whose provenance verifies. Pick it for software others depend on, or where a tampered build would be catastrophic.' },
      ],
    },
    {
      key: 'SBOM', title: 'SBOM', label: 'What is the SBOM for?',
      hint: 'A software bill of materials answers "are we affected?" in minutes instead of days, but only if someone keeps it and looks.',
      default: 'internal',
      options: [
        { value: 'internal', label: 'answering "are we affected?" ourselves', description: 'A CycloneDX SBOM of every deployed version is loaded into OWASP Dependency-Track, which matches new advisories against what runs. Pick it when nobody outside asks for the SBOM but you want to know your exposure fast.' },
        { value: 'shipped', label: 'shipping to customers with each release', description: 'Each release carries a signed SBOM (CycloneDX or SPDX) and VEX statements for known vulnerabilities that do not affect it. Pick it when customers, US federal buyers (EO 14028) or the EU Cyber Resilience Act require it.' },
      ],
    },
    {
      key: 'BASE', title: 'Base images', label: 'What are the container images built on?',
      hint: 'Every package in a base image is one more to patch and one more for an attacker to use; fewer packages, fewer findings.',
      default: 'minimal',
      options: [
        { value: 'minimal', label: 'minimal images without a shell', description: 'Distroless (gcr.io/distroless) or Chainguard/Wolfi images: the runtime and nothing else. Pick it for services in compiled languages or standard runtimes (Java, Node, Python) that need no OS tools.' },
        { value: 'official', label: 'official slim images, rebuilt weekly', description: 'Docker official slim images (Debian slim, Alpine, UBI minimal), rebuilt on a schedule so OS fixes arrive. Pick it when the element needs OS packages or tools that minimal images lack.' },
        { value: 'golden', label: 'our platform team\'s golden images', description: 'Hardened images built and patched by a platform team, published to the internal registry; nothing else may be used. Pick it in larger organisations with a platform team and compliance baselines (CIS, STIG).' },
      ],
    },
  ],
  details: [
    { key: 'CRITICAL_DAYS', label: 'Days to fix a critical vulnerability in a dependency', default: '7', number: true },
    { key: 'HIGH_DAYS', label: 'Days to fix a high vulnerability in a dependency', default: '30', number: true },
    { key: 'REBUILD_DAYS', label: 'Most days a running image may go without a rebuild', default: '7', number: true },
  ],
  need: {
    label: 'We ship only what we meant to',
    text: 'The element is built from our code, open-source dependencies and a base image. Known vulnerabilities in what it contains must be found and fixed before they are exploited; no dependency, build step or image may change what we ship without us knowing; every artifact running in production must be traceable to a reviewed commit and the build that made it; and when a new vulnerability is announced we must know within hours which running versions contain it.',
  },
  forces: FORCES,
  requirements: [
    {
      id: 'req-vuln-sla', label: 'Vulnerabilities fixed in time', ears_type: 'state-driven',
      precondition: 'a deployed version contains a dependency with a known critical or high vulnerability',
      action: 'upgrade, replace or patch it within {{CRITICAL_DAYS}} days for critical and {{HIGH_DAYS}} days for high from disclosure, or record a reviewed statement that the element is not affected',
      rationale: 'Known vulnerabilities in components are among the most exploited weaknesses; a deadline per severity turns findings into fixes (OWASP Top 10 A06:2021; NIST SSDF RV.2).',
      scenario: { label: 'Critical fixed in time', given: 'a deployed version with a dependency that gets a critical advisory', when: '{{CRITICAL_DAYS}} days have passed since disclosure', then: 'the version running in production no longer contains it, or a reviewed not-affected statement is recorded' },
    },
    {
      id: 'req-vuln-gate', label: 'New vulnerabilities blocked', when: { SCA: ['gate'] }, ears_type: 'unwanted-behaviour',
      unwanted_condition: 'a pull request adds a dependency, or changes one to a version, with a known high or critical vulnerability that has a fixed version',
      action: 'fail its required check so that it cannot merge until it uses a fixed version',
      rationale: 'The cheapest vulnerability to fix is the one that never merges (NIST SSDF PW.4; OpenSSF Scorecard Vulnerabilities).',
      scenario: { label: 'Vulnerable upgrade blocked', given: 'a pull request that pins a library to a version with a critical advisory and a fixed version available', when: 'its checks run', then: 'the dependency check fails and the pull request cannot merge' },
    },
    {
      id: 'req-vuln-report', label: 'Findings visible on each change', when: { SCA: ['sla'] }, ears_type: 'event-driven',
      trigger: 'a pull request changes a dependency manifest or lockfile',
      action: 'comment on it with every known vulnerability the change adds or removes, with its severity and fixed version, and open a tracked issue for each high or critical one that merges',
      rationale: 'Without blocking, visibility at the moment of change and a tracked issue are what keep the deadline from being missed (NIST SSDF RV.1).',
      scenario: { label: 'Finding tracked', given: 'a pull request that adds a dependency with a high advisory', when: 'it merges', then: 'it carried a comment naming the advisory, and an issue with the {{HIGH_DAYS}}-day deadline is open' },
    },
    {
      id: 'req-review', label: 'Changes reviewed and protected', ears_type: 'ubiquitous',
      action: 'build release artifacts only from the protected default branch or signed release tags, where every change is merged through a pull request approved by someone other than its author',
      rationale: 'A build is only as trustworthy as the source it starts from; review and branch protection are the source half of the supply chain (OpenSSF Scorecard Branch-Protection, Code-Review; NIST SSDF PS.1).',
      scenario: { label: 'Direct push refused', given: 'a maintainer with write access', when: 'they push a commit directly to the default branch, and open a pull request they approve themselves', then: 'the push is refused and the pull request cannot merge without a second person\'s approval' },
    },
    {
      id: 'req-pin-lockfile', label: 'Lockfiles installed exactly', when: { PINNING: ['lockfile'] }, ears_type: 'unwanted-behaviour',
      unwanted_condition: 'a build would resolve a dependency to a version not recorded in the committed lockfile',
      action: 'fail the build instead of updating the lockfile',
      rationale: 'A lockfile only pins if the build refuses to drift from it; otherwise every build may fetch something new (NIST SSDF PS.3; OpenSSF Scorecard Pinned-Dependencies).',
      scenario: { label: 'Drifted lockfile fails', given: 'a manifest changed without updating the lockfile', when: 'CI installs dependencies', then: 'the install fails and names the package' },
    },
    {
      id: 'req-pin-hash', label: 'Everything pinned by hash', when: { PINNING: ['hash'] }, ears_type: 'ubiquitous',
      action: 'pin every dependency with an integrity hash in a lockfile, every CI action to a full commit SHA and every base image to a sha256 digest, and take updates only through bot pull requests that are reviewed like code',
      rationale: 'A tag or version range can be moved by whoever controls it; a hash cannot (OpenSSF Scorecard Pinned-Dependencies; SLSA v1.0 threats, dependency threats).',
      scenario: { label: 'Unpinned action refused', given: 'a pull request that adds a CI step using an action by its tag, and a Dockerfile FROM by tag', when: 'its checks run', then: 'the pinning check fails naming both' },
    },
    {
      id: 'req-pin-proxy', label: 'Packages only from our proxy', when: { PINNING: ['proxy'] }, ears_type: 'ubiquitous',
      action: 'fetch every package and image only through our registry proxy, with no other network access during builds, and admit a newly published release to the proxy only after it has been public for 7 days',
      rationale: 'One controlled entry point can be audited and blocked; malicious releases are usually found and pulled within days of publication (NIST SSDF PW.4; SLSA v1.0 threats, dependency threats).',
      scenario: { label: 'Fresh release held back', given: 'a package version published 2 days ago', when: 'a build asks for it', then: 'the proxy does not serve it and the build fails, and the same build with a 10-day-old version succeeds' },
    },
    {
      id: 'req-provenance-l1', label: 'Provenance recorded', when: { SLSA: ['l1'] }, ears_type: 'event-driven',
      trigger: 'a build produces a release artifact',
      action: 'attach SLSA provenance to it that names the source repository, the commit, the build entry point and the builder',
      rationale: 'Provenance is what makes an artifact traceable to the source and build that made it; at Build L1 it exists, which already catches mistakes (SLSA v1.0, Build L1).',
      scenario: { label: 'Image carries provenance', given: 'an image built by the release pipeline', when: 'its attestations are inspected', then: 'they hold SLSA provenance naming the repository, the commit and the builder' },
    },
    {
      id: 'req-provenance-l2', label: 'Unverified artifacts not deployed', when: { SLSA: ['l2'] }, ears_type: 'unwanted-behaviour',
      unwanted_condition: 'an artifact is about to be deployed without provenance signed by our hosted build platform for this repository and a protected branch or tag',
      action: 'refuse the deployment',
      rationale: 'Signed provenance from a hosted builder cannot be forged by a developer\'s machine; verifying it at deployment is what makes it count (SLSA v1.0, Build L2).',
      scenario: { label: 'Laptop build refused', given: 'an image built and pushed from a developer\'s machine with the same tag', when: 'the pipeline tries to deploy it', then: 'verification fails and the deployment stops' },
    },
    {
      id: 'req-provenance-l3', label: 'Only verified images admitted', when: { SLSA: ['l3'] }, ears_type: 'unwanted-behaviour',
      unwanted_condition: 'the cluster is asked to run an image whose provenance was not produced by our isolated build workflow for this repository',
      action: 'refuse to admit it, and keep the provenance signing in a job the build steps cannot reach',
      rationale: 'At Build L3 the provenance cannot be forged even by the build\'s own steps, and admission control enforces it at the last moment (SLSA v1.0, Build L3).',
      scenario: { label: 'Unverified image refused', given: 'a cluster with admission control', when: 'a pod is created from an image built outside the isolated workflow', then: 'the cluster refuses the pod and names the failed verification' },
    },
    {
      id: 'req-sbom-internal', label: 'Exposure known within hours', when: { SBOM: ['internal'] }, ears_type: 'event-driven',
      trigger: 'a new vulnerability advisory is published for a component',
      action: 'list every deployed version of the element that contains it within 24 hours, from the CycloneDX SBOMs kept for each deployed version',
      rationale: 'The first question after a widespread vulnerability is where it runs; an SBOM per deployed version answers it without rebuilding anything (NIST SSDF PS.3.2; CycloneDX).',
      scenario: { label: 'Affected versions listed', given: 'SBOMs of the three versions deployed in production and staging', when: 'an advisory is published for a component in two of them', then: 'within 24 hours the two versions and their environments are listed' },
    },
    {
      id: 'req-sbom-shipped', label: 'SBOM shipped with releases', when: { SBOM: ['shipped'] }, ears_type: 'event-driven',
      trigger: 'a version is released',
      action: 'publish with it a signed SBOM in CycloneDX or SPDX listing every component, transitive ones included, with version, package URL and licence, and VEX statements for known vulnerabilities that do not affect it',
      rationale: 'Customers and regulators (US EO 14028, EU Cyber Resilience Act) expect an SBOM with each release; VEX saves them chasing findings that do not apply (NIST SSDF PS.3.2; CycloneDX; SPDX).',
      scenario: { label: 'Release carries SBOM', given: 'a release', when: 'its assets are listed and the SBOM is validated against its schema', then: 'a signed SBOM and VEX are attached, valid, and every component has a version and package URL' },
    },
    {
      id: 'req-base-minimal', label: 'No shell in images', when: { BASE: ['minimal'] }, ears_type: 'ubiquitous',
      action: 'build the final stage of every image on a distroless or Chainguard base, with no shell or package manager, running as a non-root user',
      rationale: 'Packages that are not there need no patching and cannot be used after a break-in; minimal images cut OS findings by an order of magnitude (NIST SP 800-190, 4.1; OWASP Docker Security Cheat Sheet).',
      scenario: { label: 'No shell to run', given: 'a released image', when: 'someone tries to run /bin/sh in a container from it', then: 'there is no shell, and the process runs as a non-root user' },
    },
    {
      id: 'req-base-official', label: 'Images rebuilt on schedule', when: { BASE: ['official'] }, ears_type: 'state-driven',
      precondition: 'an image running in production was built more than {{REBUILD_DAYS}} days ago',
      action: 'rebuild it on the current official slim base and redeploy it, failing the rebuild on fixable high or critical OS vulnerabilities',
      rationale: 'Base images are patched upstream constantly; only a rebuild brings the fixes in (NIST SP 800-190, 4.1.1; OWASP Docker Security Cheat Sheet).',
      scenario: { label: 'Stale image rebuilt', given: 'a production image built {{REBUILD_DAYS}} days ago', when: 'the scheduled rebuild runs', then: 'a new image on the current base is deployed and the scan shows no fixable high or critical OS finding' },
    },
    {
      id: 'req-base-golden', label: 'Only golden base images', when: { BASE: ['golden'] }, ears_type: 'unwanted-behaviour',
      unwanted_condition: 'an image is built from, or the cluster is asked to run an image from, anything other than the internal registry\'s golden images',
      action: 'fail the build or refuse the pod',
      rationale: 'A golden image is a promise only if nothing else can be used; enforcement at build and at admission keeps it (CIS Docker Benchmark; NIST SP 800-190, 4.1).',
      scenario: { label: 'Public base refused', given: 'a Dockerfile starting FROM a public Docker Hub image', when: 'it is built, and an image from Docker Hub is deployed directly', then: 'the build fails and the cluster refuses the pod' },
    },
  ],
  adrs: [
    {
      id: 'adr-deps-gate', label: 'Vulnerable dependencies blocked', when: { SCA: ['gate'] },
      decision: 'Every pull request is checked for known vulnerabilities in the dependencies it adds or changes, and a high or critical one with a fixed version blocks the merge; existing findings are fixed within {{CRITICAL_DAYS}} days (critical) and {{HIGH_DAYS}} days (high). Dependencies are pinned: {{PINNING}}; Renovate or Dependabot open the update pull requests. Tools: OSV-Scanner or GitHub dependency review for the gate (free, OSV and GitHub Advisory data), Snyk or Mend when you also need reachability analysis and licence policy; judge by the ecosystems you use, the advisory database, and whether it can tell reachable from unreachable code.',
      consequences: '• New known vulnerabilities do not reach the main branch.\n• A finding with no fixed version does not block, but gets a deadline and, if unaffected, a reviewed statement.\n• Update pull requests become routine work: merge them weekly, grouped, with tests that make it safe.',
      alternatives: '1. Report and deadlines only: no blocked work, but the backlog grows.\n2. Scan only before release: findings arrive late, in bulk.\n3. Vendoring all dependencies: full control, all the patching is ours.',
    },
    {
      id: 'adr-deps-sla', label: 'Vulnerabilities fixed by deadline', when: { SCA: ['sla'] },
      decision: 'Known vulnerabilities in dependencies are reported on every pull request and in a dashboard and do not block merging; each must be fixed within {{CRITICAL_DAYS}} days (critical) and {{HIGH_DAYS}} days (high) of disclosure, tracked as issues. Dependencies are pinned: {{PINNING}}; Renovate or Dependabot open the update pull requests. Tools: GitHub Dependabot alerts or OSV-Scanner for findings, OWASP Dependency-Track for the dashboard. Revisit this decision, towards blocking, once no high or critical finding is past its deadline.',
      consequences: '• No work blocked by findings nobody can fix yet.\n• Vulnerable versions can merge and ship until fixed; the deadlines carry the risk.\n• Needs someone to watch the deadlines, or the dashboard turns into wallpaper.',
      alternatives: '1. Block the merge on high and critical findings: stops new ones at the door.\n2. Scan only before release: late and in bulk.',
    },
    {
      id: 'adr-slsa-l1', label: 'Builds record provenance', when: { SLSA: ['l1'] },
      decision: 'Release builds run from a scripted pipeline and attach SLSA provenance to each artifact (Docker BuildKit with --provenance=mode=max, or the CI\'s provenance generator); unsigned for now. Changes reach the default branch only through reviewed pull requests. SBOM: {{SBOM}}. Base images: {{BASE}}. Moving to signed provenance on hosted CI (Build L2) is the next step, and supersedes this decision.',
      consequences: '• Each artifact says which commit and build made it, which catches mistakes and speeds investigations.\n• Unsigned provenance can be forged by anyone who can push an image: it is not a security control yet.\n• Little cost: a flag on the build.',
      alternatives: '1. Signed provenance from hosted CI (Build L2): a few lines more, and verifiable.\n2. No provenance: nothing to trace an artifact by.',
    },
    {
      id: 'adr-slsa-l2', label: 'Signed provenance verified on deploy', when: { SLSA: ['l2'] },
      decision: 'Release artifacts are built only on hosted CI, which signs their SLSA provenance (GitHub artifact attestations with actions/attest-build-provenance, GitLab\'s SLSA provenance, or cosign keyless signing with Sigstore); the deployment pipeline verifies the provenance names this repository and a protected branch or tag, and stops otherwise. Changes reach the default branch only through reviewed pull requests. SBOM: {{SBOM}}. Base images: {{BASE}}. Choose by the CI in use; Sigstore keyless signing works across CIs and needs no keys to keep.',
      consequences: '• An artifact built on a laptop or a fork cannot be deployed.\n• Depends on the hosted CI\'s signing and on the transparency log being reachable at verification time.\n• Build steps can still influence their own provenance; that is what Build L3 adds.',
      alternatives: '1. Build L3 with isolated provenance generation and admission control: stronger, more to set up.\n2. Build L1, unsigned provenance: traceable, not verifiable.\n3. Signing with long-lived keys: works offline, but the key becomes a secret to protect and rotate.',
    },
    {
      id: 'adr-slsa-l3', label: 'Hardened builds, admission verified', when: { SLSA: ['l3'] },
      decision: 'Release artifacts are built by isolated, ephemeral jobs whose provenance is generated and signed outside the build steps (slsa-framework/slsa-github-generator reusable workflows, or Tekton Chains), and the cluster admits only images whose provenance verifies for this repository (Sigstore policy-controller or Kyverno verifyImages). Changes reach the default branch only through reviewed pull requests. SBOM: {{SBOM}}. Base images: {{BASE}}.',
      consequences: '• Neither a developer nor a compromised build step can produce an artifact the cluster will run.\n• Admission control is on the path of every deployment: its outage blocks deploys, so it fails closed with a documented break-glass.\n• Builds take longer and must fit the generator\'s workflow.',
      alternatives: '1. Build L2 with verification in the pipeline: simpler, but a direct deploy bypasses it.\n2. Reproducible builds checked by a second builder: the strongest, and rarely practical yet.',
    },
  ],
  fitness: [
    {
      id: 'ff-scorecard', label: 'OpenSSF Scorecard', category: 'process', implements: [...BUILD, ...DEPS],
      threshold: 'Branch-Protection, Code-Review, Dangerous-Workflow and Token-Permissions each score 10; overall score at least 7.0',
      description: 'OpenSSF Scorecard runs weekly and on every push to the default branch; a step fails the job when an enforced check scores below its threshold.',
      tool: 'OpenSSF Scorecard (ossf/scorecard-action)',
      language: 'yaml',
      snippet: `# .github/workflows/scorecard.yml
name: scorecard
on:
  push: { branches: [main] }
  schedule: [{ cron: '0 6 * * 1' }]
permissions: read-all
jobs:
  scorecard:
    runs-on: ubuntu-latest
    permissions: { id-token: write, security-events: write }
    steps:
      - uses: actions/checkout@v4
        with: { persist-credentials: false }
      - uses: ossf/scorecard-action@v2.4.0
        with: { results_file: results.json, results_format: json, publish_results: true }
      - run: |
          jq -e '.score >= 7 and ([.checks[]
            | select(.name | IN("Branch-Protection","Code-Review","Dangerous-Workflow","Token-Permissions"))
            | select(.score < 10)] | length == 0)' results.json`,
    },
    {
      id: 'ff-vuln-gate', label: 'Vulnerable dependency check', when: { SCA: ['gate'] }, category: 'structural', implements: ['adr-deps-gate'],
      threshold: '0 high or critical vulnerabilities with a fixed version added by a pull request; the check is required for merging',
      description: 'GitHub\'s dependency review action compares the pull request\'s dependencies with the base branch and fails on a newly added high or critical advisory; OSV-Scanner covers lockfiles the dependency graph does not.',
      tool: 'GitHub dependency-review-action and OSV-Scanner',
      language: 'yaml',
      snippet: `# .github/workflows/dependencies.yml
name: dependencies
on: [pull_request]
permissions: { contents: read }
jobs:
  review:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/dependency-review-action@v4
        with:
          fail-on-severity: high
          comment-summary-in-pr: on-failure
      - name: OSV-Scanner over every lockfile
        run: |
          go install github.com/google/osv-scanner/v2/cmd/osv-scanner@v2.0.0
          osv-scanner scan source --recursive .`,
    },
    {
      id: 'ff-vuln-age', label: 'No finding past its deadline', category: 'operational', implements: DEPS,
      threshold: '0 open critical alerts older than {{CRITICAL_DAYS}} days and 0 open high alerts older than {{HIGH_DAYS}} days',
      description: 'A daily job reads the repository\'s open Dependabot alerts and fails on any past its deadline, naming the package and the advisory.',
      tool: 'GitHub Dependabot alerts API through the GitHub CLI',
      language: 'bash',
      snippet: `gh api --paginate "/repos/$REPO/dependabot/alerts?state=open&per_page=100" | jq -e \\
  --argjson crit {{CRITICAL_DAYS}} --argjson high {{HIGH_DAYS}} '
  [.[] | {sev: .security_advisory.severity, age: ((now - (.created_at | fromdateiso8601)) / 86400),
          pkg: .dependency.package.name, ghsa: .security_advisory.ghsa_id}
       | select((.sev == "critical" and .age > $crit) or (.sev == "high" and .age > $high))]
  | if length > 0 then (map("\\(.pkg) \\(.ghsa) \\(.sev)") | join("\\n") | halt_error(1)) else true end'`,
    },
    {
      id: 'ff-pin-lockfile', label: 'Install refuses drift', when: { PINNING: ['lockfile', 'proxy'] }, category: 'structural', implements: DEPS,
      threshold: '0 builds that change the lockfile; every package manager in the repository has a committed lockfile',
      description: 'CI installs with the lockfile-only command of each package manager and fails if the working tree changed afterwards or a manifest has no lockfile next to it.',
      tool: 'npm ci (pip install --require-hashes, go mod verify, dotnet restore --locked-mode for other stacks)',
      language: 'bash',
      snippet: `for manifest in $(git ls-files '*package.json' | grep -v node_modules); do
  dir=$(dirname "$manifest")
  [ -f "$dir/package-lock.json" ] || { echo "$dir has no lockfile"; exit 1; }
done
npm ci --ignore-scripts
git diff --exit-code -- '*package-lock.json'`,
    },
    {
      id: 'ff-pin-hash', label: 'Actions and images pinned', when: { PINNING: ['hash'] }, category: 'structural', implements: DEPS,
      threshold: '0 workflow actions not pinned to a full commit SHA; 0 FROM lines without a sha256 digest',
      description: 'zizmor audits the workflows and fails on an action used by tag; a check over the Dockerfiles fails on a FROM line without a digest.',
      tool: 'zizmor (unpinned-uses audit) and grep',
      language: 'yaml',
      snippet: `# zizmor.yml, run as: zizmor --config zizmor.yml .github/workflows
rules:
  unpinned-uses:
    config:
      policies:
        "*": hash-pin
# and in the same job, for Dockerfiles:
#   ! grep -rnE '^FROM [^ @]+:[^ @]+( |$)' --include='Dockerfile*' .`,
    },
    {
      id: 'ff-pin-proxy', label: 'Packages only from the proxy', when: { PINNING: ['proxy'] }, category: 'structural', implements: DEPS,
      threshold: '0 lockfile entries resolved from anywhere but the internal registry',
      description: 'A check over the lockfiles fails when any package was resolved from a public registry, which would mean the proxy was bypassed.',
      tool: 'jq over package-lock.json',
      language: 'bash',
      snippet: `REGISTRY="https://artifacts.example.internal/api/npm/npm-remote/"
jq -r --arg reg "$REGISTRY" '.packages | to_entries[]
  | select(.value.resolved != null and (.value.resolved | startswith($reg) | not))
  | "\\(.key) from \\(.value.resolved)"' package-lock.json > outside.txt
test ! -s outside.txt || { cat outside.txt; exit 1; }`,
    },
    {
      id: 'ff-provenance-l1', label: 'Images carry provenance', when: { SLSA: ['l1'] }, category: 'structural', implements: ['adr-slsa-l1'],
      threshold: '100 % of released images carry SLSA provenance naming the repository and commit',
      description: 'After each release build, the pipeline inspects the pushed image and fails when it carries no SLSA provenance.',
      tool: 'Docker Buildx (BuildKit provenance attestations)',
      language: 'bash',
      snippet: `docker buildx build --provenance=mode=max --sbom=true -t "$IMAGE" --push .
docker buildx imagetools inspect "$IMAGE" --format '{{ json .Provenance }}' > provenance.json
jq -e '.SLSA.invocation.configSource.uri // .SLSA.buildDefinition.externalParameters' provenance.json`,
    },
    {
      id: 'ff-provenance-l2', label: 'Provenance verified on deploy', when: { SLSA: ['l2'] }, category: 'structural', implements: ['adr-slsa-l2'],
      threshold: '0 deployments of an artifact whose signed provenance does not verify for this repository',
      description: 'The build attests provenance with GitHub artifact attestations; the deploy job verifies it before anything is rolled out.',
      tool: 'GitHub artifact attestations (actions/attest-build-provenance, gh attestation verify)',
      language: 'yaml',
      snippet: `# in the build job (permissions: id-token: write, attestations: write)
- uses: actions/attest-build-provenance@v2
  with:
    subject-name: ghcr.io/\${{ github.repository }}
    subject-digest: \${{ steps.push.outputs.digest }}
    push-to-registry: true
# in the deploy job, before rolling out
- run: gh attestation verify "oci://$IMAGE@$DIGEST" --repo "\${{ github.repository }}"
  env: { GH_TOKEN: "\${{ github.token }}" }`,
    },
    {
      id: 'ff-provenance-l3', label: 'Admission verifies provenance', when: { SLSA: ['l3'] }, category: 'structural', implements: ['adr-slsa-l3'],
      threshold: '0 pods admitted from our registry without SLSA provenance signed by the isolated generator workflow',
      description: 'A Kyverno policy in enforce mode verifies, for every pod from our registry, that the image has an SLSA provenance attestation signed keylessly by the slsa-github-generator workflow for our repository.',
      tool: 'Kyverno (verifyImages)',
      language: 'yaml',
      snippet: `apiVersion: kyverno.io/v1
kind: ClusterPolicy
metadata: { name: require-slsa-provenance }
spec:
  validationFailureAction: Enforce
  webhookTimeoutSeconds: 30
  rules:
    - name: slsa-provenance
      match: { any: [{ resources: { kinds: [Pod] } }] }
      verifyImages:
        - imageReferences: ["ghcr.io/our-org/*"]
          attestations:
            - type: https://slsa.dev/provenance/v0.2
              attestors:
                - entries:
                    - keyless:
                        issuer: https://token.actions.githubusercontent.com
                        subjectRegExp: '^https://github.com/slsa-framework/slsa-github-generator/.github/workflows/generator_container_slsa3.yml@refs/tags/v.*'
                        rekor: { url: https://rekor.sigstore.dev }
              conditions:
                - all:
                    - key: "{{ invocation.configSource.uri }}"
                      operator: Equals
                      value: "git+https://github.com/our-org/shop@refs/heads/main"`,
    },
    {
      id: 'ff-sbom-track', label: 'SBOM of every deployed version', when: { SBOM: ['internal'] }, category: 'operational', implements: BUILD,
      threshold: '100 % of deployed versions have an SBOM in Dependency-Track; 0 critical policy violations in versions running in production',
      description: 'The release pipeline generates a CycloneDX SBOM of the image with Syft and uploads it to OWASP Dependency-Track under the element and version, where new advisories are matched against it continuously.',
      tool: 'Syft and OWASP Dependency-Track',
      language: 'bash',
      snippet: `syft "$IMAGE" -o cyclonedx-json > sbom.cdx.json
curl -sf -X POST "$DTRACK_URL/api/v1/bom" \\
  -H "X-Api-Key: $DTRACK_API_KEY" \\
  -F "autoCreate=true" -F "projectName=$ELEMENT" -F "projectVersion=$VERSION" \\
  -F "bom=@sbom.cdx.json"`,
    },
    {
      id: 'ff-sbom-release', label: 'Releases carry a valid SBOM', when: { SBOM: ['shipped'] }, category: 'structural', implements: BUILD,
      threshold: '100 % of releases carry a signed SBOM that validates against its schema, with a version and package URL on 100 % of components',
      description: 'The release job generates the SBOM, validates it against the CycloneDX schema, checks that every component has a version and purl, attests it to the image with cosign and attaches it to the release.',
      tool: 'Syft, CycloneDX CLI and cosign',
      language: 'bash',
      snippet: `syft "$IMAGE" -o cyclonedx-json > sbom.cdx.json
cyclonedx validate --input-file sbom.cdx.json --fail-on-errors
jq -e '[.components[] | select(.version == null or .purl == null)] | length == 0' sbom.cdx.json
cosign attest --yes --type cyclonedx --predicate sbom.cdx.json "$IMAGE@$DIGEST"
gh release upload "$TAG" sbom.cdx.json vex.openvex.json`,
    },
    {
      id: 'ff-base-minimal', label: 'Final stage on a minimal base', when: { BASE: ['minimal'] }, category: 'structural', implements: BUILD,
      threshold: '0 Dockerfiles whose final stage is not on gcr.io/distroless or cgr.dev/chainguard, or runs as root',
      description: 'A Conftest policy over each Dockerfile fails when the final stage starts from anything but a minimal base, or sets no non-root user.',
      tool: 'Conftest (Open Policy Agent) Dockerfile parser',
      language: 'rego',
      snippet: `package main

import rego.v1

froms := [i | some i in input; i.Cmd == "from"]
final := froms[count(froms) - 1]

deny contains msg if {
  not startswith(final.Value[0], "gcr.io/distroless/")
  not startswith(final.Value[0], "cgr.dev/chainguard/")
  msg := sprintf("final stage FROM %s is not a minimal base", [final.Value[0]])
}

deny contains msg if {
  users := [i | some i in input; i.Cmd == "user"; i.Stage == final.Stage]
  count(users) == 0
  msg := "final stage sets no USER: it would run as root"
}`,
    },
    {
      id: 'ff-base-official', label: 'Fresh, patched images', when: { BASE: ['official'] }, category: 'operational', implements: BUILD,
      threshold: '0 fixable high or critical OS vulnerabilities in released images; 0 production images older than {{REBUILD_DAYS}} days',
      description: 'A scheduled pipeline rebuilds each image on its current base, scans it with Trivy and fails on fixable high or critical findings; a check fails when a running image was built more than {{REBUILD_DAYS}} days ago.',
      tool: 'Trivy',
      language: 'bash',
      snippet: `docker build --pull --no-cache -t "$IMAGE" .
trivy image --scanners vuln --pkg-types os --severity HIGH,CRITICAL --ignore-unfixed --exit-code 1 "$IMAGE"
created=$(docker image inspect "$RUNNING_IMAGE" --format '{{ .Created }}')
age_days=$(( ( $(date +%s) - $(date -d "$created" +%s) ) / 86400 ))
[ "$age_days" -le {{REBUILD_DAYS}} ] || { echo "running image is $age_days days old"; exit 1; }`,
    },
    {
      id: 'ff-base-golden', label: 'Only golden images run', when: { BASE: ['golden'] }, category: 'structural', implements: BUILD,
      threshold: '0 pods admitted with an image outside the internal registry',
      description: 'A Kyverno policy in enforce mode refuses pods whose images come from anywhere but the internal registry, where only golden-image-based builds are published.',
      tool: 'Kyverno',
      language: 'yaml',
      snippet: `apiVersion: kyverno.io/v1
kind: ClusterPolicy
metadata: { name: restrict-image-registries }
spec:
  validationFailureAction: Enforce
  rules:
    - name: internal-registry-only
      match: { any: [{ resources: { kinds: [Pod] } }] }
      validate:
        message: "Images must come from registry.example.internal, built on a golden image."
        pattern:
          spec:
            =(initContainers): [{ image: "registry.example.internal/*" }]
            containers: [{ image: "registry.example.internal/*" }]`,
    },
  ],
}

export default pack
