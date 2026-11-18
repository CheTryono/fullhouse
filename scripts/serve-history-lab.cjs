'use strict';
const http=require('node:http'),fs=require('node:fs'),path=require('node:path');
const {bundle}=require('./history-browser.cjs');
async function start(options={}){
  const root=path.resolve(__dirname,'..'),resources=new Map([
    ['/readiness',['tests/history-lab/readiness.html','text/html']],['/readiness-view.js',['tests/history-lab/readiness-view.js','text/javascript']],['/history-worker.js',['tests/history-lab/history-worker.js','text/javascript']],['/compat',['tests/history-lab/compat.html','text/html']],['/compat-view.js',['tests/history-lab/compat-view.js','text/javascript']],['/compat.css',['tests/history-lab/compat.css','text/css']],['/storage', ['tests/history-lab/storage.html','text/html']],['/storage-view.js',['tests/history-lab/storage-view.js','text/javascript']],['/integration', ['tests/history-lab/integration.html','text/html']],['/integration-view.js',['tests/history-lab/integration-view.js','text/javascript']],['/', ['tests/history-lab/index.html','text/html']],['/view.js',['tests/history-lab/view.js','text/javascript']],
    ['/lab.css',['tests/history-lab/lab.css','text/css']],['/styles.css',['styles.css','text/css']]]);
  const code=bundle(options);const server=http.createServer((req,res)=>{
    res.setHeader('Cache-Control','no-store');res.setHeader('Content-Security-Policy',"default-src 'none'; script-src 'self'; worker-src 'self'; style-src 'self'; img-src data: blob:; base-uri 'none'; form-action 'none'");
    const url=new URL(req.url,'http://localhost').pathname;
    if(url==='/favicon.ico'){res.writeHead(204);res.end();return;}
    if(url==='/history-browser.js'){res.setHeader('Content-Type','text/javascript');res.end(code);return;}
    const r=resources.get(url);if(!r){res.writeHead(404);res.end();return;}res.setHeader('Content-Type',r[1]);res.end(fs.readFileSync(path.join(root,r[0])));
  });await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  return {server,url:'http://127.0.0.1:'+server.address().port};
}
module.exports={start};if(require.main===module)start().then(({url})=>console.log('Laboratorio sintético aislado: '+url));
