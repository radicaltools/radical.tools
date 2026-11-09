---
id: "f3d69200-34a6-429a-8206-80e687d8bd94"
type: "scenario"
label: "Compose's first format and images named for units"
given: "a compose file of the first format whose config-server service, from the image acme/basic-config-server, links rabbitmq, beside a valkey-cart service and a cart unit"
then: "config-server runs the config-server unit and depends on rabbitmq, and valkey-cart runs no unit"
when: "Assay reads it"
---
