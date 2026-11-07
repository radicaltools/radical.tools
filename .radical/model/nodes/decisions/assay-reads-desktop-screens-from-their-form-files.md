---
id: "32fffe99-fc4f-4088-8719-9ac6c012d83d"
type: "adr"
label: "Assay reads desktop screens from their form files"
alternatives: "1. Drive the running desktop application (UI Automation, WinAppDriver): sees what the user sees, but needs Windows, the application installed and its data. 2. Screenshots read by the agent (computer use): every claim the agent's reading of a picture. 3. Leave desktop screens out until a driver exists, as before."
consequences: "A legacy desktop application gets its screens and the flow between them without being run, on any machine. The wireframe is what the form file states, not what the user sees: controls drawn at run time, owner-drawn controls and pictures are boxes. Forms opened by a name held in a variable are not joined."
context: "The Explore stage reads the screens of a running web application (ADR Assay explores the running application); desktop applications were left for drivers that do not exist yet. A VB6 application, the legacy Assay meets most, describes every screen in its .frm file: the form's caption and size, each control with its kind, caption and position, and the code behind it, which opens other forms. Agent runs on three VB6 repositories came back with no mockup at all. The maintainer, 2026-11-07 (translated from Polish), asked for this first among the next steps: \"start with 1\" (VB6 screens as mockups without running the application)."
date: "2026-11-07"
decision: "Assay reads each VB6 form as a screen fact of its unit, statically: its name, caption, size, its controls with their kinds, captions and positions, the labels' text, and the forms its code opens (Show, Load) from the handler of a control, a menu item or the form itself. A plan's mockups take such screens as they take explored ones; the server writes each with a low-fi wireframe drawn from the form's controls at their positions, and joins the mockups where one form's code opens another (navigates-to, labelled with the control that does it). Nothing runs."
status: "accepted"
---
