---
id: "49fa95f2-b9ea-4884-9372-581264580278"
type: "webapp"
label: "Website and manual"
technology: "Static HTML, CSS"
---

The radical.tools landing page and manual (apps/web: index.html, manual.html, landing.css, style.css, theme.js, screenshots), served at radical.tools and www.radical.tools from S3 + CloudFront. The deploy stamps the commit id into the CSS and script URLs (?v=__BUILD__), uploads the HTML uncached and the rest cached for an hour, and invalidates the entry points.
