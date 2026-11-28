'use strict';
// Read in memory only. No extraction, external processes, or dependency on v2.
const {inflateRawSync,crc32}=require('node:zlib');
const {createHash}=require('node:crypto');
const MAX_ZIP=8*1024*1024;
const hash=bytes=>createHash('sha256').update(bytes).digest('hex');

function verifySourceZip(zip,expected){
 if(!Buffer.isBuffer(zip)||zip.length<22||zip.length>MAX_ZIP)throw Error('ZIP ausente o fuera del límite de 8 MiB.');
 let end=-1;
 for(let p=zip.length-22;p>=Math.max(0,zip.length-65557);p--){
  if(zip.readUInt32LE(p)===0x06054b50&&p+22+zip.readUInt16LE(p+20)===zip.length){end=p;break;}
 }
 if(end<0||zip.readUInt16LE(end+4)!==0||zip.readUInt16LE(end+6)!==0)throw Error('ZIP truncado/multidisco.');
 const count=zip.readUInt16LE(end+10),start=zip.readUInt32LE(end+16),length=zip.readUInt32LE(end+12);
 if(count!==Object.keys(expected).length||zip.readUInt16LE(end+8)!==count||start+length!==end)throw Error('Catálogo ZIP incompleto/extra/ZIP64.');
 const seen=new Set(),ranges=[];let p=start;
 for(let i=0;i<count;i++){
  if(p+46>end||zip.readUInt32LE(p)!==0x02014b50)throw Error('Entrada central ZIP inválida.');
  const flags=zip.readUInt16LE(p+8),method=zip.readUInt16LE(p+10),crc=zip.readUInt32LE(p+16);
  const packed=zip.readUInt32LE(p+20),size=zip.readUInt32LE(p+24),n=zip.readUInt16LE(p+28),extra=zip.readUInt16LE(p+30),comment=zip.readUInt16LE(p+32),offset=zip.readUInt32LE(p+42);
  const type=(zip.readUInt32LE(p+38)>>>16)&0xf000;
  if(p+46+n+extra+comment>end||flags&~0x808||![0,8].includes(method)||zip.readUInt16LE(p+34)!==0||![0,0x8000].includes(type))throw Error('ZIP cifrado/formato/enlace no permitido.');
  const nameBytes=zip.subarray(p+46,p+46+n),name=nameBytes.toString('utf8');
  if(!Buffer.from(name).equals(nameBytes)||!Object.hasOwn(expected,name)||seen.has(name)||!/^[A-Za-z0-9_.-]+$/.test(name)||size!==expected[name].size)throw Error('Archivo ZIP ajeno, duplicado o tamaño distinto.');
  if(offset+30>start||zip.readUInt32LE(offset)!==0x04034b50||zip.readUInt16LE(offset+6)!==flags||zip.readUInt16LE(offset+8)!==method)throw Error('Cabecera local ZIP inconsistente.');
  const localN=zip.readUInt16LE(offset+26),localExtra=zip.readUInt16LE(offset+28),data=offset+30+localN+localExtra;
  if(data+packed>start||!zip.subarray(offset+30,offset+30+localN).equals(nameBytes))throw Error('Nombre/rango local ZIP inconsistente.');
  if(!(flags&8)&&(zip.readUInt32LE(offset+14)!==crc||zip.readUInt32LE(offset+18)!==packed||zip.readUInt32LE(offset+22)!==size))throw Error('CRC/tamaño local ZIP inconsistente.');
  const compressed=zip.subarray(data,data+packed);
  const inflated=method===8?inflateRawSync(compressed,{maxOutputLength:size+1,info:true}):null;
  const bytes=inflated?inflated.buffer:compressed;
  if(inflated&&inflated.engine.bytesWritten!==packed||bytes.length!==size||crc32(bytes)!==crc||hash(bytes)!==expected[name].sha256)throw Error('Bytes/CRC/hash de la fuente no coinciden.');
  let limit=data+packed;
  if(flags&8){
   const signed=limit+4<=start&&zip.readUInt32LE(limit)===0x08074b50,descriptor=limit+(signed?4:0);
   if(descriptor+12>start||zip.readUInt32LE(descriptor)!==crc||zip.readUInt32LE(descriptor+4)!==packed||zip.readUInt32LE(descriptor+8)!==size)throw Error('Descriptor ZIP inválido.');
   limit=descriptor+12;
  }
  ranges.push([offset,limit]);seen.add(name);p+=46+n+extra+comment;
 }
 ranges.sort((a,b)=>a[0]-b[0]);
 if(p!==end||ranges[0]?.[0]!==0||ranges.at(-1)?.[1]!==start||ranges.some((r,i)=>i&&r[0]!==ranges[i-1][1]))throw Error('ZIP con solapamientos o bytes ajenos.');
 return {files:seen.size,zipBytes:zip.length,zipSha256:hash(zip),fileHashes:Object.fromEntries([...seen].sort().map(n=>[n,expected[n].sha256]))};
}
module.exports={MAX_ZIP,verifySourceZip};
