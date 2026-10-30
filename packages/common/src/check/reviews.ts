// ─── radical check: reviews ─────────────────────────────────────────────────
//
// A manual fitness function is checked by a person: a security review before
// a release, an audit every quarter. `radical sense review <name> --passed`
// records the result in reviews.json in the model folder, kept in git (the one
// exception to measurements out of git: a review is rare, has an author and
// is a decision, and reaches CI with the pull request that records it). The
// engine reads each review as a measurement of the metric `review`, 1 passed
// and 0 failed, labelled with its name, so a `review(<name>) passed`
// condition follows the latest of them and goes stale after max_age as any
// other.

import { REVIEW_METRIC, type Measurement } from './metrics'

/** The file in the model folder. */
export const REVIEWS_FILE = 'reviews.json'

export const REVIEWS_FORMAT = 'radical-reviews'

export interface Review {
  /** What was reviewed, as `review(<name>) passed` names it. */
  name: string
  result: 'passed' | 'failed'
  by: string
  /** When (ISO time). */
  at: string
  note?: string
}

export interface ReviewsFile {
  format: typeof REVIEWS_FORMAT
  version: 1
  reviews: Review[]
}

/** The reviews in reviews.json; throws when it is no radical-reviews/1 file. */
export function parseReviewsFile(text: string): Review[] {
  let data: Partial<ReviewsFile> | null
  try { data = JSON.parse(text) as Partial<ReviewsFile> } catch { throw new Error(`${REVIEWS_FILE} is no JSON`) }
  if (!data || data.format !== REVIEWS_FORMAT || data.version !== 1 || !Array.isArray(data.reviews)) {
    throw new Error(`${REVIEWS_FILE} is no ${REVIEWS_FORMAT}/1 file`)
  }
  return data.reviews.filter((r): r is Review =>
    !!r && typeof r.name === 'string' && !!r.name.trim() && (r.result === 'passed' || r.result === 'failed')
    && typeof r.by === 'string' && typeof r.at === 'string' && !Number.isNaN(Date.parse(r.at)))
}

/** reviews.json with `review` added after `existing` (the file's text, if
 *  there is one): the history is kept, the latest of a name counts. */
export function addReview(existing: string | undefined, review: Review): string {
  const reviews = existing === undefined ? [] : parseReviewsFile(existing)
  const file: ReviewsFile = { format: REVIEWS_FORMAT, version: 1, reviews: [...reviews, review] }
  return `${JSON.stringify(file, null, 2)}\n`
}

/** The reviews as measurements of the metric `review`. */
export const reviewMeasurements = (reviews: Review[]): Measurement[] => reviews.map((r) => ({
  metric: REVIEW_METRIC,
  value: r.result === 'passed' ? 1 : 0,
  labels: { name: r.name.trim() },
  source: 'review',
  at: new Date(r.at).toISOString(),
  context: { by: r.by, ...(r.note ? { note: r.note } : {}) },
}))
