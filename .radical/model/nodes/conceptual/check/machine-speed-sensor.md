---
id: "5bada32a-9246-4044-8b1a-a0a3cc7a9d91"
type: "requirement"
label: "Machine speed sensor"
action: "it shall time Radical's fixed work, or a command given with --work, after a warm-up, take the median of the timed runs, and measure it as machine.work in ms and as machine.speed, its ratio to the repository's reference time; with --reference it shall save the time as the reference in the repository's .radical/radical.json; with --again it shall keep the slower of this run and the one measured before the tests"
ears_type: "event-driven"
rationale: "A time limit set on one machine fails on a slower or busier one for no real cause; a shared CI runner's speed even changes while the tests run. ADR Limits scaled to the machine."
trigger: "the machine sensor runs"
---
