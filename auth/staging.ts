import {connectFirebase,validateConfig,type AuthPort} from './firebase';
import {authError} from './errors';
import {createWorkspaceManager,type SessionUser} from './workspace';
const view=document.getElementById('auth-view')!,workspaceRoot=document.getElementById('workspace')!,status=document.getElementById('auth-status')!;
let port:AuthPort|null=null,user:SessionUser|null=null,busy=false,ready=false,notice='',error='',lastEmail='',mode:'login'|'register'|'reset'='login';
let action=new URLSearchParams(location.search).get('mode')||'',code=new URLSearchParams(location.search).get('oobCode')||'',resetEmail='',actionDone=false;
let workspace:ReturnType<typeof createWorkspaceManager>|null=null;
function el<K extends keyof HTMLElementTagNameMap>(tag:K,text?:string){const node=document.createElement(tag);if(text!==undefined)node.textContent=text;return node;}
function button(text:string,fn:()=>void,kind=''){const b=el('button',text);b.type='button';b.className='btn '+kind;b.disabled=busy||!ready;b.onclick=fn;return b;}
function field(form:HTMLFormElement,name:string,label:string,type:string,autocomplete:string){const row=el('div'),l=el('label',label),input=el('input');row.className='field';input.id=name;input.name=name;input.type=type;input.required=true;input.setAttribute('autocomplete',autocomplete);input.disabled=busy||!ready;l.htmlFor=name;if(type==='password'){input.minLength=8;input.maxLength=128;}if(type==='email')input.value=lastEmail;row.append(l,input);form.append(row);return input;}
function clearCode(){code='';history.replaceState(null,'',location.pathname);}
async function perform(fn:()=>Promise<void>){if(busy||!ready)return;busy=true;notice='';error='';show();try{await fn();}catch(e){error=authError(e);}finally{busy=false;show();}}
async function logout(){if(!workspace?.canLogout()){error='Hay cambios pendientes. Guárdalos o expórtalos y resuélvelos antes de salir.';show();return;}await perform(async()=>{await port!.logout();lastEmail='';notice='Sesión cerrada.';});}
function show(){
 const state=workspace?.session(action?null:user)||'closed';view.replaceChildren();status.replaceChildren();workspaceRoot.hidden=!user?.emailVerified||state==='pending-other'||!!action;
 if(!ready){view.append(el('h1','Acceso de pruebas'),el('p',error||'Conectando con el servicio de acceso…'));return;}
 if(action){showAction();return;}
 if(user){
  view.className='account-bar';view.append(el('strong',user.email||'Tu cuenta'));view.append(button('Cerrar sesión',()=>{void logout();},'secondary'));
  if(!user.emailVerified){workspaceRoot.hidden=true;const card=el('section');card.className='auth-card';card.append(el('h1','Verifica tu correo'),el('p','Abre el enlace de verificación y vuelve aquí. El planificador de la cuenta se abrirá cuando comprobemos el correo.'));card.append(button('Reenviar verificación',()=>{void perform(async()=>{await port!.verification();notice='Se solicitó el envío del correo de verificación. Revisa tu bandeja y spam.';});}));card.append(button('Ya verifiqué mi correo',()=>{void perform(async()=>{await port!.refresh();user=port!.user;if(!user?.emailVerified)notice='El correo todavía no aparece verificado. Abre el enlace recibido y vuelve a comprobar.';});},'secondary'));status.append(card);}
  else if(state==='pending-other'){status.append(el('p','Una sesión anterior tiene cambios pendientes. Para protegerlos no abriremos otro planificador. Vuelve a iniciar sesión con la cuenta anterior para recuperarlos; no cierres esta pestaña.'));}
  else status.append(el('p','Los datos de esta cuenta se guardan solo en este navegador. No hemos importado tu planificador local anterior. La sincronización remota todavía no está disponible.'));
 }else{
  view.className='auth-card';view.append(el('h1',mode==='register'?'Crear cuenta':mode==='reset'?'Recuperar acceso':'Entrar a Fullhouse'));
  const form=el('form'),email=field(form,'email','Correo electrónico','email','email');
  let password:HTMLInputElement|null=null,repeat:HTMLInputElement|null=null;
  if(mode!=='reset'){password=field(form,'password','Contraseña','password',mode==='register'?'new-password':'current-password');if(mode==='login')password.minLength=1;}
  if(mode==='register')repeat=field(form,'password-repeat','Repite la contraseña','password','new-password');
  const submit=el('button',busy?'Espera…':mode==='register'?'Crear cuenta':mode==='reset'?'Enviar enlace':'Iniciar sesión');submit.className='btn';submit.type='submit';submit.disabled=busy;form.append(submit);
  form.onsubmit=ev=>{ev.preventDefault();if(!form.reportValidity())return;lastEmail=email.value.trim();const secret=password?.value||'',again=repeat?.value;const selected=mode;if(again!==undefined&&secret!==again){error='Las contraseñas no coinciden.';show();return;}void perform(async()=>{
   if(selected==='register'){await port!.register(lastEmail,secret);try{await port!.verification();notice='Cuenta creada. Se solicitó el correo de verificación; revísalo antes de entrar.';}catch(e){notice='La cuenta se creó, pero no pudimos solicitar la verificación. Puedes reenviarla.';error=authError(e);}}
   else if(selected==='login')await port!.login(lastEmail,secret);
   else{try{await port!.reset(lastEmail);}catch(e){if((e as {code?:string}).code!=='auth/user-not-found')throw e;}notice='Si existe una cuenta con ese correo, recibirás un enlace para recuperar el acceso.';}
  });};view.append(form);
  const nav=el('nav');nav.setAttribute('aria-label','Opciones de acceso');for(const [id,label]of [['login','Ya tengo cuenta'],['register','Crear una cuenta'],['reset','Olvidé mi contraseña']] as const)if(id!==mode)nav.append(button(label,()=>{mode=id;notice='';error='';show();},'ghost'));view.append(nav);
 }
 showMessages();
}
function showMessages(){if(notice){const n=el('p',notice);n.className='auth-message';n.setAttribute('role','status');status.append(n);}if(error){const n=el('p',error);n.className='auth-error';n.setAttribute('role','alert');status.append(n);}}
function showAction(){
 view.className='auth-card';
 if(actionDone){view.append(el('h1','Operación completada'),button('Volver al acceso',()=>{action='';actionDone=false;notice='';error='';show();}));showMessages();return;}
 if(!code||!['verifyEmail','resetPassword'].includes(action)){view.append(el('h1','Enlace no compatible'),el('p','Solicita otro enlace desde la página de acceso.'),button('Volver al acceso',()=>{clearCode();action='';show();}));return;}
 if(action==='verifyEmail'){view.append(el('h1','Confirmar correo'),button('Confirmar mi correo',()=>{void perform(async()=>{await port!.apply(code);clearCode();actionDone=true;notice='El correo se confirmó. Puedes volver al acceso.';try{await port!.refresh();user=port!.user;}catch(e){error='El correo se confirmó, pero no pudimos actualizar la sesión. '+authError(e);}});}));}
 else{
  view.append(el('h1','Cambiar contraseña'));
  if(!resetEmail){view.append(el('p','No pudimos comprobar este enlace. Solicita otro desde la recuperación de acceso.'),button('Volver al acceso',()=>{clearCode();action='';show();}));showMessages();return;}
  const form=el('form'),password=field(form,'new-password','Nueva contraseña','password','new-password'),repeat=field(form,'new-password-repeat','Repite la contraseña','password','new-password'),submit=el('button','Guardar nueva contraseña');submit.type='submit';submit.className='btn';submit.disabled=busy;form.append(submit);form.onsubmit=ev=>{ev.preventDefault();if(!form.reportValidity())return;const secret=password.value;if(secret!==repeat.value){error='Las contraseñas no coinciden.';show();return;}void perform(async()=>{await port!.confirmReset(code,secret);clearCode();actionDone=true;notice='Contraseña actualizada. Inicia sesión con la nueva contraseña.';try{await port!.logout();user=port!.user;}catch(e){error='La contraseña cambió, pero no pudimos cerrar la sesión. '+authError(e);}});};view.append(form);
 }showMessages();
}
window.addEventListener('beforeunload',event=>{if(workspace?.hasUnsaved()){event.preventDefault();event.returnValue='';}});
async function start(){show();try{
 const config=validateConfig((window as any).FULLHOUSE_AUTH_CONFIG,location.hostname);port=await connectFirebase(config);workspace=createWorkspaceManager(workspaceRoot,config.firebase.projectId!,()=>port!.user,localStorage);
 (window as any).fullhouseWorkspaceFor=(child:Window)=>workspace!.workspaceFor(child);
 if(config.emulatorUrl)document.getElementById('environment-note')!.textContent='Emulador local: cuentas sintéticas. No se entregan correos reales.';
 if(action==='resetPassword'&&code){try{resetEmail=await port.resetEmail(code);}catch(e){error=authError(e);}}
 port.watch(value=>{user=value;ready=true;show();},()=>{user=null;ready=true;error='No pudimos restaurar la sesión. Vuelve a iniciar sesión.';show();});
}catch{error='Este entorno de acceso todavía no está configurado o no pudo iniciar. Contacta con quien administra Fullhouse; no se han abierto datos locales.';show();}}
void start();
