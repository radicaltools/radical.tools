---
id: "42754995-245e-410b-b2fd-026f20830371"
type: "need"
label: "A standard checked in every system"
kind: "stakeholder-note"
source: "Product owner, 2026-11-02"
---

"I have the fitness function APIs described in OpenAPI, which implements an ADR, and the ADR constrains Payments API. That should be enough for the metrics engine to check whether the API has its Swagger." Then: "There are no foreign fitness functions: if there is a constraint, it is already mine. The fitness function should take the data, in this case the container, as its context." And: "Mapping the model onto the real system is outside the model: the sensor gets the ADR and Payments API as context; the sensor is configured per SDLC and has the logic of what it means that Payments API has its Swagger." Asked one by one: the sensors are named in a file in the repository outside the model; the context goes to the sensor as one parameter --context with the whole structure as JSON; the result is the exit code, and optionally the sensor's own measurements; only the elements a decision constrains directly are measured.
Translated from Polish.
