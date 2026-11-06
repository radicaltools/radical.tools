---
id: "4fe17e8c-46a0-42c2-8bbb-58973702dc94"
type: "requirement"
label: "Keep copies inside their folder"
action: "the system shall write nothing outside that folder and empty no other folder, refusing the source or naming it apart"
ears_type: "unwanted-behaviour"
rationale: "A document site or an archive is not to be trusted with where its files go."
unwanted_condition: "a link's file name, an entry of a .zip file, or the name of a source or a .zip file would put a file outside its own folder in .radical/assay/sources/ or .radical/assay/unpacked/, or name a folder made only of dots"
---
