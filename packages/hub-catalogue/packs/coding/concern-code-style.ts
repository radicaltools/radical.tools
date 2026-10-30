import type { PackSpec } from '../../src/packSpec'

const FORMATTERS = ['adr-format-defaults', 'adr-format-matched']
const FORCES = 'Code lives in this element and is read far more often than it is written, by people who did not write it; how it looks decides whether a diff shows what changed in meaning or drowns it in moved braces, and whether review time goes to design or to taste. The forces: a formatter ends the arguments about layout, but every option it offers starts a new argument about the option; adopting or upgrading a formatter rewrites thousands of lines at once and buries who wrote what under one commit; two versions of the same formatter, or a second configuration file in a subfolder, format the same file two ways and every save produces a diff; a published style guide costs nothing to adopt but leaves the team\'s own conventions unwritten, while a guide of the team\'s own grows until nobody reads it; naming rules nobody checks are kept by whoever reviews; and editors that format on save in one way and the commit hook in another fight over every file. Running the formatter on commit and checking it in CI, and the lint rules that find bugs, are the Code quality gate\'s decision; comments and documentation are the Code documentation pack\'s; how errors and logs are written is the Error handling and logging pack\'s; the review itself is the Code review and branching pack\'s.'

const pack: PackSpec = {
  id: 'concern-code-style',
  name: 'Code style and conventions',
  group: 'coding',
  description: 'How the code looks and reads, so that a diff shows only what changed in meaning: which formatter and how far it is configured, which style guide covers what the formatter leaves open, how names are checked, what editors do on save, and how reformatting stays out of git blame. The snippets are for a repository with TypeScript (Prettier or Biome) and Python (Ruff); each tool line names the equivalents for Go, Kotlin, Java and C#.',
  tags: ['maintainability', 'code style', 'formatting', 'style guide', 'naming conventions', 'editorconfig'],
  concern: {
    id: 'code-style',
    trigger: 'LIST NODES WHERE (type = "container" OR type = "webapp") AND external != true',
    why: 'code lives in these elements, so how it is formatted, named and laid out has to be decided; one decision usually covers a whole repository and is bound to every element built from it.',
  },
  sources: [
    { title: 'Prettier: Option Philosophy', url: 'https://prettier.io/docs/option-philosophy' },
    { title: 'Prettier: Configuration File (EditorConfig, how the file is found)', url: 'https://prettier.io/docs/configuration' },
    { title: 'Prettier: Install (an exact version for everyone)', url: 'https://prettier.io/docs/install' },
    { title: 'Biome: Formatter', url: 'https://biomejs.dev/formatter/' },
    { title: 'Ruff: The Ruff Formatter', url: 'https://docs.astral.sh/ruff/formatter/' },
    { title: 'EditorConfig Specification', url: 'https://spec.editorconfig.org/' },
    { title: 'Google Style Guides (TypeScript, Java, Python, Shell and others)', url: 'https://google.github.io/styleguide/' },
    { title: 'PEP 8: Style Guide for Python Code', url: 'https://peps.python.org/pep-0008/' },
    { title: 'Effective Go (not actively updated since 2009; read with Go Code Review Comments)', url: 'https://go.dev/doc/effective_go' },
    { title: 'Go Code Review Comments', url: 'https://go.dev/wiki/CodeReviewComments' },
    { title: 'Kotlin: Coding conventions', url: 'https://kotlinlang.org/docs/coding-conventions.html' },
    { title: 'Microsoft: .NET C# coding conventions', url: 'https://learn.microsoft.com/en-us/dotnet/csharp/fundamentals/coding-style/coding-conventions' },
    { title: 'typescript-eslint: naming-convention', url: 'https://typescript-eslint.io/rules/naming-convention/' },
    { title: 'pre-commit: a framework for managing git hooks', url: 'https://pre-commit.com/' },
    { title: 'GitHub Docs: Ignore commits in the blame view', url: 'https://docs.github.com/en/repositories/working-with-files/using-files/viewing-and-understanding-files' },
    { title: 'Git: git-blame (blame.ignoreRevsFile)', url: 'https://git-scm.com/docs/git-blame' },
  ],
  questions: [
    {
      key: 'FORMATTER', title: 'Formatter', label: 'How far is the formatter configured?',
      hint: 'That a formatter runs on commit and in CI is decided in the Code quality gate pack; this decides which formatter each language gets and how many of its options the team sets. Every option is a style argument the formatter was meant to end.',
      default: 'defaults',
      options: [
        { value: 'defaults', label: 'an opinionated formatter on its defaults', description: 'One opinionated formatter per language, configured no further than the minimum (by default one option, the line width): Prettier or Biome for TypeScript and JavaScript, Ruff format or Black for Python, gofmt, ktlint, google-java-format, dotnet format. The whole tree is reformatted once in a commit hidden from blame. Pick it for new code, and for existing code whenever one reformatting commit is affordable.' },
        { value: 'matched', label: 'a formatter configured to match the existing code', description: 'The same formatters, with the options set so that the existing code changes as little as possible (quote style, indentation, line width), each option kept with a comment naming the convention it preserves. Pick it for a large existing codebase with many long-lived branches, where reformatting every line would conflict with all of them, or where a published convention the code follows (a framework\'s, a customer\'s) differs from the tool\'s defaults.' },
      ],
    },
    {
      key: 'GUIDE', title: 'Style guide', label: 'Which style guide covers what the formatter leaves open?',
      hint: 'A formatter decides layout; naming, file organisation, imports and idioms still need a written rule. A published guide is free and well argued; a guide of your own fits the team but has to be kept short to be read.',
      default: 'published',
      options: [
        { value: 'published', label: 'the published guide of each language', description: 'Each language follows its published guide as it is: PEP 8 for Python, the Google TypeScript and Java Style Guides, the Kotlin coding conventions, Effective Go with Go Code Review Comments, the Microsoft C# coding conventions; CONTRIBUTING.md links them and the team amends none. Pick it by default, and whenever nobody on the team wants to maintain a guide.' },
        { value: 'own', label: 'our own short guide built on a published one', description: 'A short guide of the team\'s own in docs/STYLE.md (30 rules at most by default), each rule naming the published rule it adopts or changes and whether a lint rule or the reviewer checks it. Pick it when the team has conventions no published guide covers (domain terms in names, module layout, test naming), or several languages need one voice.' },
      ],
    },
    {
      key: 'NAMING', title: 'Naming', label: 'How are the naming rules checked?',
      hint: 'Names carry most of what a reader learns from code. A naming rule the linter checks is never argued about in review; one that only the reviewer checks depends on who reviews.',
      default: 'linted',
      options: [
        { value: 'linted', label: 'lint rules at error severity', description: 'The guide\'s naming rules are lint rules at error severity: typescript-eslint naming-convention, Ruff\'s pep8-naming rules (N801 class names, N802 function names, N803 arguments, N806 variables), ktlint\'s class-, function- and property-naming, IDE1006 for C#, staticcheck ST1003 for Go. Pick it by default.' },
        { value: 'written', label: 'written rules checked in review', description: 'The naming rules are written in the guide with an example of a right and a wrong name for each kind of identifier, and the reviewer checks them. Pick it when the linter of a language has no naming rule that expresses the convention (domain terms, abbreviations), or for short-lived code.' },
      ],
    },
    {
      key: 'EDITOR', title: 'Editors', label: 'How do editors follow the style?',
      hint: 'An editor that formats on save in the project\'s way keeps the commit hook from ever changing anything; an editor left to each developer is their own business, and the hook catches what it misses.',
      default: 'shared',
      options: [
        { value: 'shared', label: 'committed editor settings with format on save', description: 'Besides .editorconfig, the repository commits .vscode/settings.json (format on save, the project\'s formatter per language) and .vscode/extensions.json recommending the formatter\'s extension, which uses the project\'s own formatter version. Pick it when most of the team uses VS Code or an editor that reads its settings, and new people should be set up by opening the folder.' },
        { value: 'editorconfig', label: '.editorconfig alone', description: 'Only .editorconfig is shared (charset, line endings, indentation, final newline, line width); no editor-specific settings are committed, and each developer configures format on save in their own editor. Pick it when the team uses many different editors, or settings in the repository have caused conflicts.' },
      ],
    },
  ],
  details: [
    { key: 'LINE_WIDTH', label: 'Which line width do the formatters and .editorconfig share (characters)?', default: '100', number: true },
    { key: 'MAX_FORMAT_OPTIONS', label: 'How many formatting options may a formatter\'s configuration set at most? (an opinionated formatter on its defaults only)', default: '1', number: true },
    { key: 'MAX_GUIDE_RULES', label: 'How many rules may our own style guide hold at most? (our own guide only)', default: '30', number: true },
    { key: 'BLAME_DAYS', label: 'Within how many days must a reformatting commit be listed in .git-blame-ignore-revs?', default: '2', number: true },
  ],
  need: {
    label: 'A diff shows only what changed in meaning',
    text: 'The element is read and changed by many people over years. Its code has to look the same whoever wrote it, so that a diff shows what changed in meaning and nothing else, a reviewer spends no time on layout or taste, a name tells the reader what a thing is, and git blame leads to the change that gave a line its meaning, not to the commit that reformatted it. The snippets assume the formatter settings at the repository root (.editorconfig, .prettierrc.json or biome.json, pyproject.toml with Ruff pinned among the development dependencies, .pre-commit-config.yaml where the Python hook comes from pre-commit), CONTRIBUTING.md at the root, the team\'s own guide, if there is one, in docs/STYLE.md, and GitHub Actions as CI.',
  },
  forces: FORCES,
  requirements: [
    {
      id: 'req-one-config', label: 'Formatter settings in one place', ears_type: 'ubiquitous',
      action: 'keep the settings of each language\'s formatter in one configuration file at the repository root, with 0 nested formatter configuration files and 0 formatting options passed on a command line, so that a file is formatted the same wherever it lies and whoever runs the formatter',
      rationale: 'Prettier looks for its configuration from the formatted file upwards, so a .prettierrc in a subfolder silently formats that folder differently, and an option on a command line applies only where that command runs (Prettier, Configuration File).',
      scenario: { label: 'Second configuration refused', given: 'the repository with its formatter settings at the root', when: 'a pull request adds a .prettierrc.json under src/legacy, and another adds --print-width 120 to the format script', then: 'the check fails on both, naming the file and the line' },
    },
    {
      id: 'req-same-version', label: 'One formatter version everywhere', ears_type: 'ubiquitous',
      action: 'run each formatter in one exact version pinned in the repository (Prettier or Biome without a range in package.json, ruff==x.y.z among the Python development dependencies), with the commit hook and the editor using that same version, so that 0 files change when another machine runs the formatter',
      rationale: 'Even a patch release of Prettier can format differently, which is why Prettier and Biome both install with an exact version (Prettier, Install); pre-commit installs a hook\'s own copy at the rev in .pre-commit-config.yaml, which drifts from the project\'s version unless it is kept equal (pre-commit).',
      scenario: { label: 'Version drift refused', given: 'package.json with "prettier": "^3.6.0", and a pre-commit rev of ruff one release behind the version pyproject.toml pins', when: 'the check runs', then: 'it fails on both, naming the version to pin' },
    },
    {
      id: 'req-blame-ignore', label: 'Reformatting hidden from blame', ears_type: 'event-driven',
      trigger: 'a commit that changes a formatter\'s settings or version, with the reformatting it causes, reaches the main branch',
      action: 'list its full SHA, under a comment saying what it changed, in .git-blame-ignore-revs at the repository root within {{BLAME_DAYS}} days, so that git blame with blame.ignoreRevsFile set and the forge\'s blame view skip it',
      rationale: 'A reformatting commit touches thousands of lines and hides who changed each one and why; GitHub\'s blame view skips the commits listed in .git-blame-ignore-revs at the root (GitHub Docs, Ignore commits in the blame view), and git blame does the same with blame.ignoreRevsFile, one unabbreviated object name per line (git-blame).',
      scenario: { label: 'Unlisted reformat flagged', given: 'a commit on main that raised the Prettier version and reformatted 40 files', when: 'the daily check runs {{BLAME_DAYS}} days later and the SHA is not in .git-blame-ignore-revs', then: 'the check fails naming the commit; once the SHA is listed it passes and git blame skips the commit' },
    },
    {
      id: 'req-editorconfig', label: 'Editors follow one .editorconfig', ears_type: 'ubiquitous',
      action: 'keep a root .editorconfig (root = true) whose [*] section sets charset utf-8, end_of_line lf, insert_final_newline true, trim_trailing_whitespace true and max_line_length {{LINE_WIDTH}}, with indentation per file type, agreeing with every formatter setting it overlaps, and keep 0 tracked text files that break it',
      rationale: 'EditorConfig makes every editor, and the files no formatter covers (shell scripts, Makefiles, Dockerfiles), follow the same basic style (EditorConfig Specification); Prettier reads indentation, line endings and line width from it, so setting them once there leaves no second value to drift (Prettier, Configuration File).',
      scenario: { label: 'File breaking .editorconfig refused', given: 'the root .editorconfig and pyproject.toml', when: 'a pull request adds a shell script with CRLF line endings, and another sets Ruff\'s line-length to 120 while .editorconfig says {{LINE_WIDTH}}', then: 'the first fails the .editorconfig check naming the file, and the second fails the consistency check naming both values' },
    },
    {
      id: 'req-defaults', label: 'Formatters on their defaults', when: { FORMATTER: ['defaults'] }, ears_type: 'ubiquitous',
      action: 'format each language with its opinionated formatter on its defaults, with no more than {{MAX_FORMAT_OPTIONS}} formatting options set in each formatter\'s configuration file, besides the files it ignores and the settings it reads from .editorconfig',
      rationale: 'The point of a formatter is to end the debates over style; with options, they become debates over which options to use, which is why Prettier accepts no new ones and Biome deliberately resists them (Prettier, Option Philosophy; Biome, Formatter); Effective Go lets the machine take care of formatting for the same reason.',
      scenario: { label: 'Extra option refused', given: 'a .prettierrc.json that sets only the line width', when: 'a pull request adds "singleQuote": true to it', then: 'the check fails: the file now sets more than {{MAX_FORMAT_OPTIONS}} options' },
    },
    {
      id: 'req-matched', label: 'Every option says what it keeps', when: { FORMATTER: ['matched'] }, ears_type: 'ubiquitous',
      action: 'set only the formatter options needed to keep a convention the existing code already follows, each preceded in its configuration file by a comment naming that convention, and change an option only in a pull request that reformats the whole tree with it',
      rationale: 'An option without a reason is the next style debate waiting to happen (Prettier, Option Philosophy); the comment keeps the reason next to the option, so that when the convention no longer matters the option can go (Ruff, The Ruff Formatter, exposes only a few options beyond Black\'s, such as quote style, indent style and line endings).',
      scenario: { label: 'Unexplained option refused', given: 'a .prettierrc.yaml whose options each follow a comment naming the convention', when: 'a pull request adds tabWidth: 4 without a comment above it', then: 'the check fails naming the line' },
    },
    {
      id: 'req-guide-published', label: 'Published guides, unamended', when: { GUIDE: ['published'] }, ears_type: 'ubiquitous',
      action: 'follow, for each language in the element, the published style guide the decision names, linked from CONTRIBUTING.md, with 0 local amendments; a rule the team wants changed supersedes the decision',
      rationale: 'A published guide comes with its reasons already argued (PEP 8; Google Style Guides; Kotlin, Coding conventions; Go Code Review Comments; Microsoft, C# coding conventions); amendments made one review at a time turn it into an unwritten guide of the team\'s own.',
      scenario: { label: 'Missing guide link refused', given: 'a repository with TypeScript and Python files', when: 'CONTRIBUTING.md links only PEP 8, and a pull request adds docs/STYLE.md', then: 'the check fails naming the missing Google TypeScript Style Guide link and the amending file' },
    },
    {
      id: 'req-guide-own', label: 'Our guide stays short and sourced', when: { GUIDE: ['own'] }, ears_type: 'ubiquitous',
      action: 'keep the team\'s style guide in docs/STYLE.md, linked from CONTRIBUTING.md, with at most {{MAX_GUIDE_RULES}} rules, each naming the published guide and section it adopts or changes and whether a lint rule (by its id) or the reviewer checks it',
      rationale: 'A guide of the team\'s own is read only while it is short, and trusted only where each rule says where it comes from (PEP 8: a style guide is about consistency; Google Style Guides); a rule that says who checks it is not left to whoever happens to review.',
      scenario: { label: 'Guide kept short', given: 'docs/STYLE.md with {{MAX_GUIDE_RULES}} rules', when: 'a pull request adds one more rule, and another adds a rule without a Checked by line', then: 'both fail the check, naming the count and the rule' },
    },
    {
      id: 'req-naming-linted', label: 'Names checked by the linter', when: { NAMING: ['linted'] }, ears_type: 'ubiquitous',
      action: 'check the guide\'s naming rules with the linter at error severity (typescript-eslint naming-convention; Ruff\'s pep8-naming N rules; ktlint\'s class-, function- and property-naming; IDE1006 at error in .editorconfig for C#; staticcheck ST1003 for Go), so that a name that breaks them fails the commit hook and CI',
      rationale: 'A naming rule the linter checks is applied the same way to every change and never argued about in review (typescript-eslint, naming-convention; PEP 8, Naming Conventions); at warning severity it is ignored.',
      scenario: { label: 'Wrong name refused', given: 'the linter configuration', when: 'a pull request adds a TypeScript class named order_service and a Python function named GetOrder', then: 'the linter reports both at error severity and the check fails' },
    },
    {
      id: 'req-naming-reviewed', label: 'Names checked in review', when: { NAMING: ['written'] }, ears_type: 'ubiquitous',
      action: 'write the naming rules in the style guide with an example of a right and a wrong name for each kind of identifier (type, function, variable, constant, file), and check the names of every change against them in review',
      rationale: 'Where no lint rule can express a convention (domain terms, abbreviations), the written rule and its examples are what the reviewer checks against (PEP 8, Naming Conventions; Kotlin, Coding conventions: naming rules).',
      scenario: { label: 'Reviewer checks names', given: 'the naming rules in the guide', when: 'a pull request adds a function whose name breaks one of them', then: 'the reviewer asks for the name to be changed, citing the rule, before approving' },
      unchecked: 'The reviewer, in every pull request review, against the naming rules of the guide; no lint rule checks them in this variant.',
    },
    {
      id: 'req-editor-shared', label: 'Editors format on save', when: { EDITOR: ['shared'] }, ears_type: 'ubiquitous',
      action: 'commit editor settings that format every file on save with the project\'s own formatter: .vscode/settings.json with editor.formatOnSave true and a default formatter for each language in the repository, and .vscode/extensions.json recommending that formatter\'s extension',
      rationale: 'Code formatted while it is written never reaches the commit hook unformatted; an editor that formats with the project\'s own pinned version formats as CI does, which is why everyone has to get the exact same version (Prettier, Install).',
      scenario: { label: 'Settings shared', given: 'a repository with TypeScript and Python files', when: 'the check reads the committed editor settings', then: 'format on save is on, both languages have a default formatter, and each formatter\'s extension is recommended' },
    },
    {
      id: 'req-editor-own', label: 'Only .editorconfig shared', when: { EDITOR: ['editorconfig'] }, ears_type: 'ubiquitous',
      action: 'commit no editor-specific settings (.vscode/settings.json, .idea/, *.code-workspace, .zed/, .fleet/), so that .editorconfig is the only editor configuration in the repository and each developer\'s own editor settings stay theirs',
      rationale: 'Settings of one editor committed for everyone conflict with the settings of the others and change with every personal preference; .editorconfig is read by most editors and carries what they must agree on (EditorConfig Specification).',
      scenario: { label: 'Editor settings stay out', given: 'the repository', when: 'a pull request adds .vscode/settings.json', then: 'the check fails naming the file' },
    },
  ],
  adrs: [
    {
      id: 'adr-format-defaults', label: 'Opinionated formatters on their defaults', when: { FORMATTER: ['defaults'] },
      decision: 'Each language is formatted by its opinionated formatter on its defaults: Prettier for TypeScript, JavaScript, JSON, CSS and Markdown (or Biome, which formats and lints in one tool), Ruff format for Python (Black-compatible; Black where Ruff is not used), gofmt for Go, ktlint with the ktlint_official code style for Kotlin, google-java-format for Java, dotnet format for C#. A formatter\'s configuration file sets no more than {{MAX_FORMAT_OPTIONS}} formatting options besides the files it ignores; the line width ({{LINE_WIDTH}}), indentation and line endings are set once in the root .editorconfig, which Prettier, ktlint and dotnet format read, and Ruff\'s line-length is set to the same value. Each formatter is pinned to one exact version, used alike by the commit hook, CI and the editor. Adopting the formatter, upgrading it or changing an option is a pull request of its own that reformats the whole tree and changes nothing else, and its commit is listed in .git-blame-ignore-revs. That the formatter runs on commit and is checked in CI is the Code quality gate\'s decision. Style guide: {{GUIDE}}. Naming: {{NAMING}}. Editors: {{EDITOR}}.',
      consequences: '• Layout is never discussed in review again; every file looks the same whoever wrote it.\n• The first adoption reformats most lines at once: every open branch conflicts and has to be rebased with the formatter run on it, and blame needs the ignore file to stay useful.\n• Some defaults will annoy someone (Prettier\'s 80 columns, Biome\'s tabs); the decision accepts that, and the line width is the one setting the team chose.\n• A formatter upgrade can change hundreds of lines; with an exact pin it arrives as one reviewed, blame-ignored pull request instead of noise in unrelated changes.\n• The exact pin of the formatter is an exception to any range policy for dependencies, which the formatters\' own install guides ask for.',
      alternatives: '1. A formatter configured to match the existing code: fewer lines change at adoption, but every option is a style argument kept alive and a setting to maintain.\n2. No formatter, style left to the reviewer: no adoption cost, and a style comment in every review for as long as the code lives.\n3. A different formatter per team or folder: each team gets its taste, and every cross-team change reformats the files it touches.',
    },
    {
      id: 'adr-format-matched', label: 'Formatters configured to match the existing code', when: { FORMATTER: ['matched'] },
      decision: 'Each language is formatted by one formatter (Prettier or Biome, Ruff format, gofmt, ktlint, google-java-format, dotnet format), configured so that the existing code changes as little as possible: an option is set only to keep a convention the code already follows (quote style, indentation, trailing commas, the line width of {{LINE_WIDTH}}), and each is preceded by a comment naming that convention, so the settings live in files that hold comments (.prettierrc.yaml, pyproject.toml, .editorconfig). Formatters without options (gofmt, google-java-format) run on their defaults. Each formatter is pinned to one exact version, used alike by the commit hook, CI and the editor. Changing an option, or upgrading a formatter, is a pull request of its own that reformats the whole tree, and its commit is listed in .git-blame-ignore-revs. That the formatter runs on commit and is checked in CI is the Code quality gate\'s decision. Style guide: {{GUIDE}}. Naming: {{NAMING}}. Editors: {{EDITOR}}.',
      consequences: '• Adoption changes few lines, so long-lived branches keep merging and blame stays mostly intact.\n• Every option is a style choice the team made and may argue about again; the comment on each says why it is there and when it could go.\n• Options interact with formatter upgrades: a new release may treat an option differently, and the configuration needs reading at each major version.\n• Code copied from elsewhere, or from tools that write code (generators, assistants), arrives in the formatter\'s defaults and is reformatted on commit.\n• The exact pin of the formatter is an exception to any range policy for dependencies, which the formatters\' own install guides ask for.',
      alternatives: '1. An opinionated formatter on its defaults: nothing to argue about or maintain, at the cost of one large reformatting commit.\n2. Formatting only the files a change touches: no big commit, but the code stays in two styles for years and every touched file shows unrelated reformatting in its diff.\n3. No formatter: no adoption cost, and layout argued in every review.',
    },
    {
      id: 'adr-guide-published', label: 'Published style guides, as they are', when: { GUIDE: ['published'] },
      decision: 'What the formatter leaves open (naming, imports, file and module organisation, idioms) follows each language\'s published guide as it is: PEP 8 for Python, the Google TypeScript Style Guide for TypeScript and JavaScript, the Google Java Style Guide for Java, the Kotlin coding conventions for Kotlin, Effective Go read with Go Code Review Comments for Go (Effective Go is not updated for generics or modules), and the Microsoft C# coding conventions for C#. CONTRIBUTING.md links the guide of every language in the repository; the team amends none of them, and a rule it wants to change supersedes this decision. The Airbnb JavaScript Style Guide is not used: its ESLint preset does not support ESLint 9 and its flat configuration.',
      consequences: '• No guide to write or maintain; newcomers know the rules from other projects, and every rule comes with its reasons.\n• Where the guide and the formatter disagree on layout, the formatter wins; the guide matters for everything else.\n• Conventions of the team\'s own (domain terms, module layout) stay unwritten unless they become a decision.\n• A guide that changes upstream changes the team\'s rules without a pull request; the links point at the current version.',
      alternatives: '1. Our own short guide built on a published one: covers the team\'s conventions, and has to be kept short and current.\n2. No guide: every reviewer applies their own, and the same change gets different comments from different people.\n3. The Airbnb JavaScript Style Guide: widely known, but its lint preset has not followed ESLint into flat configuration.',
    },
    {
      id: 'adr-guide-own', label: 'Our own short style guide', when: { GUIDE: ['own'] },
      decision: 'What the formatter leaves open follows the team\'s own guide in docs/STYLE.md, linked from CONTRIBUTING.md and built on the published guide of each language (PEP 8, the Google TypeScript and Java Style Guides, the Kotlin coding conventions, Effective Go with Go Code Review Comments, the Microsoft C# coding conventions). The guide holds at most {{MAX_GUIDE_RULES}} rules; each is a heading "### S<n>. <rule>" followed by a "Based on:" line naming the published guide and section it adopts or changes, and a "Checked by:" line naming the lint rule by its id, or "review". Whatever the guide does not say, the published guide decides. A rule is added or changed by a pull request to the guide, reviewed like code.',
      consequences: '• The team\'s own conventions (domain terms in names, module layout, test naming) are written down and checked, not remembered.\n• The guide is short enough to be read in one sitting, and each rule says where it comes from and who checks it.\n• Someone has to keep the guide current; past {{MAX_GUIDE_RULES}} rules, adding one means removing or merging another.\n• Rules checked by review only depend on who reviews; the "Checked by" line makes that visible, and moving a rule to a lint rule is the way out.',
      alternatives: '1. The published guide of each language, as it is: nothing to write, and the team\'s own conventions stay unwritten.\n2. A long guide covering everything: complete on the day it is written, unread a month later.\n3. Conventions kept only in lint configuration: checked, but without the reasons a reader needs.',
    },
  ],
  fitness: [
    {
      id: 'ff-one-config', label: 'One formatter configuration, at the root', characteristic: 'maintainability', scope: 'atomic', cadence: 'triggered', trigger: 'pull-request', invocation: 'automated', implements: FORMATTERS, checks: ['req-one-config'],
      threshold: '0 formatter configuration files below the repository root and 0 formatting options on a formatter\'s command line in package.json, Makefile, shell scripts, workflows and .pre-commit-config.yaml',
      description: 'A CI step lists the tracked formatter configuration files outside the root (Prettier, Biome, Ruff, .editorconfig, a [tool.ruff] table in a nested pyproject.toml) and greps the places that run a formatter for formatting flags; either fails the step. A monorepo that needs a package of its own configuration lists it here as an exception, in the same pull request.',
      tool: 'git ls-files and git grep in a CI step (the same over build.gradle.kts for ktlint and Spotless, or Directory.Build.props for dotnet format)',
      language: 'bash',
      snippet: `#!/usr/bin/env bash
# CI step: each formatter's settings live in one file at the repository root
set -euo pipefail
nested=$(git ls-files -- '*/.prettierrc*' '*/prettier.config.*' '*/biome.json' '*/biome.jsonc' '*/ruff.toml' '*/.ruff.toml' '*/.editorconfig'
  git grep -l -e '^\\[tool\\.ruff' -- '*/pyproject.toml' || true)
[ -z "$nested" ] || { echo "formatter settings below the root; move them to the root file:"; echo "$nested"; exit 1; }
flags=$(git grep -nE -e '(prettier|biome format|ruff format|black)[^|;&]*--(print-width|tab-width|use-tabs|single-quote|no-semi|trailing-comma|line-width|indent-width|indent-style|line-length|skip-string-normalization)' \\
  -- package.json Makefile '*.sh' '.github/workflows/*' .pre-commit-config.yaml || true)
[ -z "$flags" ] || { echo "formatting options on a command line; put them in the root file:"; echo "$flags"; exit 1; }
echo "formatter settings: one file per language, at the root"`,
    },
    {
      id: 'ff-version-match', label: 'One exact formatter version', characteristic: 'maintainability', scope: 'atomic', cadence: 'triggered', trigger: 'pull-request', invocation: 'automated', implements: FORMATTERS, checks: ['req-same-version'],
      threshold: 'Prettier and Biome pinned without a range in package.json; the ruff-pre-commit rev equal to the ruff==x.y.z pinned in pyproject.toml; the step fails on any difference',
      description: 'A CI step reads the formatter versions from package.json and compares the rev of the ruff-pre-commit hook with the version pyproject.toml pins. On the Node side the hook (lint-staged) and the editor (the Prettier and Biome extensions use the project\'s installed copy first) run the version in node_modules, so an exact pin is enough; on the Python side pre-commit installs a copy of its own, which this keeps equal, and the Ruff extension finds Ruff in the environment first (ruff.importStrategy fromEnvironment, its default).',
      tool: 'jq, grep and sed in a CI step (for Kotlin and Java: the ktlint or Spotless version in libs.versions.toml; for C#: the SDK version in global.json)',
      language: 'bash',
      snippet: `#!/usr/bin/env bash
# CI step: one exact formatter version, for the commit hook, CI and the editor alike
set -euo pipefail
fail=0
for tool in prettier @biomejs/biome; do
  v=$(jq -r --arg t "$tool" '(.devDependencies // {})[$t] // empty' package.json 2>/dev/null || true)
  [ -z "$v" ] || [[ "$v" =~ ^[0-9]+\\.[0-9]+\\.[0-9]+$ ]] || { echo "package.json: $tool is $v; pin it exactly (npm i -D -E $tool)"; fail=1; }
done
if [ -f .pre-commit-config.yaml ] && grep -q 'astral-sh/ruff-pre-commit' .pre-commit-config.yaml; then
  hook=$(grep -A2 'astral-sh/ruff-pre-commit' .pre-commit-config.yaml | sed -n 's/^ *rev: *v\\{0,1\\}\\([0-9.]*\\).*/\\1/p')
  pinned=$(grep -oE '"ruff==[0-9.]+"' pyproject.toml | grep -oE '[0-9.]*[0-9]' || true)
  [ "$hook" = "$pinned" ] || { echo "pre-commit runs ruff $hook, pyproject.toml pins ruff==$pinned; make them equal"; fail=1; }
fi
exit $fail`,
    },
    {
      id: 'ff-blame-ignore', label: 'Reformatting commits listed for blame', characteristic: 'maintainability', scope: 'atomic', cadence: 'triggered', trigger: 'nightly', invocation: 'automated', implements: FORMATTERS, checks: ['req-blame-ignore'],
      threshold: '0 commits older than {{BLAME_DAYS}} days that changed a formatter\'s settings or version and are missing from .git-blame-ignore-revs; younger ones are reported as warnings',
      description: 'A daily job on main lists every commit whose diff changes a formatter version or a formatting setting in package.json, pyproject.toml, the formatter configuration or .editorconfig, and looks for its full SHA in .git-blame-ignore-revs. Listing a version bump that reformatted nothing is harmless: blame skips only the lines that commit changed. Each developer runs git config blame.ignoreRevsFile .git-blame-ignore-revs once (or the repository\'s setup script does); GitHub reads the file by itself.',
      tool: 'git log -G in a scheduled GitHub Actions job (actions/checkout with fetch-depth: 0)',
      language: 'bash',
      snippet: `#!/usr/bin/env bash
# run daily on main by .github/workflows/blame-ignore.yml (actions/checkout with fetch-depth: 0)
set -euo pipefail
# changed lines that mean "a formatter's settings or version changed"
SETTINGS='"(prettier|@biomejs/biome)": "|ruff==|black==|printWidth|tabWidth|useTabs|lineWidth|indentWidth|indentStyle|line-length|quote-style|indent-style|indent_size|indent_style|max_line_length'
cutoff=$(( $(date +%s) - {{BLAME_DAYS}} * 86400 ))
late=0
while read -r sha committed; do
  grep -qx "$sha" .git-blame-ignore-revs 2>/dev/null && continue
  if [ "$committed" -lt "$cutoff" ]; then
    echo "::error::$sha changed a formatter's settings or version and is not in .git-blame-ignore-revs"; late=1
  else
    echo "::warning::$sha changed a formatter's settings or version; list it in .git-blame-ignore-revs"
  fi
done < <(git log --format='%H %ct' -G "$SETTINGS" HEAD -- package.json pyproject.toml .prettierrc.json .prettierrc.yaml biome.json .editorconfig)
exit $late`,
    },
    {
      id: 'ff-editorconfig', label: 'Every file follows .editorconfig', characteristic: 'maintainability', scope: 'atomic', cadence: 'triggered', trigger: 'pull-request', invocation: 'automated', implements: FORMATTERS, checks: ['req-editorconfig'],
      threshold: '0 tracked text files that break the root .editorconfig (charset, line endings, final newline, trailing whitespace, indentation); line length is left to the formatters',
      description: 'The root .editorconfig carries what every editor and every file must agree on; editorconfig-checker runs over the tracked files on every pull request and fails on any file that breaks it, which covers the files no formatter touches. Its line-length check is off, because the formatters decide where lines break and leave long strings and URLs whole.',
      tool: 'editorconfig-checker (npm package editorconfig-checker, or its Docker image) in a CI step',
      language: 'ini',
      snippet: `# .editorconfig, at the repository root
root = true

[*]
charset = utf-8
end_of_line = lf
insert_final_newline = true
trim_trailing_whitespace = true
indent_style = space
indent_size = 2
max_line_length = {{LINE_WIDTH}}

[*.py]
indent_size = 4

[{*.go,Makefile}]
indent_style = tab

[*.md]
trim_trailing_whitespace = false

# CI step: npx --yes editorconfig-checker@7.0.0 -format github-actions -disable-max-line-length`,
    },
    {
      id: 'ff-editorconfig-consistent', label: '.editorconfig agrees with the formatters', characteristic: 'maintainability', scope: 'atomic', cadence: 'triggered', trigger: 'pull-request', invocation: 'automated', implements: FORMATTERS, checks: ['req-editorconfig'],
      threshold: '.editorconfig has root = true and its [*] section sets charset utf-8, end_of_line lf, insert_final_newline, trim_trailing_whitespace and max_line_length {{LINE_WIDTH}}; .prettierrc.json sets none of printWidth, tabWidth, useTabs, endOfLine; Ruff\'s line-length equals the .editorconfig width for Python',
      description: 'A script reads .editorconfig (with a section added for its preamble, so Python\'s configparser accepts it), checks the [*] section, refuses Prettier settings that .editorconfig already carries (Prettier reads them from it, so a second value could only disagree), and compares Ruff\'s line-length, which does not read .editorconfig, with the width set for Python files. For ktlint and dotnet format nothing needs comparing: they read their settings from .editorconfig itself.',
      tool: 'Python 3.11 or later (configparser, tomllib) in a CI step',
      language: 'python',
      snippet: `# scripts/check_editorconfig.py (CI: python3 scripts/check_editorconfig.py): .editorconfig and the formatters agree
import configparser, json, pathlib, sys, tomllib

ec = configparser.ConfigParser(interpolation=None)
ec.read_string("[preamble]\\n" + pathlib.Path(".editorconfig").read_text())
star = ec["*"] if ec.has_section("*") else {}
problems = [] if ec.get("preamble", "root", fallback="") == "true" else [".editorconfig: no root = true before the first section"]
for key, value in {"charset": "utf-8", "end_of_line": "lf", "insert_final_newline": "true", "trim_trailing_whitespace": "true", "max_line_length": "{{LINE_WIDTH}}"}.items():
    if star.get(key) != value:
        problems.append(f".editorconfig [*]: {key} is {star.get(key)}, should be {value}")
prettier = pathlib.Path(".prettierrc.json")
for key in json.loads(prettier.read_text()) if prettier.exists() else []:
    if key in ("printWidth", "tabWidth", "useTabs", "endOfLine"):
        problems.append(f".prettierrc.json sets {key}; set it once in .editorconfig, which Prettier reads")
pyproject = pathlib.Path("pyproject.toml")
ruff = tomllib.loads(pyproject.read_text()).get("tool", {}).get("ruff", {}) if pyproject.exists() else {}
py_width = ec.get("*.py", "max_line_length", fallback=star.get("max_line_length"))
if ruff and str(ruff.get("line-length", 88)) != py_width:
    problems.append(f"pyproject.toml [tool.ruff] line-length is {ruff.get('line-length', 88)}, .editorconfig says {py_width} for *.py")
print("\\n".join(problems) or ".editorconfig agrees with the formatters")
sys.exit(1 if problems else 0)`,
    },
    {
      id: 'ff-minimal-config', label: 'Formatters stay on their defaults', when: { FORMATTER: ['defaults'] }, characteristic: 'maintainability', scope: 'atomic', cadence: 'triggered', trigger: 'pull-request', invocation: 'automated', implements: ['adr-format-defaults'], checks: ['req-defaults'],
      threshold: 'At most {{MAX_FORMAT_OPTIONS}} formatting options in .prettierrc.json (overrides included), in biome.json\'s formatter sections, and in pyproject.toml\'s [tool.ruff] line-length and [tool.ruff.format]; the step fails above it',
      description: 'A CI step counts the formatting options each configuration file sets, leaving out what is not a style choice ($schema, enabled, the files a formatter includes or ignores), and fails when one sets more than the decision allows. Settings read from .editorconfig are not counted: they are the shared ones. For ktlint the same count applies to the ktlint_ properties in .editorconfig; gofmt and google-java-format have no options to count.',
      tool: 'jq and Python (tomllib) in a CI step',
      language: 'bash',
      snippet: `#!/usr/bin/env bash
# CI step: each formatter runs on its defaults
set -euo pipefail
MAX={{MAX_FORMAT_OPTIONS}}
fail=0
check() { echo "$2: $1 formatting option(s)"; [ "$1" -le "$MAX" ] || { echo "  more than $MAX: remove options or supersede the decision"; fail=1; }; }
[ ! -f .prettierrc.json ] || check "$(jq '(del(."$schema", .overrides) | length) + ([.overrides[]?.options | length] | add // 0)' .prettierrc.json)" .prettierrc.json
[ ! -f biome.json ] || check "$(jq '[(.formatter // {} | del(.enabled, .includes)), .javascript.formatter, .json.formatter, .css.formatter] | map(. // {} | length) | add' biome.json)" biome.json
[ ! -f pyproject.toml ] || check "$(python3 -c 'import tomllib; r = tomllib.load(open("pyproject.toml", "rb")).get("tool", {}).get("ruff", {}); print(len(r.get("format", {})) + ("line-length" in r))')" "pyproject.toml [tool.ruff]"
exit $fail`,
    },
    {
      id: 'ff-option-reasons', label: 'Every formatter option has its reason', when: { FORMATTER: ['matched'] }, characteristic: 'maintainability', scope: 'atomic', cadence: 'triggered', trigger: 'pull-request', invocation: 'automated', implements: ['adr-format-matched'], checks: ['req-matched'],
      threshold: '0 formatter options in .prettierrc.yaml, pyproject.toml\'s [tool.ruff] line-length and [tool.ruff.format], and the [*.{kt,kts}] ktlint properties of .editorconfig without a comment on the line above',
      description: 'A CI step walks the formatter configuration files and fails on an option whose line above is not a comment; the comment names the convention of the existing code that the option keeps. A pull request that changes an option is also a reformat of the whole tree, which the Code quality gate\'s formatter check over the whole tree enforces.',
      tool: 'awk in a CI step',
      language: 'bash',
      snippet: `#!/usr/bin/env bash
# CI step: every formatter option is preceded by a comment naming the convention it keeps
set -euo pipefail
status=0
reasons() {   # file, the section whose options need a reason ('' = the whole file), the option names to check
  awk -v f="$1" -v section="$2" -v keys="$3" '
    /^\\[/ { inside = ($0 == section) }
    (section == "" || inside) && $0 ~ ("^(" keys ")[ ]*[:=]") && prev !~ /^[ ]*#/ { print f ":" NR ": " $1 " has no comment above it naming the convention it keeps"; bad = 1 }
    { prev = $0 }
    END { exit bad }' "$1" || status=1
}
[ ! -f .prettierrc.yaml ] || reasons .prettierrc.yaml '' '[A-Za-z]+'
[ ! -f pyproject.toml ] || reasons pyproject.toml '[tool.ruff]' 'line-length|indent-width'
[ ! -f pyproject.toml ] || reasons pyproject.toml '[tool.ruff.format]' '[a-z-]+'
[ ! -f .editorconfig ] || reasons .editorconfig '[*.{kt,kts}]' 'ktlint_[a-z_-]+'
exit $status`,
    },
    {
      id: 'ff-guide-linked', label: 'Published guides linked, none amended', when: { GUIDE: ['published'] }, characteristic: 'maintainability', scope: 'atomic', cadence: 'triggered', trigger: 'pull-request', invocation: 'automated', implements: ['adr-guide-published'], checks: ['req-guide-published'],
      threshold: 'CONTRIBUTING.md links the published guide of every language with tracked files in the repository, and no docs/STYLE.md exists',
      description: 'A CI step looks for the files of each language, expects the link to its guide in CONTRIBUTING.md, and fails when a guide of the team\'s own appears, which would amend the published ones without a decision. For Go the link is Go Code Review Comments, the maintained companion of Effective Go.',
      tool: 'git ls-files and grep in a CI step',
      language: 'bash',
      snippet: `#!/usr/bin/env bash
# CI step: CONTRIBUTING.md links the published guide of every language in the repository, and nothing amends them
set -euo pipefail
missing=0
while read -r ext guide; do
  [ "$(git ls-files -- "*.$ext" | wc -l)" -gt 0 ] || continue
  grep -qF "$guide" CONTRIBUTING.md || { echo "CONTRIBUTING.md does not link the .$ext style guide: $guide"; missing=1; }
done <<'GUIDES'
py https://peps.python.org/pep-0008/
ts https://google.github.io/styleguide/tsguide.html
java https://google.github.io/styleguide/javaguide.html
kt https://kotlinlang.org/docs/coding-conventions.html
go https://go.dev/wiki/CodeReviewComments
cs https://learn.microsoft.com/en-us/dotnet/csharp/fundamentals/coding-style/coding-conventions
GUIDES
[ ! -e docs/STYLE.md ] || { echo "docs/STYLE.md amends the published guides: supersede the decision first"; missing=1; }
exit $missing`,
    },
    {
      id: 'ff-guide-rules', label: 'Our guide stays short and sourced', when: { GUIDE: ['own'] }, characteristic: 'maintainability', scope: 'atomic', cadence: 'triggered', trigger: 'pull-request', invocation: 'automated', implements: ['adr-guide-own'], checks: ['req-guide-own'],
      threshold: 'docs/STYLE.md holds between 1 and {{MAX_GUIDE_RULES}} rules, every rule has a "Based on:" and a "Checked by:" line, and CONTRIBUTING.md links it',
      description: 'A CI step reads docs/STYLE.md, where every rule is a heading "### S<n>. <rule>" followed by its "Based on:" and "Checked by:" lines, counts the rules and fails on a rule without either line, on more rules than the decision allows, or when CONTRIBUTING.md does not link the guide.',
      tool: 'awk and grep in a CI step',
      language: 'bash',
      snippet: `#!/usr/bin/env bash
# CI step: docs/STYLE.md stays short, and every rule says where it comes from and who checks it
set -euo pipefail
grep -qF 'docs/STYLE.md' CONTRIBUTING.md || { echo "CONTRIBUTING.md does not link docs/STYLE.md"; exit 1; }
awk -v max={{MAX_GUIDE_RULES}} '
  function close_rule() { if (rule != "" && (!based || !checked)) { print "docs/STYLE.md: " rule " lacks a Based on: or Checked by: line"; bad = 1 } }
  /^### S[0-9]+\\./ { close_rule(); rule = $0; based = 0; checked = 0; n++ }
  /^Based on: ./ { based = 1 }
  /^Checked by: ./ { checked = 1 }
  END {
    close_rule()
    if (n == 0 || n > max) { print "docs/STYLE.md holds " n " rules; it must hold 1 to " max; bad = 1 }
    exit bad
  }' docs/STYLE.md`,
    },
    {
      id: 'ff-naming-lint', label: 'Naming rules at error severity', when: { NAMING: ['linted'] }, characteristic: 'maintainability', scope: 'atomic', cadence: 'triggered', trigger: 'pull-request', invocation: 'automated', implements: FORMATTERS, checks: ['req-naming-linted'],
      threshold: '@typescript-eslint/naming-convention at severity 2 (error) in the configuration ESLint resolves for src; Ruff reports N802 on a probe with a wrongly named function; the step fails otherwise',
      description: 'The naming rules of the guide are added to the shared ESLint configuration at error severity; object and type properties are left free because they follow wire formats. A CI step asks ESLint for the configuration it resolves for a source file, so a rule turned off or down to a warning in some later block is noticed, and pipes a wrongly named Python function through Ruff with the project\'s configuration. For Kotlin, ktlint\'s standard:class-naming, function-naming and property-naming run unless disabled in .editorconfig; for C#, dotnet_diagnostic.IDE1006.severity = error; for Go, staticcheck\'s ST1003, which is off by default and has to be listed.',
      tool: 'ESLint with typescript-eslint (naming-convention); Ruff (pep8-naming, N); ktlint, IDE1006 and staticcheck ST1003 for Kotlin, C# and Go',
      language: 'js',
      snippet: `// eslint.config.js: the naming rules of the style guide, at error (merged into the shared configuration)
import { defineConfig } from 'eslint/config'
import tseslint from 'typescript-eslint'

export default defineConfig({
  files: ['src/**/*.{ts,tsx}'],
  languageOptions: { parser: tseslint.parser },
  plugins: { '@typescript-eslint': tseslint.plugin },
  rules: {
    '@typescript-eslint/naming-convention': ['error',
      { selector: 'default', format: ['camelCase'], leadingUnderscore: 'allow' },
      { selector: 'variable', modifiers: ['const'], format: ['camelCase', 'UPPER_CASE'] },
      { selector: 'typeLike', format: ['PascalCase'] },
      { selector: 'enumMember', format: ['PascalCase'] },
      { selector: 'import', format: ['camelCase', 'PascalCase'] },
      { selector: ['objectLiteralProperty', 'typeProperty'], format: null },   // keys follow the wire format
    ],
  },
})
// CI step:
//   npx eslint --print-config src/index.ts | jq -e '.rules["@typescript-eslint/naming-convention"][0] == 2'
//   printf 'def GetOrder():\\n    pass\\n' | ruff check --stdin-filename src/naming_probe.py - | grep -q N802   # pyproject.toml: [tool.ruff.lint] extend-select = ["N"]`,
    },
    {
      id: 'ff-editor-settings', label: 'Editor settings format on save', when: { EDITOR: ['shared'] }, characteristic: 'maintainability', scope: 'atomic', cadence: 'triggered', trigger: 'pull-request', invocation: 'automated', implements: FORMATTERS, checks: ['req-editor-shared'],
      threshold: '.vscode/settings.json has editor.formatOnSave true and a default formatter for every language with tracked files; .vscode/extensions.json recommends each of those formatters',
      description: 'A CI step reads the committed editor settings, kept as plain JSON without comments so jq can read them, and fails when format on save is off, a language in the repository has no default formatter, or that formatter\'s extension is not recommended. The Prettier extension (esbenp.prettier-vscode), Biome\'s (biomejs.biome) and Ruff\'s (charliermarsh.ruff) use the project\'s installed formatter before their bundled one. JetBrains IDEs read .editorconfig and need their Prettier or Ruff on-save setting turned on once per developer.',
      tool: 'jq in a CI step',
      language: 'bash',
      snippet: `#!/usr/bin/env bash
# CI step: the committed editor settings format on save with the project's formatter
set -euo pipefail
s=.vscode/settings.json; x=.vscode/extensions.json
jq -e '."editor.formatOnSave" == true' "$s" >/dev/null || { echo "$s: editor.formatOnSave is not true"; exit 1; }
while read -r lang pattern; do
  [ "$(git ls-files -- "$pattern" | wc -l)" -gt 0 ] || continue
  ext=$(jq -r --arg l "[$lang]" '.[$l]["editor.defaultFormatter"] // .["editor.defaultFormatter"] // empty' "$s")
  [ -n "$ext" ] || { echo "$s: no default formatter for $lang"; exit 1; }
  jq -e --arg e "$ext" '.recommendations | index($e)' "$x" >/dev/null || { echo "$x: $ext is not recommended"; exit 1; }
done <<'LANGUAGES'
typescript *.ts
typescriptreact *.tsx
javascript *.js
python *.py
LANGUAGES
echo "editors format on save with the project's formatters"`,
    },
    {
      id: 'ff-no-editor-files', label: 'Only .editorconfig is shared', when: { EDITOR: ['editorconfig'] }, characteristic: 'maintainability', scope: 'atomic', cadence: 'triggered', trigger: 'pull-request', invocation: 'automated', implements: FORMATTERS, checks: ['req-editor-own'],
      threshold: '0 tracked editor-specific settings files (.vscode/settings.json, .idea/, *.code-workspace, .zed/, .fleet/); .editorconfig present',
      description: 'A CI step lists the tracked editor-specific settings files and fails on any, so a personal setting committed by mistake is caught in the pull request; .editorconfig must exist, being the one configuration every editor shares. Recommending extensions in .vscode/extensions.json is not a setting and stays allowed.',
      tool: 'git ls-files in a CI step',
      language: 'bash',
      snippet: `#!/usr/bin/env bash
# CI step: .editorconfig is the only editor configuration in the repository
set -euo pipefail
tracked=$(git ls-files -- '.vscode/settings.json' '.idea/*' '*.code-workspace' '.zed/*' '.fleet/*')
[ -z "$tracked" ] || { echo "editor-specific settings are committed; keep them out of the repository (.gitignore):"; echo "$tracked"; exit 1; }
[ -f .editorconfig ] || { echo ".editorconfig is missing"; exit 1; }
echo "only .editorconfig is shared"`,
    },
  ],
}

export default pack
