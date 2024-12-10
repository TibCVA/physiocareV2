// patient-storage.js
const PatientStorageManager = {
    CONSTRAINTS: {
        maxFileSize: 10 * 1024 * 1024,   // 10 MB
        maxTotalSize: 50 * 1024 * 1024, // 50 MB
        allowedTypes: [
            'image/jpeg',
            'image/png',
            'image/gif',
            'image/heic',
            'application/pdf'
        ]
    },

    async initDB() {
        return new Promise((resolve, reject) => {
            const request = indexedDB.open('patient_documents_db', 1);
            request.onerror = () => reject(new Error('Erreur IndexedDB'));
            request.onupgradeneeded = (event) => {
                const db = event.target.result;
                if (!db.objectStoreNames.contains('documents')) {
                    db.createObjectStore('documents', { keyPath: 'id' });
                }
            };
            request.onsuccess = (event) => resolve(event.target.result);
        });
    },

    async saveDocuments(documents) {
        try {
            const pid = window.patientManager?.currentPatientId;
            if(!pid) {
                throw new Error("Aucun patient sélectionné.");
            }

            const validDocs = documents.filter(doc => this.validateDocument(doc));

            let totalSize = 0;
            for (const doc of validDocs) {
                const size = this.getBase64Size(doc.fileData);
                totalSize += size;
            }
            if (totalSize > this.CONSTRAINTS.maxTotalSize) {
                throw new Error(`La taille totale des fichiers dépasse la limite autorisée.`);
            }

            const db = await this.initDB();
            const transaction = db.transaction('documents', 'readwrite');
            const store = transaction.objectStore('documents');

            const allDocs = await new Promise((res, rej) => {
                const req = store.getAll();
                req.onsuccess = () => res(req.result||[]);
                req.onerror = () => rej(new Error('Erreur lecture documents'));
            });

            // Supprimer les docs du patient courant
            for(const d of allDocs) {
                if(d.id.startsWith(pid+'_')) {
                    await new Promise((res, rej) => {
                        const delReq = store.delete(d.id);
                        delReq.onsuccess=()=>res();
                        delReq.onerror=()=>rej(new Error('Erreur suppression doc patient'));
                    });
                }
            }

            // Ajouter les nouveaux documents avec id préfixé par pid
            for (const doc of validDocs) {
                doc.id = pid + '_' + crypto.randomUUID(); 
                await new Promise((res, rej) => {
                    const putReq = store.put(doc);
                    putReq.onsuccess = () => res();
                    putReq.onerror = () => rej(new Error('Erreur lors de l\'enregistrement du document'));
                });
            }

            // Retirer le code de métadonnées inutilisé
            // Aucune métadonnée n'est enregistrée, ce qui évite les interférences.

            return true;
        } catch (error) {
            console.error('[Storage] Erreur:', error);
            throw error;
        }
    },

    async loadDocuments() {
        try {
            const pid = window.patientManager?.currentPatientId;
            if(!pid) {
                return [];
            }

            const db = await this.initDB();
            const transaction = db.transaction('documents', 'readonly');
            const store = transaction.objectStore('documents');

            const allDocs = await new Promise((resolve, reject) => {
                const req = store.getAll();
                req.onerror = () => reject(new Error('Erreur lors de la lecture des documents'));
                req.onsuccess = () => resolve(req.result || []);
            });

            return allDocs.filter(d=>d.id.startsWith(pid+'_'));
        } catch (error) {
            console.error('[Storage] Erreur chargement:', error);
            return [];
        }
    },

    getBase64Size(base64String) {
        if (!base64String) return 0;
        const base64Length = base64String.length;
        return Math.floor((base64Length * 3) / 4);
    },

    validateDocument(doc) {
        if (!doc?.fileData || !doc?.type) return false;
        if (!this.CONSTRAINTS.allowedTypes.includes(doc.type)) return false;

        const size = this.getBase64Size(doc.fileData);
        if (size <= 0 || size > this.CONSTRAINTS.maxFileSize) {
            console.warn(`Fichier invalide : ${doc.name}, type: ${doc.type}, taille: ${size}`);
            return false;
        }

        return true;
    }
};

if (!window.PatientStorageManager) {
    window.PatientStorageManager = PatientStorageManager;
}