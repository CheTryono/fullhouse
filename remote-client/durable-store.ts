import {PROJECT,digest} from './session';
export interface DraftRow {key:string;owner:string;id:string;generation:number;raw:string;hash:string}
export interface PhotoRow {key:string;owner:string;id:string;context:{eventId:string;date:string;stepId:string;baseRevision:string|null};name:string;type:string;size:number;blob:Blob}
type Fault=(kind:string,tx:IDBTransaction)=>void;
// Only new commercial laboratory storage. Never opens the historical v2 DBs.
export class DurableWorkStore {
  private db:IDBDatabase|null=null;private opening:Promise<void>|null=null;private cache=new Map<string,string>();
  readonly prefix:string;readonly owner:string;
  constructor(readonly uid:string,private factory?:IDBFactory,private name='fullhouse-lab-work-v1',private fault?:Fault,project=PROJECT){
    if(project!==PROJECT||!/^[A-Za-z0-9_-]{1,128}$/.test(uid)||!name.startsWith('fullhouse-lab-'))throw Error('Almacén limitado al laboratorio demo por UID.');
    this.prefix='fullhouse-remote-lab-v1:'+project+':'+uid+':';this.owner=project+':'+uid;
  }
  private scoped(key:string){if(!key.startsWith(this.prefix))throw new DOMException('El registro pertenece a otra cuenta','SecurityError');}
  ready():Promise<void>{
    if(this.db)return Promise.resolve();if(this.opening)return this.opening;
    this.opening=new Promise<void>((resolve,reject)=>{
      let request:IDBOpenDBRequest;try{request=(this.factory??globalThis.indexedDB).open(this.name,1);}catch(e){reject(e);return;}
      let abandoned=false;
      request.onupgradeneeded=()=>{for(const name of ['journals','drafts','photos']){const store=request.result.createObjectStore(name,{keyPath:'key'});store.createIndex('owner','owner');}};
      request.onblocked=()=>{abandoned=true;reject(Error('IndexedDB está bloqueado por otra conexión. No se borró la base.'));};
      request.onerror=()=>reject(request.error||Error('IndexedDB no está disponible.'));
      request.onsuccess=()=>{
        const db=request.result;if(abandoned){db.close();return;}
        db.onversionchange=()=>{db.close();if(this.db===db)this.db=null;};
        db.onclose=()=>{if(this.db===db)this.db=null;};
        let tx:IDBTransaction,get:IDBRequest;try{for(const name of ['journals','drafts','photos'])if(!db.objectStoreNames.contains(name))throw Error('Esquema local incompleto.');tx=db.transaction('journals','readonly');get=tx.objectStore('journals').index('owner').getAll(this.owner);}catch(e){db.close();reject(e);return;}let entries:Array<{key:string;raw:string}>=[];
        get.onsuccess=()=>{entries=get.result;};tx.onabort=()=>{db.close();reject(tx.error||Error('No pudimos leer las copias locales.'));};
        tx.oncomplete=()=>{try{const cache=new Map<string,string>();for(const row of entries){this.scoped(row.key);if(typeof row.raw!=='string')throw Error('Hay un registro local incompatible. Conservamos la base.');cache.set(row.key,row.raw);}this.cache=cache;this.db=db;resolve();}catch(e){db.close();reject(e);}};
      };
    }).finally(()=>{this.opening=null;});return this.opening;
  }
  get length(){return this.cache.size;}
  key(n:number){return [...this.cache.keys()][n]??null;}
  getItem(key:string){this.scoped(key);return this.cache.get(key)??null;}
  setItem():never{throw Error('IndexedDB requiere confirmación asíncrona.');}
  removeItem():never{throw Error('IndexedDB requiere confirmación asíncrona.');}
  private async write(stores:string[],kind:string,apply:(tx:IDBTransaction,fail:(e:unknown)=>void)=>void):Promise<void>{
    await this.ready();const db=this.db!;
    return new Promise((resolve,reject)=>{
      let tx:IDBTransaction;
      try{tx=db.transaction(stores,'readwrite',{durability:'strict'});}catch(e){if(!(e instanceof TypeError)){reject(e);return;}tx=db.transaction(stores,'readwrite');}
      let failure:unknown=null;const fail=(e:unknown)=>{failure=e;try{tx.abort();}catch{/* Already aborted. */}};
      tx.oncomplete=()=>resolve();tx.onabort=()=>reject(failure||tx.error||Error('La transacción local se interrumpió.'));
      try{apply(tx,fail);this.fault?.(kind,tx);}catch(e){fail(e);}
    });
  }
  async persist(key:string,raw:string):Promise<void>{
    this.scoped(key);
    await this.write(['journals'],'journal',(tx,fail)=>{const store=tx.objectStore('journals'),get=store.get(key);get.onsuccess=()=>{if(get.result&&(get.result.owner!==this.owner||get.result.raw!==raw)){fail(Error('La identidad local ya tiene otro contenido o propietario.'));return;}if(!get.result)store.add({key,owner:this.owner,raw});};});
    this.cache.set(key,raw);
  }
  async removePersisted(key:string,raw:string):Promise<void>{
    this.scoped(key);
    await this.write(['journals'],'remove',(tx,fail)=>{const store=tx.objectStore('journals'),get=store.get(key);get.onsuccess=()=>{if(get.result&&(get.result.owner!==this.owner||get.result.raw!==raw)){fail(Error('El candidato cambió; no se eliminará.'));return;}store.delete(key);};});this.cache.delete(key);
  }
  async archivePersisted(key:string,archive:string,raw:string):Promise<void>{
    this.scoped(key);this.scoped(archive);
    await this.write(['journals'],'archive',(tx,fail)=>{const store=tx.objectStore('journals'),a=store.get(key),b=store.get(archive);let count=0;const check=()=>{if(++count!==2)return;if((a.result&&(a.result.owner!==this.owner||a.result.raw!==raw))||(b.result&&(b.result.owner!==this.owner||b.result.raw!==raw))||(!a.result&&!b.result)){fail(Error('Las copias locales no coinciden.'));return;}if(!b.result)store.add({key:archive,owner:this.owner,raw});store.delete(key);};a.onsuccess=b.onsuccess=check;});this.cache.set(archive,raw);this.cache.delete(key);
  }
  async importLegacy(key:string,raw:string,sourceHash:string):Promise<void>{
    this.scoped(key);if(!key.startsWith(this.prefix+'pending:'))throw Error('No es un candidato anterior.');const marker=this.prefix+'legacy:'+key.slice((this.prefix+'pending:').length);
    await this.write(['journals'],'legacy',(tx,fail)=>{const s=tx.objectStore('journals'),get=s.get(key),mark=s.get(marker);let n=0;const check=()=>{if(++n!==2)return;if((get.result&&(get.result.owner!==this.owner||get.result.raw!==raw))||(mark.result&&(mark.result.owner!==this.owner||mark.result.raw!==sourceHash))){fail(Error('Existe otra versión de ese paquete.'));return;}if(!get.result)s.add({key,owner:this.owner,raw});if(!mark.result)s.add({key:marker,owner:this.owner,raw:sourceHash});};get.onsuccess=mark.onsuccess=check;});this.cache.set(key,raw);this.cache.set(marker,sourceHash);
  }
  async drafts():Promise<DraftRow[]>{await this.ready();return this.readAll<DraftRow>('drafts');}
  private readAll<T>(name:string):Promise<T[]>{return new Promise((resolve,reject)=>{const tx=this.db!.transaction(name,'readonly'),get=tx.objectStore(name).index('owner').getAll(this.owner);let values:T[]=[];get.onsuccess=()=>{values=get.result;};tx.oncomplete=()=>resolve(values);tx.onabort=()=>reject(tx.error);});}
  async saveDraft(id:string,generation:number,raw:string):Promise<DraftRow>{
    const key=this.prefix+'draft:'+id,row={key,owner:this.owner,id,generation:generation+1,raw,hash:await digest(raw)};
    await this.write(['drafts'],'draft',(tx,fail)=>{const s=tx.objectStore('drafts'),get=s.get(key);get.onsuccess=()=>{if((get.result?.generation||0)!==generation){fail(Error('El borrador cambió en otra sesión.'));return;}s.put(row);};});return row;
  }
  async deleteDraft(row:DraftRow):Promise<void>{this.scoped(row.key);await this.write(['drafts'],'delete-draft',(tx,fail)=>{const s=tx.objectStore('drafts'),get=s.get(row.key);get.onsuccess=()=>{if(get.result?.generation!==row.generation){fail(Error('La copia cambió. Vuelve a revisarla.'));return;}s.delete(row.key);};});}
  async savePhoto(id:string,context:PhotoRow['context'],file:File):Promise<PhotoRow>{
    if(file.size>12*1024*1024||!file.type.startsWith('image/'))throw Error('Solo fotos de hasta 12 MiB.');
    const row:PhotoRow={key:this.prefix+'photo:'+id,owner:this.owner,id,context:{...context},name:file.name,type:file.type,size:file.size,blob:file};
    await this.write(['photos'],'photo',(tx)=>{tx.objectStore('photos').add(row);});return row;
  }
  async photos():Promise<PhotoRow[]>{await this.ready();return this.readAll<PhotoRow>('photos');}
  close(){this.db?.close();this.db=null;}
}
