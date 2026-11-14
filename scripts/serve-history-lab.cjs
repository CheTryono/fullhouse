'use strict';
const http=require('node:http'),fs=require('node:fs'),path=require('node:path');
const {bundle}=require('./history-browser.cjs');
async function start(){
  const root=path.resolve(__dirname,'..'),resources=new Map([
    ['/', ['tests/history-lab/index.html','text/html']],['/view.js',['tests/history-lab/view.js','text/javascript']],
    ['/lab.css',['tests/history-lab/lab.css','text/css']],['/styles.css',['styles.css','text/css']]]);
  const code=bundle();const server=http.createServer((req,res)=>{
    res.setHeader('Cache-Control','no-store');res.setHeader('Content-Security-Policy',"default-src 'none'; script-src 'self'; style-src 'self'; img-src data:; base-uri 'none'; form-action 'none'");
    const url=new URL(req.url,'http://localhost').pathname;
    if(url==='/favicon.ico'){res.writeHead(204);res.end();return;}
    if(url==='/history-browser.js'){res.setHeader('Content-Type','text/javascript');res.end(code);return;}
    const r=resources.get(url);if(!r){res.writeHead(404);res.end();return;}res.setHeader('Content-Type',r[1]);res.end(fs.readFileSync(path.join(root,r[0])));
  });await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  return {server,url:'http://127.0.0.1:'+server.address().port};
}
module.exports={start};if(require.main===module)start().then(({url})=>console.log('Laboratorio sintético (sin persistencia): '+url));
