#!/usr/bin/env node
// Sensor product-version (radical.sensors.json), for the fitness function
// One product version: the element's released package carries the version
// the other released packages carry; an internal package is private, never
// released on its own. Run by radical sense run, once per element.
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { PRODUCT_PACKAGES, productVersions } from '../release.mjs'
import { fail, measuredElement, sensorContext } from './elements.mjs'

const element = measuredElement(sensorContext())
const versions = productVersions()
// The product version: the one most released packages carry.
const counts = new Map()
for (const v of Object.values(versions)) counts.set(v, (counts.get(v) ?? 0) + 1)
const [product] = [...counts].sort((a, b) => b[1] - a[1])[0]

const dirs = element.workspaces === '*' ? PRODUCT_PACKAGES : element.workspaces
const problems = dirs.flatMap((dir) => {
  if (PRODUCT_PACKAGES.includes(dir)) return versions[dir] === product ? [] : [`${dir}/package.json carries ${versions[dir]}, the other released packages ${product}`]
  const pkg = JSON.parse(readFileSync(join(import.meta.dirname, '../..', dir, 'package.json'), 'utf8'))
  return pkg.private === true ? [] : [`${dir} is released on its own (not private) but is no product package (tools/release.mjs PRODUCT_PACKAGES)`]
})
if (problems.length) fail(`${element.label}: ${problems.join('; ')}.`)
console.log(`${element.label}: ${dirs.join(', ')} ${dirs.some((d) => PRODUCT_PACKAGES.includes(d)) ? `at ${product}` : 'private'}.`)
