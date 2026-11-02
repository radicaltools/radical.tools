---
id: "c3de05c5-18cd-428d-86f3-7537a0ffed56"
type: "requirement"
label: "Map an element from the command line"
action: "the CLI shall find the element in the model (its own or, as fetched, another model's of the federation), add or replace its entry in the repository's .radical/radical.json with those paths from the repository's root, and refuse a name that matches no element or several, naming them; with --remove it shall drop the entry, and with neither it shall say where the element is built"
ears_type: "event-driven"
trigger: "the user runs radical implement with an element, by its id or name, and one or more --path"
---
