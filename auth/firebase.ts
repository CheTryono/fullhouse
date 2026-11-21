import { initializeApp, type FirebaseOptions } from 'firebase/app';
import { getAuth, setPersistence, browserSessionPersistence, connectAuthEmulator,
  onIdTokenChanged, createUserWithEmailAndPassword, signInWithEmailAndPassword,
  signOut, sendEmailVerification, sendPasswordResetEmail, reload, getIdToken,
  applyActionCode, verifyPasswordResetCode, confirmPasswordReset, type User } from 'firebase/auth';
export interface RuntimeConfig {firebase:FirebaseOptions; emulatorUrl?:string}
export function validateConfig(value:unknown,hostname:string):RuntimeConfig {
  const c=value as RuntimeConfig;
  if(!c||typeof c!=='object'||Object.keys(c).some(k=>!['firebase','emulatorUrl'].includes(k))||!c.firebase||typeof c.firebase!=='object')throw Error('Configuración Firebase pendiente.');
  const allowed=['apiKey','authDomain','projectId','appId','storageBucket','messagingSenderId','measurementId'];
  if(Object.keys(c.firebase).some(k=>!allowed.includes(k))||Object.values(c.firebase).some(v=>typeof v!=='string')||['apiKey','authDomain','projectId','appId'].some(k=>!c.firebase[k as keyof FirebaseOptions]||/YOUR_|REPLACE|CHANGEME/.test(c.firebase[k as keyof FirebaseOptions] as string)))throw Error('Configuración Firebase incompleta.');
  if(c.emulatorUrl){const u=new URL(c.emulatorUrl);if(!['localhost','127.0.0.1','[::1]'].includes(hostname)||!['localhost','127.0.0.1','[::1]'].includes(u.hostname)||u.protocol!=='http:'||u.username||u.password||u.search||u.hash||u.pathname!=='/'||!c.firebase.projectId?.startsWith('demo-'))throw Error('El emulador solo se permite en loopback con un proyecto demo-.');}
  return {firebase:{...c.firebase},...(c.emulatorUrl?{emulatorUrl:c.emulatorUrl}:{})};
}
export async function connectFirebase(config:RuntimeConfig){
  const app=initializeApp(config.firebase),auth=getAuth(app);
  if(config.emulatorUrl)connectAuthEmulator(auth,config.emulatorUrl,{disableWarnings:true});
  await setPersistence(auth,browserSessionPersistence);
  return {
    get user(){return auth.currentUser;},
    watch(listener:(user:User|null)=>void,onError:(e:unknown)=>void){return onIdTokenChanged(auth,listener,onError);},
    async register(email:string,password:string){return (await createUserWithEmailAndPassword(auth,email,password)).user;},
    async login(email:string,password:string){return (await signInWithEmailAndPassword(auth,email,password)).user;},
    logout:()=>signOut(auth),
    async verification(){if(!auth.currentUser)throw Error('Sin sesión');await sendEmailVerification(auth.currentUser,{url:location.origin+'/',handleCodeInApp:false});},
    async refresh(){if(!auth.currentUser)return;await reload(auth.currentUser);await getIdToken(auth.currentUser,true);},
    reset:(email:string)=>sendPasswordResetEmail(auth,email,{url:location.origin+'/',handleCodeInApp:false}),
    apply:(code:string)=>applyActionCode(auth,code),
    resetEmail:(code:string)=>verifyPasswordResetCode(auth,code),
    confirmReset:(code:string,password:string)=>confirmPasswordReset(auth,code,password)
  };
}
export type AuthPort=Awaited<ReturnType<typeof connectFirebase>>;
