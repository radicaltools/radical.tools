---
id: "ff13b192-3e4c-40b7-af94-2073bbc9afe0"
type: "requirement"
label: "Studio follows the agent"
action: "each time a change made outside Studio comes in, Studio shall open a view that shows what the agent added or changed (the open one when it shows any, otherwise the one that shows the most, a canvas before other kinds; never All elements or a view of every element) and frame what the agent's turn has done in it; an element no such view shows yet shall be followed once a view shows it (as a Forge stage files its elements when it completes), Studio staying where it is until then; after the user moves the camera or opens another view, it shall follow again only once the agent has paused for 15 seconds; and it shall stop when the run finishes or stops"
ears_type: "state-driven"
precondition: "Follow the agent is switched on in the view of an agent's Forge run"
rationale: "A Forge run writes into several views, and files a stage's elements into them only when the stage completes; the change highlight lasts five seconds and only on the open view, so the user misses what lands elsewhere. All elements shows everything as one table, which says nothing about where the agent works. Following moves the user's eyes to it, and gives the camera back as soon as they take it. Evidence: apps/studio/src/renderer/src/persistence/followAgent.ts, apps/studio/src/renderer/src/components/AgentForgeModal.tsx, packages/ui/src/store/userCamera.ts"
---
