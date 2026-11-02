---
id: "7f5a39b1-b58e-4e58-90e2-1b1fe9323d19"
type: "requirement"
label: "Search keeps up with typing"
action: "Studio shall find the matches within 100 ms, folding each element's text for the search once rather than again on every keystroke."
ears_type: "event-driven"
rationale: "On a model of 21,000 elements (radical.tools' own model repeated 14 times) each keystroke in Quick Search took 1.4 s, 0.11 s on the model itself: the search folded case and accents of every name, description and property value character by character, with Unicode normalisation, on every keystroke (2026-10-30). Evidence: packages/common/src/search.ts (foldText, foldWithMap), apps/studio/src/renderer/src/components/QuickSearch.tsx, apps/e2e/tests/studio/scale.spec.ts (the benchmark, run with SCALE_MODEL)"
trigger: "the user types a letter in Quick Search in a model of 20,000 elements"
---
