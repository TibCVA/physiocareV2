/**
 * Patient Manager - PhysioCare
 * Gestion des documents et diagnostics patients
 */

// Gestionnaire de Documents
class DocumentManager {
    constructor() {
        this.storage = window.PatientStorageManager;
        this.initializeElements();
        this.setupEventListeners();
        this.loadSavedDocuments();
    }

    initializeElements() {
        this.elements = {
            dropZone: document.getElementById('dropZone'),
            fileInput: document.getElementById('fileInput'),
            uploadButton: document.getElementById('uploadButton'),
            documentList: document.getElementById('documentList'),
            errorMessage: document.getElementById('errorMessage'),
            notes: document.getElementById('notes')
        };

        // Vérification des éléments requis
        Object.entries(this.elements).forEach(([key, element]) => {
            if (!element) {
                console.error(`Élément ${key} non trouvé dans le DOM`);
            }
        });
    }

    setupEventListeners() {
        // Gestion du drag & drop
        const dropZone = this.elements.dropZone;
        if (dropZone) {
            ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
                dropZone.addEventListener(eventName, (e) => {
                    e.preventDefault();
                    e.stopPropagation();
                });
            });

            dropZone.addEventListener('dragover', () => {
                dropZone.classList.add('border-brand-light', 'bg-brand-light/10');
            });

            dropZone.addEventListener('dragleave', () => {
                dropZone.classList.remove('border-brand-light', 'bg-brand-light/10');
            });

