---
id: "46127bcf-0a6c-4286-9eca-803ab8086ff1"
type: "scenario"
label: "Help for every command"
given: "the CLI built from the repository"
then: "each prints its usage and exits with 0, and no usage names a command or file the CLI lacks"
when: "radical --help runs, then each command and subcommand its usage lists with --help"
---
