// Briefs for the Hub matching benchmark (hubMatching.test.ts): system
// descriptions as a user would type them into Radical Forge, with the Hub
// concepts an architect would expect it to suggest per stage. `blueprint` is
// the blueprint that fits, if one does. Two are in Polish: lexical matching
// cannot read them, the model picking from the candidates can.

export interface Brief {
  name: string
  text: string
  blueprint?: string
  requirements: string[]
  fitness: string[]
  /** Patterns and ADRs for the C4 stage. */
  c4: string[]
}

export const BRIEFS: Brief[] = [
  {
    name: 'click & collect',
    text: '# Click & collect\nShoppers reserve products online and pick them up in a store within two hours. Store staff confirm the order is ready. Customers pay by card online; the checkout must stay fast on Black Friday.',
    blueprint: 'bp-ecommerce-platform',
    requirements: ['req-idempotency', 'req-page-load-time', 'req-api-response-time', 'req-availability', 'req-throughput'],
    fitness: ['ff-web-vitals', 'ff-latency-slo', 'ff-capacity-load-test', 'ff-error-budget'],
    c4: ['pattern-transactional-outbox', 'pattern-api-gateway', 'adr-caching-strategy', 'adr-integration-style', 'pattern-circuit-breaker'],
  },
  {
    name: 'mobile banking',
    text: 'A mobile banking app: customers log in with biometrics, check balances, send instant transfers to other banks and get fraud alerts. Every transfer is booked in a ledger. Must meet PSD2 and handle 2000 transfers per second.',
    blueprint: 'bp-fintech-ledger-platform',
    requirements: ['req-mfa', 'req-ledger-immutability', 'req-audit-logging', 'req-throughput', 'req-idempotency', 'req-encryption'],
    fitness: ['ff-ledger-balance-integrity', 'ff-capacity-load-test', 'ff-latency-slo'],
    c4: ['pattern-event-sourced-ledger', 'adr-ledger-reconciliation-strategy', 'adr-auth-strategy', 'pattern-bff', 'adr-data-consistency-model'],
  },
  {
    name: 'e-shop (Polish)',
    text: 'Sklep internetowy z odzieżą: klienci przeglądają katalog, dodają produkty do koszyka i płacą kartą lub BLIKIEM. Magazyn kompletuje paczki, kurier dostarcza. System musi obsłużyć 1000 zamówień na minutę w Black Friday i nie może pobrać płatności dwa razy.',
    blueprint: 'bp-ecommerce-platform',
    requirements: ['req-throughput', 'req-idempotency', 'req-availability', 'req-autoscaling'],
    fitness: ['ff-capacity-load-test', 'ff-scale-out-verification', 'ff-latency-slo'],
    c4: ['pattern-transactional-outbox', 'pattern-saga', 'pattern-event-driven', 'adr-integration-style'],
  },
  {
    name: 'HR SaaS',
    text: 'Multi-tenant SaaS for HR teams: each customer company signs in with its own SSO, pays per seat, and gets an audit log of every change. An AI assistant answers employees\' policy questions from the documents HR uploads.',
    blueprint: 'bp-saas-b2b-platform',
    requirements: ['req-resource-isolation', 'req-audit-logging', 'req-ai-groundedness', 'req-least-privilege', 'req-mfa'],
    fitness: ['ff-noisy-neighbor-guard', 'ff-ai-eval-gate'],
    c4: ['adr-multi-tenancy-strategy', 'pattern-rag-pipeline', 'adr-llm-provider-strategy', 'adr-auth-strategy'],
  },
  {
    name: 'support chatbot',
    text: 'A customer-support chatbot for a telecom: it answers questions from the knowledge base using an LLM, resolves simple cases on its own and hands over to a human agent when it is unsure. Answers must never be made up.',
    blueprint: 'bp-ai-assistant-platform',
    requirements: ['req-ai-groundedness', 'req-ai-human-handoff', 'req-ai-autonomous-resolution', 'req-fail-safe-default'],
    fitness: ['ff-ai-eval-gate', 'ff-fail-safe-verification'],
    c4: ['pattern-rag-pipeline', 'adr-llm-provider-strategy'],
  },
  {
    name: 'whiteboard',
    text: 'A collaborative whiteboard: several people draw on the same board at once and see each other\'s cursors live; it keeps working offline and merges the changes when the connection comes back.',
    blueprint: 'bp-realtime-collaboration',
    requirements: ['req-presence-latency', 'req-availability'],
    fitness: ['ff-sync-convergence-test'],
    c4: ['pattern-crdt-sync', 'adr-realtime-transport'],
  },
  {
    name: 'handmade marketplace',
    text: 'An online marketplace for handmade goods: sellers list items, buyers search and order, the platform takes a commission and pays sellers out weekly. Disputes between buyers and sellers are handled by support.',
    blueprint: 'bp-marketplace-platform',
    requirements: ['req-payout-latency', 'req-search-response-time', 'req-idempotency', 'req-audit-logging'],
    fitness: ['ff-ledger-balance-integrity', 'ff-latency-slo'],
    c4: ['adr-marketplace-payments-model', 'pattern-saga', 'pattern-event-driven'],
  },
  {
    name: 'analytics platform',
    text: 'A company-wide analytics platform: nightly ETL loads data from our operational systems into a lakehouse, analysts build dashboards and reports on it, and personal data must be deleted on request under GDPR.',
    blueprint: 'bp-analytical-data-platform',
    requirements: ['req-gdpr-erasure', 'req-data-retention', 'req-report-generation', 'req-batch-job-completion'],
    fitness: ['ff-data-residency'],
    c4: ['adr-data-store'],
  },
  {
    name: 'mainframe migration',
    text: 'We are replacing an insurance policy system that runs on a mainframe, one product line at a time, while the old system keeps serving the rest. The new services must not inherit the mainframe\'s data model.',
    requirements: ['req-backward-compatibility'],
    fitness: ['ff-coupling-guard', 'ff-api-contract'],
    c4: ['pattern-strangler-fig', 'pattern-anti-corruption-layer', 'adr-integration-style'],
  },
  {
    name: 'IoT telemetry',
    text: 'Factory sensors send telemetry events every second; the platform ingests them through a message broker, stores the time series and raises alerts when a machine overheats. Sensors get firmware updates that change the event format.',
    requirements: ['req-throughput', 'req-event-schema-compatibility', 'req-idempotency', 'req-alerting'],
    fitness: ['ff-capacity-load-test'],
    c4: ['pattern-event-driven', 'adr-event-schema-evolution'],
  },
  {
    name: 'patient portal',
    text: 'A patient portal for a hospital group: patients see their test results and book appointments, doctors sign in with two-factor authentication. Health data is encrypted and every access is logged; the portal must be usable with a screen reader.',
    requirements: ['req-encryption', 'req-audit-logging', 'req-mfa', 'req-accessibility'],
    fitness: ['ff-accessibility-scan', 'ff-data-residency'],
    c4: ['adr-auth-strategy', 'adr-zero-trust-network'],
  },
  {
    name: 'partner API',
    text: 'A public REST API for logistics partners: they create shipments and track them. Partners need a stable, documented contract, versioning without breaking their integrations, and fair rate limits per partner key.',
    requirements: ['req-api-standard', 'req-backward-compatibility', 'req-rate-limiting', 'req-auth'],
    fitness: ['ff-api-contract'],
    c4: ['pattern-api-gateway', 'adr-api-versioning', 'pattern-rate-limiter'],
  },
  {
    name: 'school SaaS (Polish)',
    text: 'Platforma SaaS dla szkół: każda szkoła to osobny klient z własnymi danymi, nauczyciele logują się przez SSO szkoły, opłata to abonament miesięczny. Dyrekcja chce dziennik zmian (kto, co i kiedy zmienił), a duża szkoła nie może spowalniać pozostałych.',
    blueprint: 'bp-saas-b2b-platform',
    requirements: ['req-resource-isolation', 'req-audit-logging', 'req-least-privilege'],
    fitness: ['ff-noisy-neighbor-guard'],
    c4: ['adr-multi-tenancy-strategy', 'adr-auth-strategy'],
  },
  {
    name: 'platform team',
    text: 'An internal developer platform: product teams deploy their services many times a day with zero downtime, all infrastructure is defined as code, and every service ships logs and traces to one observability stack.',
    requirements: ['req-zero-downtime-deploy', 'req-iac', 'req-centralised-logging', 'req-distributed-tracing'],
    fitness: ['ff-deploy-frequency', 'ff-lead-time', 'ff-change-failure-rate', 'ff-infra-drift'],
    c4: ['adr-deployment-strategy', 'adr-observability'],
  },
]

