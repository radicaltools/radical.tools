// Radical Assay's deterministic part (ADR Radical Assay): a repository's
// facts with their evidence, links across repositories, sources of documents,
// and the check of an agent's plan. The radical CLI (radical assay extract) and the MCP server
// (the assay_* tools) both use it.

export * from './facts'
export { citationProblem, cleanPath, inside, pathProblem, type Citation, type PlanPath } from './cite'
export { describeFacts, describeSources } from './describe'
export { extractRepository, urlPathOf, type ExtractOptions } from './extract'
export { linkRepositories, pathMatches } from './link'
export { isRepository, repositoriesIn, type Repositories } from './repositories'
export { checkPlan, parsePlan, type FactIndex, type PlanContext, type Plan, type PlanElement, type PlanDecision, type PlanMockup, type PlanNeed, type PlanRelation, type PlanRequirement, type PlanScenario } from './plan'
export { asText, documentFact, guardedLookup, headingsOf, htmlToMarkdown, ignored, privateAddress, readDocuments, readZip, safeName, SOURCES_DIR, sourceOrigin, takeSources, UNPACKED_DIR, unpackZip, within, type SourceOptions, type TakenSources } from './sources'
export { decodeText, GIT, SKIPPED } from './files'
export { pageOf, pathTest, pathTestFile, pathTestId, stepLabel, type Control, type PathFact, type ScreenFact, type Step } from './explore'
