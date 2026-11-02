---
id: "f2ad46cb-6299-4832-ab87-69c3f45e3085"
type: "requirement"
label: "Studio opens a repository's model"
action: "Studio shall open the model in .radical/model, named after the repository, read the repository's .radical/radical.json beside it, and ask again for access to the folder that holds that file whenever it asks again for the model's"
ears_type: "event-driven"
trigger: "the user opens a folder in Studio that is no model folder but a repository holding .radical/model, or that .radical/ folder itself (an open dialog hides .radical/, and one shown hidden folders may pick it)"
---
