
# Documentation first

This repository keeps its design in Markdown, written before the code:

- `docs/requirements.md`: numbered requirements, one sentence each ("When
  …, the system shall …"), including the business rules the product owner
  gave.
- `docs/ARCHITECTURE.md`: the modules, what each is responsible for, its
  public interface, the data it owns, and how the modules call each other.
- `docs/adr/NNNN-title.md`: one file per decision, with status, date,
  context, decision, consequences and alternatives. A constraint the
  client's people state is a decision too.

For every request:

1. Read these documents first.
2. Update them for the change: new and changed requirements, the modules
   affected, a new ADR when a decision is made or an earlier one is touched.
   Check the request against the ADRs and the requirements; when it
   goes against one, keep the rule and find a way to meet the need inside
   it, or leave that part undone and say so.
3. Only then write the code and its tests.
4. Before you finish, re-read the documents and correct them where the code
   turned out different.
