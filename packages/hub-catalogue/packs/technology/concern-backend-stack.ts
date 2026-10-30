import type { FitnessSpec, PackSpec } from '../../src/packSpec'

const RUNTIMES = ['adr-jvm', 'adr-dotnet', 'adr-node', 'adr-go', 'adr-python']
const FORCES = 'This element is a server-side service, and the runtime, language and main framework it is written in will outlive most of the people who chose them. The forces: the team\'s skills decide how fast and how safely it can work, and hiring follows the choice; the ecosystem decides which libraries, drivers and SDKs exist and are maintained; runtimes and frameworks reach end of support on published dates, after which security fixes stop; performance (memory, start-up time) matters where load or cost is high and rarely elsewhere; every dependency added is code someone else maintains, at their pace; and upgrades put off for years turn into rewrites.'
const ELSEWHERE = 'Dependency updates: as decided in the Dependency hygiene pack. Vulnerable dependencies: as decided in the Software supply chain pack. Latency and load: as decided in the Capacity and scaling pack.'

/** The manifests every runtime but one leaves behind; the chosen runtime's own are taken out. */
const MANIFESTS: Record<string, string[]> = {
  jvm: ['*pom.xml', '*build.gradle*'],
  dotnet: ['*.csproj'],
  node: ['*package.json'],
  go: ['*go.mod'],
  python: ['*pyproject.toml', '*requirements.txt'],
}

/** One "only this runtime" check per runtime: the final stage of every Dockerfile and the build manifests. */
function onlyRuntime(value: string, adr: string, name: string, image: string, approved: string): FitnessSpec {
  const foreign = Object.entries(MANIFESTS).filter(([k]) => k !== value).flatMap(([, globs]) => globs)
  return {
    id: `ff-only-${value}`, label: `Only ${name}`, when: { RUNTIME: [value] }, characteristic: 'maintainability', scope: 'atomic', cadence: 'triggered', trigger: 'pull-request', invocation: 'automated', implements: [adr], checks: ['req-one-stack'],
    threshold: `100% of Dockerfiles end in a stage FROM a ${image} image; 0 build manifests of another runtime outside .stack-exceptions`,
    description: `A job in every build reads the final stage of each Dockerfile (a stage alias is resolved to its image) and lists the build manifests in the repository; it fails on a final image that is not a ${image} image or on a manifest of another runtime (${foreign.join(', ')}). A manifest a decision record allows is listed in .stack-exceptions with that record's id. Runs on Linux (git, awk, GNU grep).`,
    tool: 'git with awk and grep (CI job)',
    language: 'bash',
    snippet: `#!/usr/bin/env bash
# Only ${name}: the final-stage base images and the build manifests of the repository
set -euo pipefail
APPROVED='^(${approved})(:|@|$)'
FOREIGN=(${foreign.map((g) => `'${g}'`).join(' ')})
fail=0
for df in $(git ls-files -- '*Dockerfile*'); do
  final=$(awk 'toupper($1)=="FROM" { img=""; for (i=2;i<=NF;i++) if ($i !~ /^--/) { img=$i; break }
                                    if (img in alias) img=alias[img]
                                    for (i=2;i<=NF;i++) if (toupper($i)=="AS") alias[$(i+1)]=img
                                    final=img } END { print final }' "$df")
  [[ "$final" =~ $APPROVED ]] || { echo "::error file=$df::final stage FROM $final is not a ${image} image (ADR Built on ${name})"; fail=1; }
done
foreign=$(git ls-files -- "\${FOREIGN[@]}" | grep -vxFf <(cat .stack-exceptions 2>/dev/null) || true)
[ -z "$foreign" ] || { echo "::error::build manifests of another runtime: $(tr '\\n' ' ' <<<"$foreign")"; fail=1; }
exit $fail`,
  }
}

/** The versions.txt loop every endoflife.date check shares. */
const VERSIONS_HEADER = `#!/usr/bin/env bash
# versions.txt: "<endoflife.date product> <cycle>" per line, e.g. "nodejs 24", "spring-boot 3.5", "python 3.13"
# runs on Linux (GNU date); curl and jq
set -euo pipefail
fail=0
while read -r product cycle; do`

