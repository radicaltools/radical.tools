---
id: "2408cf76-ab15-49e4-b0ec-2dc3e2104366"
type: "adr"
label: "Cloud reached through OIDC federation"
alternatives: |
  1. Static keys in environment secrets, rotated: works with any target, but a leaked key works from anywhere until it is rotated.
  2. Self-hosted runners with an instance role: no keys either, but every job on those runners gets the role, and the runners need hardening.
  3. Keys fetched from a secrets manager at run time: the manager still needs a credential, which OIDC is the way to avoid.
concern: "ci-cd-pipeline"
consequences: |
  • Nothing long-lived to leak, rotate or revoke for the pipeline's cloud access.
  • A trust policy is now security-critical configuration: a sub condition with a wildcard lets other repositories, branches or forks deploy, so it is checked every night.
  • Each cloud account needs the GitHub OIDC provider and a role per environment, set up once in infrastructure code.
  • A job that cannot ask for an id-token (a workflow from a fork) cannot deploy, which is the point.
context: "This element is built, checked and deployed by machine many times a day, and the pipeline that does it is code with failures of its own. The forces: a pipeline clicked together in a web UI cannot be reviewed, versioned or rebuilt; a check that runs only on a developer's machine is skipped the day it matters, while one that runs only in CI is slow to learn from; a rebuild for each environment ships something other than what was tested, as dependencies, base images and tools move between builds; long-lived cloud keys in CI secrets are among the credentials most often stolen from pipelines, readable by every workflow that may use them and valid from anywhere once leaked; a slow pipeline is worked around (changes batched, merges made without waiting), and one that fails at random teaches everyone to press Re-run; caches and parallel jobs buy time but go stale or race; and two deploys to one environment at once leave it in neither version. Neighbouring packs own the rest: the main branch's ruleset (no direct pushes, no force pushes, the approvals) in the Code review and branching pack; the test run and its own time limit in the Test strategy pack, the static checks and theirs in the Code quality gate pack; rollout, rollback and how often the element is released in the Deployment and rollback pack; which environments exist, and the gate that production gets the digest staging tested, in the Infrastructure pack; version numbers and who approves a release in the Release and versioning pack; pinning actions by commit SHA, provenance and SBOMs in the Software supply chain pack; the running element's own credentials in the Secrets pack; and the DORA delivery metrics in the Delivery metrics pack."
date: "2026-11-24"
decision: "Pipeline jobs reach the cloud through OpenID Connect: a deploy job asks GitHub for an OIDC token (permissions: id-token: write) and exchanges it for short-lived credentials of a role for its environment. On AWS, aws-actions/configure-aws-credentials with role-to-assume, and a trust policy on each role whose aud condition is sts.amazonaws.com and whose sub condition is exactly repo:our-org/shop:environment:<environment>, never a wildcard; on Azure, azure/login with a federated credential of an app registration; on Google Cloud, google-github-actions/auth with Workload Identity Federation. The credentials expire within an hour, each environment's role holds only the rights its deploy needs, and no cloud key is stored in the repository's, the environments' or the organisation's secrets. The running element's own credentials are decided in the Secrets pack."
status: "accepted"
---
