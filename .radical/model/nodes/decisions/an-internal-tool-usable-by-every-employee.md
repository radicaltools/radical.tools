---
id: "09634404-680b-4285-8cd7-d4af7d6c8374"
type: "adr"
label: "An internal tool usable by every employee"
alternatives: |
  1. Accessibility on request, when an employee needs it: a retrofit under time pressure, for one person who waits.
  2. A lower level (WCAG level A): fewer checks, and keyboard and contrast failures that affect many more people than screen-reader users.
concern: "accessibility"
consequences: |
  • No regulator, but the same level: a new colleague with a disability can start on day one.
  • The same accessible components serve internal and public front ends alike.
  • Should the tool later be offered to customers, it is already at the level the Act asks for.
context: "People with disabilities use this web front end with a keyboard, a screen reader, magnification, voice control or switch access, and many more people with a temporary injury, a bright screen or an old phone. The forces: accessibility is a legal duty in the EU (the European Accessibility Act for consumer products and services from 28 June 2025, the Web Accessibility Directive for the public sector, both presuming conformity through EN 301 549 and so WCAG) and in many other markets; it is cheap when built into components and expensive when retrofitted page by page; automated checkers find only part of the failures, so keyboard walks and screen-reader passes are needed for the rest; a failure found late either blocks a release or is shipped with a promise, and promises without a date are forgotten; and an accessibility statement is required of public bodies and expected of everyone, and is only worth something while it is true."
date: "2026-11-24"
decision: "The front end is an internal tool, outside the European Accessibility Act and the Web Accessibility Directive, and still conforms to WCAG 2.2 level AA: employment equality law (Directive 2000/78/EC, Article 5) asks for reasonable accommodation of employees with disabilities, and a tool that one employee cannot use has to be fixed or worked around at a worse moment. Every page and state of the main journeys is checked by axe-core and walked with the keyboard on every pull request; assistive technology: automated checks only; a serious or critical violation found: it is tracked and fixed within a set number of days. Statement: no accessibility statement. Reflow and target size are decided and measured in the Mobile and perceived performance pack; link purpose, consistent navigation and how form errors are shown in the Usability pack."
status: "accepted"
---
