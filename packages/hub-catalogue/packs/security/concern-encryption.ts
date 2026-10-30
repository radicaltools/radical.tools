import type { PackSpec } from '../../src/packSpec'

const FORCES = 'Data reaches this element from people or other systems, or is kept in it. The forces: traffic is read or changed wherever it crosses a network someone else controls, and "inside our network" stops being true with the first misconfigured peering, mirror port or compromised host; old protocol versions and cipher suites stay enabled for years after they are broken; disks, snapshots and backups leave the system in ways nobody tracks; whoever holds the keys can read the data, so who controls them (the provider, us, or only the application) decides who can be compelled or tricked into reading it; certificates and keys that expire or are never rotated cause outages or stay useful to an attacker for years. Snippets assume Terraform under infra/ (plans read with terraform show -json), Kubernetes and Istio manifests rendered under manifests/, the public endpoints listed one host per line in endpoints.txt, internal ones as host:port in internal-endpoints.txt, certificates issued by hand in cert-inventory.txt, and the application under src/ with its tests under tests/. The cloud snippets (Config rules, key policy, key rotation and age, private network) are for AWS; each tool line names the Azure and Google equivalent.'
const TRANSIT = ['adr-mtls', 'adr-internal-tls', 'adr-private']
const REST = ['adr-provider-keys', 'adr-cmk', 'adr-field']
const OWN_KEYS = { AT_REST: ['cmk', 'field'] }

