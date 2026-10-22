import type { PackSpec } from '../../src/packSpec'

const HOSTINGS = ['adr-paas', 'adr-kubernetes', 'adr-serverless', 'adr-vms']
const FORCES = 'This element is deployed and runs somewhere, and that somewhere has to be chosen, built and paid for. The forces: managed platforms take operations work off the team but limit what can run and tie it to a provider, while Kubernetes and virtual machines run anything at the price of running them; the cloud or data centre is chosen once and rarely left, by skills, existing contracts, services needed and where data may live; infrastructure built by hand in a console cannot be reviewed, repeated or rebuilt after a disaster; environments that differ from production hide the bugs that only production shows; cloud spend grows quietly with every resource nobody switches off; and changes made outside the code drift from it until the next apply undoes or breaks them.'

const pack: PackSpec = {
  id: 'concern-infrastructure',
  name: 'Infrastructure',
  group: 'technology',
  description: 'Where and how the element runs: the hosting model and the cloud, the infrastructure as code that builds it, the environments and their parity with production, cost guardrails and drift detection.',
  tags: ['technology', 'infrastructure', 'cloud', 'kubernetes', 'serverless', 'infrastructure as code', 'finops', 'drift'],
  concern: {
    id: 'infrastructure',
    trigger: 'LIST NODES WHERE (type = "container" OR type = "webapp" OR type = "database") AND external != true',
    why: 'these elements are deployed and run somewhere, so the hosting, the cloud, how the infrastructure is built and what it may cost has to be decided.',
  },
  sources: [
    { title: 'The Twelve-Factor App: X. Dev/prod parity', url: 'https://12factor.net/dev-prod-parity' },
    { title: 'AWS Well-Architected Framework', url: 'https://aws.amazon.com/architecture/well-architected/' },
    { title: 'Microsoft Azure Well-Architected Framework', url: 'https://learn.microsoft.com/en-us/azure/well-architected/' },
    { title: 'Google Cloud Architecture Framework', url: 'https://cloud.google.com/architecture/framework' },
    { title: 'Terraform documentation', url: 'https://developer.hashicorp.com/terraform/docs' },
    { title: 'Checkov', url: 'https://www.checkov.io/' },
    { title: 'FinOps Framework (FinOps Foundation)', url: 'https://www.finops.org/framework/' },
    { title: 'CNCF Cloud Native Landscape', url: 'https://landscape.cncf.io/' },
  ],
  questions: [
    {
      key: 'HOSTING', title: 'Hosting', label: 'How does the element run?',
      hint: 'The hosting model decides how much of the platform the team runs itself, what the element may do (long requests, background work, state), and how it scales and is billed.',
      default: 'paas',
      options: [
        { value: 'paas', label: 'a managed container platform (PaaS)', description: 'The provider runs the platform; you hand it a container or code. Google Cloud Run, Azure Container Apps or App Service, AWS App Runner or ECS on Fargate. Pick it by default for web apps and APIs when no platform team exists.' },
        { value: 'kubernetes', label: 'containers on Kubernetes', description: 'Managed Kubernetes (EKS, AKS, GKE) or an on-premises distribution (OpenShift, Rancher). Pick it when many services share a platform run by a platform team, or workloads need what a PaaS cannot (sidecars, operators, custom networking, portability).' },
        { value: 'serverless', label: 'serverless functions', description: 'AWS Lambda, Azure Functions or Google Cloud Functions, run per event and billed per invocation. Pick it for spiky or event-driven work with short executions, when idle cost should be zero.' },
        { value: 'vms', label: 'virtual machines', description: 'Virtual machines built from images, behind a load balancer. Pick it for software that cannot be containerised (licensed products, legacy runtimes, special kernels) or an on-premises virtualisation platform.' },
      ],
    },
    {
      key: 'CLOUD', title: 'Cloud', label: 'Where does it run?',
      hint: 'Choose by the team\'s skills, existing contracts and identity, the managed services you need, and where the data may be kept. Moving later is a project.',
      default: 'aws',
      options: [
        { value: 'aws', label: 'Amazon Web Services', description: 'The broadest set of services and regions. Pick it when the team knows AWS, or you need its specific services (DynamoDB, the widest serverless set).' },
        { value: 'azure', label: 'Microsoft Azure', description: 'Strong with Microsoft identity (Entra ID), .NET and enterprise agreements. Pick it when the organisation runs on Microsoft 365 and Entra ID, or has an Azure commitment.' },
        { value: 'gcp', label: 'Google Cloud', description: 'Strong in Kubernetes (GKE), data and analytics (BigQuery) and Cloud Run. Pick it when those services decide, or the team knows Google Cloud.' },
        { value: 'onprem', label: 'our own data centre', description: 'Servers and virtualisation we run. Pick it when data may not leave the premises, the load is steady enough that owned hardware is cheaper, or regulation demands it, and people run the hardware.' },
      ],
    },
    {
      key: 'IAC', title: 'Infrastructure as code', label: 'What describes the infrastructure in code?',
      hint: 'Infrastructure built in a console cannot be reviewed, repeated or rebuilt; the tool decides the language, the state and which clouds it reaches.',
      default: 'terraform',
      options: [
        { value: 'terraform', label: 'Terraform or OpenTofu', description: 'HCL with providers for every cloud and many SaaS products, state in a remote backend. Pick it by default, and whenever more than one cloud or SaaS is involved; OpenTofu when an open-source licence matters.' },
        { value: 'pulumi', label: 'Pulumi', description: 'Infrastructure in TypeScript, Python, Go or C#, with the same providers. Pick it when the team would rather write infrastructure in the language it already uses, with loops, functions and tests.' },
        { value: 'native', label: 'the cloud\'s own (Bicep, CloudFormation or CDK)', description: 'Azure Bicep, AWS CloudFormation or the AWS CDK, with state kept by the cloud. Pick it when only one cloud is used and its newest features matter on the day they ship.' },
      ],
    },
    {
      key: 'ENVIRONMENTS', title: 'Environments', label: 'Which environments are there?',
      hint: 'Environments that differ from production hide its bugs; environments that are never torn down cost money every hour.',
      default: 'staged',
      options: [
        { value: 'staged', label: 'development, staging and production', description: 'Long-lived environments, staging a scaled-down copy of production. Pick it when releases are tested together before going live, or regulation asks for a pre-production environment.' },
        { value: 'ephemeral', label: 'one per pull request, plus staging and production', description: 'Each pull request gets a short-lived environment built from the same code, destroyed when it closes. Pick it when environments can be created in minutes and several changes are tested in parallel.' },
        { value: 'minimal', label: 'one test environment and production', description: 'A single shared test environment, and production with canary releases. Pick it for small systems and teams that release small changes often with fast rollback.' },
      ],
    },
  ],
  details: [
    { key: 'BUDGET_MONTHLY', label: 'What is the monthly cloud budget (in the billing currency)?', default: '5000', number: true },
    { key: 'BUDGET_ALERT_PERCENT', label: 'At what share of the budget, forecast for the month, does an alert go out (%)?', default: '80', number: true },
    { key: 'COST_STEP', label: 'Above what monthly cost increase does a change need the budget owner\'s approval?', default: '500', number: true },
    { key: 'DRIFT_HOURS', label: 'Within how many hours must drift from the code be detected?', default: '24', number: true },
    { key: 'EPHEMERAL_HOURS', label: 'After how many hours is an idle ephemeral environment destroyed?', default: '72', number: true },
  ],
  need: {
    label: 'Runs reproducibly within budget',
    text: 'The element has to run somewhere that suits its load and the team\'s skills, and that somewhere has to be built from reviewed code, so it can be rebuilt after a disaster and repeated for every environment. Test environments must behave like production, nothing may change outside the code unnoticed, and the bill must stay within a known budget, with warnings before it is exceeded rather than after.',
  },
  forces: FORCES,
  requirements: [
    {
      id: 'req-iac', label: 'Infrastructure is code', ears_type: 'ubiquitous',
      action: 'define 100% of the infrastructure in {{IAC}} code in version control, applied only by the pipeline after a reviewed plan, with 0 changes made by hand to staging or production',
      rationale: 'Code can be reviewed, repeated and rebuilt after a disaster; a console click can do none of these (AWS Well-Architected, Operational Excellence: perform operations as code).',
      scenario: { label: 'Change goes through the pipeline', given: 'a change to the infrastructure', when: 'it is proposed', then: 'it arrives as a pull request with a plan, and only the pipeline applies it after review' },
    },
    {
      id: 'req-policy', label: 'Plans checked against policy', ears_type: 'event-driven',
      trigger: 'a plan for an infrastructure change is produced',
      action: 'check it against the security and tagging baseline (encryption at rest, no public storage, no administration port open to the internet, owner, environment and cost-centre tags on every resource) and refuse to apply it on any failed check',
      rationale: 'Misconfiguration is the commonest cause of cloud breaches; a check before apply costs nothing compared to one after (CIS Benchmarks; Azure Well-Architected, Security).',
      scenario: { label: 'Public bucket refused', given: 'a change that makes a storage bucket public and has no owner tag', when: 'the pipeline checks the plan', then: 'it fails naming both findings and nothing is applied' },
    },
    {
      id: 'req-parity', label: 'Environments match production', ears_type: 'ubiquitous',
      action: 'build every environment from the same infrastructure code and deploy the same artefacts to it, differing from production only in size and configuration values, with the same engine versions of every backing service',
      rationale: 'Gaps between environments in time, people and tools hide the bugs that only production shows (The Twelve-Factor App, X. Dev/prod parity).',
      scenario: { label: 'Same code everywhere', given: 'the staging and production definitions', when: 'they are compared', then: 'they use the same modules and versions, and differ only in variables for size and configuration' },
    },
    {
      id: 'req-drift', label: 'Drift detected', ears_type: 'unwanted-behaviour',
      unwanted_condition: 'the running infrastructure differs from its code',
      action: 'detect it within {{DRIFT_HOURS}} hours, report it to the owning team, and revert it or bring it into the code within 5 working days',
      rationale: 'A change outside the code is undone or broken by the next apply, and makes the code a false description of what runs (Terraform documentation, drift; Building Evolutionary Architectures).',
      scenario: { label: 'Manual change found', given: 'a security group changed by hand in the console', when: 'the drift check runs', then: 'within {{DRIFT_HOURS}} hours the owning team is told which resource differs and how' },
    },
    {
      id: 'req-budget', label: 'Budget alerts before overspend', ears_type: 'event-driven',
      trigger: 'the forecast spend for the month reaches {{BUDGET_ALERT_PERCENT}}% of the budget of {{BUDGET_MONTHLY}}',
      action: 'alert the owning team and the budget owner the same day, with the services that grew',
      rationale: 'Cloud spend grows quietly; a forecast alert leaves time to act within the month (FinOps Framework, budget management; AWS Well-Architected, Cost Optimization).',
      scenario: { label: 'Forecast alert', given: 'a monthly budget of {{BUDGET_MONTHLY}}', when: 'the forecast passes {{BUDGET_ALERT_PERCENT}}% of it', then: 'the owning team and the budget owner are alerted the same day' },
    },
    {
      id: 'req-cost-review', label: 'Cost shown in review', ears_type: 'event-driven',
      trigger: 'a change to the infrastructure code is proposed',
      action: 'show its estimated monthly cost change in the pull request, and require the budget owner\'s approval when it adds more than {{COST_STEP}} a month',
      rationale: 'The cheapest moment to question a cost is before it is incurred (FinOps Framework, shift-left cost estimation).',
      scenario: { label: 'Costly change approved', given: 'a pull request that adds a large database instance', when: 'the cost estimate shows more than {{COST_STEP}} a month', then: 'the pull request cannot be merged without the budget owner\'s approval' },
    },
    {
      id: 'req-paas', label: 'Stateless and scaled', when: { HOSTING: ['paas'] }, ears_type: 'ubiquitous',
      action: 'keep the element stateless, with no local file or session surviving an instance restart, run at least 2 instances in production and scale out automatically on load',
      rationale: 'A platform may stop or move any instance at any time; stateless processes make that harmless (The Twelve-Factor App, VI. Processes and IX. Disposability).',
      scenario: { label: 'Instance lost harmlessly', given: 'two instances serving traffic', when: 'one is stopped by the platform', then: 'no request or session is lost beyond retries, and a replacement starts' },
    },
    {
      id: 'req-k8s', label: 'Workloads well specified', when: { HOSTING: ['kubernetes'] }, ears_type: 'ubiquitous',
      action: 'give every workload resource requests and limits, readiness and liveness probes, at least 2 replicas with a PodDisruptionBudget in production, and a non-root, read-only root file system',
      rationale: 'Without these the scheduler cannot place, protect or restart pods correctly, and one pod can starve its node (Kubernetes documentation, configuration best practices; CIS Kubernetes Benchmark).',
      scenario: { label: 'Incomplete manifest refused', given: 'a deployment without resource limits or a readiness probe', when: 'the manifest check runs', then: 'it fails naming what is missing' },
    },
    {
      id: 'req-functions', label: 'Functions bounded', when: { HOSTING: ['serverless'] }, ears_type: 'ubiquitous',
      action: 'give every function a timeout shorter than its caller\'s, a concurrency limit that protects what it calls, a dead-letter queue for failed events, and a 95th-percentile cold start under 1 second',
      rationale: 'Unbounded functions scale until something downstream breaks, and silently lose failed events (AWS Well-Architected Serverless Applications Lens).',
      scenario: { label: 'Burst stays bounded', given: 'a burst of events far above normal', when: 'the functions process it', then: 'concurrency stays at its limit, the database is not overloaded, and failed events land in the dead-letter queue' },
    },
    {
      id: 'req-images', label: 'Machines are replaced', when: { HOSTING: ['vms'] }, ears_type: 'ubiquitous',
      action: 'build every machine from a versioned image and replace machines instead of changing them, with 0 changes over SSH in production and no machine running an image older than 30 days',
      rationale: 'Machines changed by hand drift apart and cannot be rebuilt; images rebuilt monthly carry the operating system\'s patches (immutable infrastructure; AWS Well-Architected, Reliability).',
      scenario: { label: 'Old image replaced', given: 'a machine running an image 31 days old', when: 'the image age check runs', then: 'it fails and the machine is replaced from the current image' },
    },
    {
      id: 'req-capacity', label: 'Capacity headroom kept', when: { CLOUD: ['onprem'] }, ears_type: 'state-driven',
      precondition: 'the element runs in our own data centre',
      action: 'keep at least 30% spare CPU, memory and storage at peak, and order hardware when the forecast shows the headroom gone within 6 months',
      rationale: 'In a data centre new capacity takes months to arrive; the headroom absorbs growth and a failed host in the meantime (Google SRE Book, ch. 18: capacity planning).',
      scenario: { label: 'Headroom forecast', given: 'the capacity report', when: 'the forecast shows headroom below 30% within 6 months', then: 'a hardware order is raised' },
    },
    {
      id: 'req-ephemeral', label: 'Ephemeral environments cleaned up', when: { ENVIRONMENTS: ['ephemeral'] }, ears_type: 'event-driven',
      trigger: 'a pull request is closed, or its environment has been idle for {{EPHEMERAL_HOURS}} hours',
      action: 'destroy its environment and everything in it within 1 hour',
      rationale: 'Environments per pull request pay off only when they disappear; forgotten ones are the commonest waste in cloud bills (FinOps Framework, workload optimisation).',
      scenario: { label: 'Environment removed', given: 'an ephemeral environment of a pull request', when: 'the pull request is merged', then: 'within 1 hour the environment and its resources are gone' },
    },
    {
      id: 'req-staging', label: 'Staging mirrors production', when: { ENVIRONMENTS: ['staged'] }, ears_type: 'ubiquitous',
      action: 'run staging with the same topology as production (zones, replicas of every backing service, network rules), scaled down, and promote to production only the artefact tested there',
      rationale: 'A staging environment that differs in topology hides failover and networking bugs; promoting the tested artefact keeps the test meaningful (Humble, Farley: Continuous Delivery).',
      scenario: { label: 'Tested artefact promoted', given: 'a build tested on staging', when: 'it is released', then: 'the same artefact, by digest, runs in production' },
    },
    {
      id: 'req-canary', label: 'Releases start as canaries', when: { ENVIRONMENTS: ['minimal'] }, ears_type: 'event-driven',
      trigger: 'a release is deployed to production',
      action: 'send it at most 10% of traffic for at least 15 minutes, and roll it back automatically when its error rate or latency is worse than the current version\'s',
      rationale: 'Without a staging environment, production is where releases are proved; a canary limits who is affected (Google SRE Workbook, canarying releases).',
      scenario: { label: 'Bad canary rolled back', given: 'a release whose error rate doubles', when: 'it serves 10% of traffic', then: 'it is rolled back automatically before reaching more users' },
    },
  ],
  adrs: [
    {
      id: 'adr-paas', label: 'Runs on a managed platform', when: { HOSTING: ['paas'] },
      decision: 'The element runs as a container on a managed platform in {{CLOUD}}: Google Cloud Run, Azure Container Apps (App Service for plain web apps), or AWS App Runner or ECS on Fargate; on premises, OpenShift or a similar platform run by a platform team. Infrastructure is built with {{IAC}}; environments: {{ENVIRONMENTS}}. Monthly budget {{BUDGET_MONTHLY}}, alert at {{BUDGET_ALERT_PERCENT}}%, drift checked every {{DRIFT_HOURS}} hours. Choosing the platform: the one in the chosen cloud that runs plain containers with scale-to-zero or autoscaling and managed TLS; avoid platform-specific build packs so the container can move.',
      consequences: '• No nodes, clusters or operating systems to patch; scaling, TLS and rollouts come with the platform.\n• Limits on what can run: request timeouts, no privileged containers, limited networking and sidecars.\n• Tied to the provider\'s platform, but a plain container moves to another with little change.\n• Per-request or per-instance billing; idle cost near zero on platforms that scale to zero.',
      alternatives: '1. Kubernetes: runs anything, at the cost of running a cluster.\n2. Serverless functions: lower idle cost, a different programming model.\n3. Virtual machines: full control, all the operations work.',
    },
    {
      id: 'adr-kubernetes', label: 'Runs on Kubernetes', when: { HOSTING: ['kubernetes'] },
      decision: 'The element runs as containers on Kubernetes in {{CLOUD}}: Amazon EKS, Azure AKS or Google GKE (Autopilot where it fits), or OpenShift or Rancher on premises. Manifests are Helm charts or Kustomize overlays deployed by GitOps (Argo CD or Flux); the clusters themselves are built with {{IAC}}; environments: {{ENVIRONMENTS}}. Every workload has requests and limits, probes, a PodDisruptionBudget and runs as non-root. Monthly budget {{BUDGET_MONTHLY}}, alert at {{BUDGET_ALERT_PERCENT}}%, drift checked every {{DRIFT_HOURS}} hours (Argo CD shows drift of the manifests). Choose Kubernetes only with a platform team, or a managed offering that removes node operations.',
      consequences: '• Runs anything that fits in a container, with the same model in every cloud and on premises.\n• A platform to run: cluster upgrades every few months (each minor is supported for about 14 months), add-ons, networking, security policies.\n• A large ecosystem (CNCF) for observability, policy, service mesh and operators, each one more thing to keep up.\n• Cost depends on packing workloads well; requests that are too high waste nodes.',
      alternatives: '1. A managed container platform: far less to run, fewer options.\n2. Serverless functions: no cluster at all, a different programming model.\n3. Nomad or plain container hosts: simpler, smaller ecosystem.',
    },
    {
      id: 'adr-serverless', label: 'Runs as serverless functions', when: { HOSTING: ['serverless'] },
      decision: 'The element runs as serverless functions in {{CLOUD}}: AWS Lambda, Azure Functions or Google Cloud Functions (Cloud Run functions), triggered by HTTP through an API gateway and by queues and events; on premises, Knative or OpenFaaS on the platform team\'s cluster. Each function has a timeout, a concurrency limit and a dead-letter queue. Infrastructure is built with {{IAC}} (or the AWS SAM or Serverless Framework on top of it); environments: {{ENVIRONMENTS}}. Monthly budget {{BUDGET_MONTHLY}}, alert at {{BUDGET_ALERT_PERCENT}}%, drift checked every {{DRIFT_HOURS}} hours. Choose functions for event-driven and spiky work with executions under a few minutes; long-running or steady-load work goes to containers.',
      consequences: '• No servers to run; scales from zero to large bursts, billed per invocation.\n• Cold starts add latency to the first requests; execution time, payload size and connections are limited.\n• Steady high load can cost more than containers; the bill follows traffic, so budgets and alerts matter.\n• Closely tied to the provider\'s events, gateway and permissions model; moving is a rewrite of the glue.',
      alternatives: '1. A managed container platform with scale-to-zero (Cloud Run, Container Apps): containers without cold-start limits on code shape.\n2. Kubernetes with KEDA for event-driven scaling.\n3. Virtual machines: steady cost, no limits, all the operations.',
    },
    {
      id: 'adr-vms', label: 'Runs on virtual machines', when: { HOSTING: ['vms'] },
      decision: 'The element runs on virtual machines in {{CLOUD}} (EC2 Auto Scaling groups, Azure Virtual Machine Scale Sets, Google Compute Engine managed instance groups, or VMware or Proxmox on premises), built from versioned images made with Packer and replaced rather than changed; configuration at boot with cloud-init or Ansible, and no changes over SSH in production. Infrastructure is built with {{IAC}}; environments: {{ENVIRONMENTS}}. Monthly budget {{BUDGET_MONTHLY}}, alert at {{BUDGET_ALERT_PERCENT}}%, drift checked every {{DRIFT_HOURS}} hours. Choose machines only for what cannot run in a container: licensed or legacy software, special kernels or hardware.',
      consequences: '• Full control: any software, any kernel, any agent.\n• All the operations work: operating system patches, image builds, scaling groups, load balancers.\n• Slower to scale and to roll out than containers; images must be rebuilt at least monthly.\n• Steady, predictable cost; reserved instances or savings plans reduce it.',
      alternatives: '1. A managed container platform: no machines to patch, if the software fits in a container.\n2. Kubernetes: containers with control, plus a cluster to run.\n3. Configuration management on long-lived machines (Ansible, Puppet): familiar, but machines drift apart.',
    },
  ],
  fitness: [
    {
      id: 'ff-checkov', label: 'Plans pass policy', when: { IAC: ['terraform', 'native'] }, category: 'structural', implements: HOSTINGS,
      threshold: '0 failed Checkov checks of the baseline (encryption, public access, open admin ports) and 0 resources without owner, environment and cost-centre tags',
      description: 'Checkov scans the Terraform plan (or the CloudFormation or Bicep templates) in every pull request with its built-in checks and a custom tagging policy, and fails on any finding. Terraform users can add Conftest policies over the plan JSON for rules of their own.',
      tool: 'Checkov',
      language: 'yaml',
      snippet: `# policies/required_tags.yaml (custom check, run with --external-checks-dir policies)
metadata:
  id: CKV2_ORG_TAGS
  name: Resources carry owner, environment and cost-centre tags
  category: GENERAL_SECURITY
definition:
  and:
    - { cond_type: attribute, resource_types: [aws_instance, aws_db_instance, aws_s3_bucket, aws_ecs_service, aws_lambda_function], attribute: tags.owner, operator: exists }
    - { cond_type: attribute, resource_types: [aws_instance, aws_db_instance, aws_s3_bucket, aws_ecs_service, aws_lambda_function], attribute: tags.environment, operator: exists }
    - { cond_type: attribute, resource_types: [aws_instance, aws_db_instance, aws_s3_bucket, aws_ecs_service, aws_lambda_function], attribute: tags.cost-centre, operator: exists }
# CI:
#   terraform plan -out tf.plan && terraform show -json tf.plan > tf.json
#   checkov -f tf.json --framework terraform_plan --external-checks-dir policies --compact`,
    },
    {
      id: 'ff-crossguard', label: 'Previews pass policy', when: { IAC: ['pulumi'] }, category: 'structural', implements: HOSTINGS,
      threshold: '0 mandatory policy violations in the preview of every pull request',
      description: 'A Pulumi CrossGuard policy pack runs with every preview and update and stops on a mandatory violation: missing tags, unencrypted storage, public buckets.',
      tool: 'Pulumi CrossGuard',
      language: 'ts',
      snippet: `// policy/index.ts — pulumi preview --policy-pack policy
import { PolicyPack, validateResourceOfType } from '@pulumi/policy'
import * as aws from '@pulumi/aws'

new PolicyPack('baseline', {
  policies: [
    {
      name: 'required-tags', enforcementLevel: 'mandatory',
      description: 'Every bucket carries owner, environment and cost-centre tags.',
      validateResource: validateResourceOfType(aws.s3.BucketV2, (bucket, _args, report) => {
        for (const tag of ['owner', 'environment', 'cost-centre']) {
          if (!bucket.tags?.[tag]) report(\`missing tag "\${tag}"\`)
        }
      }),
    },
    {
      name: 'no-public-buckets', enforcementLevel: 'mandatory',
      description: 'Public access is blocked on every bucket.',
      validateResource: validateResourceOfType(aws.s3.BucketPublicAccessBlock, (block, _args, report) => {
        if (!block.blockPublicAcls || !block.blockPublicPolicy) report('public access must be blocked')
      }),
    },
  ],
})`,
    },
    {
      id: 'ff-drift-terraform', label: 'Drift detected', when: { IAC: ['terraform'] }, category: 'operational', implements: HOSTINGS,
      threshold: 'A drift check every {{DRIFT_HOURS}} hours per environment; 0 unexplained differences between code and infrastructure',
      description: 'A scheduled pipeline runs a refresh-only plan for each environment; exit code 2 means the infrastructure differs from the code, and the job opens an issue for the owning team.',
      tool: 'Terraform (plan -detailed-exitcode)',
      language: 'bash',
      snippet: `#!/usr/bin/env bash
# scheduled every {{DRIFT_HOURS}} hours per environment
set -uo pipefail
terraform init -input=false >/dev/null
terraform plan -refresh-only -detailed-exitcode -input=false -no-color > drift.txt
case $? in
  0) echo "no drift" ;;
  2) gh issue create --title "Drift in $ENVIRONMENT" --body-file drift.txt --label drift; exit 1 ;;
  *) echo "plan failed"; exit 1 ;;
esac`,
    },
    {
      id: 'ff-drift-pulumi', label: 'Drift detected', when: { IAC: ['pulumi'] }, category: 'operational', implements: HOSTINGS,
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
      id: 'ff-drift-native', label: 'Drift detected', when: { IAC: ['native'] }, category: 'operational', implements: HOSTINGS,
      threshold: 'A drift check every {{DRIFT_HOURS}} hours per stack; 0 stacks in DRIFTED state',
      description: 'A scheduled job starts CloudFormation drift detection on every stack and fails when one is DRIFTED. With Bicep, `az deployment group what-if` against the deployed template shows the same.',
      tool: 'AWS CloudFormation drift detection (AWS CLI)',
      language: 'bash',
      snippet: `#!/usr/bin/env bash
# scheduled every {{DRIFT_HOURS}} hours
set -euo pipefail
for stack in $(aws cloudformation list-stacks --stack-status-filter CREATE_COMPLETE UPDATE_COMPLETE \\
               --query 'StackSummaries[].StackName' --output text); do
  id=$(aws cloudformation detect-stack-drift --stack-name "$stack" --query StackDriftDetectionId --output text)
  until [ "$(aws cloudformation describe-stack-drift-detection-status --stack-drift-detection-id "$id" \\
            --query DetectionStatus --output text)" != DETECTION_IN_PROGRESS ]; do sleep 5; done
  status=$(aws cloudformation describe-stack-drift-detection-status --stack-drift-detection-id "$id" \\
           --query StackDriftStatus --output text)
  [ "$status" = DRIFTED ] && { echo "$stack has drifted"; failed=1; }
done
exit \${failed:-0}`,
    },
    {
      id: 'ff-budget', label: 'Budget alert in place', category: 'operational', implements: HOSTINGS,
      threshold: 'A monthly budget of {{BUDGET_MONTHLY}} with a forecast alert at {{BUDGET_ALERT_PERCENT}}% exists for every account or subscription, defined in code',
      description: 'The budget and its forecast alert are part of the infrastructure code, so every account gets one. Azure: azurerm_consumption_budget_subscription; Google Cloud: google_billing_budget; on premises: chargeback reports from the virtualisation platform.',
      tool: 'AWS Budgets (Terraform aws_budgets_budget)',
      language: 'hcl',
      snippet: `resource "aws_budgets_budget" "monthly" {
  name         = "\${var.system}-\${var.environment}-monthly"
  budget_type  = "COST"
  limit_amount = "{{BUDGET_MONTHLY}}"
  limit_unit   = "USD"
  time_unit    = "MONTHLY"

  notification {
    comparison_operator        = "GREATER_THAN"
    threshold                  = {{BUDGET_ALERT_PERCENT}}
    threshold_type             = "PERCENTAGE"
    notification_type          = "FORECASTED"
    subscriber_email_addresses = [var.owner_email, var.budget_owner_email]
  }
}`,
    },
    {
      id: 'ff-infracost', label: 'Cost change in review', when: { IAC: ['terraform'] }, category: 'process', implements: HOSTINGS,
      threshold: '100% of infrastructure pull requests show the monthly cost change; above {{COST_STEP}} a month the budget owner must approve',
      description: 'Infracost compares the cost of the pull request\'s Terraform with the main branch and comments the difference; a step fails the check above the limit until the budget owner approves.',
      tool: 'Infracost',
      language: 'bash',
      snippet: `infracost breakdown --path . --format json --out-file base.json        # on main
infracost diff --path . --compare-to base.json --format json --out-file diff.json
infracost comment github --path diff.json --repo "$GITHUB_REPOSITORY" \\
  --pull-request "$PR_NUMBER" --github-token "$GITHUB_TOKEN" --behavior update
increase=$(jq -r '.diffTotalMonthlyCost | tonumber | floor' diff.json)
[ "$increase" -le {{COST_STEP}} ] || { echo "adds $increase a month: budget owner approval needed"; exit 1; }`,
    },
    {
      id: 'ff-kube-score', label: 'Manifests well specified', when: { HOSTING: ['kubernetes'] }, category: 'structural', implements: ['adr-kubernetes'],
      threshold: '0 critical kube-score findings (missing limits, probes, PodDisruptionBudget, root user) in rendered manifests',
      description: 'The rendered manifests of every chart or overlay are scored in each pull request; a critical finding fails the build.',
      tool: 'kube-score',
      language: 'bash',
      snippet: `helm template order-api charts/order-api -f charts/order-api/values-production.yaml \\
  | kube-score score - --output-format ci \\
      --enable-optional-test container-security-context-readonlyrootfilesystem`,
    },
    {
      id: 'ff-ephemeral-ttl', label: 'No forgotten environments', when: { ENVIRONMENTS: ['ephemeral'] }, category: 'operational', implements: HOSTINGS,
      threshold: '0 ephemeral environments idle for more than {{EPHEMERAL_HOURS}} hours or alive after their pull request closed',
      description: 'A scheduled job lists the namespaces labelled as ephemeral, deletes those whose pull request is closed or that have been idle past the limit, and reports what it removed.',
      tool: 'kubectl with GitHub CLI (scheduled job)',
      language: 'bash',
      snippet: `#!/usr/bin/env bash
set -euo pipefail
limit=$(( $(date +%s) - {{EPHEMERAL_HOURS}} * 3600 ))
kubectl get ns -l env-type=ephemeral -o json | jq -r '.items[] | [.metadata.name, .metadata.labels.pr, .metadata.annotations["last-deploy"]] | @tsv' |
while IFS=$'\\t' read -r ns pr last; do
  state=$(gh pr view "$pr" --json state -q .state)
  if [ "$state" != OPEN ] || [ "$(date -d "$last" +%s)" -lt "$limit" ]; then
    echo "deleting $ns (PR $pr $state, last deploy $last)"; kubectl delete ns "$ns" --wait=false
  fi
done`,
    },
  ],
}

export default pack
