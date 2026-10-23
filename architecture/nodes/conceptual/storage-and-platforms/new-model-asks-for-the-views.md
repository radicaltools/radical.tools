---
id: "13268d7a-04d2-4293-817b-54193099f408"
type: "requirement"
label: "New model asks for the views"
action: "Studio shall offer, below the metamodel picked, Views of the metamodel (the default: a Structure view of all elements named All elements at the top of the list, under the All elements table, then a view of each of the metamodel's viewpoints in the folders Conceptual, Logical and Governance, a viewpoint that draws one element as a group of views per element, any of which the user can leave out under Customise…) or Empty, make the chosen views in the new model before its first element, and open the model on All elements."
ears_type: "event-driven"
rationale: "The views are the structure the user works in, and the metamodel brings them as viewpoints, so a new model can start in that structure instead of being built view by view. ADR New model starts with the metamodel's views. Evidence: packages/common/src/viewStructure.ts (metamodelViews); apps/studio/src/renderer/src/components/ModelSteps.tsx (NewModelStep, Views)"
trigger: "the user creates a model in the New model step"
---
