import type { FitnessSpec, PackSpec, RequirementSpec, When } from '../../src/packSpec'

const HOSTINGS = ['adr-paas', 'adr-kubernetes', 'adr-serverless', 'adr-vms', 'adr-cdn', 'adr-onprem-platform']
/** The hosting models whose ephemeral environments are not Kubernetes namespaces. */
const NOT_K8S = ['paas', 'serverless', 'vms', 'cdn']
const PUBLIC_CLOUDS = ['aws', 'azure', 'gcp']
/** Where the cloud's own infrastructure tool (CloudFormation, Bicep) exists. */
const NATIVE: When = { IAC: ['native'], CLOUD: ['aws', 'azure'] }
/** Terraform as chosen, and as the fallback where the cloud's own tool was asked for but none exists. */
const TERRAFORM: Array<{ suffix: string; when: When; adr: string }> = [
  { suffix: '', when: { IAC: ['terraform'] }, adr: 'adr-iac-terraform' },
  { suffix: '-fallback', when: { IAC: ['native'], CLOUD: ['gcp', 'onprem'] }, adr: 'adr-iac-native-fallback' },
]
/** A managed platform or functions asked for in our own data centre: provided on our Kubernetes. */
const ONPREM_PLATFORM: When = { HOSTING: ['paas', 'serverless'], CLOUD: ['onprem'] }
const FORCES = 'This element is deployed and runs somewhere, and that somewhere has to be chosen, built and paid for. The forces: managed platforms take operations work off the team but limit what can run and tie it to a provider, while Kubernetes and virtual machines run anything at the price of running them; the cloud or data centre is chosen once and rarely left, by skills, existing contracts, services needed and where data may live; infrastructure built by hand in a console cannot be reviewed, repeated or rebuilt after a disaster; environments that differ from production hide the bugs that only production shows; cloud spend grows quietly with every resource nobody switches off; and changes made outside the code drift from it until the next apply undoes or breaks them.'
const ELSEWHERE = 'Rollouts and canaries: as decided in the Deployment and rollback pack. Capacity and scaling: as decided in the Capacity and scaling pack. The engine of a database: hosted as decided in the Data store pack.'
const COMMON = 'The infrastructure is code, written and checked as the infrastructure-as-code decision records and applied only by the pipeline; environments: {{ENVIRONMENTS}}, built from envs/<environment>/ in one repository; drift checked every {{DRIFT_HOURS}} hours.'

/** The budget-exists check, one per public cloud. */
function budget(cloud: string, label: string, tool: string, snippet: string): FitnessSpec {
  return {
    id: `ff-budget-${cloud}`, label: `Budget alert in place (${label})`, when: { CLOUD: [cloud] }, category: 'operational', implements: ['adr-budget'], checks: ['req-budget'],
    threshold: `A monthly cost budget of {{BUDGET_MONTHLY}} with a forecast alert at {{BUDGET_ALERT_PERCENT}}% or lower exists in the account the element runs in`,
    description: `A scheduled job reads the account's budgets through the cloud's CLI and fails when none is a monthly cost budget of {{BUDGET_MONTHLY}} with an enabled forecast notification at {{BUDGET_ALERT_PERCENT}}% or lower; the budget itself is part of the infrastructure code. One budget per account: bind this pack's budget details once per account, not per element.`,
    tool,
    language: 'bash',
    snippet,
  }
}

/** The minimum-instances and autoscaling check of a managed container platform, one per public cloud. */
function paas(cloud: string, platform: string, tool: string, snippet: string): FitnessSpec {
  return {
    id: `ff-paas-${cloud}`, label: `Scaled on ${platform}`, when: { HOSTING: ['paas'], CLOUD: [cloud] }, category: 'operational', implements: ['adr-paas'], checks: ['req-paas'],
    threshold: `The production service runs at least 2 instances and autoscales above that minimum`,
    description: `A check after each deploy reads the production service's scaling settings from ${platform} and fails when fewer than 2 instances are kept or no autoscaling range exists above them.`,
    tool,
    language: 'bash',
    snippet,
  }
}

/** The functions-bounded check, one per public cloud. */
function functions(cloud: string, platform: string, threshold: string, description: string, tool: string, snippet: string): FitnessSpec {
  return {
    id: `ff-functions-${cloud}`, label: `${platform} functions bounded`, when: { HOSTING: ['serverless'], CLOUD: [cloud] }, category: 'structural', implements: ['adr-serverless'], checks: ['req-functions'],
    threshold, description, tool, language: 'bash', snippet,
  }
}

/** The forgotten-environment check for environments that are not Kubernetes namespaces, one per IaC tool
 *  (and per answer that picks the tool). */
function ephemeral(iac: string, whens: Array<{ suffix: string; when: When }>, label: string, description: string, tool: string, snippet: string): FitnessSpec[] {
  return whens.map(({ suffix, when }) => ({
    id: `ff-ephemeral-${iac}${suffix}`, label: `No forgotten environments (${label})`, when: { ENVIRONMENTS: ['ephemeral'], HOSTING: NOT_K8S, ...when }, category: 'operational', implements: ['adr-paas', 'adr-serverless', 'adr-vms', 'adr-cdn', 'adr-onprem-platform'], checks: ['req-ephemeral'],
    threshold: '0 ephemeral environments alive after their pull request closed or idle for more than {{EPHEMERAL_HOURS}} hours',
    description: `${description} Runs on Linux (GNU date).`,
    tool, language: 'bash', snippet,
  }))
}

const costReview = (id: string, when: When): RequirementSpec => ({
  id, label: 'Cost shown in review', when, ears_type: 'event-driven',
  trigger: 'a change to the infrastructure code is proposed',
  action: 'show its estimated monthly cost change in the pull request, and require the budget owner\'s approval when it adds more than {{COST_STEP}} a month',
  rationale: 'The cheapest moment to question a cost is before it is incurred (FinOps Framework, shift-left cost estimation).',
  scenario: { label: 'Costly change approved', given: 'a pull request that adds a large database instance', when: 'the cost estimate shows more than {{COST_STEP}} a month', then: 'the pull request cannot be merged until the budget owner adds the budget-approved label' },
})

const costEstimate = (id: string, when: When): RequirementSpec => ({
  id, label: 'Cost estimated in review', when, ears_type: 'event-driven',
  trigger: 'a change to the infrastructure code adds or resizes a priced resource',
  action: 'attach the provider\'s pricing-calculator estimate of the monthly change to the pull request, and require the budget owner\'s approval when it adds more than {{COST_STEP}} a month',
  rationale: 'The cheapest moment to question a cost is before it is incurred; no estimator reads Pulumi or CloudFormation code, so the reviewer makes the estimate (FinOps Framework, shift-left cost estimation).',
  scenario: { label: 'Costly change approved', given: 'a pull request that adds a large database instance', when: 'the reviewer\'s estimate shows more than {{COST_STEP}} a month', then: 'the pull request is not merged until the budget owner approves it' },
  unchecked: 'No tool estimates the cost of Pulumi, CloudFormation or Bicep changes: the reviewer attaches the pricing-calculator estimate to each infrastructure pull request, and the budget owner approves in the review above {{COST_STEP}} a month before it is merged.',
})

const k8sRequirement = (id: string, when: When): RequirementSpec => ({
  id, label: 'Workloads well specified', when, ears_type: 'ubiquitous',
  action: 'give every workload CPU and memory requests and a memory limit, readiness and liveness probes, at least 2 replicas with a PodDisruptionBudget in production, and a non-root, read-only root file system',
  rationale: 'Without these the scheduler cannot place, protect or restart pods correctly, and one pod can starve its node (Kubernetes documentation, configuration best practices; CIS Benchmarks for Kubernetes).',
  scenario: { label: 'Incomplete manifest refused', given: 'a deployment without a memory limit or a readiness probe', when: 'the manifest check runs', then: 'it fails naming what is missing' },
})

const checkov = ({ suffix, when, adr }: (typeof TERRAFORM)[number]): FitnessSpec => ({
  id: `ff-checkov${suffix}`, label: 'Plans pass policy', when, category: 'structural', implements: [adr], checks: ['req-policy'],
  threshold: '0 failed Checkov checks of the baseline (encryption, public access, open admin ports) and 0 taggable resources without owner, environment and cost-centre tags (labels on Google Cloud) in the plan of every pull request',
  description: 'Checkov scans the Terraform plan in every pull request with its built-in checks and a custom tagging policy over every taggable resource type of every provider (AWS and Azure resources carry tags, Google Cloud resources labels), and fails on any finding. Rules of your own go into Conftest policies over the same plan JSON.',
  tool: 'Checkov',
  language: 'yaml',
  snippet: `# policies/required_tags.yaml — custom check, run with --external-checks-dir policies
metadata:
  id: CKV2_ORG_TAGS
  name: Taggable resources carry owner, environment and cost-centre tags (labels on Google Cloud)
  category: GENERAL_SECURITY
definition:
  or:
    - and:
        - { cond_type: attribute, resource_types: taggable, attribute: tags.owner, operator: exists }
        - { cond_type: attribute, resource_types: taggable, attribute: tags.environment, operator: exists }
        - { cond_type: attribute, resource_types: taggable, attribute: tags.cost-centre, operator: exists }
    - and:
        - { cond_type: attribute, resource_types: taggable, attribute: labels.owner, operator: exists }
        - { cond_type: attribute, resource_types: taggable, attribute: labels.environment, operator: exists }
        - { cond_type: attribute, resource_types: taggable, attribute: labels.cost-centre, operator: exists }
# CI, in envs/<environment>:
#   terraform plan -out tf.plan && terraform show -json tf.plan > tf.json
#   checkov -f tf.json --framework terraform_plan --external-checks-dir ../../policies --compact`,
})

