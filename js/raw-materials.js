import { db } from './firebase-config.js';
import { checkAuth, formatDate } from './dashboard.js';

// DOM Elements
const rawMaterialTable = document.getElementById('rawMaterialTable');
const addRawMaterialBtn = document.getElementById('addRawMaterialBtn');
const rawMaterialModal = document.getElementById('rawMaterialModal');
const rawMaterialForm = document.getElementById('rawMaterialForm');
const saveRawMaterialBtn = document.getElementById('saveRawMaterialBtn');
const searchRawInput = document.getElementById('searchRawMaterials');

// Variables
let currentItemId = null;
let rawMaterialData = [];

const RAW_CATEGORIES = ['Raw Materials', 'Cement', 'Sand', 'Aggregate', 'Steel', 'Additives', 'Chemicals'];

// Initialize Raw Materials Page
document.addEventListener('DOMContentLoaded', async () => {
    await checkAuth();
    // We load data when the section is active to save resources, or if it's the landing page
    if (window.location.hash === '#raw-materials') loadRawMaterials();

    setupEventListeners();
    
    window.addEventListener('sectionChanged', (e) => {
        if (e.detail === 'raw-materials') loadRawMaterials();
    });
});

// Load Raw Materials Data
async function loadRawMaterials() {
    const user = JSON.parse(localStorage.getItem('user'));
    if (!user || !rawMaterialTable) return;
    const businessId = user.businessId || user.uid;
    
    try {
        if ($.fn.DataTable.isDataTable(rawMaterialTable)) {
            $(rawMaterialTable).DataTable().destroy();
        }

        const snapshot = await db.collection('users').doc(businessId)
            .collection('inventory')
            .orderBy('name')
            .get();
        
        rawMaterialData = [];
        const tbody = rawMaterialTable.querySelector('tbody');
        tbody.innerHTML = '';
        
        let rowsHtml = '';
        snapshot.forEach(doc => {
            const item = { id: doc.id, ...doc.data() };
            
            // Filter for Raw Materials only
            if (RAW_CATEGORIES.includes(item.category)) {
                rawMaterialData.push(item);
                rowsHtml += createRawMaterialRow(item);
            }
        });
        
        if (rawMaterialData.length === 0) {
            tbody.innerHTML = `<tr><td colspan="7" class="text-center py-4 text-muted">No raw materials found. Add your first item.</td></tr>`;
            return;
        }
        
        tbody.innerHTML = rowsHtml;
        
        // Update stats
        updateStats();

        // Re-initialize DataTable
        $(rawMaterialTable).DataTable({
            pageLength: 10,
            responsive: true,
            order: [[0, 'asc']],
            language: { search: "_INPUT_", searchPlaceholder: "Search materials..." }
        });
        
    } catch (error) {
        console.error('Error loading raw materials:', error);
    }
}

function createRawMaterialRow(item) {
    const lowStock = item.quantity <= item.reorderLevel;
    const stockClass = lowStock ? 'text-danger fw-bold' : 'text-success';
    const user = JSON.parse(localStorage.getItem('user'));
    const canDelete = user.permissions ? user.permissions.canDelete : true;

    return `
        <tr data-id="${item.id}">
            <td>
                <div class="d-flex align-items-center">
                    <div class="me-3 text-secondary"><i class="fas fa-layer-group"></i></div>
                    <div>
                        <h6 class="mb-0">${item.name}</h6>
                        <small class="text-muted">${item.sku || ''}</small>
                    </div>
                </div>
            </td>
            <td>${item.category}</td>
            <td>${item.supplier || '-'}</td>
            <td class="${stockClass}">${item.quantity} ${item.unit}</td>
            <td>${item.reorderLevel} ${item.unit}</td>
            <td>₹${parseFloat(item.costPrice || 0).toFixed(2)}</td>
            <td>
                <div class="btn-group btn-group-sm">
                    <button class="btn btn-outline-primary edit-rm-item" title="Edit"><i class="fas fa-edit"></i></button>
                    <button class="btn btn-outline-info view-history-rm" title="History"><i class="fas fa-history"></i></button>
                    <button class="btn btn-outline-success stock-in-rm" title="Stock In"><i class="fas fa-arrow-down"></i></button>
                    ${canDelete ? `<button class="btn btn-outline-danger delete-rm-item" title="Delete"><i class="fas fa-trash"></i></button>` : ''}
                </div>
            </td>
        </tr>
    `;
}

