import { db, remoteConfig } from './firebase-config.js';
import { checkAuth } from './dashboard.js';
import { showAlert } from './auth.js';

const settingsForm = document.getElementById('settingsForm');
let pendingFiles = {};

document.addEventListener('DOMContentLoaded', async () => {
    await checkAuth();
    loadSettings();
    setupFileListeners();
    
    if (settingsForm) {
        settingsForm.addEventListener('submit', saveSettings);
    }
});

async function loadSettings() {
    const user = JSON.parse(localStorage.getItem('user'));
    if (!user) return;
    const businessId = user.businessId || user.uid;

    try {
        const doc = await db.collection('users').doc(businessId).collection('settings').doc('business').get();
        if (doc.exists) {
            const data = doc.data();
            if (document.getElementById('companyName')) {
                document.getElementById('companyName').value = data.companyName || '';
                document.getElementById('taxId').value = data.taxId || '';
                document.getElementById('companyEmail').value = data.email || '';
                document.getElementById('companyPhone').value = data.phone || '';
                document.getElementById('companyAddress').value = data.address || '';
                document.getElementById('companyCity').value = data.city || '';
                document.getElementById('companyState').value = data.state || '';
                document.getElementById('companyZip').value = data.zip || '';
                if (document.getElementById('companyUpiId')) {
                    document.getElementById('companyUpiId').value = data.upiId || '';
                }
                
                if (data.logoUrl) {
                    document.getElementById('logoUrl').value = data.logoUrl;
                    showExistingImage('logo', data.logoUrl);
                }
                
                if (data.signatureUrl) {
                    document.getElementById('signatureUrl').value = data.signatureUrl;
                    showExistingImage('signature', data.signatureUrl);
                }

                if (document.getElementById('autoExpiryReports')) {
                    document.getElementById('autoExpiryReports').checked = data.autoExpiryReports !== false;
                }
            }
        }

        // Disable editing for non-owners
        if (user.role !== 'owner') {
            const form = document.getElementById('settingsForm');
            if (form) {
                Array.from(form.elements).forEach(element => {
                    element.disabled = true;
                });
            }
            const saveBtn = document.getElementById('saveSettingsBtn');
            if (saveBtn) {
                saveBtn.style.display = 'none';
            }
        }
    } catch (error) {
        console.error('Error loading settings:', error);
    }
}

function setupFileListeners() {
    ['companyLogo', 'companySignature'].forEach(id => {
        const el = document.getElementById(id);
        if (el) {
            el.addEventListener('change', (e) => handleFileSelect(e, id));
        }
    });
}

function showExistingImage(type, url) {
    const previewDiv = document.getElementById(`${type}Preview`);
    if (previewDiv) {
        previewDiv.innerHTML = `
            <img src="${url}" class="border rounded" style="height: 50px; width: auto; object-fit: contain;">
            <button type="button" class="btn btn-sm btn-outline-danger" onclick="window.removeSettingImage('${type}')"><i class="fas fa-times"></i></button>
        `;
    }
}

window.removeSettingImage = (type) => {
    document.getElementById(`${type}Url`).value = '';
    document.getElementById(`${type}Preview`).innerHTML = '';
    document.getElementById(type === 'logo' ? 'companyLogo' : 'companySignature').value = '';
};

