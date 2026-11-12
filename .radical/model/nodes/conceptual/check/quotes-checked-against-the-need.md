---
id: "b64ef28c-1f81-49fc-ae67-0c6243d378fa"
type: "requirement"
label: "Quotes checked against the need"
action: "it shall report as a warning each derives relation from a requirement to a need without a quote, and as an error each quoted fragment the need's text does not hold (upper and lower case, white space and a leading or trailing ellipsis ignored; an ellipsis inside a fragment joins pieces that must each be in the need)"
ears_type: "event-driven"
rationale: "A quote the need does not hold is a broken trail: made up, or the need changed after the requirement was written."
trigger: "radical check or the Inspector checks a model with requirements derived from needs"
---
