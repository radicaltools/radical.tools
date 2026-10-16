---
id: "8b04c5bd-5e7a-46ad-bc42-7563e225585e"
type: "requirement"
label: "Git hooks save the base"
action: "the CLI shall add to the repository's post-checkout, post-commit and post-merge hooks a line that saves that folder's base, keep what the hooks already hold, add nothing a second time, and make the hooks executable"
ears_type: "event-driven"
rationale: "With the model edited first in Studio, nothing else saves the base when a branch is started; the hooks keep it right after a checkout, a commit or a pull without anyone thinking of it."
trigger: "radical hooks install runs for a model folder in a git repository"
---
