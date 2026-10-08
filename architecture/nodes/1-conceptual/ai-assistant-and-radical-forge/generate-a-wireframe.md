---
id: "4baf704a-f18f-4005-ae67-5f488d7fa980"
type: "requirement"
label: "Generate a wireframe"
action: "The mockup's Wireframe section shall offer Generate wireframe (Regenerate when one exists), which drafts a low-fi SVG from the mockup's description and route, the requirements and scenarios it illustrates, the container that presents it and the screens it navigates to."
ears_type: "optional"
feature: "AI is enabled in Studio, the active provider can be called (a cloud provider has an API key; Ollama needs none) and the mockup is editable"
rationale: "The wireframe reflects the model around the screen rather than a blank prompt. Evidence: packages/ui/src/components/MockupWireframe.tsx:47-100; packages/ui/src/components/wireframeGeneration.ts:1-28; apps/studio/src/renderer/src/ai/wireframeGenerator.ts:7-13; apps/studio/src/renderer/src/ai/settings.ts (aiReady); packages/common/src/ai/forge/wireframe.ts:38-82; apps/studio/src/renderer/src/ai/mockupWireframe.ts:17-37; manual#mockups"
---
