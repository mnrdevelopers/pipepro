import { db } from './firebase-config.js';
import { checkAuth, formatDate, downloadCSV, downloadPDF } from './dashboard.js';
import { showAlert } from './auth.js';

const productionTablePipes = document.getElementById('productionTablePipes');
const productionTableSeptic = document.getElementById('productionTableSeptic');
const productionSearch = document.getElementById('productionSearch');
const productionStageFilter = document.getElementById('productionStageFilter');
const productionDateFrom = document.getElementById('productionDateFrom');
const productionDateTo = document.getElementById('productionDateTo');
const resetProductionFilters = document.getElementById('resetProductionFilters');
const addProductionBtn = document.getElementById('addProductionBtn');
const productionModal = document.getElementById('productionModal');
const saveProductionBtn = document.getElementById('saveProductionBtn');
const addIngredientBtn = document.getElementById('addIngredientBtn');
const ingredientsContainer = document.getElementById('ingredientsContainer');
const estimatedCostElement = document.getElementById('estimatedCost');
const productDetailsDiv = document.getElementById('productDetails');
const stockStatusBadge = document.getElementById('stockStatusBadge');
const exportProductionPdfBtn = document.getElementById('exportProductionPdfBtn');
const exportProductionCsvBtn = document.getElementById('exportProductionCsvBtn');
const prodMoldSelect = document.getElementById('prodMoldNumber');
const prodCastingLocationSelect = document.getElementById('prodCastingLocation');
const prodProductMasterSelect = document.getElementById('prodProductMaster');
const septicAllocationModal = document.getElementById('septicAllocationModal');
const septicAllocationQtyInput = document.getElementById('septicAllocationQty');
const septicAllocationProductSelect = document.getElementById('septicAllocationProduct');
const septicAllocationLocationSelect = document.getElementById('septicAllocationLocation');
const saveSepticAllocationBtn = document.getElementById('saveSepticAllocationBtn');
const moveToCuringModal = document.getElementById('moveToCuringModal');
const curingCompleteModal = document.getElementById('curingCompleteModal');
const curingBatchIdInput = document.getElementById('curingBatchId');
const curingQtyInput = document.getElementById('curingQuantity');
const curingFromLocationInput = document.getElementById('curingFromLocation');
const curingToLocationSelect = document.getElementById('curingToLocation');
const curingStartDateInput = document.getElementById('curingStartDate');
const saveMoveToCuringBtn = document.getElementById('saveMoveToCuringBtn');
const completeBatchIdInput = document.getElementById('completeBatchId');
const completePassedQtyInput = document.getElementById('completePassedQty');
const completeDamagedQtyInput = document.getElementById('completeDamagedQty');
const completeReadyLocationSelect = document.getElementById('completeReadyLocation');
const completeDateInput = document.getElementById('completeDate');
const saveCuringCompleteBtn = document.getElementById('saveCuringCompleteBtn');

// State
let inventoryItems = [];
let productionData = [];
let currentEditId = null;
let moldMasterItems = [];
let locationMasterItems = [];
let productMasterItems = [];
let currentSepticRunId = null;
let productionDataAll = [];
let currentCuringRunId = null;
let currentCompleteRunId = null;

// Expose function globally for onclick handlers
window.completeCuring = async (id) => {
    const run = productionData.find(r => r.id === id);
    if (!run) return;
    currentCompleteRunId = id;
    if (completeBatchIdInput) completeBatchIdInput.value = run.batchId || '';
    if (completePassedQtyInput) completePassedQtyInput.value = run.quantityProduced || 0;
    if (completeDamagedQtyInput) completeDamagedQtyInput.value = 0;
    if (completeDateInput) completeDateInput.valueAsDate = new Date();
    if (completeReadyLocationSelect) {
        const readyValue = run.stockLocationId || run.stockLocation || '';
        completeReadyLocationSelect.value = readyValue;
        if (!completeReadyLocationSelect.value && run.stockLocation) {
            const match = Array.from(completeReadyLocationSelect.options).find(o => o.dataset.locationName === run.stockLocation);
            if (match) completeReadyLocationSelect.value = match.value;
        }
    }
    new bootstrap.Modal(curingCompleteModal).show();
};

window.startCuring = async (id) => {
    const run = productionData.find(r => r.id === id);
    if (!run) return;
    currentCuringRunId = id;
    if (curingBatchIdInput) curingBatchIdInput.value = run.batchId || '';
    if (curingQtyInput) curingQtyInput.value = run.quantityProduced || 0;
    if (curingFromLocationInput) curingFromLocationInput.value = run.productionLocation || '';
    if (curingToLocationSelect) {
        if (!curingToLocationSelect.options.length || curingToLocationSelect.options.length <= 1) {
            populateLocationSelects();
        }
        curingToLocationSelect.value = '';
    }
    if (curingStartDateInput) curingStartDateInput.valueAsDate = new Date();
    new bootstrap.Modal(moveToCuringModal).show();
};

window.allocateSeptic = async (id) => {
    const run = productionData.find(r => r.id === id);
    if (!run) return;
    if (run.status !== 'Completed') {
        return showAlert('warning', 'Complete curing first. Allocation is done from Ready Stock.');
    }
    currentSepticRunId = id;
    if (septicAllocationQtyInput) septicAllocationQtyInput.value = run.internalUseQty || 0;
    if (septicAllocationProductSelect) septicAllocationProductSelect.value = run.septicProductMasterId || '';
    if (septicAllocationLocationSelect) {
        const septicValue = run.septicLocationId || run.septicLocation || '';
        septicAllocationLocationSelect.value = septicValue;
        if (!septicAllocationLocationSelect.value && run.septicLocation) {
            const match = Array.from(septicAllocationLocationSelect.options).find(o => o.dataset.locationName === run.septicLocation);
            if (match) septicAllocationLocationSelect.value = match.value;
        }
    }
    new bootstrap.Modal(septicAllocationModal).show();
};

window.editProductionRun = async (id) => {
    const run = productionData.find(r => r.id === id);
    if (!run) return;
    currentEditId = id;
    await openProductionModal();
    document.getElementById('productionDate').valueAsDate = run.date?.toDate ? run.date.toDate() : new Date();
    document.getElementById('produceQuantity').value = run.quantityProduced || 0;
    if (prodProductMasterSelect) {
        prodProductMasterSelect.value = run.productMasterId || '';
        prodProductMasterSelect.disabled = true;
    }
    if (prodMoldSelect) {
        const moldValue = run.moldId || run.moldNumber || '';
        prodMoldSelect.value = moldValue;
        if (!prodMoldSelect.value && run.moldNumber) {
            const match = Array.from(prodMoldSelect.options).find(o => o.dataset.moldNumber === run.moldNumber);
            if (match) prodMoldSelect.value = match.value;
        }
        const opt = prodMoldSelect.querySelector(`option[value="${prodMoldSelect.value}"]`);
        if (opt && opt.disabled) opt.disabled = false;
        prodMoldSelect.disabled = true;
    }
    if (prodCastingLocationSelect) {
        const castingValue = run.productionLocationId || run.productionLocation || '';
        prodCastingLocationSelect.value = castingValue;
        if (!prodCastingLocationSelect.value && run.productionLocation) {
            const match = Array.from(prodCastingLocationSelect.options).find(o => o.dataset.locationName === run.productionLocation);
            if (match) prodCastingLocationSelect.value = match.value;
        }
    }
    document.getElementById('productionNotes').value = run.notes || '';
    document.getElementById('productionSupervisor').value = run.supervisor || '';

    // Lock fields that would affect stock
    document.getElementById('produceQuantity').disabled = true;
    if (ingredientsContainer) {
        ingredientsContainer.querySelectorAll('input, select, button').forEach(el => el.disabled = true);
    }
};

