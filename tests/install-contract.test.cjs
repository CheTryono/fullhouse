'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),{createRequire}=require('node:module');
// Reuse the pinned Firebase CLI's declared semver dependency; no new dependency.
const semver=createRequire(require.resolve('firebase-tools/package.json'))('semver');
function compatible(lock,version){return Object.entries(lock.packages).filter(([,p])=>p.engines?.node&&!semver.satisfies(version,p.engines.node)).map(([path,p])=>`${path||'<root>'}: ${p.version}, node ${p.engines.node}`);}
test('clean web/tooling lock supports the minimum Node version advertised by the root manifest',()=>{
 const pkg=require('../package.json'),lock=require('../package-lock.json'),minimum=semver.minVersion(pkg.engines.node).version;
 assert.equal(lock.packages[''].engines.node,pkg.engines.node);assert.deepEqual(compatible(lock,minimum),[]);
});
test('Functions dependency graph actually supports Node 22, including unused Admin transitive modules',()=>{
 const pkg=require('../remote/package.json'),lock=require('../remote/package-lock.json');assert.equal(pkg.engines.node,'22');assert.equal(lock.packages[''].engines.node,pkg.engines.node);
 assert.deepEqual(compatible(lock,'22.23.5'),[]);
});
