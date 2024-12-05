const PatientStorageManager = {
    CONSTRAINTS: {
        maxFileSize: 10 * 1024 * 1024,
        maxTotalSize: 50 * 1024 * 1024,
        maxFiles: 5,
        allowedTypes: ['image/jpeg', 'image/png', 'image/gif', 'image/heic', 'application/pdf']
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
            const totalSize = documents.reduce((sum, doc) => 
                sum + this.getBase64Size(doc.fileData), 0);
                
            if (totalSize > this.CONSTRAINTS.maxTotalSize) {
                throw new Error(`Taille totale dépassée: ${totalSize}`);
            }

            const db = await this.initDB();
            const transaction = db.transaction('documents', 'readwrite');
            const store = transaction.objectStore('documents');

            await store.clear();
            await Promise.all(documents.map(doc => store.put(doc)));

            const metadata = documents.map(({id, name, type}) => ({
                id, name, type
            }));
            localStorage.setItem('document_metadata', JSON.stringify(metadata));

            return true;
        } catch (error) {
            console.error('[Storage] Erreur sauvegarde:', error);
            throw error;
        }
    },

    async loadDocuments() {
        try {
            const db = await this.initDB();
            const transaction = db.transaction('documents', 'readonly');
            const store = transaction.objectStore('documents');
            
            return new Promise((resolve, reject) => {
                const request = store.getAll();
                request.onerror = () => reject(new Error('Erreur lecture'));
                request.onsuccess = () => resolve(request.result);
            });
        } catch (error) {
            console.error('[Storage] Erreur chargement:', error);
            return [];
        }
    },

    getBase64Size(base64String) {
        const base64Length = base64String.substring(base64String.indexOf(',') + 1).length;
        return Math.floor((base64Length * 3) / 4);
    },

    validateDocument(doc) {
        if (!doc?.fileData || !doc?.type) return false;
        if (!this.CONSTRAINTS.allowedTypes.includes(doc.type)) return false;
        const size = this.getBase64Size(doc.fileData);
        return size <= this.CONSTRAINTS.maxFileSize;
    }
};

window.PatientStorageManager = PatientStorageManager;