document.addEventListener('DOMContentLoaded', async () => {
    await checkAuth();
    loadProductionHistory();
    
    window.addEventListener('sectionChanged', (e) => {
        if (e.detail === 'production') {
            loadProductionHistory();
        }
    });

    if (addProductionBtn) {
        addProductionBtn.addEventListener('click', openProductionModal);
    }

    if (addIngredientBtn) {
        addIngredientBtn.addEventListener('click', () => addIngredientRow());
    }

    if (saveProductionBtn) {
        saveProductionBtn.addEventListener('click', saveProductionRun);
    }

    if (document.getElementById('produceQuantity')) {
        document.getElementById('produceQuantity').addEventListener('input', calculateCost);
    }

    const productionDateInput = document.getElementById('productionDate');

    if (saveSepticAllocationBtn) {
        saveSepticAllocationBtn.addEventListener('click', saveSepticAllocation);
    }
    if (saveMoveToCuringBtn) {
        saveMoveToCuringBtn.addEventListener('click', saveMoveToCuring);
    }
    if (saveCuringCompleteBtn) {
        saveCuringCompleteBtn.addEventListener('click', saveCuringComplete);
    }

    if (ingredientsContainer) {
        ingredientsContainer.addEventListener('input', calculateCost);
        ingredientsContainer.addEventListener('change', calculateCost);
        ingredientsContainer.addEventListener('click', (e) => {
            const btn = e.target.closest('.remove-ingredient-btn');
            if (btn) {
                const row = btn.closest('.ingredient-row');
                if (row) {
                    row.remove();
                    calculateCost();
                }
            }
        });
    }

    if (prodProductMasterSelect) {
        prodProductMasterSelect.addEventListener('change', applyProductMasterSelection);
    }

    if (exportProductionCsvBtn) {
        exportProductionCsvBtn.addEventListener('click', exportProductionCSV);
    }

    if (exportProductionPdfBtn) {
        exportProductionPdfBtn.addEventListener('click', exportProductionPDF);
    }

    if (productionSearch) {
        productionSearch.addEventListener('input', applyProductionFilters);
    }
    if (productionStageFilter) {
        productionStageFilter.addEventListener('change', applyProductionFilters);
    }
    if (productionDateFrom) {
        productionDateFrom.addEventListener('change', applyProductionFilters);
    }
    if (productionDateTo) {
        productionDateTo.addEventListener('change', applyProductionFilters);
    }
    if (resetProductionFilters) {
        resetProductionFilters.addEventListener('click', () => {
            if (productionSearch) productionSearch.value = '';
            if (productionStageFilter) productionStageFilter.value = 'all';
            if (productionDateFrom) productionDateFrom.value = '';
            if (productionDateTo) productionDateTo.value = '';
            applyProductionFilters();
        });
    }

});

function applyProductionFilters() {
    if (!productionDataAll.length) return;
    const user = JSON.parse(localStorage.getItem('user'));
    if (!user) return;

    const searchTerm = (productionSearch?.value || '').toLowerCase();
    const stageFilter = productionStageFilter?.value || 'all';
    const fromVal = productionDateFrom?.value || '';
    const toVal = productionDateTo?.value || '';
    const fromDate = fromVal ? new Date(fromVal) : null;
    const toDate = toVal ? new Date(toVal) : null;

    const filtered = productionDataAll.filter(run => {
        const text = `${run.productName || ''} ${run.batchId || ''} ${run.productionLocation || ''} ${run.curingLocation || ''} ${run.stockLocation || ''} ${run.septicLocation || ''}`.toLowerCase();
        if (searchTerm && !text.includes(searchTerm)) return false;
        const stageRaw = run.status || 'Completed';
        const stage = stageRaw === 'Planned' ? 'Started' : stageRaw;
        if (stageFilter !== 'all' && stage !== stageFilter) return false;
        if (fromDate || toDate) {
            const dateObj = run.date?.toDate ? run.date.toDate() : (run.date ? new Date(run.date) : null);
            if (fromDate && dateObj && dateObj < fromDate) return false;
            if (toDate && dateObj) {
                const end = new Date(toDate);
                end.setHours(23, 59, 59, 999);
                if (dateObj > end) return false;
            }
        }
        return true;
    });

    renderProductionRows(filtered, user);
}

async function loadProductionHistory() {
    const user = JSON.parse(localStorage.getItem('user'));
    if (!user || !productionTablePipes || !productionTableSeptic) return;
    const businessId = user.businessId || user.uid;

    const pipesBody = productionTablePipes.querySelector('tbody');
    const septicBody = productionTableSeptic.querySelector('tbody');
    pipesBody.innerHTML = '<tr><td colspan="8" class="text-center">Loading...</td></tr>';
    septicBody.innerHTML = '<tr><td colspan="7" class="text-center">Loading...</td></tr>';

    try {
        await loadProductionMasters(businessId);
        const snapshot = await db.collection('users').doc(businessId)
            .collection('production_runs')
            .orderBy('date', 'desc')
            .limit(200)
            .get();

        pipesBody.innerHTML = '';
        septicBody.innerHTML = '';
        productionData = [];
        productionDataAll = [];

        if (snapshot.empty) {
            updateCuringStats([]);
            pipesBody.innerHTML = '<tr><td colspan="8" class="text-center text-muted">No pipe production records found</td></tr>';
            septicBody.innerHTML = '<tr><td colspan="7" class="text-center text-muted">No septic assembly records found</td></tr>';
            return;
        }

        updateCuringStats(snapshot.docs);

        snapshot.forEach(doc => {
            const data = doc.data();
            productionDataAll.push({ id: doc.id, ...data });
        });

        renderProductionRows(productionDataAll, user);
        applyProductionFilters();
    } catch (error) {
        console.error('Error loading production history:', error);
        pipesBody.innerHTML = '<tr><td colspan="8" class="text-center text-danger">Error loading data</td></tr>';
        septicBody.innerHTML = '<tr><td colspan="7" class="text-center text-danger">Error loading data</td></tr>';
    }
}

