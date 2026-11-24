---
id: "f6ead461-d897-4512-9d0d-6fb82419e413"
type: "requirement"
label: "Violations fixed by a deadline"
action: "record it in tests/a11y/known.json with its rule, the state it appears in, an issue and a due date at most 30 days after it was found, and fail the nightly check once the due date has passed"
ears_type: "event-driven"
rationale: "An existing front end or a third-party widget may not be fixable at once; a list with issues and due dates keeps the debt visible and bounded, and the statement can name it as content not yet accessible."
trigger: "a serious or critical violation found by the automated checks cannot be fixed in the change that finds it"
---
