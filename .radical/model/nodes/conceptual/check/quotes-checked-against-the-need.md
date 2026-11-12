---
id: "b64ef28c-1f81-49fc-ae67-0c6243d378fa"
type: "requirement"
label: "Quotes checked against the need"
action: "it shall report as an error each quoted fragment the need's text does not hold as whole words (upper and lower case, white space, Markdown emphasis and code marks, list and quotation markers, dashes and quotation marks ignored; an ellipsis inside a fragment joins pieces that must be in the need in that order, within one question, answer or the text before the questions), each fragment of fewer than two words, and each quote on a derives relation to an element that is not a need; a derives relation from a requirement to a need without a quote it shall report as a warning only when check.json turns derives-quote-missing on, and measure as the goal requirements-quoting-need, the share of requirements derived from a need that quote it, once a relation of the model quotes"
ears_type: "event-driven"
rationale: "A quote the need does not hold is a broken trail: made up, or the need changed after the requirement was written. A model that starts quoting has hundreds of relations without a quote (759 in radical.tools' own): a share to raise, not a list of warnings that hides the others."
trigger: "radical check or the Inspector checks a model with requirements derived from needs"
---
