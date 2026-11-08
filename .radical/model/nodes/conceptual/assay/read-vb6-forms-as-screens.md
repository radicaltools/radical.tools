---
id: "21d17477-69bd-4298-8903-35336632a002"
type: "requirement"
label: "Read VB6 forms as screens"
action: "the system shall record each form and each ActiveX document (UserDocument) its project lists as a screen fact of that unit with its name, caption, size, its controls (kind, name, caption, position) and the forms its code opens, each with the control or menu item whose handler opens it; two files declaring one form name are two screens"
ears_type: "event-driven"
rationale: "A form file states the screen exactly; reading it needs no running application."
trigger: "a VB6 unit has form files (.frm) or ActiveX documents (.dob)"
---