async function saveSettings(e) {
    e.preventDefault();
    const user = JSON.parse(localStorage.getItem('user'));
    const businessId = user.businessId || user.uid;
    
    const upiId = document.getElementById('companyUpiId') ? document.getElementById('companyUpiId').value.trim() : '';
    // Validate UPI ID format (e.g. username@bank, min length check)
    if (upiId && !/^[a-zA-Z0-9.\-_]{2,}@[a-zA-Z]{2,}$/.test(upiId)) {
        showAlert('warning', 'Invalid UPI ID format. Please use format like name@bank');
        return;
    }

    const settingsData = {
        companyName: document.getElementById('companyName').value,
        taxId: document.getElementById('taxId').value,
        email: document.getElementById('companyEmail').value,
        phone: document.getElementById('companyPhone').value,
        address: document.getElementById('companyAddress').value,
        city: document.getElementById('companyCity').value,
        state: document.getElementById('companyState').value,
        zip: document.getElementById('companyZip').value,
        upiId: upiId,
        autoExpiryReports: document.getElementById('autoExpiryReports') ? document.getElementById('autoExpiryReports').checked : true,
        logoUrl: document.getElementById('logoUrl').value,
        signatureUrl: document.getElementById('signatureUrl').value,
        updatedAt: new Date()
    };

    const btn = document.getElementById('saveSettingsBtn');
    const originalText = btn.innerHTML;
    btn.disabled = true;
    btn.innerHTML = '<span class="spinner-border spinner-border-sm"></span> Saving...';

    // Handle Uploads
    try {
        const apiKey = await getImgBBApiKey(businessId);
        if (pendingFiles['companyLogo']) {
            settingsData.logoUrl = await uploadToImgBB(pendingFiles['companyLogo'], apiKey);
        }
        if (pendingFiles['companySignature']) {
            settingsData.signatureUrl = await uploadToImgBB(pendingFiles['companySignature'], apiKey);
        }
    } catch (error) {
        console.error('Upload error:', error);
        showAlert('warning', 'Settings saved but image upload failed: ' + error.message);
        // Continue to save text data even if upload fails
    }

    try {
        await db.collection('users').doc(businessId).collection('settings').doc('business').set(settingsData, { merge: true });
        showAlert('success', 'Settings saved successfully');
    } catch (error) {
        console.error('Error saving settings:', error);
        showAlert('danger', 'Failed to save settings');
    } finally {
        btn.disabled = false;
        btn.innerHTML = originalText;
    }
}

// --- Image Handling Logic (Reused from Vehicles) ---

async function handleFileSelect(e, inputId) {
    const file = e.target.files[0];
    if (!file) return;

    const type = inputId === 'companyLogo' ? 'logo' : 'signature';
    const previewDiv = document.getElementById(`${type}Preview`);
    previewDiv.innerHTML = '<span class="text-info small"><i class="fas fa-cog fa-spin"></i> Compressing...</span>';

    try {
        const compressedFile = await compressImage(file);
        pendingFiles[inputId] = compressedFile;
        
        const url = URL.createObjectURL(compressedFile);
        previewDiv.innerHTML = `
            <img src="${url}" class="border rounded" style="height: 50px; width: auto; object-fit: contain;">
            <span class="text-success small"><i class="fas fa-check"></i> Ready</span>
        `;
    } catch (error) {
        console.error(error);
        previewDiv.innerHTML = '<span class="text-danger small">Compression failed</span>';
    }
}

async function compressImage(file) {
    const maxSize = 100 * 1024; // 100KB for logos/signatures
    let quality = 0.9;
    let width, height;

    const img = new Image();
    const objectUrl = URL.createObjectURL(file);
    img.src = objectUrl;
    await new Promise(r => img.onload = r);

    const MAX_DIMENSION = 800; // Smaller max dimension for logos
    width = img.width;
    height = img.height;
    
    if (width > MAX_DIMENSION || height > MAX_DIMENSION) {
        const ratio = Math.min(MAX_DIMENSION / width, MAX_DIMENSION / height);
        width = Math.round(width * ratio);
        height = Math.round(height * ratio);
    }

    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(img, 0, 0, width, height);

    let blob = await new Promise(r => canvas.toBlob(r, 'image/jpeg', quality));

    while (blob.size > maxSize && quality > 0.5) {
        quality -= 0.1;
        blob = await new Promise(r => canvas.toBlob(r, 'image/jpeg', quality));
    }

    URL.revokeObjectURL(objectUrl);
    return new File([blob], file.name, { type: 'image/jpeg' });
}

async function getImgBBApiKey(businessId) {
    try {
        await remoteConfig.fetchAndActivate();
        const rcKey = remoteConfig.getValue('imgbb_api_key').asString();
        if (rcKey) return rcKey;

        const doc = await db.collection('users').doc(businessId).collection('settings').doc('integrations').get();
        if (doc.exists && doc.data().imgbbApiKey) {
            return doc.data().imgbbApiKey;
        }
        // Fallback key if none configured (Development only, ideally remove in prod)
        return "031d6299529790696342316431f5516a"; 
    } catch (e) { 
        return null; 
    }
}

async function uploadToImgBB(file, apiKey) {
    if (!apiKey) throw new Error("API Key missing");
    
    const formData = new FormData();
    formData.append('image', file);
    
    const response = await fetch(`https://api.imgbb.com/1/upload?key=${apiKey}`, {
        method: 'POST',
        body: formData
    });
    
    const data = await response.json();
    if (data.success) {
        return data.data.url;
    }
    throw new Error(data.error ? data.error.message : 'Upload failed');
}