---
id: "4a69aff2-fb2e-42b8-94c0-cd3134f81855"
type: "adr"
label: "Terser minifies Studio"
alternatives: "Upgrade Vite: a major upgrade for one bug, with no sign that its lexer has the fix. Turn off identifier minification: a larger bundle. Rename `of` after minification in a plugin: a scope-aware rewrite of a 2.8 MB chunk."
consequences: "The web build takes about 20 s instead of 6 s; the bundle size stays within 1%. terser is a devDependency of Studio."
context: "Vite 5.4 scans every built chunk with the es-module-lexer bundled in it. That lexer reads a variable named `of` inside a for (…) header as the for…of keyword, takes the next `/` for a regular expression and fails the build with \"Parse error @:1:1\". esbuild's minifier hands out `of` like any short name, so any change that shifts how names are allocated can break the build: adding the state machine types did, inside the bundled ELK code. es-module-lexer 3 fixes it, but Vite 5 ships its own copy."
date: "2026-10-09"
decision: "Studio's web build and its Electron renderer minify with terser and never use `of` as a name (apps/studio/rendererMinify.ts). Drop this once Vite bundles a fixed lexer."
status: "accepted"
---
