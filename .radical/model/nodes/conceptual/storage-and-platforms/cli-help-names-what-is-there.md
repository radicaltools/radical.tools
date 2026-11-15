---
id: "f09ed7b4-d523-474f-a325-72e8376d39d5"
type: "requirement"
label: "CLI help names what is there"
action: "The CLI shall print the usage of what was asked, naming only the commands, subcommands, options and files there are, and exit with 0."
ears_type: "event-driven"
rationale: "The help is where a user and an agent learn the CLI; radical --help listed federation open, sync and watch, gone since federation fetch, and sense --help and check --help put the reviews in the model folder, written to .radical/reviews.json since (F-0115, round 201–210). Evidence: apps/cli/src/index.ts; apps/cli/README.md"
trigger: "the user runs radical --help, or a command or subcommand of its usage with --help"
---
