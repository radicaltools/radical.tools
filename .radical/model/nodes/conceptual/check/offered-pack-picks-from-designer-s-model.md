---
id: "0219177d-c0dd-4025-a263-2be129721e78"
type: "scenario"
label: "Offered pack picks from Designer's model"
given: "a model whose milestone v1 still holds the web app Storefront, deleted since, and whose live model holds the web app Shop Web, shown in Viewer on v1"
then: "the wizard offers and ticks Shop Web and does not offer Storefront; the pack's decisions constrain Shop Web, and Storefront does not come back"
when: "the user imports the Authentication pack from the Hub"
---