const pack: PackSpec = {
  id: 'concern-backend-stack',
  name: 'Backend stack',
  group: 'technology',
  description: 'The language, runtime and framework a server-side service is built on, why, the version policy that keeps it on supported releases, and the footprint it is held to when performance decides.',
  tags: ['technology', 'backend', 'runtime', 'language', 'framework', 'end of life', 'version policy', 'footprint'],
  concern: {
    id: 'backend-stack',
    trigger: 'LIST NODES WHERE type = "container" AND external != true',
    why: 'these are server-side services, so what they are built on and how they are kept on supported versions has to be decided.',
  },
  sources: [
    { title: 'endoflife.date: end-of-life dates and support lifecycles', url: 'https://endoflife.date/' },
    { title: 'Thoughtworks Technology Radar', url: 'https://www.thoughtworks.com/radar' },
    { title: 'ISO/IEC 25010, Maintainability, Flexibility and Performance efficiency', url: 'https://iso25000.com/index.php/en/iso-25000-standards/iso-25010' },
    { title: 'OpenSSF Scorecard', url: 'https://github.com/ossf/scorecard' },
    { title: 'deps.dev API v3 (Open Source Insights)', url: 'https://docs.deps.dev/api/v3/' },
    { title: 'OWASP Top 10 2021, A06 Vulnerable and Outdated Components', url: 'https://owasp.org/Top10/A06_2021-Vulnerable_and_Outdated_Components/' },
    { title: 'Ford, Parsons, Kua, Sadalage: Building Evolutionary Architectures, 2nd ed.', url: 'https://www.oreilly.com/library/view/building-evolutionary-architectures/9781492097532/' },
  ],
  questions: [
    {
      key: 'RUNTIME', title: 'Runtime', label: 'What is the service built on?',
      hint: 'The runtime brings the language, the framework, the libraries and the people who can work on it. Changing it later means rewriting the service.',
      default: 'jvm',
      options: [
        { value: 'jvm', label: 'the JVM (Java or Kotlin, Spring Boot)', description: 'Mature, fast after warm-up, the widest choice of enterprise libraries and drivers. Pick it for long-lived business services, when the team knows Java or Kotlin, or integrations need JVM-only SDKs.' },
        { value: 'dotnet', label: '.NET (C#, ASP.NET Core)', description: 'Fast, one vendor-backed stack from language to web framework and ORM. Pick it when the team knows C#, the organisation runs Microsoft tooling or Azure, or desktop and server share code.' },
        { value: 'node', label: 'Node.js (TypeScript, NestJS or Fastify)', description: 'One language with the web front end, quick to start, very large package ecosystem. Pick it for web back ends, BFFs and I/O-bound APIs, when the team writes TypeScript in the front end too.' },
        { value: 'go', label: 'Go', description: 'Small static binaries, fast start-up, low memory, simple concurrency. Pick it for infrastructure-like services, high-throughput network services and CLIs, when a small standard library is enough. Go has no LTS releases: not with the LTS-only version policy.' },
        { value: 'python', label: 'Python (FastAPI or Django)', description: 'The data and machine-learning ecosystem, quick to write. Pick it when the service serves models or data pipelines, or the team are data people; CPU-heavy request handling is not its strength. Python has no LTS releases: not with the LTS-only version policy.' },
      ],
    },
    {
      key: 'CRITERION', title: 'Deciding factor', label: 'What weighs most in the choice?',
      hint: 'Every stack can do most things; the criterion that decides adds the requirement that keeps the choice honest.',
      default: 'skills',
      options: [
        { value: 'skills', label: 'the team\'s skills', description: 'The team already knows the stack well. Pick it in most cases: a known stack is faster and safer than a better one nobody knows.' },
        { value: 'ecosystem', label: 'the ecosystem', description: 'The libraries, SDKs and drivers the service needs exist and are maintained in this stack. Pick it when integrations (a payment SDK, a data or ML library) decide what is practical.' },
        { value: 'performance', label: 'performance', description: 'Memory and start-up time drive cost or scaling. Pick it only when load or cost figures show it matters, and hold the stack to the footprint numbers asked below.' },
      ],
    },
    {
      key: 'UPGRADE', title: 'Version policy', label: 'Which versions of the runtime and framework may run?',
      hint: 'Unsupported versions get no security fixes; versions far behind make each upgrade a project. Go and Python have no LTS releases: with them, pick the latest or the previous major.',
      default: 'lts',
      options: [
        { value: 'lts', label: 'supported LTS releases only', description: 'Only long-term-support releases, each new LTS adopted within 6 months. Pick it for business systems that value stability and upgrade a few times a year. Not with Go or Python, which have no LTS releases.' },
        { value: 'n1', label: 'the latest or the previous major', description: 'Never more than one release cycle behind the latest, LTS or not. Pick it when the stack has no LTS for what you use (Go, Python, most frameworks) or you want new features sooner.' },
        { value: 'latest', label: 'the latest release within 30 days', description: 'Each new release cycle of the runtime and framework is adopted within 30 days. Pick it for small services with a strong test suite and automated updates.' },
      ],
    },
  ],
  details: [
    { key: 'EOL_DAYS', label: 'How many days before end of support must a version be replaced?', default: '180', number: true },
    { key: 'MEMORY_MB', label: 'How much memory may one instance use at peak (MB)? Held to when performance is the deciding factor', default: '512', number: true },
    { key: 'STARTUP_SECONDS', label: 'Within how many seconds must a new instance be ready for traffic? Held to when performance is the deciding factor', default: '10', number: true },
  ],
  need: {
    label: 'Services built to last',
    text: 'The service has to be built on a language, runtime and framework the team can work in well, that have the libraries it needs, that fit the footprint the hosting pays for, and that keep receiving security fixes for as long as the service runs. The choice must be written down with its reasons, and keeping it current must be routine work, not a project every few years. The checks assume one service per repository, with its Dockerfile and build manifest at the root, a versions.txt listing the endoflife.date products and cycles in use, and team.txt with the owning team\'s e-mail addresses next to CODEOWNERS.',
  },
  forces: FORCES,
  requirements: [
    {
      id: 'req-one-stack', label: 'Built on the chosen stack', ears_type: 'ubiquitous',
      action: 'build the service on {{RUNTIME}}, using another runtime or main framework only after a new decision record supersedes this one',
      rationale: 'Each extra stack multiplies the skills, pipelines, base images and patching a team must keep up (Thoughtworks Technology Radar on polyglot sprawl; ISO 25010 maintainability).',
      scenario: { label: 'Other runtime refused', given: 'the service\'s build files and container images', when: 'a change brings a base image or a build manifest of another runtime', then: 'the stack check fails until the manifest is listed in .stack-exceptions with the decision record that allows it' },
    },
    {
      id: 'req-eol', label: 'Supported versions only', ears_type: 'ubiquitous',
      action: 'run only runtime, framework and base image versions under vendor support, replacing each at least {{EOL_DAYS}} days before its end of support',
      rationale: 'After end of support no security fixes come; the lead time leaves room to upgrade without a rush (endoflife.date; OWASP Top 10 A06 Vulnerable and Outdated Components).',
      scenario: { label: 'End of support ahead', given: 'a runtime version whose end of support is less than {{EOL_DAYS}} days away', when: 'the version check runs', then: 'it fails naming the version and its end-of-support date' },
    },
    {
      id: 'req-lts', label: 'New LTS adopted', when: { UPGRADE: ['lts'] }, ears_type: 'event-driven',
      trigger: 'a new long-term-support release of the runtime or main framework is published',
      action: 'move the service to it within 6 months, and run no non-LTS release in production',
      rationale: 'Moving from one LTS to the next while the old one is supported keeps every upgrade one step long (endoflife.date support lifecycles).',
      scenario: { label: 'LTS upgrade on time', given: 'a new LTS release of the runtime', when: '6 months have passed since its release', then: 'the service runs on it in production, and the version check fails otherwise' },
    },
    {
      id: 'req-n1', label: 'At most one release behind', when: { UPGRADE: ['n1'] }, ears_type: 'ubiquitous',
      action: 'run the latest or the previous release cycle of the runtime and the main framework, never older',
      rationale: 'Most projects support only the last one or two release cycles (Go: the two latest releases); staying within them keeps fixes coming and upgrades short (endoflife.date).',
      scenario: { label: 'Two releases behind refused', given: 'a framework whose latest release cycle is N', when: 'the service still runs on N-2', then: 'the version check fails' },
    },
    {
      id: 'req-latest', label: 'Latest release adopted', when: { UPGRADE: ['latest'] }, ears_type: 'event-driven',
      trigger: 'a new release cycle of the runtime or main framework is published',
      action: 'move the service to it within 30 days',
      rationale: 'Small, frequent upgrades are cheaper than large rare ones, and new security hardening arrives sooner (Building Evolutionary Architectures, incremental change).',
      scenario: { label: 'Release adopted in 30 days', given: 'a new release cycle of the main framework', when: '30 days have passed', then: 'the service runs on it in production, and the version check fails otherwise' },
    },
    {
      id: 'req-skills', label: 'Enough people know it', when: { CRITERION: ['skills'] }, ears_type: 'ubiquitous',
      action: 'keep at least two engineers in the owning team who have merged production changes to the service on {{RUNTIME}} in the last 12 months',
      rationale: 'A stack chosen for the team\'s skills is only as safe as the number of people who have them (bus factor).',
      scenario: { label: 'Two people can ship', given: 'the owning team\'s members and the service\'s history', when: 'the authors of the last 12 months are counted', then: 'at least two members of the team merged production changes to the service' },
    },
    {
      id: 'req-maintained', label: 'Dependencies are maintained', when: { CRITERION: ['ecosystem'] }, ears_type: 'event-driven',
      trigger: 'a change adds a direct dependency',
      action: 'accept it only when it had a release in the last 12 months and an OpenSSF Scorecard score of at least 5, or a reviewer records why it is still acceptable',
      rationale: 'An ecosystem is worth what its maintained libraries are worth; an abandoned dependency becomes your code to maintain (OpenSSF Scorecard: Maintained check; deps.dev).',
      scenario: { label: 'Abandoned library flagged', given: 'a pull request adding a library without a release for two years', when: 'the dependency check runs', then: 'it fails and the pull request cannot merge without the dependency-exception label and the reviewer\'s reason' },
    },
    {
      id: 'req-footprint', label: 'Small and quick to start', when: { CRITERION: ['performance'] }, ears_type: 'state-driven',
      precondition: 'the service runs under the load test decided in the Capacity and scaling pack',
      action: 'use at most {{MEMORY_MB}} MB of memory per instance, and have a new instance ready for traffic within {{STARTUP_SECONDS}} seconds of its start',
      rationale: 'A stack chosen for performance has to be held to the numbers that justified it: memory sets the cost per instance, start-up time how fast it scales out (ISO 25010 performance efficiency: resource utilisation).',
      scenario: { label: 'Instance stays within footprint', given: 'a release candidate\'s image', when: 'one instance is started under a {{MEMORY_MB}} MB limit and the load test runs against it', then: 'it is ready within {{STARTUP_SECONDS}} seconds, is not killed for memory, and its peak memory stays under {{MEMORY_MB}} MB' },
    },
  ],
  adrs: [
    {
      id: 'adr-jvm', label: 'Built on the JVM', when: { RUNTIME: ['jvm'] },
      decision: `The service runs on the JVM: Java (or Kotlin where the team prefers it) on a JDK release the version policy allows, from a supported distribution (Eclipse Temurin, Amazon Corretto or Microsoft Build of OpenJDK), with Spring Boot as the framework, built with Gradle or Maven. Deciding factor: {{CRITERION}}. Version policy: {{UPGRADE}}; each version replaced at least {{EOL_DAYS}} days before its end of support, tracked through endoflife.date (eclipse-temurin, spring-boot). Footprint budget, held to when performance decides: at most {{MEMORY_MB}} MB per instance at peak, ready within {{STARTUP_SECONDS}} seconds. ${ELSEWHERE} Choosing Java or Kotlin: Kotlin for null safety and concise domain code when the team knows it; Java when more people need to read it. Choosing Spring Boot or Quarkus: Spring Boot for the widest ecosystem; Quarkus (or Spring with GraalVM native image) when start-up time and memory matter, e.g. scale-to-zero.`,
      consequences: '• The widest choice of enterprise libraries, drivers and SDKs, and many people who know it.\n• Higher memory use and slower start than Go or .NET native AOT, unless native images are used.\n• Spring Boot\'s major versions follow the JDK baseline; framework and JDK upgrades are planned together.\n• A new JDK every six months and an LTS every two years: the version policy sets whether that is one upgrade a year or one every two.',
      alternatives: '1. .NET: similar maturity and performance, a single vendor stack.\n2. Go: smaller and faster to start, fewer enterprise libraries.\n3. Node.js (TypeScript): one language with the front end, weaker for CPU-heavy work.',
    },
    {
      id: 'adr-dotnet', label: 'Built on .NET', when: { RUNTIME: ['dotnet'] },
      decision: `The service runs on .NET with C#, on a release the version policy allows (an LTS every two years, supported three years; an STS in between, supported two), with ASP.NET Core (minimal APIs or controllers) and Entity Framework Core or Dapper for data access. Deciding factor: {{CRITERION}}. Version policy: {{UPGRADE}}; each version replaced at least {{EOL_DAYS}} days before its end of support, tracked through endoflife.date (dotnet). Footprint budget, held to when performance decides: at most {{MEMORY_MB}} MB per instance at peak, ready within {{STARTUP_SECONDS}} seconds. ${ELSEWHERE} Choosing EF Core or Dapper: EF Core for domain models and migrations; Dapper where queries are hand-tuned. Native AOT only when start-up time matters and every library used supports trimming.`,
      consequences: '• One coherent stack (language, web framework, ORM, test tooling) maintained by one vendor, with good performance.\n• A release every November: the version policy decides whether every one is adopted or only the LTS ones, every two years.\n• Fewer open-source libraries than the JVM or Node.js for some niches.\n• Strong fit with Azure and Microsoft identity; runs equally on Linux containers.',
      alternatives: '1. The JVM with Spring Boot: the widest ecosystem.\n2. Go: smaller and simpler, fewer abstractions.\n3. Node.js (TypeScript): shares the language with the front end.',
    },
    {
      id: 'adr-node', label: 'Built on Node.js', when: { RUNTIME: ['node'] },
      decision: `The service runs on Node.js, on a release line the version policy allows (the even-numbered majors become LTS lines), written in TypeScript in strict mode, with Fastify or NestJS as the framework (Express only for small services). Deciding factor: {{CRITERION}}. Version policy: {{UPGRADE}}; the version is pinned in .nvmrc and the base image, replaced at least {{EOL_DAYS}} days before its end of support, tracked through endoflife.date (nodejs). Footprint budget, held to when performance decides: at most {{MEMORY_MB}} MB per instance at peak, ready within {{STARTUP_SECONDS}} seconds. ${ELSEWHERE} Choosing Fastify or NestJS: Fastify for lean APIs and speed; NestJS when the team wants modules and dependency injection in a larger codebase.`,
      consequences: '• One language across the front end and back end; types can be shared through generated contracts.\n• Very large package ecosystem, of very uneven quality: dependencies need review and updates more often than elsewhere.\n• Single-threaded event loop: excellent for I/O-bound APIs, poor for CPU-heavy work, which goes to worker threads or another service.\n• A new major every six months and an LTS line every year, each supported about 30 months: the version policy sets the upgrade rhythm.',
      alternatives: '1. Go: better for CPU-bound and high-throughput services, a separate language from the front end.\n2. The JVM or .NET: more structure and performance for large business domains.\n3. Deno or Bun: modern runtimes with built-in tooling, younger ecosystems and support policies.',
    },
    {
      id: 'adr-go', label: 'Built on Go', when: { RUNTIME: ['go'] },
      decision: `The service is written in Go, on a release the version policy allows (the Go team supports the two latest releases), using the standard library's net/http with a thin router (chi or the standard ServeMux) rather than a large framework, sqlc or pgx for data access, and distroless or scratch base images. Deciding factor: {{CRITERION}}. Version policy: {{UPGRADE}}; the toolchain is pinned in go.mod, replaced at least {{EOL_DAYS}} days before its end of support, tracked through endoflife.date (go). Footprint budget, held to when performance decides: at most {{MEMORY_MB}} MB per instance at peak, ready within {{STARTUP_SECONDS}} seconds. ${ELSEWHERE}`,
      consequences: '• Small static binaries, start-up in milliseconds, low memory: cheap to run and to scale.\n• Each Go release is supported for about a year, so the toolchain is upgraded every six to twelve months; the Go 1 compatibility promise makes that routine.\n• Fewer high-level libraries (ORMs, enterprise SDKs); more code written by hand.\n• Simple language, fast to learn; less expressive for rich domain models.',
      alternatives: '1. The JVM or .NET: richer frameworks for large business domains, heavier to run.\n2. Rust: more control and safety, slower to write and to learn.\n3. Node.js (TypeScript): one language with the front end, weaker under CPU load.',
    },
    {
      id: 'adr-python', label: 'Built on Python', when: { RUNTIME: ['python'] },
      decision: `The service is written in Python on a 3.x release the version policy allows (each supported five years, a new one every October), with FastAPI (async APIs, Pydantic models) or Django (data-heavy apps with an admin), type-checked with mypy or pyright and linted with Ruff, dependencies locked with uv or Poetry. Deciding factor: {{CRITERION}}. Version policy: {{UPGRADE}}; the version is pinned in pyproject.toml and the base image, replaced at least {{EOL_DAYS}} days before its end of support, tracked through endoflife.date (python, django). Footprint budget, held to when performance decides: at most {{MEMORY_MB}} MB per instance at peak, ready within {{STARTUP_SECONDS}} seconds. ${ELSEWHERE} Choosing FastAPI or Django: FastAPI for APIs and model serving; Django when the service owns a relational data model and needs an admin and its migrations.`,
      consequences: '• Direct access to the data and machine-learning ecosystem (NumPy, pandas, PyTorch, scikit-learn).\n• Slower and more memory-hungry per request than the JVM, .NET or Go; CPU-heavy work goes to native libraries or worker processes.\n• Dynamic typing needs type checking in the build to keep a large codebase safe to change.\n• A new release every October, each supported five years: the version policy sets how many are skipped.',
      alternatives: '1. Go or the JVM for the request-handling service, with Python only where models run.\n2. Node.js (TypeScript): faster for I/O-bound APIs, weaker data ecosystem.\n3. Notebooks deployed as services: quick, but neither testable nor maintainable.',
    },
  ],
  fitness: [
    onlyRuntime('jvm', 'adr-jvm', 'the JVM', 'JVM', 'eclipse-temurin|amazoncorretto|mcr\\.microsoft\\.com/openjdk/jdk|gcr\\.io/distroless/java[0-9]*(-debian[0-9]+)?'),
    onlyRuntime('dotnet', 'adr-dotnet', '.NET', '.NET', 'mcr\\.microsoft\\.com/dotnet/(aspnet|runtime|runtime-deps)'),
    onlyRuntime('node', 'adr-node', 'Node.js', 'Node.js', 'node|cgr\\.dev/chainguard/node|gcr\\.io/distroless/nodejs[0-9]*(-debian[0-9]+)?'),
    onlyRuntime('go', 'adr-go', 'Go', 'Go', 'scratch|gcr\\.io/distroless/(static|base)(-debian[0-9]+)?|cgr\\.dev/chainguard/static|alpine'),
    onlyRuntime('python', 'adr-python', 'Python', 'Python', 'python|cgr\\.dev/chainguard/python|gcr\\.io/distroless/python3(-debian[0-9]+)?'),
    {
      id: 'ff-eol', label: 'No version near end of support', characteristic: 'maintainability', scope: 'atomic', cadence: 'triggered', trigger: 'nightly', invocation: 'automated', implements: RUNTIMES, checks: ['req-eol'],
      threshold: '0 runtime, framework or base image versions within {{EOL_DAYS}} days of their end of support',
      description: 'A scheduled job and every build look up each product and cycle listed in versions.txt on endoflife.date and fail when its end of support is less than {{EOL_DAYS}} days away. versions.txt is kept next to the build files and changed in the same pull request as .nvmrc, go.mod, pom.xml, global.json or pyproject.toml. Runs on Linux (GNU date).',
      tool: 'endoflife.date API (curl and jq)',
      language: 'bash',
      snippet: `${VERSIONS_HEADER}
  eol=$(curl -fsS "https://endoflife.date/api/\${product}/\${cycle}.json" | jq -r '.eol')
  [ "$eol" = "false" ] && continue
  if [ "$eol" = "true" ] || [ "$(date -d "$eol" +%s)" -lt $(( $(date +%s) + {{EOL_DAYS}} * 86400 )) ]; then
    echo "::error::$product $cycle reaches end of support on $eol"; fail=1
  fi
done < versions.txt
exit $fail`,
    },
    {
      id: 'ff-upgrade-lts', label: 'On a current LTS', when: { UPGRADE: ['lts'] }, characteristic: 'maintainability', scope: 'atomic', cadence: 'triggered', trigger: 'nightly', invocation: 'automated', implements: RUNTIMES, checks: ['req-lts'],
      threshold: 'Every cycle in versions.txt is an LTS cycle, and is the newest LTS cycle unless that one was released less than 180 days ago',
      description: 'A scheduled job reads every product\'s cycles from endoflife.date: the cycle in use must be marked LTS (already, not from a future date), and the newest LTS cycle must be the one in use or younger than six months. Go and Python have no LTS cycles, so the check fails for them: pick another version policy. Runs on Linux (GNU date).',
      tool: 'endoflife.date API (curl and jq)',
      language: 'bash',
      snippet: `${VERSIONS_HEADER}
  all=$(curl -fsS "https://endoflife.date/api/\${product}.json")
  today=$(date +%F)
  jq -e --arg c "$cycle" --arg today "$today" \\
    '.[] | select((.cycle|tostring) == $c) | .lts == true or ((.lts|type) == "string" and .lts <= $today)' <<<"$all" >/dev/null \\
    || { echo "::error::$product $cycle is not an LTS cycle"; fail=1; continue; }
  read -r newest released < <(jq -r --arg today "$today" \\
    '[.[] | select(.lts == true or ((.lts|type) == "string" and .lts <= $today))][0] | "\\(.cycle) \\(.releaseDate)"' <<<"$all")
  if [ "$newest" != "$cycle" ] && [ "$(date -d "$released" +%s)" -lt "$(date -d '180 days ago' +%s)" ]; then
    echo "::error::$product $cycle: LTS $newest has been out since $released (6 months allowed)"; fail=1
  fi
done < versions.txt
exit $fail`,
    },
    {
      id: 'ff-upgrade-n1', label: 'At most one cycle behind', when: { UPGRADE: ['n1'] }, characteristic: 'maintainability', scope: 'atomic', cadence: 'triggered', trigger: 'nightly', invocation: 'automated', implements: RUNTIMES, checks: ['req-n1'],
      threshold: 'Every cycle in versions.txt is the newest or the second-newest cycle endoflife.date lists for its product',
      description: 'A scheduled job reads every product\'s cycles from endoflife.date (newest first) and fails when the cycle in use is not among the first two.',
      tool: 'endoflife.date API (curl and jq)',
      language: 'bash',
      snippet: `${VERSIONS_HEADER}
  idx=$(curl -fsS "https://endoflife.date/api/\${product}.json" | jq --arg c "$cycle" 'map(.cycle|tostring) | index($c)')
  if [ "$idx" = null ] || [ "$idx" -gt 1 ]; then
    echo "::error::$product $cycle is more than one release cycle behind the latest"; fail=1
  fi
done < versions.txt
exit $fail`,
    },
    {
      id: 'ff-upgrade-latest', label: 'On the latest cycle', when: { UPGRADE: ['latest'] }, characteristic: 'maintainability', scope: 'atomic', cadence: 'triggered', trigger: 'nightly', invocation: 'automated', implements: RUNTIMES, checks: ['req-latest'],
      threshold: 'Every cycle in versions.txt is the newest cycle endoflife.date lists for its product, unless that one was released less than 30 days ago',
      description: 'A scheduled job reads every product\'s newest cycle and its release date from endoflife.date and fails when the cycle in use is older and the newest has been out for 30 days or more. Runs on Linux (GNU date).',
      tool: 'endoflife.date API (curl and jq)',
      language: 'bash',
      snippet: `${VERSIONS_HEADER}
  read -r newest released < <(curl -fsS "https://endoflife.date/api/\${product}.json" | jq -r '.[0] | "\\(.cycle) \\(.releaseDate)"')
  if [ "$newest" != "$cycle" ] && [ "$(date -d "$released" +%s)" -lt "$(date -d '30 days ago' +%s)" ]; then
    echo "::error::$product $cycle: $newest released on $released (30 days allowed)"; fail=1
  fi
done < versions.txt
exit $fail`,
    },
    {
      id: 'ff-skills', label: 'Two of the team ship', when: { CRITERION: ['skills'] }, characteristic: 'maintainability', scope: 'atomic', cadence: 'triggered', trigger: 'weekly', invocation: 'automated', implements: RUNTIMES, checks: ['req-skills'],
      threshold: 'At least 2 members of the owning team (team.txt) authored non-merge commits to the service in the last 12 months',
      description: 'A scheduled job counts the distinct authors of the last 12 months of commits on the service\'s path and keeps those whose e-mail address is in team.txt, the owning team\'s list kept next to CODEOWNERS; fewer than two fails. Needs the full history (fetch-depth 0).',
      tool: 'git log (scheduled job)',
      language: 'bash',
      snippet: `#!/usr/bin/env bash
# team.txt: one e-mail address of the owning team per line, kept next to CODEOWNERS
set -euo pipefail
n=$(git log --since='12 months ago' --no-merges --format=%ae -- . | sort -u | grep -cxFf team.txt || true)
[ "$n" -ge 2 ] || { echo "::error::only $n of the owning team merged a change to the service in 12 months (2 needed)"; exit 1; }`,
    },
    {
      id: 'ff-dep-review', label: 'New dependencies maintained', when: { CRITERION: ['ecosystem'] }, characteristic: 'maintainability', scope: 'atomic', cadence: 'triggered', trigger: 'pull-request', invocation: 'automated', implements: RUNTIMES, checks: ['req-maintained'],
      threshold: 'Every direct dependency a pull request adds had a release within 365 days and has an OpenSSF Scorecard of at least 5, or the pull request carries the label dependency-exception',
      description: 'The pipeline runs the script for each direct dependency the pull request adds to the manifest (name from the manifest diff): deps.dev gives the package\'s newest publication date and its source repository\'s Scorecard, for npm, PyPI, Maven, Go and NuGet alike. A failing dependency passes only with the label dependency-exception, which the reviewer adds with the reason in the review. Runs on Linux (GNU date).',
      tool: 'deps.dev API (curl and jq) with the GitHub CLI',
      language: 'bash',
      snippet: `#!/usr/bin/env bash
# check-dependency.sh <system> <package>: system is npm, pypi, maven (group:artifact), go or nuget
set -euo pipefail
system=$1; name=$(jq -rn --arg n "$2" '$n | @uri')
pkg=$(curl -fsS "https://api.deps.dev/v3/systems/\${system}/packages/\${name}")
newest=$(jq -r '[.versions[].publishedAt] | max' <<<"$pkg")
version=$(jq -r '.versions[] | select(.isDefault) | .versionKey.version' <<<"$pkg")
project=$(curl -fsS "https://api.deps.dev/v3/systems/\${system}/packages/\${name}/versions/\${version}" \\
  | jq -r '[.relatedProjects[] | select(.relationType == "SOURCE_REPO")][0].projectKey.id // empty')
score=0
[ -z "$project" ] || score=$(curl -fsS "https://api.deps.dev/v3/projects/$(jq -rn --arg p "$project" '$p | @uri')" | jq -r '.scorecard.overallScore // 0')
fail=0
[ "$(date -d "$newest" +%s)" -ge "$(date -d '365 days ago' +%s)" ] || { echo "::error::$2: newest release $newest, more than 12 months ago"; fail=1; }
[ "$(jq -n "$score >= 5")" = true ] || { echo "::error::$2: OpenSSF Scorecard $score (5 needed; project: \${project:-unknown})"; fail=1; }
if [ "$fail" = 1 ] && gh pr view "$PR_NUMBER" --json labels -q '.labels[].name' | grep -qx dependency-exception; then
  echo "accepted: the pull request carries dependency-exception with the reviewer's reason"; fail=0
fi
exit $fail`,
    },
    {
      id: 'ff-footprint', label: 'Footprint within budget', when: { CRITERION: ['performance'] }, characteristic: 'performance-efficiency', scope: 'atomic', cadence: 'triggered', trigger: 'release', invocation: 'automated', implements: RUNTIMES, checks: ['req-footprint'],
      threshold: 'A new instance answers its readiness probe within {{STARTUP_SECONDS}} seconds; under the load test its peak memory stays at or under {{MEMORY_MB}} MB and it is not killed for memory',
      description: 'For each release candidate the job starts one instance of the image under a hard memory limit of {{MEMORY_MB}} MB, polls its readiness endpoint until it answers (failing past {{STARTUP_SECONDS}} seconds), runs the load test the Capacity and scaling pack decided against it, then reads the container\'s peak memory from cgroup v2 (memory.peak) and whether it was killed for memory. Runs on a Linux host with cgroup v2 (kernel 5.19 or newer).',
      tool: 'Docker with curl and jq (release pipeline)',
      language: 'bash',
      snippet: `#!/usr/bin/env bash
# IMAGE: the release candidate; LOAD_TEST: the k6 command of the Capacity and scaling pack, run against localhost:8080
set -euo pipefail
c=$(docker run -d --memory={{MEMORY_MB}}m -p 8080:8080 "$IMAGE")
trap 'docker rm -f "$c" >/dev/null' EXIT
start=$(date +%s)
until curl -fsS localhost:8080/health/ready >/dev/null 2>&1; do
  sleep 1
  [ $(( $(date +%s) - start )) -lt {{STARTUP_SECONDS}} ] || { echo "not ready within {{STARTUP_SECONDS}} s"; exit 1; }
done
echo "ready after $(( $(date +%s) - start )) s"
bash -c "$LOAD_TEST"
peak=$(docker exec "$c" cat /sys/fs/cgroup/memory.peak)
oom=$(docker inspect "$c" | jq -r '.[0].State.OOMKilled')
[ "$oom" = false ] && [ "$peak" -le $(( {{MEMORY_MB}} * 1024 * 1024 )) ] \\
  || { echo "peak $(( peak / 1024 / 1024 )) MB of {{MEMORY_MB}} MB, killed for memory: $oom"; exit 1; }`,
    },
  ],
}

export default pack
