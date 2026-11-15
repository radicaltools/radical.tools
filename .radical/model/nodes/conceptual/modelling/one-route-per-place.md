---
id: "6f8ecaad-db94-469a-a107-1fd3eebfab58"
type: "requirement"
label: "One route per place"
action: "Studio shall keep in the address one route, in one form, for the place on screen: the document, the perspective, the view, the selected element, the wiki page, the milestone, the slide played, and while the Inspector is open its tab and the element whose verification path it shows, so that reading the route back shows that place; a route that does not name the Inspector shows the view, the Inspector closed, so opening and closing it are steps of Back as a view switch is"
ears_type: "ubiquitous"
rationale: "A route that names the place in full and in one way is what history, links and bookmarks rest on; without the tab and the element, going back landed on the right view but not on what was looked at. Evidence: apps/studio/src/renderer/src/route.ts (Route, parseHash, formatRoute, currentRoute, applyViewModeFocus), apps/studio/src/renderer/src/navigation.ts (useInspectorNav)"
---
