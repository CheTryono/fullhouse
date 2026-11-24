'use strict';
// Synthetic canvas only. No files, account, network service or browser profile.
const {chromium}=require('playwright');
(async()=>{
 const browser=await chromium.launch({executablePath:process.env.FULLHOUSE_CHROMIUM||'/usr/bin/chromium',headless:true,args:['--no-sandbox']});
 try{const page=await browser.newPage();const samples=await page.evaluate(()=>{
  const results=[];for(const [width,height]of [[320,240],[800,600],[1100,825]])for(const scene of ['gradient','noise']){
   const canvas=document.createElement('canvas');canvas.width=width;canvas.height=height;const ctx=canvas.getContext('2d'),image=ctx.createImageData(width,height);let seed=123456789;
   for(let i=0;i<image.data.length;i+=4){seed^=seed<<13;seed^=seed>>>17;seed^=seed<<5;const x=(i/4)%width,y=Math.floor(i/4/width);image.data[i]=scene==='noise'?seed&255:Math.floor(255*x/width);image.data[i+1]=scene==='noise'?(seed>>>8)&255:Math.floor(255*y/height);image.data[i+2]=scene==='noise'?(seed>>>16)&255:96;image.data[i+3]=255;}
   ctx.putImageData(image,0,0);const src=canvas.toDataURL('image/jpeg',.66),binaryBytes=atob(src.split(',')[1]).length;
   results.push({width,height,scene,quality:.66,binaryBytes,sourceBytes:src.length,withinNewImageLimit:src.length<=600000,maximumIn8MiBWith1MiBText:Math.floor((8*1024*1024-1024*1024)/(src.length+300))});
  }return results;
 });console.log(JSON.stringify({node:process.versions.node,chromium:browser.version(),method:'Canvas JPEG .66; deterministic synthetic gradient/noise. Counts reserve 300 bytes per evidence; not a measured full-account limit.',samples},null,2));}
 finally{await browser.close();}
})().catch(e=>{console.error(e.message);process.exitCode=1;});
