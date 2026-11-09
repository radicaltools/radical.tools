---
id: "0d68d40c-e015-451b-adf0-1e256bd7df6e"
type: "requirement"
label: "Score an agent's model on the bench"
action: "the system shall score the model against what was written down for them: the units its containers, components and web applications are built from, the calls its relations between those elements, the databases and the services they rest on make (a deployed service as the unit it runs, else as service:<name>, read from the repositories' facts; a relation labelled bundled into, between a library and the container that bundles it, as the container's call of the library, whichever way it is drawn), and the tables its entities are; units of kind tests are no missed elements, nor tables that only join two others (foreign keys to two tables and no column of their own beyond them, their key or bookkeeping) missed entities, as Assay's procedure makes neither, and a unit a database or queue rests on through the service running it counts as built; each as recall and precision, naming every unit, call and table missed or not stated"
ears_type: "event-driven"
rationale: "The bench judged only the facts; what an agent adds or loses between the facts and the model was compared by hand."
trigger: "the bench is given the central model an agent wrote for some of its repositories"
---
