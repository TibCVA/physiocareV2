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
            // Validation et journaux pour chaque document
            const validDocuments = documents.filter(doc => {
                const isValid = this.validateDocument(doc);
                console.log(`[DEBUG] Document ${doc.name} validité :`, isValid ? 'Valide' : 'Invalide');
                return isValid;
            });
    
            if (validDocuments.length === 0) {
                throw new Error('Aucun document valide à sauvegarder.');
            }
    
            // Calcul de la taille totale
            const totalSize = validDocuments.reduce((sum, doc) => 
                sum + this.getBase64Size(doc.fileData), 0);
    
            if (totalSize > this.CONSTRAINTS.maxTotalSize) {
                throw new Error(`La taille totale des fichiers (${(totalSize / 1024 / 1024).toFixed(2)} MB) dépasse la limite de ${this.CONSTRAINTS.maxTotalSize / 1024 / 1024} MB.`);
            }
    
            // Initialisation de la base de données
            const db = await this.initDB();
            const transaction = db.transaction('documents', 'readwrite');
            const store = transaction.objectStore('documents');
    
            // Nettoyage précédent et sauvegarde des nouveaux documents
            await store.clear();
            await Promise.all(validDocuments.map(doc => store.put(doc)));
    
            // Mise à jour des métadonnées dans le stockage local
            const metadata = validDocuments.map(({ id, name, type }) => ({
                id, name, type
            }));
            localStorage.setItem('document_metadata', JSON.stringify(metadata));
    
            console.log(`[INFO] ${validDocuments.length} document(s) sauvegardé(s) avec succès.`);
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
        if (!base64String) return 0;
        const base64Length = base64String.length; // Longueur directe du contenu Base64
        return Math.floor((base64Length * 3) / 4);
    }


    validateDocument(doc) {
        if (!doc?.fileData || !doc?.type) return false;
    
        // Vérifiez si le type MIME est supporté
        if (!this.CONSTRAINTS.allowedTypes.includes(doc.type)) return false;
    
        // Vérifiez si la taille Base64 est correcte
        const size = this.getBase64Size(doc.fileData);
        if (size <= 0 || size > this.CONSTRAINTS.maxFileSize) {
            console.warn(`Fichier invalide : ${doc.name} dépasse la taille autorisée ou est mal encodé.`);
            return false;
        }
    
        return true;
    };


// Exposition globale
window.PatientStorageManager = PatientStorageManager;
