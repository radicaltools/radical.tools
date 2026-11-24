---
id: "ce910f46-7e18-44d3-9e0b-811f4775fb57"
type: "need"
label: "Fast and usable on the devices people have"
kind: "brief"
source: "Hub concern pack: Mobile and perceived performance"
---

People open this front end on their own phones and computers, over networks they do not choose, some zoomed in, most with a thumb. A page that paints late, jumps while it loads, answers a tap slowly, scrolls sideways or has targets too small to hit loses them, however it looks on a developer's laptop. The budget it is held to and the rules for small screens must be written down, measured on every change and, once it is live, from real visits, and judged in one place. The checks assume the main pages are listed in the tests (/, /search and /checkout in the snippets), a preview server on http://localhost:4173 (npm run preview), and, with real-user monitoring, a table rum_events(name, value, device, page_group, received_at) that the page's beacons fill.
