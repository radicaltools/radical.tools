- **The group's technical standards are in the model.** This model
  depends on the model `standards` of the Herba Group
  (`.radical/model/deps.json`); its elements carry an `origin` and are
  read-only. Its ADRs are engineering rules that bind this system from the
  first day. A standard says how a thing must be built once the system
  does it; it asks for no features: build only what the client asks for.
  Read them before you design the system
  (`LIST NODES WHERE type = "adr"`), and before every change read the ones
  the change touches. Do not copy them into this model: link each standard
  to the containers and components of this system it applies to with
  `constrains`.
- **Every standard this system inherits is tested here.** For each
  standard that applies, this model has a fitness function that
  `implements` it, and the fitness function is bound to tests that check
  the standard in every place of the system where it applies (every
  ledger, every kind of balance, every call to a provider, every list,
  every text that must be unique). Bind the tests with
  `npx -y @radicaltools/cli@0.4.0 verify "<fitness function>" --test "<file> › <title>"`.
  A change that adds a new place where a standard applies adds its test
  in the same session, also when the request did not mention the
  standard. Before you finish, go through the standards one by one and
  check that every place each applies has a passing test. A place you
  leave uncovered is not a remark in your final message: record it in the
  model, as a requirement that says what is missing and is linked to the
  component concerned, so that the next session finds it.
