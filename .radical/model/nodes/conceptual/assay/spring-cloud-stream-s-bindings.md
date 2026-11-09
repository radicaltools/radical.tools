---
id: "32a13804-26ba-45d8-af34-0066aee4f10b"
type: "scenario"
label: "Spring Cloud Stream's bindings"
given: "a reminder unit sending through source.output() whose properties bind output to todo-mail, and a mailer unit with @StreamListener(Sink.INPUT) whose YAML binds input to todo-mail"
then: "the reminder calls the mailer through todo-mail"
when: "Assay reads and links them"
---