const terraformDrift = ({ suffix, when, adr }: (typeof TERRAFORM)[number]): FitnessSpec => ({
  id: `ff-drift-terraform${suffix}`, label: 'Drift detected', when, category: 'operational', implements: [adr], checks: ['req-drift', 'req-iac'],
  threshold: 'A drift check every {{DRIFT_HOURS}} hours per environment; 0 unexplained differences between code and infrastructure',
  description: 'A scheduled pipeline runs a refresh-only plan in each environment\'s root; exit code 2 means the infrastructure differs from the code, and the job opens an issue for the owning team.',
  tool: 'Terraform (plan -detailed-exitcode) with the GitHub CLI',
  language: 'bash',
  snippet: `#!/usr/bin/env bash
# scheduled every {{DRIFT_HOURS}} hours, in envs/$ENVIRONMENT
set -uo pipefail
terraform init -input=false >/dev/null
terraform plan -refresh-only -detailed-exitcode -input=false -no-color > drift.txt
case $? in
  0) echo "no drift" ;;
  2) gh issue create --title "Drift in $ENVIRONMENT" --body-file drift.txt --label drift; exit 1 ;;
  *) echo "plan failed"; exit 1 ;;
esac`,
})

const infracost = (id: string, when: When, req: string): FitnessSpec => ({
  id, label: 'Cost change in review', when, category: 'process', implements: ['adr-budget'], checks: [req],
  threshold: '100% of infrastructure pull requests show the monthly cost change; above {{COST_STEP}} a month the check fails until the pull request carries the label budget-approved',
  description: 'Infracost compares the cost of the pull request\'s Terraform with the main branch and comments the difference; the step then fails above the limit unless the budget owner has added the label budget-approved, which only they may add (a CODEOWNERS-protected label rule or a workflow that checks who added it).',
  tool: 'Infracost with the GitHub CLI',
  language: 'bash',
  snippet: `infracost breakdown --path . --format json --out-file base.json        # run on the main branch checkout
infracost diff --path . --compare-to base.json --format json --out-file diff.json
infracost comment github --path diff.json --repo "$GITHUB_REPOSITORY" \\
  --pull-request "$PR_NUMBER" --github-token "$GITHUB_TOKEN" --behavior update
increase=$(jq -r '(.diffTotalMonthlyCost // "0") | tonumber | floor' diff.json)
approved=$(gh pr view "$PR_NUMBER" --json labels -q '.labels[].name' | grep -cx budget-approved || true)
[ "$increase" -le {{COST_STEP}} ] || [ "$approved" -gt 0 ] \\
  || { echo "adds $increase a month: the budget owner adds the label budget-approved"; exit 1; }`,
})

const kubeScore = (id: string, when: When, adr: string, req: string): FitnessSpec => ({
  id, label: 'Manifests well specified', when, category: 'structural', implements: [adr], checks: [req],
  threshold: '0 critical kube-score findings in the rendered manifests (CPU and memory requests, memory limit, probes, replicas, PodDisruptionBudget, non-root user and group, read-only root file system, and kube-score\'s correctness checks), with the default checks the requirement does not ask for switched off',
  description: 'The rendered manifests of every chart or overlay are scored in each pull request; a critical finding fails the build. The chart renders its PodDisruptionBudget with the Deployment, so the deployment-has-poddisruptionbudget check sees both; the user-and-group and read-only-root-file-system checks are on by default in current kube-score. The defaults that ask for more than the requirement (a CPU limit, ephemeral-storage requests and limits, pull policy Always, a NetworkPolicy per pod, host anti-affinity) are switched off; network reachability is not decided in this pack.',
  tool: 'kube-score',
  language: 'bash',
  snippet: `helm template order-api charts/order-api -f charts/order-api/values-production.yaml \\
  | kube-score score - --output-format ci \\
      --ignore-container-cpu-limit \\
      --ignore-test container-ephemeral-storage-request-and-limit \\
      --ignore-test container-image-pull-policy \\
      --ignore-test pod-networkpolicy \\
      --ignore-test deployment-has-host-podantiaffinity \\
      --ignore-test statefulset-has-host-podantiaffinity`,
})

