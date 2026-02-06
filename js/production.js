import { db } from './firebase-config.js';
import { checkAuth, formatDate, downloadCSV, downloadPDF } from './dashboard.js';
import { showAlert } from './auth.js';

const productionTable = document.getElementById('productionTable');
const addProductionBtn = document.getElementById('addProductionBtn');
const productionModal = document.getElementById('productionModal');
const saveProductionBtn = document.getElementById('saveProductionBtn');
const addIngredientBtn = document.getElementById('addIngredientBtn');
const ingredientsContainer = document.getElementById('ingredientsContainer');
const recipeSelect = document.getElementById('recipeSelect');
const createRecipeBtn = document.getElementById('createRecipeBtn');
const deleteRecipeBtn = document.getElementById('deleteRecipeBtn');
const estimatedCostElement = document.getElementById('estimatedCost');
const productDetailsDiv = document.getElementById('productDetails');
const stockStatusBadge = document.getElementById('stockStatusBadge');
const exportProductionPdfBtn = document.getElementById('exportProductionPdfBtn');
const exportProductionCsvBtn = document.getElementById('exportProductionCsvBtn');
const productionStageSelect = document.getElementById('productionStage');
const internalUseQtyInput = document.getElementById('internalUseQty');

// Product Master Elements
const manageProductsBtn = document.getElementById('manageProductsBtn');
const productMasterModal = document.getElementById('productMasterModal');
const saveProductMasterBtn = document.getElementById('saveProductMasterBtn');
const pmIngredientBtn = document.getElementById('pmIngredientBtn');
const pmIngredientsContainer = document.getElementById('pmIngredientsContainer');
const productListContainer = document.getElementById('productListContainer');
const pmCategorySelect = document.getElementById('pmCategory');
const pmPipeTypeSelect = document.getElementById('pmPipeType');
const pmLoadClassSelect = document.getElementById('pmLoadClass');
const pmSepticTypeSelect = document.getElementById('pmSepticType');

// State
let inventoryItems = [];
let productionData = [];

// Expose function globally for onclick handlers
window.completeCuring = async (id) => {
    window.showPrompt('Complete Curing', 'Enter quantity rejected/damaged (enter 0 if none):', '0', (rejected) => {
        const rejectedQty = parseInt(rejected);
        if (isNaN(rejectedQty) || rejectedQty < 0) {
            return showAlert('danger', "Invalid quantity");
        }
        
        window.showConfirm('Confirm Completion', `Confirm curing completion? ${rejectedQty} items will be marked as rejected.`, async () => {
            await finishCuringProcess(id, rejectedQty);
        });
    });
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

    if (recipeSelect) {
        recipeSelect.addEventListener('change', handleRecipeChange);
    }
    
    if (document.getElementById('produceQuantity')) {
        document.getElementById('produceQuantity').addEventListener('input', calculateCost);
    }

    if (createRecipeBtn) {
        createRecipeBtn.addEventListener('click', saveRecipe);
    }
    
    if (deleteRecipeBtn) {
        deleteRecipeBtn.addEventListener('click', deleteRecipe);
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

    // Product Master Event Listeners
    if (manageProductsBtn) {
        manageProductsBtn.addEventListener('click', openProductMaster);
    }
    if (saveProductMasterBtn) {
        saveProductMasterBtn.addEventListener('click', saveProductDefinition);
    }
    if (pmIngredientBtn) {
        pmIngredientBtn.addEventListener('click', () => addPmIngredientRow());
    }
    if (pmCategorySelect) {
        pmCategorySelect.addEventListener('change', updateProductMasterVisibility);
    }
    if (pmIngredientsContainer) {
        pmIngredientsContainer.addEventListener('click', (e) => {
            if (e.target.closest('.remove-pm-row')) {
                e.target.closest('.pm-row').remove();
            }
        });
    }
    if (productListContainer) {
        productListContainer.addEventListener('click', (e) => {
            const btn = e.target.closest('button');
            if (!btn) return;
            const id = btn.dataset.id;
            if (btn.classList.contains('edit-product')) {
                loadProductForEdit(id);
            } else if (btn.classList.contains('delete-product')) {
                deleteProductDefinition(id);
            }
        });
    }
    const newProductBtn = document.getElementById('newProductBtn');
    if (newProductBtn) {
        newProductBtn.addEventListener('click', resetProductMasterForm);
    }

    updateProductMasterVisibility();

    if (exportProductionCsvBtn) {
        exportProductionCsvBtn.addEventListener('click', exportProductionCSV);
    }

    if (exportProductionPdfBtn) {
        exportProductionPdfBtn.addEventListener('click', exportProductionPDF);
    }
});

