---
id: "ace11c09-df3f-4452-aa9f-0ee884c5c02a"
type: "requirement"
label: "Welcome screen on plain load"
action: "Studio shall show the Welcome screen offering New model and Open, with Try the sample model under them when no model is kept yet and the three most recent models otherwise, and keep the URL hash empty until a model is chosen."
ears_type: "event-driven"
rationale: "A newcomer needs an obvious starting point, and an untouched URL must not point at a model nobody chose. Evidence: apps/studio/src/renderer/src/App.tsx:50-60; apps/studio/src/renderer/src/components/WelcomeScreen.tsx:80-325; manual#getting-started"
trigger: "Studio is opened in a browser without a route in the URL hash"
---
