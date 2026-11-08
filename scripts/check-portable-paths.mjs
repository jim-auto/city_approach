import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';

// Check every reachable revision, including binary metadata, without echoing
// the private value when reporting a failure.
const rows=execFileSync('git',['rev-list','--objects','--all'],{encoding:'utf8'}).trim().split('\n');
const paths=new Map(rows.map(row=>{const space=row.indexOf(' ');return [space<0?row:row.slice(0,space),space<0?'[commit]':row.slice(space+1)];}));
const types=execFileSync('git',['cat-file','--batch-check=%(objectname) %(objecttype)'],{
  input:[...paths.keys()].join('\n')+'\n',encoding:'utf8',
}).trim().split('\n');
const privateHome=/\/(?:home|Users)\/[^/\s"'<>]+\/|[A-Za-z]:[\\/]Users[\\/][^\\/\s"'<>]+[\\/]/;
const failures=new Set();let checked=0;
for(const row of types){
  const [oid,type]=row.split(' ');
  if(!['blob','commit'].includes(type))continue;
  const bytes=execFileSync('git',['cat-file',type,oid],{maxBuffer:64*1024*1024});
  if(privateHome.test(bytes.toString('latin1')))failures.add(paths.get(oid));
  checked++;
}
assert.equal(failures.size,0,`Private absolute home path in Git history: ${[...failures].join(', ')}`);
console.log(`PASS ${checked} historical objects: no private absolute home paths`);
