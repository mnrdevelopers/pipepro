import { db, remoteConfig } from './firebase-config.js';
import { fetchPostOfficeByPincode } from './dashboard.js';
import { checkAuth } from './dashboard.js';
import { showAlert } from './auth.js';

const settingsForm = document.getElementById('settingsForm');
let pendingFiles = {};
const backupToDriveBtn = document.getElementById('backupToDriveBtn');
const backupStatus = document.getElementById('backupStatus');
const restoreFromDriveBtn = document.getElementById('restoreFromDriveBtn');
const restoreStatus = document.getElementById('restoreStatus');
const restoreBackupTable = document.getElementById('restoreBackupTable');

const DRIVE_CLIENT_ID = '519698901834-t2q9fhq19tm6imi650k5f7f4h83jmgue.apps.googleusercontent.com';
const DRIVE_SCOPE = 'https://www.googleapis.com/auth/drive.file';
const DRIVE_FOLDER_NAME = 'PipePro Backups';

document.addEventListener('DOMContentLoaded', async () => {
    await checkAuth();
    loadSettings();
    setupFileListeners();

    if (backupToDriveBtn) {
        backupToDriveBtn.addEventListener('click', backupToGoogleDrive);
    }
    if (restoreFromDriveBtn) {
        restoreFromDriveBtn.addEventListener('click', openRestoreModal);
    }
    
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
                if (document.getElementById('companyVillage')) {
                    const el = document.getElementById('companyVillage');
                    if (data.village) {
                        el.innerHTML = `<option value="">Select Village</option><option value="${data.village}">${data.village}</option>`;
                    }
                    el.value = data.village || '';
                }
                if (document.getElementById('companyDistrict')) {
                    document.getElementById('companyDistrict').value = data.district || '';
                }
                if (document.getElementById('companyMandal')) {
                    const el = document.getElementById('companyMandal');
                    if (data.mandal) {
                        el.innerHTML = `<option value="">Select Mandal</option><option value="${data.mandal}">${data.mandal}</option>`;
                    }
                    el.value = data.mandal || '';
                }
                if (document.getElementById('companyUpiId')) {
                document.getElementById('companyUpiId').value = data.upiId || '';
            }
            if (document.getElementById('companyBankName')) {
                document.getElementById('companyBankName').value = data.bankName || '';
            }
            if (document.getElementById('companyBankAccountName')) {
                document.getElementById('companyBankAccountName').value = data.bankAccountName || '';
            }
            if (document.getElementById('companyBankAccountNo')) {
                document.getElementById('companyBankAccountNo').value = data.bankAccountNo || '';
            }
            if (document.getElementById('companyBankIfsc')) {
                document.getElementById('companyBankIfsc').value = data.bankIfsc || '';
            }
            if (document.getElementById('companyBankBranch')) {
                document.getElementById('companyBankBranch').value = data.bankBranch || '';
            }
            if (document.getElementById('companyGstRate')) {
                document.getElementById('companyGstRate').value = data.gstRate ?? 18;
            }
            if (document.getElementById('invoicePrefix')) {
                document.getElementById('invoicePrefix').value = data.invoicePrefix || '';
            }
            if (document.getElementById('invoicePad')) {
                document.getElementById('invoicePad').value = data.invoicePad ?? 4;
            }
            if (document.getElementById('gstInvoicePrefix')) {
                document.getElementById('gstInvoicePrefix').value = data.gstInvoicePrefix || '';
            }
            if (document.getElementById('gstInvoicePad')) {
                document.getElementById('gstInvoicePad').value = data.gstInvoicePad ?? 4;
            }
            if (document.getElementById('gstInvoiceNextNumber')) {
                document.getElementById('gstInvoiceNextNumber').value = data.gstInvoiceNextNumber ?? 1;
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

    const ifscInput = document.getElementById('companyBankIfsc');
    if (ifscInput) {
        ifscInput.addEventListener('blur', () => fetchBankDetailsFromIfsc());
    }

    const ifscLookupBtn = document.getElementById('ifscLookupBtn');
    if (ifscLookupBtn) {
        ifscLookupBtn.addEventListener('click', () => fetchBankDetailsFromIfsc(true));
    }

    const companyZip = document.getElementById('companyZip');
    if (companyZip) {
        companyZip.addEventListener('blur', () => fillCompanyAddressFromPincode());
    }
}

async function fillCompanyAddressFromPincode() {
    const zipEl = document.getElementById('companyZip');
    const villageEl = document.getElementById('companyVillage');
    const districtEl = document.getElementById('companyDistrict');
    const stateEl = document.getElementById('companyState');
    const cityEl = document.getElementById('companyCity');
    const mandalEl = document.getElementById('companyMandal');
    if (!zipEl) return;
    const pin = (zipEl.value || '').trim();
    if (!pin) return;
    const data = await fetchPostOfficeByPincode(pin);
    if (!data) return;
    if (villageEl && data.postOffices) {
        const villages = Array.from(new Set(data.postOffices.map(p => p.Name).filter(Boolean)));
        villageEl.innerHTML = `<option value="">Select Village</option>` + villages.map(v => `<option value="${v}">${v}</option>`).join('');
        villageEl.value = data.village || villageEl.value;
    }
    if (mandalEl && data.postOffices) {
        const mandals = Array.from(new Set(data.postOffices.map(p => p.Block).filter(Boolean)));
        mandalEl.innerHTML = `<option value="">Select Mandal</option>` + mandals.map(m => `<option value="${m}">${m}</option>`).join('');
        mandalEl.value = data.mandal || mandalEl.value;
    }
    if (districtEl) districtEl.value = data.district || districtEl.value;
    if (stateEl) stateEl.value = data.state || stateEl.value;
    if (cityEl && !cityEl.value) cityEl.value = data.district || '';
}

async function fetchBankDetailsFromIfsc(fromModal = false) {
    const ifscInput = document.getElementById('companyBankIfsc');
    const bankNameInput = document.getElementById('companyBankName');
    const branchInput = document.getElementById('companyBankBranch');
    if (!ifscInput || !bankNameInput || !branchInput) return;
    const ifsc = (ifscInput.value || '').trim();
    if (!ifsc) return;
    try {
        const res = await fetch(`https://ifsc.razorpay.com/${encodeURIComponent(ifsc)}`);
        if (!res.ok) throw new Error('Invalid IFSC');
        const data = await res.json();
        if (data && data.BANK) bankNameInput.value = data.BANK;
        if (data && data.BRANCH) branchInput.value = data.BRANCH;
        if (ifscInput) ifscInput.value = ifsc;
    } catch (e) {
        console.error('IFSC lookup failed', e);
        showAlert('warning', 'IFSC code not found. Please check and enter bank details manually.');
    }
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

window.removeSettingImage = async (type) => {
    document.getElementById(`${type}Url`).value = '';
    document.getElementById(`${type}Preview`).innerHTML = '';
    document.getElementById(type === 'logo' ? 'companyLogo' : 'companySignature').value = '';

    const user = JSON.parse(localStorage.getItem('user'));
    if (!user) return;
    const businessId = user.businessId || user.uid;
    const field = type === 'logo' ? 'logoUrl' : 'signatureUrl';

    try {
        await db.collection('users')
            .doc(businessId)
            .collection('settings')
            .doc('business')
            .update({
                [field]: '',
                updatedAt: new Date()
            });
        showAlert('success', 'Image removed');
    } catch (e) {
        console.error(e);
        showAlert('danger', 'Failed to remove image');
    }
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
        village: document.getElementById('companyVillage')?.value || '',
        district: document.getElementById('companyDistrict')?.value || '',
        mandal: document.getElementById('companyMandal')?.value || '',
        upiId: upiId,
        bankName: document.getElementById('companyBankName')?.value || '',
        bankAccountName: document.getElementById('companyBankAccountName')?.value || '',
        bankAccountNo: document.getElementById('companyBankAccountNo')?.value || '',
        bankIfsc: document.getElementById('companyBankIfsc')?.value || '',
        bankBranch: document.getElementById('companyBankBranch')?.value || '',
        gstRate: parseFloat(document.getElementById('companyGstRate')?.value) || 0,
        invoicePrefix: document.getElementById('invoicePrefix')?.value || '',
        invoicePad: parseInt(document.getElementById('invoicePad')?.value, 10) || 4,
        gstInvoicePrefix: document.getElementById('gstInvoicePrefix')?.value || '',
        gstInvoicePad: parseInt(document.getElementById('gstInvoicePad')?.value, 10) || 4,
        gstInvoiceNextNumber: parseInt(document.getElementById('gstInvoiceNextNumber')?.value, 10) || 1,
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

function setBackupStatus(message, type = 'muted') {
    if (!backupStatus) return;
    backupStatus.className = `small text-${type}`;
    backupStatus.textContent = message;
}

function setRestoreStatus(message, type = 'muted') {
    if (!restoreStatus) return;
    restoreStatus.className = `small text-${type}`;
    restoreStatus.textContent = message;
}

function getDriveAccessToken() {
    return new Promise((resolve, reject) => {
        if (!window.google || !google.accounts || !google.accounts.oauth2) {
            reject(new Error('Google Identity Services not loaded.'));
            return;
        }

        const tokenClient = google.accounts.oauth2.initTokenClient({
            client_id: DRIVE_CLIENT_ID,
            scope: DRIVE_SCOPE,
            callback: (response) => {
                if (response && response.access_token) {
                    resolve(response.access_token);
                } else {
                    reject(new Error('Failed to get access token.'));
                }
            }
        });

        tokenClient.requestAccessToken({ prompt: 'consent' });
    });
}

function sanitizeForJson(value) {
    if (value === null || value === undefined) return value;
    if (value.toDate && typeof value.toDate === 'function') {
        return value.toDate().toISOString();
    }
    if (Array.isArray(value)) {
        return value.map(sanitizeForJson);
    }
    if (typeof value === 'object') {
        const out = {};
        Object.keys(value).forEach((k) => {
            out[k] = sanitizeForJson(value[k]);
        });
        return out;
    }
    return value;
}

async function fetchCollectionData(businessId, name) {
    const snapshot = await db.collection('users').doc(businessId).collection(name).get();
    const rows = [];
    snapshot.forEach(doc => {
        rows.push({
            id: doc.id,
            ...sanitizeForJson(doc.data())
        });
    });
    return rows;
}

async function getOrCreateDriveFolder(accessToken) {
    const query = encodeURIComponent(`name='${DRIVE_FOLDER_NAME}' and mimeType='application/vnd.google-apps.folder' and trashed=false`);
    const listUrl = `https://www.googleapis.com/drive/v3/files?q=${query}&fields=files(id,name)`;
    const listRes = await fetch(listUrl, {
        headers: { Authorization: `Bearer ${accessToken}` }
    });
    const listData = await listRes.json();
    if (listData.files && listData.files.length > 0) {
        return listData.files[0].id;
    }

    const createRes = await fetch('https://www.googleapis.com/drive/v3/files', {
        method: 'POST',
        headers: {
            Authorization: `Bearer ${accessToken}`,
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            name: DRIVE_FOLDER_NAME,
            mimeType: 'application/vnd.google-apps.folder'
        })
    });
    const folder = await createRes.json();
    return folder.id;
}

async function listDriveBackups(accessToken, folderId) {
    const query = encodeURIComponent(`'${folderId}' in parents and mimeType='application/json' and trashed=false`);
    const listUrl = `https://www.googleapis.com/drive/v3/files?q=${query}&fields=files(id,name,size,createdTime)&orderBy=createdTime desc`;
    const res = await fetch(listUrl, {
        headers: { Authorization: `Bearer ${accessToken}` }
    });
    const data = await res.json();
    return data.files || [];
}

async function downloadDriveFile(accessToken, fileId) {
    const url = `https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`;
    const res = await fetch(url, { headers: { Authorization: `Bearer ${accessToken}` } });
    if (!res.ok) throw new Error('Failed to download backup.');
    return res.json();
}

function formatBytes(bytes) {
    if (!bytes) return '-';
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(1024));
    return `${(bytes / Math.pow(1024, i)).toFixed(1)} ${sizes[i]}`;
}

async function openRestoreModal() {
    if (!restoreBackupTable) return;
    setRestoreStatus('Loading backups...', 'muted');
    const tbody = restoreBackupTable.querySelector('tbody');
    tbody.innerHTML = '<tr><td colspan="4" class="text-center text-muted">Loading backups...</td></tr>';

    try {
        const accessToken = await getDriveAccessToken();
        const folderId = await getOrCreateDriveFolder(accessToken);
        const files = await listDriveBackups(accessToken, folderId);

        if (!files.length) {
            tbody.innerHTML = '<tr><td colspan="4" class="text-center text-muted">No backups found.</td></tr>';
            setRestoreStatus('No backups available.', 'muted');
        } else {
            tbody.innerHTML = '';
            files.forEach(file => {
                const created = file.createdTime ? new Date(file.createdTime).toLocaleString() : '-';
                tbody.innerHTML += `
                    <tr>
                        <td>${file.name}</td>
                        <td>${formatBytes(Number(file.size))}</td>
                        <td>${created}</td>
                        <td>
                            <button class="btn btn-sm btn-outline-danger" data-file-id="${file.id}">
                                Restore
                            </button>
                        </td>
                    </tr>
                `;
            });
        }

        new bootstrap.Modal(document.getElementById('restoreBackupModal')).show();
    } catch (e) {
        console.error(e);
        setRestoreStatus('Failed to load backups.', 'danger');
        showAlert('danger', 'Failed to load backups.');
    }
}

async function clearCollection(businessId, name) {
    const snap = await db.collection('users').doc(businessId).collection(name).get();
    const batchSize = 400;
    let batch = db.batch();
    let count = 0;

    for (const doc of snap.docs) {
        batch.delete(doc.ref);
        count++;
        if (count >= batchSize) {
            await batch.commit();
            batch = db.batch();
            count = 0;
        }
    }
    if (count > 0) await batch.commit();
}

async function restoreCollection(businessId, name, rows) {
    const batchSize = 400;
    let batch = db.batch();
    let count = 0;

    for (const row of rows) {
        const { id, ...data } = row;
        const ref = db.collection('users').doc(businessId).collection(name).doc(id || undefined);
        batch.set(ref, data);
        count++;
        if (count >= batchSize) {
            await batch.commit();
            batch = db.batch();
            count = 0;
        }
    }
    if (count > 0) await batch.commit();
}

async function restoreFromBackup(fileId) {
    const user = JSON.parse(localStorage.getItem('user'));
    if (!user) return;
    const businessId = user.businessId || user.uid;

    window.showConfirm(
        'Restore Backup',
        'This will overwrite current data. Continue?',
        async () => {
            try {
                setRestoreStatus('Restoring backup...', 'muted');
                const accessToken = await getDriveAccessToken();
                const backup = await downloadDriveFile(accessToken, fileId);

                if (!backup || !backup.collections) {
                    throw new Error('Invalid backup format.');
                }

                const collectionNames = Object.keys(backup.collections);
                for (const name of collectionNames) {
                    await clearCollection(businessId, name);
                    await restoreCollection(businessId, name, backup.collections[name] || []);
                }

                setRestoreStatus('Restore completed successfully.', 'success');
                showAlert('success', 'Restore completed.');
            } catch (e) {
                console.error(e);
                setRestoreStatus('Restore failed.', 'danger');
                showAlert('danger', 'Restore failed.');
            }
        }
    );
}

if (restoreBackupTable) {
    restoreBackupTable.addEventListener('click', (e) => {
        const btn = e.target.closest('button[data-file-id]');
        if (!btn) return;
        const fileId = btn.getAttribute('data-file-id');
        if (fileId) restoreFromBackup(fileId);
    });
}

async function uploadJsonToDrive(accessToken, folderId, filename, data) {
    const metadata = {
        name: filename,
        mimeType: 'application/json',
        parents: [folderId]
    };

    const boundary = '-------314159265358979323846';
    const delimiter = `\r\n--${boundary}\r\n`;
    const closeDelimiter = `\r\n--${boundary}--`;

    const body =
        delimiter +
        'Content-Type: application/json; charset=UTF-8\r\n\r\n' +
        JSON.stringify(metadata) +
        delimiter +
        'Content-Type: application/json; charset=UTF-8\r\n\r\n' +
        JSON.stringify(data) +
        closeDelimiter;

    const uploadRes = await fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart', {
        method: 'POST',
        headers: {
            Authorization: `Bearer ${accessToken}`,
            'Content-Type': `multipart/related; boundary=${boundary}`
        },
        body
    });

    return uploadRes.json();
}

