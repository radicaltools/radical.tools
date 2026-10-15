---
id: "3f160d27-e834-4d12-9441-3766e67daeec"
type: "scenario"
label: "A view draws its lines one way"
given: "the bookstore sample on its Containers view, and relations with a node in the way"
tests: |
  apps/e2e/tests/studio/views.spec.ts › line style › a view draws its relations curved or orthogonal, as set in its properties, and keeps it
  packages/layout/tests/edgeRouting.test.ts › edge styles
  packages/layout/tests/edgeRouting.test.ts › curved ends
  packages/common/tests/edgeStyle.test.ts › edge style
  packages/ui/tests/edgeStyle.test.ts › a view's line style and the model's are each one undo step, and saved with the document
  packages/common/tests/aiSequenceTools.test.ts › update_view › sets how a view draws relations, or hands it back to the model
then: "every relation is a Bézier curve, then only straight segments with rounded corners, also after the reload; around a node a curved relation stays a smooth curve, never crossing itself, leaving and entering its sides from the front, and an orthogonal one keeps right angles, neither through the node; the view's style and the model's are each one undo step and kept in the Markdown folder"
when: "the user sets Lines to Orthogonal in the view's properties and reloads; relations are routed in each style; an agent sets a view's line style and hands it back to the model"
---