const pack: PackSpec = {
  id: 'concern-encryption',
  name: 'Encryption in transit and at rest',
  group: 'security',
  description: 'How data is protected on the wire and on disk: TLS versions and where it ends, encryption between our own elements, who holds the keys for stored data, and how keys and certificates are rotated.',
  tags: ['security', 'encryption', 'tls', 'mtls', 'kms', 'key-management', 'certificates'],
  concern: {
    id: 'encryption',
    trigger: 'LIST RELATIONS WHERE target.external != true AND (target.type = "database" OR target.type = "queue" OR ((source.type = "person" OR source.external = true) AND (target.type = "system" OR target.type = "container" OR target.type = "webapp" OR target.type = "component")))',
    applyTo: 'target',
    why: 'data reaches these elements from outside or is stored in them, so how it is encrypted on the wire and on disk, and who holds the keys, has to be decided.',
  },
  sources: [
    { title: 'OWASP Transport Layer Security Cheat Sheet', url: 'https://cheatsheetseries.owasp.org/cheatsheets/Transport_Layer_Security_Cheat_Sheet.html' },
    { title: 'OWASP Cryptographic Storage Cheat Sheet', url: 'https://cheatsheetseries.owasp.org/cheatsheets/Cryptographic_Storage_Cheat_Sheet.html' },
    { title: 'OWASP ASVS 4.0.3, V6 Stored Cryptography and V9 Communication', url: 'https://owasp.org/www-project-application-security-verification-standard/' },
    { title: 'NIST SP 800-57 Part 1 Rev. 5, Recommendation for Key Management', url: 'https://csrc.nist.gov/pubs/sp/800/57/pt1/r5/final' },
    { title: 'NIST SP 800-52 Rev. 2, Guidelines for TLS Implementations', url: 'https://csrc.nist.gov/pubs/sp/800/52/r2/final' },
    { title: 'Mozilla Server Side TLS recommended configurations', url: 'https://wiki.mozilla.org/Security/Server_Side_TLS' },
    { title: 'RFC 8446, The Transport Layer Security (TLS) Protocol Version 1.3', url: 'https://www.rfc-editor.org/rfc/rfc8446' },
    { title: 'PCI DSS v4.0.1, Requirement 3 (protect stored account data)', url: 'https://www.pcisecuritystandards.org/document_library/' },
  ],
  questions: [
    {
      key: 'TLS', title: 'TLS from outside', label: 'Which TLS versions do outside callers get?',
      hint: 'Every version and cipher suite you accept is one an attacker may downgrade to; every one you drop is a client that stops working. This question and the certificate one are about the endpoints outside callers reach: when the pack lands on a database or queue, answer them for the public edge of the system that holds it.',
      default: 'intermediate',
      options: [
        { value: 'modern', label: 'TLS 1.3', description: 'Mozilla\'s "modern" profile, nothing older offered: no legacy suites to misconfigure, forward secrecy always. Pick it when every client is a current browser, mobile app or SDK (Android 10+, iOS 12.2+, Java 11+, OpenSSL 1.1.1+).' },
        { value: 'intermediate', label: 'TLS 1.2 and 1.3 with forward-secret AEAD suites', description: 'Mozilla\'s "intermediate" profile: ECDHE key exchange with AES-GCM or ChaCha20-Poly1305 only. Pick it when partners, older devices or legacy runtimes still need TLS 1.2, which is the common case.' },
      ],
    },
    {
      key: 'INTERNAL', title: 'Inside the system', label: 'How is traffic between our own elements encrypted?',
      hint: 'TLS that ends at the load balancer leaves everything behind it in clear text; whether that is acceptable depends on who else can see that network.',
      default: 'mtls',
      options: [
        { value: 'mtls', label: 'mutual TLS in an Istio service mesh', description: 'Istio gives every workload a certificate and encrypts and authenticates every hop, with no change to the code. Pick it on Kubernetes with many services, or when zero trust inside the cluster is required. The checks are written for Istio; Linkerd does the same with other resources, so with it the checks are rewritten.' },
        { value: 'tls', label: 'TLS on every connection, server certificates only', description: 'The load balancer re-encrypts to the element; the element connects to databases and queues with TLS and verifies their certificates. Pick it without a mesh, or for a handful of elements; callers are not authenticated by the connection.' },
        { value: 'private', label: 'clear text inside a private network', description: 'TLS ends at the edge; traffic inside stays on a private network the cloud provider encrypts at the physical layer. Pick it only for a single VPC or VNet with no peering, no shared tenants, and no card or health data.' },
      ],
    },
    {
      key: 'AT_REST', title: 'Keys at rest', label: 'Who holds the keys for stored data?',
      hint: 'Disk encryption with the provider\'s keys stops a stolen disk; it does not stop anyone who can query the database or call the storage API. Answered for the stores themselves: on a database or queue for that store, on an application for the stores it writes to.',
      default: 'cmk',
      options: [
        { value: 'provider', label: 'provider-managed keys', description: 'The default encryption of the managed database, object store and disks, with keys the provider creates and rotates. Pick it when no regulation or contract asks you to control the keys and the data is not highly sensitive; the rotation question is then the provider\'s.' },
        { value: 'cmk', label: 'customer-managed keys in a KMS', description: 'Keys you create in AWS KMS, Azure Key Vault or Google Cloud KMS, with your key policy, your audit log and the power to disable them. Pick it for personal, financial or contract data, or when customers or auditors ask who can decrypt.' },
        { value: 'field', label: 'customer-managed keys plus application-level field encryption', description: 'The application encrypts the listed fields before writing them (envelope encryption with Google Tink, the AWS Encryption SDK or Vault Transit), on top of customer-managed keys at rest. Pick it for card numbers, national ids, health or secret data that database administrators and backups must not see.' },
      ],
    },
    {
      key: 'ROTATION', title: 'Key rotation', label: 'How are our encryption keys rotated?',
      hint: 'Only when the keys at rest are customer-managed; with provider-managed keys the provider decides and this answer is not used. NIST bounds how long a key may protect new data; rotating only the key material is cheap, re-encrypting everything is not.',
      default: 'automatic',
      options: [
        { value: 'automatic', label: 'automatic rotation of the key material', description: 'The KMS creates new key material on schedule and keeps old versions for decryption only (AWS KMS automatic rotation, Key Vault rotation policy, Cloud KMS rotation period). Pick it unless a standard requires re-encryption; data stays as it is.' },
        { value: 'reencrypt', label: 'new keys with re-encryption of data', description: 'A new key is created, data (or its data keys) is re-encrypted, and the old key is disabled. Pick it when a standard or contract sets a cryptoperiod for the data itself (PCI DSS 3.6, some government work). A suspected compromise is handled this way under either answer.' },
      ],
    },
    {
      key: 'CERTS', title: 'Certificates', label: 'How are TLS certificates issued and renewed?',
      hint: 'Expired certificates are one of the most common causes of outages; the cure is renewal nobody has to remember. About the certificates of the endpoints outside callers reach, as the TLS question.',
      default: 'acme',
      options: [
        { value: 'acme', label: 'automatically, with ACME or the cloud\'s certificate manager', description: 'Let\'s Encrypt through cert-manager or Caddy, or AWS Certificate Manager, Azure or Google managed certificates, renewed by software. Pick it for public endpoints and anything the platform can terminate.' },
        { value: 'managed-ca', label: 'from our own or a commercial CA, renewed by a tracked process', description: 'Certificates from the company\'s PKI or a commercial CA (EV/OV), with an inventory and alerts before expiry. Pick it when partners pin your CA, a regulator requires one, or the endpoint cannot run ACME.' },
      ],
    },
  ],
  details: [
    { key: 'KEY_ROTATE_DAYS', label: 'How often are our encryption keys rotated (days)?', default: '365', number: true },
    { key: 'SENSITIVE_FIELDS', label: 'Which fields are encrypted by the application?', default: 'card numbers, national id numbers, health data' },
  ],
  need: {
    label: 'Data unreadable to others',
    text: 'Data reaches the element from people and other systems and is kept in its databases, queues, files and backups. Nobody between the caller and the element, nobody on the network inside, and nobody who gets a disk, a snapshot or a backup may read or change it; the people who can decrypt it are known and few; and the certificates and keys that protect it neither expire unnoticed nor stay in use for years.',
  },
  forces: FORCES,
  requirements: [
    {
      id: 'req-tls-outside', label: 'Only TLS from outside', ears_type: 'ubiquitous',
      action: 'accept connections from people and other systems only over {{TLS}}, redirect plain HTTP to HTTPS, and send Strict-Transport-Security with a max-age of at least 31536000 seconds',
      rationale: 'Anything outside crosses networks we do not control; HSTS stops the first request being downgraded (ASVS 9.1.1, 9.1.2; OWASP TLS Cheat Sheet; Mozilla Server Side TLS).',
      scenario: { label: 'Plain HTTP upgraded', given: 'the element\'s public endpoint', when: 'it is called over plain HTTP, and its TLS configuration is scanned', then: 'the call is redirected to HTTPS with HSTS max-age of at least 31536000, and the scan finds only {{TLS}}' },
    },
    {
      id: 'req-tls13', label: 'Older protocols refused', when: { TLS: ['modern'] }, ears_type: 'unwanted-behaviour',
      unwanted_condition: 'a client offers only TLS 1.2 or older',
      action: 'refuse the handshake',
      rationale: 'TLS 1.3 removes static RSA key exchange, CBC suites and renegotiation; accepting nothing older leaves nothing to downgrade to (RFC 8446; Mozilla "modern" profile).',
      scenario: { label: 'TLS 1.2 refused', given: 'the public endpoint', when: 'a client connects with TLS 1.2 at most, and then with TLS 1.3', then: 'the first handshake fails and the second succeeds' },
    },
    {
      id: 'req-tls12', label: 'Weak suites refused', when: { TLS: ['intermediate'] }, ears_type: 'unwanted-behaviour',
      unwanted_condition: 'a client offers TLS 1.1 or older, or TLS 1.2 without an ECDHE key exchange and an AEAD cipher (AES-GCM or ChaCha20-Poly1305)',
      action: 'refuse the handshake',
      rationale: 'TLS 1.2 is safe only with forward-secret AEAD suites; CBC and static RSA suites are the ones attacks keep finding (NIST SP 800-52 Rev. 2, 3.3.1; Mozilla "intermediate" profile).',
      scenario: { label: 'CBC suite refused', given: 'the public endpoint', when: 'a client offers TLS 1.1, then TLS 1.2 with only TLS_RSA_WITH_AES_128_CBC_SHA, then TLS 1.2 with ECDHE-RSA-AES128-GCM-SHA256', then: 'only the last handshake succeeds' },
    },
    {
      id: 'req-mtls', label: 'Every hop mutually authenticated', when: { INTERNAL: ['mtls'] }, ears_type: 'event-driven',
      trigger: 'one of our elements connects to another',
      action: 'encrypt the connection with mutual TLS, both sides presenting certificates from the mesh\'s CA that expire within 24 hours, and refuse a peer without one',
      rationale: 'Encryption and caller identity on every hop, so that a foothold on the network reads nothing and cannot impersonate a service (OWASP TLS Cheat Sheet, client certificates; ASVS 9.2.2).',
      scenario: { label: 'Plain-text peer refused', given: 'two services in the mesh in strict mode', when: 'a pod outside the mesh calls one of them in plain text, and the other calls it through the mesh', then: 'the first is refused and the second succeeds with certificates valid for no more than 24 hours' },
    },
    {
      id: 'req-internal-tls', label: 'TLS to every backend', when: { INTERNAL: ['tls'] }, ears_type: 'ubiquitous',
      action: 'connect to databases, queues and other elements only over TLS 1.2 or newer, verifying the server\'s certificate and host name (for PostgreSQL sslmode=verify-full), and never with verification turned off',
      rationale: 'TLS without verification is encryption to whoever answers; the backend has to be proved, not just reached (ASVS 9.2.1, 9.2.2).',
      scenario: { label: 'Unverified backend refused', given: 'the element configured for its database and for another element', when: 'the database presents a certificate for another host name, and then plain text is offered to both', then: 'the element refuses all three connections' },
    },
    {
      id: 'req-private', label: 'Clear text stays private', when: { INTERNAL: ['private'] }, ears_type: 'state-driven',
      precondition: 'traffic between our elements is not encrypted',
      action: 'keep that traffic inside one private network with no peering, no public addresses and no shared tenants, and encrypt any connection that leaves it',
      rationale: 'Clear text inside is acceptable only while the network itself is ours alone; the decision states the conditions, so breaking one shows (OWASP TLS Cheat Sheet, use TLS for all connections).',
      scenario: { label: 'Leaving the network', given: 'two elements talking in clear text inside the VPC', when: 'one of them is given a connection to a peered network', then: 'that connection uses TLS 1.2 or newer and the review of the change names this decision' },
    },
    {
      id: 'req-rest', label: 'Stored data encrypted', ears_type: 'ubiquitous',
      action: 'encrypt stored data in databases, queues, object stores, disks, snapshots and backups with AES-256 under {{AT_REST}}',
      rationale: 'Disks, snapshots and backups leave the system in ways nobody tracks; encryption at rest makes a lost copy unreadable (ASVS 6.1.1 to 6.1.3; OWASP Cryptographic Storage Cheat Sheet).',
      scenario: { label: 'Snapshot unreadable', given: 'a snapshot of the element\'s database and a backup', when: 'their storage settings are listed', then: 'both are encrypted with AES-256 under {{AT_REST}}' },
    },
    {
      id: 'req-key-access', label: 'Key use limited and logged', when: OWN_KEYS, ears_type: 'ubiquitous',
      action: 'allow only the element\'s own identity to use its keys and only key administrators to manage them, with nobody in both roles, and log every use of a key in the provider\'s audit trail',
      rationale: 'Holding the keys means nothing if anyone can use them; separation of duties and a log of every decryption are what customer-managed keys buy (NIST SP 800-57 Pt 1, 5.3 and 6; OWASP Cryptographic Storage Cheat Sheet, key management).',
      scenario: { label: 'Other identity refused', given: 'the element\'s data key in the KMS', when: 'another service\'s identity asks the KMS to decrypt with it, and a key administrator tries to decrypt', then: 'both are refused and both attempts are in the audit trail' },
    },
    {
      id: 'req-field', label: 'Sensitive fields encrypted', when: { AT_REST: ['field'] }, ears_type: 'ubiquitous',
      action: 'encrypt {{SENSITIVE_FIELDS}} in the application before writing them, with AES-256-GCM under a data key per record or tenant wrapped by the KMS, so that the database, its logs and its backups hold only ciphertext',
      rationale: 'Disk encryption is transparent to anyone who can query the database; field encryption keeps the most sensitive data from administrators, backups and SQL injection (OWASP Cryptographic Storage Cheat Sheet, application-level encryption; ASVS 6.1.1).',
      scenario: { label: 'Database shows ciphertext', given: 'a record with {{SENSITIVE_FIELDS}} saved through the element', when: 'a database administrator selects it directly', then: 'those fields are ciphertext, and the element still reads them as the original values' },
    },
    {
      id: 'req-rotate-auto', label: 'Key material rotated', when: { AT_REST: ['cmk', 'field'], ROTATION: ['automatic'] }, ears_type: 'event-driven',
      trigger: 'an encryption key\'s current material is {{KEY_ROTATE_DAYS}} days old',
      action: 'create new key material automatically, encrypt new data only with it, and keep the older versions for decryption only',
      rationale: 'A cryptoperiod bounds how much data one key protects and how long a leaked key is useful (NIST SP 800-57 Pt 1, 5.3).',
      scenario: { label: 'Rotation keeps data readable', given: 'a key whose material is {{KEY_ROTATE_DAYS}} days old and data encrypted under it', when: 'the KMS rotates it', then: 'new data is encrypted with the new material and the old data still decrypts' },
    },
    {
      id: 'req-rotate-reencrypt', label: 'Data re-encrypted on rotation', when: { AT_REST: ['cmk', 'field'], ROTATION: ['reencrypt'] }, ears_type: 'event-driven',
      trigger: 'an encryption key is {{KEY_ROTATE_DAYS}} days old',
      action: 'create a new key, re-encrypt the data or its data keys under it within 30 days, and then disable the old key',
      rationale: 'Where a cryptoperiod applies to the data, the old key must stop protecting anything (NIST SP 800-57 Pt 1, 5.3; PCI DSS v4.0.1 3.6 and 3.7).',
      scenario: { label: 'Old key disabled', given: 'data encrypted under a key {{KEY_ROTATE_DAYS}} days old', when: 'the rotation runs', then: 'within 30 days every record decrypts under the new key and the old key is disabled' },
    },
    {
      id: 'req-key-compromise', label: 'Compromised key replaced fast', when: OWN_KEYS, ears_type: 'event-driven',
      trigger: 'an encryption key is suspected to be compromised',
      action: 'create a new key, re-encrypt the data or its data keys under it within 72 hours, and disable the old key',
      rationale: 'A key that may be known to someone else protects nothing, and automatic rotation does not help: the old material stays usable for decryption. The drill is what makes 72 hours real (NIST SP 800-57 Pt 1, 5.3; PCI DSS v4.0.1 3.7.5).',
      scenario: { label: 'Compromise drill', given: 'a key declared compromised in a drill', when: 'the re-encryption runbook is followed', then: 'within 72 hours every record decrypts under the new key and the old key is disabled, and the time taken is recorded' },
      unchecked: 'a key-compromise drill the security owner runs twice a year on a copy of production data, timed against the 72 hours; no tool can run it.',
    },
    {
      id: 'req-certs-acme', label: 'Certificates renewed automatically', when: { CERTS: ['acme'] }, ears_type: 'event-driven',
      trigger: 'a certificate has 30 days of validity left',
      action: 'renew it automatically and install it without downtime, and alert the owner if it still has fewer than 14 days left',
      rationale: 'Automated renewal removes the most common cause of certificate outages; the alert covers the renewal that fails (OWASP TLS Cheat Sheet, certificates).',
      scenario: { label: 'Renewal without anyone', given: 'a certificate with 30 days left', when: 'the certificate manager runs, and once a renewal is made to fail', then: 'a new certificate is in use the same day with no failed request; the failed one raises an alert at 14 days' },
    },
    {
      id: 'req-certs-ca', label: 'Expiry alerted ahead', when: { CERTS: ['managed-ca'] }, ears_type: 'state-driven',
      precondition: 'a certificate on the inventory has fewer than 30 days of validity left',
      action: 'alert its named owner every working day until it is replaced, and keep every certificate the element uses on the inventory with its owner and expiry',
      rationale: 'Certificates renewed by hand expire when the person who knew left; an inventory and daily alerts are what make the process hold (OWASP TLS Cheat Sheet; NIST SP 800-57 Pt 1, 8.1.5).',
      scenario: { label: 'Expiring certificate alerted', given: 'a partner-facing certificate expiring in 29 days', when: 'the daily check runs', then: 'its owner is alerted, and the alerts stop when the new certificate is installed' },
    },
  ],
  adrs: [
    {
      id: 'adr-mtls', label: 'Mutual TLS in a service mesh', when: { INTERNAL: ['mtls'] },
      decision: 'Outside callers get {{TLS}} at the edge (Mozilla profile, HSTS); certificates are issued {{CERTS}}. Between our own elements, an Istio service mesh with a mesh-wide PeerAuthentication in STRICT mode encrypts and authenticates every hop with mutual TLS and workload certificates that expire within 24 hours (Istio\'s default lifetime); databases and managed queues outside the mesh are reached with TLS and certificate verification. Istio runs with sidecars, or in ambient mode when the sidecars\' cost matters; its CA can chain to the company\'s PKI through a plugged-in intermediate.',
      consequences: '• Every hop is encrypted and authenticated without changes to the code.\n• Callers inside get identities that authorisation policies can use.\n• The mesh is on every request\'s path: its upgrades and its CA are now critical.\n• Traffic to managed services outside the mesh still needs its own TLS settings.\n• Where TLS 1.2 is still offered to outside callers, whether it can be dropped is reviewed once a year.',
      alternatives: '1. Linkerd: the least to run, mutual TLS on by default; its policy resources differ (Server, default inbound policy all-authenticated), so the checks would be rewritten for it.\n2. Cilium mutual authentication with WireGuard encryption: no sidecars where Cilium already runs as the network plugin, with a different identity model to check.\n3. TLS on every connection, configured per element: no mesh to run, but no caller identity and more places to get wrong.\n4. Clear text inside a private network: simplest, and safe only while the network is ours alone.',
    },
    {
      id: 'adr-internal-tls', label: 'TLS on every connection', when: { INTERNAL: ['tls'] },
      decision: 'Outside callers get {{TLS}} at the edge (Mozilla profile, HSTS); certificates are issued {{CERTS}}. The load balancer re-encrypts to the element, and the element connects to databases, queues and other elements over TLS 1.2 or newer, verifying the certificate and host name against our internal CA or the provider\'s (for example Amazon RDS CA bundles, Azure Database certificates). Turning verification off is not allowed in any environment; tests run against real certificates from a local CA (mkcert or a test step-ca).',
      consequences: '• No clear text on any network, without a mesh to operate.\n• Every element and driver must be configured and kept configured; a default that skips verification is a finding.\n• The connection proves the server, not the caller: who is calling is decided by authentication.\n• Where TLS 1.2 is still offered to outside callers, whether it can be dropped is reviewed once a year.',
      alternatives: '1. Mutual TLS in a service mesh: identity on every hop, a mesh to run.\n2. Clear text inside a private network: simplest, weakest.',
    },
    {
      id: 'adr-private', label: 'TLS ends at the edge', when: { INTERNAL: ['private'] },
      decision: 'Outside callers get {{TLS}} at the edge (Mozilla profile, HSTS); certificates are issued {{CERTS}}. TLS ends at the load balancer; traffic between our elements stays in clear text inside one private network (VPC or VNet) with no peering, no public addresses and no shared tenants, relying on the provider\'s physical-layer encryption between its data centres. Any connection that leaves that network, or carries card or health data, uses TLS; peering or a shared tenant supersedes this decision.',
      consequences: '• Nothing to configure or rotate inside; the cheapest option.\n• A foothold on the network reads every internal call: one compromised host sees everything.\n• Audits (PCI DSS, HIPAA, ISO 27001) may not accept it; the conditions must stay true and be checked.\n• Where TLS 1.2 is still offered to outside callers, whether it can be dropped is reviewed once a year.',
      alternatives: '1. TLS on every connection: modest effort, removes the clear text.\n2. Mutual TLS in a service mesh: encryption and identity on every hop.',
    },
    {
      id: 'adr-provider-keys', label: 'Provider-managed keys at rest', when: { AT_REST: ['provider'] },
      decision: 'Databases, queues, object stores, disks, snapshots and backups use the provider\'s default AES-256 encryption with provider-managed keys (Amazon RDS and S3 default encryption, Azure Storage Service Encryption, Google default encryption at rest); the provider creates, stores and rotates the keys. No resource may be created unencrypted, which the provider\'s policy service checks. Moving to customer-managed keys is a later decision, needed when a customer, auditor or regulation asks who can decrypt.',
      consequences: '• No keys to manage, no cost and no risk of locking ourselves out.\n• Protects lost disks and media, not data read through the database or the storage API.\n• We cannot prove, disable or audit the use of the keys ourselves.',
      alternatives: '1. Customer-managed keys in a KMS: our key policy and audit log, a little cost and care.\n2. Application-level field encryption: protects against administrators and backups too, at the cost of search and indexing on those fields.',
    },
    {
      id: 'adr-cmk', label: 'Customer-managed keys at rest', when: { AT_REST: ['cmk'] },
      decision: 'Stored data is encrypted with AES-256 under customer-managed keys in the cloud\'s KMS (AWS KMS, Azure Key Vault or Managed HSM, Google Cloud KMS), one key per element and environment, with a key policy that lets only the element\'s identity use it and only key administrators manage it, the two sets of principals disjoint and the administrators\' actions listed rather than kms:*; every use is logged by the provider\'s audit trail. On AWS the policy keeps the statement AWS documents for every key, which gives the account root kms:* so that the key can never become unmanageable; it lets IAM policies in the account grant use of the key, so those are reviewed with the key policy, and the key-policy check exempts that one principal. Key rotation: {{ROTATION}}, every {{KEY_ROTATE_DAYS}} days. A key suspected compromised is replaced whatever the rotation: a new key, the data or its data keys re-encrypted under it within 72 hours, the old key disabled. Choose an HSM-backed tier (CloudHSM, Managed HSM, Cloud HSM) when a standard requires FIPS 140-3 level 3, and an external key store only when a contract requires the keys outside the provider.',
      consequences: '• We decide and can prove who may decrypt, and can disable a key to make data unreadable.\n• On AWS the account-root statement means an IAM policy in the account can grant use of the key: the key policy alone does not prove who may decrypt.\n• A deleted or disabled key makes data unrecoverable: deletion has a waiting period and needs two people.\n• KMS calls cost money and add latency on every data key fetch; caching data keys keeps it small.',
      alternatives: '1. Provider-managed keys: no work, no control.\n2. Application-level field encryption on top: protects the most sensitive fields from anyone who can query the database.',
    },
    {
      id: 'adr-field', label: 'Sensitive fields encrypted by the application', when: { AT_REST: ['field'] },
      decision: 'The application encrypts {{SENSITIVE_FIELDS}} before writing them, with envelope encryption: AES-256-GCM data keys per record or tenant, wrapped by a customer-managed key in the KMS. Everything else is encrypted at rest under customer-managed keys, one key per element and environment, with a key policy that lets only the element\'s identity use it and only key administrators manage it, the two sets disjoint (on AWS apart from the account-root statement AWS documents for every key, which keeps the key manageable and lets IAM policies grant use, so those are reviewed with it); every use is logged by the provider\'s audit trail. Key rotation: {{ROTATION}}, every {{KEY_ROTATE_DAYS}} days. A key suspected compromised is replaced whatever the rotation: a new key, the data keys re-encrypted under it within 72 hours, the old key disabled. Library: Google Tink or the AWS Encryption SDK in the element, or HashiCorp Vault Transit when several languages must share the keys; never cryptography written by hand. Fields that must be searched get a separate keyed hash (HMAC-SHA-256) for exact matches.',
      consequences: '• Database administrators, backups, replicas and SQL injection see only ciphertext for those fields.\n• Those fields cannot be sorted, range-queried or full-text searched in the database.\n• Migrations and analytics must go through the application or the KMS to read them.\n• Losing the KMS key loses those fields, even in backups.',
      alternatives: '1. Customer-managed keys at rest only: transparent to the application, but visible to anyone who can query.\n2. Tokenisation by a vault service (for cards, a PCI provider): takes the data out of scope entirely, adds a dependency.\n3. Database column encryption (Always Encrypted, pgcrypto): less code, but keys or plaintext pass through the database.',
    },
  ],
  fitness: [
    {
      id: 'ff-tls-scan', label: 'Public TLS: 1.3 only', when: { TLS: ['modern'] }, characteristic: 'security', scope: 'atomic', cadence: 'triggered', trigger: 'nightly', invocation: 'automated', implements: TRANSIT, checks: ['req-tls-outside', 'req-tls13'],
      threshold: 'On every public endpoint: TLS 1.3 offered and SSLv2, SSLv3, TLS 1.0, 1.1 and 1.2 not offered; 0 findings of severity HIGH or CRITICAL; plain HTTP redirected; HSTS max-age at least 31536000; the certificate valid for at least 14 more days',
      description: 'A scheduled job scans each public endpoint with testssl.sh and reads the protocol findings from its JSON (ids SSLv2, SSLv3, TLS1, TLS1_1, TLS1_2, TLS1_3), then checks the redirect, the HSTS header and the certificate\'s expiry with curl and openssl.',
      tool: 'testssl.sh 3.2 (docker), jq, curl and openssl',
      language: 'bash',
      snippet: `#!/usr/bin/env bash
set -euo pipefail
while read -r endpoint; do
  # testssl.sh exits non-zero on ambiguous results too, so the JSON decides; --ip one: one entry per check, not one per address
  docker run --rm -v "$PWD":/out drwetter/testssl.sh:3.2 --quiet --warnings off --ip one --jsonfile "/out/$endpoint.json" "$endpoint" || true
  [ -s "$endpoint.json" ] || { echo "$endpoint: scan produced no result"; exit 1; }
  jq -e '
    ([.[] | select(.severity == "HIGH" or .severity == "CRITICAL")] | length == 0)
    and ([.[] | select(.id == "TLS1_3")] | length == 1 and all(.finding | startswith("offered")))
    and ([.[] | select(.id | IN("SSLv2", "SSLv3", "TLS1", "TLS1_1", "TLS1_2"))] | length == 5 and all(.finding | startswith("not offered")))
  ' "$endpoint.json" > /dev/null || { echo "$endpoint: not TLS 1.3 only, or a HIGH/CRITICAL finding"; exit 1; }
  curl -sI "http://$endpoint/" | grep -Eq '^HTTP/[0-9.]+ 30[1278]' || { echo "$endpoint: plain HTTP not redirected"; exit 1; }
  max_age=$(curl -sI "https://$endpoint/" | grep -i '^strict-transport-security:' | grep -Eo 'max-age=[0-9]+' | cut -d= -f2 || true)
  [ "\${max_age:-0}" -ge 31536000 ] || { echo "$endpoint: HSTS max-age under a year"; exit 1; }
  echo | openssl s_client -connect "$endpoint:443" -servername "$endpoint" 2>/dev/null \\
    | openssl x509 -noout -checkend $(( 14 * 86400 )) || { echo "$endpoint: certificate expires within 14 days"; exit 1; }
done < endpoints.txt`,
    },
    {
      id: 'ff-tls-scan-12', label: 'Public TLS: 1.2 and 1.3, strong suites', when: { TLS: ['intermediate'] }, characteristic: 'security', scope: 'atomic', cadence: 'triggered', trigger: 'nightly', invocation: 'automated', implements: TRANSIT, checks: ['req-tls-outside', 'req-tls12'],
      threshold: 'On every public endpoint: TLS 1.2 and 1.3 offered; SSLv2, SSLv3, TLS 1.0 and 1.1 not offered; the 3DES/IDEA, obsoleted (CBC, static RSA) and non-forward-secret cipher lists not offered; 0 findings of severity HIGH or CRITICAL; plain HTTP redirected; HSTS max-age at least 31536000; the certificate valid for at least 14 more days',
      description: 'A scheduled job scans each public endpoint with testssl.sh and reads the protocol and cipher-list findings from its JSON (ids TLS1_2, TLS1_3, SSLv2, SSLv3, TLS1, TLS1_1, cipherlist_3DES_IDEA, cipherlist_OBSOLETED, cipherlist_STRONG_NOFS), then checks the redirect, the HSTS header and the certificate\'s expiry with curl and openssl.',
      tool: 'testssl.sh 3.2 (docker), jq, curl and openssl',
      language: 'bash',
      snippet: `#!/usr/bin/env bash
set -euo pipefail
while read -r endpoint; do
  # testssl.sh exits non-zero on ambiguous results too, so the JSON decides; --ip one: one entry per check, not one per address
  docker run --rm -v "$PWD":/out drwetter/testssl.sh:3.2 --quiet --warnings off --ip one --jsonfile "/out/$endpoint.json" "$endpoint" || true
  [ -s "$endpoint.json" ] || { echo "$endpoint: scan produced no result"; exit 1; }
  jq -e '
    ([.[] | select(.severity == "HIGH" or .severity == "CRITICAL")] | length == 0)
    and ([.[] | select(.id | IN("TLS1_2", "TLS1_3"))] | length == 2 and all(.finding | startswith("offered")))
    and ([.[] | select(.id | IN("SSLv2", "SSLv3", "TLS1", "TLS1_1"))] | length == 4 and all(.finding | startswith("not offered")))
    and ([.[] | select(.id | IN("cipherlist_3DES_IDEA", "cipherlist_OBSOLETED", "cipherlist_STRONG_NOFS"))] | length == 3 and all(.finding | startswith("not offered")))
  ' "$endpoint.json" > /dev/null || { echo "$endpoint: outside the intermediate profile, or a HIGH/CRITICAL finding"; exit 1; }
  curl -sI "http://$endpoint/" | grep -Eq '^HTTP/[0-9.]+ 30[1278]' || { echo "$endpoint: plain HTTP not redirected"; exit 1; }
  max_age=$(curl -sI "https://$endpoint/" | grep -i '^strict-transport-security:' | grep -Eo 'max-age=[0-9]+' | cut -d= -f2 || true)
  [ "\${max_age:-0}" -ge 31536000 ] || { echo "$endpoint: HSTS max-age under a year"; exit 1; }
  echo | openssl s_client -connect "$endpoint:443" -servername "$endpoint" 2>/dev/null \\
    | openssl x509 -noout -checkend $(( 14 * 86400 )) || { echo "$endpoint: certificate expires within 14 days"; exit 1; }
done < endpoints.txt`,
    },
    {
      id: 'ff-mesh-strict', label: 'Mesh in strict mode', when: { INTERNAL: ['mtls'] }, characteristic: 'security', scope: 'atomic', cadence: 'triggered', trigger: 'pull-request', invocation: 'automated', implements: ['adr-mtls'], checks: ['req-mtls'],
      threshold: 'A mesh-wide PeerAuthentication (istio-system, no selector) with mtls.mode STRICT exists, and 0 PeerAuthentications or port-level settings with any other mode or none',
      description: 'A Conftest policy over all rendered manifests at once fails when the mesh-wide mutual TLS policy is missing, or when any PeerAuthentication leaves the mode unset (which inherits PERMISSIVE) or sets another one, on the workload or on a port.',
      tool: 'Conftest (Open Policy Agent) over Istio manifests',
      language: 'rego',
      snippet: `# conftest test --combine manifests/
package main

import rego.v1

docs contains d if { some f in input; is_array(f.contents); some d in f.contents }
docs contains d if { some f in input; not is_array(f.contents); d := f.contents }

mesh_wide_strict if {
  some p in docs
  p.kind == "PeerAuthentication"
  p.metadata.namespace == "istio-system"
  not p.spec.selector
  p.spec.mtls.mode == "STRICT"
}

deny contains msg if {
  not mesh_wide_strict
  msg := "no mesh-wide PeerAuthentication in istio-system with mtls.mode STRICT"
}

deny contains msg if {
  some p in docs
  p.kind == "PeerAuthentication"
  not p.spec.mtls.mode == "STRICT"            # unset inherits PERMISSIVE
  msg := sprintf("%s/%s weakens mutual TLS (mode %v)", [p.metadata.namespace, p.metadata.name, object.get(p, ["spec", "mtls", "mode"], "unset")])
}

deny contains msg if {
  some p in docs
  p.kind == "PeerAuthentication"
  some port, setting in p.spec.portLevelMtls
  not setting.mode == "STRICT"
  msg := sprintf("%s/%s turns off mutual TLS on port %v", [p.metadata.namespace, p.metadata.name, port])
}`,
    },
    {
      id: 'ff-mesh-cert-ttl', label: 'Mesh certificates short-lived', when: { INTERNAL: ['mtls'] }, characteristic: 'security', scope: 'atomic', cadence: 'triggered', trigger: 'nightly', invocation: 'automated', implements: ['adr-mtls'], checks: ['req-mtls'],
      threshold: '0 meshed pods whose workload certificate is valid for more than 24 more hours',
      description: 'A scheduled job lists the pods with an istio-proxy sidecar (a container, or a native sidecar among the init containers), reads each one\'s workload certificate (the SDS secret named default) with istioctl, and fails on one that will still be valid in 24 hours, which means the mesh issues certificates that live longer than decided. Together with Mesh in strict mode (configuration) it checks the requirement.',
      tool: 'istioctl proxy-config secret, kubectl, jq and openssl (sidecar mode; in ambient mode: istioctl ztunnel-config certificates)',
      language: 'bash',
      snippet: `#!/usr/bin/env bash
set -euo pipefail
fail=0
pods=$(kubectl get pods -A -o json | jq -r '.items[]
  | select(any((.spec.containers + (.spec.initContainers // []))[]; .name == "istio-proxy"))
  | "\\(.metadata.name).\\(.metadata.namespace)"')
for pod in $pods; do
  istioctl proxy-config secret "$pod" -o json \\
    | jq -r '[.dynamicActiveSecrets[] | select(.name == "default")][0].secret.tlsCertificate.certificateChain.inlineBytes' \\
    | base64 --decode > leaf.pem
  # -checkend succeeds when the certificate is still valid after the given seconds
  if openssl x509 -in leaf.pem -noout -checkend 86400 > /dev/null; then
    echo "$pod: workload certificate valid for more than 24 more hours"; fail=1
  fi
done
exit $fail`,
    },
    {
      id: 'ff-backend-tls', label: 'Backends refuse clear text', when: { INTERNAL: ['tls'] }, characteristic: 'security', scope: 'holistic', cadence: 'triggered', trigger: 'deploy', invocation: 'automated', implements: ['adr-internal-tls'], checks: ['req-internal-tls'],
      threshold: '0 databases that accept a connection without TLS; every internal endpoint (queues, other elements) answers verifiable TLS and 0 answer plain HTTP; 0 client settings that skip or downgrade verification',
      description: 'A smoke test after each deployment tries each database without TLS and expects a refusal, checks every internal endpoint for a certificate that verifies against our CA and for a refusal of plain HTTP; a Semgrep rule set fails the build on settings that skip or downgrade verification.',
      tool: 'psql, openssl, curl and Semgrep',
      language: 'bash',
      snippet: `#!/usr/bin/env bash
set -euo pipefail
# the database must refuse clear text (rds.force_ssl=1, hostssl-only pg_hba.conf)
if psql "host=$DB_HOST dbname=$DB_NAME user=$DB_USER sslmode=disable" -c 'select 1' 2>/dev/null; then
  echo "database $DB_HOST accepts connections without TLS"; exit 1
fi
# queues and other elements: TLS that verifies against our CA, and no plain HTTP (host:port per line)
while read -r ep; do
  echo | openssl s_client -connect "$ep" -servername "\${ep%%:*}" -CAfile "$INTERNAL_CA" 2>/dev/null | grep -q 'Verify return code: 0' \\
    || { echo "$ep: no TLS that verifies against our CA"; exit 1; }
  if curl -sf --max-time 5 -o /dev/null "http://$ep/"; then echo "$ep answers plain HTTP"; exit 1; fi
done < internal-endpoints.txt
# no client may skip or downgrade verification
cat > /tmp/tls-verify.yml <<'RULES'
rules:
- id: tls-verification-off
  message: TLS verification turned off or downgraded (ADR TLS on every connection)
  severity: ERROR
  languages: [generic]
  pattern-either:
    - pattern: sslmode=require
    - pattern: sslmode=prefer
    - pattern: 'rejectUnauthorized: false'
    - pattern: 'InsecureSkipVerify: true'
    - pattern: verify=False
RULES
semgrep --config /tmp/tls-verify.yml --error src/`,
    },
    {
      id: 'ff-private', label: 'Private network stays private', when: { INTERNAL: ['private'] }, characteristic: 'security', scope: 'atomic', cadence: 'triggered', trigger: 'pull-request', invocation: 'automated', implements: ['adr-private'], checks: ['req-private'],
      threshold: '0 VPC peerings, 0 public addresses (elastic IPs, instances with a public address, subnets that assign one) and 0 0.0.0.0/0 or ::/0 ingress rules on the element\'s network in the Terraform plan',
      description: 'A Conftest policy over the Terraform plan fails when the private network gains a peering, a public address or an open ingress rule, any of which breaks the conditions of the decision. The rules are for the AWS provider; the Azure and Google providers\' peering, public IP and security rule resources are checked the same way.',
      tool: 'Conftest (Open Policy Agent) over terraform show -json (AWS provider; for Azure: azurerm_virtual_network_peering, azurerm_public_ip, azurerm_network_security_rule; for Google: google_compute_network_peering, google_compute_address, google_compute_firewall)',
      language: 'rego',
      snippet: `package main

import rego.v1

changes contains rc if { some rc in input.resource_changes; rc.change.actions[_] != "delete" }

deny contains msg if {
  some rc in changes
  rc.type == "aws_vpc_peering_connection"
  msg := sprintf("%s: peering breaks the clear-text-inside decision", [rc.address])
}

deny contains msg if {
  some rc in changes
  rc.type in {"aws_eip", "aws_eip_association"}
  msg := sprintf("%s: a public address on the private network", [rc.address])
}

deny contains msg if {
  some rc in changes
  rc.type == "aws_instance"
  rc.change.after.associate_public_ip_address == true
  msg := sprintf("%s gets a public address", [rc.address])
}

deny contains msg if {
  some rc in changes
  rc.type == "aws_subnet"
  rc.change.after.map_public_ip_on_launch == true
  msg := sprintf("%s assigns public addresses", [rc.address])
}

open_cidr(c) if c in {"0.0.0.0/0", "::/0"}

deny contains msg if {
  some rc in changes
  rc.type == "aws_security_group_rule"
  rc.change.after.type == "ingress"
  some c in array.concat(object.get(rc.change.after, "cidr_blocks", []), object.get(rc.change.after, "ipv6_cidr_blocks", []))
  open_cidr(c)
  msg := sprintf("%s opens the private network to the internet", [rc.address])
}

deny contains msg if {
  some rc in changes
  rc.type == "aws_vpc_security_group_ingress_rule"
  some c in [rc.change.after.cidr_ipv4, rc.change.after.cidr_ipv6]
  open_cidr(c)
  msg := sprintf("%s opens the private network to the internet", [rc.address])
}`,
    },
    {
      id: 'ff-rest', label: 'Nothing stored unencrypted', when: { AT_REST: ['provider'] }, characteristic: 'security', scope: 'atomic', cadence: 'continual', invocation: 'automated', implements: ['adr-provider-keys'], checks: ['req-rest'],
      threshold: '0 non-compliant database instances, snapshots, volumes or buckets',
      description: 'AWS Config managed rules evaluate every database, snapshot, volume and bucket continuously and report one that is not encrypted at rest.',
      tool: 'AWS Config managed rules (for Azure: the built-in Azure Policy definitions for storage and SQL encryption; for Google: encryption at rest is always on, the Organization Policy only matters for customer-managed keys)',
      language: 'hcl',
      snippet: `locals {
  encryption_rules = [
    "RDS_STORAGE_ENCRYPTED",
    "RDS_SNAPSHOT_ENCRYPTED",
    "ENCRYPTED_VOLUMES",
    "S3_BUCKET_SERVER_SIDE_ENCRYPTION_ENABLED",
  ]
}

resource "aws_config_config_rule" "encrypted_at_rest" {
  for_each = toset(local.encryption_rules)
  name     = lower(replace(each.value, "_", "-"))
  source {
    owner             = "AWS"
    source_identifier = each.value
  }
}`,
    },
    {
      id: 'ff-rest-cmk', label: 'Stored under our key only', when: OWN_KEYS, characteristic: 'security', scope: 'atomic', cadence: 'continual', invocation: 'automated', implements: ['adr-cmk', 'adr-field'], checks: ['req-rest'],
      threshold: '0 database instances, volumes or buckets encrypted with any key but the element\'s customer-managed key; 0 unencrypted snapshots',
      description: 'AWS Config managed rules evaluate every database, volume and bucket continuously with the element\'s key passed as the only allowed key, so a resource encrypted with a provider-managed key is reported too; snapshots are checked for encryption.',
      tool: 'AWS Config managed rules with key parameters (for Azure: Azure Policy "should use customer-managed keys" definitions; for Google: the Organization Policy constraint gcp.restrictNonCmekServices)',
      language: 'hcl',
      snippet: `locals {
  key_arn = aws_kms_key.data.arn   # one key per element and environment
}

resource "aws_config_config_rule" "rds_our_key" {
  name = "rds-storage-encrypted-with-our-key"
  source {
    owner             = "AWS"
    source_identifier = "RDS_STORAGE_ENCRYPTED"
  }
  input_parameters = jsonencode({ kmsKeyId = local.key_arn })
}

resource "aws_config_config_rule" "rds_snapshots" {
  name = "rds-snapshot-encrypted"
  source {
    owner             = "AWS"
    source_identifier = "RDS_SNAPSHOT_ENCRYPTED"
  }
}

resource "aws_config_config_rule" "volumes_our_key" {
  name = "encrypted-volumes-with-our-key"
  source {
    owner             = "AWS"
    source_identifier = "ENCRYPTED_VOLUMES"
  }
  input_parameters = jsonencode({ kmsId = local.key_arn })
}

resource "aws_config_config_rule" "buckets_our_key" {
  name = "s3-default-encryption-with-our-key"
  source {
    owner             = "AWS"
    source_identifier = "S3_DEFAULT_ENCRYPTION_KMS"
  }
  input_parameters = jsonencode({ kmsKeyArns = local.key_arn })
}`,
    },
    {
      id: 'ff-key-policy', label: 'Key use and administration apart', when: OWN_KEYS, characteristic: 'security', scope: 'atomic', cadence: 'triggered', trigger: 'pull-request', invocation: 'automated', implements: ['adr-cmk', 'adr-field'], checks: ['req-key-access'],
      threshold: 'In every KMS key policy of the plan (aws_kms_key and aws_kms_key_policy), apart from the account-root statement AWS documents: the principals allowed to use the key are a subset of the element\'s roles, 0 principals may both use and administer it, and 0 statements grant use to *',
      description: 'A Conftest policy over the Terraform plan parses each KMS key policy and fails when a principal outside the element\'s roles may encrypt or decrypt, when one principal appears in both a use and an administration statement (kms:* counts as both), or when use is open to everyone (Principal "*" or {"AWS": "*"}). The account root (arn:aws:iam::<account>:root, or the bare account id) is exempt: AWS documents the statement that gives it kms:* as the one that keeps a key manageable, and the IAM policies it lets grant use are reviewed with the key policy, as adr-cmk says. A policy the plan cannot know yet (computed from another resource) is not checked; write it as a literal or a data source known at plan time. Every KMS call is logged by CloudTrail by default.',
      tool: 'Conftest (Open Policy Agent, rego.v1) over terraform show -json (AWS; for Azure: Key Vault RBAC assignments, for Google: IAM bindings on the key ring, checked the same way)',
      language: 'rego',
      snippet: `package main

import rego.v1

account := "123456789012"                                         # the account the keys live in
element_roles := {"arn:aws:iam::123456789012:role/order-api"}   # the element's own identities

# AWS's documented statement "Enable IAM User Permissions" gives the account root kms:*;
# it keeps the key manageable and is exempt (IAM policies are reviewed with the key policy)
account_root := {sprintf("arn:aws:iam::%s:root", [account]), account}

use_actions := {"kms:Encrypt", "kms:Decrypt", "kms:GenerateDataKey", "kms:GenerateDataKey*", "kms:GenerateDataKeyWithoutPlaintext", "kms:ReEncrypt*", "kms:ReEncryptFrom", "kms:ReEncryptTo", "kms:*", "*"}
admin_actions := {"kms:Create*", "kms:Put*", "kms:Update*", "kms:Enable*", "kms:Disable*", "kms:Revoke*", "kms:ScheduleKeyDeletion", "kms:CancelKeyDeletion", "kms:TagResource", "kms:UntagResource", "kms:*", "*"}

as_set(x) := {x} if is_string(x)
as_set(x) := {v | some v in x} if is_array(x)

statements(policy) := s if { s := json.unmarshal(policy).Statement; is_array(s) }
statements(policy) := [s] if { s := json.unmarshal(policy).Statement; is_object(s) }

principals(s) := {"*"} if s.Principal == "*"
principals(s) := as_set(s.Principal.AWS) if is_object(s.Principal)

policies[rc.address] := rc.change.after.policy if {
  some rc in input.resource_changes
  rc.type in {"aws_kms_key", "aws_kms_key_policy"}
  is_string(rc.change.after.policy)
}

allows(policy, actions) := granted - account_root if {
  granted := {p |
    some s in statements(policy)
    s.Effect == "Allow"
    count(as_set(s.Action) & actions) > 0
    some p in principals(s)
  }
}

deny contains msg if {
  some address, policy in policies
  some p in allows(policy, use_actions) - element_roles
  p != "*"
  msg := sprintf("%s: %s may use the key but is not the element's identity", [address, p])
}

deny contains msg if {
  some address, policy in policies
  some p in allows(policy, use_actions) & allows(policy, admin_actions)
  msg := sprintf("%s: %s may both use and administer the key", [address, p])
}

deny contains msg if {
  some address, policy in policies
  "*" in allows(policy, use_actions)
  msg := sprintf("%s: anyone may use the key", [address])
}`,
    },
    {
      id: 'ff-key-rotation', label: 'Key rotation on', when: { AT_REST: ['cmk', 'field'], ROTATION: ['automatic'] }, characteristic: 'security', scope: 'atomic', cadence: 'triggered', trigger: 'nightly', invocation: 'automated', implements: ['adr-cmk', 'adr-field'], checks: ['req-rotate-auto'],
      threshold: '0 customer-managed symmetric keys without automatic rotation; every rotation period at most {{KEY_ROTATE_DAYS}} days',
      description: 'A scheduled job lists the customer-managed keys, skips the asymmetric and HMAC ones (which the KMS cannot rotate) and fails on a symmetric key whose rotation is off or whose period is longer than {{KEY_ROTATE_DAYS}} days.',
      tool: 'AWS CLI and jq (for Azure: az keyvault key rotation-policy show; for Google: gcloud kms keys describe, field rotationPeriod)',
      language: 'bash',
      snippet: `#!/usr/bin/env bash
set -euo pipefail
for key in $(aws kms list-keys --query 'Keys[].KeyId' --output text); do
  meta=$(aws kms describe-key --key-id "$key" --query 'KeyMetadata' --output json)
  echo "$meta" | jq -e '.KeyManager == "CUSTOMER" and .KeySpec == "SYMMETRIC_DEFAULT" and .KeyState == "Enabled"' > /dev/null || continue
  aws kms get-key-rotation-status --key-id "$key" --output json \\
    | jq -e --argjson max {{KEY_ROTATE_DAYS}} '.KeyRotationEnabled and (.RotationPeriodInDays <= $max)' > /dev/null \\
    || { echo "key $key: rotation off or longer than {{KEY_ROTATE_DAYS}} days"; exit 1; }
done`,
    },
    {
      id: 'ff-key-age', label: 'No key past its period', when: { AT_REST: ['cmk', 'field'], ROTATION: ['reencrypt'] }, characteristic: 'security', scope: 'atomic', cadence: 'triggered', trigger: 'nightly', invocation: 'automated', implements: ['adr-cmk', 'adr-field'], checks: ['req-rotate-reencrypt'],
      threshold: '0 enabled customer-managed keys older than {{KEY_ROTATE_DAYS}} + 30 days',
      description: 'A scheduled job lists the customer-managed keys and fails on an enabled key past its cryptoperiod and the 30 days allowed for re-encryption, which means the old key still protects data. The creation date is an ISO 8601 string in the CLI\'s JSON and is converted before comparing.',
      tool: 'AWS CLI and jq (for Azure: az keyvault key list, attributes.created; for Google: gcloud kms keys versions list, createTime)',
      language: 'bash',
      snippet: `#!/usr/bin/env bash
set -euo pipefail
max=$(( ({{KEY_ROTATE_DAYS}} + 30) * 86400 ))
for key in $(aws kms list-keys --query 'Keys[].KeyId' --output text); do
  if aws kms describe-key --key-id "$key" --output json | jq -e --argjson max "$max" '
      .KeyMetadata | select(.KeyManager == "CUSTOMER" and .KeyState == "Enabled")
      | (now - (.CreationDate | sub("\\\\.[0-9]+"; "") | sub("\\\\+00:00$"; "Z") | fromdateiso8601)) > $max' > /dev/null; then
    echo "key $key is past its cryptoperiod"; exit 1
  fi
done`,
    },
    {
      id: 'ff-field', label: 'Fields stored as ciphertext', when: { AT_REST: ['field'] }, characteristic: 'security', scope: 'atomic', cadence: 'triggered', trigger: 'pull-request', invocation: 'automated', implements: ['adr-field'], checks: ['req-field'],
      threshold: '0 of the listed sensitive fields readable as plaintext in the database',
      description: 'An integration test starts PostgreSQL in a container, runs the element\'s migrations, saves a record through the element\'s repository for each sensitive field, reads the row directly from the database and fails if the column holds the original value, or if the element cannot read it back.',
      tool: 'Vitest with Testcontainers (@testcontainers/postgresql) and node-postgres; for the JVM: JUnit 5 with Testcontainers\' PostgreSQLContainer and JdbcTemplate',
      language: 'ts',
      snippet: `import { PostgreSqlContainer, type StartedPostgreSqlContainer } from '@testcontainers/postgresql'
import pg from 'pg'
import { afterAll, beforeAll, expect, it } from 'vitest'
import { migrate } from '../src/db/migrate'        // the element's schema migrations
import { customerStore } from '../src/customers'   // the element's repository; encrypts through the KMS client it is given
import { localKms } from './fixtures/kms'          // a KMS stand-in with a local key (Tink's fake KMS client, or LocalStack's KMS)

// one entry per field of: {{SENSITIVE_FIELDS}}
const SENSITIVE = [
  { field: 'cardNumber', column: 'card_number', value: '4111111111111111' },
  { field: 'nationalId', column: 'national_id', value: '85010112345' },
  { field: 'healthNote', column: 'health_note', value: 'type 1 diabetes' },
] as const

let container: StartedPostgreSqlContainer
let pool: pg.Pool
beforeAll(async () => {
  container = await new PostgreSqlContainer('postgres:17').start()
  pool = new pg.Pool({ connectionString: container.getConnectionUri() })
  await migrate(pool)
}, 120_000)
afterAll(async () => { await pool.end(); await container.stop() })

it.each(SENSITIVE)('stores $field as ciphertext and reads it back', async ({ field, column, value }) => {
  const customers = customerStore(pool, localKms())
  const { id } = await customers.create({ name: 'Ada', [field]: value })
  const { rows } = await pool.query(\`select \${column}::text as stored from customers where id = $1\`, [id])
  expect(rows[0].stored).not.toContain(value)
  expect((await customers.get(id))[field]).toBe(value)
})`,
    },
    {
      id: 'ff-cert-renewal', label: 'Renewal watched', when: { CERTS: ['acme'] }, characteristic: 'security', scope: 'atomic', cadence: 'continual', invocation: 'automated', implements: TRANSIT, checks: ['req-certs-acme'],
      threshold: 'An alert fires for every certificate with fewer than 14 days left or not Ready for an hour; 0 certificates expire',
      description: 'Prometheus rules over cert-manager\'s metrics page the owner when a certificate the manager should have renewed at 30 days is still within 14 days of expiry, or has not been Ready for an hour; the public endpoints\' expiry is also checked by the TLS scan.',
      tool: 'Prometheus alerting rules over cert-manager metrics (for AWS Certificate Manager: a CloudWatch alarm on AWS/CertificateManager DaysToExpiry below 14)',
      language: 'yaml',
      snippet: `groups:
- name: certificates
  rules:
  - alert: CertificateNotRenewed
    expr: certmanager_certificate_expiration_timestamp_seconds - time() < 14 * 86400
    for: 1h
    labels: { severity: page }
    annotations: { summary: "{{ $labels.namespace }}/{{ $labels.name }} expires in under 14 days: automatic renewal failed" }
  - alert: CertificateNotReady
    expr: certmanager_certificate_ready_status{condition="False"} == 1
    for: 1h
    labels: { severity: page }
    annotations: { summary: "{{ $labels.namespace }}/{{ $labels.name }} is not Ready" }`,
    },
    {
      id: 'ff-cert-inventory', label: 'Inventory expiry check', when: { CERTS: ['managed-ca'] }, characteristic: 'security', scope: 'atomic', cadence: 'triggered', trigger: 'nightly', invocation: 'automated', implements: TRANSIT, checks: ['req-certs-ca'],
      threshold: 'Every working day, every certificate on the inventory with fewer than 30 days left raises an alert to its named owner; the job fails while one is on the list',
      description: 'A scheduled job reads the inventory (endpoint and owner per line), checks each certificate\'s expiry with openssl and alerts the owner of each one within 30 days of expiry; the job keeps failing, and alerting, until the certificate is replaced.',
      tool: 'openssl in a scheduled job (cron, a scheduled CI workflow) with your alerting hook',
      language: 'bash',
      snippet: `#!/usr/bin/env bash
# cert-inventory.txt: "<host:port> <owner>" per line; notify: your paging or chat hook
set -uo pipefail
fail=0
while read -r endpoint owner; do
  [ -n "$endpoint" ] || continue
  if ! echo | openssl s_client -connect "$endpoint" -servername "\${endpoint%%:*}" 2>/dev/null | openssl x509 -noout -checkend $(( 30 * 86400 )); then
    echo "$endpoint expires within 30 days (owner: $owner)"
    notify "$owner" "certificate $endpoint expires within 30 days; replace it"
    fail=1
  fi
done < cert-inventory.txt
exit $fail`,
    },
  ],
}

export default pack
