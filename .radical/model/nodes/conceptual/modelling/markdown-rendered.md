---
id: "d6499a5a-0f3a-4e79-968c-8029646edbd3"
type: "scenario"
label: "Markdown rendered"
given: "the bookstore on the governance metamodel, Payment Provider's description written in Markdown (a bold word, a second paragraph with a list and a link) and a requirement whose action has a bold word"
then: "the table's summary shows Stripe bold and the requirement's who shall do what bold as a whole, the tooltip reads Card payments via Stripe.; the wiki shows Stripe bold, the list's two items and a link that opens outside the app, and the click opens the description as written; a remote image shows as a link with its address and nothing is fetched, whatever form its address has (https:host, //host, \\\\host), a link emptied by sanitising is text, and a link into the app opens here; the card reads it without marks; a Markdown field keeps its marks in a summary, a plain value is escaped, .cap capitalises past the marks and .bold folds the bold inside it"
when: "the user opens the Element Table, the provider's wiki page, clicks its description, and opens the System Context; and summaries are taken of an ADR and a requirement whose fields and template use Markdown"
---
