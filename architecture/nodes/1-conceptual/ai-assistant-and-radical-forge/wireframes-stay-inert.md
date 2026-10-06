---
id: "99af51ad-0e04-4bef-8ab1-45e61d867f57"
type: "requirement"
label: "Wireframes stay inert"
action: "Studio shall store only the first SVG of a wireframe reply after stripping scripts, foreignObject, event handlers and external links, shall refuse replies with no SVG or over 20,000 characters, and shall display wireframes only as images."
ears_type: "ubiquitous"
rationale: "AI-generated markup in a shared model must never run code or load anything. Evidence: packages/common/src/wireframe.ts:1-37; apps/studio/src/renderer/src/ai/mockupWireframe.ts:107-108; packages/ui/src/components/MockupWireframe.tsx:62-64,76; manual#mockups"
---
