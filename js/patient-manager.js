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

        Object.entries(this.elements).forEach(([key, element]) => {
            if (!element) {
                console.error(`Élément ${key} non trouvé dans le DOM`);
            }
        });
    }

    setupEventListeners() {
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

        this.elements.uploadButton?.addEventListener('click', () => {
            this.elements.fileInput?.click();
        });

        this.elements.fileInput?.addEventListener('change', async (e) => {
            await this.handleFiles(e.target.files);
        });

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
                const base64Data = e.target.result.split(',')[1]; // Supprime le préfixe "data:<type>;base64,"
                if (!base64Data) {
                    reject(new Error(`Erreur de conversion Base64 pour le fichier : ${file.name}`));
                }

                resolve({
                    id: crypto.randomUUID(),
                    name: file.name,
                    type: file.type,
                    size: file.size,
                    fileData: base64Data // Stockage uniquement du contenu Base64
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

// Export des classes dans l'objet window
window.DocumentManager = DocumentManager;

// Initialisation au chargement de la page
document.addEventListener('DOMContentLoaded', () => {
    try {
        if (!window.PatientStorageManager) {
            throw new Error('PatientStorageManager doit être chargé avant patient-manager.js');
        }

        const pathname = window.location.pathname;
        if (pathname.includes('documents.html')) {
            window.documentManager = new DocumentManager();
            console.log('DocumentManager initialisé');
        }
    } catch (error) {
        console.error('Erreur initialisation:', error);
    }
});
