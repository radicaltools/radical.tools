---
id: "ef167156-3308-4332-9354-889bb3691e38"
type: "requirement"
label: "Bind tests from the command line"
action: "the CLI shall add the tests --test names to its entry in .radical/radical.json, take off those --drop names, remove the entry with --remove (also the entry of an element the model no longer has, by its id or name), and list its tests with none of them, refusing a name no or several such elements have; a test id written as Vitest prints it (file > describe > title) it shall keep in the › form, as Playwright prints it, and --drop takes a test off written either way"
ears_type: "event-driven"
trigger: "the user runs radical verify with a scenario or fitness function, by its id or name"
---
