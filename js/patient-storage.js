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
    // Reste du code StorageManager sans modification...
};

window.PatientStorageManager = PatientStorageManager;