function updateStats() {
    const totalItems = rawMaterialData.length;
    const lowStock = rawMaterialData.filter(i => i.quantity <= i.reorderLevel).length;
    const value = rawMaterialData.reduce((sum, i) => sum + (i.quantity * (i.costPrice || 0)), 0);
    
    document.getElementById('rm_totalItems').textContent = totalItems;
    document.getElementById('rm_lowStock').textContent = lowStock;
    document.getElementById('rm_totalValue').textContent = `₹${value.toLocaleString(undefined, {minimumFractionDigits: 2})}`;
}

function setupEventListeners() {
    if (addRawMaterialBtn) {
        addRawMaterialBtn.addEventListener('click', showAddModal);
    }
    
    if (saveRawMaterialBtn) {
        saveRawMaterialBtn.addEventListener('click', saveRawMaterial);
    }

    // Event Delegation for table actions
    document.addEventListener('click', (e) => {
        const row = e.target.closest('tr[data-id]');
        if (!row) return;
        
        const itemId = row.dataset.id;
        const item = rawMaterialData.find(i => i.id === itemId);
        if (!item) return; // Not a raw material row
        
        if (e.target.closest('.edit-rm-item')) {
            showEditModal(item);
        } else if (e.target.closest('.view-history-rm')) {
            viewHistory(item);
        } else if (e.target.closest('.delete-rm-item')) {
            deleteRawMaterial(itemId);
        } else if (e.target.closest('.stock-in-rm')) {
            // We can reuse the stock modal from inventory.js if accessible, 
            // or trigger a click on a hidden button that inventory.js listens to, 
            // OR just implement simple stock in here.
            // For simplicity and integration, we'll use the global stock modal logic if possible,
            // but since inventory.js logic is scoped, we'll implement a simple stock update here or 
            // rely on the fact that inventory.js might pick up the click if we used the same class names.
            // However, we used different class names to avoid conflicts.
            // Let's implement a direct stock update for RM.
            window.showPrompt('Stock In', `Enter quantity to add for ${item.name}:`, '', async (qty) => {
                if(qty && !isNaN(qty)) {
                    await updateStock(itemId, parseFloat(qty));
                }
            });
        }
    });
}

async function populateSupplierDropdown(elementId, selectedValue = null) {
    const select = document.getElementById(elementId);
    if (!select) return;
    
    const user = JSON.parse(localStorage.getItem('user'));
    const businessId = user.businessId || user.uid;
    
    try {
        const snapshot = await db.collection('users').doc(businessId).collection('suppliers').orderBy('name').get();
        select.innerHTML = '<option value="">Select Supplier...</option>';
        
        snapshot.forEach(doc => {
            const s = doc.data();
            const option = document.createElement('option');
            option.value = s.name;
            option.textContent = s.name;
            if (selectedValue && s.name === selectedValue) {
                option.selected = true;
            }
            select.appendChild(option);
        });
    } catch (error) {
        console.error("Error loading suppliers", error);
    }
}

async function showAddModal() {
    currentItemId = null;
    rawMaterialForm.reset();
    document.getElementById('rmModalTitle').textContent = 'Add Raw Material';
    await populateSupplierDropdown('rmSupplier');
    new bootstrap.Modal(rawMaterialModal).show();
}

async function showEditModal(item) {
    currentItemId = item.id;
    document.getElementById('rmModalTitle').textContent = 'Edit Raw Material';
    
    document.getElementById('rmName').value = item.name;
    document.getElementById('rmCategory').value = item.category;
    document.getElementById('rmQuantity').value = item.quantity;
    document.getElementById('rmUnit').value = item.unit;
    document.getElementById('rmReorder').value = item.reorderLevel;
    document.getElementById('rmCost').value = item.costPrice || '';
    
    await populateSupplierDropdown('rmSupplier', item.supplier);
    
    new bootstrap.Modal(rawMaterialModal).show();
}

