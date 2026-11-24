---
id: "28ee1b6c-9414-431a-971d-a78121727e5c"
type: "requirement"
label: "Version shown in the app"
action: "ask in the Release and versioning pack where the running version is shown (in the application's interface, at /version, in a response header, in the logs), and check after each deployment that the interface shows the version and commit that were deployed"
ears_type: "ubiquitous"
rationale: "Users, support and testers have to see which build they are looking at; a /version endpoint alone is read by tools, not by people. The version itself stays the Release and versioning pack's decision."
---