/** Written after the matcher was tuned on BRIEFS, and never tuned on: the
 *  benchmark's check against overfitting the weights and synonyms. */
export const HOLDOUT_BRIEFS: Brief[] = [
  {
    name: 'food delivery',
    text: 'A food delivery app: diners browse nearby restaurants, order and pay in the app, couriers pick up and deliver, and restaurants receive their earnings every week minus our fee. Lunchtime peaks are ten times the average load.',
    blueprint: 'bp-marketplace-platform',
    requirements: ['req-payout-latency', 'req-throughput', 'req-idempotency', 'req-autoscaling'],
    fitness: ['ff-capacity-load-test', 'ff-scale-out-verification', 'ff-latency-slo'],
    c4: ['adr-marketplace-payments-model', 'pattern-saga', 'pattern-event-driven'],
  },
  {
    name: 'crypto exchange wallet',
    text: 'A wallet service for a crypto exchange: every deposit, withdrawal and trade is recorded as debit and credit entries that can never be changed, balances are reconciled with the blockchain daily, and withdrawals require a second factor.',
    blueprint: 'bp-fintech-ledger-platform',
    requirements: ['req-ledger-immutability', 'req-mfa', 'req-audit-logging', 'req-idempotency'],
    fitness: ['ff-ledger-balance-integrity'],
    c4: ['pattern-event-sourced-ledger', 'adr-ledger-reconciliation-strategy'],
  },
  {
    name: 'contract review AI',
    text: 'Lawyers upload contracts; an LLM extracts the parties, dates and risky clauses and drafts a summary citing the exact paragraphs. A lawyer approves every summary before it is sent to the client.',
    blueprint: 'bp-ai-assistant-platform',
    requirements: ['req-ml-extraction-accuracy', 'req-ai-groundedness', 'req-ai-human-handoff'],
    fitness: ['ff-ai-eval-gate'],
    c4: ['pattern-rag-pipeline', 'adr-llm-provider-strategy'],
  },
  {
    name: 'ticketing (Polish)',
    text: 'System sprzedaży biletów na koncerty: w chwili startu sprzedaży wchodzi naraz sto tysięcy osób, bilet nie może zostać sprzedany dwa razy, a płatność online musi się powieść albo zwolnić rezerwację.',
    requirements: ['req-throughput', 'req-idempotency', 'req-autoscaling', 'req-graceful-degradation'],
    fitness: ['ff-capacity-load-test', 'ff-scale-out-verification'],
    c4: ['pattern-saga', 'pattern-rate-limiter', 'pattern-transactional-outbox'],
  },
  {
    name: 'microservice split',
    text: 'Our monolithic order management system is too slow to change. We want to split it into services owned by separate teams, each with its own database, talking through events, without a big-bang rewrite.',
    requirements: ['req-event-schema-compatibility', 'req-idempotency'],
    fitness: ['ff-coupling-guard', 'ff-dependency-rules'],
    c4: ['pattern-microservices', 'pattern-strangler-fig', 'pattern-event-driven', 'adr-integration-style'],
  },
  {
    name: 'smart home',
    text: 'A smart-home hub: thermostats and lights report their state through MQTT, users control them from a phone app, and the system must keep heating safely when the cloud connection is lost.',
    requirements: ['req-fail-safe-default', 'req-graceful-degradation', 'req-event-schema-compatibility'],
    fitness: ['ff-fail-safe-verification', 'ff-chaos-resilience-test'],
    c4: ['pattern-event-driven', 'pattern-circuit-breaker', 'pattern-bff'],
  },
]
