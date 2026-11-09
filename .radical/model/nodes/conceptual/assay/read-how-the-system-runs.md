---
id: "1d76bc57-df23-4d1c-9f53-8407ec2ff575"
type: "requirement"
label: "Read how the system runs"
action: "the system shall read their services, each built from a unit or run from an image of a database, queue or cache, and the addresses their configuration gives one service of another, and the ports a compose service publishes on this machine as ports its unit listens on; a service another depends on only to have it finish first (a migrator or a seeding job, or one waited for with condition: service_completed_successfully) is no call of it; a compose file is read as docker compose reads it, the .env beside it interpolated (dockerfile: ${CHECKOUT_DOCKERFILE}) and a variable its services pass by name only (- CART_ADDR) holding the .env's value; compose's first format (services at the top level, links: for depends_on) is read too, and a service whose image is named for a unit with a prefix (acme/basic-config-server for config-server) or with the name's separators left out (configserver) runs that unit, when only one unit is so named; a compose file or Dockerfile under build/ is deployment, not build output; a Prometheus configuration's scrape targets are addresses of the unit holding it; an OpAMP server, which manages telemetry agents, is observability, as facts with their file and line"
ears_type: "event-driven"
rationale: "Deployment files state what runs and, in its environment, what calls what, in any language."
trigger: "a repository holds docker-compose files, Kubernetes manifests or a .NET Aspire AppHost"
---
