---
id: "49c023a9-0046-4565-9bf8-75034af7cd6f"
type: "adr"
label: "Usability held to ISO 9241-110 and Nielsen's heuristics"
alternatives: |
  1. Usability testing with users only: finds the real problems, but rarely and expensively; the review and the tests keep the basics between rounds.
  2. A design review on each pull request without measures: depends on who reviews, and nothing shows a drift over time.
  3. Analytics only (drop-off, rage clicks): shows where people struggle, not why, and only after they have.
concern: "usability"
consequences: |
  • Consistency becomes a test result, not a matter of taste: a page that drifts fails its pull request.
  • tests/ux/journeys.ts must list the main journeys' pages, forms and empty views, and be kept up to date as pages are added.
  • The review costs three people about half a day each per cycle; it finds what no test describes.
  • The checks measure markup (landmarks, accessible names, aria-invalid), so they push the front end towards semantic HTML as a side effect.
context: "People use this web front end to get their tasks done, most of them without training and many on a small screen. The forces: every page added by a different person or team drifts a little from the others, until the same thing is named, placed and linked differently on each; a link repeated \"to be safe\" adds tab stops, screen-reader noise and the doubt whether two links lead to the same place; link names such as \"Read more\" say nothing out of context, and screen-reader users often list the links of a page on their own; forms are where people give up, and an error that is shown late, vaguely or out of sight costs the whole form; an empty list with no word of explanation looks broken; and usability problems are cheap to find with a few evaluators and a checklist, and expensive once users have learned to work around them."
date: "2026-11-24"
decision: "The front end is held to the seven interaction principles of ISO 9241-110:2020 (suitability for the user's tasks, self-descriptiveness, conformity with user expectations, learnability, controllability, use error robustness, user engagement) and to Nielsen's ten usability heuristics. What can be counted is measured by Playwright tests over the main journeys on every pull request (navigation, repeated links, link names, form errors, empty views) and written as radical-metrics/1, so the numbers show in the model as well as in the build. What cannot be counted is found by a heuristic review every 180 days and before each major release: three evaluators, alone first, findings rated 0 to 4, every 3 or 4 fixed before the release. Empty views: a plain message. Navigation, links and form errors are decided in the records below. Accessibility (WCAG 2.2, assistive technology) is decided in the Accessibility pack, and phones and perceived speed in the Mobile and perceived performance pack; this pack refers to them and does not repeat their checks."
status: "accepted"
---
