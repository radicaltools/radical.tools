---
id: "edbb650f-d97f-4fbb-ad29-9301a3009a57"
type: "scenario"
label: "Quoted values reach a scenario"
given: "a requirement that takes \"0\" and \"null\" from the words it quotes, verified by a scenario whose then names only null"
then: "first it warns that the scenario does not say \"0\"; then nothing; the requirement's own value is not asked of the scenario"
when: "radical check checks the model, then again with the scenario's then naming 0 as well, then with the requirement stating a value of its own"
---
