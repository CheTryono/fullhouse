// The iframe gives the unchanged global-script Planner a fresh lifetime per account.
try{
  if(parent===window||parent.location.origin!==location.origin)throw Error('Abre el planificador desde el acceso de Fullhouse.');
  const workspace=(parent as any).fullhouseWorkspaceFor?.(window);
  if(!workspace)throw Error('Inicia sesión y verifica tu correo antes de abrir el planificador.');
  (window as any).FullhouseAccountWorkspace=workspace;
  const script=document.createElement('script');script.src='/app.js';script.onerror=()=>{document.getElementById('app')!.textContent='No pudimos cargar el planificador. Recarga para volver a intentar.';};document.body.append(script);
}catch{document.getElementById('app')!.textContent='Este planificador requiere una sesión verificada. Vuelve a la página de acceso.';}
