'use strict';
// Aritmética civil UTC; NO sustituye occurs. Dominio conservador sin remapeo 00–99.
const MIN='0100-01-01',MAX='9999-12-31',DAY=86400000,GREGORIAN=146097n;
function ordinal(s){if(typeof s!=='string'||!/^\d{4}-\d\d-\d\d$/.test(s)||s<MIN||s>MAX)throw Error('unsupported-date');const ms=Date.parse(s+'T00:00:00Z');if(!Number.isFinite(ms)||new Date(ms).toISOString().slice(0,10)!==s)throw Error('invalid-date');return ms/DAY;}
function date(n){if(!Number.isSafeInteger(n)||n<ordinal(MIN)||n>ordinal(MAX))throw Error('unsupported-date');return new Date(n*DAY).toISOString().slice(0,10);}
function gcd(a,b){a=BigInt(a);b=BigInt(b);if(a<0n)a=-a;if(b<0n)b=-b;while(b){const r=a%b;a=b;b=r;}return a;}
function lcm(a,b){a=BigInt(a);b=BigInt(b);return a/gcd(a,b)*b;}
function period(events){let p=7n;for(const e of events){if(['monthly','yearly'].includes(e.repeat))p=lcm(p,GREGORIAN);if(e.repeat==='every'){const n=Math.max(1,e.everyDays||1);if(!Number.isSafeInteger(n))return null;p=lcm(p,BigInt(n));}}return p;}
module.exports={MIN,MAX,DAY,GREGORIAN,ordinal,date,gcd,lcm,period};
