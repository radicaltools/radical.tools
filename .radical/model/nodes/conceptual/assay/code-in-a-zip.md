---
id: "b23a2fc6-9872-4045-b4dd-c5503036d73e"
type: "requirement"
label: "Code in a zip"
action: "the system shall unpack it into a folder of its own in the central repository's .radical/assay/unpacked/, leaving out any .git folder it holds (whatever its case) so that no git configuration of the archive runs, read each repository it held as a folder of code of its own, refuse it whole when an entry would land outside that folder, and read what it holds as a directory given"
ears_type: "event-driven"
rationale: "Code is often handed over as an archive (ADR Radical Assay, sources besides the code)."
trigger: "a .zip file is given to Assay as code"
---
