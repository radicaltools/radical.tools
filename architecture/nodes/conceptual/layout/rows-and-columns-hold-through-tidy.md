---
id: "910a42ff-a899-4c6b-86b3-143a40864bed"
type: "requirement"
label: "Rows and columns hold through Tidy"
action: "Tidy shall line them up at the start (and after a rough layout), keep them through every move (a row follows a member that left it, or the member is put back), and line them up again before it moves the layout to the top left, so the layout it hands over is the one it judged and a second run finds nothing left to tidy."
ears_type: "state-driven"
precondition: "a view Smart Layout tidies has rows or columns the author set"
rationale: "Alignments were enforced only after Tidy's best-layout guard and its move to the top left, so it handed over a layout it had not judged, and every later run started from it and never said nothing was left to tidy (round 185–192, 2026-10-26, F-0081). Evidence: packages/layout/src/tidy/index.ts"
---