function renderProductionRows(runs, user) {
    const pipesBody = productionTablePipes.querySelector('tbody');
    const septicBody = productionTableSeptic.querySelector('tbody');
    pipesBody.innerHTML = '';
    septicBody.innerHTML = '';
    productionData = [];
    const septicRuns = [];
    const pipeRuns = [];
    runs.forEach(run => {
        const isSeptic = (run.productType || '').toLowerCase().includes('septic') || Boolean(run.sourceRunId);
        if (isSeptic) septicRuns.push(run);
        else pipeRuns.push(run);
    });

    if (!pipeRuns.length) {
        pipesBody.innerHTML = '<tr><td colspan="8" class="text-center text-muted">No pipe production records found</td></tr>';
    }
    if (!septicRuns.length) {
        septicBody.innerHTML = '<tr><td colspan="7" class="text-center text-muted">No septic assembly records found</td></tr>';
    }

    const allRuns = [...pipeRuns, ...septicRuns];
    allRuns.forEach(data => {
        productionData.push(data);
        const canDelete = user.permissions ? user.permissions.canDelete : true;
        const stageRaw = data.status || 'Completed';
        const stage = stageRaw === 'Planned' ? 'Started' : stageRaw;
        const isStarted = stage === 'Started';
        const isOnCuring = stage === 'On Curing';
        const isCompleted = stage === 'Completed';

        let statusBadge = `<span class="badge bg-success">Completed</span>`;
        let actionBtn = '';

        if (isOnCuring) {
            statusBadge = `<span class="badge bg-warning text-dark"><i class="fas fa-clock me-1"></i>On Curing</span>`;
            actionBtn = `<button class="btn btn-sm btn-outline-success ms-2" onclick="window.completeCuring('${data.id}')">Complete Curing</button>`;
        }

        if (isStarted) {
            statusBadge = `<span class="badge bg-secondary">Started</span>`;
            actionBtn = `<button class="btn btn-sm btn-outline-warning ms-2" onclick="window.startCuring('${data.id}')">Move To Curing</button>`;
        }

        if (isCompleted) {
            statusBadge = `<span class="badge bg-success">Completed</span>`;
        }

        const internalUseQty = Number(data.internalUseQty || 0);
        const producedQty = Number(data.quantityProduced || 0);
        const rejectedQty = Number(data.rejectedQuantity || data.brokenQuantity || 0);
        const goodQty = Number(data.goodQty || Math.max(0, producedQty - rejectedQty));
        const availableQty = Number(data.sellableQty || Math.max(0, goodQty - internalUseQty));
        const castingLocation = data.productionLocation ? `Casting: ${data.productionLocation}` : '';
        const curingLocation = data.curingLocation ? `Curing: ${data.curingLocation}` : '';
        const stockLocation = data.stockLocation ? `Ready: ${data.stockLocation} (${availableQty})` : '';
        const septicLocation = data.septicLocation ? `Septic: ${data.septicLocation} (${internalUseQty})` : '';
        const locationText = [castingLocation, curingLocation, stockLocation, septicLocation].filter(Boolean).join(' | ') || '-';

        const stageBadgeMap = {
            Started: 'bg-secondary',
            'On Curing': 'bg-warning text-dark',
            Completed: 'bg-success'
        };
        const stageBadge = `<span class="badge ${stageBadgeMap[stage] || 'bg-secondary'}">${stage}</span>`;

        const isSepticAssembly = (data.productType || '').toLowerCase().includes('septic') || Boolean(data.sourceRunId);
        const sourceText = isSepticAssembly && (data.sourceProductName || data.sourceBatchId)
            ? `<div class="small text-muted">From: ${data.sourceProductName || 'Pipe'} ${data.sourceBatchId ? `(${data.sourceBatchId})` : ''}</div>`
            : '';

        const septicActionBtn = isSepticAssembly ? '' : `<button class="btn btn-sm btn-outline-secondary ms-1" onclick="window.allocateSeptic('${data.id}')">Septic</button>`;
        const row = isSepticAssembly ? `
            <tr>
                <td>${formatDate(data.date)}</td>
                <td class="fw-bold text-primary">${data.finishedGoodName}${sourceText}</td>
                <td>
                    <span class="badge bg-success">${producedQty} Produced</span>
                    ${isCompleted ? `<div class="small text-muted mt-1">Good: ${goodQty} | Available: ${availableQty}</div>` : ''}
                </td>
                <td>${stageBadge}</td>
                <td><span class="badge bg-info text-dark">${internalUseQty} Allocated</span></td>
                <td>${locationText}</td>
                <td>
                    ${actionBtn}
                    <button class="btn btn-sm btn-outline-primary ms-1" onclick="window.editProductionRun('${data.id}')">Edit</button>
                    ${canDelete ? `<button class="btn btn-sm btn-outline-danger ms-1" onclick="window.deleteProductionRun('${data.id}')"><i class="fas fa-trash\"></i></button>` : ''}
                </td>
            </tr>
        ` : `
            <tr>
                <td>${formatDate(data.date)}</td>
                <td class="fw-bold text-primary">${data.finishedGoodName}${sourceText}</td>
                <td>
                    <span class="badge bg-success">${producedQty} Produced</span>
                    ${isCompleted ? `<div class="small text-muted mt-1">Good: ${goodQty} | Available: ${availableQty}</div>` : ''}
                </td>
                <td>${stageBadge}</td>
                <td>${isOnCuring ? statusBadge : (isStarted ? '<span class="text-muted">Not Started</span>' : '<span class="text-muted">N/A</span>')}</td>
                <td><span class="badge bg-info text-dark">${internalUseQty} Allocated</span></td>
                <td>${locationText}</td>
                <td>
                    ${actionBtn}
                    ${septicActionBtn}
                    <button class="btn btn-sm btn-outline-primary ms-1" onclick="window.editProductionRun('${data.id}')">Edit</button>
                    ${canDelete ? `<button class="btn btn-sm btn-outline-danger ms-1" onclick="window.deleteProductionRun('${data.id}')"><i class="fas fa-trash\"></i></button>` : ''}
                </td>
            </tr>
        `;
        if (isSepticAssembly) {
            septicBody.innerHTML += row;
        } else {
            pipesBody.innerHTML += row;
        }
    });
}

function getProductionExportRows() {
    return productionData.map(run => {
        const materialsList = (run.ingredients || []).map(i => `${i.name} (${i.quantity} ${i.unit || ''})`).join(', ');
        const producedQty = Number(run.quantityProduced || 0);
        const rejectedQty = Number(run.rejectedQuantity || run.brokenQuantity || 0);
        const goodQty = Number(run.goodQty || Math.max(0, producedQty - rejectedQty));
        const internalUseQty = Number(run.internalUseQty || 0);
        const availableQty = Number(run.sellableQty || Math.max(0, goodQty - internalUseQty));
        return [
            formatDate(run.date),
            run.finishedGoodName || '',
            producedQty,
            run.status || '',
            goodQty,
            internalUseQty,
            availableQty,
            materialsList,
            run.mouldsUsed || ''
        ];
    });
}

function exportProductionCSV() {
    if (!productionData.length) {
        alert('No production data to export.');
        return;
    }

    const headers = ['Date', 'Finished Good', 'Qty Produced', 'Stage', 'Good Qty', 'Septic Allocation', 'Available Qty', 'Materials Used', 'Moulds Used'];
    const rows = getProductionExportRows();
    const filename = `production_${new Date().toISOString().split('T')[0]}.csv`;
    downloadCSV(filename, headers, rows);
}

function exportProductionPDF() {
    if (!productionData.length) {
        alert('No production data to export.');
        return;
    }

    const headers = ['Date', 'Finished Good', 'Qty Produced', 'Stage', 'Good Qty', 'Septic Allocation', 'Available Qty', 'Materials Used', 'Moulds Used'];
    const rows = getProductionExportRows();
    const filename = `production_${new Date().toISOString().split('T')[0]}.pdf`;
    downloadPDF(filename, 'Production Report', headers, rows);
}

function updateCuringStats(docs) {
    const container = document.getElementById('curingStatsContainer');
    if (!container) return;

    let inProduction = 0;
    let inCuring = 0;
    let completed = 0;
    let readyToFinish = 0;
    let septicAllocated = 0;
    let availableQty = 0;
    const today = new Date();

    docs.forEach(doc => {
        const data = doc.data();
        const statusRaw = data.status || 'Completed';
        const status = statusRaw === 'Planned' ? 'Started' : statusRaw;
        if (status === 'Started') inProduction++;
        if (status === 'Completed') completed++;
        if (status === 'On Curing') {
            inCuring++;
        }
        const producedQty = Number(data.quantityProduced || 0);
        const rejectedQty = Number(data.rejectedQuantity || data.brokenQuantity || 0);
        const goodQty = Number(data.goodQty || Math.max(0, producedQty - rejectedQty));
        const internalUseQty = Number(data.internalUseQty || 0);
        if (status === 'Completed') {
            septicAllocated += internalUseQty;
            availableQty += Math.max(0, goodQty - internalUseQty);
        }
    });

    const setText = (id, value) => {
        const el = document.getElementById(id);
        if (el) el.textContent = value.toLocaleString();
    };

    setText('prodInProductionCount', inProduction);
    setText('prodCuringCount', inCuring);
    setText('prodCompletedCount', completed);
    setText('prodSepticAllocated', septicAllocated);
    setText('prodAvailableQty', availableQty);
    setText('prodStartedCount', inProduction);
    setText('prodOnCuringCount', inCuring);
    setText('prodReadyCount', completed);
    setText('dashProdStarted', inProduction);
    setText('dashProdCuring', inCuring);
    setText('dashProdReady', completed);
    setText('dashProdAvailable', availableQty);

    container.innerHTML = `
        <div class="col-12">
            <div class="alert alert-light border shadow-sm d-flex justify-content-between align-items-center">
                <div>
                    <i class="fas fa-layer-group fa-lg me-2 text-primary"></i>
                    <strong>Green Stock (Curing):</strong> ${inCuring} batches in process.
                </div>
                ${readyToFinish > 0 ? `<span class="badge bg-success p-2 pulse-animation">Action Required: ${readyToFinish} Ready for Stock</span>` : '<span class="text-muted small">No batches ready yet</span>'}
            </div>
        </div>
    `;
}

async function loadProductionMasters(businessId) {
    try {
        const [moldSnap, locationSnap, productSnap] = await Promise.all([
            db.collection('users').doc(businessId).collection('mold_master').orderBy('moldId').get(),
            db.collection('users').doc(businessId).collection('location_master').orderBy('name').get(),
            db.collection('users').doc(businessId).collection('product_master').orderBy('name').get()
        ]);

        moldMasterItems = moldSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        locationMasterItems = locationSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        productMasterItems = productSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));

        populateMoldSelect();
        populateLocationSelects();
        populateProductMasterSelect();
        populateSepticAllocationLocations();
        populateSepticProductSelect();
    } catch (error) {
        console.error('Load Production Masters Error', error);
        showAlert('danger', 'Failed to load production masters');
    }
}

function populateMoldSelect() {
    if (!prodMoldSelect) return;
    if (moldMasterItems.length === 0) {
        prodMoldSelect.innerHTML = '<option value="">No molds added</option>';
        return;
    }
    prodMoldSelect.innerHTML = '<option value="">Select Mold...</option>';
    moldMasterItems.forEach(m => {
        const status = (m.status || 'Available').trim();
        const option = document.createElement('option');
        option.value = m.id;
        option.textContent = `${m.moldId || 'Mold'}${status ? ` (${status})` : ''}`;
        option.dataset.moldNumber = m.moldId || '';
        if (status.toLowerCase() !== 'available') {
            option.disabled = true;
        }
        prodMoldSelect.appendChild(option);
    });
}

function populateLocationSelects() {
    if (locationMasterItems.length === 0) {
        if (prodCastingLocationSelect) prodCastingLocationSelect.innerHTML = '<option value="">No locations added</option>';
        if (curingToLocationSelect) curingToLocationSelect.innerHTML = '<option value="">No locations added</option>';
        if (completeReadyLocationSelect) completeReadyLocationSelect.innerHTML = '<option value="">No locations added</option>';
        return;
    }
    const options = locationMasterItems.map(loc => {
        const option = document.createElement('option');
        option.value = loc.id;
        option.textContent = `${loc.name || 'Location'}${loc.type ? ` (${loc.type})` : ''}`;
        option.dataset.locationName = loc.name || '';
        return option;
    });

    const applyOptions = (select) => {
        if (!select) return;
        select.innerHTML = '<option value="">Select Location...</option>';
        options.forEach(opt => select.appendChild(opt.cloneNode(true)));
    };

    applyOptions(prodCastingLocationSelect);
    applyOptions(curingToLocationSelect);
    applyOptions(completeReadyLocationSelect);
}

function populateProductMasterSelect() {
    if (!prodProductMasterSelect) return;
    if (productMasterItems.length === 0) {
        prodProductMasterSelect.innerHTML = '<option value="">No product masters added</option>';
        return;
    }
    prodProductMasterSelect.innerHTML = '<option value="">Select Product Master...</option>';
    productMasterItems.forEach(p => {
        const name = p.name || p.productName || 'Product';
        const category = p.category || p.productCategory || '';
        const option = document.createElement('option');
        option.value = p.id;
        option.textContent = category ? `${name} (${category})` : name;
        prodProductMasterSelect.appendChild(option);
    });
}

function populateSepticAllocationLocations() {
    if (!septicAllocationLocationSelect) return;
    if (locationMasterItems.length === 0) {
        septicAllocationLocationSelect.innerHTML = '<option value="">No locations added</option>';
        return;
    }
    septicAllocationLocationSelect.innerHTML = '<option value="">Select Location...</option>';
    locationMasterItems.forEach(loc => {
        const option = document.createElement('option');
        option.value = loc.id;
        option.textContent = `${loc.name || 'Location'}${loc.type ? ` (${loc.type})` : ''}`;
        option.dataset.locationName = loc.name || '';
        septicAllocationLocationSelect.appendChild(option);
    });
}

function populateSepticProductSelect() {
    if (!septicAllocationProductSelect) return;
    const septicProducts = productMasterItems.filter(p => (p.category || '').toLowerCase().includes('septic'));
    if (septicProducts.length === 0) {
        septicAllocationProductSelect.innerHTML = '<option value="">No septic products added</option>';
        return;
    }
    septicAllocationProductSelect.innerHTML = '<option value="">Select Septic Product...</option>';
    septicProducts.forEach(p => {
        const option = document.createElement('option');
        option.value = p.id;
        option.textContent = p.name || 'Septic Product';
        septicAllocationProductSelect.appendChild(option);
    });
}

function applyProductMasterSelection() {
    if (!prodProductMasterSelect) return;
    const id = prodProductMasterSelect.value;
    if (!id) {
        if (productDetailsDiv) productDetailsDiv.textContent = '';
        return;
    }
    const p = productMasterItems.find(item => item.id === id);
    if (!p) return;

    const name = p.name || p.productName || '';

    if (name && productDetailsDiv) {
        productDetailsDiv.textContent = `Master: ${name}`;
    }
}

async function openProductionModal() {
    const user = JSON.parse(localStorage.getItem('user'));
    const businessId = user.businessId || user.uid;
    
    // Load Inventory for Dropdowns
    try {
        await loadProductionMasters(businessId);
        const snapshot = await db.collection('users').doc(businessId).collection('inventory').get();
        inventoryItems = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        
        // Reset Form
        document.getElementById('productionForm').reset();
        if (prodMoldSelect) prodMoldSelect.disabled = false;
        if (prodProductMasterSelect) prodProductMasterSelect.value = '';
        if (prodProductMasterSelect) prodProductMasterSelect.disabled = false;
        const brokenInput = document.getElementById('brokenQuantity');
        if (brokenInput) brokenInput.value = '0';
        const wastageInput = document.getElementById('wastageQuantity');
        if (wastageInput) wastageInput.value = '0';
        currentEditId = null;
        ingredientsContainer.innerHTML = '';
        if (estimatedCostElement) estimatedCostElement.textContent = '₹0.00';
        document.getElementById('productionDate').valueAsDate = new Date();
        if (productDetailsDiv) productDetailsDiv.textContent = '';
        if (stockStatusBadge) {
            stockStatusBadge.className = 'badge bg-secondary';
            stockStatusBadge.textContent = 'Status: Pending';
        }
        addIngredientRow(); // Add one empty row by default
        new bootstrap.Modal(productionModal).show();
    } catch (error) {
        console.error("Error fetching inventory", error);
        showAlert('danger', 'Failed to load inventory data');
    }
}

function addIngredientRow(preSelectedId = null, preQty = null) {
    const rowId = Date.now();
    // Filter for valid raw materials/ingredients
    const validCategories = ['Raw Materials', 'Cement', 'Sand', 'Dust', 'Aggregate', 'Steel', 'Fly Ash', 'Admixtures', 'Chemicals'];
    const rawMaterials = inventoryItems.filter(i => validCategories.includes(i.category));
    
    // Sort by category then name
    rawMaterials.sort((a, b) => {
        if (a.category !== b.category) return a.category.localeCompare(b.category);
        return a.name.localeCompare(b.name);
    });
    
    const options = rawMaterials.map(item => 
        `<option value="${item.id}" data-unit="${item.unit}">${item.name} [${item.category}] (Avail: ${item.quantity} ${item.unit})</option>`
    ).join('');

    const html = `
        <div class="row g-2 mb-2 align-items-end ingredient-row" id="row-${rowId}">
            <div class="col-md-6">
                <label class="form-label small">Raw Material</label>
                <select class="form-select form-select-sm ingredient-select" required>
                    <option value="">Select Material...</option>
                    ${options}
                </select>
            </div>
            <div class="col-md-4">
                <label class="form-label small">Quantity Used</label>
                <input type="number" class="form-control form-control-sm ingredient-qty" placeholder="Qty" min="0" step="0.01" required value="${preQty || ''}">
            </div>
            <div class="col-md-2">
                <button type="button" class="btn btn-outline-danger btn-sm w-100 remove-ingredient-btn">
                    <i class="fas fa-times"></i>
                </button>
            </div>
        </div>
    `;
    
    ingredientsContainer.insertAdjacentHTML('beforeend', html);

    if (preSelectedId) {
        const newRow = document.getElementById(`row-${rowId}`);
        if (newRow) newRow.querySelector('.ingredient-select').value = preSelectedId;
    }
    calculateCost();
}

async function ensureFinishedGoodInventory(businessId, productMaster) {
    if (!productMaster || !productMaster.name) {
        throw new Error('Product Master is required.');
    }
    const rawCategory = (productMaster.category || '').toLowerCase();
    const invCategory = rawCategory.includes('septic') ? 'Septic Tank Products' : 'RCC Pipes';
    const userRef = db.collection('users').doc(businessId);
    const existingSnap = await userRef.collection('inventory')
        .where('name', '==', productMaster.name)
        .where('category', '==', invCategory)
        .limit(1)
        .get();

    if (!existingSnap.empty) {
        const existingDoc = existingSnap.docs[0];
        const existingData = existingDoc.data();
        const imageUrl = productMaster.imageUrl || '';
        const hsn = productMaster.hsn || '';
        const gstRate = productMaster.gstRate ?? existingData.gstRate ?? 0;
        const updates = {};
        if (imageUrl && existingData.imageUrl !== imageUrl) updates.imageUrl = imageUrl;
        if (hsn && existingData.hsn !== hsn) updates.hsn = hsn;
        if (gstRate !== undefined && existingData.gstRate !== gstRate) updates.gstRate = gstRate;
        if (Object.keys(updates).length) {
            updates.updatedAt = new Date();
            await existingDoc.ref.update(updates);
        }
        return existingDoc.id;
    }

    const docRef = userRef.collection('inventory').doc();
    await docRef.set({
        name: productMaster.name,
        category: invCategory,
        unit: productMaster.unit || 'Nos',
        quantity: 0,
        reorderLevel: 0,
        costPrice: parseFloat(productMaster.costPrice || 0) || 0,
        sellingPrice: parseFloat(productMaster.sellingPrice || 0) || 0,
        hsn: productMaster.hsn || '',
        gstRate: productMaster.gstRate ?? 0,
        imageUrl: productMaster.imageUrl || '',
        source: 'product_master',
        createdAt: new Date()
    });
    return docRef.id;
}

async function saveSepticAllocation() {
    if (!currentSepticRunId) return;
    const qty = parseFloat(septicAllocationQtyInput?.value || '0');
    if (isNaN(qty) || qty < 0) {
        return showAlert('danger', 'Invalid quantity');
    }
    const septicProductId = septicAllocationProductSelect?.value || '';
    if (!septicProductId) {
        return showAlert('danger', 'Select a septic product');
    }
    const user = JSON.parse(localStorage.getItem('user'));
    const businessId = user.businessId || user.uid;
    const locId = septicAllocationLocationSelect?.value || null;
    const locName = septicAllocationLocationSelect?.selectedOptions?.[0]?.dataset.locationName || null;
    try {
        const septicProduct = productMasterItems.find(p => p.id === septicProductId);
        if (!septicProduct) {
            throw new Error('Septic product not found');
        }
        const septicFgId = await ensureFinishedGoodInventory(businessId, septicProduct);

        await db.runTransaction(async (transaction) => {
            const runRef = db.collection('users').doc(businessId).collection('production_runs').doc(currentSepticRunId);
            const runDoc = await transaction.get(runRef);
            if (!runDoc.exists) throw new Error('Production run not found');
            const data = runDoc.data();
            if ((data.status || '') !== 'Completed') {
                throw new Error('Complete curing before allocation');
            }

            const goodQty = Number(data.goodQty ?? data.quantityProduced ?? 0);
            if (qty > goodQty) {
                throw new Error('Allocation exceeds good quantity');
            }

            const previousQty = Number(data.internalUseQty || 0);
            const delta = qty - previousQty;

            const fgRef = db.collection('users').doc(businessId).collection('inventory').doc(data.finishedGoodId);
            const septicFgRef = db.collection('users').doc(businessId).collection('inventory').doc(septicFgId);

            let fgDoc = null;
            let septicFgDoc = null;
            if (delta !== 0) {
                fgDoc = await transaction.get(fgRef);
                if (!fgDoc.exists) throw new Error('Finished good not found');
            }
            if (delta > 0) {
                septicFgDoc = await transaction.get(septicFgRef);
            }

            if (delta !== 0) {
                const currentQty = Number(fgDoc.data().quantity || 0);
                if (delta > 0 && currentQty < delta) {
                    throw new Error('Not enough stock to allocate');
                }
                transaction.update(fgRef, { quantity: currentQty - delta });
            }

            if (delta > 0) {
                const septicCurrentQty = septicFgDoc && septicFgDoc.exists ? Number(septicFgDoc.data().quantity || 0) : 0;
                if (septicFgDoc && septicFgDoc.exists) {
                    transaction.update(septicFgRef, { quantity: septicCurrentQty + delta });
                } else {
                    transaction.set(septicFgRef, {
                        name: septicProduct.name,
                        category: 'Septic Tank Products',
                        unit: septicProduct.unit || 'Nos',
                        quantity: delta,
                        reorderLevel: 0,
                        costPrice: parseFloat(septicProduct.costPrice || 0) || 0,
                        sellingPrice: parseFloat(septicProduct.sellingPrice || 0) || 0,
                        source: 'product_master',
                        createdAt: new Date()
                    });
                }

                const septicRunRef = db.collection('users').doc(businessId).collection('production_runs').doc();
                const batchId = 'SEPTIC-' + Date.now().toString().substr(-6);
                const productionDate = new Date();
                transaction.set(septicRunRef, {
                    batchId,
                    date: productionDate,
                    finishedGoodId: septicFgId,
                    finishedGoodName: septicProduct.name,
                    productType: 'Septic Tank',
                    productMasterId: septicProduct.id,
                    productMasterName: septicProduct.name,
                    quantityProduced: delta,
                    brokenQuantity: 0,
                    internalUseQty: 0,
                    status: 'Completed',
                    goodQty: delta,
                    sellableQty: delta,
                    completedAt: new Date(),
                    notes: `Allocated from ${data.finishedGoodName || 'pipe'} batch ${data.batchId || ''}`.trim(),
                    sourceRunId: currentSepticRunId,
                    sourceProductId: data.finishedGoodId,
                    sourceProductName: data.finishedGoodName || null,
                    sourceBatchId: data.batchId || null,
                    septicLocationId: locId,
                    septicLocation: locName,
                    createdAt: new Date()
                });
            }

            const sellableQty = Math.max(0, goodQty - qty);
            transaction.update(runRef, {
                internalUseQty: qty,
                septicLocationId: locId,
                septicLocation: locName,
                septicProductMasterId: septicProductId,
                septicProductMasterName: septicProduct.name,
                sellableQty
            });
        });
        bootstrap.Modal.getInstance(septicAllocationModal).hide();
        currentSepticRunId = null;
        showAlert('success', 'Septic allocation updated');
        loadProductionHistory();
    } catch (error) {
        console.error('Allocation Error', error);
        showAlert('danger', error.message || 'Failed to update allocation');
    }
}

async function saveMoveToCuring() {
    if (!currentCuringRunId) return;
    const qty = parseFloat(curingQtyInput?.value || '0');
    if (isNaN(qty) || qty <= 0) {
        return showAlert('danger', 'Enter a valid quantity');
    }
    const toLocId = curingToLocationSelect?.value || null;
    const toLocName = curingToLocationSelect?.selectedOptions?.[0]?.dataset.locationName || null;
    if (!toLocId) {
        return showAlert('danger', 'Select a curing location');
    }
    const startDate = curingStartDateInput?.value ? new Date(curingStartDateInput.value) : new Date();
    const user = JSON.parse(localStorage.getItem('user'));
    const businessId = user.businessId || user.uid;
    try {
        await db.runTransaction(async (transaction) => {
            const runRef = db.collection('users').doc(businessId).collection('production_runs').doc(currentCuringRunId);
            const runDoc = await transaction.get(runRef);
            if (!runDoc.exists) throw new Error('Production run not found');
            const run = runDoc.data();
            const producedQty = Number(run.quantityProduced || 0);
            if (qty > producedQty) {
                throw new Error('Curing quantity exceeds produced quantity');
            }

            transaction.update(runRef, {
                status: 'On Curing',
                curingStart: startDate,
                curingFromLocation: run.productionLocation || null,
                curingLocationId: toLocId,
                curingLocation: toLocName,
                curingQty: qty
            });

            if (run.moldId) {
                const moldRef = db.collection('users').doc(businessId).collection('mold_master').doc(run.moldId);
                transaction.update(moldRef, { status: 'Available' });
            }
        });
        bootstrap.Modal.getInstance(moveToCuringModal).hide();
        currentCuringRunId = null;
        showAlert('success', 'Moved to curing');
        loadProductionHistory();
    } catch (error) {
        console.error('Move To Curing Error', error);
        showAlert('danger', error.message || 'Failed to move to curing');
    }
}

async function saveCuringComplete() {
    if (!currentCompleteRunId) return;
    const passedQty = parseFloat(completePassedQtyInput?.value || '0');
    const damagedQty = parseFloat(completeDamagedQtyInput?.value || '0');
    if (isNaN(passedQty) || passedQty < 0) {
        return showAlert('danger', 'Enter a valid passed quantity');
    }
    if (isNaN(damagedQty) || damagedQty < 0) {
        return showAlert('danger', 'Enter a valid damaged quantity');
    }
    if (damagedQty > passedQty) {
        return showAlert('danger', 'Damaged quantity cannot exceed passed quantity');
    }
    const readyLocId = completeReadyLocationSelect?.value || null;
    const readyLocName = completeReadyLocationSelect?.selectedOptions?.[0]?.dataset.locationName || null;
    if (!readyLocId) {
        return showAlert('danger', 'Select a ready stock location');
    }
    const completedDate = completeDateInput?.value ? new Date(completeDateInput.value) : new Date();
    await finishCuringProcess(currentCompleteRunId, passedQty, damagedQty, readyLocId, readyLocName, completedDate);
    bootstrap.Modal.getInstance(curingCompleteModal).hide();
    currentCompleteRunId = null;
}

async function saveProductionRun() {
    const user = JSON.parse(localStorage.getItem('user'));
    const businessId = user.businessId || user.uid;
    const produceQty = parseFloat(document.getElementById('produceQuantity').value);
    const notes = document.getElementById('productionNotes').value;
    const mouldsUsed = document.getElementById('mouldsUsed')?.value || '';
    const productMasterId = prodProductMasterSelect?.value || null;
    const selectedProductMaster = productMasterItems.find(p => p.id === productMasterId) || null;
    const productMasterName = selectedProductMaster?.name || null;
    const productType = selectedProductMaster?.category || '';
    const pipeType = selectedProductMaster?.pipeType || '';
    const loadClass = selectedProductMaster?.loadClass || '';
    const size = '';
    let moldId = prodMoldSelect?.value || '';
    let moldNumber = '';
    if (moldId) {
        const moldItem = moldMasterItems.find(m => m.id === moldId);
        moldNumber = moldItem?.moldId || '';
    } else if (prodMoldSelect?.selectedOptions?.[0]) {
        moldNumber = prodMoldSelect.selectedOptions[0].dataset.moldNumber || '';
    }
    const supervisor = document.getElementById('productionSupervisor').value;
    const labourCost = parseFloat(document.getElementById('labourCost').value) || 0;
    const powerCost = parseFloat(document.getElementById('powerCost').value) || 0;
    const dateVal = document.getElementById('productionDate').value;
    const brokenQty = parseFloat(document.getElementById('brokenQuantity')?.value || '0') || 0;
    const wastageQty = parseFloat(document.getElementById('wastageQuantity')?.value || '0') || 0;
    const stage = 'Started';
    const internalUseQty = 0;

    if (!productMasterId || !selectedProductMaster) {
        alert("Please select a Product Master.");
        return;
    }

    if (!produceQty || produceQty <= 0) {
        alert("Please enter a valid quantity.");
        return;
    }

    // Gather Ingredients
    const ingredientRows = document.querySelectorAll('.ingredient-row');
    const ingredientsUsed = [];
    
    for (const row of ingredientRows) {
        const select = row.querySelector('.ingredient-select');
        const qtyInput = row.querySelector('.ingredient-qty');
        const id = select.value;
        const qty = parseFloat(qtyInput.value);
        
        if (id && qty > 0) {
            const item = inventoryItems.find(i => i.id === id);
            ingredientsUsed.push({
                id: id,
                name: item.name,
                quantity: qty,
                unit: item.unit
            });
        }
    }

    if (moldMasterItems.length > 0 && !moldId) {
        showAlert('danger', 'Select a mold before saving.');
        return;
    }
    if (!prodCastingLocationSelect?.value) {
        showAlert('danger', 'Select a production location.');
        return;
    }

    let fgId = null;
    try {
        fgId = await ensureFinishedGoodInventory(businessId, selectedProductMaster);
    } catch (error) {
        console.error('Inventory Ensure Error', error);
        showAlert('danger', 'Failed to prepare finished goods inventory.');
        return;
    }

    if (currentEditId) {
        await updateProductionRun(businessId, produceQty, null, {
            productType,
            pipeType,
            loadClass,
            size,
            productMasterId,
            productMasterName,
            moldId,
            moldNumber,
            productionLocationId: prodCastingLocationSelect?.value || null,
            productionLocation: prodCastingLocationSelect?.selectedOptions?.[0]?.dataset.locationName || null,
            supervisor,
            notes,
            dateVal
        });
        return;
    }

    if (ingredientsUsed.length === 0) {
        window.showConfirm('No Materials', 'No raw materials selected. Record production without deducting materials?', () => {
            processProductionSave(businessId, fgId, produceQty, ingredientsUsed, mouldsUsed, 0, supervisor, labourCost, powerCost, notes, dateVal, brokenQty, wastageQty, stage, internalUseQty, { productType, pipeType, loadClass, size, productMasterId, productMasterName, moldId, moldNumber, productionLocationId: prodCastingLocationSelect?.value || null, productionLocation: prodCastingLocationSelect?.selectedOptions?.[0]?.dataset.locationName || null, septicLocationId: null, septicLocation: null });
        });
    } else {
        processProductionSave(businessId, fgId, produceQty, ingredientsUsed, mouldsUsed, 0, supervisor, labourCost, powerCost, notes, dateVal, brokenQty, wastageQty, stage, internalUseQty, { productType, pipeType, loadClass, size, productMasterId, productMasterName, moldId, moldNumber, productionLocationId: prodCastingLocationSelect?.value || null, productionLocation: prodCastingLocationSelect?.selectedOptions?.[0]?.dataset.locationName || null, septicLocationId: null, septicLocation: null });
    }
}

async function updateProductionRun(businessId, produceQty, stage, fields) {
    try {
        const runRef = db.collection('users').doc(businessId).collection('production_runs').doc(currentEditId);
        const updates = {
            productType: fields.productType || null,
            pipeType: fields.pipeType || null,
            loadClass: fields.loadClass || null,
            size: fields.size || null,
            productMasterId: fields.productMasterId || null,
            productMasterName: fields.productMasterName || null,
            moldId: fields.moldId || null,
            moldNumber: fields.moldNumber || null,
            productionLocationId: fields.productionLocationId || null,
            productionLocation: fields.productionLocation || null,
            septicLocationId: fields.septicLocationId || null,
            septicLocation: fields.septicLocation || null,
            supervisor: fields.supervisor || '',
            notes: fields.notes || '',
            date: fields.dateVal ? new Date(fields.dateVal) : new Date()
        };
        if (stage) updates.status = stage;

        await runRef.update(updates);
        bootstrap.Modal.getInstance(productionModal).hide();
        showAlert('success', 'Production updated');
        currentEditId = null;
        loadProductionHistory();
    } catch (error) {
        console.error('Update Production Error', error);
        showAlert('danger', 'Failed to update production');
    } finally {
        const qtyInput = document.getElementById('produceQuantity');
        if (qtyInput) qtyInput.disabled = false;
        if (prodProductMasterSelect) prodProductMasterSelect.disabled = false;
        if (prodMoldSelect) prodMoldSelect.disabled = false;
        if (ingredientsContainer) {
            ingredientsContainer.querySelectorAll('input, select, button').forEach(el => el.disabled = false);
        }
    }
}

async function createPlannedRun(businessId, fgId, produceQty, ingredientsUsed, mouldsUsed, supervisor, notes, dateVal, internalUseQty) {
    const saveBtn = document.getElementById('saveProductionBtn');
    const originalText = saveBtn.innerHTML;
    saveBtn.disabled = true;
    saveBtn.innerHTML = '<span class="spinner-border spinner-border-sm"></span> Saving...';

    try {
        const userRef = db.collection('users').doc(businessId);
        const fgDoc = await userRef.collection('inventory').doc(fgId).get();
        if (!fgDoc.exists) throw new Error("Finished good not found!");

        const productionDate = dateVal ? new Date(dateVal) : new Date();
        const batchId = 'PLAN-' + Date.now().toString().substr(-6);

        await userRef.collection('production_runs').add({
            batchId: batchId,
            date: productionDate,
            finishedGoodId: fgId,
            finishedGoodName: fgDoc.data().name,
            quantityProduced: produceQty,
            internalUseQty: internalUseQty,
            ingredients: ingredientsUsed,
            mouldsUsed: mouldsUsed,
            supervisor: supervisor,
            notes: notes,
            status: 'Planned',
            createdAt: new Date()
        });

        bootstrap.Modal.getInstance(productionModal).hide();
        showAlert('success', 'Pre-production plan saved!');
        loadProductionHistory();
    } catch (error) {
        console.error("Plan Save Error:", error);
        showAlert('danger', error.message || "Failed to save plan");
    } finally {
        saveBtn.disabled = false;
        saveBtn.innerHTML = originalText;
    }
}

async function processProductionSave(businessId, fgId, produceQty, ingredientsUsed, mouldsUsed, curingDays, supervisor, labourCost, powerCost, notes, dateVal, brokenQty, wastageQty, stage, internalUseQty, extraFields = {}) {
    const saveBtn = document.getElementById('saveProductionBtn');
    const originalText = saveBtn.innerHTML;
    saveBtn.disabled = true;
    saveBtn.innerHTML = '<span class="spinner-border spinner-border-sm"></span> Processing...';

    try {
        const batch = db.batch();
        const userRef = db.collection('users').doc(businessId);
        
        // 1. Run Transaction to check stock and update
        await db.runTransaction(async (transaction) => {
            // Get Finished Good Doc
            const fgRef = userRef.collection('inventory').doc(fgId);
            const fgDoc = await transaction.get(fgRef);
            if (!fgDoc.exists) throw "Finished good not found!";

            // Check Mold Availability
            let moldRef = null;
            if (extraFields.moldId) {
                moldRef = userRef.collection('mold_master').doc(extraFields.moldId);
                const moldDoc = await transaction.get(moldRef);
                if (!moldDoc.exists) throw "Mold not found!";
                const moldStatus = (moldDoc.data().status || 'Available').toLowerCase();
                if (moldStatus !== 'available') {
                    throw new Error(`Mold is not available (status: ${moldDoc.data().status || 'Unknown'})`);
                }
            }

            // Get Ingredient Docs
            const ingredientUpdates = [];
            for (const ing of ingredientsUsed) {
                const ref = userRef.collection('inventory').doc(ing.id);
                const doc = await transaction.get(ref);
                if (!doc.exists) throw `Material ${ing.name} not found!`;
                
                const currentQty = doc.data().quantity || 0;
                if (currentQty < ing.quantity) {
                    throw `Insufficient stock for ${ing.name}. Available: ${currentQty}, Required: ${ing.quantity}`;
                }
                
                ingredientUpdates.push({ ref, newQty: currentQty - ing.quantity });
            }

            const productionDate = dateVal ? new Date(dateVal) : new Date();

            // Determine Status
            let status = 'Started';
            if (stage === 'On Curing') status = 'On Curing';
            
            // Calculate Real Cost (Weighted Average)
            let totalIngredientsCost = 0;
            ingredientsUsed.forEach(ing => {
                const item = inventoryItems.find(i => i.id === ing.id);
                if (item) {
                    totalIngredientsCost += (parseFloat(item.costPrice) || 0) * ing.quantity;
                }
            });
            
            const totalBatchCost = totalIngredientsCost + labourCost + powerCost;
            const currentFgQty = fgDoc.data().quantity || 0;
            const currentFgCost = fgDoc.data().costPrice || 0;
            
            // Weighted Average Cost = (CurrentValue + NewBatchValue) / TotalUnits
            const safeQty = Math.max(0, currentFgQty);
            const newTotalValue = (safeQty * currentFgCost) + totalBatchCost;
            const totalUnits = safeQty + produceQty;
            const newAverageCost = totalUnits > 0 ? newTotalValue / totalUnits : 0;

            const fgUpdateData = { costPrice: newAverageCost };
            const goodQty = Math.max(0, produceQty - brokenQty);
            if (internalUseQty > goodQty) {
                throw new Error("Septic allocation exceeds good quantity.");
            }

            if (status === 'Completed') {
                const sellableQty = Math.max(0, goodQty - internalUseQty);
                fgUpdateData.quantity = currentFgQty + sellableQty;
            }
            
            transaction.update(fgRef, fgUpdateData);

            // Update Ingredients
            ingredientUpdates.forEach(update => {
                transaction.update(update.ref, { quantity: update.newQty });
            });

            if (moldRef) {
                const moldStatus = status === 'On Curing' ? 'Available' : 'In Production';
                transaction.update(moldRef, { status: moldStatus, lastUsedDate: productionDate });
            }

            // Create Production Record
            const productionRef = userRef.collection('production_runs').doc();
            const batchId = 'BATCH-' + Date.now().toString().substr(-6);
            const curingStartDate = status === 'On Curing' ? productionDate : null;
            transaction.set(productionRef, {
                batchId: batchId,
                date: productionDate,
                finishedGoodId: fgId,
                finishedGoodName: fgDoc.data().name,
                productType: extraFields.productType || null,
                pipeType: extraFields.pipeType || null,
                loadClass: extraFields.loadClass || null,
                size: extraFields.size || null,
                productMasterId: extraFields.productMasterId || null,
                productMasterName: extraFields.productMasterName || null,
                moldId: extraFields.moldId || null,
                moldNumber: extraFields.moldNumber || null,
                productionLocationId: extraFields.productionLocationId || null,
                productionLocation: extraFields.productionLocation || null,
                septicLocationId: extraFields.septicLocationId || null,
                septicLocation: extraFields.septicLocation || null,
                quantityProduced: produceQty,
                brokenQuantity: brokenQty,
                wastageQuantity: wastageQty,
                internalUseQty: internalUseQty,
                ingredients: ingredientsUsed,
                mouldsUsed: mouldsUsed,
                supervisor: supervisor,
                labourCost: labourCost,
                powerCost: powerCost,
                curingDays: 0,
                curingStart: curingStartDate,
                curingEnds: null,
                notes: notes,
                status: status,
                goodQty: null,
                sellableQty: null,
                createdAt: new Date()
            });
        });

        bootstrap.Modal.getInstance(productionModal).hide();
        showAlert('success', 'Production run recorded successfully!');
        loadProductionHistory();
        
    } catch (error) {
        console.error("Production Error:", error);
        showAlert('danger', error.message || "Failed to record production");
    }
    finally {
        saveBtn.disabled = false;
        saveBtn.innerHTML = originalText;
    }
}

async function finishCuringProcess(runId, passedQty, rejectedQty, readyLocId, readyLocName, completedDate) {
    const user = JSON.parse(localStorage.getItem('user'));
    const businessId = user.businessId || user.uid;
    try {
        await db.runTransaction(async (transaction) => {
            const runRef = db.collection('users').doc(businessId).collection('production_runs').doc(runId);
            const runDoc = await transaction.get(runRef);
            
            if (!runDoc.exists) throw "Production run not found";
            const data = runDoc.data();
            
            if (data.status === 'Completed') throw "Already completed";
            
            const producedQty = Number(data.quantityProduced || 0);
            const goodQty = Number(passedQty);
            if (goodQty < 0) throw "Passed quantity cannot be negative";
            if (goodQty > producedQty) throw "Passed quantity cannot exceed produced quantity";
            const internalUseQty = Number(data.internalUseQty || 0);
            if (internalUseQty > goodQty) throw "Septic allocation exceeds good quantity";
            const sellableQty = Math.max(0, goodQty - internalUseQty);

            // Update Inventory
            const fgRef = db.collection('users').doc(businessId).collection('inventory').doc(data.finishedGoodId);
            const fgDoc = await transaction.get(fgRef);
            
            if (fgDoc.exists) {
                const currentQty = fgDoc.data().quantity || 0;
                transaction.update(fgRef, { quantity: currentQty + sellableQty });
            }

            // Update Run Status
            transaction.update(runRef, { 
                status: 'Completed', 
                rejectedQuantity: rejectedQty,
                goodQty: goodQty,
                sellableQty: sellableQty,
                stockLocationId: readyLocId || null,
                stockLocation: readyLocName || null,
                completedAt: completedDate || new Date() 
            });
        });

        showAlert('success', 'Curing completed! Stock added to inventory.');
        loadProductionHistory();
    } catch (error) {
        console.error("Curing Update Error", error);
        showAlert('danger', 'Failed to update curing status');
    }
}


window.deleteProductionRun = async (id) => {
    window.showConfirm('Delete Production Record', 'Delete this production record? Inventory will NOT be reverted automatically.', async () => {
        const user = JSON.parse(localStorage.getItem('user'));
        if (user.permissions && user.permissions.canDelete === false) {
            return showAlert('danger', 'You do not have permission to delete items.');
        }

        const businessId = user.businessId || user.uid;
        try {
            await db.collection('users').doc(businessId).collection('production_runs').doc(id).delete();
            loadProductionHistory();
        } catch(e) { console.error(e); }
    });
};

// Calculate Estimated Cost
function calculateCost() {
    if (!estimatedCostElement) return;
    
    let totalCost = 0;
    const rows = document.querySelectorAll('.ingredient-row');
    const produceQty = parseFloat(document.getElementById('produceQuantity').value) || 1;
    
    rows.forEach(row => {
        const select = row.querySelector('.ingredient-select');
        const qtyInput = row.querySelector('.ingredient-qty');
        
        const id = select.value;
        const qty = parseFloat(qtyInput.value) || 0;
        
        if (id && qty > 0) {
            const item = inventoryItems.find(i => i.id === id);
            if (item) {
                const cost = parseFloat(item.costPrice) || 0;
                totalCost += cost * qty;
            }
        }
    });
    
    estimatedCostElement.textContent = `₹${totalCost.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}`;
    checkStockAvailability();
}

function checkStockAvailability() {
    if (!stockStatusBadge) return;
    
    const rows = document.querySelectorAll('.ingredient-row');
    let allAvailable = true;
    let hasIngredients = false;

    rows.forEach(row => {
        const select = row.querySelector('.ingredient-select');
        const qtyInput = row.querySelector('.ingredient-qty');
        const id = select.value;
        const qty = parseFloat(qtyInput.value) || 0;

        if (id && qty > 0) {
            hasIngredients = true;
            const item = inventoryItems.find(i => i.id === id);
            if (item) {
                if (item.quantity < qty) {
                    allAvailable = false;
                    row.classList.add('bg-danger', 'bg-opacity-10');
                } else {
                    row.classList.remove('bg-danger', 'bg-opacity-10');
                }
            }
        }
    });

    if (!hasIngredients) {
        stockStatusBadge.className = 'badge bg-secondary';
        stockStatusBadge.textContent = 'Status: No Materials';
    } else if (allAvailable) {
        stockStatusBadge.className = 'badge bg-success';
        stockStatusBadge.textContent = 'Status: Available';
    } else {
        stockStatusBadge.className = 'badge bg-danger';
        stockStatusBadge.textContent = 'Status: Shortage';
    }
}