            dropZone.addEventListener('drop', async (e) => {
                dropZone.classList.remove('border-brand-light', 'bg-brand-light/10');
                await this.handleFiles(e.dataTransfer.files);
            });
        }

        // Gestion de l'upload par bouton
        this.elements.uploadButton?.addEventListener('click', () => {
            this.elements.fileInput?.click();
        });

        this.elements.fileInput?.addEventListener('change', async (e) => {
            await this.handleFiles(e.target.files);
        });

        // Gestion des notes
        this.elements.notes?.addEventListener('input', () => this.saveCurrentData());
    }

    async handleFiles(fileList) {
        try {
            const files = Array.from(fileList);
            if (files.length === 0) return;

            const documents = await Promise.all(files.map(this.processFile.bind(this)));
            const validDocuments = documents.filter(Boolean);

            if (validDocuments.length) {
                await this.storage.saveDocuments(validDocuments);
                await this.loadSavedDocuments();
                this.showSuccess(`${validDocuments.length} document(s) ajouté(s)`);
            }
        } catch (error) {
            this.showError(error.message);
        }
    }

    async processFile(file) {
        if (!this.storage.CONSTRAINTS.allowedTypes.includes(file.type)) {
            this.showError(`Type de fichier non supporté: ${file.type}`);
            return null;
        }

        if (file.size > this.storage.CONSTRAINTS.maxFileSize) {
            this.showError(`Fichier trop volumineux: ${file.name}`);
            return null;
        }

        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = (e) => {
                resolve({
                    id: crypto.randomUUID(),
                    name: file.name,
                    type: file.type,
                    size: file.size,
                    fileData: e.target.result
                });
            };
            reader.onerror = () => reject(new Error('Erreur de lecture du fichier'));
            reader.readAsDataURL(file);
        });
    }

    async loadSavedDocuments() {
        const documents = await this.storage.loadDocuments();
        this.elements.documentList.innerHTML = '';

        documents.forEach(doc => {
            const element = this.createDocumentElement(doc);
            this.elements.documentList.appendChild(element);
        });
    }

    createDocumentElement(doc) {
        const div = document.createElement('div');
        div.className = 'document-item';
        div.innerHTML = `
            <div class="flex items-center justify-between">
                <div>
                    <h3 class="font-medium">${this.sanitizeString(doc.name)}</h3>
                    <p class="text-sm opacity-70">${this.formatFileSize(doc.size)}</p>
                </div>
                <button class="text-red-500 hover:text-red-700" data-id="${doc.id}">
                    <svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" 
                              d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/>
                    </svg>
                </button>
            </div>
        `;

        div.querySelector('button').addEventListener('click', async () => {
            await this.deleteDocument(doc.id);
        });

        return div;
    }

    async deleteDocument(id) {
        try {
            const documents = await this.storage.loadDocuments();
            const updatedDocuments = documents.filter(doc => doc.id !== id);
            await this.storage.saveDocuments(updatedDocuments);
            await this.loadSavedDocuments();
        } catch (error) {
            this.showError('Erreur lors de la suppression');
        }
    }

    sanitizeString(str) {
        return str.replace(/[<>&"']/g, '');
    }

    formatFileSize(bytes) {
        if (bytes < 1024) return bytes + ' B';
        if (bytes < 1048576) return (bytes / 1024).toFixed(1) + ' KB';
        return (bytes / 1048576).toFixed(1) + ' MB';
    }

    showError(message) {
        this.elements.errorMessage.textContent = message;
        this.elements.errorMessage.className = 'error-message bg-red-100 border-red-400 text-red-700';
        this.elements.errorMessage.style.display = 'block';
        setTimeout(() => {
            this.elements.errorMessage.style.display = 'none';
        }, 5000);
    }

    showSuccess(message) {
        this.elements.errorMessage.textContent = message;
        this.elements.errorMessage.className = 'error-message bg-green-100 border-green-400 text-green-700';
        this.elements.errorMessage.style.display = 'block';
        setTimeout(() => {
            this.elements.errorMessage.style.display = 'none';
        }, 3000);
    }

    async saveCurrentData() {
        const notes = this.elements.notes.value;
        localStorage.setItem('document_notes', notes);
    }
}

// Gestionnaire de Diagnostic
class DiagnosticManager {
    constructor() {
        if (!window.PatientStorageManager) {
            throw new Error('PatientStorageManager non initialisé');
        }
        this.storageManager = window.PatientStorageManager;
        this.abortController = null;
        this.pendingRequests = new Set();
        this.initializeElements();
        this.setupEventListeners();
        this.loadSavedDiagnosis();
    }

    initializeElements() {
        this.elements = {
            remarksInput: document.getElementById('remarks'),
            startButton: document.getElementById('startAnalysis'),
            loadingSection: document.getElementById('loadingSection'),
            resultsSection: document.getElementById('resultsSection'),
            diagnosticResults: document.getElementById('diagnosticResults'),
            validationButton: document.querySelector('.validation-button'),
            remarksSection: document.getElementById('remarksSection')
        };

        Object.entries(this.elements).forEach(([key, element]) => {
            if (!element) {
                console.error(`Élément ${key} non trouvé dans le DOM`);
            }
        });
    }

    setupEventListeners() {
        if (this.elements.startButton) {
            this.elements.startButton.addEventListener('click', () => this.startAnalysis());
        }

        if (this.elements.validationButton) {
            this.elements.validationButton.addEventListener('click', () => this.validateAndContinue());
        }

        window.addEventListener('beforeunload', () => {
            this.abortController?.abort();
            this.pendingRequests.forEach(request => request.abort());
        });
    }

    async loadSavedDiagnosis() {
        try {
            const savedData = this.loadStorageData('patient_diagnosis');
            if (savedData?.diagnoses?.length) {
                this.displayResults(savedData.diagnoses);
            }
        } catch (error) {
            console.error('Erreur chargement diagnostic:', error);
        }
    }

    async gatherPatientData() {
        try {
            const docs = await this.storageManager.loadDocuments();
            const validDocs = docs.filter(doc => {
                try {
                    return doc && doc.fileData && 
                           this.validateDocumentSize(doc) && 
                           this.validateDocumentType(doc.type);
                } catch {
                    return false;
                }
            });

            return {
                personalInfo: this.loadStorageData('patient_personal_info'),
                physicalActivity: this.loadStorageData('patient_physical_activity'),
                symptoms: this.loadStorageData('patient_symptoms'),
                documents: validDocs,
                remarks: this.elements.remarksInput?.value?.trim() || ''
            };
        } catch (error) {
            console.error('Erreur collecte données:', error);
            return {
                personalInfo: {},
                physicalActivity: {},
                symptoms: {},
                documents: [],
                remarks: this.elements.remarksInput?.value?.trim() || ''
            };
        }
    }

    async startAnalysis() {
        try {
            this.showLoading();
            const data = await this.gatherPatientData();
            const response = await this.sendToAPI(data);
            await this.handleResponse(response);
        } catch (error) {
            this.showError(error.message);
        }
    }

    async sendToAPI(data) {
        console.log('Préparation données API:', {
            personalInfo: data.personalInfo,
            physicalActivity: data.physicalActivity,
            symptoms: data.symptoms,
            documentsCount: data.documents?.length || 0,
            remarks: data.remarks
        });
    
        this.abortController = new AbortController();
        this.pendingRequests.add(this.abortController);
    
        try {
            // Préparation des documents
            const processedDocs = data.documents?.map(doc => {
                console.log('Traitement document:', {
                    name: doc.name,
                    type: doc.type,
                    size: doc.fileData.length
                });
    
                return {
                    id: doc.id,
                    name: doc.name,
                    type: doc.type,
                    size: doc.size,
                    fileData: `data:${doc.type};base64,${doc.fileData.split('base64,')[1]}`
                };
            }) || [];
    
            const payload = {
                type: 'diagnosis',
                data: {
                    ...data,
                    documents: processedDocs
                }
            };
    
            console.log('Envoi requête API avec payload:', {
                type: payload.type,
                dataKeys: Object.keys(payload.data),
                documentsCount: payload.data.documents.length
            });
    
            const response = await fetch('https://physiocare-api.b00135522.workers.dev', {
                method: 'POST',
                signal: this.abortController.signal,
                headers: {
                    'Content-Type': 'application/json',
                    'Accept': 'application/json'
                },
                body: JSON.stringify(payload)
            });
    
            if (!response.ok) {
                const errorText = await response.text();
                console.error('Erreur API détaillée:', {
                    status: response.status,
                    statusText: response.statusText,
                    error: errorText
                });
                throw new Error(`Erreur API: ${response.status} - ${errorText}`);
            }
    
            const result = await response.json();
            console.log('Réponse API reçue:', result);
            return result;
    
        } catch (error) {
            console.error('Erreur lors de l\'envoi:', {
                name: error.name,
                message: error.message,
                stack: error.stack
            });
            throw error;
        } finally {
            this.pendingRequests.delete(this.abortController);
        }
    }
    async handleResponse(response) {
        if (!response?.diagnoses?.length) {
            throw new Error('Réponse invalide');
        }

        await this.saveResults(response);
        this.displayResults(response.diagnoses);
    }

    displayResults(diagnoses) {
        this.elements.loadingSection.classList.add('hidden');
        this.elements.diagnosticResults.innerHTML = '';

        diagnoses.forEach(diagnostic => {
            const element = this.createDiagnosticElement(diagnostic);
            this.elements.diagnosticResults.appendChild(element);
        });

        this.elements.resultsSection.classList.remove('hidden');
    }

    createDiagnosticElement(diagnostic) {
        const element = document.createElement('div');
        element.className = `diagnostic-item ${diagnostic.probability >= 80 ? 'primary' : ''}`;
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
            <button class="expand-button" onclick="window.diagnosticManager.toggleDetails(this)">
                Voir les détails
                <svg class="w-5 h-5 transform transition-transform duration-200"
                     fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path stroke-linecap="round" stroke-linejoin="round"
                          stroke-width="2" d="M19 9l-7 7-7-7"/>
                </svg>
            </button>
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
                `).join('')}
            </div>
        `;
    }

    toggleDetails(button) {
        const details = button.nextElementSibling;
        const expanded = !details.classList.contains('expanded');
        details.classList.toggle('expanded');
        button.querySelector('svg').style.transform = expanded ? 'rotate(180deg)' : '';
    }

    validateDocumentSize(doc) {
        const size = this.getBase64Size(doc.fileData);
        return size <= this.storageManager.CONSTRAINTS.maxFileSize;
    }

    validateDocumentType(type) {
        return this.storageManager.CONSTRAINTS.allowedTypes.includes(type.toLowerCase());
    }

    getBase64Size(base64String) {
        try {
            const base64Length = base64String.substring(base64String.indexOf(',') + 1).length;
            return Math.floor((base64Length * 3) / 4);
        } catch {
            return Infinity;
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

    async saveResults(data) {
        try {
            localStorage.setItem('patient_diagnosis', JSON.stringify(data));
            return true;
        } catch (error) {
            console.error('Erreur sauvegarde résultats:', error);
            return false;
        }
    }

    showLoading() {
        this.elements.remarksSection.classList.add('hidden');
        this.elements.loadingSection.classList.remove('hidden');
    }

    showError(message) {
        this.elements.loadingSection.classList.add('hidden');
        this.elements.remarksSection.classList.remove('hidden');

        const errorDiv = document.createElement('div');
        errorDiv.className = 'bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded relative mb-4';
        errorDiv.textContent = message;

        this.elements.remarksSection.insertBefore(errorDiv, this.elements.remarksSection.firstChild);
        setTimeout(() => errorDiv.remove(), 5000);
    }

    sanitizeString(str) {
        if (!str || typeof str !== 'string') return '';
        return str.trim().replace(/[<>&"']/g, '');
    }

    async validateAndContinue() {
        try {
            const currentData = this.loadStorageData('patient_diagnosis');
            if (!currentData?.diagnoses?.length) {
                throw new Error('Aucun diagnostic à sauvegarder');
            }
            window.location.href = 'treatment.html';
        } catch (error) {
            this.showError(error.message);
        }
    }
}

// Export des classes dans l'objet window
window.DocumentManager = DocumentManager;
window.DiagnosticManager = DiagnosticManager;

// Initialisation au chargement de la page
document.addEventListener('DOMContentLoaded', () => {
    try {
        // Vérification de PatientStorageManager
        if (!window.PatientStorageManager) {
            throw new Error('PatientStorageManager doit être chargé avant patient-manager.js');
        }

        // Initialisation en fonction de la page courante
        const pathname = window.location.pathname;
        if (pathname.includes('documents.html')) {
            window.documentManager = new DocumentManager();
            console.log('DocumentManager initialisé');
        } else if (pathname.includes('diagnosis.html')) {
            window.diagnosticManager = new DiagnosticManager();
            console.log('DiagnosticManager initialisé');
        }
    } catch (error) {
        console.error('Erreur initialisation:', error);
    }
});
