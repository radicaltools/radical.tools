<!--
  The heuristic review of radical.tools (Usability pack, fitness function
  "Heuristic review held and acted on"): every 180 days, and before each
  major release.

  To hold one: copy this file to docs/usability/reviews/<YYYY-MM-DD>.md (the
  day the findings were merged), fill it in, and commit it. Then record the
  result, so `radical check` sees it (the fitness function's condition is
  `review(Heuristic review) passed`, read from .radical/reviews.json):

    radical sense review "Heuristic review" --passed --by "<evaluator 1>, <evaluator 2>, <evaluator 3>" \
      --note "docs/usability/reviews/<YYYY-MM-DD>.md; findings rated 3 or 4: <n>, all closed"

  Commit .radical/reviews.json with the record. Use --failed instead of
  --passed while a finding rated 3 or 4 is still open at a release, or when
  fewer than three people reviewed; record --passed once the record is
  complete and those findings are closed.
-->
# Heuristic review, YYYY-MM-DD

Build reviewed: vX.Y.Z (commit abc1234), Studio at studio.radical.tools, the Hub at hub.radical.tools, the site at radical.tools

Journeys, each walked from its start:
- Site: the home page, Use cases, the guide (manual.html) and the reference, the blog.
- Hub: the landing page, browse the catalogue, a group, open a pack (wiki, canvas, table), answer its questions, import it into Studio.
- Studio, a first visit: Setup, New model, Try the sample model, Open a folder.
- Studio, modelling: add elements (the palette and the wizard), relations, views and the wiki, Quick Search, Smart Layout.
- Studio, governance: the Inspector, the Models dialog, milestones, Presentations.

Evaluators, each alone first (a designer, a developer, someone who knows the users' work; not only the authors of the screens):
1. Name, role
2. Name, role
3. Name, role

| No. | Where (front end, page or place, step) | Heuristic or principle | What happens | Severity (mean of 3) | Issue | Fixed in |
|---|---|---|---|---|---|---|
| 1 | | | | | | |

Heuristics (Nielsen): H1 Visibility of system status; H2 Match between the system and the real world; H3 User control and freedom; H4 Consistency and standards; H5 Error prevention; H6 Recognition rather than recall; H7 Flexibility and efficiency of use; H8 Aesthetic and minimalist design; H9 Help users recognize, diagnose, and recover from errors; H10 Help and documentation.

Principles (ISO 9241-110:2020): suitability for the user's tasks; self-descriptiveness; conformity with user expectations; learnability; controllability; use error robustness; user engagement.

Severity (Nielsen): 0 not a problem, 1 cosmetic, 2 minor, 3 major (fix before the release), 4 catastrophe (fix before the release).

Already measured on every pull request (apps/e2e/tests/ux, held at their counts of 2026-11-24 because the product owner decided to change nothing in the UI then): look at them again, rate them, and say whether they should be fixed.
- The site's footers differ: three sets over index, usecases and blog/, manual.html and reference.html (navigation.spec.ts).
- The Hub's landing page has a footer, the catalogue, a group and a pack none (navigation.spec.ts).
- One target linked many times in the main content: index.html 10 times to manual.html, manual.html 13 times to reference.html, reference.html 6 times to manual.html, usecases.html 26 times to manual.html, counted without the #section (links-repeated.spec.ts).
- manual.html's Contents has "Viewpoints" twice, to the guide's section and to the reference's (link-texts.spec.ts).
- Studio's new-element wizard and AI provider settings keep their button disabled while a required field is empty and mark no field (the wizard says "Required: Name" in its footer) (form-errors.spec.ts).
- An empty structure view in Studio shows an empty canvas and no word (empty-states.spec.ts).

Outcome: findings rated 3 or 4: n, each with an issue; closed before the release: yes / no.
