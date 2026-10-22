import type { PackSpec } from '../../src/packSpec'

const RUNTIMES = ['adr-jvm', 'adr-dotnet', 'adr-node', 'adr-go', 'adr-python']
const FORCES = 'Code lives in this element, and the runtime, language and main framework it is written in will outlive most of the people who chose them. The forces: the team\'s skills decide how fast and how safely it can work, and hiring follows the choice; the ecosystem decides which libraries, drivers and SDKs exist and are maintained; runtimes and frameworks reach end of support on published dates, after which security fixes stop; performance (latency, memory, start-up time) matters where load or cost is high and rarely elsewhere; every dependency added is code someone else maintains, at their pace; and upgrades put off for years turn into rewrites.'

const pack: PackSpec = {
  id: 'concern-runtime-stack',
  name: 'Runtime stack',
  group: 'technology',
  description: 'The runtime, language and main framework the element is built on, why, and how it is kept on supported versions with its dependencies up to date.',
  tags: ['technology', 'runtime', 'language', 'framework', 'end of life', 'dependency updates', 'lts'],
  concern: {
    id: 'runtime-stack',
    trigger: 'LIST NODES WHERE (type = "container" OR type = "webapp") AND external != true',
    why: 'code lives in these elements, so what it runs on, and how that is kept supported and up to date, has to be decided.',
  },
  sources: [
    { title: 'endoflife.date: end-of-life dates and support lifecycles', url: 'https://endoflife.date/' },
    { title: 'Thoughtworks Technology Radar', url: 'https://www.thoughtworks.com/radar' },
    { title: 'ISO/IEC 25010, Maintainability and Flexibility', url: 'https://iso25000.com/index.php/en/iso-25000-standards/iso-25010' },
    { title: 'Renovate documentation', url: 'https://docs.renovatebot.com/' },
    { title: 'OpenSSF Scorecard', url: 'https://github.com/ossf/scorecard' },
    { title: 'Ford, Parsons, Kua, Sadalage: Building Evolutionary Architectures, 2nd ed.', url: 'https://www.oreilly.com/library/view/building-evolutionary-architectures/9781492097532/' },
  ],
  questions: [
    {
      key: 'RUNTIME', title: 'Runtime', label: 'What does the element run on?',
      hint: 'The runtime brings the language, the framework, the libraries and the people who can work on it. Changing it later means rewriting the element.',
      default: 'jvm',
      options: [
        { value: 'jvm', label: 'the JVM (Java or Kotlin, Spring Boot)', description: 'Mature, fast after warm-up, the widest choice of enterprise libraries and drivers. Pick it for long-lived business services, when the team knows Java or Kotlin, or integrations need JVM-only SDKs.' },
        { value: 'dotnet', label: '.NET (C#, ASP.NET Core)', description: 'Fast, one vendor-backed stack from language to web framework and ORM. Pick it when the team knows C#, the organisation runs Microsoft tooling or Azure, or desktop and server share code.' },
        { value: 'node', label: 'Node.js (TypeScript)', description: 'One language with the web front end, quick to start, very large package ecosystem. Pick it for web back ends, BFFs and I/O-bound APIs, when the team writes TypeScript in the front end too.' },
        { value: 'go', label: 'Go', description: 'Small static binaries, fast start-up, low memory, simple concurrency. Pick it for infrastructure-like services, high-throughput network services and CLIs, when a small standard library is enough.' },
        { value: 'python', label: 'Python (FastAPI or Django)', description: 'The data and machine-learning ecosystem, quick to write. Pick it when the element serves models or data pipelines, or the team are data people; CPU-heavy request handling is not its strength.' },
      ],
    },
    {
      key: 'CRITERION', title: 'Deciding factor', label: 'What weighs most in the choice?',
      hint: 'Every stack can do most things; the criterion that decides adds the requirement that keeps the choice honest.',
      default: 'skills',
      options: [
        { value: 'skills', label: 'the team\'s skills', description: 'The team already knows the stack well. Pick it in most cases: a known stack is faster and safer than a better one nobody knows.' },
        { value: 'ecosystem', label: 'the ecosystem', description: 'The libraries, SDKs and drivers the element needs exist and are maintained in this stack. Pick it when integrations (a payment SDK, a data or ML library) decide what is practical.' },
        { value: 'performance', label: 'performance', description: 'Latency, memory or start-up time drive cost or user experience. Pick it only when load or cost figures show it matters, and hold the stack to the numbers.' },
      ],
    },
    {
      key: 'UPGRADE', title: 'Version policy', label: 'Which versions of the runtime and framework may run?',
      hint: 'Unsupported versions get no security fixes; versions far behind make each upgrade a project.',
      default: 'lts',
      options: [
        { value: 'lts', label: 'supported LTS releases only', description: 'Only long-term-support releases, each new LTS adopted within 6 months. Pick it for business systems that value stability and upgrade a few times a year.' },
        { value: 'n1', label: 'the latest or the previous major', description: 'Never more than one major version behind the latest release, LTS or not. Pick it when the stack has no LTS for what you use (Go, most frameworks) or you want new features sooner.' },
        { value: 'latest', label: 'the latest release within 30 days', description: 'Each new release of the runtime and framework is adopted within 30 days. Pick it for small services with a strong test suite and automated updates.' },
      ],
    },
    {
      key: 'UPDATES', title: 'Dependency updates', label: 'How are dependencies kept up to date?',
      hint: 'Small, frequent updates are cheap; a year of updates at once is a migration.',
      default: 'renovate',
      options: [
        { value: 'renovate', label: 'Renovate pull requests', description: 'A bot opens update pull requests for libraries, the runtime version and base images, merging patches automatically on green tests. Pick it for any hosting (GitHub, GitLab, Bitbucket, Azure DevOps) and when you want grouping, schedules and runtime files covered.' },
        { value: 'dependabot', label: 'Dependabot pull requests', description: 'GitHub\'s built-in updates for libraries, Docker images and Actions. Pick it when the code is on GitHub and its simpler configuration is enough.' },
        { value: 'manual', label: 'a scheduled upgrade each quarter', description: 'A planned upgrade of everything once a quarter, checked by a drift report. Pick it only where bots are not allowed (air-gapped or regulated build environments).' },
      ],
    },
  ],
  details: [
    { key: 'EOL_DAYS', label: 'How many days before end of support must a version be replaced?', default: '180', number: true },
    { key: 'PATCH_DAYS', label: 'Within how many days must a high or critical vulnerability be patched?', default: '14', number: true },
    { key: 'P95_MS', label: 'What 95th-percentile response time must the element meet (ms)?', default: '200', number: true },
  ],
  need: {
    label: 'Built on something that lasts',
    text: 'The element has to be built on a runtime and framework the team can work in well, that have the libraries it needs, that perform well enough, and that keep receiving security fixes for as long as the element runs. The choice must be written down with its reasons, and keeping it current must be routine work, not a project every few years.',
  },
  forces: FORCES,
  requirements: [
    {
      id: 'req-one-stack', label: 'Built on the chosen stack', ears_type: 'ubiquitous',
      action: 'build the element on {{RUNTIME}}, using another runtime or main framework only after a new decision record supersedes this one',
      rationale: 'Each extra stack multiplies the skills, pipelines, base images and patching a team must keep up (Thoughtworks Technology Radar on polyglot sprawl; ISO 25010 maintainability).',
      scenario: { label: 'Other runtime refused', given: 'the element\'s build files and container images', when: 'a change brings a base image or build of another runtime', then: 'the policy check fails until a decision record allows it' },
    },
    {
      id: 'req-eol', label: 'Supported versions only', ears_type: 'ubiquitous',
      action: 'run only runtime, framework and base image versions under vendor support, replacing each at least {{EOL_DAYS}} days before its end of support',
      rationale: 'After end of support no security fixes come; the lead time leaves room to upgrade without a rush (endoflife.date; PCI DSS v4.0 6.3.3, OWASP Top 10 A06 Vulnerable and Outdated Components).',
      scenario: { label: 'End of support ahead', given: 'a runtime version whose end of support is less than {{EOL_DAYS}} days away', when: 'the version check runs', then: 'it fails naming the version and its end-of-support date' },
    },
    {
      id: 'req-patch', label: 'Vulnerabilities patched in time', ears_type: 'event-driven',
      trigger: 'a vulnerability rated high or critical (CVSS 7.0 or more) is published for the runtime, the framework or a dependency in use',
      action: 'deploy a fixed version to production within {{PATCH_DAYS}} days, or record a dated exception with the mitigation',
      rationale: 'Known vulnerabilities are exploited within days of publication; a deadline turns patching into routine (PCI DSS v4.0 6.3.3; CISA Known Exploited Vulnerabilities catalogue).',
      scenario: { label: 'Fix deployed in time', given: 'a dependency in use with a newly published critical vulnerability', when: '{{PATCH_DAYS}} days have passed', then: 'production runs a fixed version, or a dated exception with its mitigation is recorded' },
    },
    {
      id: 'req-lts', label: 'New LTS adopted', when: { UPGRADE: ['lts'] }, ears_type: 'event-driven',
      trigger: 'a new long-term-support release of the runtime or main framework is published',
      action: 'move the element to it within 6 months, and run no non-LTS release in production',
      rationale: 'Moving from one LTS to the next while the old one is supported keeps every upgrade one step long (endoflife.date support lifecycles).',
      scenario: { label: 'LTS upgrade on time', given: 'a new LTS release of the runtime', when: '6 months have passed since its release', then: 'the element runs on it in production' },
    },
    {
      id: 'req-n1', label: 'At most one major behind', when: { UPGRADE: ['n1'] }, ears_type: 'ubiquitous',
      action: 'run the latest or the previous major version of the runtime and the main framework, never older',
      rationale: 'Most projects support only the last one or two major versions (Go: the two latest releases); staying within them keeps fixes coming and upgrades short (endoflife.date).',
      scenario: { label: 'Two majors behind refused', given: 'a framework whose latest major is N', when: 'the element still runs on N-2', then: 'the version check fails' },
    },
    {
      id: 'req-latest', label: 'Latest release adopted', when: { UPGRADE: ['latest'] }, ears_type: 'event-driven',
      trigger: 'a new release of the runtime or main framework is published',
      action: 'move the element to it within 30 days',
      rationale: 'Small, frequent upgrades are cheaper than large rare ones, and new security hardening arrives sooner (Building Evolutionary Architectures, incremental change).',
      scenario: { label: 'Release adopted in 30 days', given: 'a new release of the main framework', when: '30 days have passed', then: 'the element runs on it in production' },
    },
    {
      id: 'req-update-prs', label: 'Updates arrive as pull requests', when: { UPDATES: ['renovate', 'dependabot'] }, ears_type: 'event-driven',
      trigger: 'a new version of a dependency, the runtime or a base image is published',
      action: 'open a pull request updating it within 7 days, merge patch updates automatically when the tests pass, and leave no update pull request open longer than 30 days',
      rationale: 'Updates that arrive one at a time with tests are cheap to take; automation keeps them from waiting for someone to remember (Renovate, Dependabot documentation).',
      scenario: { label: 'Update proposed and merged', given: 'a new patch version of a dependency', when: 'it is published', then: 'within 7 days a pull request updates it and merges itself once the tests pass' },
    },
    {
      id: 'req-quarterly', label: 'Quarterly upgrade', when: { UPDATES: ['manual'] }, ears_type: 'event-driven',
      trigger: 'a quarter ends',
      action: 'upgrade every dependency to its latest version, leaving 0 direct dependencies more than one major version behind',
      rationale: 'Without a bot, only a fixed rhythm keeps drift from growing into a migration (Building Evolutionary Architectures, dependency fitness functions).',
      scenario: { label: 'Drift cleared each quarter', given: 'the element\'s dependencies at the end of a quarter', when: 'the drift report runs', then: 'no direct dependency is more than one major version behind' },
    },
    {
      id: 'req-skills', label: 'Enough people know it', when: { CRITERION: ['skills'] }, ears_type: 'ubiquitous',
      action: 'keep at least two engineers in the owning team who have shipped production code on {{RUNTIME}} in the last 12 months',
      rationale: 'A stack chosen for the team\'s skills is only as safe as the number of people who have them (bus factor).',
      scenario: { label: 'Two people can ship', given: 'the owning team', when: 'its members are reviewed each quarter', then: 'at least two have merged production changes to the element in the last 12 months' },
    },
    {
      id: 'req-maintained', label: 'Dependencies are maintained', when: { CRITERION: ['ecosystem'] }, ears_type: 'event-driven',
      trigger: 'a change adds a direct dependency',
      action: 'accept it only when it had a release in the last 12 months and an OpenSSF Scorecard score of at least 5, or a reviewer records why it is still acceptable',
      rationale: 'An ecosystem is worth what its maintained libraries are worth; an abandoned dependency becomes your code to maintain (OpenSSF Scorecard: Maintained check).',
      scenario: { label: 'Abandoned library flagged', given: 'a pull request adding a library without a release for two years', when: 'the dependency review runs', then: 'it is flagged and cannot merge without a recorded reason' },
    },
    {
      id: 'req-latency', label: 'Meets the performance target', when: { CRITERION: ['performance'] }, ears_type: 'state-driven',
      precondition: 'the element runs at the expected peak load',
      action: 'answer 95% of requests within {{P95_MS}} ms, and start a new instance ready for traffic within 10 seconds',
      rationale: 'A stack chosen for performance has to be held to the numbers that justified it, or the reason is lost (ISO 25010 performance efficiency: time behaviour).',
      scenario: { label: 'Peak load within target', given: 'the element deployed in a production-like environment', when: 'a load test runs at the expected peak for 10 minutes', then: 'the 95th percentile stays within {{P95_MS}} ms and a new instance is ready within 10 seconds' },
    },
  ],
  adrs: [
    {
      id: 'adr-jvm', label: 'Built on the JVM', when: { RUNTIME: ['jvm'] },
      decision: 'The element runs on the JVM: Java (or Kotlin where the team prefers it) on the newest LTS JDK from a supported distribution (Eclipse Temurin, Amazon Corretto or Microsoft Build of OpenJDK), with Spring Boot as the framework, built with Gradle or Maven. Deciding factor: {{CRITERION}}. Versions: {{RUNTIME}} at {{UPGRADE}}; end of support tracked through endoflife.date (eclipse-temurin, spring-boot). Dependency updates: {{UPDATES}}. Choosing Java or Kotlin: Kotlin for null safety and concise domain code when the team knows it; Java when more people need to read it. Choosing Spring Boot or Quarkus: Spring Boot for the widest ecosystem; Quarkus (or Spring with GraalVM native image) when start-up time and memory matter, e.g. scale-to-zero.',
      consequences: '• The widest choice of enterprise libraries, drivers and SDKs, and many people who know it.\n• Higher memory use and slower start than Go or .NET native AOT, unless native images are used.\n• Spring Boot\'s major versions follow the JDK baseline; framework and JDK upgrades are planned together.\n• Long-lived LTS releases make the version policy easy to keep.',
      alternatives: '1. .NET: similar maturity and performance, a single vendor stack.\n2. Go: smaller and faster to start, fewer enterprise libraries.\n3. Node.js (TypeScript): one language with the front end, weaker for CPU-heavy work.',
    },
    {
      id: 'adr-dotnet', label: 'Built on .NET', when: { RUNTIME: ['dotnet'] },
      decision: 'The element runs on .NET with C#, on the newest LTS release, with ASP.NET Core (minimal APIs or controllers) and Entity Framework Core or Dapper for data access. Deciding factor: {{CRITERION}}. Versions: {{RUNTIME}} at {{UPGRADE}}; end of support tracked through endoflife.date (dotnet). Dependency updates: {{UPDATES}}. Choosing EF Core or Dapper: EF Core for domain models and migrations; Dapper where queries are hand-tuned. Native AOT only when start-up time matters and every library used supports trimming.',
      consequences: '• One coherent stack (language, web framework, ORM, test tooling) maintained by one vendor, with good performance.\n• LTS releases are supported for three years and come every two years, so the version policy needs an upgrade at least every two to three years.\n• Fewer open-source libraries than the JVM or Node.js for some niches.\n• Strong fit with Azure and Microsoft identity; runs equally on Linux containers.',
      alternatives: '1. The JVM with Spring Boot: the widest ecosystem.\n2. Go: smaller and simpler, fewer abstractions.\n3. Node.js (TypeScript): shares the language with the front end.',
    },
    {
      id: 'adr-node', label: 'Built on Node.js', when: { RUNTIME: ['node'] },
      decision: 'The element runs on Node.js, on an Active or Maintenance LTS release line (even-numbered majors), written in TypeScript in strict mode, with Fastify or NestJS as the framework (Express only for small services). Deciding factor: {{CRITERION}}. Versions: {{RUNTIME}} at {{UPGRADE}}; the version is pinned in .nvmrc and the base image, end of support tracked through endoflife.date (nodejs). Dependency updates: {{UPDATES}}; lockfile committed, installs with npm ci. Choosing Fastify or NestJS: Fastify for lean APIs and speed; NestJS when the team wants modules and dependency injection in a larger codebase.',
      consequences: '• One language across the front end and back end; types can be shared through generated contracts.\n• Very large package ecosystem, of very uneven quality: dependencies need review and updates more often than elsewhere.\n• Single-threaded event loop: excellent for I/O-bound APIs, poor for CPU-heavy work, which goes to worker threads or another service.\n• Each LTS line is supported for about 30 months, so expect a runtime upgrade at least every year or two.',
      alternatives: '1. Go: better for CPU-bound and high-throughput services, a separate language from the front end.\n2. The JVM or .NET: more structure and performance for large business domains.\n3. Deno or Bun: modern runtimes with built-in tooling, younger ecosystems and support policies.',
    },
    {
      id: 'adr-go', label: 'Built on Go', when: { RUNTIME: ['go'] },
      decision: 'The element is written in Go, on one of the two latest Go releases (the ones the Go team supports), using the standard library\'s net/http with a thin router (chi or the standard ServeMux) rather than a large framework, sqlc or pgx for data access, and distroless or scratch base images. Deciding factor: {{CRITERION}}. Versions: {{RUNTIME}} at {{UPGRADE}}; the toolchain is pinned in go.mod, end of support tracked through endoflife.date (go). Dependency updates: {{UPDATES}}; govulncheck runs in every build.',
      consequences: '• Small static binaries, start-up in milliseconds, low memory: cheap to run and to scale.\n• Each Go release is supported for about a year, so the toolchain is upgraded every six to twelve months; the Go 1 compatibility promise makes that routine.\n• Fewer high-level libraries (ORMs, enterprise SDKs); more code written by hand.\n• Simple language, fast to learn; less expressive for rich domain models.',
      alternatives: '1. The JVM or .NET: richer frameworks for large business domains, heavier to run.\n2. Rust: more control and safety, slower to write and to learn.\n3. Node.js (TypeScript): one language with the front end, weaker under CPU load.',
    },
    {
      id: 'adr-python', label: 'Built on Python', when: { RUNTIME: ['python'] },
      decision: 'The element is written in Python on a supported 3.x release (bugfix or security phase), with FastAPI (async APIs, Pydantic models) or Django (data-heavy apps with an admin), type-checked with mypy or pyright and linted with Ruff, dependencies locked with uv or Poetry. Deciding factor: {{CRITERION}}. Versions: {{RUNTIME}} at {{UPGRADE}}; the version is pinned in pyproject.toml and the base image, end of support tracked through endoflife.date (python, django). Dependency updates: {{UPDATES}}. Choosing FastAPI or Django: FastAPI for APIs and model serving; Django when the element owns a relational data model and needs an admin and its migrations.',
      consequences: '• Direct access to the data and machine-learning ecosystem (NumPy, pandas, PyTorch, scikit-learn).\n• Slower and more memory-hungry per request than the JVM, .NET or Go; CPU-heavy work goes to native libraries or worker processes.\n• Dynamic typing needs type checking in the build to keep a large codebase safe to change.\n• Each Python release is supported for five years; a new one every October.',
      alternatives: '1. Go or the JVM for the request-handling service, with Python only where models run.\n2. Node.js (TypeScript): faster for I/O-bound APIs, weaker data ecosystem.\n3. Notebooks deployed as services: quick, but neither testable nor maintainable.',
    },
  ],
  fitness: [
    {
      id: 'ff-eol', label: 'No version near end of support', category: 'operational', implements: RUNTIMES,
      threshold: '0 runtime, framework or base image versions within {{EOL_DAYS}} days of their end of support',
      description: 'A scheduled job and every build look up each version in use on endoflife.date and fail when its end of support is less than {{EOL_DAYS}} days away. The list of products and cycles is read from the build files (.nvmrc, go.mod, pom.xml, global.json, pyproject.toml) or kept next to them.',
      tool: 'endoflife.date API (curl and jq)',
      language: 'bash',
      snippet: `#!/usr/bin/env bash
# versions.txt: "<endoflife.date product> <cycle>", e.g. "nodejs 22", "spring-boot 3.5", "python 3.13"
set -euo pipefail
LIMIT=$(( $(date +%s) + EOL_DAYS * 86400 ))
fail=0
while read -r product cycle; do
  eol=$(curl -fsS "https://endoflife.date/api/\${product}/\${cycle}.json" | jq -r '.eol')
  [ "$eol" = "false" ] && continue
  if [ "$eol" = "true" ] || [ "$(date -d "$eol" +%s)" -lt "$LIMIT" ]; then
    echo "::error::$product $cycle reaches end of support on $eol"; fail=1
  fi
done < versions.txt
exit $fail`,
    },
    {
      id: 'ff-vulns', label: 'No unpatched high vulnerabilities', category: 'operational', implements: RUNTIMES,
      threshold: '0 high or critical vulnerabilities in the image or dependencies, except entries in .trivyignore whose expiry is at most {{PATCH_DAYS}} days after they were added',
      description: 'Trivy scans the built image (runtime, base image and application dependencies) in every build and nightly; a high or critical finding fails it. An exception is a .trivyignore line with an expiry date, so it fails again when the deadline passes.',
      tool: 'Trivy',
      language: 'yaml',
      snippet: `# .github/workflows/scan.yml (job step)
- uses: aquasecurity/trivy-action@0.28.0
  with:
    image-ref: \${{ env.IMAGE }}
    severity: HIGH,CRITICAL
    ignore-unfixed: true
    exit-code: '1'
    trivyignores: .trivyignore
# .trivyignore — every exception expires:
# CVE-2026-12345 exp:2026-11-05   # mitigated by WAF rule 42, fix pending upstream`,
    },
    {
      id: 'ff-base-image', label: 'Only the chosen runtime', category: 'structural', implements: RUNTIMES,
      threshold: '100% of Dockerfile stages start FROM an approved image of the chosen runtime',
      description: 'A policy over every Dockerfile fails the build when a stage starts from an image that is not on the approved list; keep only the images of the chosen runtime on it.',
      tool: 'Conftest (Open Policy Agent)',
      language: 'rego',
      snippet: `# policy/dockerfile.rego — conftest test Dockerfile
package main
import rego.v1

approved := {
  "eclipse-temurin", "mcr.microsoft.com/dotnet/aspnet", "node",
  "gcr.io/distroless/static-debian12", "python",
}

deny contains msg if {
  some instr in input
  instr.Cmd == "from"
  image := split(instr.Value[0], ":")[0]
  not approved[image]
  msg := sprintf("%s is not an approved base image (ADR Runtime stack)", [image])
}`,
    },
    {
      id: 'ff-renovate', label: 'Renovate keeps versions current', when: { UPDATES: ['renovate'] }, category: 'process', implements: RUNTIMES,
      threshold: 'Update pull requests opened within 7 days of a release; patches merged automatically on green tests; 0 update pull requests open over 30 days',
      description: 'Renovate updates libraries, the runtime version files and base images; patch and minor updates merge automatically when the tests pass, majors wait for review, and the dependency dashboard lists what is pending.',
      tool: 'Renovate',
      language: 'json',
      snippet: `{
  "$schema": "https://docs.renovatebot.com/renovate-schema.json",
  "extends": ["config:recommended", ":dependencyDashboard", "docker:pinDigests"],
  "schedule": ["before 6am on monday"],
  "minimumReleaseAge": "3 days",
  "vulnerabilityAlerts": { "schedule": ["at any time"], "labels": ["security"] },
  "packageRules": [
    { "matchUpdateTypes": ["patch", "minor"], "matchCurrentVersion": "!/^0/", "automerge": true },
    { "matchUpdateTypes": ["major"], "labels": ["major-update"] }
  ]
}`,
    },
    {
      id: 'ff-dependabot', label: 'Dependabot keeps versions current', when: { UPDATES: ['dependabot'] }, category: 'process', implements: RUNTIMES,
      threshold: 'Update pull requests opened weekly; patches merged automatically on green tests; 0 update pull requests open over 30 days',
      description: 'Dependabot opens weekly update pull requests for the application dependencies, the base image and the workflow actions; a workflow enables auto-merge for patch updates, which merge once the required checks pass.',
      tool: 'Dependabot',
      language: 'yaml',
      snippet: `# .github/dependabot.yml
version: 2
updates:
  - package-ecosystem: npm          # maven, gradle, nuget, gomod, pip, uv...
    directory: /
    schedule: { interval: weekly }
    groups:
      minor-and-patch: { update-types: [minor, patch] }
  - package-ecosystem: docker
    directory: /
    schedule: { interval: weekly }
  - package-ecosystem: github-actions
    directory: /
    schedule: { interval: weekly }
# auto-merge: a workflow with dependabot/fetch-metadata@v2 runs
#   gh pr merge --auto --squash "$PR_URL"  when update-type is semver-patch`,
    },
    {
      id: 'ff-drift', label: 'Dependency drift report', when: { UPDATES: ['manual'] }, category: 'process', implements: RUNTIMES,
      threshold: '0 direct dependencies more than one major version behind at the end of each quarter',
      description: 'A scheduled job lists outdated direct dependencies and fails when any is more than one major version behind its latest release. On the JVM, the versions-maven-plugin (display-dependency-updates) or the Gradle versions plugin gives the same list.',
      tool: 'npm outdated with jq',
      language: 'bash',
      snippet: `#!/usr/bin/env bash
# fails when a direct dependency is two or more majors behind
behind=$(npm outdated --json | jq -r '
  to_entries[]
  | select(.value.current != null)
  | select((.value.latest | split(".")[0] | tonumber) - (.value.current | split(".")[0] | tonumber) >= 2)
  | "\\(.key) \\(.value.current) -> \\(.value.latest)"')
[ -z "$behind" ] || { echo "More than one major behind:"; echo "$behind"; exit 1; }`,
    },
    {
      id: 'ff-dep-review', label: 'New dependencies reviewed', when: { CRITERION: ['ecosystem'] }, category: 'process', implements: RUNTIMES,
      threshold: 'Every new direct dependency shows its OpenSSF Scorecard in the pull request; scores below 5 and high-severity advisories fail the check',
      description: 'GitHub\'s dependency review action runs on every pull request that changes a manifest: it fails on known vulnerable versions and shows each new dependency\'s OpenSSF Scorecard, warning below the level set.',
      tool: 'GitHub dependency-review-action with OpenSSF Scorecard',
      language: 'yaml',
      snippet: `# .github/workflows/dependency-review.yml
name: dependency review
on: [pull_request]
jobs:
  review:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/dependency-review-action@v4
        with:
          fail-on-severity: high
          show-openssf-scorecard: true
          warn-on-openssf-scorecard-level: 5`,
    },
    {
      id: 'ff-load', label: 'Performance target holds', when: { CRITERION: ['performance'] }, category: 'operational', implements: RUNTIMES,
      threshold: '95th percentile below {{P95_MS}} ms and under 1% errors at the expected peak load, on every release candidate',
      description: 'A k6 load test runs against a production-like environment for each release candidate; its thresholds fail the run when the 95th percentile or the error rate exceeds the target.',
      tool: 'Grafana k6',
      language: 'js',
      snippet: `import http from 'k6/http'
import { check } from 'k6'

export const options = {
  scenarios: {
    peak: { executor: 'constant-arrival-rate', rate: 200, timeUnit: '1s', duration: '10m', preAllocatedVUs: 100 },
  },
  thresholds: {
    http_req_duration: ['p(95)<200'],   // P95_MS
    http_req_failed: ['rate<0.01'],
  },
}

export default function () {
  const res = http.get(\`\${__ENV.BASE_URL}/orders?page=1\`)
  check(res, { 'status is 200': (r) => r.status === 200 })
}`,
    },
  ],
}

export default pack
