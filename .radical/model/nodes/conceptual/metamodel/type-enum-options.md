---
id: "9fc92dec-1a77-40e6-85ee-2712db9c4cb6"
type: "scenario"
label: "Type enum options"
given: "a new enum property keyed tier on the Container type"
then: "the field keeps the text as typed and the type saves the three options gold, in progress and bronze; nothing is asked until the field is left; the options typed before Esc are kept as the field showed them"
when: "the user types \"gold, in progress, bronze\" into its options and closes the editor; types a new enum's first options letter by letter and leaves the field; types options and closes the editor with Esc"
---
