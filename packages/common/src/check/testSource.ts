// ─── The file of a bound test, for scenario-value-untested ─────────────────
// A test bound in .radical/radical.json is named "file › describe › title" as
// the reports name it; radical check reads the file (a test's fixtures sit
// beside it, not in its body).

/** The test id's file and titles: "a.test.ts › suite › title". */
export function splitTestId(id: string): { file: string; titles: string[] } {
  const [file, ...titles] = id.split(/\s+›\s+|\s+>\s+/).map((part) => part.trim())
  return { file, titles: titles.filter(Boolean) }
}
