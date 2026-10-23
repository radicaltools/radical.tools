---
id: "1dbb2ec4-65d1-4195-9394-867bd8877e94"
type: "requirement"
label: "Smart fit starts calm"
action: "a fit of the view (when it opens, Fit All, or Smart fit after a change) shall zoom in to at most 100 %, and an element added to or removed from the canvas while every element stays in sight shall leave the camera where it is, ending any refit still in progress."
ears_type: "state-driven"
precondition: "Smart fit is on"
rationale: "Modelling from nothing, the first element dropped was zoomed in to 400 % to fill the canvas, and each next one threw the camera far out again, and refit it while the physics settled. At most 100 % a small model stands at its size; an addition in sight needs no camera move. Evidence: packages/ui/src/components/Canvas.tsx (FIT_MAX_ZOOM, computeSmartFitTarget), apps/e2e/tests/studio/physics.spec.ts"
---
