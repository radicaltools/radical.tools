---
id: "4ac001dd-f9e3-417b-9896-6bc56c5d586f"
type: "requirement"
label: "Take documents as sources"
action: "the system shall keep a text copy of each document it holds in a folder of its own in the central repository's .radical/assay/sources/ (Markdown and text as they are, HTML as Markdown, a PDF's text, and text formats such as YAML, JSON, XML and SQL), within limits of size, count and time, name the files it skips or leaves out, list each copy as a document fact with its title, its headings (of Markdown, text and AsciiDoc) and where it came from, and leave an earlier copy of a source given again as it was when the new one fails"
ears_type: "event-driven"
rationale: "What a system's people wrote about it is evidence of intent; a copy lets a citation of it be checked when it is made and read again later."
trigger: "a run is given a folder, a .zip file or a public http(s) link as a source of documents, at its start or with assay_add_sources"
---