const pack: PackSpec = {
  id: 'concern-infrastructure',
  name: 'Infrastructure',
  group: 'technology',
  description: 'Where and how the element runs: the hosting model and the cloud, the infrastructure as code that builds it, the environments and their parity with production, cost guardrails and drift detection.',
  tags: ['technology', 'infrastructure', 'cloud', 'kubernetes', 'serverless', 'cdn', 'infrastructure as code', 'finops', 'drift'],
  concern: {
    id: 'infrastructure',
    trigger: 'LIST NODES WHERE (type = "container" OR type = "webapp") AND external != true',
    why: 'these elements are deployed and run somewhere, so the hosting, the cloud, how the infrastructure is built and what it may cost has to be decided.',
  },
  sources: [
    { title: 'The Twelve-Factor App: X. Dev/prod parity', url: 'https://12factor.net/dev-prod-parity' },
    { title: 'AWS Well-Architected Framework', url: 'https://aws.amazon.com/architecture/well-architected/' },
    { title: 'AWS Well-Architected: Serverless Applications Lens', url: 'https://docs.aws.amazon.com/wellarchitected/latest/serverless-applications-lens/welcome.html' },
    { title: 'Microsoft Azure Well-Architected Framework', url: 'https://learn.microsoft.com/en-us/azure/well-architected/' },
    { title: 'Google Cloud Architecture Framework', url: 'https://cloud.google.com/architecture/framework' },
    { title: 'CIS Benchmarks', url: 'https://www.cisecurity.org/cis-benchmarks' },
    { title: 'Kubernetes documentation: configuration best practices', url: 'https://kubernetes.io/docs/concepts/configuration/overview/' },
    { title: 'Terraform documentation', url: 'https://developer.hashicorp.com/terraform/docs' },
    { title: 'Checkov', url: 'https://www.checkov.io/' },
    { title: 'FinOps Framework (FinOps Foundation)', url: 'https://www.finops.org/framework/' },
    { title: 'Humble, Farley: Continuous Delivery', url: 'https://continuousdelivery.com/' },
    { title: 'Ford, Parsons, Kua, Sadalage: Building Evolutionary Architectures, 2nd ed.', url: 'https://www.oreilly.com/library/view/building-evolutionary-architectures/9781492097532/' },
  ],
  questions: [
    {
      key: 'HOSTING', title: 'Hosting', label: 'How does the element run?',
      hint: 'The hosting model decides how much of the platform the team runs itself, what the element may do (long requests, background work, state), and how it scales and is billed. A database\'s engine is hosted as the Data store pack decides.',
      default: 'paas',
      options: [
        { value: 'paas', label: 'a managed container platform (PaaS)', description: 'The provider runs the platform; you hand it a container or code. Google Cloud Run, Azure Container Apps or App Service, AWS App Runner or ECS on Fargate. Pick it by default for web apps and APIs when no platform team exists. In our own data centre there is no provider to run it: it is provided on our Kubernetes with Knative instead.' },
        { value: 'kubernetes', label: 'containers on Kubernetes', description: 'Managed Kubernetes (EKS, AKS, GKE) or an on-premises distribution (OpenShift, Rancher). Pick it when many services share a platform run by a platform team, or workloads need what a PaaS cannot (sidecars, operators, custom networking, portability).' },
        { value: 'serverless', label: 'serverless functions', description: 'AWS Lambda, Azure Functions or Google Cloud Functions, run per event and billed per invocation. Pick it for spiky or event-driven work with short executions, when idle cost should be zero. In our own data centre there is no provider to run it: functions run on our Kubernetes with Knative Functions or OpenFaaS instead.' },
        { value: 'vms', label: 'virtual machines', description: 'Virtual machines built from images, behind a load balancer. Pick it for software that cannot be containerised (licensed products, legacy runtimes, special kernels) or an on-premises virtualisation platform.' },
        { value: 'cdn', label: 'static files on object storage behind a CDN', description: 'Pre-built files in a private bucket served through a CDN with TLS: Amazon CloudFront with S3, Azure Front Door with Blob Storage, Cloud CDN with Cloud Storage, or a static host (Cloudflare Pages, Netlify). Pick it for a front end built in advance (the Frontend stack pack\'s static rendering) or documentation; nothing runs on request.' },
      ],
    },
    {
      key: 'CLOUD', title: 'Cloud', label: 'Where does it run?',
      hint: 'Choose by the team\'s skills, existing contracts and identity, the managed services you need, and where the data may be kept. Moving later is a project.',
      default: 'aws',
      options: [
        { value: 'aws', label: 'Amazon Web Services', description: 'The broadest set of services and regions. Pick it when the team knows AWS, or you need its specific services (DynamoDB, the widest serverless set).' },
        { value: 'azure', label: 'Microsoft Azure', description: 'Strong with Microsoft identity (Entra ID), .NET and enterprise agreements. Pick it when the organisation runs on Microsoft 365 and Entra ID, or has an Azure commitment.' },
        { value: 'gcp', label: 'Google Cloud', description: 'Strong in Kubernetes (GKE), data and analytics (BigQuery) and Cloud Run. Pick it when those services decide, or the team knows Google Cloud. Its own infrastructure tool (Infrastructure Manager) runs Terraform: answer Terraform below.' },
        { value: 'onprem', label: 'our own data centre', description: 'Servers and virtualisation we run. Pick it when data may not leave the premises, the load is steady enough that owned hardware is cheaper, or regulation demands it, and people run the hardware. A managed platform or functions are then provided on our own Kubernetes (Knative), the cloud\'s own infrastructure tool means Terraform, and no cloud budget applies.' },
      ],
    },
    {
      key: 'IAC', title: 'Infrastructure as code', label: 'What describes the infrastructure in code?',
      hint: 'Infrastructure built in a console cannot be reviewed, repeated or rebuilt; the tool decides the language, the state and which clouds it reaches.',
      default: 'terraform',
      options: [
        { value: 'terraform', label: 'Terraform or OpenTofu', description: 'HCL with providers for every cloud and many SaaS products, state in a remote backend. Pick it by default, and whenever more than one cloud or SaaS is involved; OpenTofu when an open-source licence matters.' },
        { value: 'pulumi', label: 'Pulumi', description: 'Infrastructure in TypeScript, Python, Go or C#, with the same providers. Pick it when the team would rather write infrastructure in the language it already uses, with loops, functions and tests.' },
        { value: 'native', label: 'the cloud\'s own (CloudFormation or CDK on AWS, Bicep on Azure)', description: 'AWS CloudFormation or the AWS CDK, or Azure Bicep, with state kept by the cloud. Pick it when only one of these two clouds is used and its newest features matter on the day they ship. Not with Google Cloud (its Infrastructure Manager runs Terraform) or our own data centre: with those, the infrastructure is written in Terraform.' },
      ],
    },
    {
      key: 'ENVIRONMENTS', title: 'Environments', label: 'Which environments are there?',
      hint: 'Environments that differ from production hide its bugs; environments that are never torn down cost money every hour.',
      default: 'staged',
      options: [
        { value: 'staged', label: 'development, staging and production', description: 'Long-lived environments, staging a scaled-down copy of production. Pick it when releases are tested together before going live, or regulation asks for a pre-production environment.' },
        { value: 'ephemeral', label: 'one per pull request, plus staging and production', description: 'Each pull request gets a short-lived environment built from the same code, destroyed when it closes. Pick it when environments can be created in minutes and several changes are tested in parallel.' },
        { value: 'minimal', label: 'one test environment and production', description: 'A single shared test environment, and production where releases are proven as the Deployment and rollback pack decides (canaries, rollback). Pick it for small systems and teams that release small changes often with fast rollback.' },
      ],
    },
  ],
  details: [
    { key: 'BUDGET_MONTHLY', label: 'What is the monthly cloud budget of the account or subscription (in the billing currency)? One per account: bind it once. Only in a public cloud', default: '5000', number: true },
    { key: 'BUDGET_ALERT_PERCENT', label: 'At what share of the budget, forecast for the month, does an alert go out (%)? Only in a public cloud', default: '80', number: true },
    { key: 'COST_STEP', label: 'Above what monthly cost increase does a change need the budget owner\'s approval (billing currency)? Only in a public cloud', default: '500', number: true },
    { key: 'DRIFT_HOURS', label: 'Within how many hours must drift from the code be detected?', default: '24', number: true },
    { key: 'EPHEMERAL_HOURS', label: 'After how many hours is an idle ephemeral environment destroyed?', default: '72', number: true },
  ],
  need: {
    label: 'Runs reproducibly within budget',
    text: 'The element has to run somewhere that suits its load and the team\'s skills, and that somewhere has to be built from reviewed code, so it can be rebuilt after a disaster and repeated for every environment. Test environments must behave like production, nothing may change outside the code unnoticed, and the bill must stay within a known budget, with warnings before it is exceeded rather than after. The checks assume one infrastructure repository with envs/<environment>/ holding each environment\'s root (staging, production, test), policies/ holding the policy files, charts/<name> holding a Helm chart, infra/ holding CloudFormation or Bicep templates, and ephemeral environments named pr-<number>.',
  },
  forces: FORCES,
  requirements: [
    {
      id: 'req-iac', label: 'Infrastructure is code', ears_type: 'ubiquitous',
      action: 'define 100% of the infrastructure as code in version control, in the tool the infrastructure-as-code decision names, applied only by the pipeline after a reviewed plan, with 0 changes made by hand to any shared environment',
      rationale: 'Code can be reviewed, repeated and rebuilt after a disaster; a console click can do none of these (AWS Well-Architected, Operational Excellence: perform operations as code).',
      scenario: { label: 'Change goes through the pipeline', given: 'a change to the infrastructure', when: 'it is proposed', then: 'it arrives as a pull request with a plan, only the pipeline applies it after review, and a change made by hand shows up in the next drift check' },
    },
    {
      id: 'req-policy', label: 'Plans checked against policy', ears_type: 'event-driven',
      trigger: 'a plan for an infrastructure change is produced',
      action: 'check it against the security and tagging baseline (encryption at rest, no public storage, no administration port open to the internet, owner, environment and cost-centre tags on every taggable resource) and refuse to apply it on any failed check',
      rationale: 'Misconfiguration is the commonest cause of cloud breaches; a check before apply costs nothing compared to one after (CIS Benchmarks; Azure Well-Architected, Security).',
      scenario: { label: 'Public bucket refused', given: 'a change that makes a storage bucket public and has no owner tag', when: 'the pipeline checks the plan', then: 'it fails naming both findings and nothing is applied' },
    },
    {
      id: 'req-parity', label: 'Environments match production', ears_type: 'ubiquitous',
      action: 'build every environment from the same infrastructure code and deploy the same artefacts to it, differing from production only in the values of its variable files, with the same engine versions of every backing service',
      rationale: 'Gaps between environments in time, people and tools hide the bugs that only production shows (The Twelve-Factor App, X. Dev/prod parity).',
      scenario: { label: 'Same code everywhere', given: 'the test environment\'s and production\'s folders under envs/', when: 'they are compared', then: 'they differ only in their variable files' },
    },
    {
      id: 'req-drift', label: 'Drift detected', ears_type: 'unwanted-behaviour',
      unwanted_condition: 'the running infrastructure differs from its code',
      action: 'detect it within {{DRIFT_HOURS}} hours, report it to the owning team, and revert it or bring it into the code within 5 working days',
      rationale: 'A change outside the code is undone or broken by the next apply, and makes the code a false description of what runs (Terraform documentation, drift; Building Evolutionary Architectures).',
      scenario: { label: 'Manual change found', given: 'a security group changed by hand in the console', when: 'the drift check runs', then: 'within {{DRIFT_HOURS}} hours the owning team is told which resource differs and how' },
    },
    {
      id: 'req-budget', label: 'Budget alerts before overspend', when: { CLOUD: PUBLIC_CLOUDS }, ears_type: 'event-driven',
      trigger: 'the forecast spend of the account for the month reaches {{BUDGET_ALERT_PERCENT}}% of its budget of {{BUDGET_MONTHLY}}',
      action: 'alert the owning team and the budget owner the same day, with the services that grew',
      rationale: 'Cloud spend grows quietly; a forecast alert leaves time to act within the month (FinOps Framework, budget management; AWS Well-Architected, Cost Optimization).',
      scenario: { label: 'Forecast alert', given: 'an account with a monthly budget of {{BUDGET_MONTHLY}}', when: 'the forecast passes {{BUDGET_ALERT_PERCENT}}% of it', then: 'the owning team and the budget owner are alerted the same day' },
    },
    costReview('req-cost-review', { IAC: ['terraform'], CLOUD: PUBLIC_CLOUDS }),
    costReview('req-cost-review-fallback', { IAC: ['native'], CLOUD: ['gcp'] }),
    costEstimate('req-cost-estimate', { IAC: ['pulumi'], CLOUD: PUBLIC_CLOUDS }),
    costEstimate('req-cost-estimate-native', NATIVE),
    {
      id: 'req-paas', label: 'Stateless and scaled', when: { HOSTING: ['paas'], CLOUD: PUBLIC_CLOUDS }, ears_type: 'ubiquitous',
      action: 'keep the element stateless, with no local file or session surviving an instance restart, run at least 2 instances in production and scale out automatically on load',
      rationale: 'A platform may stop or move any instance at any time; stateless processes make that harmless (The Twelve-Factor App, VI. Processes and IX. Disposability).',
      scenario: { label: 'Instance lost harmlessly', given: 'the production service with its scaling settings read', when: 'one of its instances is stopped by the platform', then: 'at least 2 were running, a replacement starts within the autoscaling range, and no request or session is lost beyond retries' },
    },
    k8sRequirement('req-k8s', { HOSTING: ['kubernetes'] }),
    k8sRequirement('req-k8s-onprem', ONPREM_PLATFORM),
    {
      id: 'req-functions', label: 'Functions bounded', when: { HOSTING: ['serverless'], CLOUD: PUBLIC_CLOUDS }, ears_type: 'ubiquitous',
      action: 'give every function a concurrency or instance limit that protects what it calls, and a dead-letter queue or failure destination for failed asynchronous events; cold starts are bounded as the Capacity and scaling pack decides',
      rationale: 'Unbounded functions scale until something downstream breaks, and silently lose failed events (AWS Well-Architected, Serverless Applications Lens).',
      scenario: { label: 'Burst stays bounded', given: 'a burst of events far above normal', when: 'the functions process it', then: 'concurrency stays at its limit, the database is not overloaded, and failed events land in the dead-letter queue' },
    },
    {
      id: 'req-images', label: 'Machines are replaced', when: { HOSTING: ['vms'] }, ears_type: 'ubiquitous',
      action: 'build every machine from a versioned image that records its build time, replace machines instead of changing them, with 0 changes over SSH in production and no machine running an image older than 30 days',
      rationale: 'Machines changed by hand drift apart and cannot be rebuilt; images rebuilt monthly carry the operating system\'s patches (AWS Well-Architected, Reliability: immutable infrastructure).',
      scenario: { label: 'Old image replaced', given: 'a machine whose image was built 31 days ago', when: 'the image-age alert evaluates', then: 'it fires and the machine is replaced from the current image' },
    },
    {
      id: 'req-cdn', label: 'Served only through the CDN', when: { HOSTING: ['cdn'] }, ears_type: 'ubiquitous',
      action: 'serve the files only through the CDN over TLS with HSTS, from an origin bucket that refuses direct requests, with every content-hashed asset cached for a year and every HTML page revalidated on each request',
      rationale: 'An origin reachable directly bypasses the CDN\'s TLS, caching and protections; a hashed asset never changes, so it can be cached for a year, while a page cached without revalidation keeps users on an old build after a publish (AWS Well-Architected, Security and Performance Efficiency).',
      scenario: { label: 'Origin refuses direct request', given: 'the deployed site', when: 'a page and one of its hashed assets are requested through the CDN, and the page directly from the origin', then: 'the CDN answers over TLS with HSTS, the page marked for revalidation and the asset cached for a year, and the origin refuses' },
    },
    {
      id: 'req-ephemeral', label: 'Ephemeral environments cleaned up', when: { ENVIRONMENTS: ['ephemeral'] }, ears_type: 'event-driven',
      trigger: 'a pull request is closed, or its environment has been idle for {{EPHEMERAL_HOURS}} hours',
      action: 'destroy its environment and everything in it within 1 hour',
      rationale: 'Environments per pull request pay off only when they disappear; forgotten ones are the commonest waste in cloud bills (FinOps Framework, workload optimisation).',
      scenario: { label: 'Environment removed', given: 'an ephemeral environment of a pull request', when: 'the pull request is merged', then: 'within 1 hour the environment and its resources are gone' },
    },
    {
      id: 'req-staging', label: 'Tested artefact promoted', when: { ENVIRONMENTS: ['staged', 'ephemeral'] }, ears_type: 'event-driven',
      trigger: 'a release is promoted to production',
      action: 'deploy exactly the artefact, by digest, that the latest staging deployment tested',
      rationale: 'Promoting the tested artefact, not a rebuild, keeps the staging test meaningful (Humble, Farley: Continuous Delivery).',
      scenario: { label: 'Tested artefact promoted', given: 'a build tested on staging', when: 'it is released', then: 'the same artefact, by digest, runs in production, and a different digest is refused' },
    },
  ],
  adrs: [
    {
      id: 'adr-paas', label: 'Runs on a managed platform', when: { HOSTING: ['paas'], CLOUD: PUBLIC_CLOUDS },
      decision: `The element runs as a container on a managed platform in {{CLOUD}}: Google Cloud Run, Azure Container Apps (App Service for plain web apps), or AWS App Runner or ECS on Fargate, with at least 2 instances in production and autoscaling above them. ${COMMON} ${ELSEWHERE} Choosing the platform: the one in the chosen cloud that runs plain containers with scale-to-zero or autoscaling and managed TLS; avoid platform-specific build packs so the container can move.`,
      consequences: '• No nodes, clusters or operating systems to patch; scaling, TLS and rollouts come with the platform.\n• Limits on what can run: request timeouts, no privileged containers, limited networking and sidecars.\n• Tied to the provider\'s platform, but a plain container moves to another with little change.\n• Per-request or per-instance billing; two instances kept warm are the floor of the bill.',
      alternatives: '1. Kubernetes: runs anything, at the cost of running a cluster.\n2. Serverless functions: lower idle cost, a different programming model.\n3. Virtual machines: full control, all the operations work.',
    },
    {
      id: 'adr-kubernetes', label: 'Runs on Kubernetes', when: { HOSTING: ['kubernetes'] },
      decision: `The element runs as containers on Kubernetes in {{CLOUD}}: Amazon EKS, Azure AKS or Google GKE (Autopilot where it fits), or OpenShift or Rancher on premises. Manifests are Helm charts under charts/<name> or Kustomize overlays deployed by GitOps (Argo CD or Flux); every workload has requests and limits, probes, a PodDisruptionBudget and runs as non-root with a read-only root file system. The clusters and what surrounds them are infrastructure like any other: ${COMMON} Argo CD shows drift of the manifests. ${ELSEWHERE} Choose Kubernetes only with a platform team, or a managed offering that removes node operations.`,
      consequences: '• Runs anything that fits in a container, with the same model in every cloud and on premises.\n• A platform to run: cluster upgrades every few months (each minor is supported for about 14 months), add-ons, networking, security policies.\n• A large ecosystem (CNCF) for observability, policy, service mesh and operators, each one more thing to keep up.\n• Cost depends on packing workloads well; requests that are too high waste nodes.',
      alternatives: '1. A managed container platform: far less to run, fewer options.\n2. Serverless functions: no cluster at all, a different programming model.\n3. Nomad or plain container hosts: simpler, smaller ecosystem.',
    },
    {
      id: 'adr-serverless', label: 'Runs as serverless functions', when: { HOSTING: ['serverless'], CLOUD: PUBLIC_CLOUDS },
      decision: `The element runs as serverless functions in {{CLOUD}}: AWS Lambda, Azure Functions or Google Cloud Functions (Cloud Run functions), triggered by HTTP through an API gateway and by queues and events. Each function has a concurrency or instance limit and a dead-letter queue or failure destination for asynchronous events. ${COMMON} The AWS SAM or the Serverless Framework may sit on top of the infrastructure tool. ${ELSEWHERE} Choose functions for event-driven and spiky work with executions under a few minutes; long-running or steady-load work goes to containers.`,
      consequences: '• No servers to run; scales from zero to large bursts, billed per invocation.\n• Cold starts add latency to the first requests; execution time, payload size and connections are limited.\n• Steady high load can cost more than containers; the bill follows traffic, so budgets and alerts matter.\n• Closely tied to the provider\'s events, gateway and permissions model; moving is a rewrite of the glue.',
      alternatives: '1. A managed container platform with scale-to-zero (Cloud Run, Container Apps): containers without cold-start limits on code shape.\n2. Kubernetes with KEDA for event-driven scaling.\n3. Virtual machines: steady cost, no limits, all the operations.',
    },
    {
      id: 'adr-vms', label: 'Runs on virtual machines', when: { HOSTING: ['vms'] },
      decision: `The element runs on virtual machines in {{CLOUD}} (EC2 Auto Scaling groups, Azure Virtual Machine Scale Sets, Google Compute Engine managed instance groups, or VMware or Proxmox on premises), built from versioned images made with Packer that record their build time, and replaced rather than changed; configuration at boot with cloud-init or Ansible, and no changes over SSH in production. ${COMMON} ${ELSEWHERE} Choose machines only for what cannot run in a container: licensed or legacy software, special kernels or hardware.`,
      consequences: '• Full control: any software, any kernel, any agent.\n• All the operations work: operating system patches, image builds, scaling groups, load balancers.\n• Slower to scale and to roll out than containers; images must be rebuilt at least monthly.\n• Steady, predictable cost; reserved instances or savings plans reduce it.',
      alternatives: '1. A managed container platform: no machines to patch, if the software fits in a container.\n2. Kubernetes: containers with control, plus a cluster to run.\n3. Configuration management on long-lived machines (Ansible, Puppet): familiar, but machines drift apart.',
    },
    {
      id: 'adr-cdn', label: 'Served from object storage behind a CDN', when: { HOSTING: ['cdn'] },
      decision: `The element is a set of pre-built files in a private bucket in {{CLOUD}}, served only through a CDN over TLS with HSTS: Amazon CloudFront with S3 (origin access control), Azure Front Door with Blob Storage, Cloud CDN with Cloud Storage, or a static host such as Cloudflare Pages or Netlify; on premises, a web server with a cache in front. Hashed assets are cached for a year, HTML revalidated, as the Frontend stack pack's caching rules say. ${COMMON} ${ELSEWHERE} Choose it only when nothing runs on request; an API behind the same domain is its own element with its own hosting.`,
      consequences: '• Nothing to run, patch or scale; the cheapest and most available hosting there is.\n• Every page is the same for everyone until the next publish; personalisation and sign-in need another element.\n• The origin must stay private, or the CDN\'s TLS, caching and protections are bypassed.\n• Cache invalidation on publish is the one operational step; a bad publish is undone by publishing the previous build.',
      alternatives: '1. A managed container platform serving the files: more to run, no CDN edge unless added.\n2. A web server on a virtual machine: full control, all the operations work.\n3. Server rendering: personalised pages, a server to run and scale.',
    },
    {
      id: 'adr-onprem-platform', label: 'A platform on our own Kubernetes', when: ONPREM_PLATFORM,
      decision: `The hosting chosen, {{HOSTING}}, has no provider to run it in our own data centre, so the platform team provides the same model on our Kubernetes (OpenShift or Rancher): Knative Serving runs containers that scale with requests, down to zero, and Knative Functions or OpenFaaS run functions triggered by HTTP and by events. Every workload has CPU and memory requests and a memory limit, probes, at least 2 replicas with a PodDisruptionBudget in production, and runs as non-root with a read-only root file system. ${COMMON} ${ELSEWHERE}`,
      consequences: '• The element keeps the platform\'s programming model: a container or a function, scaled for it.\n• Someone runs the cluster and Knative: upgrades, capacity and the hardware under them are the platform team\'s work.\n• Scaling stops at the hardware we own; bursts beyond it wait or fail.\n• Moving to a public cloud later is a change of platform, not of the element.',
      alternatives: '1. Plain Kubernetes Deployments without Knative: one model less, no scale to zero.\n2. Virtual machines: no cluster, all the operations work.\n3. A public cloud\'s managed platform: no cluster to run, if the data may leave the premises.',
    },
    {
      id: 'adr-budget', label: 'Cloud spend held to a budget', when: { CLOUD: PUBLIC_CLOUDS },
      decision: 'The account (AWS account, Azure subscription or Google Cloud billing account) has a monthly cost budget of {{BUDGET_MONTHLY}} in the billing currency, with a forecast alert at {{BUDGET_ALERT_PERCENT}}% to the owning team and the budget owner; the budget is part of the infrastructure code (aws_budgets_budget, azurerm_consumption_budget_subscription, google_billing_budget). One budget per account, bound once, not per element. A change that adds more than {{COST_STEP}} a month needs the budget owner\'s approval: with Terraform, Infracost shows the change in the pull request and a label records the approval; with Pulumi or the cloud\'s own tool, which no estimator reads, the reviewer attaches the pricing calculator\'s estimate.',
      consequences: '• Overspend is seen within the month, from the forecast, not on the invoice.\n• Every costly change has a named approver before it ships.\n• The budget and the approval step need an owner who answers within a day, or changes wait.',
      alternatives: '1. Monthly review of the invoice: no tooling, and the money is spent before anyone looks.\n2. Hard spending caps: they stop the bill and the service with it.',
    },
    {
      id: 'adr-iac-terraform', label: 'Infrastructure in Terraform', when: { IAC: ['terraform'] },
      decision: 'The infrastructure is described in Terraform (OpenTofu where an open-source licence matters): one root per environment under envs/<environment>/, shared modules versioned, state in a remote backend with locking (S3, Azure Storage, Google Cloud Storage or HCP Terraform). Every pull request produces a plan, checked by Checkov against the security and tagging baseline; only the pipeline applies, after review; a refresh-only plan every {{DRIFT_HOURS}} hours reports drift.',
      consequences: '• One language and workflow for every cloud and most SaaS products.\n• The state file is critical and holds secrets: its backend, locking and access need care.\n• HCL has limited abstraction; large estates need module conventions.',
      alternatives: '1. Pulumi: the same providers in a general-purpose language.\n2. The cloud\'s own tool (CloudFormation, Bicep): state kept by the cloud, one cloud only.',
    },
    {
      id: 'adr-iac-pulumi', label: 'Infrastructure in Pulumi', when: { IAC: ['pulumi'] },
      decision: 'The infrastructure is written with Pulumi in the language the team already uses, one stack per environment, state in Pulumi Cloud or a self-managed backend (S3, Azure Blob Storage, Google Cloud Storage). A CrossGuard policy pack runs with every preview and stops on a mandatory violation of the security and tagging baseline; only the pipeline runs pulumi up, after review; a refreshed preview every {{DRIFT_HOURS}} hours reports drift.',
      consequences: '• Loops, functions, types and unit tests for infrastructure, in the team\'s language.\n• Infrastructure code can grow as complex as application code; it needs the same review discipline.\n• Fewer ready-made scanners and cost estimators read Pulumi than Terraform.',
      alternatives: '1. Terraform: the widest ecosystem of scanners and estimators.\n2. The cloud\'s own tool: one cloud, state kept by the cloud.',
    },
    {
      id: 'adr-iac-native', label: 'Infrastructure in the cloud\'s own tool', when: NATIVE,
      decision: 'The infrastructure is described in the cloud\'s own tool: CloudFormation, written directly or synthesised from the AWS CDK, on AWS; Bicep on Azure. Templates live under infra/ with a parameter file per environment, and the cloud keeps the state. Checkov scans the templates in every pull request; tags are enforced at deployment by AWS Organizations tag policies or Azure Policy; only the pipeline deploys, after review; CloudFormation drift detection or a Bicep what-if every {{DRIFT_HOURS}} hours reports drift.',
      consequences: '• No state to run, and the newest services on the day they ship.\n• One cloud only: a second cloud or a SaaS product needs another tool.\n• Fewer policy and cost tools read the templates than read Terraform.',
      alternatives: '1. Terraform: every cloud and SaaS, a state backend to run.\n2. Pulumi: a general-purpose language, the same providers as Terraform.',
    },
    {
      id: 'adr-iac-native-fallback', label: 'Infrastructure in Terraform, as the cloud has no tool of its own', when: TERRAFORM[1].when,
      decision: 'The cloud\'s own tool was chosen, but {{CLOUD}} has no CloudFormation or Bicep: Google Cloud\'s own tool, Infrastructure Manager, deploys Terraform configurations, and our own data centre has no provider tool at all. The infrastructure is therefore described in Terraform, deployed through Infrastructure Manager on Google Cloud and by the pipeline in our own data centre: one root per environment under envs/<environment>/, state in a remote backend with locking, a plan checked by Checkov in every pull request, applied only after review, and a refresh-only plan every {{DRIFT_HOURS}} hours reporting drift.',
      consequences: '• The checks of this pack for Terraform apply as they are.\n• On Google Cloud, Infrastructure Manager keeps the state and the deployment history; elsewhere the backend is ours to run.\n• HCL has limited abstraction; large estates need module conventions.',
      alternatives: '1. Pulumi: the same providers in a general-purpose language.\n2. Deployment Manager on Google Cloud: retired in favour of Infrastructure Manager.',
    },
  ],
  fitness: [
    ...TERRAFORM.map(checkov),
    {
      id: 'ff-checkov-native', label: 'Templates pass policy', when: NATIVE, category: 'structural', implements: ['adr-iac-native'], checks: ['req-policy'],
      threshold: '0 failed Checkov checks of the baseline (encryption, public access, open admin ports) in the CloudFormation or Bicep templates of every pull request',
      description: 'Checkov scans the CloudFormation (synthesised from the CDK with cdk synth) or Bicep templates under infra/ in every pull request with its built-in checks and fails on any finding. Tags are enforced at deploy time by the cloud (AWS Organizations tag policies, Azure Policy "Require a tag on resources"), not by this check.',
      tool: 'Checkov',
      language: 'bash',
      snippet: `#!/usr/bin/env bash
# CloudFormation (AWS, incl. cdk synth output) and Bicep (Azure) templates under infra/
set -euo pipefail
checkov --directory infra --framework cloudformation,bicep --compact`,
    },
    {
      id: 'ff-crossguard', label: 'Previews pass policy', when: { IAC: ['pulumi'] }, category: 'structural', implements: ['adr-iac-pulumi'], checks: ['req-policy'],
      threshold: '0 mandatory policy violations in the preview of every pull request: missing owner, environment or cost-centre tags on the listed resource types, public storage',
      description: 'A Pulumi CrossGuard policy pack runs with every preview and update and stops on a mandatory violation. The tag rule covers the listed resource types of AWS, Azure and Google Cloud (labels there); the public-storage rule knows each cloud\'s bucket setting. Extend the lists with the resource types the stacks use.',
      tool: 'Pulumi CrossGuard (@pulumi/policy)',
      language: 'ts',
      snippet: `// policy/index.ts — pulumi preview --policy-pack policy
import { PolicyPack, type ResourceValidationArgs } from '@pulumi/policy'

const TAGGED = new Set([
  'aws:ec2/instance:Instance', 'aws:rds/instance:Instance', 'aws:s3/bucketV2:BucketV2', 'aws:ecs/service:Service', 'aws:lambda/function:Function',
  'azure-native:compute:VirtualMachine', 'azure-native:storage:StorageAccount', 'azure-native:app:ContainerApp', 'azure-native:web:WebApp',
  'gcp:compute/instance:Instance', 'gcp:storage/bucket:Bucket', 'gcp:cloudrunv2/service:Service', 'gcp:cloudfunctions2/function:Function',
])
const PRIVATE: Record<string, (props: Record<string, any>) => boolean> = {
  'aws:s3/bucketPublicAccessBlock:BucketPublicAccessBlock': (p) => p.blockPublicAcls && p.blockPublicPolicy,
  'azure-native:storage:StorageAccount': (p) => p.allowBlobPublicAccess === false,
  'gcp:storage/bucket:Bucket': (p) => p.publicAccessPrevention === 'enforced',
}

new PolicyPack('baseline', {
  policies: [
    {
      name: 'required-tags', enforcementLevel: 'mandatory',
      description: 'Every listed resource carries owner, environment and cost-centre tags (labels on Google Cloud).',
      validateResource: (args: ResourceValidationArgs, report) => {
        if (!TAGGED.has(args.type)) return
        const tags = args.props.tags ?? args.props.labels ?? {}
        for (const tag of ['owner', 'environment', 'cost-centre']) if (!tags[tag]) report(\`\${args.type} \${args.name}: missing tag "\${tag}"\`)
      },
    },
    {
      name: 'no-public-storage', enforcementLevel: 'mandatory',
      description: 'Public access is blocked on every bucket.',
      validateResource: (args: ResourceValidationArgs, report) => {
        const isPrivate = PRIVATE[args.type]
        if (isPrivate && !isPrivate(args.props)) report(\`\${args.type} \${args.name}: public access must be blocked\`)
      },
    },
  ],
})`,
    },
    ...TERRAFORM.map(terraformDrift),
    {
      id: 'ff-drift-pulumi', label: 'Drift detected', when: { IAC: ['pulumi'] }, category: 'operational', implements: ['adr-iac-pulumi'], checks: ['req-drift', 'req-iac'],
      threshold: 'A drift check every {{DRIFT_HOURS}} hours per stack; 0 unexplained differences between code and infrastructure',
      description: 'A scheduled pipeline refreshes each stack in preview and fails when anything changed outside the code; Pulumi Deployments can run the same as a scheduled drift detection.',
      tool: 'Pulumi (preview --refresh --expect-no-changes)',
      language: 'bash',
      snippet: `#!/usr/bin/env bash
# scheduled every {{DRIFT_HOURS}} hours per stack
set -euo pipefail
pulumi stack select "$STACK"
pulumi preview --refresh --expect-no-changes --diff --non-interactive`,
    },
    {
      id: 'ff-drift-native', label: 'Drift detected', when: NATIVE, category: 'operational', implements: ['adr-iac-native'], checks: ['req-drift', 'req-iac'],
      threshold: 'A drift check every {{DRIFT_HOURS}} hours; 0 CloudFormation stacks in DRIFTED state, 0 resources a Bicep what-if would change',
      description: 'A scheduled job runs the part for the cloud in use (the CLOUD variable of the pipeline): on AWS it starts CloudFormation drift detection on every stack and fails when one is DRIFTED; on Azure it runs a what-if of the deployed Bicep template against the resource group and fails on any change other than NoChange or Ignore.',
      tool: 'AWS CloudFormation drift detection (AWS CLI); Azure: az deployment group what-if',
      language: 'bash',
      snippet: `#!/usr/bin/env bash
# scheduled every {{DRIFT_HOURS}} hours; the pipeline sets CLOUD to aws or azure
set -euo pipefail
failed=0
case "$CLOUD" in
  aws)
    for stack in $(aws cloudformation list-stacks --stack-status-filter CREATE_COMPLETE UPDATE_COMPLETE \\
                   --query 'StackSummaries[].StackName' --output text); do
      id=$(aws cloudformation detect-stack-drift --stack-name "$stack" --query StackDriftDetectionId --output text)
      until [ "$(aws cloudformation describe-stack-drift-detection-status --stack-drift-detection-id "$id" \\
                --query DetectionStatus --output text)" != DETECTION_IN_PROGRESS ]; do sleep 5; done
      status=$(aws cloudformation describe-stack-drift-detection-status --stack-drift-detection-id "$id" \\
               --query StackDriftStatus --output text)
      [ "$status" != DRIFTED ] || { echo "$stack has drifted"; failed=1; }
    done ;;
  azure)
    changes=$(az deployment group what-if --resource-group "$RESOURCE_GROUP" --template-file infra/main.bicep \\
      --parameters "infra/$ENVIRONMENT.bicepparam" --no-pretty-print --exclude-change-types NoChange Ignore \\
      --query 'changes[].[resourceId, changeType]' --output tsv)
    [ -z "$changes" ] || { echo "$changes"; failed=1; } ;;
esac
exit $failed`,
    },
    budget('aws', 'AWS Budgets', 'AWS CLI (budgets)', `#!/usr/bin/env bash
# scheduled: the account's monthly cost budget with a forecast alert exists
set -euo pipefail
account=$(aws sts get-caller-identity --query Account --output text)
name=$(aws budgets describe-budgets --account-id "$account" \\
  --query "Budgets[?BudgetType=='COST' && TimeUnit=='MONTHLY' && to_number(BudgetLimit.Amount)==\\\`{{BUDGET_MONTHLY}}\\\`].BudgetName | [0]" --output text)
[ "$name" != None ] || { echo "no monthly cost budget of {{BUDGET_MONTHLY}} in account $account"; exit 1; }
aws budgets describe-notifications-for-budget --account-id "$account" --budget-name "$name" \\
  --query "Notifications[?NotificationType=='FORECASTED' && ThresholdType=='PERCENTAGE' && Threshold<=\\\`{{BUDGET_ALERT_PERCENT}}\\\`]" --output text | grep -q . \\
  || { echo "budget $name has no forecast alert at {{BUDGET_ALERT_PERCENT}} % or lower"; exit 1; }`),
    budget('azure', 'Azure Cost Management', 'Azure CLI (consumption budget) with jq', `#!/usr/bin/env bash
# scheduled: the subscription's monthly budget with a forecast alert exists
set -euo pipefail
az consumption budget list --output json | jq -e --argjson amount {{BUDGET_MONTHLY}} --argjson pct {{BUDGET_ALERT_PERCENT}} '
  map(select(.timeGrain == "Monthly" and .amount == $amount
    and any(.notifications[]?; .enabled and .thresholdType == "Forecasted" and .threshold <= $pct))) | length > 0' >/dev/null \\
  || { echo "no monthly budget of {{BUDGET_MONTHLY}} with a forecast alert at {{BUDGET_ALERT_PERCENT}} % or lower in this subscription"; exit 1; }`),
    budget('gcp', 'Cloud Billing budgets', 'gcloud (billing budgets) with jq', `#!/usr/bin/env bash
# scheduled: the billing account's monthly budget with a forecast alert exists
set -euo pipefail
gcloud billing budgets list --billing-account "$BILLING_ACCOUNT" --format=json | jq -e --argjson amount {{BUDGET_MONTHLY}} --argjson pct {{BUDGET_ALERT_PERCENT}} '
  map(select((.budgetFilter.calendarPeriod // "MONTH") == "MONTH" and (.amount.specifiedAmount.units | tonumber) == $amount
    and any(.thresholdRules[]?; .spendBasis == "FORECASTED_SPEND" and (.thresholdPercent * 100) <= $pct))) | length > 0' >/dev/null \\
  || { echo "no monthly budget of {{BUDGET_MONTHLY}} with a forecast alert at {{BUDGET_ALERT_PERCENT}} % or lower on $BILLING_ACCOUNT"; exit 1; }`),
    infracost('ff-infracost', { IAC: ['terraform'], CLOUD: PUBLIC_CLOUDS }, 'req-cost-review'),
    infracost('ff-infracost-fallback', { IAC: ['native'], CLOUD: ['gcp'] }, 'req-cost-review-fallback'),
    paas('aws', 'ECS on Fargate', 'AWS CLI (ecs, application-autoscaling); App Runner: describe-service and its auto-scaling configuration\'s MinSize', `#!/usr/bin/env bash
# production: the service keeps at least 2 tasks and has an autoscaling target above them
set -euo pipefail
desired=$(aws ecs describe-services --cluster "$CLUSTER" --services "$SERVICE" --query 'services[0].desiredCount' --output text)
read -r min max < <(aws application-autoscaling describe-scalable-targets --service-namespace ecs \\
  --resource-ids "service/$CLUSTER/$SERVICE" --query 'ScalableTargets[0].[MinCapacity, MaxCapacity]' --output text)
[ "$desired" -ge 2 ] && [ "$min" != None ] && [ "$min" -ge 2 ] && [ "$max" -gt "$min" ] \\
  || { echo "desired $desired, autoscaling $min-$max (at least 2, scaling above it)"; exit 1; }`),
    paas('azure', 'Container Apps', 'Azure CLI (containerapp)', `#!/usr/bin/env bash
# production: the container app keeps at least 2 replicas and scales above them
set -euo pipefail
read -r min max < <(az containerapp show --name "$APP" --resource-group "$RESOURCE_GROUP" \\
  --query '[properties.template.scale.minReplicas, properties.template.scale.maxReplicas]' --output tsv)
[ "$min" -ge 2 ] && [ "$max" -gt "$min" ] || { echo "replicas $min-$max (at least 2, scaling above it)"; exit 1; }`),
    paas('gcp', 'Cloud Run', 'gcloud (run services) with jq', `#!/usr/bin/env bash
# production: the service keeps at least 2 instances and scales above them
set -euo pipefail
read -r min max < <(gcloud run services describe "$SERVICE" --region "$REGION" --format=json \\
  | jq -r '.spec.template.metadata.annotations | "\\(.["autoscaling.knative.dev/minScale"] // 0) \\(.["autoscaling.knative.dev/maxScale"] // 0)"')
[ "$min" -ge 2 ] && [ "$max" -gt "$min" ] || { echo "instances $min-$max (at least 2, scaling above it)"; exit 1; }`),
    kubeScore('ff-kube-score', { HOSTING: ['kubernetes'] }, 'adr-kubernetes', 'req-k8s'),
    kubeScore('ff-kube-score-onprem', ONPREM_PLATFORM, 'adr-onprem-platform', 'req-k8s-onprem'),
    functions('aws', 'Lambda', '100% of functions have a concurrency limit (reserved concurrency, or a maximum concurrency on every SQS trigger) and a dead-letter queue or on-failure destination',
      'A check after each deploy lists the account\'s functions and fails on one with neither a reserved concurrency nor a maximum concurrency on each of its SQS triggers (the event source mapping\'s ScalingConfig, which caps the function\'s pollers without carving from the account\'s pool), or without either a dead-letter queue or an on-failure destination. Provisioned concurrency keeps instances warm but sets no ceiling, so it does not count as a limit.',
      'AWS CLI (lambda) with jq', `#!/usr/bin/env bash
# every function: a concurrency limit (reserved, or a maximum on every SQS trigger)
# and a dead-letter queue or on-failure destination
set -euo pipefail
fail=0
for fn in $(aws lambda list-functions --query 'Functions[].FunctionName' --output text); do
  reserved=$(aws lambda get-function-concurrency --function-name "$fn" --query ReservedConcurrentExecutions --output text)
  read -r sqs unbounded < <(aws lambda list-event-source-mappings --function-name "$fn" --output json | jq -r '
    [.EventSourceMappings[] | select(.EventSourceArn | startswith("arn:aws:sqs:"))]
    | "\\(length) \\(map(select(.ScalingConfig.MaximumConcurrency == null)) | length)"')
  dlq=$(aws lambda get-function-configuration --function-name "$fn" --query 'DeadLetterConfig.TargetArn' --output text)
  dest=$(aws lambda get-function-event-invoke-config --function-name "$fn" \\
    --query 'DestinationConfig.OnFailure.Destination' --output text 2>/dev/null || echo None)
  if [ "$reserved" = None ] && { [ "$sqs" -eq 0 ] || [ "$unbounded" -gt 0 ]; }; then
    echo "$fn: no concurrency limit (reserved, or a maximum concurrency on every SQS trigger)"; fail=1
  fi
  [ "$dlq" != None ] || [ "$dest" != None ] || { echo "$fn: no dead-letter queue or on-failure destination"; fail=1; }
done
exit $fail`),
    functions('azure', 'Azure Functions', '100% of function apps have a scale-out limit (functionAppScaleLimit above 0)',
      'A check after each deploy lists the subscription\'s function apps and fails on one whose site configuration has no scale-out limit. Failed Service Bus and Event Hubs events dead-letter on the queue itself, which the Messaging pack decides; Flex Consumption apps carry the limit in az functionapp scale config show instead.',
      'Azure CLI (functionapp)', `#!/usr/bin/env bash
# every function app: a scale-out limit
set -euo pipefail
fail=0
while IFS=$'\\t' read -r name group; do
  limit=$(az functionapp config show --name "$name" --resource-group "$group" --query functionAppScaleLimit --output tsv)
  [ "\${limit:-0}" -gt 0 ] || { echo "$name: no scale-out limit (functionAppScaleLimit)"; fail=1; }
done < <(az functionapp list --query '[].[name, resourceGroup]' --output tsv)
exit $fail`),
    functions('gcp', 'Cloud Run functions', '100% of functions have a maximum instance count, and every event-triggered one an explicit retry policy',
      'A check after each deploy lists the project\'s functions (2nd gen) and fails on one without a maximum instance count or, for an event trigger, without an explicit retry policy; failed events dead-letter on the Pub/Sub subscription, which the Messaging pack decides.',
      'gcloud (functions)', `#!/usr/bin/env bash
# every function: a maximum instance count; event-triggered ones an explicit retry policy
set -euo pipefail
fail=0
while IFS=, read -r name max trigger retry; do
  [ -n "$max" ] && [ "$max" -gt 0 ] || { echo "$name: no maximum instance count"; fail=1; }
  [ -z "$trigger" ] || [ -n "$retry" ] || { echo "$name: event trigger without an explicit retry policy"; fail=1; }
done < <(gcloud functions list --v2 --format='csv[no-heading](name, serviceConfig.maxInstanceCount, eventTrigger.trigger, eventTrigger.retryPolicy)')
exit $fail`),
    {
      id: 'ff-image-age', label: 'No machine on an old image', when: { HOSTING: ['vms'] }, category: 'operational', implements: ['adr-vms'], checks: ['req-images'],
      threshold: '0 machines whose image was built more than 30 days ago; the alert opens a ticket after 1 hour',
      description: 'Packer bakes the build time into /etc/image-release; at boot, cloud-init writes it as a node_exporter textfile metric, and a Prometheus rule fires for any machine whose image is older than 30 days, in every cloud and on premises alike.',
      tool: 'Prometheus with node_exporter (textfile collector)',
      language: 'yaml',
      snippet: `# at boot (cloud-init), from the file Packer baked in: /etc/image-release holds BUILD_DATE=<epoch seconds>
#   . /etc/image-release && echo "image_build_timestamp_seconds $BUILD_DATE" > /var/lib/node_exporter/textfile/image.prom
groups:
  - name: machine-images
    rules:
      - alert: MachineImageOlderThan30Days
        expr: time() - image_build_timestamp_seconds > 30 * 86400
        for: 1h
        labels: { severity: ticket }
        annotations:
          summary: "{{ $labels.instance }} runs an image built {{ $value | humanizeDuration }} ago; replace it from the current image"`,
    },
    {
      id: 'ff-cdn-origin', label: 'Only through the CDN', when: { HOSTING: ['cdn'] }, category: 'operational', implements: ['adr-cdn'], checks: ['req-cdn'],
      threshold: 'The site answers over TLS with an HSTS header; its page with Cache-Control no-cache (or max-age=0 with must-revalidate) and a content-hashed asset with max-age=31536000; the origin answers a direct request for the page with 403, 404 or 409',
      description: 'A check after each deploy fetches the page and one content-hashed asset of the build through the CDN and reads their headers against adr-cdn\'s caching rule (hashed assets cached for a year, the page revalidated), then requests the page directly from the origin bucket\'s URL and expects it refused: 403 or 404 from S3 and Cloud Storage, 409 (PublicAccessNotPermitted) from Azure Blob Storage with public access off.',
      tool: 'curl (post-deploy check)',
      language: 'bash',
      snippet: `#!/usr/bin/env bash
# SITE_URL: through the CDN; ORIGIN_URL: the bucket's own endpoint;
# ASSET_PATH: one content-hashed file of this build (by default the first script under dist/assets)
set -euo pipefail
asset=\${ASSET_PATH:-$(cd dist && ls assets/*.js | head -n 1)}
page=$(curl -fsSI "$SITE_URL/" | tr -d '\\r')
grep -qi '^strict-transport-security:' <<<"$page" || { echo "no HSTS header on $SITE_URL"; exit 1; }
page_cc=$(grep -i '^cache-control:' <<<"$page" || true)
[[ "$page_cc" =~ no-cache ]] || { [[ "$page_cc" =~ max-age=0([^0-9]|$) ]] && [[ "$page_cc" =~ must-revalidate ]]; } \\
  || { echo "the page is not revalidated on each request ($page_cc)"; exit 1; }
asset_cc=$(curl -fsSI "$SITE_URL/$asset" | tr -d '\\r' | grep -i '^cache-control:' || true)
[[ "$asset_cc" =~ max-age=31536000 ]] || { echo "$asset is not cached for a year ($asset_cc)"; exit 1; }
code=$(curl -s -o /dev/null -w '%{http_code}' "$ORIGIN_URL/index.html")
[ "$code" = 403 ] || [ "$code" = 404 ] || [ "$code" = 409 ] \\
  || { echo "origin $ORIGIN_URL answers $code to a direct request (must refuse)"; exit 1; }`,
    },
    {
      id: 'ff-ephemeral-k8s', label: 'No forgotten environments (namespaces)', when: { ENVIRONMENTS: ['ephemeral'], HOSTING: ['kubernetes'] }, category: 'operational', implements: ['adr-kubernetes'], checks: ['req-ephemeral'],
      threshold: '0 ephemeral namespaces alive after their pull request closed or idle for more than {{EPHEMERAL_HOURS}} hours',
      description: 'A scheduled job lists the namespaces labelled as ephemeral, deletes those whose pull request is closed or whose last deploy (an annotation the deploy writes) is past the limit, and reports what it removed. Runs on Linux (GNU date).',
      tool: 'kubectl with the GitHub CLI (scheduled job)',
      language: 'bash',
      snippet: `#!/usr/bin/env bash
set -euo pipefail
limit=$(( $(date +%s) - {{EPHEMERAL_HOURS}} * 3600 ))
kubectl get ns -l env-type=ephemeral -o json \\
  | jq -r '.items[] | [.metadata.name, .metadata.labels.pr, (.metadata.annotations["last-deploy"] // "")] | @tsv' |
while IFS=$'\\t' read -r ns pr last; do
  state=$(gh pr view "$pr" --repo "$GITHUB_REPOSITORY" --json state -q .state)
  if [ "$state" != OPEN ] || [ -z "$last" ] || [ "$(date -d "$last" +%s)" -lt "$limit" ]; then
    echo "deleting $ns (PR $pr $state, last deploy \${last:-unknown})"; kubectl delete ns "$ns" --wait=false
  fi
done`,
    },
    ...ephemeral('terraform', TERRAFORM, 'workspaces', 'A scheduled job lists the Terraform workspaces named pr-<number>, destroys those whose pull request is closed or last updated past the limit, and deletes the workspace.',
      'Terraform with the GitHub CLI (scheduled job)', `#!/usr/bin/env bash
# in envs/ephemeral; workspaces are named pr-<number>
set -euo pipefail
limit=$(( $(date +%s) - {{EPHEMERAL_HOURS}} * 3600 ))
for ws in $(terraform workspace list | tr -d '* ' | grep -E '^pr-[0-9]+$'); do
  pr=\${ws#pr-}
  read -r state updated < <(gh pr view "$pr" --repo "$GITHUB_REPOSITORY" --json state,updatedAt -q '"\\(.state) \\(.updatedAt)"')
  if [ "$state" != OPEN ] || [ "$(date -d "$updated" +%s)" -lt "$limit" ]; then
    echo "destroying $ws (PR $pr $state, last activity $updated)"
    terraform workspace select "$ws"
    terraform destroy -auto-approve -input=false -var "pr=$pr"
    terraform workspace select default && terraform workspace delete "$ws"
  fi
done`),
    ...ephemeral('pulumi', [{ suffix: '', when: { IAC: ['pulumi'] } }], 'stacks', 'A scheduled job lists the stacks named pr-<number> with their last update, destroys those whose pull request is closed or last updated past the limit, and removes the stack.',
      'Pulumi with the GitHub CLI (scheduled job)', `#!/usr/bin/env bash
# stacks are named pr-<number>
set -euo pipefail
limit=$(( $(date +%s) - {{EPHEMERAL_HOURS}} * 3600 ))
pulumi stack ls --json | jq -r '.[] | select(.name | test("^pr-[0-9]+$")) | "\\(.name) \\(.lastUpdate // "")"' |
while read -r stack last; do
  pr=\${stack#pr-}
  state=$(gh pr view "$pr" --repo "$GITHUB_REPOSITORY" --json state -q .state)
  if [ "$state" != OPEN ] || [ -z "$last" ] || [ "$(date -d "$last" +%s)" -lt "$limit" ]; then
    echo "destroying $stack (PR $pr $state, last update \${last:-unknown})"
    pulumi destroy --stack "$stack" --yes --non-interactive && pulumi stack rm "$stack" --yes
  fi
done`),
    ...ephemeral('native', [{ suffix: '', when: NATIVE }], 'stacks and resource groups', 'A scheduled job runs the part for the cloud in use (the CLOUD variable): on AWS it lists the CloudFormation stacks tagged pr=<number>, on Azure the resource groups tagged pr=<number>, and deletes those whose pull request is closed or last updated past the limit.',
      'AWS CLI (cloudformation) or Azure CLI (group) with the GitHub CLI (scheduled job)', `#!/usr/bin/env bash
# the pipeline sets CLOUD to aws or azure; ephemeral stacks or resource groups are tagged pr=<number>
set -euo pipefail
limit=$(( $(date +%s) - {{EPHEMERAL_HOURS}} * 3600 ))
gone() { [ "$(gh pr view "$1" --repo "$GITHUB_REPOSITORY" --json state -q .state)" != OPEN ] || [ "$(date -d "$2" +%s)" -lt "$limit" ]; }
case "$CLOUD" in
  aws)
    aws cloudformation describe-stacks \\
      --query "Stacks[?Tags[?Key=='pr']].[StackName, Tags[?Key=='pr'].Value | [0], LastUpdatedTime || CreationTime]" --output text |
    while IFS=$'\\t' read -r stack pr updated; do
      if gone "$pr" "$updated"; then echo "deleting $stack (PR $pr)"; aws cloudformation delete-stack --stack-name "$stack"; fi
    done ;;
  azure)
    az group list --query "[?tags.pr].[name, tags.pr]" --output tsv |
    while IFS=$'\\t' read -r group pr; do
      updated=$(gh pr view "$pr" --repo "$GITHUB_REPOSITORY" --json updatedAt -q .updatedAt)
      if gone "$pr" "$updated"; then echo "deleting $group (PR $pr)"; az group delete --name "$group" --yes --no-wait; fi
    done ;;
esac`),
    {
      id: 'ff-parity', label: 'Environments share their code', category: 'structural', implements: HOSTINGS, checks: ['req-parity'],
      threshold: 'The test environment\'s and production\'s folders under envs/ differ only in their variable files',
      description: 'A check in every pull request compares the test environment\'s root with production\'s, ignoring the variable files of the tool in use (tfvars, Pulumi stack configuration, Bicep or CloudFormation parameter files); any other difference, a module version or an extra resource, fails it.',
      tool: 'diff (CI job)',
      language: 'bash',
      snippet: `#!/usr/bin/env bash
# TEST_ENV: staging, or test when there is no staging
set -euo pipefail
diff -rq "envs/\${TEST_ENV:-staging}" envs/production \\
  --exclude='*.tfvars' --exclude='*.auto.tfvars' --exclude='Pulumi.*.yaml' --exclude='*.bicepparam' --exclude='*.params.json' \\
  && echo "environments share the same code" \\
  || { echo "the environments differ beyond their variable files (above)"; exit 1; }`,
    },
    {
      id: 'ff-promote', label: 'Only the tested digest reaches production', when: { ENVIRONMENTS: ['staged', 'ephemeral'] }, category: 'process', implements: HOSTINGS, checks: ['req-staging'],
      threshold: 'The digest the production deploy job deploys equals the digest recorded by the latest staging deployment; any other digest fails the job',
      description: 'The staging deploy job records the image digest in the payload of the GitHub deployment it creates; the production deploy job reads the latest staging deployment\'s payload and refuses to continue with any other digest, so production never gets a rebuild or a newer image than staging tested.',
      tool: 'GitHub CLI (deployments API) in the deploy pipeline',
      language: 'bash',
      snippet: `#!/usr/bin/env bash
# production deploy step; IMAGE_DIGEST is what this job is about to deploy
set -euo pipefail
tested=$(gh api "repos/$GITHUB_REPOSITORY/deployments?environment=staging&per_page=1" -q '.[0].payload.digest')
[ "$tested" = "$IMAGE_DIGEST" ] || { echo "production would get $IMAGE_DIGEST; staging tested $tested"; exit 1; }
# the staging deploy job created its deployment with:
#   gh api "repos/$GITHUB_REPOSITORY/deployments" -f ref="$GITHUB_SHA" -f environment=staging -f "payload[digest]=$IMAGE_DIGEST"`,
    },
  ],
}

export default pack
