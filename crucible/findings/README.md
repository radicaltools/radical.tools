# Findings

Ways the code breaks a rule, as Radical Crucible recorded them: one file per
finding, `F-0001.md`, written by `radical fuzz --survey` (see
[apps/cli/README.md](../../apps/cli/README.md#radical-fuzz)). Its front matter
says the rule, the signature, the fuzz file, world, seed, path and length that
replay it (`radical fuzz --replay F-0001`), the commit and the day; the body
lists the steps and what differs.

A finding starts `open`. A test bound to a scenario makes it `hardened`, the
fix `fixed`, a decision that the behaviour is meant `intended` (written down as
an ADR or a requirement). The findings before Crucible are items 1 to 284 of
[docs/IMPROVEMENTS.md](../../docs/IMPROVEMENTS.md).
