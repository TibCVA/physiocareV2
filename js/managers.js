// Gestionnaire unifié de stockage
const StorageManager = {
    // Constantes partagées
    CONSTRAINTS: {
        maxFileSize: 10 * 1024 * 1024,
        maxTotalSize: 50 * 1024 * 1024,
        maxFiles: 5,
        allowedTypes: ['image/jpeg', 'image/png', 'image/gif', 'application/pdf']
    },

    // Gestion IndexedDB
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

    // Sauvegarde synchronisée
    async saveDocuments(documents) {
        try {
            // Validation taille totale
            const totalSize = documents.reduce((sum, doc) => 
                sum + this.getBase64Size(doc.fileData), 0);
                
            if (totalSize > this.CONSTRAINTS.maxTotalSize) {
                throw new Error(`Taille totale dépassée: ${totalSize}`);
            }

            // Sauvegarde IndexedDB
            const db = await this.initDB();
            const transaction = db.transaction('documents', 'readwrite');
            const store = transaction.objectStore('documents');

            // Nettoyage et insertion
            await store.clear();
            for (const doc of documents) {
                await store.add(doc);
            }

            // Sauvegarde localStorage (métadonnées uniquement)
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

    // Chargement synchronisé
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

    // Utilitaires
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

// Gestionnaire de documents amélioré
class DocumentManager {
    constructor() {
        this.storage = StorageManager;
        this.processingLock = false;
        this.initializeElements();
        this.setupEventListeners();
    }

    initializeElements() {
        this.dropZone = document.getElementById('dropZone');
        this.fileInput = document.getElementById('fileInput');
        this.documentList = document.getElementById('documentList');
        this.errorMessage = document.getElementById('errorMessage');
        
        if (!this.dropZone || !this.fileInput || !this.documentList) {
            throw new Error('Éléments requis manquants');
        }
    }

    setupEventListeners() {
        // Gestion tactile iOS optimisée
        const touchOptions = { passive: true };
        
        this.dropZone.addEventListener('touchstart', (e) => {
            e.stopPropagation();
        }, touchOptions);

        this.dropZone.addEventListener('touchend', (e) => {
            e.preventDefault();
            e.stopPropagation();
            this.fileInput.click();
        }, { passive: false });

        // Gestion fichiers
        this.fileInput.addEventListener('change', () => {
            if (this.fileInput.files.length) {
                this.handleFiles(this.fileInput.files);
            }
        }, touchOptions);

        // Drag & Drop
        this.dropZone.addEventListener('dragover', (e) => {
            e.preventDefault();
            this.dropZone.classList.add('dragover');
        });

        this.dropZone.addEventListener('dragleave', () => {
            this.dropZone.classList.remove('dragover');
        });

        this.dropZone.addEventListener('drop', (e) => {
            e.preventDefault();
            this.dropZone.classList.remove('dragover');
            this.handleFiles(e.dataTransfer.files);
        });
    }

    async handleFiles(files) {
        if (this.processingLock) return;
        this.processingLock = true;

        try {
            const currentFiles = await this.storage.loadDocuments();
            const totalFiles = currentFiles.length + files.length;

            if (totalFiles > this.storage.CONSTRAINTS.maxFiles) {
                throw new Error(`Maximum ${this.storage.CONSTRAINTS.maxFiles} fichiers`);
            }

            // Traitement par lots
            const processedFiles = await Promise.all(
                Array.from(files).map(file => this.processFile(file))
            );

            // Mise à jour stockage
            const validFiles = processedFiles.filter(Boolean);
            await this.storage.saveDocuments([...currentFiles, ...validFiles]);

            // Mise à jour UI
            this.updateDocumentList();

        } catch (error) {
            console.error('[Documents] Erreur:', error);
            this.showError(error.message);
        } finally {
            this.processingLock = false;
        }
    }

    async processFile(file) {
        try {
            if (!this.storage.CONSTRAINTS.allowedTypes.includes(file.type)) {
                throw new Error('Type non supporté');
            }

            const base64 = await this.fileToBase64(file);
            const doc = {
                id: Date.now() + '-' + Math.random().toString(36).substr(2, 9),
                name: file.name,
                type: file.type,
                fileData: base64
            };

            if (!this.storage.validateDocument(doc)) {
                throw new Error('Validation échouée');
            }

            return doc;
        } catch (error) {
            console.error('[File] Erreur process:', error);
            return null;
        }
    }

    fileToBase64(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve(reader.result);
            reader.onerror = () => reject(new Error('Erreur lecture'));
            reader.readAsDataURL(file);
        });
    }

    async updateDocumentList() {
        const documents = await this.storage.loadDocuments();
        this.documentList.innerHTML = '';

        documents.forEach(doc => {
            const item = this.createDocumentItem(doc);
            this.documentList.appendChild(item);
        });
    }

    createDocumentItem(doc) {
        const item = document.createElement('div');
        item.className = 'document-item';
        item.dataset.id = doc.id;

        item.innerHTML = `
            <div class="flex items-center gap-3">
                <div>
                    <p class="font-medium">${doc.name}</p>
                    <p class="text-sm opacity-70">
                        ${doc.type} - ${Math.round(this.storage.getBase64Size(doc.fileData) / 1024)}KB
                    </p>
                </div>
            </div>
            <button class="delete-btn">Supprimer</button>
        `;

        item.querySelector('.delete-btn').addEventListener('click', async () => {
            await this.deleteDocument(doc.id);
        });

        return item;
    }

    async deleteDocument(id) {
        try {
            const documents = await this.storage.loadDocuments();
            const updated = documents.filter(doc => doc.id !== id);
            await this.storage.saveDocuments(updated);
            this.updateDocumentList();
        } catch (error) {
            console.error('[Delete] Erreur:', error);
            this.showError('Erreur suppression');
        }
    }

    showError(message) {
        this.errorMessage.textContent = message;
        this.errorMessage.style.display = 'block';
        setTimeout(() => {
            this.errorMessage.style.display = 'none';
        }, 3000);
    }
}

// Gestionnaire de diagnostic amélioré
class DiagnosticManager {
    constructor() {
        this.storage = StorageManager;
        this.initializeElements();
        this.setupEventListeners();
    }

    initializeElements() {
        this.sections = {
            remarks: document.getElementById('remarksSection'),
            loading: document.getElementById('loadingSection'),
            results: document.getElementById('resultsSection'),
            validation: document.getElementById('validationSection')
        };
        
        this.diagnosticResults = document.getElementById('diagnosticResults');
        
        // Validation présence éléments
        Object.entries(this.sections).forEach(([key, element]) => {
            if (!element) throw new Error(`Section ${key} manquante`);
        });
    }

    setupEventListeners() {
        document.getElementById('startAnalysis')?.addEventListener(
            'click', 
            this.handleStartAnalysis.bind(this)
        );

        document.querySelector('.validation-button')?.addEventListener(
            'click',
            this.handleValidation.bind(this)
        );
    }

    async handleStartAnalysis() {
        try {
            this.showLoading();
            
            // Collecte données
            const data = await this.gatherPatientData();
            console.log('[Analysis] Données:', data);
            
            // Appel API
            const diagnosis = await this.requestDiagnosis(data);
            console.log('[Analysis] Résultat:', diagnosis);
            
            // Affichage
            this.displayResults(diagnosis);
            await this.saveResults();
            
        } catch (error) {
            console.error('[Analysis] Erreur:', error);
            this.handleError(error);
        }
    }

    async gatherPatientData() {
        try {
            // Chargement documents
            const documents = await this.storage.loadDocuments();
            console.log('[Data] Documents chargés:', documents.length);

            // Validation documents
            const validDocs = documents.filter(doc => 
                this.storage.validateDocument(doc)
            );
            console.log('[Data] Documents valides:', validDocs.length);

            // Données complètes
            return {
                personalInfo: this.loadStorageData('patient_personal_info'),
                physicalActivity: this.loadStorageData('patient_physical_activity'),
                symptoms: this.loadStorageData('patient_symptoms'),
                documents: validDocs,
                remarks: document.getElementById('remarks')?.value?.trim() || ''
            };
        } catch (error) {
            console.error('[Data] Erreur collecte:', error);
            throw error;
        }
    }

    loadStorageData(key) {
        try {
            const data = localStorage.getItem(key);
            return data ? JSON.parse(data) : {};
        } catch {
            return {};
        }
    }

    async requestDiagnosis(data) {
        try {
            const response = await fetch('https://physiocare-api.b00135522.workers.dev', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    type: 'diagnosis',
                    data: data
                })
            });

            if (!response.ok) {
                throw new Error(`Erreur API: ${response.status}`);
            }

            const result = await response.json();
            console.log('[API] Réponse:', result);
            return result;

        } catch (error) {
            console.error('[API] Erreur:', error);
            throw error;
        }
    }

    displayResults(data) {
        this.sections.loading.classList.add('hidden');
        this.diagnosticResults.innerHTML = '';

        data.diagnostics?.forEach(diagnostic => {
            const element = this.createDiagnosticElement(diagnostic);
            this.diagnosticResults.appendChild(element);
        });

        this.sections.results.classList.remove('hidden');
        this.sections.validation.classList.remove('hidden');
    }

    createDiagnosticElement(diagnostic) {
        const element = document.createElement('div');
        element.className = `diagnostic-item ${
            diagnostic.probability >= 80 ? 'primary' : ''
        }`;

        element.innerHTML = this.getDiagnosticTemplate(diagnostic);
        return element;
    }

    getDiagnosticTemplate(diagnostic) {
        return `
            <div class="flex justify-between items-start">
                <div>
                    <h3 class="font-semibold text-lg">
                        ${this.sanitizeString(diagnostic.name)}
                    </h3>
                    <p class="text-sm opacity-70">
                        ${this.sanitizeString(diagnostic.shortDescription)}
                    </p>
                </div>
                <span class="font-semibold">${diagnostic.probability}%</span>
            </div>
            <div class="probability-bar">
                <div class="probability-bar-fill" 
                     style="width: ${diagnostic.probability}%">
                </div>
            </div>
            <div class="diagnostic-details">
                ${diagnostic.details.map(detail => `
                    <div class="details-section">
                        <h4 class="font-medium mb-2">
                            ${this.sanitizeString(detail.title)}
                        </h4>
                        <p class="text-sm opacity-80">
                            ${this.sanitizeString(detail.content)}
                        </p>
                    </div>
                            `;
                        }
                    
                        sanitizeString(str) {
                            if (!str || typeof str !== 'string') return '';
                            return str.trim().replace(/[<>]/g, '');
                        }
                    
                        async saveResults() {
                            try {
                                const data = {
                                    remarks: document.getElementById('remarks')?.value || '',
                                    diagnoses: Array.from(this.diagnosticResults.children)
                                        .map(this.extractDiagnosticData.bind(this))
                                };
                                
                                localStorage.setItem('patient_diagnosis', JSON.stringify(data));
                                return true;
                            } catch (error) {
                                console.error('[Save] Erreur:', error);
                                return false;
                            }
                        }
                    
                        extractDiagnosticData(element) {
                            return {
                                name: element.querySelector('h3')?.textContent || '',
                                probability: parseInt(
                                    element.querySelector('.probability-bar-fill')?.style.width
                                ) || 0,
                                shortDescription: element.querySelector('p.opacity-70')?.textContent || '',
                                details: Array.from(element.querySelectorAll('.details-section'))
                                    .map(section => ({
                                        title: section.querySelector('h4')?.textContent || '',
                                        content: section.querySelector('p')?.textContent || ''
                                    }))
                            };
                        }
                    
                        handleError(error) {
                            this.sections.loading.classList.add('hidden');
                            this.sections.remarks.classList.remove('hidden');
                            this.showError(`Erreur: ${error.message}`);
                        }
                    
                        showError(message) {
                            // TODO: Implémenter l'affichage d'erreur UI
                            alert(message);
                        }
                    
                        showLoading() {
                            this.sections.remarks.classList.add('hidden');
                            this.sections.loading.classList.remove('hidden');
                        }
                    }
                    
                    // Initialisation
                    document.addEventListener('DOMContentLoaded', () => {
                        if (window.location.pathname.includes('documents.html')) {
                            window.documentManager = new DocumentManager();
                        } else if (window.location.pathname.includes('diagnosis.html')) {
                            window.diagnosticManager = new DiagnosticManager();
                        }
                    });
