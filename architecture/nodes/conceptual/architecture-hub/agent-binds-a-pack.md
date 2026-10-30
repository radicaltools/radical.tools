---
id: "8cb3ad6f-b196-45ec-a7d9-988e838b22b4"
type: "scenario"
label: "Agent binds a pack"
given: "a model folder served by the MCP server with a web app a person interacts with, and an Order entity"
metrics: |
  test(apps/mcp/src/forge.test.ts › forge_import_hub_concept › binds a concern pack to an element) passed
  test(apps/mcp/src/forge.test.ts › forge_import_hub_concept › binds a concern pack to several elements) passed
  test(apps/mcp/src/forge.test.ts › forge_import_hub_concept › refuses to bind a concern pack to an element that cannot satisfy requirements, and imports it unbound without one) passed
then: "the first call adds the slice the answers pick, with its relations and the answers' labels in its texts, its ADR (accepted, dated today) and fitness functions constrain the web app and the web app satisfies its requirements; the second binds it to both; the entity and the wrong answer are refused, naming them, and change nothing; without bindTo it comes in unbound, its ADR constraining nothing"
when: "the agent calls forge_import_hub_concept with the authentication pack, answers that users sign in with an external identity provider and that systems call with mutual TLS, and the web app's id; then with the web app and its system; then with the entity's id; then with an answer that is none of the options; then without bindTo"
---
