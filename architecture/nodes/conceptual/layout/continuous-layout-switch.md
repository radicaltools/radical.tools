---
id: "59751b19-a3ae-4125-8ace-28e709da6373"
type: "requirement"
label: "Continuous layout switch"
action: "Studio and the MCP server shall save the setting with the view, and Studio shall tidy the view at once when it is switched on."
ears_type: "event-driven"
rationale: "The setting belongs to the view (a view being built keeps itself tidy, a hand-drawn one does not), so it is saved in the model and holds for everyone who opens it."
trigger: "the user switches continuous layout on or off beside Smart Layout or in the view's properties, or an agent sets continuousLayout with create_view or update_view"
---
