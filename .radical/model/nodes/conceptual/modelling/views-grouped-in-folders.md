---
id: "c35acb65-bc94-4317-92dc-9b00b6997456"
type: "scenario"
label: "Views grouped in folders"
given: "views in the folders C4, C4/Components and Conceptual and one at the top; in Studio, the bookstore sample on its System Context view"
then: "folders stand where their first view does, each with its count and the folders above a nested one; the view keeps C4/Components, then C4, then none; in Studio the view sits in C4 › Context, hides with its folder, is still there after the reload with its folder open, and goes back to the top"
when: "the list of views is built; an agent creates a view in \" C4 / Components/ \", moves it to C4, then to \"\"; the user moves System Context to \" C4 / Context \" in its properties, closes the folder, reloads, and picks No folder"
---
