---
id: "931c0c74-8206-449c-92db-a0968501f994"
type: "need"
label: "Concern groups by standard"
kind: "stakeholder-note"
source: "Product owner, Hub regrouping 2026-10-29"
---

Rethinking the Hub (2026-10-29, translated from Polish): I want to remodel the Architecture Hub. Concerns:
1. Secure By Design, all OWASP based
2. REST API Guideline, select any standard, like the Microsoft guideline
3. Architecture: architecture style, communication patterns
4. Coding Standards
5. Tech Radar
6. Compliance, i.e. GDPR, PII etc.

Then: add an SDLC standard to my list. On the Tech Radar: for now I do not want a new type; the tech radar will come from the ADRs.

Agreed 2026-10-29: eight groups by the standard and the role that keeps it (Secure by Design, API Guidelines, Architecture, Coding Standards, SDLC Standard, Tech Radar, Compliance, and Operability & Reliability, added so that availability, capacity, observability and backup keep a place). First the 33 packs move whole into the new groups; new packs follow (SDLC and API Guidelines first, then Compliance starting with DORA, then Secure by Design, Operability & Reliability and Tech Radar), and the radar view is a change of its own.
