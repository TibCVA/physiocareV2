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
        if(!this.currentPatientId)return {};
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
            personalInfo:personalInfo||{},
            physicalActivity:{},
            symptoms:{},
            documents:[],
            remarks:'', // remarques documents
            diagnosisRemarks:'', // remarques diagnostic
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

// Fonction factice PDF->texte
async function pdfToText(base64data) {
    // Implémentation réelle à faire.
    return "Exemple de texte extrait du PDF (OCR à implémenter).";
}

async function gatherPatientData() {
    const pManager=window.patientManager;
    const patientData=pManager.loadPatientData();
    const documents=await window.PatientStorageManager.loadDocuments();
    const formattedDocs=[];
    for(const doc of documents) {
        if(doc.type.startsWith('image/')) {
            formattedDocs.push({
                id:doc.id,
                name:doc.name,
                type:doc.type,
                size:doc.size,
                fileDataBase64:doc.fileData
            });
        } else if(doc.type==='application/pdf') {
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

// Réintroduction de DocumentManager
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
            successMessage: document.getElementById('successMessage'),
            notes: document.getElementById('notes')
        };
    }

    setupEventListeners() {
        const dropZone = this.elements.dropZone;
        if(dropZone) {
            ['dragenter','dragover','dragleave','drop'].forEach(eventName=>{
                dropZone.addEventListener(eventName,e=>{
                    e.preventDefault();
                    e.stopPropagation();
                });
            });
            dropZone.addEventListener('dragover',()=>{
                dropZone.classList.add('border-brand-light','bg-brand-light/10');
            });
            dropZone.addEventListener('dragleave',()=>{
                dropZone.classList.remove('border-brand-light','bg-brand-light/10');
            });
            dropZone.addEventListener('drop', async(e)=>{
                dropZone.classList.remove('border-brand-light','bg-brand-light/10');
                await this.handleFiles(e.dataTransfer.files);
            });
        }

        this.elements.uploadButton?.addEventListener('click',()=>{
            this.elements.fileInput?.click();
        });

        this.elements.fileInput?.addEventListener('change',async(e)=>{
            await this.handleFiles(e.target.files);
        });
    }

    async handleFiles(fileList) {
        try {
            const files=Array.from(fileList);
            if(files.length===0)return;
            const documents=await Promise.all(files.map(this.processFile.bind(this)));
            const validDocuments=documents.filter(Boolean);
            if(validDocuments.length) {
                await this.storage.saveDocuments(validDocuments);
                await this.loadSavedDocuments();
                this.showMessage('success', `${validDocuments.length} document(s) ajouté(s)`);
            }
        } catch(error) {
            this.showMessage('error',error.message);
        }
    }

    async processFile(file) {
        if(!this.storage.CONSTRAINTS.allowedTypes.includes(file.type)) {
            this.showMessage('error',`Type de fichier non supporté: ${file.type}`);
            return null;
        }
        if(file.size>this.storage.CONSTRAINTS.maxFileSize) {
            this.showMessage('error',`Fichier trop volumineux: ${file.name}`);
            return null;
        }
        return new Promise((resolve,reject)=>{
            const reader=new FileReader();
            reader.onload=(e)=>{
                const base64Data=e.target.result.split(',')[1];
                if(!base64Data)reject(new Error(`Erreur conversion Base64: ${file.name}`));
                resolve({
                    id:crypto.randomUUID(),
                    name:file.name,
                    type:file.type,
                    size:file.size,
                    fileData:base64Data
                });
            };
            reader.onerror=()=>reject(new Error('Erreur lecture fichier'));
            reader.readAsDataURL(file);
        });
    }

    async loadSavedDocuments() {
        const documents=await this.storage.loadDocuments();
        this.elements.documentList.innerHTML='';
        documents.forEach(doc=>{
            const element=this.createDocumentElement(doc);
            this.elements.documentList.appendChild(element);
        });
    }

    createDocumentElement(doc) {
        const div=document.createElement('div');
        div.className='document-item';
        div.innerHTML=`
            <div class="flex items-center justify-between w-full">
                <div>
                    <h3 class="font-medium">${this.sanitizeString(doc.name)}</h3>
                    <p class="text-sm opacity-70">${this.formatFileSize(doc.size)}</p>
                </div>
                <button class="text-red-500 hover:text-red-700" data-id="${doc.id}">
                    <svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                              d="M19 7l-.867 12.142A2 2 0
                              0116.138 21H7.862a2 2 0
                              01-1.995-1.858L5
                              7m5 4v6m4-6v6m1-10V4a1 1 0
                              00-1-1h-4a1 1 0 00-1 1v3M4
                              7h16"/>
                    </svg>
                </button>
            </div>
        `;
        div.querySelector('button').addEventListener('click',async()=>{
            await this.deleteDocument(doc.id);
        });
        return div;
    }

    async deleteDocument(id) {
        try {
            const documents=await this.storage.loadDocuments();
            const updatedDocs=documents.filter(d=>d.id!==id);
            await this.storage.saveDocuments(updatedDocs);
            await this.loadSavedDocuments();
        } catch(error) {
            this.showMessage('error','Erreur suppression document');
        }
    }

    sanitizeString(str) {
        return str.replace(/[<>&"']/g,'');
    }

    formatFileSize(bytes) {
        if(bytes<1024)return bytes+' B';
        if(bytes<1048576)return (bytes/1024).toFixed(1)+' KB';
        return (bytes/1048576).toFixed(1)+' MB';
    }

    showMessage(type,message) {
        if(type==='error') {
            this.elements.errorMessage.textContent=message;
            this.elements.errorMessage.style.display='block';
            this.elements.successMessage.style.display='none';
            setTimeout(()=>{this.elements.errorMessage.style.display='none';},5000);
        } else {
            this.elements.successMessage.textContent=message;
            this.elements.successMessage.style.display='block';
            this.elements.errorMessage.style.display='none';
            setTimeout(()=>{this.elements.successMessage.style.display='none';},3000);
        }
    }
}

window.DiagnosticManager=DiagnosticManager;
window.TreatmentManager=TreatmentManager;
window.PatientManager=PatientManager;
window.gatherPatientData=gatherPatientData;
window.updateDiagnosisData=updateDiagnosisData;
window.updateTreatmentData=updateTreatmentData;
window.DocumentManager=DocumentManager;
