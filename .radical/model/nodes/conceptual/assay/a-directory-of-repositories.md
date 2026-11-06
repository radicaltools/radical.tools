---
id: "1440e22b-69af-4d76-b075-3413ee1dceb4"
type: "requirement"
label: "A directory of repositories"
action: "the system shall take each repository directly inside it as one of the run's, or, when it holds nothing but folders, each repository up to three levels down; when it holds none, the directory itself is a folder of code, whose facts the run keeps in the central repository's .radical/assay/facts/ and whose own folder it leaves unchanged, naming the repositories its walk leaves out; and it reads nothing outside the directories given"
ears_type: "event-driven"
rationale: "A team keeps its repositories cloned side by side, and code handed over by hand is often a plain folder; Assay fetches and clones no repository (ADR Radical Assay)."
trigger: "a directory given to Assay is no repository"
---
