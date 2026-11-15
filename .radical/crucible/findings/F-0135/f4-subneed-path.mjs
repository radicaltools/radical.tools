// Question: the metamodel lets a need sit inside a broader need (need --derives--> need, shown as
// "Part of"), but the verification path and the check stop at the inner need: the broader need
// "Sell online" says "no requirement derives from it", and the path of "Take card payments" starts
// at "Pay online", not at "Sell online". No browser needed.
// Usage: node f4-subneed-path.mjs
import { cli } from './lib.mjs'
import { buildShop } from './shop.mjs'
const { repo, model, ids } = await buildShop()
console.log(cli(['check', model, '--trace', ids['n-sell']], repo))
console.log(cli(['check', model, '--trace', ids['r-card']], repo).split('\n').slice(0, 3).join('\n'))
console.log(cli(['check', model], repo).split('\n').filter((l) => /need-without-requirement|Sell online/.test(l)).join('\n'))
