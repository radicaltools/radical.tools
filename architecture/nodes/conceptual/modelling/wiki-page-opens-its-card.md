---
id: "034dc833-82ed-4a70-9652-485e55f7d690"
type: "requirement"
label: "Wiki page opens its card"
action: "the wiki shall open the way to the page in its Pages as the tree draws it (by the filter's chain where the view has one, else containment), also through a branch closed by hand, and mark and scroll to the page there; [properties] shall show the page's element in the properties card (read-only out of Designer, not on a slide); an open card shall go along to each page read, and a closed one, ✕ included, stay closed"
ears_type: "event-driven"
rationale: "A wiki selects nothing, so its element's card and views were out of reach from a page. A page nested by the chain (a requirement under the need it derives from) was not opened or marked in the Pages: the way to it was walked by containment (2026-10-22). The user settled that the card follows the pages only while it is open. Evidence: packages/ui/src/components/WikiView.tsx (WikiNav aroundFocus, WikiElementPage tools, lastFocus), packages/ui/src/store/showInView.ts (useCardOpen), packages/ui/src/components/RightPanel.tsx; manual#view-wiki"
trigger: "the user opens a page of a wiki view (its Pages, a link, the list of views, the card's Views) or clicks [properties] at the top right of a page"
---
