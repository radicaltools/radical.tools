---
id: "bba002d8-33d2-4835-8bec-70195523970d"
type: "requirement"
label: "Rewrite requirement sentence"
action: "The wiki view shall read the sentence into its EARS pattern, clauses and action again, clear the parts the new sentence does not have, and leave the requirement unchanged on Esc."
ears_type: "complex"
precondition: "Studio is in the Designer perspective"
rationale: "Changing a When into a While is easier as text than slot by slot. Evidence: packages/ui/src/components/WikiView.tsx (EarsSentenceEditor, rewrite), packages/common/src/metamodel (parseEarsSentence)."
trigger: "the user presses [rewrite] above a requirement's EARS sentence on a wiki page, edits the text and presses Enter"
---
