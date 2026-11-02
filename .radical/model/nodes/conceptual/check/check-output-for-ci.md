---
id: "24e8705e-b92a-42d7-b340-8d859e9bd490"
type: "requirement"
label: "Check output for CI"
action: "print a GitHub Actions annotation for each error and the first ten warnings, with the file each is about, followed by the text report, or with json print the whole result as JSON"
ears_type: "optional"
feature: "radical check runs with --format github or --format json"
rationale: "The text report shows every error but at most five warnings per rule unless --verbose; --list-rules lists the rules with their default severity. Evidence: packages/common/src/check/format.ts (formatCheckGithub, formatCheckText, WARNINGS_SHOWN), apps/cli/src/check.ts (--format, --verbose, --list-rules), apps/cli/src/cli.test.ts › prints the result as JSON"
---
