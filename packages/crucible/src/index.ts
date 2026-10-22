// Radical Crucible's engine: fuzz suites, their rules and known failures.
// ./vitest registers a suite as tests; ./findings reads and writes findings.

export { default as fc } from 'fast-check'
export { RuleBroken, type Action, type Violation } from './violation'
export { differences, describeDifference, shortValue, type Difference, type DifferenceOptions } from './differences'
export { knownMatches, pathMatches, pathShape, signatureOf, type Known, type KnownContext } from './signature'
export { Fuzzer, fuzzOptionsFromEnv, showAction, type FuzzOptions, type FuzzSuite, type Plan, type RunContext, type SurveyRecord, type WorldResult } from './engine'
export { manualTimers, mulberry32, sequentialIds } from './determinism'
