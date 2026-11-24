// Environment capabilities are created only by the checked, isolated staging factory.
export const DEMO_PROJECT='demo-fullhouse-remote',STAGING_PROJECT='fullhouse-staging';
export interface Scope {readonly project:string;readonly database:string;readonly prefix:string;readonly preferencePrefix:string}
const demo=Object.freeze({project:DEMO_PROJECT,database:'fullhouse-lab-work-v1',prefix:'fullhouse-remote-lab-v1:',preferencePrefix:'fullhouse-remote-lab-pref:'}),known=new WeakSet<Scope>([demo]);
export interface StagingConfig {projectId:string;appId:string;authDomain:string;storageBucket:string;enabled:boolean;appCheckSiteKey:string|null}
export function stagingScope(c:StagingConfig,origin:string):Scope {
 if(!c||Object.keys(c).some(k=>!['projectId','appId','authDomain','storageBucket','enabled','appCheckSiteKey'].includes(k))||c.projectId!==STAGING_PROJECT||c.appId!=='1:664973716762:web:c8407ddc2d0dc3ef8090a3'||c.authDomain!==STAGING_PROJECT+'.firebaseapp.com'||c.storageBucket!==STAGING_PROJECT+'.firebasestorage.app')throw Error('Configuración real de staging incompatible; no se permiten proyectos demo o cruzados.');
 if(!['https://fullhouse-staging.web.app','https://fullhouse-staging.firebaseapp.com'].includes(origin))throw Error('El cliente real solo puede abrirse en los orígenes de staging autorizados.');
 if(c.enabled!==true||typeof c.appCheckSiteKey!=='string'||!c.appCheckSiteKey.trim())throw Error('La activación y App Check de staging siguen pendientes.');
 const scope=Object.freeze({project:STAGING_PROJECT,database:'fullhouse-staging-work-v1',prefix:'fullhouse-remote-staging-v1:',preferencePrefix:'fullhouse-remote-staging-pref:'});known.add(scope);return scope;
}
export function resolveScope(value:string|Scope=DEMO_PROJECT):Scope {if(value===DEMO_PROJECT)return demo;if(typeof value==='object'&&value&&known.has(value))return value;throw Error('Entorno remoto no autorizado.');}
