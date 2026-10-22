---
id: "969cf1a2-096a-41a5-ba79-0eefe310eb82"
type: "scenario"
label: "Wiki Pages and card follow"
given: "a wiki whose chain nests needs and the requirement Pick up in store under the need Shop staff interviews, its page remembered, and the requirement on a canvas"
tests: |
  apps/e2e/tests/studio/show-in-view.spec.ts › a wiki nested by its chain › the Pages open the way to the element and mark it, also through a branch closed by hand
  apps/e2e/tests/studio/show-in-view.spec.ts › a wiki nested by its chain › a wiki opened from the list of views shows the page it was left on in the Pages, its way open
  apps/e2e/tests/studio/show-in-view.spec.ts › a wiki nested by its chain › a page's properties button opens its element in the card, which an open card follows to the page read
then: "the requirement is marked in the Pages and in sight, its way open, also after the branch was closed by hand; the closed card stays closed on another page; [properties] shows the need in the card, which goes along to the requirement's page; after ✕ it stays closed; in Viewer the card shows read-only"
when: "the user opens the wiki from the list of views; opens it from the card's Views, closes the need's branch, goes to the Overview and opens it from the card again; goes to a page with the card closed, clicks [properties], goes to the requirement's page, closes the card with ✕ and goes to another page; and clicks [properties] in Viewer"
---
