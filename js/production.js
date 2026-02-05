import { db } from './firebase-config.js';
import { checkAuth, formatDate } from './dashboard.js';
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

// Product Master Elements
const manageProductsBtn = document.getElementById('manageProductsBtn');
const productMasterModal = document.getElementById('productMasterModal');
const saveProductMasterBtn = document.getElementById('saveProductMasterBtn');
const pmIngredientBtn = document.getElementById('pmIngredientBtn');
const pmIngredientsContainer = document.getElementById('pmIngredientsContainer');
const productListContainer = document.getElementById('productListContainer');

// State
let inventoryItems = [];

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
});

async function loadProductionHistory() {
    const user = JSON.parse(localStorage.getItem('user'));
    if (!user || !productionTable) return;
    const businessId = user.businessId || user.uid;

    const tbody = productionTable.querySelector('tbody');
    tbody.innerHTML = '<tr><td colspan="5" class="text-center">Loading...</td></tr>';

    try {
        const snapshot = await db.collection('users').doc(businessId)
            .collection('production_runs')
            .orderBy('date', 'desc')
            .limit(20)
            .get();

        tbody.innerHTML = '';

        if (snapshot.empty) {
            tbody.innerHTML = '<tr><td colspan="5" class="text-center text-muted">No production records found</td></tr>';
            return;
        }

        updateCuringStats(snapshot.docs);

        snapshot.forEach(doc => {
            const data = doc.data();
            const materialsList = data.ingredients.map(i => `${i.name} (${i.quantity} ${i.unit || ''})`).join(', ');
            const canDelete = user.permissions ? user.permissions.canDelete : true;
            
            let statusBadge = `<span class="badge bg-success">Completed</span>`;
            let actionBtn = '';

            if (data.status === 'Curing') {
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
            
            const row = `
                <tr>
                    <td>${formatDate(data.date)}</td>
                    <td class="fw-bold text-primary">${data.finishedGoodName}</td>
                    <td><span class="badge bg-success">${data.quantityProduced} Produced</span></td>
                    <td><small class="text-muted">${materialsList}</small></td>
                    <td>${data.mouldsUsed || '-'}</td>
                    <td>${statusBadge} ${actionBtn}
                        ${canDelete ? `<button class="btn btn-sm btn-outline-danger ms-1" onclick="window.deleteProductionRun('${doc.id}')"><i class="fas fa-trash"></i></button>` : ''}
                    </td>
                </tr>
            `;
            tbody.innerHTML += row;
        });
    } catch (error) {
        console.error('Error loading production history:', error);
        tbody.innerHTML = '<tr><td colspan="5" class="text-center text-danger">Error loading data</td></tr>';
    }
}

function updateCuringStats(docs) {
    const container = document.getElementById('curingStatsContainer');
    if (!container) return;

    let inCuring = 0;
    let readyToFinish = 0;
    const today = new Date();

    docs.forEach(doc => {
        const data = doc.data();
        if (data.status === 'Curing') {
            inCuring++;
            const endDate = data.curingEnds ? data.curingEnds.toDate() : new Date();
            if (today >= endDate) {
                readyToFinish++;
            }
        }
    });

    if (inCuring === 0) {
        container.innerHTML = '';
        return;
    }

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
            .filter(i => ['Finished Goods', 'PVC Pipes', 'Fittings'].includes(i.category))
            .forEach(item => {
                fgSelect.innerHTML += `<option value="${item.id}">${item.name} (Current: ${item.quantity})</option>`;
            });

        // Reset Form
        document.getElementById('productionForm').reset();
        document.getElementById('brokenQuantity').value = '0';
        document.getElementById('wastageQuantity').value = '0';
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
    const validCategories = ['Raw Materials', 'Cement', 'Sand', 'Aggregate', 'Steel', 'Additives', 'PVC Pipes', 'Fittings'];
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

    if (!fgId || !produceQty || produceQty <= 0) {
        alert("Please select a finished good and valid quantity.");
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

    if (ingredientsUsed.length === 0) {
        window.showConfirm('No Materials', 'No raw materials selected. Record production without deducting materials?', () => {
            processProductionSave(businessId, fgId, produceQty, ingredientsUsed, mouldsUsed, curingDays, supervisor, labourCost, powerCost, notes, dateVal, brokenQty, wastageQty);
        });
    } else {
        processProductionSave(businessId, fgId, produceQty, ingredientsUsed, mouldsUsed, curingDays, supervisor, labourCost, powerCost, notes, dateVal, brokenQty, wastageQty);
    }
}

async function processProductionSave(businessId, fgId, produceQty, ingredientsUsed, mouldsUsed, curingDays, supervisor, labourCost, powerCost, notes, dateVal, brokenQty, wastageQty) {
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
            const status = curingDays > 0 ? 'Curing' : 'Completed';
            
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

            if (curingDays === 0) {
                // Add Net Good Quantity (Produced - Broken)
                fgUpdateData.quantity = currentFgQty + Math.max(0, produceQty - brokenQty);
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
                ingredients: ingredientsUsed,
                mouldsUsed: mouldsUsed,
                supervisor: supervisor,
                labourCost: labourCost,
                powerCost: powerCost,
                curingDays: curingDays,
                curingEnds: curingEndDate,
                notes: notes,
                status: status,
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

            // Update Inventory
            const fgRef = db.collection('users').doc(businessId).collection('inventory').doc(data.finishedGoodId);
            const fgDoc = await transaction.get(fgRef);
            
            if (fgDoc.exists) {
                const currentQty = fgDoc.data().quantity || 0;
                transaction.update(fgRef, { quantity: currentQty + goodQty });
            }

            // Update Run Status
            transaction.update(runRef, { 
                status: 'Completed', 
                rejectedQuantity: rejectedQty,
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
            const details = recipe.dimensions ? ` (${recipe.dimensions})` : '';
            option.textContent = `${recipe.name}${details}`;
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
    if (productDetailsDiv) productDetailsDiv.textContent = `Size: ${recipe.dimensions || 'N/A'} | Type: ${recipe.type || 'N/A'}`;
    
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

    window.showPrompt('Save Recipe', "Enter a name for this recipe (e.g., 'Standard 1000L Tank'):", '', async (name) => {
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
        .filter(i => ['Finished Goods', 'PVC Pipes', 'Fittings'].includes(i.category))
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
            div.innerHTML = `
                <div>
                    <div class="fw-bold">${p.name}</div>
                    <small class="text-muted">${p.type || 'Product'} | ${p.mouldIds || 'No Moulds'}</small>
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
    document.getElementById('pmType').value = 'Septic Tank';
    document.getElementById('pmDimensions').value = '';
    document.getElementById('pmMouldIds').value = '';
    document.getElementById('pmFinishedGood').value = '';
    pmIngredientsContainer.innerHTML = '';
    addPmIngredientRow();
    document.getElementById('pmModalTitle').textContent = 'New Product Definition';
}

function addPmIngredientRow(id = null, qty = null) {
    // Filter raw materials
    const validCategories = ['Raw Materials', 'Cement', 'Sand', 'Aggregate', 'Steel', 'Additives', 'PVC Pipes', 'Fittings'];
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
    const type = document.getElementById('pmType').value;
    const dimensions = document.getElementById('pmDimensions').value;
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
        name, type, dimensions, mouldIds, finishedGoodId, ingredients,
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
                 type: type,
                 dimensions: dimensions
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
        document.getElementById('pmType').value = data.type || 'Septic Tank';
        document.getElementById('pmDimensions').value = data.dimensions || '';
        document.getElementById('pmMouldIds').value = data.mouldIds || '';
        document.getElementById('pmFinishedGood').value = data.finishedGoodId || '';
        
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
