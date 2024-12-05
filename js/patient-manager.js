// patient-manager.js

class DiagnosticManager {
    constructor() {
        this.apiEndpoint='https://physiocare-api.b00135522.workers.dev/'; 
    }

    async analyze(data) {
        const response=await fetch(this.apiEndpoint,{
            method:'POST',
            headers:{'Content-Type':'application/json'},
            body:JSON.stringify({action:'analysis',data})
        });
        if(!response.ok) {
            const text=await response.text();
            throw new Error(`Erreur API analyse: ${response.status} - ${text}`);
        }
        return await response.json();
    }
}

class TreatmentManager {
    constructor() {
        this.apiEndpoint='https://physiocare-api.b00135522.workers.dev/'; 
    }

    async getTreatment(data) {
        const response=await fetch(this.apiEndpoint,{
            method:'POST',
            headers:{'Content-Type':'application/json'},
            body:JSON.stringify({action:'treatment',data})
        });
        if(!response.ok) {
            const text=await response.text();
            throw new Error(`Erreur API traitement: ${response.status} - ${text}`);
        }
        return await response.json();
    }
}

class PatientManager {
    constructor() {
        this.currentPatientId=null;
        this.loadCurrentPatientId();
    }
    loadCurrentPatientId() {
        const pid=localStorage.getItem('currentPatientId');
        if(pid)this.currentPatientId=pid;
    }
    setCurrentPatientId(patientId) {
        this.currentPatientId=patientId;
        localStorage.setItem('currentPatientId',patientId);
    }
    loadPatientData() {
        if(!this.currentPatientId)return{};
        const data=localStorage.getItem(this.currentPatientId);
        return data?JSON.parse(data):{};
    }
    savePatientData(newData) {
        if(!this.currentPatientId) {
            const newId=`patient_${Date.now()}`;
            this.setCurrentPatientId(newId);
        }
        localStorage.setItem(this.currentPatientId,JSON.stringify(newData));
    }
    listPatients() {
        const keys=Object.keys(localStorage).filter(k=>k.startsWith('patient_'));
        return keys.map(k=>{
            const data=JSON.parse(localStorage.getItem(k));
            return {
                id:k,
                personalInfo:data.personalInfo||{}
            };
        });
    }
    createNewPatient(personalInfo) {
        const newId=`patient_${Date.now()}`;
        this.setCurrentPatientId(newId);
        const newData={
            personalInfo: personalInfo||{},
            physicalActivity:{},
            symptoms:{},
            documents:[],
            remarks:'', // remarques pour documents
            diagnosisRemarks:'', // remarques pour diagnosis
            diagnosis:[],
            treatment:{}
        };
        this.savePatientData(newData);
        return newId;
    }
    deletePatient(patientId) {
        localStorage.removeItem(patientId);
        if(this.currentPatientId===patientId) {
            localStorage.removeItem('currentPatientId');
            this.currentPatientId=null;
        }
    }
}

// Fonction factice pour PDF -> texte
async function pdfToText(base64data) {
    // TODO: Implémentez un véritable OCR PDF.
    // Ici on simule:
    return "Exemple de texte extrait du PDF (à remplacer par un vrai OCR).";
}

async function gatherPatientData() {
    const pManager=window.patientManager;
    const patientData=pManager.loadPatientData();

    const documents=await window.PatientStorageManager.loadDocuments();
    const formattedDocs=[];
    for(const doc of documents) {
        if(doc.type.startsWith('image/')) {
            // Image, on retire le prefixe data si nécessaire
            // On a stocké doc.fileData en base64 pur, donc juste doc.fileData
            formattedDocs.push({
                id:doc.id,
                name:doc.name,
                type:doc.type,
                size:doc.size,
                fileDataBase64:doc.fileData // déjà base64 sans prefixe data
            });
        } else if(doc.type==='application/pdf') {
            // Extraire le texte
            const textExtract=await pdfToText(doc.fileData);
            formattedDocs.push({
                id:doc.id,
                name:doc.name,
                type:doc.type,
                size:doc.size,
                textExtract
            });
        }
    }

    return {
        personalInfo: patientData.personalInfo||{},
        physicalActivity: patientData.physicalActivity||{},
        symptoms: patientData.symptoms||{},
        documentsRemarks: patientData.remarks||'',
        diagnosisRemarks: patientData.diagnosisRemarks||'',
        documents: formattedDocs,
        diagnosis: patientData.diagnosis||[]
    };
}

function updateDiagnosisData(diagnosisResult) {
    const pManager=window.patientManager;
    const data=pManager.loadPatientData();
    data.diagnosis=diagnosisResult.diagnostics||[];
    pManager.savePatientData(data);
}

function updateTreatmentData(treatmentResult) {
    const pManager=window.patientManager;
    const data=pManager.loadPatientData();
    data.treatment=treatmentResult.treatmentPlan||{};
    pManager.savePatientData(data);
}

window.DiagnosticManager=DiagnosticManager;
window.TreatmentManager=TreatmentManager;
window.PatientManager=PatientManager;
window.gatherPatientData=gatherPatientData;
window.updateDiagnosisData=updateDiagnosisData;
window.updateTreatmentData=updateTreatmentData;
