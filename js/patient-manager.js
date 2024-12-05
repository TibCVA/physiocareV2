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
                remarks: this.elements.remarksInput.value.trim()
            };
        } catch (error) {
            return {
                personalInfo: {},
                physicalActivity: {},
                symptoms: {},
                documents: [],
                remarks: this.elements.remarksInput?.value?.trim() || ''
            };
        }
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
}

// Initialisation
document.addEventListener('DOMContentLoaded', () => {
    if (window.location.pathname.includes('documents.html')) {
        window.documentManager = new DocumentManager();
    } else if (window.location.pathname.includes('diagnosis.html')) {
        window.diagnosticManager = new DiagnosticManager();
    }
});
