// patient-storage.js
const PatientStorageManager = {
    CONSTRAINTS:{
        maxFileSize:10*1024*1024,
        maxTotalSize:50*1024*1024,
        allowedTypes:[
            'image/jpeg','image/png','image/gif','image/heic','application/pdf'
        ]
    },

    async initDB() {
        return new Promise((resolve,reject)=>{
            const request=indexedDB.open('patient_documents_db',1);
            request.onerror=()=>reject(new Error('Erreur IndexedDB'));
            request.onupgradeneeded=(event)=>{
                const db=event.target.result;
                if(!db.objectStoreNames.contains('documents')) {
                    db.createObjectStore('documents',{keyPath:'id'});
                }
            };
            request.onsuccess=(event)=>resolve(event.target.result);
        });
    },

    async saveDocuments(documents) {
        try {
            const validDocs=documents.filter(doc=>this.validateDocument(doc));
            if(validDocs.length===0)throw new Error('Aucun document valide à sauvegarder.');
            let totalSize=0;
            for(const doc of validDocs) {
                const size=this.getBase64Size(doc.fileData);
                totalSize+=size;
            }
            if(totalSize>this.CONSTRAINTS.maxTotalSize) {
                throw new Error(`Taille totale dépasse la limite.`);
            }

            const db=await this.initDB();
            const transaction=db.transaction('documents','readwrite');
            const store=transaction.objectStore('documents');
            await new Promise((res,rej)=>{
                const clearReq=store.clear();
                clearReq.onsuccess=()=>res();
                clearReq.onerror=()=>rej(new Error('Erreur clear IndexedDB'));
            });

            for(const doc of validDocs) {
                await new Promise((res,rej)=>{
                    const putReq=store.put(doc);
                    putReq.onsuccess=()=>res();
                    putReq.onerror=()=>rej(new Error('Erreur put IndexedDB'));
                });
            }

            localStorage.setItem('document_metadata',JSON.stringify(validDocs.map(({id,name,type})=>({id,name,type}))));

            return true;
        } catch(error) {
            console.error('[Storage] Erreur:',error);
            throw error;
        }
    },

    async loadDocuments() {
        try {
            const db=await this.initDB();
            const transaction=db.transaction('documents','readonly');
            const store=transaction.objectStore('documents');
            return new Promise((resolve,reject)=>{
                const req=store.getAll();
                req.onerror=()=>reject(new Error('Erreur lecture docs'));
                req.onsuccess=()=>resolve(req.result||[]);
            });
        } catch(error) {
            console.error('[Storage] Erreur chargement:',error);
            return [];
        }
    },

    getBase64Size(base64String) {
        if(!base64String)return 0;
        const base64Length=base64String.length;
        return Math.floor((base64Length*3)/4);
    },

    validateDocument(doc) {
        if(!doc?.fileData||!doc?.type)return false;
        if(!this.CONSTRAINTS.allowedTypes.includes(doc.type))return false;
        const size=this.getBase64Size(doc.fileData);
        if(size<=0||size>this.CONSTRAINTS.maxFileSize) {
            console.warn(`Fichier invalide : ${doc.name}`);
            return false;
        }
        return true;
    }
};

if(!window.PatientStorageManager) {
    window.PatientStorageManager=PatientStorageManager;
}
