// patient-manager.js
// Gestion du diagnostic, du traitement, et préparation des données pour l'API

class DiagnosticManager {
    constructor() {
        this.apiEndpoint = 'https://physiocare-api.b00135522.workers.dev/'; // A adapter si besoin
        this.currentPatientId = null; // Sera défini par PatientManager
    }

    /**
     * Analyse les données du patient (documents, symptômes, etc.) en appelant le Worker Claude API.
     * @param {Object} data Données du patient rassemblées par gatherPatientData (cf. plus bas).
     * @returns {Promise<Object>} L'objet de diagnostic renvoyé par l'API
     */
    async analyze(data) {
        console.log("[DiagnosticManager] Analyse en cours...");
        const response = await fetch(this.apiEndpoint, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action: 'analysis', data })
        });

        if (!response.ok) {
            const text = await response.text();
            throw new Error(`Erreur API analyse: ${response.status} - ${text}`);
        }

        const result = await response.json();
        console.log("[DiagnosticManager] Réponse analyse:", result);
        return result;
    }
}

class TreatmentManager {
    constructor() {
        this.apiEndpoint = 'https://physiocare-api.b00135522.workers.dev/'; // A adapter si besoin
        this.currentPatientId = null; // Sera défini par PatientManager
    }

    /**
     * Génère un plan de traitement à partir des diagnostics et des données du patient.
     * @param {Object} data Données du patient incluant le diagnostic sélectionné
     * @returns {Promise<Object>} L'objet de traitement renvoyé par l'API
     */
    async getTreatment(data) {
        console.log("[TreatmentManager] Génération du plan de traitement...");
        const response = await fetch(this.apiEndpoint, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action: 'treatment', data })
        });

        if (!response.ok) {
            const text = await response.text();
            throw new Error(`Erreur API traitement: ${response.status} - ${text}`);
        }

        const result = await response.json();
        console.log("[TreatmentManager] Réponse traitement:", result);
        return result;
    }
}

class PatientManager {
    constructor() {
        this.currentPatientId = null;
        this.loadCurrentPatientId();
    }

    /**
     * Charge l'ID du patient en cours depuis localStorage
     */
    loadCurrentPatientId() {
        const pid = localStorage.getItem('currentPatientId');
        if (pid) {
            this.currentPatientId = pid;
        }
    }

    /**
     * Définit l'ID du patient en cours et le sauvegarde dans localStorage
     */
    setCurrentPatientId(patientId) {
        this.currentPatientId = patientId;
        localStorage.setItem('currentPatientId', patientId);
    }

    /**
     * Charge les données patient depuis localStorage, retourne un objet vide si non trouvé
     * @returns {Object}
     */
    loadPatientData() {
        if (!this.currentPatientId) return {};
        const data = localStorage.getItem(`patient_${this.currentPatientId}`);
        return data ? JSON.parse(data) : {};
    }

    /**
     * Sauvegarde les données patient dans localStorage
     * @param {Object} newData 
     */
    savePatientData(newData) {
        if (!this.currentPatientId) {
            // Génère un nouvel ID si inexistant
            const newId = `patient_${Date.now()}`;
            this.setCurrentPatientId(newId);
        }
        localStorage.setItem(`patient_${this.currentPatientId}`, JSON.stringify(newData));
    }

    /**
     * Retourne la liste des patients enregistrés (IDs et quelques infos)
     * @returns {Array} Liste des patients avec {id, name, firstName, lastName, ...}
     */
    listPatients() {
        const keys = Object.keys(localStorage).filter(k => k.startsWith('patient_'));
        return keys.map(k => {
            const data = JSON.parse(localStorage.getItem(k));
            return {
                id: k.replace('patient_', ''),
                personalInfo: data.personalInfo || {}
            };
        });
    }

    /**
     * Crée un nouveau patient avec des données de base et le définit comme patient courant
     * @param {Object} personalInfo 
     */
    createNewPatient(personalInfo) {
        const newId = `patient_${Date.now()}`;
        this.setCurrentPatientId(newId);
        const newData = {
            personalInfo: personalInfo || {},
            physicalActivity: {},
            symptoms: {},
            documents: [],
            remarks: '',
            diagnosis: [],
            treatment: {}
        };
        this.savePatientData(newData);
        return newId;
    }

    /**
     * Supprime un patient
     * @param {string} patientId 
     */
    deletePatient(patientId) {
        localStorage.removeItem(`patient_${patientId}`);
        // Si on supprimait le patient courant, on réinitialise
        if (this.currentPatientId === `patient_${patientId}`) {
            localStorage.removeItem('currentPatientId');
            this.currentPatientId = null;
        }
    }
}

/**
 * Prépare les données pour l’analyse ou le traitement :
 * Récupère les données du patient (personalInfo, physicalActivity, symptoms, remarks),
 * Les documents (base64),
 * Et éventuellement le diagnostic choisi.
 * @returns {Object} Data prête pour l'API
 */
async function gatherPatientData() {
    const pManager = window.patientManager;
    const patientData = pManager.loadPatientData();

    // Charger documents depuis IndexedDB
    const documents = await window.PatientStorageManager.loadDocuments();
    const formattedDocuments = documents.map(doc => ({
        id: doc.id,
        name: doc.name,
        type: doc.type,
        size: doc.size,
        // On doit ré-attacher le préfixe data selon le type
        // doc.fileData est déjà du base64 sans préfixe, on en a besoin complet:
        // Pour simplifier, on va stocker doc.fileData tel quel lors de l'upload.
        // Ici on assume que doc.fileData est déjà la donnée base64 pure sans data:image/...
        // Pour l'API Worker, c'est le Worker qui gère le retrait du préfixe.
        fileData: `data:${doc.type};base64,${doc.fileData}`
    }));

    const data = {
        personalInfo: patientData.personalInfo || {},
        physicalActivity: patientData.physicalActivity || {},
        symptoms: patientData.symptoms || {},
        remarks: patientData.remarks || '',
        documents: formattedDocuments,
        diagnosis: patientData.diagnosis || []
    };

    return data;
}

/**
 * Met à jour le diagnostic dans les données du patient
 * @param {Object} diagnosisResult 
 */
function updateDiagnosisData(diagnosisResult) {
    const pManager = window.patientManager;
    const patientData = pManager.loadPatientData();
    patientData.diagnosis = diagnosisResult.diagnostics || [];
    pManager.savePatientData(patientData);
}

/**
 * Met à jour le plan de traitement dans les données du patient
 * @param {Object} treatmentResult 
 */
function updateTreatmentData(treatmentResult) {
    const pManager = window.patientManager;
    const patientData = pManager.loadPatientData();
    patientData.treatment = treatmentResult.treatmentPlan || {};
    pManager.savePatientData(patientData);
}

// Exposer les managers globalement
window.DiagnosticManager = DiagnosticManager;
window.TreatmentManager = TreatmentManager;
window.PatientManager = PatientManager;
window.gatherPatientData = gatherPatientData;
window.updateDiagnosisData = updateDiagnosisData;
window.updateTreatmentData = updateTreatmentData;
