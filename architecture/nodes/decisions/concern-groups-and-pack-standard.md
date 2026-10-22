---
id: "000b9208-5963-41bd-8ddd-e69e571b5b36"
type: "adr"
label: "Concern groups and pack standard"
alternatives: |
  1. Group by quality attribute only (ISO 25010): authentication and secrets both land in Security, data retention and backups split between Security and Reliability, and Technology has no place.
  2. Free tags instead of groups: no single place to look, the inconsistency the review found.
  3. The proposed list (communication, data, API, authentication, tech stack, resiliency, maintainability, security, quality): mixes areas, attributes and a subgroup.
consequences: |
  • One question decides where a pack goes: where is the decision made.
  • A pack costs more to write; fewer, better packs.
  • Fitness functions come with something to run, so a team can name its test the same day.
  • The catalogue grows by group; empty groups show what is still missing.
context: "The first ten concern packs sat in one flat list, and a classification proposed for them mixed three axes: areas of the system (communication, data, API, tech stack), quality attributes (resiliency, maintainability, quality) and a part of another group (authentication within security). Their contents were uneven: two or three questions, requirements without numbers, decisions that named no technology, fitness functions described in prose that nobody can run, and no sources to check them against."
date: "2026-10-22"
decision: "Every concern pack belongs to exactly one group, by the area of the architecture where its decision is made: Identity & access (who calls and what they may do), Security (protection against abuse and leaks), Data (what is kept, for how long, how consistently), Integration (how the system talks to others), Reliability (how it behaves under failure and load), Operations (how it is run and watched), Maintainability (how its code can be changed) and Technology (what it is built on). Each group names the ISO/IEC 25010 characteristics it serves. A pack's hub block holds its group (concern.group) and its sources (title and link: OWASP ASVS, GDPR articles, Google SRE, ISO 25010, 12-factor, the tools' own documentation). The Hub, Studio's import dialog and the concern wizard show and filter packs by group. Every pack meets a standard that the catalogue's validation enforces where it can: at least three questions with options, each option saying what it means and when to pick it; at least two sources; every fitness function naming its tool (a Tool: line) and carrying a snippet to copy (a fenced block). What it cannot check is reviewed: requirements carry a number from the answers or a standard where one applies, and decisions name technologies and the criteria to choose between them."
status: "accepted"
---
