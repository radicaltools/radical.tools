// The two functions of js-yaml 4 Assay uses (the package ships no types).
declare module 'js-yaml' {
  export function load(text: string): unknown
  export function loadAll(text: string): unknown[]
}
