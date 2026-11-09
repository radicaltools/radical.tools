---
id: "b4ad8834-049a-4280-8fb3-9fd98c6fe2fc"
type: "requirement"
label: "Link by address"
action: "the system shall link the unit to that unit as inferred, citing the address and what names the other or says it listens on that port; a subdomain of a public domain (api.github.com, docs.mattermost.com) names no unit by its first label, while a product's own domain (plausible.io) may"
ears_type: "event-driven"
rationale: "Services find each other by name; the name in an address is the call, whatever the language."
trigger: "a unit's code or configuration names an address (http://orders:8080/…, lb://orders, orders:3550, a server list's IP and port, http://localhost:${process.env.ORDERS_PORT || 3002} by its default) whose host is the name of another unit or of a service built from one, or whose port is one only one other unit of the run listens on and few programs use"
---
