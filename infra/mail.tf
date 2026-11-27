# ── Mail for @radical.tools: Zoho Mail ──────────────────────────────────────
#
# Zoho Mail receives mail for the apex domain (contact@radical.tools and the
# other addresses set up in Zoho's Admin Console). The records exist once
# zoho_verification is set in terraform.tfvars; DKIM once zoho_dkim_value is.

locals {
  use_mail = local.use_www && var.zoho_verification != ""
  use_dkim = local.use_mail && var.zoho_dkim_value != ""
}

# Route 53 keeps every TXT value of one name in one record set: Zoho's
# domain verification and SPF go together.
resource "aws_route53_record" "apex_txt" {
  count   = local.use_mail ? 1 : 0
  zone_id = aws_route53_zone.apex[0].zone_id
  name    = var.apex_domain
  type    = "TXT"
  ttl     = 300
  records = [
    var.zoho_verification,
    "v=spf1 include:zoho.${var.zoho_region} ~all",
  ]
}

resource "aws_route53_record" "mx" {
  count   = local.use_mail ? 1 : 0
  zone_id = aws_route53_zone.apex[0].zone_id
  name    = var.apex_domain
  type    = "MX"
  ttl     = 300
  records = [
    "10 mx.zoho.${var.zoho_region}",
    "20 mx2.zoho.${var.zoho_region}",
    "50 mx3.zoho.${var.zoho_region}",
  ]
}

# A DKIM key is longer than one TXT string may be (255 characters): Route 53
# takes it as several strings, written "first""second".
resource "aws_route53_record" "dkim" {
  count   = local.use_dkim ? 1 : 0
  zone_id = aws_route53_zone.apex[0].zone_id
  name    = "${var.zoho_dkim_selector}._domainkey.${var.apex_domain}"
  type    = "TXT"
  ttl     = 300
  records = [join("\"\"", regexall(".{1,255}", var.zoho_dkim_value))]
}
