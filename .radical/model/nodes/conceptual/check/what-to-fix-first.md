---
id: "96567076-f331-4fb7-8ffa-1ada5567f9f3"
type: "need"
label: "What to fix first"
kind: "stakeholder-note"
source: "Product owner, 2026-11-26"
---

"Work on the Inspector, review the implementation and what is shown and how; I want what the user has to fix to appear first... there is no sense in cluttering it with warnings straight away... what do you think?"
Q: Inspector: the Overview is to start with "To fix" (only what fails the check). Where should the warnings go (the debt within baselines, 918 on our model, the other warnings, "Not run"): folded at the foot of the Overview (three folded rows with counts only, under "To fix" and the scores), only in the Model and Implementation tabs (where "Findings by dimension" is today), or a separate "Debt" tab (a new card in the left panel beside Model and Implementation: all the debt and the warnings in one place, with the baselines and a ratchet hint; the Overview stays clean)?
A: A separate "Debt" tab.
Q: When a rule goes over its baseline ("Requirement without scenario" at 55 with max 54), the check turns all 55 findings into errors. How should the Inspector count and show it in "To fix" and on the rail: count what has to be settled, 1 (the rail and "To fix" show the number over the baseline; first the findings about elements changed on the branch, the rest of the rule under "any of the other 54 settles it too"; the CLI's text still says 55 errors, so the numbers in Studio and in CI differ), 1 in Studio and in the CLI, or leave 55 and only group them?
A: Count what has to be settled: 1.
Q: The Model and Implementation tabs have lists of findings of their own today: "Errors" at the top, "Findings by dimension" at the bottom, and Implementation its own "Needs attention". As errors go to "To fix" and warnings to "Debt", what about these lists: remove the lists and keep the analysis (Model and Implementation show only the scores, the traceability chain, the funnels, the goals and the gaps by group; each finding is in one place, an error in "To fix", a warning in "Debt"; a click on a link of the chain opens "Debt" or "To fix" on that rule; the list of scenarios and fitness functions that do not pass stays in Implementation as "Not passing"), keep the lists and draw them alike, or keep only the errors in the tabs?
A: Remove the lists, keep the analysis.
Later the same day, with a screenshot of an element card's Findings (a line 'Scenario "Promenade heart rate trend": test e2e/trend.spec.ts › Show trend › Trend draws noise threshold and gear changes failed.' with "Not verified now: Show trend" under it, and a line 'Scenario "Promenade heart rate trend": no report has the file of test tests/integration/acceptance.test.ts › Agreement with the preliminary analysis › Promenade heart rate trend.'):
"Look at what you print: do you understand what is written here and what the error is?"
And then: "One more thing... when there is a local check, all the metrics of the implementation go to zero... I want the previous results to stay in force meanwhile." (In the user's project a local radical check --report had read one report with one test, and the results kept beside the model then held that one test only.)
And then, with a screenshot of a scenario's card (its attributes, then Verification with a finding, Tests · 1 and Views · 5 filling the lower half of the card): "Another thing... look at the attributes screen... a scenario, for one: it is unreadable; Verification, Tests and Views should be expandable..."
And then, with a screenshot of a line of a fitness function's conditions, "- quarantine.overdue 0; quarantine.incomplete 0 (static)", its middle ("0; quarantine.incomplete") on a yellow background and no equals sign in it: "Where does this colour come from?"
And then, with a screenshot of a card's Built in ("The repository's .radical/radical.json says nowhere. To say where: radical implement "Accept or reject recommendation" --path <folder>"): "Look this over: does it always make sense? I think not..."
And then, with a screenshot of the Debt tab's rules, each a name over a long sentence in one weight: "In the messages, and here for one, use bold... so that it reads more easily."
And then, seeing it: "Better. And can you also show somehow what the condition of the test is, and the like? The idea is that it reads easily."
And then, with screenshots of a fitness function's card, its Verification open: "Look, the Verification runs together." And, once its parts were set apart: "Further: the 100 ms metric appears twice" (as a finding, and again among the checks).
And then, with a screenshot of To fix (under Metric failed, counted as two, a scenario and a fitness function each on a row of its own with the same condition and the same measurement): "Look here: the same test two times, is that OK?"
And then: "Make the icons in the left menu larger... they are too small against the rest." (The icons of the activity rail; a matter of its drawing, with no requirement of its own.)
And then, having used it: "A bit more margin on the left and on the right" (of the activity rail's icons). And: "On the Overview in the Inspector... the scores at the start, the fixes after them." This takes the place of To fix above the scores, as first built from "what the user has to fix to appear first": what is to fix stays apart from the warnings, under the scores.
Translated from Polish.
