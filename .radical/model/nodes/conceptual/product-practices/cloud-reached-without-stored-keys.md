---
id: "cc8568e0-1c2e-42d6-9fcc-90c98e32f910"
type: "requirement"
label: "Cloud reached without stored keys"
action: "sign every deploy job in to the cloud with GitHub's OIDC token, exchanged for a role that trusts only this repository and that job's environment and for credentials that expire within 1 hour, and keep no cloud key in the repository's or environments' secrets or in any workflow file"
ears_type: "ubiquitous"
rationale: "Credentials issued for one job leave nothing to steal or rotate, and a trust condition on the repository and environment keeps every other workflow out (GitHub Docs: OpenID Connect; Configuring OpenID Connect in Amazon Web Services)."
---
