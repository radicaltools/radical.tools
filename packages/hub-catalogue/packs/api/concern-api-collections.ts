import type { PackSpec, When } from '../../src/packSpec'

const PAGED: When = { PAGING: ['cursor', 'offset'] }
const CURSOR: When = { PAGING: ['cursor'] }
const MAIN = ['adr-cursor', 'adr-offset', 'adr-bounded']
const FORCES = 'Callers read lists from this element over HTTP (orders, customers, events), and the collections behind them grow. The forces: a list that returns everything works in testing and times out in production; a deep OFFSET page makes the database read and throw away every row before it, while a cursor cannot jump to page 40; items added or removed while a caller reads shift offset pages, so items are skipped or read twice; an order that is not total (two orders created in the same millisecond) does the same even when nothing changes; every filter and sort field offered is an index to keep and a promise to callers; a parameter the API ignores returns the wrong data to a caller who believes it was applied; and a page token with readable ids or offsets becomes an interface callers build on. Paths, field casing and methods are decided in the Resource design pack, the error body in the Errors pack, and how many requests a caller may send in the Rate limiting pack.'

const pack: PackSpec = {
  id: 'concern-api-collections',
  name: 'Collections',
  group: 'api',
  description: 'How an HTTP API returns lists, the same way for every list operation: pages and page sizes, page tokens, filtering, sorting, partial responses and totals. Paths, field casing and methods are decided in the Resource design pack, the error body in the Errors pack. The snippets are for a Node API described in OpenAPI 3.1, checked with Spectral, Vitest with supertest, and k6.',
  tags: ['api', 'collections', 'pagination', 'filtering', 'sorting', 'page tokens'],
  concern: {
    id: 'api-collections',
    trigger: 'LIST RELATIONS WHERE source.type != "person" AND target.external != true AND (target.type = "container" OR target.type = "component")',
    applyTo: 'target',
    why: 'other parts and systems call these elements, so how their APIs return lists has to be decided.',
  },
  sources: [
    { title: 'Google AIP-158, Pagination', url: 'https://google.aip.dev/158' },
    { title: 'Google AIP-160, Filtering', url: 'https://google.aip.dev/160' },
    { title: 'Google AIP-132, Standard methods: List (ordering)', url: 'https://google.aip.dev/132' },
    { title: 'Google AIP-157, Partial responses', url: 'https://google.aip.dev/157' },
    { title: 'Microsoft Azure REST API Guidelines, Collections', url: 'https://github.com/microsoft/api-guidelines/blob/vNext/azure/Guidelines.md#collections' },
    { title: 'Zalando RESTful API Guidelines (rules 137, 157, 159, 160, 248, 254)', url: 'https://opensource.zalando.com/restful-api-guidelines/' },
    { title: 'Markus Winand, Use The Index, Luke: Paging Through Results (the seek method)', url: 'https://use-the-index-luke.com/sql/partial-results/fetch-next-page' },
    { title: 'RFC 8288, Web Linking', url: 'https://www.rfc-editor.org/rfc/rfc8288' },
    { title: 'Spectral: custom rulesets and core functions', url: 'https://docs.stoplight.io/docs/spectral/e5b9616d6d50c-rulesets' },
  ],
  questions: [
    {
      key: 'PAGING', title: 'Pagination', label: 'How does a caller read a long list page by page?',
      hint: 'This decides most of what follows: what a deep page costs, whether items are skipped or read twice while the collection changes, and whether a caller can jump to a page. How many requests a caller may send is decided in the Rate limiting pack.',
      default: 'cursor',
      options: [
        { value: 'cursor', label: 'an opaque page token over a stable sort', description: 'Each response carries next_page_token, an encrypted token saying where the page ended, and the next request sends it back as page_token (Google AIP-158; cursors in Zalando rule 160). A page costs the same at any depth, and items added or removed while a caller reads shift nothing. Pick it for collections that grow without limit (orders, events, logs) and for any public or partner API.' },
        { value: 'offset', label: 'offset and limit, with a maximum offset', description: 'The caller sends offset and limit, so it can jump to any page and show page numbers; offsets past a cap are refused, because the database reads and throws away every skipped row. Pick it for back-office tables that need page numbers over collections of at most tens of thousands of items, whose callers can live with items shifting between pages while the collection changes.' },
        { value: 'bounded', label: 'no pagination, bounded lists only', description: 'Every list comes back whole, because the domain caps it (a customer\'s addresses, an order\'s lines) and the API refuses to grow it past the cap. Pick it only when no list the API serves can grow without limit; the first collection that can needs this decision superseded.' },
      ],
    },
    {
      key: 'FILTER', title: 'Filtering', label: 'How does a caller filter a list?',
      hint: 'Every filterable field is an index to keep and a promise to callers. Whatever is chosen here, a parameter or field the operation does not know is refused with 400, never ignored.',
      default: 'params',
      options: [
        { value: 'params', label: 'a query parameter per filterable field', description: 'Each filterable field is a documented query parameter of its own: equality (?status=paid), a comma-separated list for any of (?status=paid,shipped), and _after and _before suffixes for time ranges (?created_after=2026-01-01T00:00:00Z). Pick it by default: the OpenAPI document lists every filter, request validation checks it, and generated clients get typed arguments.' },
        { value: 'expression', label: 'a filter expression (Google AIP-160)', description: 'One filter parameter holds an expression in the AIP-160 grammar (filter=status = "paid" AND total > 100), parsed on the server over an allow-list of fields and turned into parameterised SQL. Pick it when callers need OR, NOT and comparisons across several fields, typically reporting or partner APIs. The OData-style filter of the Microsoft guidelines (status eq \'paid\') is the same choice for .NET stacks.' },
        { value: 'none', label: 'no filtering', description: 'Lists take no filter; the path itself is the only selection (/customers/{id}/orders). Pick it for small or bounded lists, or when callers always read a list whole.' },
      ],
    },
    {
      key: 'SORT', title: 'Sorting', label: 'Can a caller choose the order of a list?',
      hint: 'Each order offered needs an index on its fields ending in the id; with page tokens, the token carries the order it was issued for.',
      default: 'allowlist',
      options: [
        { value: 'allowlist', label: 'an order_by parameter over an allow-list of fields', description: 'order_by takes a comma-separated list of fields from the operation\'s allow-list, each optionally followed by desc (Google AIP-132: order_by=total desc), and the id is always added as the last key. Pick it when callers show the list in tables they sort.' },
        { value: 'fixed', label: 'one fixed order per list', description: 'Each list has one documented order (by default newest first, then by id) and takes no order parameter. Pick it for feeds, logs and lists read by programs that walk them in one order; it needs one index per list.' },
      ],
    },
    {
      key: 'FIELDS', title: 'Fields', label: 'Can a caller ask for only some fields of each item?',
      hint: 'Partial responses save bandwidth for wide items and mobile clients, at the cost of a response shape that varies with the request.',
      default: 'full',
      options: [
        { value: 'partial', label: 'partial responses through a fields parameter', description: 'fields names the field paths to return, comma-separated, with dots for nested fields (fields=status,total,customer.name), as Google AIP-157 field masks and Zalando rule 157 do; the id always comes back. Pick it when items are wide (dozens of fields, embedded objects) and callers such as mobile apps read a few of them.' },
        { value: 'full', label: 'the full representation always', description: 'Every item comes back whole in every list. Pick it by default: one shape per resource, easy to cache and to type; if items are too wide, make the resource narrower instead.' },
      ],
    },
  ],
  details: [
    { key: 'DEFAULT_PAGE_SIZE', label: 'How many items does a page hold when the caller names no size?', default: '50', number: true },
    { key: 'MAX_PAGE_SIZE', label: 'What is the largest page a caller may ask for?', default: '100', number: true },
    { key: 'TOKEN_HOURS', label: 'For how many hours does a page token stay valid (page tokens only)?', default: '72', number: true },
    { key: 'MAX_OFFSET', label: 'What is the largest offset accepted (offset and limit only)?', default: '10000', number: true },
    { key: 'MAX_ITEMS', label: 'At most how many items may a bounded list hold (bounded lists only)?', default: '200', number: true },
    { key: 'DEFAULT_ORDER', label: 'In which order are lists returned when the caller names none (the last key unique)?', default: 'created_at desc, id desc' },
    { key: 'LIST_P95_MS', label: 'Within how many milliseconds must 95% of page requests be answered, deep pages included?', default: '300', number: true },
  ],
  need: {
    label: 'Lists stay fast, complete and exact',
    text: 'Callers read collections from this element over HTTP, and the collections grow. Every list has to come back in bounded time and size however large its collection gets, show each item once to a caller who reads it page by page, apply exactly the filters and order the caller asked for or refuse the request, and hand out nothing callers could come to depend on by accident, such as ids or offsets inside a page token. The snippets assume the OpenAPI document at api/openapi.yaml, the application exported from src/app with requests validated against that document, page tokens sealed by src/collections/pageToken, and the tests under tests/ with their fixtures in tests/collections (a seeded /orders collection and a walk helper that reads every page of a list). Names are written in snake_case as Google AIP-158 writes them (page_size, page_token, next_page_token, order_by); where the Resource design pack chose camelCase, read pageSize, pageToken, nextPageToken and orderBy.',
  },
  forces: FORCES,
  requirements: [
    {
      id: 'req-paged', label: 'Pages are bounded', when: PAGED, ears_type: 'ubiquitous',
      action: 'return at most {{MAX_PAGE_SIZE}} items in one response of every list operation, {{DEFAULT_PAGE_SIZE}} when the caller names no page size, and refuse a page size below 1, above {{MAX_PAGE_SIZE}} or not a whole number with 400',
      rationale: 'A list without a cap works in testing and times out in production; Zalando rule 159 makes pagination a must for that reason. Refusing an oversized page instead of shrinking it keeps the contract exact, as for any parameter the operation cannot serve (Microsoft Azure REST API Guidelines, Collections); Google AIP-158 shrinks it instead, which the decision weighs among its alternatives.',
      scenario: { label: 'Page size held to its range', given: 'a list operation over a collection of more than {{MAX_PAGE_SIZE}} items', when: 'it is called with no page size, with {{MAX_PAGE_SIZE}}, with one more, with 0, with -1 and with a word', then: 'the first call returns {{DEFAULT_PAGE_SIZE}} items, the second {{MAX_PAGE_SIZE}}, and the other four are refused with 400' },
    },
    {
      id: 'req-token-opaque', label: 'Page tokens reveal nothing', when: CURSOR, ears_type: 'ubiquitous',
      action: 'issue every page token encrypted and authenticated with AES-256-GCM, so that no item id, sort value or position can be read from it or changed in it',
      rationale: 'Google AIP-158: page tokens must be opaque and must not be user-parseable; Zalando rule 160: a cursor is never inspected or constructed by clients. A readable token becomes an interface callers build on, and an editable one lets a caller page through data it never queried.',
      scenario: { label: 'Token holds nothing readable', given: 'the first page of a list and the token for the next one', when: 'the token is decoded from base64url', then: 'the id of the page\'s last item does not appear in it' },
    },
    {
      id: 'req-token-refused', label: 'Bad page tokens refused', when: CURSOR, ears_type: 'unwanted-behaviour',
      unwanted_condition: 'a request carries a page token that has been altered, was issued by another list operation, or is older than {{TOKEN_HOURS}} hours',
      action: 'refuse it with 400 and tell the caller to start again from the first page',
      rationale: 'Google AIP-158: every other parameter must match the call that issued the token, and tokens may expire some time after they are sent (three days is its rule of thumb). A token taken to another list or kept for days reads a position that no longer means anything.',
      scenario: { label: 'Altered, foreign and expired tokens refused', given: 'a page token issued by the orders list', when: 'it is sent back with one character changed, to the customers list, and backdated past {{TOKEN_HOURS}} hours', then: 'each request is refused with 400' },
    },
    {
      id: 'req-cursor-consistent', label: 'Changes during a read skip nothing', when: CURSOR, ears_type: 'event-driven',
      trigger: 'items are added to or removed from a collection while a caller reads it page by page with page tokens',
      action: 'return every item that existed throughout the read exactly once',
      rationale: 'A token that holds the last item\'s sort keys continues after that item wherever it now is, where an offset shifts by every item added or removed before it (Winand, the seek method). The Microsoft guidelines ask to document whether items can be skipped or read twice; with page tokens they cannot.',
      scenario: { label: 'Read survives concurrent changes', given: 'a collection of five pages', when: 'a caller reads it page by page, and after the second page five items are added and five not yet read are removed', then: 'every other item is read exactly once and no item twice' },
    },
    {
      id: 'req-offset-cap', label: 'Deep offsets refused', when: { PAGING: ['offset'] }, ears_type: 'unwanted-behaviour',
      unwanted_condition: 'a request asks for an offset greater than {{MAX_OFFSET}}',
      action: 'refuse it with 400 naming the largest offset accepted, before any query runs',
      rationale: 'With OFFSET the database counts every row from the beginning up to the page, so a page costs more the deeper it is (Winand); the cap bounds that cost. Zalando rule 160 prefers cursors for the same reason.',
      scenario: { label: 'Offset past the cap refused', given: 'a list operation with offset and limit', when: 'it is called with offset {{MAX_OFFSET}} and with offset {{MAX_OFFSET}} plus one', then: 'the first is answered and the second refused with 400, its message naming {{MAX_OFFSET}}' },
    },
    {
      id: 'req-bounded', label: 'Bounded lists stay bounded', when: { PAGING: ['bounded'] }, ears_type: 'ubiquitous',
      action: 'return every list whole in one response of at most {{MAX_ITEMS}} items, and refuse with 409 a request that would add an item to a list already holding {{MAX_ITEMS}}',
      rationale: 'Zalando rule 159 asks for pagination to protect the service against overload; a list served without pages is safe only while the domain bounds it, and the bound holds only if it is enforced where items are added.',
      scenario: { label: 'Full list refuses another item', given: 'a list holding {{MAX_ITEMS}} items', when: 'one more item is added and the list is read', then: 'the addition is refused with 409, and the list returns all {{MAX_ITEMS}} items in one response with no page token' },
    },
    {
      id: 'req-order', label: 'Lists have a total order', ears_type: 'ubiquitous',
      action: 'return the items of every list in a total order, the one the caller asked for or else {{DEFAULT_ORDER}}, always ending in the unique id, so that reading every page of an unchanged collection yields each item exactly once',
      rationale: 'Paging requires a deterministic sort order (Winand): two items with the same creation time can swap places between requests, and then one is read twice and the other never. Google AIP-132 lets an order name several fields, which is how the id is added.',
      scenario: { label: 'Ties broken by the id', given: 'a collection in which twenty items share one creation time', when: 'a caller reads every page in the default order', then: 'each item appears exactly once, in the order {{DEFAULT_ORDER}}, and no two neighbours tie' },
    },
    {
      id: 'req-unknown', label: 'Unknown parameters refused', ears_type: 'unwanted-behaviour',
      unwanted_condition: 'a list request carries a query parameter the operation does not document, or names a filter, sort or field that is not on the operation\'s allow-list',
      action: 'refuse it with 400 naming that parameter or field, and never answer as if it were absent',
      rationale: 'An ignored parameter hands unfiltered or misordered data to a caller who believes it was applied. The Microsoft guidelines return an error for an unsupported parameter, filter operator and sort field; Google AIP-160 returns INVALID_ARGUMENT for a filter that names a field that does not exist. The body of the error is decided in the Errors pack.',
      scenario: { label: 'Unknown names refused', given: 'a list operation', when: 'it is called with an undocumented parameter, an order_by field off its allow-list, a filter on an unknown field and an unknown field in fields', then: 'each call is refused with 400 and the error names what it did not know' },
    },
    {
      id: 'req-filter', label: 'Filters apply before paging', when: { FILTER: ['params', 'expression'] }, ears_type: 'ubiquitous',
      action: 'apply every filter on the server before paging, so that the pages together hold exactly the items that match, and refuse a filter value that does not fit its field\'s type with 400',
      rationale: 'A filter applied after paging returns short or empty pages and hides matches behind them. Google AIP-160 refuses values that do not fit the field\'s type and asks the API to document which fields a filter may name, which the OpenAPI document does.',
      scenario: { label: 'Filtered pages hold exactly the matches', given: 'a seeded collection and a filter on each filterable field', when: 'a caller reads every page with the filter, and once with a value of the wrong type', then: 'the pages hold exactly the items the filter matches, in order, and the wrong value is refused with 400' },
    },
    {
      id: 'req-sort', label: 'Callers choose the order', when: { SORT: ['allowlist'] }, ears_type: 'event-driven',
      trigger: 'a caller names in order_by fields from the operation\'s allow-list, each optionally followed by desc',
      action: 'return the list in that order across every page, with the id as the last key in the direction of the last field named',
      rationale: 'Google AIP-132 defines order_by as a comma-separated list of fields with a desc suffix. The id as the last key makes the order total, and keeping it in the direction of the last field lets a page continue with one row comparison (Winand, the seek method).',
      scenario: { label: 'Sorted both ways across pages', given: 'each field on the allow-list', when: 'the list is read page by page ordered by it ascending and descending', then: 'every read is ordered by the field, ties by id in the same direction' },
    },
    {
      id: 'req-fields', label: 'Only the fields asked for', when: { FIELDS: ['partial'] }, ears_type: 'event-driven',
      trigger: 'a list request names field paths in fields',
      action: 'return only those fields and the id of each item, on every page',
      rationale: 'Wide items cost bandwidth and parsing that a mobile client does not need (Google AIP-157, partial responses; Zalando rule 157).',
      scenario: { label: 'Partial items', given: 'orders with a dozen fields and an embedded customer', when: 'the list is read with fields=status,total,customer.name', then: 'each item holds exactly id, status, total and a customer with only its name' },
    },
    {
      id: 'req-latency', label: 'Deep pages stay fast', when: PAGED, ears_type: 'ubiquitous',
      action: 'answer 95% of requests for a page of {{MAX_PAGE_SIZE}} items within {{LIST_P95_MS}} ms, the deepest pages a caller can reach included',
      rationale: 'OFFSET paging gets slower the further back a caller reads (Winand), and a test of the first page hides it; with page tokens the hundredth page should cost what the first does, which this proves.',
      scenario: { label: 'Deep page under load', given: 'a production-sized collection in a test environment', when: 'ten callers request a page a hundred pages deep, or at the largest offset accepted, for two minutes', then: 'the 95th percentile of the response times stays below {{LIST_P95_MS}} ms' },
    },
  ],
  adrs: [
    {
      id: 'adr-cursor', label: 'Lists paged with opaque page tokens', when: CURSOR,
      decision: 'Every list operation takes page_size (1 to {{MAX_PAGE_SIZE}}, default {{DEFAULT_PAGE_SIZE}}) and page_token, and answers an object { items, next_page_token }, never a bare array, with next_page_token left out on the last page (Google AIP-158; Microsoft guidelines, Collections). The token holds the last item\'s sort values and id, the operation, a hash of the filter, order and field parameters and its time of issue, sealed with AES-256-GCM (Node crypto, javax.crypto on the JVM) under a key from the secrets store; it is valid for {{TOKEN_HOURS}} hours and refused with 400 when altered, foreign or expired. The next page is read with the seek method, WHERE (created_at, id) < (last created_at, last id) ORDER BY created_at DESC, id DESC LIMIT page_size + 1, over an index on the sort keys and the id; the extra row says whether there is a next page. Default order: {{DEFAULT_ORDER}}. Filtering: {{FILTER}}. Sorting: {{SORT}}. Fields: {{FIELDS}}. No total count is returned (Zalando rule 254; the Microsoft guidelines advise against a count); a caller that needs the number uses a report. Requests are validated against the OpenAPI document (express-openapi-validator in Node, swagger-request-validator on the JVM), so an undocumented parameter or a page size out of range is refused with 400.',
      consequences: '• Every page costs one index range scan at any depth, and items added or removed during a read shift nothing.\n• No page numbers and no jumping to page 40: a caller reads forward from the first page; a table that needs page numbers needs offset paging or a search engine.\n• Each order offered needs an index on its fields and the id; an order mixing directions (total desc, created_at asc) cannot use one row comparison and needs an expanded WHERE.\n• The sealing key is a secret to rotate; tokens sealed with a retired key are refused and callers start again from the first page.\n• After {{TOKEN_HOURS}} hours a token is refused, so a long export has to finish sooner or start over.\n• Lowering the maximum page size later narrows the contract and is a breaking change, decided in the API evolution pack.',
      alternatives: '1. Offset and limit: page numbers and jumps, but deep pages cost every skipped row and items shift while the collection changes (Winand).\n2. Readable cursors (base64 of the last id): simpler, but callers decode and build them, and an edited one reads data the caller never queried (Zalando rule 160).\n3. Next-page links in a Link header (RFC 8288) instead of a token in the body: fits hypermedia clients, but generated clients read the body more easily.\n4. Shrinking a too-large page size to the maximum, as Google AIP-158 does: kinder to callers that ask for too much and lets the maximum fall later without a break, but the contract then accepts what it does not serve.',
    },
    {
      id: 'adr-offset', label: 'Lists paged with offset and limit', when: { PAGING: ['offset'] },
      decision: 'Every list operation takes limit (1 to {{MAX_PAGE_SIZE}}, default {{DEFAULT_PAGE_SIZE}}) and offset (0 to {{MAX_OFFSET}}), the names Zalando rule 137 reserves, and answers an object { items, next_offset }, never a bare array, with next_offset left out on the last page. The query runs ORDER BY the requested order LIMIT limit + 1 OFFSET offset over an index on the sort keys and the id; the extra row says whether there is a next page. An offset above {{MAX_OFFSET}} is refused with 400 naming the cap: a caller that needs to reach further narrows the list with filters. Each list operation\'s description says that items added or removed during a read can shift between pages (Microsoft guidelines, Collections). Default order: {{DEFAULT_ORDER}}. Filtering: {{FILTER}}. Sorting: {{SORT}}. Fields: {{FIELDS}}. No total count is returned (Zalando rule 254; the Microsoft guidelines advise against a count). Requests are validated against the OpenAPI document (express-openapi-validator in Node, swagger-request-validator on the JVM), so an undocumented parameter, a limit out of range or an offset past the cap is refused with 400.',
      consequences: '• A caller can jump to any page and show page numbers.\n• The database reads and discards every row before the offset, so a page costs more the deeper it is; the cap bounds that cost and leaves the rest of a long list reachable only through filters.\n• Items added or removed during a read shift the pages, so an item can be read twice or missed: exports and synchronisation must not read these lists.\n• Simple to build with any ORM and any database.\n• Lowering the maximum page size or the cap later narrows the contract and is a breaking change, decided in the API evolution pack.',
      alternatives: '1. Opaque page tokens: the same cost at every depth and no shifting, but no page numbers.\n2. No cap on the offset: every page reachable, and one request can make the database read a whole table.\n3. A page number and page size instead of offset and limit: the same query and costs, and a page size change moves every page boundary.\n4. Shrinking a too-large limit to the maximum, as Google AIP-158 does: kinder to callers that ask for too much, but the contract then accepts what it does not serve.',
    },
    {
      id: 'adr-bounded', label: 'Lists served whole, bounded by the domain', when: { PAGING: ['bounded'] },
      context: `${FORCES} Here every collection the API lists is capped by the domain, so none needs pages yet.`,
      decision: 'Every list operation returns the whole list as an object { items }, never a bare array (Microsoft guidelines, Collections). Each listed collection is capped by the domain at {{MAX_ITEMS}} items (a customer\'s addresses, an order\'s lines), the cap is declared as maxItems on items in the OpenAPI document, and a request that would add an item past it is refused with 409. A collection that can grow without limit (orders, events, audit records) is not served as a list until this decision is superseded. Default order: {{DEFAULT_ORDER}}. Filtering: {{FILTER}}. Sorting: {{SORT}}. Fields: {{FIELDS}}. Requests are validated against the OpenAPI document (express-openapi-validator in Node, swagger-request-validator on the JVM), so an undocumented parameter is refused with 400.',
      consequences: '• No paging code in the API or in its callers: every list is one request.\n• The cap is a product rule: it is agreed with the business and shown to users before they meet it.\n• Adding pages later is still a breaking change for callers that never followed a token (the Microsoft guidelines say so of adding paging); the object shape only keeps the response parsable, and the change goes through the API evolution pack.\n• The first collection that can grow without limit needs this decision superseded.',
      alternatives: '1. Opaque page tokens on every list from the start: nothing to supersede later, at the cost of paging code for lists that never need it.\n2. Lists without a cap: one request returns a whole table the first time it grows.',
    },
    {
      id: 'adr-filter-expression', label: 'Lists filtered with AIP-160 expressions', when: { FILTER: ['expression'] },
      decision: 'Lists are filtered through one filter parameter holding an expression in the Google AIP-160 grammar: comparisons (=, !=, <, >, <=, >=), AND, OR, NOT and the has operator (:) over the fields on each operation\'s allow-list, which the parameter\'s description in the OpenAPI document lists with their types. The server parses the expression with go.einride.tech/aip/filtering in Go, or with a parser generated from the published AIP-160 EBNF grammar (ANTLR on the JVM, Peggy in Node), checks every field against the allow-list and every value against the field\'s type, and turns it into parameterised SQL; the expression is never concatenated into a query. A field off the list, a value of the wrong type or an unsupported operator is refused with 400. A page token or offset is valid only with the expression it was issued for.',
      consequences: '• Callers combine conditions (OR, NOT, ranges on several fields) without a new parameter for each.\n• A parser, a type check and a translation to SQL to build and keep; a flaw there reaches the database, so it is tested like any other input handling.\n• Request validation cannot check an expression: the OpenAPI document sees one string, and generated clients get no typed filter arguments.\n• An expression can combine fields no index serves; a field enters the allow-list together with its index.',
      alternatives: '1. A query parameter per filterable field: typed, documented and validated through the OpenAPI document, but no OR and no NOT.\n2. The OData-style filter of the Microsoft guidelines (status eq \'paid\'): the same power, natural on .NET stacks with an OData library, unfamiliar elsewhere.\n3. A search engine (OpenSearch) for free-form queries: full text and facets, at the cost of a second store kept in sync.',
    },
  ],
  fitness: [
    {
      id: 'ff-spectral-cursor', label: 'Every list documents page tokens and a page-size cap', when: CURSOR, characteristic: 'compatibility', scope: 'atomic', cadence: 'triggered', trigger: 'pull-request', invocation: 'automated', implements: ['adr-cursor'], checks: ['req-paged'],
      threshold: '0 Spectral errors: every list operation in api/openapi.yaml takes page_token and page_size with minimum 1, maximum at most {{MAX_PAGE_SIZE}} and default {{DEFAULT_PAGE_SIZE}}, and answers an object with items and next_page_token',
      description: 'Spectral lints the OpenAPI document in every pull request with two custom rules in .spectral.yaml, with references resolved. A list operation is a GET on a path that does not end in a path parameter; other paths that are not lists (/health here) are added to the pattern. Request validation against the same document then enforces the range at run time.',
      tool: 'Spectral CLI (@stoplight/spectral-cli 6) in CI: npx @stoplight/spectral-cli lint api/openapi.yaml --fail-severity error',
      language: 'yaml',
      snippet: `extends: spectral:oas
rules:
  list-page-parameters:
    description: Every list operation takes page_token, and page_size from 1 to {{MAX_PAGE_SIZE}} with default {{DEFAULT_PAGE_SIZE}}.
    severity: error
    given: $.paths[?(!@property.match(/(\\}|^\\/health)$/))].get
    then:
      field: parameters
      function: schema
      functionOptions:
        schema:
          type: array
          allOf:
            - contains: { required: [name], properties: { name: { const: page_token } } }
            - contains:
                required: [name, schema]
                properties:
                  name: { const: page_size }
                  schema: { required: [minimum, maximum, default], properties: { minimum: { const: 1 }, maximum: { maximum: {{MAX_PAGE_SIZE}} }, default: { const: {{DEFAULT_PAGE_SIZE}} } } }
  list-page-object:
    description: Every list operation answers an object with items and next_page_token, never a bare array.
    severity: error
    given: $.paths[?(!@property.match(/(\\}|^\\/health)$/))].get
    then: { field: responses.200.content.application/json.schema, function: schema, functionOptions: { schema: { required: [properties], properties: { properties: { required: [items, next_page_token] } } } } }`,
    },
    {
      id: 'ff-spectral-offset', label: 'Every list documents limit and a capped offset', when: { PAGING: ['offset'] }, characteristic: 'compatibility', scope: 'atomic', cadence: 'triggered', trigger: 'pull-request', invocation: 'automated', implements: ['adr-offset'], checks: ['req-paged', 'req-offset-cap'],
      threshold: '0 Spectral errors: every list operation in api/openapi.yaml takes limit with minimum 1, maximum at most {{MAX_PAGE_SIZE}} and default {{DEFAULT_PAGE_SIZE}}, and offset with minimum 0 and maximum at most {{MAX_OFFSET}}, and answers an object with items and next_offset',
      description: 'Spectral lints the OpenAPI document in every pull request with two custom rules in .spectral.yaml, with references resolved. A list operation is a GET on a path that does not end in a path parameter; other paths that are not lists (/health here) are added to the pattern. Request validation against the same document then refuses a limit or offset out of range with 400.',
      tool: 'Spectral CLI (@stoplight/spectral-cli 6) in CI: npx @stoplight/spectral-cli lint api/openapi.yaml --fail-severity error',
      language: 'yaml',
      snippet: `extends: spectral:oas
rules:
  list-limit-offset:
    description: Every list operation takes limit (1 to {{MAX_PAGE_SIZE}}, default {{DEFAULT_PAGE_SIZE}}) and offset (0 to {{MAX_OFFSET}}).
    severity: error
    given: $.paths[?(!@property.match(/(\\}|^\\/health)$/))].get
    then:
      field: parameters
      function: schema
      functionOptions:
        schema:
          type: array
          allOf:
            - contains:
                required: [name, schema]
                properties:
                  name: { const: limit }
                  schema: { required: [minimum, maximum, default], properties: { minimum: { const: 1 }, maximum: { maximum: {{MAX_PAGE_SIZE}} }, default: { const: {{DEFAULT_PAGE_SIZE}} } } }
            - contains: { required: [name, schema], properties: { name: { const: offset }, schema: { required: [minimum, maximum], properties: { minimum: { const: 0 }, maximum: { maximum: {{MAX_OFFSET}} } } } } }
  list-page-object:
    description: Every list operation answers an object with items and next_offset, never a bare array.
    severity: error
    given: $.paths[?(!@property.match(/(\\}|^\\/health)$/))].get
    then: { field: responses.200.content.application/json.schema, function: schema, functionOptions: { schema: { required: [properties], properties: { properties: { required: [items, next_offset] } } } } }`,
    },
    {
      id: 'ff-page-size', label: 'Page size held to its range', when: PAGED, characteristic: 'performance-efficiency', scope: 'atomic', cadence: 'triggered', trigger: 'pull-request', invocation: 'automated', implements: ['adr-cursor', 'adr-offset'], checks: ['req-paged', 'req-offset-cap'],
      threshold: 'No page size returns {{DEFAULT_PAGE_SIZE}} items, {{MAX_PAGE_SIZE}} returns {{MAX_PAGE_SIZE}}; {{MAX_PAGE_SIZE}} + 1, 0, -1 and a word are refused with 400; with offsets, offset {{MAX_OFFSET}} is answered and {{MAX_OFFSET}} + 1 refused with 400 naming {{MAX_OFFSET}}',
      description: 'An HTTP test against the application calls the orders list with each page size at and around the limits, and with offset and limit also with the offsets at and past the cap. The fixture names the page-size parameter of the decision (page_size with page tokens, limit with offsets).',
      tool: 'Vitest with supertest (or the test runner and HTTP client of your stack: JUnit with MockMvc, xUnit with WebApplicationFactory)',
      language: 'ts',
      snippet: `import request from 'supertest'
import { beforeAll, expect, it } from 'vitest'
import { app } from '../src/app'
import { PAGED_BY, SIZE_PARAM, seedOrders } from './collections/fixtures' // SIZE_PARAM: page_size or limit

const DEFAULT_SIZE = {{DEFAULT_PAGE_SIZE}}
const MAX_SIZE = {{MAX_PAGE_SIZE}}
const MAX_OFFSET = {{MAX_OFFSET}}
const list = (query: Record<string, string | number> = {}) => request(app).get('/orders').query(query)

beforeAll(() => seedOrders(MAX_SIZE + 10))

it('serves the default size and the maximum, and refuses anything outside 1 to the maximum', async () => {
  expect((await list()).body.items).toHaveLength(DEFAULT_SIZE)
  expect((await list({ [SIZE_PARAM]: MAX_SIZE })).body.items).toHaveLength(MAX_SIZE)
  for (const size of [MAX_SIZE + 1, 0, -1, 'ten']) expect((await list({ [SIZE_PARAM]: size })).status).toBe(400)
})

it.runIf(PAGED_BY === 'offset')('refuses an offset past the cap, naming it', async () => {
  expect((await list({ offset: MAX_OFFSET })).status).toBe(200)
  const past = await list({ offset: MAX_OFFSET + 1 })
  expect(past.status).toBe(400)
  expect(JSON.stringify(past.body)).toContain(String(MAX_OFFSET))
})`,
    },
    {
      id: 'ff-cursor-tokens', label: 'Page tokens sealed and checked', when: CURSOR, characteristic: 'security', scope: 'atomic', cadence: 'triggered', trigger: 'pull-request', invocation: 'automated', implements: ['adr-cursor'], checks: ['req-token-opaque', 'req-token-refused'],
      threshold: 'The last item\'s id appears 0 times in the decoded token; an altered token, a token sent to another list and a token older than {{TOKEN_HOURS}} hours are each refused with 400',
      description: 'An HTTP test reads the first page, decodes its token to show it holds no readable id, then sends the token back with one character changed, to the customers list, and resealed with an issue time {{TOKEN_HOURS}} hours and one more in the past, using the same sealing module the list operations use.',
      tool: 'Vitest with supertest, the token module of the application (Node crypto, AES-256-GCM)',
      language: 'ts',
      snippet: `import request from 'supertest'
import { beforeAll, expect, it } from 'vitest'
import { app } from '../src/app'
import { openPageToken, sealPageToken } from '../src/collections/pageToken' // AES-256-GCM, as the lists use it
import { seedOrders } from './collections/fixtures'

const TOKEN_HOURS = {{TOKEN_HOURS}}

beforeAll(() => seedOrders(30))

it('issues tokens that reveal nothing, and refuses altered, foreign and expired ones', async () => {
  const first = await request(app).get('/orders').query({ page_size: 10 })
  const token: string = first.body.next_page_token
  expect(Buffer.from(token, 'base64url').toString('latin1')).not.toContain(first.body.items.at(-1).id)
  const altered = token.slice(0, 20) + (token[20] === 'A' ? 'B' : 'A') + token.slice(21)
  const expired = sealPageToken({ ...openPageToken(token), issuedAt: Date.now() - (TOKEN_HOURS + 1) * 3_600_000 })
  for (const [path, pageToken] of [['/orders', altered], ['/customers', token], ['/orders', expired]]) {
    const res = await request(app).get(path).query({ page_size: 10, page_token: pageToken })
    expect(res.status, \`\${path} with a bad token\`).toBe(400)
  }
})`,
    },
    {
      id: 'ff-cursor-walk', label: 'A read survives concurrent changes', when: CURSOR, characteristic: 'functional-suitability', scope: 'atomic', cadence: 'triggered', trigger: 'pull-request', invocation: 'automated', implements: ['adr-cursor'], checks: ['req-cursor-consistent'],
      threshold: 'While 5 items are added and 5 not yet read are removed during a read of 5 pages, every other item is read exactly once and 0 items twice',
      description: 'An HTTP test reads the orders list page by page with page tokens; after the second page it adds five orders and removes the last five of the list, which have not been read yet, then checks what the read returned against the ids the database held before.',
      tool: 'Vitest with supertest, with fixtures that write to the test database',
      language: 'ts',
      snippet: `import request from 'supertest'
import { beforeAll, expect, it } from 'vitest'
import { app } from '../src/app'
import { createOrders, deleteOrders, orderIds, seedOrders } from './collections/fixtures' // orderIds: in the default order

beforeAll(() => seedOrders(50))

it('reads every surviving item once while items are added and removed', async () => {
  const before = await orderIds()
  const removed = before.slice(-5) // not read yet when they go
  const read: string[] = []
  let token: string | undefined
  for (let page = 1; page === 1 || token; page++) {
    const { body } = await request(app).get('/orders').query({ page_size: 10, ...(token ? { page_token: token } : {}) })
    read.push(...body.items.map((o: { id: string }) => o.id))
    token = body.next_page_token
    if (page === 2) { await createOrders(5); await deleteOrders(removed) }
  }
  expect(new Set(read).size).toBe(read.length)
  for (const id of before.filter((id) => !removed.includes(id))) expect(read).toContain(id)
})`,
    },
    {
      id: 'ff-order', label: 'Lists read in a total order', characteristic: 'functional-suitability', scope: 'atomic', cadence: 'triggered', trigger: 'pull-request', invocation: 'automated', implements: MAIN, checks: ['req-order'],
      threshold: 'Reading every page of the orders list in the default order returns each seeded item exactly once, and every item comes strictly after its neighbour in the order {{DEFAULT_ORDER}}',
      description: 'An HTTP test seeds orders of which twenty share one creation time, reads every page with the walk helper (which follows the pagination of the decision: page tokens, offsets, or the one response of a bounded list), and checks that no item is missing or repeated and that each item comes strictly after the one before it in the default order, so ties are broken.',
      tool: 'Vitest with supertest, through the walk helper in tests/collections',
      language: 'ts',
      snippet: `import { beforeAll, expect, it } from 'vitest'
import { SEEDED, seedOrders, walk } from './collections/fixtures' // walk: every page, as the decision pages

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Item = Record<string, any>
const ORDER = '{{DEFAULT_ORDER}}'.split(',').map((key) => key.trim().split(/\\s+/))
const strictlyBefore = (a: Item, b: Item): boolean => {
  for (const [field, direction] of ORDER) {
    if (a[field] === b[field]) continue
    return direction === 'desc' ? a[field] > b[field] : a[field] < b[field]
  }
  return false
}

beforeAll(() => seedOrders(SEEDED, { sameCreatedAt: 20 })) // twenty items share one creation time

it('reads each item once, in the default order, with every tie broken', async () => {
  const items: Item[] = await walk('/orders', {})
  expect(items).toHaveLength(SEEDED)
  expect(new Set(items.map((item) => item.id)).size).toBe(SEEDED)
  for (let i = 1; i < items.length; i++) expect(strictlyBefore(items[i - 1], items[i])).toBe(true)
})`,
    },
    {
      id: 'ff-bounded', label: 'Bounded lists refuse to grow', when: { PAGING: ['bounded'] }, characteristic: 'performance-efficiency', scope: 'atomic', cadence: 'triggered', trigger: 'pull-request', invocation: 'automated', implements: ['adr-bounded'], checks: ['req-bounded'],
      threshold: 'A list holding {{MAX_ITEMS}} items refuses one more with 409 and returns all {{MAX_ITEMS}} in one response without a page token; one test per bounded list',
      description: 'An HTTP test per bounded list fills it to the cap through the API, adds one more and reads the list back. The example is a customer\'s addresses.',
      tool: 'Vitest with supertest (or the test runner and HTTP client of your stack)',
      language: 'ts',
      snippet: `import request from 'supertest'
import { expect, it } from 'vitest'
import { app } from '../src/app'
import { createCustomer } from './collections/fixtures'

const MAX_ITEMS = {{MAX_ITEMS}}

it('serves a customer\\'s addresses whole and refuses to grow them past the cap', async () => {
  const customer = await createCustomer()
  const addresses = \`/customers/\${customer.id}/addresses\`
  const add = () => request(app).post(addresses).send({ line1: 'Main Street 1', city: 'Gdansk', country: 'PL' })
  for (let i = 0; i < MAX_ITEMS; i++) expect((await add()).status).toBe(201)
  expect((await add()).status).toBe(409)
  const { body } = await request(app).get(addresses)
  expect(body.items).toHaveLength(MAX_ITEMS)
  expect(body).not.toHaveProperty('next_page_token')
})`,
    },
    {
      id: 'ff-unknown', label: 'Unknown parameters refused', characteristic: 'compatibility', scope: 'atomic', cadence: 'triggered', trigger: 'pull-request', invocation: 'automated', implements: MAIN, checks: ['req-unknown'],
      threshold: 'An undocumented parameter, an order_by field off the allow-list, a filter on an unknown field and an unknown field in fields are each refused with 400, the error naming the parameter or field',
      description: 'An HTTP test calls the orders list four times with something it does not know. The same four calls hold for every answer: where the pack decided no order_by, filter or fields parameter, the parameter itself is the unknown one.',
      tool: 'Vitest with supertest (or the test runner and HTTP client of your stack)',
      language: 'ts',
      snippet: `import request from 'supertest'
import { expect, it } from 'vitest'
import { app } from '../src/app'

it.each([
  { label: 'an undocumented parameter', query: { colour: 'red' }, names: /colour/ },
  { label: 'an order_by field off the allow-list', query: { order_by: 'internal_cost' }, names: /order_by|internal_cost/ },
  { label: 'a filter on an unknown field', query: { filter: 'internal_cost > 1' }, names: /filter|internal_cost/ },
  { label: 'an unknown field in fields', query: { fields: 'internal_cost' }, names: /fields|internal_cost/ },
])('refuses $label with 400, naming it', async ({ query, names }) => {
  const res = await request(app).get('/orders').query(query)
  expect(res.status).toBe(400)
  expect(JSON.stringify(res.body)).toMatch(names)
})`,
    },
    {
      id: 'ff-filter', label: 'Filters apply before paging', when: { FILTER: ['params', 'expression'] }, characteristic: 'functional-suitability', scope: 'atomic', cadence: 'triggered', trigger: 'pull-request', invocation: 'automated', implements: [...MAIN, 'adr-filter-expression'], checks: ['req-filter'],
      threshold: 'For each filterable field, the filtered read across every page returns exactly the matching items of the unfiltered read, in the same order; a value of the wrong type is refused with 400',
      description: 'An HTTP test per filterable field reads the whole list, then the list with the filter, and compares the ids; a second call sends a value that does not fit the field. The cases live in the fixtures, one per filterable field of the OpenAPI document, written as the decision filters (a parameter per field, or an AIP-160 expression).',
      tool: 'Vitest with supertest, through the walk helper in tests/collections',
      language: 'ts',
      snippet: `import request from 'supertest'
import { beforeAll, describe, expect, it } from 'vitest'
import { app } from '../src/app'
import { FILTER_CASES, SEEDED, seedOrders, walk } from './collections/fixtures'
// one case per filterable field, for example
//   { field: 'status', query: { status: 'paid' }, invalid: { created_after: 'yesterday' }, matches: (o) => o.status === 'paid' }
//   { field: 'status', query: { filter: 'status = "paid"' }, invalid: { filter: 'total > "many"' }, matches: (o) => o.status === 'paid' }

beforeAll(() => seedOrders(SEEDED))

describe.each(FILTER_CASES)('filter on $field', ({ query, invalid, matches }) => {
  it('returns exactly the matching items across every page, in order', async () => {
    const all = await walk('/orders', {})
    expect((await walk('/orders', query)).map((o) => o.id)).toEqual(all.filter(matches).map((o) => o.id))
  })
  it('refuses a value that does not fit the field', async () => {
    expect((await request(app).get('/orders').query(invalid)).status).toBe(400)
  })
})`,
    },
    {
      id: 'ff-sort', label: 'Every allowed order holds across pages', when: { SORT: ['allowlist'] }, characteristic: 'functional-suitability', scope: 'atomic', cadence: 'triggered', trigger: 'pull-request', invocation: 'automated', implements: MAIN, checks: ['req-sort'],
      threshold: 'For each field on the order_by allow-list, ascending and descending, every item read across all pages comes after its neighbour by the field, ties by id in the same direction',
      description: 'An HTTP test reads the orders list page by page once per allowed field and direction, with twenty orders sharing one creation time so ties occur, and checks each neighbouring pair. The allow-list comes from the fixtures, which read it from the OpenAPI document.',
      tool: 'Vitest with supertest, through the walk helper in tests/collections',
      language: 'ts',
      snippet: `import { beforeAll, describe, expect, it } from 'vitest'
import { SEEDED, SORTABLE, seedOrders, walk } from './collections/fixtures' // SORTABLE: the order_by allow-list

beforeAll(() => seedOrders(SEEDED, { sameCreatedAt: 20 }))

const cases = SORTABLE.flatMap((field: string) => [{ field, direction: 'asc' }, { field, direction: 'desc' }])

describe.each(cases)('order_by $field $direction', ({ field, direction }) => {
  it('orders every page by the field, ties by id in the same direction', async () => {
    const items = await walk('/orders', { order_by: direction === 'desc' ? \`\${field} desc\` : field })
    for (let i = 1; i < items.length; i++) {
      const [a, b] = direction === 'desc' ? [items[i], items[i - 1]] : [items[i - 1], items[i]]
      expect(a[field] < b[field] || (a[field] === b[field] && a.id < b.id)).toBe(true)
    }
  })
})`,
    },
    {
      id: 'ff-fields', label: 'Partial items hold only what was asked', when: { FIELDS: ['partial'] }, characteristic: 'functional-suitability', scope: 'atomic', cadence: 'triggered', trigger: 'pull-request', invocation: 'automated', implements: MAIN, checks: ['req-fields'],
      threshold: 'With fields=status,total,customer.name, every item on every page holds exactly id, status, total and a customer with only its name',
      description: 'An HTTP test reads every page of the orders list with a fields parameter that names two top-level fields and one nested field, and checks the keys of each item.',
      tool: 'Vitest with supertest, through the walk helper in tests/collections',
      language: 'ts',
      snippet: `import { beforeAll, expect, it } from 'vitest'
import { SEEDED, seedOrders, walk } from './collections/fixtures'

beforeAll(() => seedOrders(SEEDED))

it('returns only the named fields and the id, on every page', async () => {
  const items = await walk('/orders', { fields: 'status,total,customer.name' })
  expect(items).toHaveLength(SEEDED)
  for (const item of items) {
    expect(Object.keys(item).sort()).toEqual(['customer', 'id', 'status', 'total'])
    expect(Object.keys(item.customer)).toEqual(['name'])
  }
})`,
    },
    {
      id: 'ff-latency', label: 'Deep pages answered in time', when: PAGED, characteristic: 'performance-efficiency', scope: 'holistic', cadence: 'triggered', trigger: 'nightly', invocation: 'automated', implements: ['adr-cursor', 'adr-offset'], checks: ['req-latency'],
      threshold: 'p95 of http_req_duration for the deep page below {{LIST_P95_MS}} ms over 2 minutes with 10 virtual users',
      description: 'A k6 script run nightly against a test environment with a production-sized collection: its setup finds a page a hundred pages deep by following page tokens (with offsets it takes the largest offset accepted), then ten virtual users request that page for two minutes; the threshold fails the run when the 95th percentile is too slow. Only the deep-page requests are tagged, so the setup does not count.',
      tool: 'k6 (k6 run tests/load/deep-pages.js with BASE_URL and PAGED_BY=token or offset)',
      language: 'js',
      snippet: `import http from 'k6/http'
import { check } from 'k6'

const BASE = __ENV.BASE_URL
const SIZE = {{MAX_PAGE_SIZE}}
export const options = {
  vus: 10,
  duration: '2m',
  thresholds: { 'http_req_duration{page:deep}': ['p(95)<{{LIST_P95_MS}}'] },
}

export function setup() {
  if (__ENV.PAGED_BY === 'offset') return { url: \`\${BASE}/orders?limit=\${SIZE}&offset={{MAX_OFFSET}}\` }
  let query = \`page_size=\${SIZE}\`
  for (let page = 1; page < 100; page++) query = \`page_size=\${SIZE}&page_token=\${http.get(\`\${BASE}/orders?\${query}\`).json('next_page_token')}\`
  return { url: \`\${BASE}/orders?\${query}\` }
}

export default function (data) {
  check(http.get(data.url, { tags: { page: 'deep' } }), { 'deep page served': (r) => r.status === 200 })
}`,
    },
  ],
}

export default pack