async function backupToGoogleDrive() {
    const user = JSON.parse(localStorage.getItem('user'));
    if (!user) return;
    const businessId = user.businessId || user.uid;

    if (backupToDriveBtn) backupToDriveBtn.disabled = true;
    setBackupStatus('Preparing backup...', 'muted');

    try {
        const accessToken = await getDriveAccessToken();
        setBackupStatus('Collecting data...', 'muted');

        const collections = [
            'transactions',
            'inventory',
            'customers',
            'suppliers',
            'projects',
            'purchases',
            'vehicle_expenses',
            'vehicles',
            'staff',
            'attendance',
            'production_runs',
            'recipes',
            'settings',
            'team',
            'challans'
        ];

        const data = {
            businessId,
            createdAt: new Date().toISOString(),
            collections: {}
        };

        for (const name of collections) {
            data.collections[name] = await fetchCollectionData(businessId, name);
        }

        const folderId = await getOrCreateDriveFolder(accessToken);
        const filename = `pipepro_backup_${new Date().toISOString().replace(/[:.]/g, '-')}.json`;
        await uploadJsonToDrive(accessToken, folderId, filename, data);

        setBackupStatus('Backup completed and saved to Google Drive.', 'success');
    } catch (error) {
        console.error('Backup failed:', error);
        setBackupStatus('Backup failed. Please try again.', 'danger');
        showAlert('danger', 'Backup failed.');
    } finally {
        if (backupToDriveBtn) backupToDriveBtn.disabled = false;
    }
}
