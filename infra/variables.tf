variable "project_name" {
  description = "Project name used as prefix for all resource names."
  type        = string
  default     = "radical-tools"
}

variable "environment" {
  description = "Deployment environment (prod | staging | dev)."
  type        = string
  default     = "prod"

  validation {
    condition     = contains(["prod", "staging", "dev"], var.environment)
    error_message = "environment must be one of: prod, staging, dev."
  }
}

variable "aws_region" {
  description = "AWS region for the S3 bucket. CloudFront is always global."
  type        = string
  default     = "eu-west-1"
}

variable "github_repo" {
  description = "GitHub repository in 'owner/name' format (informational; the OIDC trust is scoped by github_repository_id)."
  type        = string
  default     = "radicaltools/radical.tools"
}

variable "github_repository_id" {
  description = "Immutable numeric GitHub repository id (gh api /repos/OWNER/NAME --jq .id). Used to scope the OIDC deploy role."
  type        = string
  default     = "1224486829"
}

variable "create_oidc_provider" {
  description = "Create the GitHub Actions OIDC provider. Set to false if it already exists in this AWS account (there can only be one per account)."
  type        = bool
  default     = true
}

variable "www_domain" {
  description = "Custom www domain to serve on CloudFront (e.g. www.radical.tools). Leave empty to skip ACM + alias setup."
  type        = string
  default     = ""
}

variable "apex_domain" {
  description = "Apex/root domain (e.g. radical.tools). Required when www_domain is set — creates Route 53 hosted zone."
  type        = string
  default     = ""
}

variable "app_domain" {
  description = "App subdomain to serve on CloudFront (e.g. studio.radical.tools). Leave empty to skip."
  type        = string
  default     = ""
}

variable "hub_domain" {
  description = "Hub subdomain to serve the Architecture Concept Hub (e.g. hub.radical.tools). Leave empty to skip."
  type        = string
  default     = ""
}

# ── Mail (Zoho) ─────────────────────────────────────────────────────────────

variable "zoho_verification" {
  description = "Zoho Mail's domain verification TXT value (zoho-verification=…zmverify.zoho.eu). Leave empty to create no mail records."
  type        = string
  default     = ""
}

variable "zoho_region" {
  description = "Zoho's data centre the account lives in, as the domain ending of its mail servers: eu or com."
  type        = string
  default     = "eu"
}

variable "zoho_dkim_selector" {
  description = "Selector of the DKIM key generated in Zoho's Admin Console (the part before ._domainkey)."
  type        = string
  default     = "zmail"
}

variable "zoho_dkim_value" {
  description = "The DKIM TXT value Zoho gives (v=DKIM1; k=rsa; p=…). Leave empty until Zoho has generated it."
  type        = string
  default     = ""
}