async function loadProductionHistory() {
    const user = JSON.parse(localStorage.getItem('user'));
    if (!user || !productionTable) return;
    const businessId = user.businessId || user.uid;

    const tbody = productionTable.querySelector('tbody');
    tbody.innerHTML = '<tr><td colspan="7" class="text-center">Loading...</td></tr>';

    try {
        const snapshot = await db.collection('users').doc(businessId)
            .collection('production_runs')
            .orderBy('date', 'desc')
            .limit(200)
            .get();

        tbody.innerHTML = '';
        productionData = [];

        if (snapshot.empty) {
            updateCuringStats([]);
            tbody.innerHTML = '<tr><td colspan="7" class="text-center text-muted">No production records found</td></tr>';
            return;
        }

        updateCuringStats(snapshot.docs);

        snapshot.forEach(doc => {
            const data = doc.data();
            productionData.push({ id: doc.id, ...data });
            const canDelete = user.permissions ? user.permissions.canDelete : true;
            const stage = data.status || 'Completed';
            const isPlanned = stage === 'Planned';
            const isCuring = stage === 'Curing';
            const isCompleted = stage === 'Completed';

            let statusBadge = `<span class="badge bg-success">Completed</span>`;
            let actionBtn = '';

            if (isCuring) {
                const now = new Date();
                const startDate = data.date.toDate();
                const endDate = data.curingEnds ? data.curingEnds.toDate() : new Date();
                
                const totalDuration = endDate.getTime() - startDate.getTime();
                const elapsed = now.getTime() - startDate.getTime();
                const progress = totalDuration > 0 ? elapsed / totalDuration : 1;

                let stage = 'Wet';
                let badgeClass = 'bg-info text-dark';

                if (progress >= 1) { stage = 'Ready'; badgeClass = 'bg-success'; }
                else if (progress >= 0.5) { stage = 'Semi Dry'; badgeClass = 'bg-warning text-dark'; }

                statusBadge = `<span class="badge ${badgeClass}" title="Curing Progress: ${(progress*100).toFixed(0)}%">
                    <i class="fas fa-clock me-1"></i>${stage}
                </span>`;
                
                actionBtn = `<button class="btn btn-sm btn-outline-success ms-2" onclick="window.completeCuring('${doc.id}')">Complete Curing</button>`;
            }

            if (isPlanned) {
                statusBadge = `<span class="badge bg-secondary">Planned</span>`;
            }

            if (isCompleted) {
                statusBadge = `<span class="badge bg-success">Completed</span>`;
            }

            const internalUseQty = Number(data.internalUseQty || 0);
            const producedQty = Number(data.quantityProduced || 0);
            const rejectedQty = Number(data.rejectedQuantity || data.brokenQuantity || 0);
            const goodQty = Number(data.goodQty || Math.max(0, producedQty - rejectedQty));
            const availableQty = Number(data.sellableQty || Math.max(0, goodQty - internalUseQty));

            const stageBadgeMap = {
                Planned: 'bg-secondary',
                Curing: 'bg-warning text-dark',
                Completed: 'bg-success'
            };
            const stageBadge = `<span class="badge ${stageBadgeMap[stage] || 'bg-secondary'}">${stage}</span>`;
            
            const row = `
                <tr>
                    <td>${formatDate(data.date)}</td>
                    <td class="fw-bold text-primary">${data.finishedGoodName}</td>
                    <td>
                        <span class="badge bg-success">${producedQty} Produced</span>
                        ${isCompleted ? `<div class="small text-muted mt-1">Good: ${goodQty} | Available: ${availableQty}</div>` : ''}
                    </td>
                    <td>${stageBadge}</td>
                    <td>${isCuring ? statusBadge : (isPlanned ? '-' : '<span class="text-muted">N/A</span>')}</td>
                    <td><span class="badge bg-info text-dark">${internalUseQty} Allocated</span></td>
                    <td>
                        ${actionBtn}
                        ${canDelete ? `<button class="btn btn-sm btn-outline-danger ms-1" onclick="window.deleteProductionRun('${doc.id}')"><i class="fas fa-trash"></i></button>` : ''}
                    </td>
                </tr>
            `;
            tbody.innerHTML += row;
        });
    } catch (error) {
        console.error('Error loading production history:', error);
        tbody.innerHTML = '<tr><td colspan="7" class="text-center text-danger">Error loading data</td></tr>';
    }
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

    let planned = 0;
    let inCuring = 0;
    let completed = 0;
    let readyToFinish = 0;
    let septicAllocated = 0;
    let availableQty = 0;
    const today = new Date();

    docs.forEach(doc => {
        const data = doc.data();
        const status = data.status || 'Completed';
        if (status === 'Planned') planned++;
        if (status === 'Completed') completed++;
        if (status === 'Curing') {
            inCuring++;
            const endDate = data.curingEnds ? data.curingEnds.toDate() : new Date();
            if (today >= endDate) {
                readyToFinish++;
            }
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

    setText('prodPlannedCount', planned);
    setText('prodCuringCount', inCuring);
    setText('prodCompletedCount', completed);
    setText('prodSepticAllocated', septicAllocated);
    setText('prodAvailableQty', availableQty);

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

async function openProductionModal() {
    const user = JSON.parse(localStorage.getItem('user'));
    const businessId = user.businessId || user.uid;
    
    // Load Inventory for Dropdowns
    try {
        const snapshot = await db.collection('users').doc(businessId).collection('inventory').get();
        inventoryItems = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        
    // Populate Finished Goods Dropdown
    const fgSelect = document.getElementById('finishedGoodSelect');
    fgSelect.innerHTML = '<option value="">Select Item...</option>';
    
    inventoryItems
        .filter(i => ['RCC Pipes', 'Septic Tank Products'].includes(i.category))
        .forEach(item => {
            fgSelect.innerHTML += `<option value="${item.id}">${item.name} (Current: ${item.quantity})</option>`;
        });

        // Reset Form
        document.getElementById('productionForm').reset();
        document.getElementById('brokenQuantity').value = '0';
        document.getElementById('wastageQuantity').value = '0';
        if (productionStageSelect) productionStageSelect.value = 'Curing';
        if (internalUseQtyInput) internalUseQtyInput.value = '0';
        ingredientsContainer.innerHTML = '';
        if (estimatedCostElement) estimatedCostElement.textContent = '₹0.00';
        document.getElementById('productionDate').valueAsDate = new Date();
        if (productDetailsDiv) productDetailsDiv.textContent = '';
        if (stockStatusBadge) {
            stockStatusBadge.className = 'badge bg-secondary';
            stockStatusBadge.textContent = 'Status: Pending';
        }
        addIngredientRow(); // Add one empty row by default
        loadRecipes();
        
        new bootstrap.Modal(productionModal).show();
    } catch (error) {
        console.error("Error fetching inventory", error);
        showAlert('danger', 'Failed to load inventory data');
    }
}

function addIngredientRow(preSelectedId = null, preQty = null) {
    const rowId = Date.now();
    // Filter for valid raw materials/ingredients
    const validCategories = ['Raw Materials', 'Cement', 'Sand', 'Aggregate', 'Steel', 'Fly Ash', 'Admixtures', 'Chemicals'];
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

async function saveProductionRun() {
    const user = JSON.parse(localStorage.getItem('user'));
    const businessId = user.businessId || user.uid;
    const fgId = document.getElementById('finishedGoodSelect').value;
    const produceQty = parseFloat(document.getElementById('produceQuantity').value);
    const notes = document.getElementById('productionNotes').value;
    const mouldsUsed = document.getElementById('mouldsUsed').value;
    const curingDays = parseInt(document.getElementById('curingDays').value) || 0;
    const supervisor = document.getElementById('productionSupervisor').value;
    const labourCost = parseFloat(document.getElementById('labourCost').value) || 0;
    const powerCost = parseFloat(document.getElementById('powerCost').value) || 0;
    const dateVal = document.getElementById('productionDate').value;
    const brokenQty = parseFloat(document.getElementById('brokenQuantity').value) || 0;
    const wastageQty = parseFloat(document.getElementById('wastageQuantity').value) || 0;
    const stage = productionStageSelect ? productionStageSelect.value : 'Curing';
    const internalUseQty = parseFloat(internalUseQtyInput?.value) || 0;

    if (!fgId || !produceQty || produceQty <= 0) {
        alert("Please select a finished good and valid quantity.");
        return;
    }

    if (internalUseQty < 0) {
        alert("Septic allocation quantity cannot be negative.");
        return;
    }
    if (internalUseQty > produceQty) {
        alert("Septic allocation cannot exceed produced quantity.");
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

    if (stage === 'Planned') {
        await createPlannedRun(businessId, fgId, produceQty, ingredientsUsed, mouldsUsed, supervisor, notes, dateVal, internalUseQty);
        return;
    }

    if (ingredientsUsed.length === 0) {
        window.showConfirm('No Materials', 'No raw materials selected. Record production without deducting materials?', () => {
            processProductionSave(businessId, fgId, produceQty, ingredientsUsed, mouldsUsed, curingDays, supervisor, labourCost, powerCost, notes, dateVal, brokenQty, wastageQty, stage, internalUseQty);
        });
    } else {
        processProductionSave(businessId, fgId, produceQty, ingredientsUsed, mouldsUsed, curingDays, supervisor, labourCost, powerCost, notes, dateVal, brokenQty, wastageQty, stage, internalUseQty);
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

async function processProductionSave(businessId, fgId, produceQty, ingredientsUsed, mouldsUsed, curingDays, supervisor, labourCost, powerCost, notes, dateVal, brokenQty, wastageQty, stage, internalUseQty) {
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

            // Determine Status
            const status = stage === 'Completed' ? 'Completed' : (curingDays > 0 ? 'Curing' : 'Completed');
            
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

            // Create Production Record
            const productionRef = userRef.collection('production_runs').doc();
            const batchId = 'BATCH-' + Date.now().toString().substr(-6);
            const productionDate = dateVal ? new Date(dateVal) : new Date();
            const curingEndDate = new Date(productionDate);
            curingEndDate.setDate(curingEndDate.getDate() + curingDays);

            transaction.set(productionRef, {
                batchId: batchId,
                date: productionDate,
                finishedGoodId: fgId,
                finishedGoodName: fgDoc.data().name,
                quantityProduced: produceQty,
                brokenQuantity: brokenQty,
                wastageQuantity: wastageQty,
                internalUseQty: internalUseQty,
                ingredients: ingredientsUsed,
                mouldsUsed: mouldsUsed,
                supervisor: supervisor,
                labourCost: labourCost,
                powerCost: powerCost,
                curingDays: curingDays,
                curingEnds: curingEndDate,
                notes: notes,
                status: status,
                goodQty: status === 'Completed' ? Math.max(0, produceQty - brokenQty) : null,
                sellableQty: status === 'Completed' ? Math.max(0, (produceQty - brokenQty) - internalUseQty) : null,
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

async function finishCuringProcess(runId, rejectedQty) {
    const user = JSON.parse(localStorage.getItem('user'));
    const businessId = user.businessId || user.uid;
    try {
        await db.runTransaction(async (transaction) => {
            const runRef = db.collection('users').doc(businessId).collection('production_runs').doc(runId);
            const runDoc = await transaction.get(runRef);
            
            if (!runDoc.exists) throw "Production run not found";
            const data = runDoc.data();
            
            if (data.status === 'Completed') throw "Already completed";
            
            const goodQty = data.quantityProduced - rejectedQty;
            if (goodQty < 0) throw "Rejected quantity cannot exceed produced quantity";
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
                completedAt: new Date() 
            });
        });

        showAlert('success', 'Curing completed! Stock added to inventory.');
        loadProductionHistory();
    } catch (error) {
        console.error("Curing Update Error", error);
        showAlert('danger', 'Failed to update curing status');
    }
}

// Load Recipes
async function loadRecipes() {
    const user = JSON.parse(localStorage.getItem('user'));
    if (!recipeSelect) return;
    const businessId = user.businessId || user.uid;
    
    try {
        const snapshot = await db.collection('users').doc(businessId).collection('recipes').orderBy('name').get();
        recipeSelect.innerHTML = '<option value="">Select Product Definition...</option>';
        
        snapshot.forEach(doc => {
            const recipe = doc.data();
            const option = document.createElement('option');
            option.value = doc.id;
            option.textContent = recipe.name;
            option.dataset.recipe = JSON.stringify(recipe);
            recipeSelect.appendChild(option);
        });
    } catch (error) {
        console.error("Error loading recipes", error);
    }
}

// Handle Recipe Selection
function handleRecipeChange() {
    const option = recipeSelect.selectedOptions[0];
    if (!option || !option.value) return;
    
    const recipe = JSON.parse(option.dataset.recipe);
    
    // Set Finished Good
    const fgSelect = document.getElementById('finishedGoodSelect');
    if (fgSelect.querySelector(`option[value="${recipe.finishedGoodId}"]`)) {
        fgSelect.value = recipe.finishedGoodId;
    }

    // Set Moulds
    if (recipe.mouldIds) {
        document.getElementById('mouldsUsed').value = recipe.mouldIds;
    }
    
    // Show Details
    if (productDetailsDiv) {
        if (recipe.category === 'Septic Tank Products') {
            productDetailsDiv.textContent = `Category: ${recipe.category} | Type: ${recipe.septicType || 'N/A'}`;
        } else {
            productDetailsDiv.textContent = `Category: ${recipe.category || 'RCC Pipes'} | Pipe: ${recipe.pipeType || 'N/A'} | Class: ${recipe.loadClass || 'N/A'}`;
        }
    }
    
    // Clear existing ingredients
    ingredientsContainer.innerHTML = '';
    
    // Add ingredients from recipe
    if (recipe.ingredients && recipe.ingredients.length > 0) {
        recipe.ingredients.forEach(ing => {
            addIngredientRow(ing.id, ing.quantity);
        });
    } else {
        addIngredientRow();
    }
    calculateCost();
}

// Save Current Configuration as Recipe
async function saveRecipe() {
    const user = JSON.parse(localStorage.getItem('user'));
    const businessId = user.businessId || user.uid;
    const fgId = document.getElementById('finishedGoodSelect').value;
    
    if (!fgId) {
        alert("Please select a finished good first.");
        return;
    }

    window.showPrompt('Save Recipe', "Enter a name for this recipe (e.g., 'RCC Pipe NP3 Socket & Spigot'):", '', async (name) => {
        const ingredientRows = document.querySelectorAll('.ingredient-row');
        const ingredientsList = [];
        
        ingredientRows.forEach(row => {
            const id = row.querySelector('.ingredient-select').value;
            const qty = parseFloat(row.querySelector('.ingredient-qty').value);
            if (id && qty > 0) ingredientsList.push({ id, quantity: qty });
        });

        try {
            await db.collection('users').doc(businessId).collection('recipes').add({
                name,
                finishedGoodId: fgId,
                ingredients: ingredientsList,
                createdAt: new Date()
            });
            showAlert('success', 'Recipe saved successfully!');
            loadRecipes();
        } catch (error) {
            console.error("Error saving recipe", error);
            showAlert('danger', 'Failed to save recipe');
        }
    });
}

async function deleteRecipe() {
    const recipeId = recipeSelect.value;
    if (!recipeId) return;
    
    window.showConfirm('Delete Recipe', 'Delete this recipe?', async () => {
        const user = JSON.parse(localStorage.getItem('user'));
        if (user.permissions && user.permissions.canDelete === false) {
            return showAlert('danger', 'You do not have permission to delete items.');
        }

        const businessId = user.businessId || user.uid;
        try {
            await db.collection('users').doc(businessId).collection('recipes').doc(recipeId).delete();
            showAlert('success', 'Recipe deleted');
            loadRecipes();
            ingredientsContainer.innerHTML = '';
            addIngredientRow();
        } catch(e) { console.error(e); }
    });
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

// --- Product Master Functions ---

let currentProductDefId = null;

async function openProductMaster() {
    const user = JSON.parse(localStorage.getItem('user'));
    const businessId = user.businessId || user.uid;
    
    // Load Inventory if empty
    if (inventoryItems.length === 0) {
        try {
            const snapshot = await db.collection('users').doc(businessId).collection('inventory').get();
            inventoryItems = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        } catch (e) { console.error(e); }
    }

    // Populate Finished Goods Dropdown in Master Modal
    const fgSelect = document.getElementById('pmFinishedGood');
    fgSelect.innerHTML = '<option value="">Select Finished Good...</option>';
    inventoryItems
        .filter(i => ['RCC Pipes', 'Septic Tank Products'].includes(i.category))
        .forEach(item => {
            fgSelect.innerHTML += `<option value="${item.id}">${item.name}</option>`;
        });

    resetProductMasterForm();
    loadProductDefinitions();
    new bootstrap.Modal(productMasterModal).show();
}

async function loadProductDefinitions() {
    const user = JSON.parse(localStorage.getItem('user'));
    const businessId = user.businessId || user.uid;
    
    productListContainer.innerHTML = '<div class="text-center py-3"><span class="spinner-border spinner-border-sm"></span></div>';
    
    try {
        const snapshot = await db.collection('users').doc(businessId).collection('recipes').orderBy('name').get();
        productListContainer.innerHTML = '';
        
        if (snapshot.empty) {
            productListContainer.innerHTML = '<div class="text-muted text-center small p-3">No products defined.</div>';
            return;
        }
        
        snapshot.forEach(doc => {
            const p = doc.data();
            const div = document.createElement('div');
            div.className = 'list-group-item list-group-item-action d-flex justify-content-between align-items-center';
            const meta = p.category === 'Septic Tank Products'
                ? `${p.septicType || 'Septic Product'}`
                : `${p.pipeType || 'Pipe'} | ${p.loadClass || 'NP2'}`;
            div.innerHTML = `
                <div>
                    <div class="fw-bold">${p.name}</div>
                    <small class="text-muted">${p.category || 'Product'} | ${meta} | ${p.mouldIds || 'No Moulds'}</small>
                </div>
                <div class="btn-group btn-group-sm">
                    <button class="btn btn-outline-primary edit-product" data-id="${doc.id}"><i class="fas fa-edit"></i></button>
                    <button class="btn btn-outline-danger delete-product" data-id="${doc.id}"><i class="fas fa-trash"></i></button>
                </div>
            `;
            productListContainer.appendChild(div);
        });
    } catch (e) {
        console.error(e);
        productListContainer.innerHTML = '<div class="text-danger text-center small">Error loading list.</div>';
    }
}

function resetProductMasterForm() {
    currentProductDefId = null;
    document.getElementById('pmName').value = '';
    document.getElementById('pmCategory').value = 'RCC Pipes';
    document.getElementById('pmPipeType').value = 'Plain End';
    document.getElementById('pmLoadClass').value = 'NP2';
    document.getElementById('pmSepticType').value = 'Septic Tank Rings';
    document.getElementById('pmMouldIds').value = '';
    document.getElementById('pmFinishedGood').value = '';
    pmIngredientsContainer.innerHTML = '';
    addPmIngredientRow();
    document.getElementById('pmModalTitle').textContent = 'New Product Definition';
    updateProductMasterVisibility();
}

function addPmIngredientRow(id = null, qty = null) {
    // Filter raw materials
    const validCategories = ['Raw Materials', 'Cement', 'Sand', 'Aggregate', 'Steel', 'Fly Ash', 'Admixtures', 'Chemicals'];
    const rawMaterials = inventoryItems.filter(i => validCategories.includes(i.category));
    rawMaterials.sort((a, b) => a.name.localeCompare(b.name));
    
    const options = rawMaterials.map(item => 
        `<option value="${item.id}">${item.name} (${item.unit})</option>`
    ).join('');

    const html = `
        <div class="row g-2 mb-2 align-items-center pm-row">
            <div class="col-7">
                <select class="form-select form-select-sm pm-ing-select" required>
                    <option value="">Select Material...</option>
                    ${options}
                </select>
            </div>
            <div class="col-3">
                <input type="number" class="form-control form-control-sm pm-ing-qty" placeholder="Qty" step="0.01" required value="${qty || ''}">
            </div>
            <div class="col-2">
                <button type="button" class="btn btn-outline-danger btn-sm w-100 remove-pm-row"><i class="fas fa-times"></i></button>
            </div>
        </div>
    `;
    pmIngredientsContainer.insertAdjacentHTML('beforeend', html);
    
    if (id) {
        const rows = pmIngredientsContainer.querySelectorAll('.pm-row');
        const lastRow = rows[rows.length - 1];
        lastRow.querySelector('.pm-ing-select').value = id;
    }
}

async function saveProductDefinition() {
    const user = JSON.parse(localStorage.getItem('user'));
    const businessId = user.businessId || user.uid;
    
    const name = document.getElementById('pmName').value;
    const category = document.getElementById('pmCategory').value;
    const pipeType = document.getElementById('pmPipeType').value;
    const loadClass = document.getElementById('pmLoadClass').value;
    const septicType = document.getElementById('pmSepticType').value;
    const mouldIds = document.getElementById('pmMouldIds').value;
    const finishedGoodId = document.getElementById('pmFinishedGood').value;
    
    if (!name) return alert("Product Name is required");
    
    // Gather ingredients
    const ingredients = [];
    document.querySelectorAll('.pm-row').forEach(row => {
        const id = row.querySelector('.pm-ing-select').value;
        const qty = parseFloat(row.querySelector('.pm-ing-qty').value);
        if (id && qty > 0) {
            ingredients.push({ id, quantity: qty });
        }
    });
    
    const data = {
        name,
        category,
        pipeType,
        loadClass,
        septicType,
        mouldIds,
        finishedGoodId,
        ingredients,
        updatedAt: new Date()
    };
    
    try {
        if (currentProductDefId) {
            await db.collection('users').doc(businessId).collection('recipes').doc(currentProductDefId).update(data);
        } else {
            data.createdAt = new Date();
            await db.collection('users').doc(businessId).collection('recipes').add(data);
        }
        
        // Sync details to Inventory Item (Truth Layer)
        if (finishedGoodId) {
             await db.collection('users').doc(businessId).collection('inventory').doc(finishedGoodId).set({
                 category: category,
                 pipeType: pipeType,
                 loadClass: loadClass,
                 septicType: septicType
             }, { merge: true });
        }
        
        showAlert('success', 'Product definition saved');
        resetProductMasterForm();
        loadProductDefinitions();
        loadRecipes(); // Refresh the dropdown in main production screen
    } catch (e) {
        console.error(e);
        showAlert('danger', 'Failed to save');
    }
}

async function loadProductForEdit(id) {
    const user = JSON.parse(localStorage.getItem('user'));
    const businessId = user.businessId || user.uid;
    
    try {
        const doc = await db.collection('users').doc(businessId).collection('recipes').doc(id).get();
        if (!doc.exists) return;
        
        const data = doc.data();
        currentProductDefId = id;
        document.getElementById('pmModalTitle').textContent = 'Edit Product Definition';
        
        document.getElementById('pmName').value = data.name;
        document.getElementById('pmCategory').value = data.category || 'RCC Pipes';
        document.getElementById('pmPipeType').value = data.pipeType || 'Plain End';
        document.getElementById('pmLoadClass').value = data.loadClass || 'NP2';
        document.getElementById('pmSepticType').value = data.septicType || 'Septic Tank Rings';
        document.getElementById('pmMouldIds').value = data.mouldIds || '';
        document.getElementById('pmFinishedGood').value = data.finishedGoodId || '';
        updateProductMasterVisibility();
        
        pmIngredientsContainer.innerHTML = '';
        if (data.ingredients && data.ingredients.length > 0) {
            data.ingredients.forEach(ing => addPmIngredientRow(ing.id, ing.quantity));
        } else {
            addPmIngredientRow();
        }
    } catch (e) { console.error(e); }
}

async function deleteProductDefinition(id) {
    if (!confirm("Delete this product definition?")) return;
    const user = JSON.parse(localStorage.getItem('user'));
    const businessId = user.businessId || user.uid;
    try {
        await db.collection('users').doc(businessId).collection('recipes').doc(id).delete();
        loadProductDefinitions();
        loadRecipes();
    } catch (e) { console.error(e); }
}

function updateProductMasterVisibility() {
    if (!pmCategorySelect) return;
    const category = pmCategorySelect.value;
    const pipeFields = [pmPipeTypeSelect, pmLoadClassSelect];
    const septicFields = [pmSepticTypeSelect];

    pipeFields.forEach(field => {
        if (!field) return;
        const col = field.closest('.col-md-4, .col-md-6, .col-12');
        if (col) col.style.display = category === 'RCC Pipes' ? '' : 'none';
    });

    septicFields.forEach(field => {
        if (!field) return;
        const col = field.closest('.col-md-4, .col-md-6, .col-12');
        if (col) col.style.display = category === 'Septic Tank Products' ? '' : 'none';
    });
}