async function saveRawMaterial() {
    const user = JSON.parse(localStorage.getItem('user'));
    const businessId = user.businessId || user.uid;
    
    const data = {
        name: document.getElementById('rmName').value,
        category: document.getElementById('rmCategory').value,
        quantity: parseFloat(document.getElementById('rmQuantity').value) || 0,
        unit: document.getElementById('rmUnit').value,
        reorderLevel: parseFloat(document.getElementById('rmReorder').value) || 0,
        costPrice: parseFloat(document.getElementById('rmCost').value) || 0,
        supplier: document.getElementById('rmSupplier').value,
        updatedAt: new Date()
    };
    
    if (!data.name) return alert("Name is required");

    try {
        if (currentItemId) {
            await db.collection('users').doc(businessId).collection('inventory').doc(currentItemId).update(data);
        } else {
            // Check if item exists (Case insensitive)
            const existingItem = rawMaterialData.find(i => i.name.toLowerCase() === data.name.toLowerCase());
            
            if (existingItem) {
                // Update existing item
                const newQty = (existingItem.quantity || 0) + data.quantity;
                await db.collection('users').doc(businessId).collection('inventory').doc(existingItem.id).update({
                    quantity: newQty,
                    costPrice: data.costPrice, // Update to latest cost
                    supplier: data.supplier,
                    updatedAt: new Date()
                });
                await recordSupplyHistory(businessId, existingItem.id, data.name, data.quantity, data.supplier, data.costPrice);
                alert(`Added ${data.quantity} ${data.unit} to existing ${data.name}`);
            } else {
                // Create new item
                data.createdAt = new Date();
                const docRef = await db.collection('users').doc(businessId).collection('inventory').add(data);
                await recordSupplyHistory(businessId, docRef.id, data.name, data.quantity, data.supplier, data.costPrice);
            }
        }
        
        bootstrap.Modal.getInstance(rawMaterialModal).hide();
        loadRawMaterials();
        // Also refresh main inventory if needed, but they are separate sections now
    } catch (error) {
        console.error("Error saving raw material", error);
        alert("Failed to save");
    }
}

async function recordSupplyHistory(businessId, itemId, itemName, quantity, supplier, cost) {
    if (quantity <= 0) return;
    try {
        await db.collection('users').doc(businessId).collection('purchases').add({
            itemId,
            itemName,
            quantity,
            supplier,
            unitCost: cost,
            date: new Date(),
            type: 'Raw Material Supply'
        });
    } catch (e) { console.error("Error recording history", e); }
}

async function viewHistory(item) {
    const user = JSON.parse(localStorage.getItem('user'));
    const businessId = user.businessId || user.uid;
    const tbody = document.querySelector('#itemHistoryTable tbody');
    document.getElementById('historyItemName').textContent = item.name;
    tbody.innerHTML = '<tr><td colspan="4" class="text-center">Loading history...</td></tr>';
    
    new bootstrap.Modal(document.getElementById('itemHistoryModal')).show();

    try {
        const snapshot = await db.collection('users').doc(businessId).collection('purchases')
            .where('itemId', '==', item.id)
            .orderBy('date', 'desc')
            .limit(20)
            .get();
            
        tbody.innerHTML = '';
        if (snapshot.empty) {
            tbody.innerHTML = '<tr><td colspan="4" class="text-center text-muted">No supply history found</td></tr>';
            return;
        }

        snapshot.forEach(doc => {
            const d = doc.data();
            const dateObj = d.date.toDate ? d.date.toDate() : new Date(d.date);
            const dateTimeStr = dateObj.toLocaleString('en-US', { 
                month: 'short', day: 'numeric', year: 'numeric', 
                hour: '2-digit', minute: '2-digit' 
            });
            
            tbody.innerHTML += `
                <tr>
                    <td>${dateTimeStr}</td>
                    <td><span class="badge bg-success">Supply In</span></td>
                    <td class="fw-bold">+${d.quantity}</td>
                    <td><small>Supplier: ${d.supplier || 'N/A'}</small></td>
                </tr>
            `;
        });
    } catch (e) {
        console.error(e);
        tbody.innerHTML = '<tr><td colspan="4" class="text-center text-danger">Error loading history</td></tr>';
    }
}

async function deleteRawMaterial(id) {
    if (!confirm("Delete this raw material?")) return;
    const user = JSON.parse(localStorage.getItem('user'));
    const businessId = user.businessId || user.uid;
    
    try {
        await db.collection('users').doc(businessId).collection('inventory').doc(id).delete();
        loadRawMaterials();
    } catch (e) { console.error(e); }
}

async function updateStock(id, qtyToAdd) {
    const user = JSON.parse(localStorage.getItem('user'));
    const businessId = user.businessId || user.uid;
    try {
        const ref = db.collection('users').doc(businessId).collection('inventory').doc(id);
        await db.runTransaction(async (t) => {
            const doc = await t.get(ref);
            const newQty = (doc.data().quantity || 0) + qtyToAdd;
            t.update(ref, { quantity: newQty });
        });
        loadRawMaterials();
    } catch(e) { console.error(e); alert("Failed to update stock"); }
}