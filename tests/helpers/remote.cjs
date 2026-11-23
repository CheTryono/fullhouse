'use strict';
// In-memory ports for service fault tests. These do NOT emulate Security Rules.
function memoryPorts() {
  const docs=new Map(),objects=new Map();let queue=Promise.resolve(),time=0;
  const copy=x=>x&&typeof x==='object'?(typeof x.toMillis==='function'?x:Array.isArray(x)?x.map(copy):Object.fromEntries(Object.entries(x).map(([k,v])=>[k,copy(v)]))):x;
  const snap=(map,key)=>({exists:map.has(key),data:()=>copy(map.get(key))});
  const db={doc:key=>({key,get:async()=>snap(docs,key)}),runTransaction:fn=>{
    const result=queue.then(async()=>{
      const pending=new Map(docs);
      const tx={get:async ref=>snap(pending,ref.key),getAll:async(...refs)=>refs.map(r=>snap(pending,r.key)),create(ref,data){if(pending.has(ref.key))throw Error('already exists');pending.set(ref.key,copy(data));},set:(ref,data)=>pending.set(ref.key,copy(data))};
      const value=await fn(tx);docs.clear();for(const [k,v]of pending)docs.set(k,v);return value;
    });queue=result.catch(()=>{});return result;
  }};
  const bucket={file:key=>({
    async save(content,options){if(objects.has(key)&&options?.preconditionOpts?.ifGenerationMatch===0)throw Object.assign(Error('precondition'),{code:412});objects.set(key,Buffer.from(content));},
    async getMetadata(){if(!objects.has(key))throw Object.assign(Error('missing'),{code:404});return[{size:String(objects.get(key).length)}];},
    async download(){if(!objects.has(key))throw Object.assign(Error('missing'),{code:404});return[Buffer.from(objects.get(key))];}
  })};
  return{db,bucket,docs,objects,now:()=>{const t=++time;return{toMillis:()=>t};}};
}
module.exports={memoryPorts};
