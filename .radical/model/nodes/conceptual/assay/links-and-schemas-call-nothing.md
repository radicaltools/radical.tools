---
id: "5c16ebdf-bb59-44ec-9712-789548cfc27a"
type: "scenario"
label: "Links and schemas call nothing"
given: "a web application whose package.json names its $schema, whose lock file names registries and funding pages, whose phpunit.xml names an XML namespace, whose views link to a framework's documentation and draw an SVG, and whose index.php requires __DIR__ . '/../vendor/autoload.php'"
then: "none of them is an address or a URL path; the path its view fetches is"
when: "Assay reads it"
---
