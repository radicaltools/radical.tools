---
id: "9f04e33f-e331-4def-b39d-61307043c347"
type: "need"
label: "People find their way and recover from mistakes"
kind: "brief"
source: "Hub concern pack: Usability"
---

People use this front end to get their tasks done, most without training. They must find their way with navigation that stays the same from page to page, links that are neither repeated nor vague (not the same link five times on one page, not five links named "Read more"), forms that say what went wrong and where, and empty views that say why they are empty; and the usability of the whole must be reviewed against recognised principles on a schedule, not only after users complain. The checks assume Playwright tests under tests/ux with tests/ux/journeys.ts listing the main journeys' pages in the order a user walks them (PAGES: path, and the section where sections have their own navigation), their forms (FORMS: path, the submit button's name, the label of one field with a format to check) and the views that start empty for a new account (EMPTY_VIEWS: path); playwright.config sets the baseURL and, for pages behind sign-in, a storageState. Each test fails on its own in a plain run and, run by radical sense playwright, writes what it measured as a radical-metrics/1 file into RADICAL_METRICS_DIR.
