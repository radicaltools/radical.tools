---
id: "62f79689-9555-444b-bfef-db6b512a83c0"
type: "adr"
label: "Need as its own type"
alternatives: "An ears_type free-text on requirement; a type named raw requirement."
consequences: "Satisfies, verifies and Forge's scenario stage only see real requirements. A need has no status: being in the model means it is accepted."
context: "Free-text input such as a brief or notes is Radical Forge's input and the source of many EARS requirements (one to many)."
date: "2026-10-06"
decision: "Add a governance node type need. Its text lives in the description; requirements link to it with derives."
status: "accepted"
---
