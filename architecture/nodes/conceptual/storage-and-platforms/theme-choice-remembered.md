---
id: "b8088b71-c459-4e81-8ab2-434ca95ec522"
type: "requirement"
label: "Theme choice remembered"
action: "The site shall switch between light and dark, including the manual's screenshots, and open in that theme on the next visit."
ears_type: "event-driven"
rationale: "Stored as radical-theme in the browser storage of each site (radical.tools, hub.radical.tools). Evidence: apps/web/theme.js, apps/web/style.css (.shot-light, .shot-dark), apps/hub/src/HubApp.tsx (LS_THEME)"
trigger: "the visitor switches the theme in the navigation bar of the website, the manual or the Hub"
---
