---
id: "9f4e027a-9eea-4295-9e54-c35d9067cf3e"
type: "scenario"
label: "Address in a form's fields linked"
given: "a VB6 Modbus master whose form's host field holds 127.0.0.1 and port field 1502 by default, and a slave whose form's port field holds 1502 beside a listening socket"
then: "the master is linked to the slave by that port"
when: "Assay reads both"
---
