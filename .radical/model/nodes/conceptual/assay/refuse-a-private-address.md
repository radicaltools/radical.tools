---
id: "87e6d2f7-94a1-42b0-ba96-3386998e04da"
type: "requirement"
label: "Refuse a private address"
action: "the system shall fetch nothing from it, unless the server runs with RADICAL_ASSAY_PRIVATE_LINKS=1, and say which address it refused"
ears_type: "unwanted-behaviour"
rationale: "A document the agent reads may name a link; fetched, a local service or a cloud's metadata would be kept for anyone who reads the run's sources."
unwanted_condition: "a source link, or a redirect it follows, leads to a loopback, link-local, private, multicast or reserved address, an IPv4 one written as IPv6 included, when it is checked or when the connection is made"
---
