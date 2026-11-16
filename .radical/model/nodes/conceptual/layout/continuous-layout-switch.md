---
id: "59751b19-a3ae-4125-8ace-28e709da6373"
type: "requirement"
label: "Continuous layout switch"
action: "Studio and the MCP server shall save the setting with the view as on or off, which holds over the Keep smart default in Settings (Keep smart by default); the view's properties and update_view (continuousLayout null) can also take the setting away, so the view follows the default again; Studio shall tidy the view at once when it comes on."
ears_type: "event-driven"
rationale: "The setting belongs to the view (a view being built keeps itself tidy, a hand-drawn one does not), so it is saved in the model and holds for everyone who opens it; a view without one follows each person's default. Taking the setting away (in the view's properties, or continuousLayout null over MCP) is the model's decision: without it a view once switched could never follow the default again."
trigger: "the user switches Keep smart on or off beside Smart Layout in Designer or in the view's properties, or an agent sets continuousLayout with create_view or update_view"
---
