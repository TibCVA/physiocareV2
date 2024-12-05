const PatientStorageManager = {
    CONSTRAINTS: {
        maxFileSize: 10 * 1024 * 1024,
        maxTotalSize: 50 * 1024 * 1024,
        maxFiles: 5,
        allowedTypes: [
            'image/jpeg',
            'image/png', 
            'image/gif',
            'image/heic',
            'application/pdf'
        ]
    },
    class StorageManager {
        static async init() {
            if (this.db) return this.db;
            
            return new Promise((resolve, reject) => {
                const request = indexedDB.open('patient_documents_db', 1);
                
                request.onerror = () => reject(new Error('Erreur IndexedDB'));
                
                request.onupgradeneeded = (event) => {
                    const db = event.target.result;
                    if (!db.objectStoreNames.contains('documents')) {
                        db.createObjectStore('documents', { keyPath: 'id' });
                    }
                };
                
                request.onsuccess = (event) => {
                    this.db = event.target.result;
                    resolve(this.db);
                };
            });
        }
    
        static async saveDocument(doc) {
            const db = await this.init();
            return new Promise((resolve, reject) => {
                const transaction = db.transaction('documents', 'readwrite');
                const store = transaction.objectStore('documents');
                const request = store.put(doc);
                
                request.onsuccess = () => resolve(doc.id);
                request.onerror = () => reject(request.error);
            });
        }
    
        static async loadDocuments() {
            const db = await this.init();
            return new Promise((resolve, reject) => {
                const transaction = db.transaction('documents', 'readonly');
                const store = transaction.objectStore('documents');
                const request = store.getAll();
                
                request.onsuccess = () => resolve(request.result);
                request.onerror = () => reject(request.error);
            });
        }
    
        static async deleteDocument(id) {
            const db = await this.init();
            return new Promise((resolve, reject) => {
                const transaction = db.transaction('documents', 'readwrite');
                const store = transaction.objectStore('documents');
                const request = store.delete(id);
                
                request.onsuccess = () => resolve(id);
                request.onerror = () => reject(request.error);
            });
        }
    
        static async clearDocuments() {
            const db = await this.init();
            return new Promise((resolve, reject) => {
                const transaction = db.transaction('documents', 'readwrite');
                const store = transaction.objectStore('documents');
                const request = store.clear();
                
                request.onsuccess = () => resolve();
                request.onerror = () => reject(request.error);
            });
        }
    }
    
    window.StorageManager = StorageManager;
