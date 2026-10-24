---
id: "d207805a-9ed4-49ad-972f-a607aca2ec03"
type: "requirement"
label: "Tidy off the main thread"
action: "Studio shall run Tidy in a worker, show how many moves it has made so far, let the user stop it with the same button (the canvas then stays as it was), and apply what was done when the time budget runs out."
ears_type: "event-driven"
rationale: "A large view would freeze Studio for the seconds Tidy takes; the ensemble already runs off the thread with progress."
trigger: "the user runs Smart Layout in Auto mode on a view"
---
