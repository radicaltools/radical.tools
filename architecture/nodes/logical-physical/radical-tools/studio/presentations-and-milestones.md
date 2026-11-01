---
id: "6d563737-4cfb-4ccd-993e-2f1c5deaf753"
type: "component"
label: "Presentations and milestones"
technology: "React"
---

PresentationBar.tsx (with PresenterDock) and MilestoneEditOverlay.tsx. Plays slides over views and shows milestones and their diff; the state lives in the diagram store. In a federation a milestone, and a slide's own copy of the model, keep only the model's own elements and the commits of the other models (otherModels); shown, they get the other models as they were at those commits (milestoneWithOthers over otherModelsAt), with a note naming radical federation fetch for a version not fetched.
