---
id: "984afb23-9553-4ada-aea9-318b97228ce7"
type: "system"
label: "AWS"
external: true
technology: "S3, CloudFront, Route 53, ACM, IAM (Terraform)"
---

Amazon Web Services account that hosts the three public sites, defined in infra/ (Terraform, AWS provider, region eu-west-1; local state, terraform.tfvars git-ignored). One private, versioned, AES256-encrypted S3 bucket per site (old versions expire after 30 days), each read only by its own CloudFront distribution through an Origin Access Control (PriceClass_100, HTTPS only, TLS 1.2): studio.radical.tools (main.tf: Studio's web build; unknown paths return index.html with 200 for the SPA, /index.html never cached), hub.radical.tools (hub.tf: the Hub and its catalogue under /hub/* and the legacy /hub-data.json, never cached, with a CORS response-headers policy that lets https://studio.radical.tools, https://radical.tools and http://localhost:* fetch it) and radical.tools + www.radical.tools (web.tf: the website and manual). A Route 53 hosted zone for radical.tools (its name servers set at the registrar, domeny.tv) points the apex and www at the website distribution and studio and hub at theirs; one ACM certificate in us-east-1 covers all four names. iam.tf trusts GitHub's OIDC provider and gives GitHub Actions runs from main of the repository (matched by its immutable repository id) a deploy role that may only put, get, delete and list objects in the three buckets and create CloudFront invalidations; no long-lived AWS keys exist.
