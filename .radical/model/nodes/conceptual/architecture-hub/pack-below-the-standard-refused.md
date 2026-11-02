---
id: "18fa822f-f101-4877-bb00-a8df6edeb776"
type: "requirement"
label: "Pack below the standard refused"
action: "refuse it, naming the pack and what it lacks, so the Hub and Studio builds stop"
ears_type: "unwanted-behaviour"
rationale: "The standard is kept by the build, not by memory. ADR Concern groups and pack standard."
unwanted_condition: "a concern pack in the catalogue has no valid group, fewer than three questions with options, an option that does not say what it means, fewer than two sources, or a fitness function without a Tool: line and a snippet, a {{KEY}} that names no question or detail, a detail no text uses, a token in an option's label or description, a snippet that hard-codes a detail's value beside a # KEY comment, an EARS clause that starts with its own keyword, an option no element is imported for and no decision names, a fitness function imported with none of the decisions it implements, or a requirement that no fitness function imported with it checks and that gives no reason"
---
