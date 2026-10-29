import type { PackSpec, When } from '../../src/packSpec'

const SOURCES = ['adr-script', 'adr-platform']
const MEASURED: When = { SOURCE: ['script', 'platform'] }
const FORCES = 'This element is changed and deployed week after week, and the team wants to know whether it is getting faster and safer at it, not to guess. The forces: what is not measured is argued from anecdote, while a metric turned into a goal gets gamed (DORA warns of Goodhart\'s law): counting deployments rewards splitting them, counting failures rewards not calling them failures; throughput and instability have to be read together, because either can be bought with the other; the metrics mean something for one application or service, and blended across teams they hide more than they show; the definitions decide the numbers (what is a deployment, when a change starts, what is a failure, when it is recovered) and tools disagree on them; a team that deploys a few times a month has too few events for a rate to mean much; and a number nobody acts on is decoration. How a release rolls out, how fast it rolls back and how often the element releases are decided in the Deployment pack; the availability objective and the error budget in the Availability pack; the time for repaying technical debt in the Technical debt pack; who responds to an incident, and how, is the incident process.'

const pack: PackSpec = {
  id: 'concern-delivery-metrics',
  name: 'Delivery metrics',
  group: 'sdlc',
  description: 'How fast and how safely changes reach production: the five DORA software delivery metrics, where they come from, exactly what they count, the team\'s targets, and what happens when a target is missed for weeks. The snippets are for GitHub (the Deployments API and Actions) and, with a platform, GitLab\'s DORA metrics API.',
  tags: ['dora', 'delivery metrics', 'lead time', 'deployment frequency', 'change fail rate', 'continuous improvement'],
  concern: {
    id: 'delivery-metrics',
    trigger: 'LIST NODES WHERE (type = "container" OR type = "webapp") AND external != true',
    why: 'code in these elements is changed and deployed, so how the team measures its delivery, and what it does about the figures, has to be decided.',
  },
  sources: [
    { title: 'DORA: DORA\'s software delivery performance metrics (guide)', url: 'https://dora.dev/guides/dora-metrics/' },
    { title: 'DORA: A history of DORA\'s software delivery metrics', url: 'https://dora.dev/insights/dora-metrics-history/' },
    { title: 'DORA: Accelerate State of DevOps Report 2024', url: 'https://dora.dev/research/2024/dora-report/' },
    { title: 'Nicole Forsgren, Jez Humble, Gene Kim: Accelerate (IT Revolution)', url: 'https://itrevolution.com/product/accelerate/' },
    { title: 'GitHub REST API: Deployments', url: 'https://docs.github.com/en/rest/deployments/deployments' },
    { title: 'GitHub REST API: Deployment statuses', url: 'https://docs.github.com/en/rest/deployments/statuses' },
    { title: 'GitLab: DORA metrics', url: 'https://docs.gitlab.com/user/analytics/dora_metrics/' },
    { title: 'GitLab: DORA API', url: 'https://docs.gitlab.com/api/dora/metrics/' },
  ],
  questions: [
    {
      key: 'SOURCE', title: 'Source', label: 'Where do the delivery metrics come from?',
      hint: 'This decides what the numbers mean: the same deployment can count differently in two tools. The exact definitions of a deployment, a change\'s start, a failure and a recovery come with the answer.',
      default: 'script',
      options: [
        { value: 'script', label: 'our own job over the GitHub deployment records', description: 'The deploy job records every production deployment through the GitHub Deployments API, rollbacks and hotfixes name the deployment they repair, and a weekly job of about fifty lines computes all five DORA metrics from those records. Pick it when the code is on GitHub and the team wants the definitions to be exactly its own, at no licence cost.' },
        { value: 'platform', label: 'a delivery-insights platform', description: 'A product computes the metrics from the repository, the pipeline and the incidents: GitLab\'s DORA metrics (GitLab Ultimate), LinearB, Swarmia, DX or Sleuth. Pick it when the organisation already runs one, or when several teams want the same dashboards without each keeping a script; its definitions are the vendor\'s, not exactly DORA\'s.' },
        { value: 'review', label: 'a quarterly team review, not measured', description: 'No tool computes anything; once a quarter the team answers the same five questions from its records and memory and compares the answers with its targets. Pick it when the team deploys only a few times a month, so a rate over a handful of events says little, or while the pipeline does not yet record deployments; the decision records that the figures are estimates.' },
      ],
    },
    {
      key: 'SCOPE', title: 'Scope', label: 'What is measured as one unit?',
      hint: 'DORA applies the metrics to one application or service; blended across teams they hide more than they show. Whichever you pick, the figures are never broken down per person.',
      default: 'element',
      options: [
        { value: 'element', label: 'each deployable element on its own', description: 'The figures cover this element alone, from the deployments that name it. Pick it by default: it is the level DORA intends, and one element\'s risks and pace are not averaged away by another\'s.' },
        { value: 'team', label: 'each team, over the elements it owns', description: 'The figures cover every element the owning team deploys, counted together. Pick it when a team deploys several small elements that change together, or when each alone deploys too rarely for its rates to mean anything.' },
      ],
    },
    {
      key: 'RESPONSE', title: 'Response', label: 'What happens when a metric stays off its target?',
      hint: 'One bad week is noise; a metric off target for several weekly measurements in a row is a trend worth work. With a quarterly review instead of measurement, the review applies the answer to each figure worse than its target. Time for repaying technical debt is the Technical debt pack\'s budget, not this.',
      default: 'retro',
      options: [
        { value: 'retro', label: 'an improvement item for the next retrospective', description: 'An item labelled delivery-improvement is opened for the metric, the next retrospective picks what to try, and the item stays open until the metric is back on target. Pick it when the team holds retrospectives and the causes are usually in its own way of working.' },
        { value: 'reserve', label: 'a reserved share of the next iteration', description: 'Besides the item, a fixed share of the next iteration\'s capacity (15% by default) goes to work on that metric, such as speeding up the pipeline or automating a rollback. Pick it when misses keep coming back because improvement work always loses to features in planning.' },
        { value: 'report', label: 'a line in the weekly report only', description: 'The miss and how many weeks it has lasted are shown in the weekly report; nothing else starts by itself. Pick it while the targets are new and the team is still learning its baseline, or when another forum decides the work; the decision records that a missed target obliges nobody.' },
      ],
    },
  ],
  details: [
    { key: 'WINDOW_DAYS', label: 'Over how many days is each weekly measurement taken? GitHub deletes deployment statuses after 90 days, so twice this plus 7 days for each week of a streak must stay under 90. Only with measured metrics', default: '28', number: true },
    { key: 'DEPLOYS_PER_WEEK', label: 'Fewest production deployments a week (1 with a weekly release train; the cadence is decided in the Deployment pack)', default: '5', number: true },
    { key: 'LEAD_TIME_HOURS', label: 'Longest median change lead time to production (hours)', default: '24', number: true },
    { key: 'CHANGE_FAIL_PCT', label: 'Highest change fail rate (% of production deployments)', default: '15', number: true },
    { key: 'RECOVERY_HOURS', label: 'Longest median failed deployment recovery time (hours)', default: '4', number: true },
    { key: 'REWORK_PCT', label: 'Highest deployment rework rate (% of production deployments). Not with a platform that does not report it (GitLab)', default: '10', number: true },
    { key: 'MISS_WEEKS', label: 'After how many weekly measurements in a row off target does the response start? Only with measured metrics', default: '3', number: true },
    { key: 'RESERVED_PCT', label: 'What share of the next iteration is reserved for a metric off target (%)? Only with a reserved share', default: '15', number: true },
  ],
  need: {
    label: 'Delivery performance is known and improved',
    text: 'The team needs to know how often and how fast its changes reach production, how often a change breaks something and how long the break lasts, and whether that is getting better, so that improvement work goes where it pays. The figures must count the same things every week, be read against the team\'s own targets rather than other teams, and lead to action when they stay off target. The snippets assume the code on GitHub with GitHub Actions: the deploy job records each production deployment through the GitHub Deployments API, scripts/delivery-metrics.sh runs the measurement (scripts/delivery-flow.mjs and scripts/delivery-failures.mjs, or the platform query) and writes reports/delivery-*.json, improvement items are issues labelled delivery-improvement, and quarterly reviews are kept under docs/delivery-reviews/; the platform snippets use GitLab\'s DORA API, with glab in place of gh.',
  },
  forces: FORCES,
  requirements: [
    {
      id: 'req-deploy-recorded', label: 'Every deployment is recorded', when: { SOURCE: ['script'] }, ears_type: 'event-driven',
      trigger: 'the pipeline deploys the element to production',
      action: 'create a GitHub deployment of the deployed commit with environment production and a payload naming the service, the owning team and the kind (planned, hotfix or rollback, with the id of the repaired deployment for a hotfix or rollback), and post its success status only once the new version serves all production traffic',
      rationale: 'The metrics are only as good as the record of deployments; a deployment that is not recorded, or recorded before it is live, shifts every figure (DORA metrics guide; GitHub REST API: Deployments, Deployment statuses).',
      scenario: { label: 'Hotfix is recorded', given: 'a hotfix for deployment 41 merged to the main branch', when: 'the deploy job takes it to production', then: 'the Deployments API shows a deployment of its commit with environment production, payload kind hotfix, fixes 41, service and team, and a success status created after the rollout ended' },
    },
    {
      id: 'req-failure-marked', label: 'Failed deployments are marked', when: { SOURCE: ['script'] }, ears_type: 'event-driven',
      trigger: 'a production deployment of the element needs immediate intervention: a rollback, a hotfix, or a feature or setting switched off because of what it changed',
      action: 'post a failure status on that deployment when service is recovered, naming the intervention in its description; a rollback or hotfix deploy job posts it itself, and the incident process posts it for any other intervention within 1 working day',
      rationale: 'DORA counts a deployment as failed when it needs immediate intervention, and measures recovery from it; marking the deployment itself keeps both figures computable from one record (DORA metrics guide; A history of DORA\'s software delivery metrics: failed deployment recovery time).',
      scenario: { label: 'Rollback marks the failure', given: 'deployment 41 in production', when: 'the rollback job redeploys the previous version with fixes 41 and that rollback reaches its success status', then: 'deployment 41 carries a failure status, created after its success status, whose description names the rollback' },
    },
    {
      id: 'req-flow-targets', label: 'Frequent, fast delivery', when: MEASURED, ears_type: 'ubiquitous',
      action: 'deploy to production at least {{DEPLOYS_PER_WEEK}} times a week and keep the median change lead time to production at or under {{LEAD_TIME_HOURS}} hours, both measured every week over the last {{WINDOW_DAYS}} days',
      rationale: 'Deployment frequency and change lead time are DORA\'s throughput measures; small batches delivered often are easier to test, release and undo (DORA metrics guide; Accelerate, chapter 2).',
      scenario: { label: 'Slow week reported', given: 'a window of {{WINDOW_DAYS}} days with fewer than {{DEPLOYS_PER_WEEK}} deployments a week, or a median lead time above {{LEAD_TIME_HOURS}} hours', when: 'the weekly measurement runs', then: 'its report lists deployment_frequency or change_lead_time among the missed targets and the job fails' },
    },
    {
      id: 'req-stability-targets', label: 'Few failures, quickly recovered', when: MEASURED, ears_type: 'ubiquitous',
      action: 'keep the change fail rate at or under {{CHANGE_FAIL_PCT}}% of production deployments and the median failed deployment recovery time at or under {{RECOVERY_HOURS}} hours, both measured every week over the last {{WINDOW_DAYS}} days',
      rationale: 'Speed bought with broken releases is no gain; DORA reads the failure measures beside the throughput ones, and since 2023 measures recovery only from failures a deployment caused (DORA metrics guide; A history of DORA\'s software delivery metrics).',
      scenario: { label: 'Unstable week reported', given: 'a window of {{WINDOW_DAYS}} days in which more than {{CHANGE_FAIL_PCT}}% of deployments failed, or the median recovery took longer than {{RECOVERY_HOURS}} hours', when: 'the weekly measurement runs', then: 'its report lists change_fail_rate or failed_deployment_recovery_time among the missed targets and the job fails' },
    },
    {
      id: 'req-rework', label: 'Little unplanned rework', when: { SOURCE: ['script'] }, ears_type: 'ubiquitous',
      action: 'keep the deployment rework rate, the share of production deployments that are hotfixes or rollbacks, at or under {{REWORK_PCT}}%, measured every week over the last {{WINDOW_DAYS}} days',
      rationale: 'DORA added the deployment rework rate in 2024 to measure directly the unplanned deployments that production incidents force, which the change fail rate only approximates (A history of DORA\'s software delivery metrics; Accelerate State of DevOps Report 2024).',
      scenario: { label: 'Rework reported', given: 'a window of {{WINDOW_DAYS}} days in which more than {{REWORK_PCT}}% of production deployments have kind hotfix or rollback', when: 'the weekly measurement runs', then: 'its report lists deployment_rework_rate among the missed targets and the job fails' },
    },
    {
      id: 'req-platform-data', label: 'The platform sees production', when: { SOURCE: ['platform'] }, ears_type: 'ubiquitous',
      action: 'report every production deployment of the element to the platform with its environment marked as production (in GitLab, environment:deployment_tier production on the deploy job), mark every other deploying job with its own tier, and record each incident a production deployment causes as an incident the platform reads, closed when service is recovered',
      rationale: 'A platform counts what its data says is production: GitLab counts only successful deployments to environments of the production tier or named production, and computes failures and recovery from its incidents (GitLab: DORA metrics).',
      scenario: { label: 'Production deploy job is tiered', given: 'a .gitlab-ci.yml whose production deploy job uses an environment named eu-live', when: 'the tier check runs', then: 'it fails until the job declares deployment_tier production, and passes when every deploying job declares a tier' },
    },
    {
      id: 'req-response-retro', label: 'Lasting misses reach the retrospective', when: { ...MEASURED, RESPONSE: ['retro'] }, ears_type: 'event-driven',
      trigger: 'a metric misses its target in {{MISS_WEEKS}} weekly measurements in a row',
      action: 'open an improvement item labelled delivery-improvement with the metric\'s name in its title before the next retrospective, decide there what to try, and keep the item open until the metric meets its target again',
      rationale: 'A figure nobody acts on is decoration; the improvement belongs to the team that does the work, not to a mandate from outside (DORA metrics guide: improve over time, avoid metrics as goals; Accelerate, chapter 2).',
      scenario: { label: 'Lasting miss opens an item', given: 'change_fail_rate off target in {{MISS_WEEKS}} weekly measurements in a row', when: 'the improvement check runs', then: 'it fails until an open issue labelled delivery-improvement names change_fail_rate in its title' },
    },
    {
      id: 'req-response-reserve', label: 'Lasting misses get capacity', when: { ...MEASURED, RESPONSE: ['reserve'] }, ears_type: 'event-driven',
      trigger: 'a metric misses its target in {{MISS_WEEKS}} weekly measurements in a row',
      action: 'open an improvement item labelled delivery-improvement with the metric\'s name in its title and reserve {{RESERVED_PCT}}% of the next iteration\'s capacity for work on it, apart from any budget for technical debt',
      rationale: 'Improvement work that has to win every planning against features rarely does; reserved capacity makes the trade explicit (Accelerate, chapter 2; DORA metrics guide).',
      scenario: { label: 'Lasting miss gets capacity', given: 'change_lead_time off target in {{MISS_WEEKS}} weekly measurements in a row', when: 'the improvement check runs before the next iteration is planned', then: 'it fails until an open issue labelled delivery-improvement names change_lead_time in its title' },
    },
    {
      id: 'req-response-report', label: 'Lasting misses are reported', when: { ...MEASURED, RESPONSE: ['report'] }, ears_type: 'event-driven',
      trigger: 'a metric misses its target in {{MISS_WEEKS}} weekly measurements in a row',
      action: 'list the metric in the weekly report as off target for {{MISS_WEEKS}} weeks in a row, and start no work item by itself',
      rationale: 'While a baseline is being learnt, a visible trend is enough; the decision says so, so that nobody reads a missed target as an obligation (DORA metrics guide).',
      scenario: { label: 'Lasting miss is listed', given: 'deployment_frequency off target in {{MISS_WEEKS}} weekly measurements in a row', when: 'the weekly job runs', then: 'its summary lists deployment_frequency as off target in each of the last {{MISS_WEEKS}} weekly measurements' },
    },
    {
      id: 'req-review', label: 'Quarterly delivery review', when: { SOURCE: ['review'] }, ears_type: 'event-driven',
      trigger: 'a calendar quarter ends',
      action: 'hold a team review within 14 days that estimates the deployments a week, the change lead time, the change fail rate, the failed deployment recovery time and the deployment rework rate of the quarter, compares each with its target, and records the answers, the targets and the actions in docs/delivery-reviews/<year>-Q<n>.md',
      rationale: 'DORA\'s research measured delivery performance by asking teams these questions; a team without the data can still ask them every quarter and act on the answers (Accelerate, chapter 2; DORA metrics guide).',
      scenario: { label: 'Review is on record', given: 'the end of a quarter', when: 'CI runs on the main branch 100 days later', then: 'it passes only if docs/delivery-reviews holds that quarter\'s review with an answer and a target for each of the five figures and an Actions section' },
    },
    {
      id: 'req-no-ranking', label: 'Figures are not a ranking', ears_type: 'ubiquitous',
      action: 'report the delivery figures only for the unit decided (an element or a team), never per person, and compare each unit only with its own past, never rank teams by them',
      rationale: 'DORA warns that metrics made into goals or used to compare unlike teams get gamed and lose their meaning; they serve a team improving over time (DORA metrics guide).',
      scenario: { label: 'No per-person figures', given: 'the weekly report or the quarterly review', when: 'it is shared outside the team', then: 'it shows figures for the element or team and its own earlier weeks only, with no breakdown per person and no league table of teams' },
      unchecked: 'The engineering manager, whenever the figures leave the team: no tool can tell how a number is used once it is shown.',
    },
  ],
  adrs: [
    {
      id: 'adr-script', label: 'Delivery metrics from our own job', when: { SOURCE: ['script'] },
      decision: 'Our own job computes the five DORA software delivery metrics for {{SCOPE}} from the GitHub Deployments API, every Monday over the last {{WINDOW_DAYS}} days (scripts/delivery-flow.mjs and scripts/delivery-failures.mjs, run by scripts/delivery-metrics.sh in a scheduled GitHub Actions workflow that keeps reports/ as an artifact for 90 days). Definitions: a deployment is a GitHub deployment to environment production whose payload names the service and team and that has a success status, posted once the new version serves all production traffic; a rollout that never got there is not a deployment (the Deployment pack\'s rollback handles it). A change starts at the committer date of its commit on the main branch (with squash merges, the merge) and ends at the success status of the first production deployment that brings it. A deployment failed when it needed immediate intervention (a rollback, a hotfix, or a feature or setting switched off because of it) and carries a failure status posted after its success status: rollback and hotfix deploy jobs post it on the deployment they repair, the incident process posts it for any other intervention. It recovered at that failure status, so recovery time runs from going live to recovery and includes the time to notice. A deployment is rework when its kind is hotfix or rollback. Targets: at least {{DEPLOYS_PER_WEEK}} deployments a week; median change lead time at most {{LEAD_TIME_HOURS}} hours; change fail rate at most {{CHANGE_FAIL_PCT}}%; median failed deployment recovery time at most {{RECOVERY_HOURS}} hours; deployment rework rate at most {{REWORK_PCT}}%. The targets are the team\'s own, set from its baseline, not DORA\'s performance clusters. A metric off target in {{MISS_WEEKS}} weekly measurements in a row gets: {{RESPONSE}}.',
      consequences: '• The definitions are exactly ours and written down; every figure can be traced to deployments and statuses.\n• The pipeline must record deployments faithfully: a deploy job that skips the record, or posts success before the rollout ends, distorts every figure; a weekly check catches the first.\n• Failures that need no deployment to fix (a flag switched off) count only if the incident process remembers to mark them.\n• Recovery time includes the time to notice, so a failure found days later shows as a long recovery; that is intended.\n• GitHub deletes deployment statuses after 90 days, so the window and the streak have to fit in 90 days, and longer history lives only in the kept reports.\n• About fifty lines of script to keep, and API calls in proportion to the number of deployments.',
      alternatives: '1. A delivery-insights platform: dashboards without a script, but the vendor\'s definitions and a licence.\n2. A quarterly review without measurement: no tooling at all, but estimates instead of figures.\n3. Google\'s Four Keys project: archived by its owners in 2024, so no longer a base to build on.',
    },
    {
      id: 'adr-platform', label: 'Delivery metrics from a platform', when: { SOURCE: ['platform'] },
      decision: 'A delivery-insights platform computes the DORA metrics for {{SCOPE}}: GitLab\'s DORA metrics (GitLab Ultimate) when the code is on GitLab, for one element per project or for a team per group; otherwise the platform the organisation runs (LinearB, Swarmia, DX or Sleuth), fed with the pipeline\'s production deployments and the incidents. We take the platform\'s definitions and record where they differ from DORA\'s guide: GitLab counts successful deployments to environments of the production tier, starts lead time when the merge request is merged rather than at the commit, counts a failure as a GitLab incident and recovery as the time the incident was open, and reports no deployment rework rate. Every deploy job declares its environment\'s tier. A weekly job reads the figures over the last {{WINDOW_DAYS}} days from the platform\'s API and compares them with the targets: at least {{DEPLOYS_PER_WEEK}} deployments a week; median change lead time at most {{LEAD_TIME_HOURS}} hours; change fail rate at most {{CHANGE_FAIL_PCT}}%; median recovery time at most {{RECOVERY_HOURS}} hours; and, where the platform reports it, deployment rework rate at most {{REWORK_PCT}}%. The targets are the team\'s own, not DORA\'s performance clusters. A metric off target in {{MISS_WEEKS}} weekly measurements in a row gets: {{RESPONSE}}.',
      consequences: '• Dashboards, history and drill-down without a script of our own; several teams see their figures the same way.\n• The definitions are the vendor\'s: GitLab\'s lead time leaves out the time before the merge, and its failure figures are only as good as the incidents opened in GitLab.\n• A licence (GitLab Ultimate, or the platform\'s per-developer price) and one more system with access to the code.\n• Platforms tempt managers to compare teams and people; the figures stay at the decided unit and never per person.\n• The deployment rework rate is missing where the platform does not report it.',
      alternatives: '1. Our own job over the GitHub deployment records: exact definitions and no licence, but a script to keep.\n2. A quarterly review without measurement: no tooling, but estimates instead of figures.',
    },
    {
      id: 'adr-review', label: 'Delivery reviewed quarterly, not measured', when: { SOURCE: ['review'] },
      decision: 'Delivery performance of {{SCOPE}} is not measured by a tool. Within 14 days after each quarter the team holds a review that estimates, from its records and memory, the deployments a week, the change lead time from commit to production, the change fail rate (deployments that needed immediate intervention), the failed deployment recovery time and the deployment rework rate (deployments that were hotfixes or rollbacks), and compares each with its target: at least {{DEPLOYS_PER_WEEK}} deployments a week; lead time at most {{LEAD_TIME_HOURS}} hours; change fail rate at most {{CHANGE_FAIL_PCT}}%; recovery at most {{RECOVERY_HOURS}} hours; rework at most {{REWORK_PCT}}%. The review is kept in docs/delivery-reviews/<year>-Q<n>.md, one section per figure with an Answer: and a Target: line, and an Actions section. A figure worse than its target gets: {{RESPONSE}}. We revisit this decision when the team deploys more than once a week.',
      consequences: '• No tooling and no recording discipline in the pipeline; an hour a quarter.\n• The figures are estimates: memory flatters, and a slow drift goes unnoticed for up to three months.\n• Nothing checks a target between reviews; a bad month is seen at the end of the quarter.\n• The same five questions keep the team ready to measure later without changing what it talks about.',
      alternatives: '1. Our own job over the GitHub deployment records: real figures every week, once the pipeline records deployments.\n2. A delivery-insights platform: figures without a script, at a licence cost.\n3. No review at all: delivery performance becomes a matter of impression.',
    },
  ],
  fitness: [
    {
      id: 'ff-deploy-record', label: 'Deployments carry their record', when: { SOURCE: ['script'] }, category: 'process', implements: ['adr-script'], checks: ['req-deploy-recorded'],
      threshold: '0 production deployments of the last {{WINDOW_DAYS}} days without a payload naming service, team and a kind of planned, hotfix or rollback',
      description: 'A weekly step lists the production deployments through the Deployments API and fails on any whose payload lacks the service, the team or a valid kind. The comment shows how the deploy job creates the record and posts success after the rollout.',
      tool: 'GitHub CLI (gh api --paginate) with jq, in the weekly GitHub Actions workflow (ubuntu runner, GNU date)',
      language: 'bash',
      snippet: `# weekly: every production deployment of the last {{WINDOW_DAYS}} days names its service, team and kind
# the deploy job records each one; DEPLOY_KIND is planned, hotfix or rollback, FIXES the id of the deployment a hotfix or rollback repairs:
#   id=$(jq -n --arg sha "$GITHUB_SHA" --arg kind "$DEPLOY_KIND" --arg fixes "\${FIXES:-}" '{ ref: $sha, environment: "production",
#          auto_merge: false, required_contexts: [], payload: ({ service: "order-api", team: "checkout", kind: $kind }
#          + if $fixes == "" then {} else { fixes: ($fixes | tonumber) } end) }' | gh api "repos/$GITHUB_REPOSITORY/deployments" --input - --jq .id)
#   ...the rollout...
#   gh api "repos/$GITHUB_REPOSITORY/deployments/$id/statuses" -f state=success   # only once the new version serves all production traffic
set -euo pipefail
since=$(date -u -d "-{{WINDOW_DAYS}} days" +%FT%TZ)
gh api --paginate "repos/$GITHUB_REPOSITORY/deployments?environment=production&per_page=100" | jq -s --arg since "$since" '
  [ .[][] | select(.created_at >= $since)
    | select((.payload | type) != "object" or (.payload.service | type) != "string" or (.payload.team | type) != "string"
             or ((.payload.kind // "") | IN("planned", "hotfix", "rollback") | not))
    | { id, sha, created_at } ]' > reports/unrecorded.json
jq -e 'length == 0' reports/unrecorded.json > /dev/null || { echo "production deployments without service, team or kind:"; cat reports/unrecorded.json; exit 1; }`,
    },
    {
      id: 'ff-failure-marked', label: 'Repaired deployments are marked failed', when: { SOURCE: ['script'] }, category: 'process', implements: ['adr-script'], checks: ['req-failure-marked'],
      threshold: '0 rollbacks or hotfixes of the last {{WINDOW_DAYS}} days that name no repaired deployment, or whose repaired deployment carries no failure status',
      description: 'A weekly step takes every rollback and hotfix deployment, reads the deployment it names as repaired and fails when that one has no failure status. Interventions without a deployment (a flag switched off) are marked by the incident process and are not seen by this check.',
      tool: 'GitHub CLI (gh api) with jq, in the weekly GitHub Actions workflow',
      language: 'bash',
      snippet: `# weekly: every rollback or hotfix of the last {{WINDOW_DAYS}} days names the deployment it repairs, and that deployment carries a failure status
# a rollback or hotfix deploy job, after its own success status, marks the deployment it repaired:
#   gh api "repos/$GITHUB_REPOSITORY/deployments/$FIXES/statuses" -f state=failure -f description="recovered by $DEPLOY_KIND, deployment $id"
# any other intervention (a feature flag or a setting switched off) is marked the same way by the incident process, by hand
set -euo pipefail
since=$(date -u -d "-{{WINDOW_DAYS}} days" +%FT%TZ); status=0
while read -r id fixes; do
  if [ "$fixes" = none ]; then echo "deployment $id is a rollback or hotfix but names no deployment it repairs"; status=1; continue; fi
  gh api "repos/$GITHUB_REPOSITORY/deployments/$fixes/statuses?per_page=100" | jq -e 'any(.[]; .state == "failure")' > /dev/null \\
    || { echo "deployment $fixes was repaired by deployment $id but carries no failure status"; status=1; }
done < <(gh api --paginate "repos/$GITHUB_REPOSITORY/deployments?environment=production&per_page=100" | jq -rs --arg since "$since" '
  .[][] | select(.created_at >= $since and (.payload | type) == "object" and (.payload.kind == "rollback" or .payload.kind == "hotfix"))
  | "\\(.id) \\(.payload.fixes // "none")"')
exit $status`,
    },
    {
      id: 'ff-change-flow', label: 'Deployment frequency and lead time', when: { SOURCE: ['script'] }, category: 'operational', implements: ['adr-script'], checks: ['req-flow-targets'],
      threshold: 'At least {{DEPLOYS_PER_WEEK}} production deployments a week and a median change lead time of at most {{LEAD_TIME_HOURS}} hours over the last {{WINDOW_DAYS}} days',
      description: 'The script reads the production deployments of the unit (SCOPE=service:<name> or team:<name>), keeps those with a success status, and for each takes the commits it brought (the compare API between the previous live deployment and it); a commit\'s lead time runs from its committer date to the first deployment that brought it. It writes reports/delivery-flow.json and fails when a target is missed. UNTIL moves the window back for the streak check.',
      tool: 'Node 20 (fetch) over the GitHub REST API: deployments, deployment statuses, compare two commits; run by the weekly GitHub Actions workflow',
      language: 'js',
      snippet: `// scripts/delivery-flow.mjs: deployment frequency and change lead time over the {{WINDOW_DAYS}} days up to UNTIL (default now)
import { writeFileSync } from 'node:fs'
const api = (path) => fetch(\`https://api.github.com/repos/\${process.env.GITHUB_REPOSITORY}/\${path}\`, { headers: {
  authorization: \`Bearer \${process.env.GITHUB_TOKEN}\`, accept: 'application/vnd.github+json' } }).then((r) => r.json())
const all = async (path) => { const out = []; for (let page = 1; ; page++) { const xs = await api(\`\${path}&per_page=100&page=\${page}\`); out.push(...xs); if (xs.length < 100) return out } }
const median = (xs) => { const s = [...xs].sort((a, b) => a - b); return s.length ? (s[(s.length - 1) >> 1] + s[s.length >> 1]) / 2 : 0 }
const [field, name] = process.env.SCOPE.split(':')   // service:order-api, or team:checkout
const until = process.env.UNTIL ? Date.parse(process.env.UNTIL) : Date.now(), since = until - {{WINDOW_DAYS}} * 86_400_000
const live = []   // the deployments that reached production: a success status
for (const d of await all('deployments?environment=production')) {
  if (d.payload?.[field] !== name || Date.parse(d.created_at) > until || Date.parse(d.created_at) < since - {{WINDOW_DAYS}} * 86_400_000) continue
  const ok = (await all(\`deployments/\${d.id}/statuses?\`)).find((s) => s.state === 'success')
  if (ok && Date.parse(ok.created_at) <= until) live.push({ sha: d.sha, at: Date.parse(ok.created_at) })
}
live.sort((a, b) => a.at - b.at)
const seen = new Set(), hours = [], inWindow = live.filter((d) => d.at >= since)
for (const [i, d] of live.entries()) {   // a commit's lead time ends at the first deployment that brought it
  const { commits = [] } = i ? await api(\`compare/\${live[i - 1].sha}...\${d.sha}?per_page=100\`) : {}   // past 100 commits, page on
  for (const c of commits) if (!seen.has(c.sha) && seen.add(c.sha) && d.at >= since) hours.push((d.at - Date.parse(c.commit.committer.date)) / 3_600_000)
}
const values = { deploys_per_week: inWindow.length / ({{WINDOW_DAYS}} / 7), lead_time_hours: median(hours) }
const misses = [values.deploys_per_week < {{DEPLOYS_PER_WEEK}} && 'deployment_frequency', values.lead_time_hours > {{LEAD_TIME_HOURS}} && 'change_lead_time'].filter(Boolean)
writeFileSync('reports/delivery-flow.json', JSON.stringify({ until: new Date(until).toISOString(), values, misses }, null, 2))
if (misses.length) { console.error(\`missed targets: \${misses.join(', ')}\`); process.exitCode = 1 }`,
    },
    {
      id: 'ff-failures', label: 'Change fail rate, recovery and rework', when: { SOURCE: ['script'] }, category: 'operational', implements: ['adr-script'], checks: ['req-stability-targets', 'req-rework'],
      threshold: 'Change fail rate at most {{CHANGE_FAIL_PCT}}%, median failed deployment recovery time at most {{RECOVERY_HOURS}} hours and deployment rework rate at most {{REWORK_PCT}}% over the last {{WINDOW_DAYS}} days',
      description: 'The script reads the production deployments of the unit that went live in the window; a deployment failed when a failure status follows its success status, and its recovery time runs from the one to the other; it is rework when its kind is hotfix or rollback. It writes reports/delivery-failures.json and fails when a target is missed.',
      tool: 'Node 20 (fetch) over the GitHub REST API: deployments and deployment statuses; run by the weekly GitHub Actions workflow',
      language: 'js',
      snippet: `// scripts/delivery-failures.mjs: change fail rate, failed deployment recovery time and deployment rework rate over the {{WINDOW_DAYS}} days up to UNTIL
import { writeFileSync } from 'node:fs'
const api = (path) => fetch(\`https://api.github.com/repos/\${process.env.GITHUB_REPOSITORY}/\${path}\`, { headers: {
  authorization: \`Bearer \${process.env.GITHUB_TOKEN}\`, accept: 'application/vnd.github+json' } }).then((r) => r.json())
const all = async (path) => { const out = []; for (let page = 1; ; page++) { const xs = await api(\`\${path}&per_page=100&page=\${page}\`); out.push(...xs); if (xs.length < 100) return out } }
const median = (xs) => { const s = [...xs].sort((a, b) => a - b); return s.length ? (s[(s.length - 1) >> 1] + s[s.length >> 1]) / 2 : 0 }
const [field, name] = process.env.SCOPE.split(':')   // service:order-api, or team:checkout
const until = process.env.UNTIL ? Date.parse(process.env.UNTIL) : Date.now(), since = until - {{WINDOW_DAYS}} * 86_400_000
const live = []
for (const d of await all('deployments?environment=production')) {
  if (d.payload?.[field] !== name || Date.parse(d.created_at) > until || Date.parse(d.created_at) < since - 86_400_000) continue
  const statuses = await all(\`deployments/\${d.id}/statuses?\`)
  const ok = statuses.find((s) => s.state === 'success')   // reached production: counts as a deployment
  if (!ok || Date.parse(ok.created_at) < since || Date.parse(ok.created_at) > until) continue
  const failed = statuses.find((s) => s.state === 'failure' && Date.parse(s.created_at) > Date.parse(ok.created_at))   // posted when service was recovered
  live.push({ kind: d.payload.kind, recovered: failed && Date.parse(failed.created_at) <= until ? (Date.parse(failed.created_at) - Date.parse(ok.created_at)) / 3_600_000 : null })
}
const failed = live.filter((d) => d.recovered !== null), pct = (n) => (100 * n) / (live.length || 1)
const values = { change_fail_pct: pct(failed.length), recovery_hours: median(failed.map((d) => d.recovered)), rework_pct: pct(live.filter((d) => d.kind !== 'planned').length) }
const misses = [values.change_fail_pct > {{CHANGE_FAIL_PCT}} && 'change_fail_rate', values.recovery_hours > {{RECOVERY_HOURS}} && 'failed_deployment_recovery_time',
  values.rework_pct > {{REWORK_PCT}} && 'deployment_rework_rate'].filter(Boolean)
writeFileSync('reports/delivery-failures.json', JSON.stringify({ until: new Date(until).toISOString(), values, misses }, null, 2))
if (misses.length) { console.error(\`missed targets: \${misses.join(', ')}\`); process.exitCode = 1 }`,
    },
    {
      id: 'ff-platform-metrics', label: 'Platform figures against the targets', when: { SOURCE: ['platform'] }, category: 'operational', implements: ['adr-platform'], checks: ['req-flow-targets', 'req-stability-targets'],
      threshold: 'At least {{DEPLOYS_PER_WEEK}} deployments a week, median lead time at most {{LEAD_TIME_HOURS}} hours, change fail rate at most {{CHANGE_FAIL_PCT}}% and median time to restore at most {{RECOVERY_HOURS}} hours over the last {{WINDOW_DAYS}} days, as GitLab reports them',
      description: 'A scheduled GitLab pipeline reads the four figures GitLab computes (deployment_frequency is a count for the period, lead time and time to restore are seconds, change failure rate is a ratio), converts them, writes reports/delivery-platform.json and fails when a target is missed. With interval=all GitLab returns the median of daily medians. With LinearB, Swarmia, DX or Sleuth, the same comparison runs over their export.',
      tool: 'GitLab DORA API (GET /projects/:id/dora/metrics or /groups/:id/dora/metrics, GitLab Ultimate) with curl and jq in a scheduled pipeline',
      language: 'bash',
      snippet: `# scripts/delivery-metrics.sh with a platform: GitLab's DORA metrics over the {{WINDOW_DAYS}} days up to UNTIL, against the targets
# DORA_SCOPE is projects/<id> for one element or groups/<id> for a team's group; GITLAB_TOKEN with read_api, role Reporter or above
set -euo pipefail
end=\${UNTIL:-$(date -u +%F)}; start=$(date -u -d "$end -{{WINDOW_DAYS}} days" +%F)
dora() { curl -fsS --header "PRIVATE-TOKEN: $GITLAB_TOKEN" \\
  "$CI_API_V4_URL/$DORA_SCOPE/dora/metrics?metric=$1&start_date=$start&end_date=$end&interval=all" | jq '.[0].value // 0'; }
jq -n --arg until "$end" --argjson deploys "$(dora deployment_frequency)" --argjson lead "$(dora lead_time_for_changes)" \\
  --argjson restore "$(dora time_to_restore_service)" --argjson cfr "$(dora change_failure_rate)" '
  { until: $until, values: { deploys_per_week: ($deploys / ({{WINDOW_DAYS}} / 7)), lead_time_hours: ($lead / 3600),
                             change_fail_pct: ($cfr * 100), recovery_hours: ($restore / 3600) } }
  | .misses = [ if .values.deploys_per_week < {{DEPLOYS_PER_WEEK}} then "deployment_frequency" else empty end,
                if .values.lead_time_hours > {{LEAD_TIME_HOURS}} then "change_lead_time" else empty end,
                if .values.change_fail_pct > {{CHANGE_FAIL_PCT}} then "change_fail_rate" else empty end,
                if .values.recovery_hours > {{RECOVERY_HOURS}} then "failed_deployment_recovery_time" else empty end ]' > reports/delivery-platform.json
jq -e '.misses == []' reports/delivery-platform.json > /dev/null || { jq -r '"missed targets: \\(.misses | join(", "))"' reports/delivery-platform.json; exit 1; }`,
    },
    {
      id: 'ff-platform-tiers', label: 'Deploy jobs declare their tier', when: { SOURCE: ['platform'] }, category: 'structural', implements: ['adr-platform'], checks: ['req-platform-data'],
      threshold: '0 jobs in .gitlab-ci.yml that deploy without environment:deployment_tier, and at least 1 that deploys to the production tier',
      description: 'A check in the pipeline reads .gitlab-ci.yml and fails when a job with an environment does not declare its tier (GitLab would infer it from the name, and count an oddly named production environment as something else), or when no job deploys to production. It reads the file as written: with include: or extends:, point it at the merged YAML that GitLab\'s CI Lint shows.',
      tool: 'Node 20 with the yaml package, in a GitLab CI job',
      language: 'js',
      snippet: `// scripts/check-deploy-tiers.mjs: every GitLab job that deploys names its environment's tier, and one deploys to production
import { readFileSync } from 'node:fs'
import { parse } from 'yaml'

const ci = parse(readFileSync(process.argv[2] ?? '.gitlab-ci.yml', 'utf8'))
const deploying = Object.entries(ci).filter(([name, job]) => !name.startsWith('.') && job?.environment)
const tier = ([, job]) => (typeof job.environment === 'object' ? job.environment.deployment_tier : undefined)
const untiered = deploying.filter((job) => !tier(job)).map(([name]) => name)
if (untiered.length) throw new Error(\`jobs that deploy without environment:deployment_tier, so GitLab guesses it from the name: \${untiered.join(', ')}\`)
if (!deploying.some((job) => tier(job) === 'production')) throw new Error('no job deploys to an environment of the production tier, so GitLab counts no deployment')
console.log(\`\${deploying.length} deploy jobs, each with its tier\`)`,
    },
    {
      id: 'ff-miss-streak', label: 'Lasting misses are found', when: MEASURED, category: 'process', implements: SOURCES, checks: ['req-response-report'],
      threshold: 'Every metric off target in each of the last {{MISS_WEEKS}} weekly measurements is listed in the job summary',
      description: 'After the weekly measurement, the job runs scripts/delivery-metrics.sh again with UNTIL moved back a week at a time, takes the targets missed in every one of the last {{MISS_WEEKS}} windows, writes them to reports/streak.json and lists them in the job summary. The improvement check reads the same file.',
      tool: 'bash with jq and GNU date, in the weekly GitHub Actions workflow (or the scheduled GitLab pipeline)',
      language: 'bash',
      snippet: `# weekly, after the measurement: the targets missed in each of the last {{MISS_WEEKS}} weekly measurements
set -euo pipefail
rm -f reports/misses-*.json
for k in $(seq 0 $(({{MISS_WEEKS}} - 1))); do
  export UNTIL; UNTIL=$(date -u -d "-$((7 * k)) days" +%F)
  rm -f reports/delivery-*.json
  ./scripts/delivery-metrics.sh || true   # writes reports/delivery-*.json, each with the targets it missed
  jq -s '[.[].misses[]] | unique' reports/delivery-*.json > "reports/misses-$k.json"
done
jq -s 'reduce .[1:][] as $week (.[0]; map(select(IN($week[]))))' reports/misses-*.json > reports/streak.json
jq -r '.[] | "\\(.): off target in each of the last {{MISS_WEEKS}} weekly measurements"' reports/streak.json \\
  | tee -a "\${GITHUB_STEP_SUMMARY:-/dev/null}"`,
    },
    {
      id: 'ff-improvement-item', label: 'Lasting misses have an item', when: { ...MEASURED, RESPONSE: ['retro', 'reserve'] }, category: 'process', implements: SOURCES, checks: ['req-response-retro', 'req-response-reserve'],
      threshold: '0 metrics off target in {{MISS_WEEKS}} weekly measurements in a row without an open issue labelled delivery-improvement that names the metric in its title',
      description: 'After the streak step, the job looks for an open improvement item for each metric in reports/streak.json and fails until one exists, so the weekly workflow stays red until the team has taken the miss up.',
      tool: 'GitHub CLI (gh issue list); on GitLab: glab issue list --label delivery-improvement --search <metric> --output json',
      language: 'bash',
      snippet: `# after the streak: each metric off target {{MISS_WEEKS}} weeks in a row has an open improvement item
set -euo pipefail
status=0
for metric in $(jq -r '.[]' reports/streak.json); do
  open=$(gh issue list --label delivery-improvement --state open --search "$metric in:title" --json number --jq length)
  [ "$open" -gt 0 ] || { echo "$metric has been off target {{MISS_WEEKS}} weeks in a row and has no open delivery-improvement item"; status=1; }
done
exit $status`,
    },
    {
      id: 'ff-review-record', label: 'The quarterly review is on record', when: { SOURCE: ['review'] }, category: 'process', implements: ['adr-review'], checks: ['req-review'],
      threshold: 'The latest file in docs/delivery-reviews is at most 100 days old and has an Answer: and a Target: line for each of the five figures, and an Actions section',
      description: 'A CI step on the main branch finds the latest review by its quarter in the file name, takes its age from the last commit that touched it, and checks each of the five sections for an answer and a target, and that the review records its actions.',
      tool: 'bash with git, awk and grep, in CI on the main branch',
      language: 'bash',
      snippet: `# CI on the main branch: the latest quarterly delivery review is at most 100 days old and answers the five questions against their targets
set -euo pipefail
latest=$(ls docs/delivery-reviews/*-Q[1-4].md | sort | tail -n 1)   # docs/delivery-reviews/2026-Q3.md
age=$(( ( $(date +%s) - $(git log -1 --format=%ct -- "$latest") ) / 86400 ))
[ "$age" -le 100 ] || { echo "$latest is $age days old: the quarterly delivery review is overdue"; exit 1; }
for section in 'Deployment frequency' 'Change lead time' 'Change fail rate' 'Failed deployment recovery time' 'Deployment rework rate'; do
  body=$(awk -v h="## $section" '$0 == h { on = 1; next } /^## / { on = 0 } on' "$latest")
  grep -q '^Answer: .' <<< "$body" && grep -q '^Target: .' <<< "$body" \\
    || { echo "$latest: the section '$section' needs an Answer: line and a Target: line"; exit 1; }
done
grep -q '^## Actions' "$latest" || { echo "$latest has no Actions section"; exit 1; }`,
    },
  ],
}

export default pack
