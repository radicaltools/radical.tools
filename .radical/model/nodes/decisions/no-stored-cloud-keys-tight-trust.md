---
id: "d0223cac-c464-4b5d-b2ba-7e266ff2b4c1"
type: "fitness-fn"
label: "No stored cloud keys, tight trust"
cadence: "triggered"
characteristic: "security"
invocation: "automated"
scope: "atomic"
trigger: "pull-request"
---

tools/ci/workflows.mjs cloud-keys (npm run check:workflows, tested in tools/ci/workflows.test.mjs) fails when a cloud sign-in does not use role-to-assume with id-token: write, when a step passes a stored key to a sign-in (aws-access-key-id, aws-secret-access-key, aws-session-token, credentials_json, creds, client-secret), or when a secret or environment variable is named as a cloud key. With --secrets it also lists the names of the repository's and environments' secrets through gh, which needs an administrator, so it runs by hand. The trust policy of the AWS deploy role is not checked here: that needs the AWS CLI and credentials that may read IAM. Names are a heuristic: the Secrets pack's scanning finds keys stored under other names.

Threshold: 0 cloud sign-ins without OIDC; 0 stored keys passed to a sign-in; 0 secrets or variables named as cloud keys

Tool: tools/ci/workflows.mjs (js-yaml), run as npm run check:workflows in ci.yml
