---
id: "1404f086-d7d1-4ec5-b078-58f6f74d740b"
type: "requirement"
label: "Read VB6 timers and handlers"
action: "the system shall record each Timer whose handler does more than change what the form shows (a splash, a clock, an animation) as a job with its interval and Timer handler, each control with a Click handler as a control with its caption, and each Handle procedure as a handler with the case that calls it"
ears_type: "event-driven"
rationale: "A game server's work is in its packet handlers and timers, not its forms."
trigger: "a VB6 unit has Timer controls, controls of any library with a Click handler, or Handle procedures a dispatcher calls"
---
