---
id: "16286b31-2fef-4d1a-8212-471cc68039b8"
type: "fitness-fn"
label: "Heuristic review held and acted on"
cadence: "temporal"
characteristic: "interaction-capability"
every: "180d"
invocation: "manual"
metrics: "review(Heuristic review) passed"
scope: "holistic"
---

Every 180 days, and before each major release, three people (a designer, a developer and someone who knows the users' work; not the authors of the screens alone) each walk the main journeys alone against the heuristics and principles below, then merge their findings, rate each on Nielsen's severity scale (the mean of the three ratings) and file an issue for every finding rated 3 or 4. The record is committed under docs/usability/reviews/, one file per review, named by its date; the release checklist asks for the latest record and for its 3s and 4s to be closed.

Threshold: A review record no older than 180 days (and one since the last major release), from three evaluators, with every finding rated; 0 findings rated 3 or 4 open at a release

Tool: A review record in the repository (Markdown), three evaluators

```md
<!-- docs/usability/reviews/<YYYY-MM-DD>.md (copied from docs/usability/reviews/TEMPLATE.md): one file per review; the next is due 180 days later -->
# Heuristic review, 2026-11-24

Build reviewed: v1.8.0 (commit abc1234)
Journeys: sign up, place an order, change the delivery address
Evaluators, each alone first: A. Designer, B. Developer, C. Support lead

| No. | Where (page, step) | Heuristic or principle | What happens | Severity (mean of 3) | Issue | Fixed in |
|---|---|---|---|---|---|---|
| 1 | /checkout, address | H5 Error prevention; ISO: use error robustness | A typo in the postcode is found only after payment | 3 | #412 | |
| 2 | /orders | H1 Visibility of system status | The list shows nothing while it loads | 2 | #413 | |

Heuristics (Nielsen): H1 Visibility of system status; H2 Match between the system and the real world; H3 User control and freedom; H4 Consistency and standards; H5 Error prevention; H6 Recognition rather than recall; H7 Flexibility and efficiency of use; H8 Aesthetic and minimalist design; H9 Help users recognize, diagnose, and recover from errors; H10 Help and documentation.
Principles (ISO 9241-110:2020): suitability for the user's tasks; self-descriptiveness; conformity with user expectations; learnability; controllability; use error robustness; user engagement.
Severity (Nielsen): 0 not a problem, 1 cosmetic, 2 minor, 3 major (fix before the release), 4 catastrophe (fix before the release).
Outcome: findings rated 3 or 4: 1, all with an issue; release blocked until #412 is closed.
```
