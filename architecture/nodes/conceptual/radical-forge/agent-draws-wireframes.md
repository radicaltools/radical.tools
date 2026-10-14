---
id: "cfd36cd7-d5a8-4116-b1c0-430128d5a218"
type: "requirement"
label: "Agent draws wireframes"
action: "return the drawing brief built from the requirements, scenarios and screens around the mockup when no SVG is given, and otherwise store the SVG on the mockup after sanitising it, refusing one that is no usable wireframe"
ears_type: "event-driven"
rationale: "The agent's own model draws the wireframe that Studio's provider would draw, under the same brief and the same sanitiser. Evidence: apps/mcp/src/forge.ts (forge_wireframe, buildWireframePrompt, sanitizeWireframeSvg), apps/mcp/src/forge.test.ts › draws wireframes, imports Hub concepts and exports the Gherkin files"
trigger: "an agent calls forge_wireframe for a mockup"
---
