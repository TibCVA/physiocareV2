class DocumentManager {
    constructor() {
        this.storageManager = window.PatientStorageManager;
        this.initializeElements();
        this.setupEventListeners();
        this.loadDocuments();
    }

    initializeElements() {
        this.uploadButton = document.getElementById('uploadButton');
        this.fileInput = document.getElementById('fileInput');
        this.dropZone = document.getElementById('dropZone'); 
        this.documentList = document.getElementById('documentList');
        this.errorMessage = document.getElementById('errorMessage');
        this.notesTextarea = document.getElementById('notes');
    }

    async loadDocuments() {
        try {
            const docs = await this.storageManager.loadDocuments();
            this.updateDocumentList(docs);
        } catch (error) {
            console.error('Erreur chargement documents:', error);
            this.showError('Erreur de chargement des documents');
        }
    }

    setupEventListeners() {
        const touchOptions = { passive: true };
        
        this.dropZone.addEventListener('touchstart', (e) => {
            e.stopPropagation();
        }, touchOptions);
    
        this.dropZone.addEventListener('touchend', (e) => {
            e.preventDefault();
            e.stopPropagation();
            this.fileInput.click();
        }, { passive: false });
    
        this.fileInput.addEventListener('change', () => {
            if (this.fileInput.files.length) {
                this.handleFiles(this.fileInput.files);
            }
        }, touchOptions);
    
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
    
        this.uploadButton.addEventListener('click', () => this.fileInput.click());
        this.dropZone.addEventListener('click', () => this.fileInput.click());
    
        if (this.notesTextarea) {
            this.notesTextarea.addEventListener('input', this.debounce(() => {
                this.saveCurrentData();
            }, 500));
        }
    
        document.querySelectorAll('a[href]').forEach(link => {
            link.addEventListener('click', async (e) => {
                e.preventDefault();
                await this.saveCurrentData();
                window.location.href = link.getAttribute('href');
            });
        });
    }

    debounce(func, wait) {
        let timeout;
        return function executedFunction(...args) {
            const later = () => {
                clearTimeout(timeout);
                func(...args);
            };
            clearTimeout(timeout);
            timeout = setTimeout(later, wait);
        };
    }

    async handleFiles(files) {
        if (this.processingLock) return;
        this.processingLock = true;

        try {
            const currentFiles = await this.storageManager.loadDocuments();
            const totalFiles = currentFiles.length + files.length;

            if (totalFiles > this.storageManager.CONSTRAINTS.maxFiles) {
                throw new Error(`Maximum ${this.storageManager.CONSTRAINTS.maxFiles} fichiers`);
            }

            const processedFiles = await Promise.all(
                Array.from(files).map(file => this.processFile(file))
            );

            const validFiles = processedFiles.filter(Boolean);
            await this.storageManager.saveDocuments([...currentFiles, ...validFiles]);
            await this.updateDocumentList();

        } catch (error) {
            console.error('[Documents] Erreur:', error);
            this.showError(error.message);
        } finally {
            this.processingLock = false;
        }
    }

    async processFile(file) {
        try {
            if (!this.storageManager.CONSTRAINTS.allowedTypes.includes(file.type)) {
                throw new Error('Type non supporté');
            }

            const base64 = await this.fileToBase64(file);
            const doc = {
                id: Date.now() + '-' + Math.random().toString(36).substr(2, 9),
                name: file.name,
                type: file.type,
                fileData: base64
            };

            if (!this.storageManager.validateDocument(doc)) {
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
        const documents = await this.storageManager.loadDocuments();
        this.documentList.innerHTML = '';

        documents.forEach(doc => {
            const item = this.createDocumentItem(doc);
            this.documentList.appendChild(item);
        });
    }

    createDocumentItem(doc) {
        const item = document.createElement('div');
        item.className = 'document-item flex justify-between items-center';
        item.dataset.id = doc.id;

        item.innerHTML = `
            <div class="flex items-center gap-3">
                <div>
                    <p class="font-medium">${this.sanitizeString(doc.name)}</p>
                    <p class="text-sm opacity-70">
                        ${doc.type} - ${Math.round(this.storageManager.getBase64Size(doc.fileData) / 1024)}KB
                    </p>
                </div>
            </div>
            <button class="delete-btn text-red-500 hover:text-red-700">
                <svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/>
                </svg>
            </button>
        `;

        item.querySelector('.delete-btn').addEventListener('click', async () => {
            await this.deleteDocument(doc.id);
        });

        return item;
    }

    async deleteDocument(id) {
        try {
            const documents = await this.storageManager.loadDocuments();
            const updated = documents.filter(doc => doc.id !== id);
            await this.storageManager.saveDocuments(updated);
            await this.updateDocumentList();
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

    sanitizeString(str) {
        if (!str || typeof str !== 'string') return '';
        return str.trim().replace(/[<>]/g, '');
    }

    async saveCurrentData() {
        try {
            const notes = this.notesTextarea?.value || '';
            localStorage.setItem('document_notes', notes);
            return true;
        } catch (error) {
            console.error('[Save] Erreur:', error);
            return false;
        }
    }
}

// Suite dans le prochain message...
