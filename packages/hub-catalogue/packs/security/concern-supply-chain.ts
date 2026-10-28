import type { PackSpec } from '../../src/packSpec'

const FORCES = 'This element is built by us from source code, open-source dependencies and a base image, and shipped as an artifact. The forces: most of what runs is code we did not write, and known vulnerabilities in it are exploited within days of disclosure; a dependency resolved fresh on every build can change under us, through a compromised maintainer, a typosquatted name or a malicious release; a build that anyone with CI access can alter, or whose output nobody can trace to a commit, ships whatever an attacker puts in it; base images carry hundreds of operating-system packages we never use; and when the next widespread vulnerability is announced, the first question is which of our running versions contain it. The lockfile, how it is installed and how updates arrive are decided in the Dependency hygiene pack. The snippets of this pack assume a GitHub repository our-org/shop building the image ghcr.io/our-org/shop/order-api with a Dockerfile at the root; rename them for yours, and pin the actions they use by commit SHA in your repository.'
const BUILD = ['adr-slsa-l1', 'adr-slsa-l2', 'adr-slsa-l3']
const DEPS = ['adr-deps-gate', 'adr-deps-sla']

const pack: PackSpec = {
  id: 'concern-supply-chain',
  name: 'Software supply chain',
  group: 'security',
  description: 'What goes into what we build and ship: vulnerable dependencies and their deadlines, what is pinned beyond the lockfile and where packages come from, build provenance (SLSA), SBOMs and base images.',
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
    { title: 'NIST SP 800-190, Application Container Security Guide', url: 'https://csrc.nist.gov/pubs/sp/800/190/final' },
    { title: 'OWASP Top 10 2021, A06 Vulnerable and Outdated Components', url: 'https://owasp.org/Top10/A06_2021-Vulnerable_and_Outdated_Components/' },
    { title: 'OWASP Docker Security Cheat Sheet', url: 'https://cheatsheetseries.owasp.org/cheatsheets/Docker_Security_Cheat_Sheet.html' },
    { title: 'CIS Docker Benchmark', url: 'https://www.cisecurity.org/benchmark/docker' },
    { title: 'CycloneDX specification', url: 'https://cyclonedx.org/' },
    { title: 'SPDX specification', url: 'https://spdx.dev/' },
    { title: 'OSV-Scanner documentation', url: 'https://google.github.io/osv-scanner/' },
    { title: 'Sigstore', url: 'https://www.sigstore.dev/' },
    { title: 'zizmor: static analysis for GitHub Actions', url: 'https://docs.zizmor.sh/' },
  ],
  questions: [
    {
      key: 'SCA', title: 'Vulnerable dependencies', label: 'What happens to a change that brings in a known vulnerability?',
      hint: 'Blocking stops new vulnerabilities at the door but can stall work on a finding nobody can fix yet; deadlines alone let the backlog grow. The deadlines for vulnerable dependencies are decided here, for every element.',
      default: 'gate',
      options: [
        { value: 'gate', label: 'a blocked merge on high and critical findings with a fix', description: 'A required check refuses a pull request that adds or upgrades to a dependency with a known high or critical vulnerability that has a fixed version; existing findings have deadlines. Pick it for anything internet-facing or holding personal or payment data.' },
        { value: 'sla', label: 'a report on the pull request and a deadline to fix', description: 'Findings are reported on the pull request and tracked as alerts but do not block; each severity has a deadline. Pick it for internal tools, or for a codebase with a large backlog you are working through before switching to blocking.' },
      ],
    },
    {
      key: 'PINNING', title: 'Pinning', label: 'What is pinned beyond the package manager?',
      hint: 'The lockfile and how it is installed are decided in the Dependency hygiene pack. This is about the rest of the build: CI actions, base images, downloaded tools, and where packages come from.',
      default: 'hash',
      options: [
        { value: 'hash', label: 'actions, images and downloads by digest', description: 'CI actions pinned to full commit SHAs, base images to sha256 digests, downloaded tools to a checksum checked in the build; updates come as bot pull requests. Pick it for anything you ship to production; it is what OpenSSF Scorecard\'s Pinned-Dependencies checks.' },
        { value: 'proxy', label: 'packages only from our registry proxy, held 7 days', description: 'Builds fetch packages only through an internal proxy (Artifactory, Nexus, AWS CodeArtifact, Azure Artifacts) with no other egress, and a newly published release is served only after 7 days in public. Pick it in regulated environments or where malicious package releases are a demonstrated threat.' },
        { value: 'none', label: 'nothing more than the lockfile', description: 'Actions and images are referenced by tag, and packages come from the public registries; only the lockfile pins, as decided in the Dependency hygiene pack. Pick it for prototypes and internal tools that never ship to production, and record it so that the first production deploy supersedes it.' },
      ],
    },
    {
      key: 'SLSA', title: 'Build provenance', label: 'Which SLSA build level do the builds reach?',
      hint: 'Provenance says which source and which build produced an artifact; the higher the level, the harder it is to forge, and the more the deployment can refuse.',
      default: 'l2',
      options: [
        { value: 'l1', label: 'SLSA Build L1, provenance recorded', description: 'The build records how each artifact was made (BuildKit provenance attestations), unsigned. Pick it as the first step for builds that are not yet on a hosted CI.' },
        { value: 'l2', label: 'SLSA Build L2, signed provenance from a hosted build', description: 'Builds run only on hosted CI, which signs the provenance (GitHub artifact attestations, GitLab SLSA provenance, cosign keyless); the deployment verifies it. Pick it for production services; it is a few lines of CI configuration.' },
        { value: 'l3', label: 'SLSA Build L3, hardened and isolated builds', description: 'Provenance is produced by an isolated job the build steps cannot influence (slsa-github-generator reusable workflows), and the cluster admits only images whose provenance verifies. Pick it for software others depend on, or where a tampered build would be catastrophic.' },
      ],
    },
    {
      key: 'SBOM', title: 'SBOM', label: 'What is the SBOM for?',
      hint: 'A software bill of materials answers "are we affected?" in minutes instead of days, but only if someone keeps it and looks.',
      default: 'internal',
      options: [
        { value: 'internal', label: 'answering "are we affected?" ourselves', description: 'A CycloneDX SBOM of every deployed version is loaded into OWASP Dependency-Track, which matches new advisories against what runs. Pick it when nobody outside asks for the SBOM but you want to know your exposure fast.' },
        { value: 'shipped', label: 'shipping with each release', description: 'Each release carries a signed SBOM (CycloneDX or SPDX) and VEX statements for known vulnerabilities that do not affect it. Pick it when customers, US federal buyers (EO 14028) or the EU Cyber Resilience Act require it.' },
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
    { key: 'REBUILD_DAYS', label: 'Most days a running image may go without a rebuild. Only with official slim images', default: '7', number: true },
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
      action: 'fail its required check so that it cannot merge until it uses a fixed version, while findings without a fix or below high only warn',
      rationale: 'The cheapest vulnerability to fix is the one that never merges (NIST SSDF PW.4; OpenSSF Scorecard Vulnerabilities).',
      scenario: { label: 'Vulnerable upgrade blocked', given: 'a pull request that pins a library to a version with a critical advisory and a fixed version available, and another with a low advisory', when: 'their checks run', then: 'the first pull request\'s dependency check fails and it cannot merge; the second passes with a warning' },
    },
    {
      id: 'req-vuln-report', label: 'Findings visible on each change', when: { SCA: ['sla'] }, ears_type: 'event-driven',
      trigger: 'a pull request changes a dependency manifest or lockfile',
      action: 'comment on it with every known vulnerability the change adds or removes, with its severity and fixed version, without blocking, and keep every high or critical one that merges as an open Dependabot alert until it is fixed',
      rationale: 'Without blocking, visibility at the moment of change and a tracked alert are what keep the deadline from being missed (NIST SSDF RV.1).',
      scenario: { label: 'Finding tracked', given: 'a pull request that adds a dependency with a high advisory', when: 'it merges', then: 'it carried a comment naming the advisory, and an open alert with the {{HIGH_DAYS}}-day deadline counts from its creation' },
    },
    {
      id: 'req-review', label: 'Changes reviewed and protected', ears_type: 'ubiquitous',
      action: 'build release artifacts only from the protected default branch or signed release tags, where every change is merged through a pull request approved by someone other than its author with the required checks passed',
      rationale: 'A build is only as trustworthy as the source it starts from; review and branch protection are the source half of the supply chain (OpenSSF Scorecard Branch-Protection, Code-Review; NIST SSDF PS.1).',
      scenario: { label: 'Direct push refused', given: 'a maintainer with write access', when: 'they push a commit directly to the default branch, and open a pull request they approve themselves', then: 'the push is refused and the pull request cannot merge without a second person\'s approval' },
    },
    {
      id: 'req-pin-hash', label: 'Actions, images and downloads pinned', when: { PINNING: ['hash'] }, ears_type: 'ubiquitous',
      action: 'pin every CI action to a full commit SHA, every base image to a sha256 digest and every file downloaded in a build to a checksum verified in the same step, and take updates to them only through bot pull requests that are reviewed like code',
      rationale: 'A tag or version range can be moved by whoever controls it; a hash cannot (OpenSSF Scorecard Pinned-Dependencies; SLSA v1.0 threats, dependency threats).',
      scenario: { label: 'Unpinned action refused', given: 'a pull request that adds a CI step using an action by its tag, and a Dockerfile FROM by tag', when: 'its checks run', then: 'the pinning check fails naming both' },
    },
    {
      id: 'req-pin-proxy', label: 'Packages only from our proxy', when: { PINNING: ['proxy'] }, ears_type: 'ubiquitous',
      action: 'fetch every package and image only through our registry proxy, with no other network access from the build runner, and get a newly published release from the proxy only after it has been public for 7 days',
      rationale: 'One controlled entry point can be audited and blocked; malicious releases are usually found and pulled within days of publication (NIST SSDF PW.4; SLSA v1.0 threats, dependency threats).',
      scenario: { label: 'Fresh release held back', given: 'a package version published 2 days ago', when: 'a build asks for it', then: 'the proxy does not serve it and the build fails, and the same build with a 10-day-old version succeeds' },
    },
    {
      id: 'req-provenance-l1', label: 'Provenance recorded', when: { SLSA: ['l1'] }, ears_type: 'event-driven',
      trigger: 'a build produces a release artifact',
      action: 'attach SLSA provenance to it that names the builder and the commit it was built from',
      rationale: 'Provenance is what makes an artifact traceable to the source and build that made it; at Build L1 it exists, which already catches mistakes (SLSA v1.0, Build L1).',
      scenario: { label: 'Image carries provenance', given: 'an image built by the release pipeline', when: 'its attestations are inspected', then: 'they hold SLSA provenance naming the builder and the commit' },
    },
    {
      id: 'req-provenance-l2', label: 'Unverified artifacts not deployed', when: { SLSA: ['l2'] }, ears_type: 'unwanted-behaviour',
      unwanted_condition: 'an artifact is about to be deployed without provenance signed by our hosted build platform for this repository and its protected default branch',
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
      action: 'list every deployed version of the element that contains it within 24 hours, from the CycloneDX SBOMs kept for each deployed version, and fail a daily check while the version in production violates a blocking policy',
      rationale: 'The first question after a widespread vulnerability is where it runs; an SBOM per deployed version answers it without rebuilding anything (NIST SSDF PS.3.2; CycloneDX).',
      scenario: { label: 'Affected versions listed', given: 'SBOMs of the three versions deployed in production and staging', when: 'an advisory is published for a component in two of them', then: 'within 24 hours the two versions and their environments are listed, and the daily check fails for the one in production' },
    },
    {
      id: 'req-sbom-shipped', label: 'SBOM shipped with releases', when: { SBOM: ['shipped'] }, ears_type: 'event-driven',
      trigger: 'a version is released',
      action: 'publish with it a signed SBOM in CycloneDX or SPDX listing every component, transitive ones included, with version, package URL and licence, and VEX statements for known vulnerabilities that do not affect it',
      rationale: 'Customers and regulators (US EO 14028, EU Cyber Resilience Act) expect an SBOM with each release; VEX saves them chasing findings that do not apply (NIST SSDF PS.3.2; CycloneDX; SPDX).',
      scenario: { label: 'Release carries SBOM', given: 'a release', when: 'its assets are listed and the SBOM is validated against its schema', then: 'a signed SBOM, its signature bundle and VEX are attached, valid, and every component has a version and package URL' },
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
      decision: 'Every pull request is checked for known vulnerabilities in the dependencies it adds or changes, and a high or critical one with a fixed version blocks the merge; findings without a fix or below high warn. Existing findings, in every element, are fixed within {{CRITICAL_DAYS}} days (critical) and {{HIGH_DAYS}} days (high) of disclosure, or get a reviewed not-affected statement. Beyond the lockfile decided in the Dependency hygiene pack, what is pinned: {{PINNING}}; update pull requests arrive as decided there. Tools: GitHub dependency review and OSV-Scanner for the gate (free, OSV and GitHub Advisory data), Snyk or Mend when you also need reachability analysis and licence policy; judge by the ecosystems you use, the advisory database, and whether it can tell reachable from unreachable code.',
      consequences: '• New known vulnerabilities do not reach the main branch.\n• A finding with no fixed version does not block, but gets a deadline and, if unaffected, a reviewed statement.\n• Update pull requests become routine work: merge them weekly, grouped, with tests that make it safe.',
      alternatives: '1. Report and deadlines only: no blocked work, but the backlog grows.\n2. Scan only before release: findings arrive late, in bulk.\n3. Vendoring all dependencies: full control, all the patching is ours.',
    },
    {
      id: 'adr-deps-sla', label: 'Vulnerabilities fixed by deadline', when: { SCA: ['sla'] },
      decision: 'Known vulnerabilities in dependencies are reported on every pull request and tracked as Dependabot alerts and do not block merging; each must be fixed, in every element, within {{CRITICAL_DAYS}} days (critical) and {{HIGH_DAYS}} days (high) of disclosure, or get a reviewed not-affected statement. Beyond the lockfile decided in the Dependency hygiene pack, what is pinned: {{PINNING}}; update pull requests arrive as decided there. Tools: GitHub dependency review for the comment, Dependabot alerts for the tracking, OWASP Dependency-Track for the dashboard. Revisit this decision, towards blocking, once no high or critical finding is past its deadline.',
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
      decision: 'Release artifacts are built only on hosted CI, which signs their SLSA provenance (GitHub artifact attestations with actions/attest-build-provenance, GitLab\'s SLSA provenance, or cosign keyless signing with Sigstore); the deployment pipeline verifies that the provenance names this repository and its protected default branch, and stops otherwise. Changes reach the default branch only through reviewed pull requests. SBOM: {{SBOM}}. Base images: {{BASE}}. Choose by the CI in use; Sigstore keyless signing works across CIs and needs no keys to keep.',
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
      checks: ['req-review'],
      threshold: 'Code-Review, Dangerous-Workflow and Token-Permissions each score 10 and Branch-Protection at least 8 (one required reviewer, no force pushes, a required status check); overall score at least 7.0',
      description: 'OpenSSF Scorecard runs weekly and on every push to the default branch; a step fails the job when an enforced check scores below its threshold. Branch-Protection scores 8 with one required approving reviewer, which is what the review requirement asks; 9 and 10 need two reviewers and code-owner review.',
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
      - uses: actions/checkout@v4.2.2            # pin by commit SHA in your repository
        with: { persist-credentials: false }
      - uses: ossf/scorecard-action@v2.4.2       # pin by commit SHA in your repository
        with: { results_file: results.json, results_format: json, publish_results: true }
      - run: |
          jq -e '.score >= 7
            and ([.checks[] | select(.name | IN("Code-Review","Dangerous-Workflow","Token-Permissions")) | select(.score < 10)] | length == 0)
            and ([.checks[] | select(.name == "Branch-Protection") | select(.score < 8)] | length == 0)' results.json`,
    },
    {
      id: 'ff-vuln-gate', label: 'Vulnerable dependency check', when: { SCA: ['gate'] }, category: 'structural', implements: ['adr-deps-gate'],
      checks: ['req-vuln-gate'],
      threshold: '0 high or critical vulnerabilities with a fixed version added by a pull request; the check is required for merging; lower findings and findings without a fix warn',
      description: 'GitHub\'s dependency review action compares the pull request\'s dependencies with the base branch and fails on a newly added high or critical advisory; OSV-Scanner covers lockfiles the dependency graph does not, and its JSON output is filtered so that only high or critical findings that have a fixed version fail the step (OSV-Scanner itself exits 1 on any finding).',
      tool: 'GitHub dependency-review-action and OSV-Scanner with jq',
      language: 'yaml',
      snippet: `# .github/workflows/dependencies.yml
name: dependencies
on: [pull_request]
permissions: { contents: read, pull-requests: write }
jobs:
  review:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4.2.2                      # pin by commit SHA in your repository
      - uses: actions/dependency-review-action@v4.7.1      # pin by commit SHA in your repository
        with:
          fail-on-severity: high
          comment-summary-in-pr: on-failure
      - uses: actions/setup-go@v5.5.0                      # pin by commit SHA in your repository
        with: { go-version: '1.24' }
      - name: OSV-Scanner over every lockfile, failing only on high or critical findings with a fix
        run: |
          go install github.com/google/osv-scanner/v2/cmd/osv-scanner@v2.0.2
          osv-scanner scan source --recursive --format json . > osv.json || true   # exits 1 on any finding; the filter below decides
          jq -e '[.results[]?.packages[]?.vulnerabilities[]?
                   | select((.database_specific.severity // "" | ascii_upcase) | IN("HIGH", "CRITICAL"))
                   | select([.affected[]?.ranges[]?.events[]?.fixed // empty] | length > 0)
                   | .id] | unique
                 | if length > 0 then ("blocking: " + join(", ") | halt_error(1)) else true end' osv.json`,
    },
    {
      id: 'ff-vuln-report', label: 'Findings commented, alerts tracked', when: { SCA: ['sla'] }, category: 'process', implements: ['adr-deps-sla'],
      checks: ['req-vuln-report'],
      threshold: 'Every pull request that changes dependencies gets a dependency review comment and no failed check from it; Dependabot alerts are enabled on the repository',
      description: 'GitHub\'s dependency review action runs in warn-only mode and always comments its summary on the pull request, so the finding is visible where the change is made; a step checks that Dependabot alerts are enabled, since they are the tracked record the deadline job reads.',
      tool: 'GitHub dependency-review-action (warn-only) and the GitHub CLI',
      language: 'yaml',
      snippet: `# .github/workflows/dependencies.yml
name: dependencies
on: [pull_request]
permissions: { contents: read, pull-requests: write }
jobs:
  review:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4.2.2                      # pin by commit SHA in your repository
      - uses: actions/dependency-review-action@v4.7.1      # pin by commit SHA in your repository
        with:
          warn-only: true
          comment-summary-in-pr: always
      - name: Dependabot alerts are on (the tracked record of each finding)
        env:
          GH_TOKEN: \${{ github.token }}
        run: gh api "repos/\${{ github.repository }}/vulnerability-alerts" --silent   # 204 when enabled, 404 otherwise`,
    },
    {
      id: 'ff-vuln-age', label: 'No finding past its deadline', category: 'operational', implements: DEPS,
      checks: ['req-vuln-sla'],
      threshold: '0 open critical alerts older than {{CRITICAL_DAYS}} days and 0 open high alerts older than {{HIGH_DAYS}} days',
      description: 'A daily job reads the repository\'s open Dependabot alerts and fails on any past its deadline, naming the package and the advisory. A reviewed not-affected statement dismisses the alert with a reason, which takes it out of the open set.',
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
      id: 'ff-pin-hash', label: 'Actions, images and downloads pinned', when: { PINNING: ['hash'] }, category: 'structural', implements: DEPS,
      checks: ['req-pin-hash'],
      threshold: '0 workflow actions not pinned to a full commit SHA; 0 FROM lines (stage aliases and scratch aside) without a sha256 digest; 0 RUN lines that download with curl or wget without a sha256sum check',
      description: 'zizmor audits the workflows and fails on an action used by tag or branch; a Conftest policy over the Dockerfiles fails on a FROM without a digest, resolving stage aliases so that FROM build is not flagged, and on a download that is not checked against a checksum in the same step. Both run on every pull request.',
      tool: 'zizmor (unpinned-uses, hash-pin policy) and Conftest (Dockerfile parser)',
      language: 'rego',
      snippet: `# Workflows:   zizmor --config zizmor.yml .github/workflows      with zizmor.yml:
#   rules: { unpinned-uses: { config: { policies: { "*": hash-pin } } } }
# Dockerfiles: conftest test --parser dockerfile -p policy/pinning.rego Dockerfile*
package main

import rego.v1

# conftest's dockerfile parser gives one array of commands per file; this reads either shape
commands contains c if {
  some c in input
  is_object(c)
}

commands contains c if {
  some stage in input
  is_array(stage)
  some c in stage
}

froms contains f if {
  some f in commands
  f.Cmd == "from"
}

aliases contains lower(f.Value[2]) if {
  some f in froms
  count(f.Value) == 3
  lower(f.Value[1]) == "as"
}

deny contains msg if {
  some f in froms
  image := f.Value[0]
  image != "scratch"
  not lower(image) in aliases
  not regex.match(\`@sha256:[0-9a-f]{64}$\`, image)
  msg := sprintf("FROM %s is not pinned by digest", [image])
}

deny contains msg if {
  some c in commands
  c.Cmd == "run"
  line := concat(" ", c.Value)
  regex.match(\`\\b(curl|wget)\\b\`, line)
  not contains(line, "sha256sum")
  msg := sprintf("RUN downloads without a sha256sum check: %s", [line])
}`,
    },
    {
      id: 'ff-pin-proxy', label: 'Packages only from the proxy', when: { PINNING: ['proxy'] }, category: 'structural', implements: DEPS,
      checks: ['req-pin-proxy'],
      threshold: '0 lockfile entries resolved from anywhere but the internal registry (npm, pip, Go); the build runner cannot reach a public registry',
      description: 'A step in the build job fails when any npm package was resolved from a public registry, when a Python requirements file names a public index, or when the Go proxy is not the internal one, which would mean the proxy was bypassed; a last line fails when the runner can reach the public npm registry at all.',
      tool: 'jq, grep and curl in the build job',
      language: 'bash',
      snippet: `PROXY="https://artifacts.example.internal"
# npm: every resolved URL comes from the proxy
jq -r --arg reg "$PROXY/api/npm/npm-remote/" '.packages | to_entries[]
  | select(.value.resolved != null and (.value.resolved | startswith($reg) | not))
  | "\\(.key) from \\(.value.resolved)"' package-lock.json > outside.txt
test ! -s outside.txt || { cat outside.txt; exit 1; }
# pip: the proxy is the only index
if ls requirements*.txt >/dev/null 2>&1; then
  grep -q "^--index-url $PROXY/api/pypi/pypi-remote/simple" requirements.txt || { echo "requirements.txt does not name the proxy as its index"; exit 1; }
  ! grep -lE 'https?://(pypi\\.org|files\\.pythonhosted\\.org)' requirements*.txt || exit 1
fi
# Go: the module proxy is ours
[ -z "$(ls go.mod 2>/dev/null)" ] || [ "$(go env GOPROXY)" = "$PROXY/api/go/go-remote" ] || { echo "GOPROXY is $(go env GOPROXY)"; exit 1; }
# the runner has no other egress
! curl -sSf --max-time 5 https://registry.npmjs.org/ -o /dev/null || { echo "the build runner can reach registry.npmjs.org"; exit 1; }`,
    },
    {
      id: 'ff-proxy-quarantine', label: 'Fresh releases held back', when: { PINNING: ['proxy'] }, category: 'operational', implements: DEPS,
      checks: ['req-pin-proxy'],
      threshold: 'A package version younger than 7 days is refused by the proxy; one older than 7 days is served',
      description: 'A daily job on a runner with internet access (not a build runner) takes the newest version of a frequently released package from the public registry, computes its age from the registry\'s publish time, and asks the proxy for it: a version younger than 7 days must be refused, an older one served. It fails when the proxy serves a fresh one.',
      tool: 'npm view and jq in a scheduled job (the same with pip index versions for PyPI)',
      language: 'bash',
      snippet: `PROXY="https://artifacts.example.internal/api/npm/npm-remote/"
PUBLIC="https://registry.npmjs.org/"
pkg=express
latest=$(npm view "$pkg" version --registry "$PUBLIC")
published=$(npm view "$pkg@$latest" time --json --registry "$PUBLIC" | jq -r --arg v "$latest" '.[$v]')
age_days=$(( ( $(date +%s) - $(date -d "$published" +%s) ) / 86400 ))
if [ "$age_days" -lt 7 ]; then
  if npm view "$pkg@$latest" version --registry "$PROXY" >/dev/null 2>&1; then
    echo "the proxy served $pkg@$latest at $age_days days old"; exit 1
  fi
  echo "the proxy held back $pkg@$latest ($age_days days old)"
else
  npm view "$pkg@$latest" version --registry "$PROXY" >/dev/null || { echo "the proxy refused $pkg@$latest at $age_days days old"; exit 1; }
  echo "no version younger than 7 days to test with $pkg today; the $age_days-day-old one was served"
fi`,
    },
    {
      id: 'ff-provenance-l1', label: 'Images carry provenance', when: { SLSA: ['l1'] }, category: 'structural', implements: ['adr-slsa-l1'],
      checks: ['req-provenance-l1'],
      threshold: '100 % of released images carry a SLSA provenance statement per platform, each naming the builder and the commit it was built from',
      description: 'After each release build, the pipeline inspects the pushed image and fails when it carries no SLSA provenance, or one without a builder id or the source commit. BuildKit keys the provenance by platform for multi-platform images and records the commit under its own metadata key when the build context is a git checkout, which the filter reads.',
      tool: 'Docker Buildx (BuildKit provenance attestations) and jq',
      language: 'bash',
      snippet: `docker buildx build --provenance=mode=max --sbom=true -t "$IMAGE" --push .
docker buildx imagetools inspect "$IMAGE" --format '{{ json .Provenance }}' > provenance.json
jq -e '[.. | objects | select(has("SLSA")) | .SLSA]
       | length > 0
         and all(.builder.id != null
                 and .metadata["https://mobyproject.org/buildkit@v1#metadata"].vcs.revision != null)' provenance.json \\
  || { echo "no SLSA provenance naming the builder and the commit"; exit 1; }`,
    },
    {
      id: 'ff-provenance-l2', label: 'Provenance verified on deploy', when: { SLSA: ['l2'] }, category: 'structural', implements: ['adr-slsa-l2'],
      checks: ['req-provenance-l2'],
      threshold: '0 deployments of an artifact whose signed provenance does not verify for this repository and its main branch',
      description: 'The build attests provenance with GitHub artifact attestations under the image\'s lower-case name; the deploy job verifies, before anything is rolled out, that the attestation was made for this repository from refs/heads/main.',
      tool: 'GitHub artifact attestations (actions/attest-build-provenance, gh attestation verify)',
      language: 'yaml',
      snippet: `# build job (permissions: id-token: write, attestations: write, packages: write)
- run: echo "IMAGE=ghcr.io/\${GITHUB_REPOSITORY,,}/order-api" >> "$GITHUB_ENV"   # the registry wants a lower-case name
- uses: actions/attest-build-provenance@v2.4.0    # pin by commit SHA in your repository
  with:
    subject-name: \${{ env.IMAGE }}
    subject-digest: \${{ steps.push.outputs.digest }}
    push-to-registry: true
# deploy job, before rolling out
- run: gh attestation verify "oci://$IMAGE@$DIGEST" --repo "\${{ github.repository }}" --source-ref refs/heads/main
  env: { GH_TOKEN: "\${{ github.token }}" }`,
    },
    {
      id: 'ff-provenance-l3', label: 'Admission verifies provenance', when: { SLSA: ['l3'] }, category: 'structural', implements: ['adr-slsa-l3'],
      checks: ['req-provenance-l3'],
      threshold: '0 pods admitted from our registry without SLSA provenance signed by the isolated generator workflow for this repository',
      description: 'A Kyverno policy in enforce mode verifies, for every pod from our registry, that the image has an SLSA provenance attestation signed keylessly by the slsa-github-generator workflow and that the provenance names our repository\'s main branch as its source.',
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
      checks: ['req-sbom-internal'],
      threshold: 'Every release uploads its CycloneDX SBOM to Dependency-Track under the element and version; 0 violations of a FAIL-state policy for the version in production, checked daily',
      description: 'The release pipeline generates a CycloneDX SBOM of the image with Syft and uploads it to OWASP Dependency-Track under the element and version, where new advisories are matched against it continuously. A daily job looks the production version up and fails on any violation of a policy whose state is FAIL (the blocking policies, such as a critical vulnerability past its deadline).',
      tool: 'Syft and OWASP Dependency-Track (REST API)',
      language: 'bash',
      snippet: `# release pipeline
syft "$IMAGE" -o cyclonedx-json > sbom.cdx.json
curl -sf -X POST "$DTRACK_URL/api/v1/bom" \\
  -H "X-Api-Key: $DTRACK_API_KEY" \\
  -F "autoCreate=true" -F "projectName=$ELEMENT" -F "projectVersion=$VERSION" \\
  -F "bom=@sbom.cdx.json"
# daily, for the version running in production
uuid=$(curl -sf "$DTRACK_URL/api/v1/project/lookup?name=$ELEMENT&version=$PROD_VERSION" -H "X-Api-Key: $DTRACK_API_KEY" | jq -r .uuid)
curl -sf "$DTRACK_URL/api/v1/violation/project/$uuid" -H "X-Api-Key: $DTRACK_API_KEY" \\
  | jq -e '[.[] | select(.policyCondition.policy.violationState == "FAIL")]
           | if length > 0 then (map(.policyCondition.policy.name + ": " + .component.name) | join("\\n") | halt_error(1)) else true end'`,
    },
    {
      id: 'ff-sbom-release', label: 'Releases carry a signed SBOM and VEX', when: { SBOM: ['shipped'] }, category: 'structural', implements: BUILD,
      checks: ['req-sbom-shipped'],
      threshold: '100 % of releases carry an SBOM that validates against its schema with a version and package URL on 100 % of components, its Sigstore signature bundle, and an OpenVEX document',
      description: 'The release job generates the SBOM, validates it against the CycloneDX schema, checks that every component has a version and purl, attests it to the image with cosign, signs the SBOM file keylessly (the bundle is the signature customers verify with cosign verify-blob), writes the VEX statements from the reviewed list of not-affected vulnerabilities, and attaches all three to the release.',
      tool: 'Syft, CycloneDX CLI, cosign and vexctl',
      language: 'bash',
      snippet: `syft "$IMAGE" -o cyclonedx-json > sbom.cdx.json
cyclonedx validate --input-file sbom.cdx.json --fail-on-errors
jq -e '[.components[] | select(.version == null or .purl == null)] | length == 0' sbom.cdx.json
cosign attest --yes --type cyclonedx --predicate sbom.cdx.json "$IMAGE@$DIGEST"
cosign sign-blob --yes --bundle sbom.cdx.json.sigstore.json sbom.cdx.json
# VEX: one statement per reviewed not-affected vulnerability (security/vex.yaml: id and justification), merged into one document
for cve in $(yq -r '.not_affected[].id' security/vex.yaml); do
  just=$(yq -r ".not_affected[] | select(.id == \\"$cve\\") | .justification" security/vex.yaml)
  vexctl create --product "pkg:oci/order-api@$DIGEST" --vuln "$cve" --status not_affected --justification "$just" > "vex-$cve.json"
done
vexctl merge vex-*.json > vex.openvex.json
gh release upload "$TAG" sbom.cdx.json sbom.cdx.json.sigstore.json vex.openvex.json`,
    },
    {
      id: 'ff-base-minimal', label: 'Final stage on a minimal base', when: { BASE: ['minimal'] }, category: 'structural', implements: BUILD,
      checks: ['req-base-minimal'],
      threshold: '0 Dockerfiles whose final stage is not on gcr.io/distroless or cgr.dev/chainguard, or runs as root',
      description: 'A Conftest policy over each Dockerfile resolves the final stage\'s base through stage aliases and fails when it is not a minimal image, or when the final stage runs as root: no USER and a base whose tag is not a nonroot one (distroless :nonroot, Chainguard images default to a non-root user).',
      tool: 'Conftest (Open Policy Agent) Dockerfile parser',
      language: 'rego',
      snippet: `# conftest test --parser dockerfile -p policy/minimal-base.rego Dockerfile*
package main

import rego.v1

# conftest's dockerfile parser gives one array of commands per file; this reads either shape
commands contains c if {
  some c in input
  is_object(c)
}

commands contains c if {
  some stage in input
  is_array(stage)
  some c in stage
}

froms contains f if {
  some f in commands
  f.Cmd == "from"
}

last_stage := max({f.Stage | some f in froms})

final := [f | some f in froms; f.Stage == last_stage][0]

aliases := {lower(f.Value[2]): f.Value[0] | some f in froms; count(f.Value) == 3; lower(f.Value[1]) == "as"}

base := object.get(aliases, lower(final.Value[0]), final.Value[0])

deny contains msg if {
  not startswith(base, "gcr.io/distroless/")
  not startswith(base, "cgr.dev/chainguard/")
  msg := sprintf("final stage is on %s, not a minimal base", [base])
}

deny contains msg if {
  users := [c | some c in commands; c.Cmd == "user"; c.Stage == last_stage]
  count(users) == 0
  not contains(base, "nonroot")
  not startswith(base, "cgr.dev/chainguard/")
  msg := sprintf("final stage on %s sets no USER and the base does not run as non-root", [base])
}`,
    },
    {
      id: 'ff-base-official', label: 'Fresh, patched images', when: { BASE: ['official'] }, category: 'operational', implements: BUILD,
      checks: ['req-base-official'],
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
      id: 'ff-base-golden-build', label: 'Builds start from golden images', when: { BASE: ['golden'] }, category: 'structural', implements: BUILD,
      checks: ['req-base-golden'],
      threshold: '0 FROM lines (stage aliases aside) whose image is outside the internal registry',
      description: 'A Conftest policy over each Dockerfile fails the build when any stage starts from an image outside the internal registry, where only golden-image-based images are published; stage aliases are resolved so that FROM build passes.',
      tool: 'Conftest (Open Policy Agent) Dockerfile parser',
      language: 'rego',
      snippet: `# conftest test --parser dockerfile -p policy/golden-base.rego Dockerfile*
package main

import rego.v1

commands contains c if {
  some c in input
  is_object(c)
}

commands contains c if {
  some stage in input
  is_array(stage)
  some c in stage
}

froms contains f if {
  some f in commands
  f.Cmd == "from"
}

aliases contains lower(f.Value[2]) if {
  some f in froms
  count(f.Value) == 3
  lower(f.Value[1]) == "as"
}

deny contains msg if {
  some f in froms
  image := f.Value[0]
  not lower(image) in aliases
  not startswith(image, "registry.example.internal/golden/")
  msg := sprintf("FROM %s is not a golden image from registry.example.internal/golden/", [image])
}`,
    },
    {
      id: 'ff-base-golden', label: 'Only golden images run', when: { BASE: ['golden'] }, category: 'structural', implements: BUILD,
      checks: ['req-base-golden'],
      threshold: '0 pods admitted with an image outside the internal registry, init and ephemeral containers included',
      description: 'A Kyverno policy in enforce mode refuses pods whose containers, init containers or ephemeral containers come from anywhere but the internal registry, where only golden-image-based builds are published.',
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
            =(ephemeralContainers): [{ image: "registry.example.internal/*" }]
            containers: [{ image: "registry.example.internal/*" }]`,
    },
  ],
}

export default pack
