---
id: "5f1a5ebe-67c5-4ce7-9500-03c572fcf92d"
type: "scenario"
label: "Broken model file left alone"
given: "bookstore opened from a .radical file"
metrics: |
  test(apps/e2e/tests/studio/files.spec.ts › a model file that does not parse, or is gone, is named and left as it is) passed
  test(apps/studio/tests/fileUnreadable.test.ts › a .radical file that cannot be read) passed
then: "Studio names the file and why it cannot be read, shows no empty model as if it were the file, and writes nothing to it, nor makes it again"
when: "a trailing comma is added to the file by hand and the page is reloaded, and then the file is deleted outside Studio and the model opened from Recent"
---
