---
id: "95ce80d3-7126-4173-bdc7-4d2570e21b05"
type: "scenario"
label: "Template value changed after edits"
given: "a templated Hub concept imported with Database = PostgreSQL, an ADR renamed since to \"ADR-007 Orders on PostgreSQL\", a relation and a flow whose texts hold the value, a milestone, and a concept file downloaded from the Hub"
tests: |
  packages/ui/tests/hubTemplateApply.test.ts › Apply on what was edited since the import
  packages/ui/tests/hubTemplateApply.test.ts › in a milestone, shows the values the milestone has, and a Propagate of another edit leaves the live record
  packages/ui/tests/hubTemplateApply.test.ts › a milestone looked at in Viewer leaves Designer the live record
  packages/ui/tests/hubTemplateApply.test.ts › a templated import discarded in a milestone leaves no record
  packages/ui/tests/hubTemplateApply.test.ts › a Hub concept file opens with its template filled and editable
  packages/common/tests/hubImport.test.ts › retemplateText
  packages/common/tests/hubImport.test.ts › the record Apply works from
  packages/common/tests/hubImport.test.ts › a template parameter left blank
  packages/common/tests/hubImport.test.ts › a Hub concept file opened as a model
  packages/common/tests/hubImport.test.ts › a concept imported twice
then: "the ADR reads \"ADR-007 Orders on MySQL\", a text without the old value or with it inside another word is unchanged, the relation and the flow's name and step notes change too, as one undo step; a blank value takes the template's default; in the milestone the section shows the milestone's values and Propagate leaves the live record; Viewer leaves Designer the live record; the discarded import leaves no record; the concept file opens with its template filled and editable; a concept imported twice gives its views and flows names of their own"
when: "the user sets Database to MySQL and presses Apply, leaves a parameter blank, applies a value in a milestone and propagates another edit, looks at a milestone in Viewer, discards an import made in a milestone, and opens the downloaded file"
---
