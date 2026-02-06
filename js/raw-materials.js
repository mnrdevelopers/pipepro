import { db } from './firebase-config.js';
import { checkAuth, formatDate, downloadCSV, downloadPDF } from './dashboard.js';

// DOM Elements
const rawMaterialTable = document.getElementById('rawMaterialTable');
const addRawMaterialBtn = document.getElementById('addRawMaterialBtn');
const rawMaterialModal = document.getElementById('rawMaterialModal');
const rawMaterialForm = document.getElementById('rawMaterialForm');
const saveRawMaterialBtn = document.getElementById('saveRawMaterialBtn');
const searchRawInput = document.getElementById('searchRawMaterials');
const exportRawMaterialsPdfBtn = document.getElementById('exportRawMaterialsPdfBtn');
const exportRawMaterialsCsvBtn = document.getElementById('exportRawMaterialsCsvBtn');

// Variables
let currentItemId = null;
let rawMaterialData = [];

const RAW_CATEGORIES = ['Raw Materials', 'Cement', 'Sand', 'Aggregate', 'Steel', 'Fly Ash', 'Admixtures', 'Chemicals'];

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

    if (exportRawMaterialsCsvBtn) {
        exportRawMaterialsCsvBtn.addEventListener('click', exportRawMaterialsCSV);
    }

    if (exportRawMaterialsPdfBtn) {
        exportRawMaterialsPdfBtn.addEventListener('click', exportRawMaterialsPDF);
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
            if (window.openStockInModal) {
                window.openStockInModal(item);
            } else {
                alert('Stock-in module not ready. Please refresh.');
            }
        }
    });
}

function getRawMaterialsExportRows() {
    return rawMaterialData.map(item => ([
        item.name || '',
        item.category || '',
        item.supplier || '',
        item.quantity ?? 0,
        item.unit || '',
        item.reorderLevel ?? 0,
        item.costPrice ?? 0
    ]));
}

function exportRawMaterialsCSV() {
    if (!rawMaterialData.length) {
        alert('No raw materials to export.');
        return;
    }

    const headers = ['Material Name', 'Category', 'Supplier', 'Quantity', 'Unit', 'Reorder Level', 'Cost'];
    const rows = getRawMaterialsExportRows();
    const filename = `raw_materials_${new Date().toISOString().split('T')[0]}.csv`;
    downloadCSV(filename, headers, rows);
}

function exportRawMaterialsPDF() {
    if (!rawMaterialData.length) {
        alert('No raw materials to export.');
        return;
    }

    const headers = ['Material Name', 'Category', 'Supplier', 'Quantity', 'Unit', 'Reorder Level', 'Cost'];
    const rows = getRawMaterialsExportRows();
    const filename = `raw_materials_${new Date().toISOString().split('T')[0]}.pdf`;
    downloadPDF(filename, 'Raw Materials Report', headers, rows);
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
    const existingItem = currentItemId ? rawMaterialData.find(i => i.id === currentItemId) : null;
    
    const data = {
        name: document.getElementById('rmName').value,
        category: document.getElementById('rmCategory').value,
        quantity: existingItem ? (existingItem.quantity || 0) : 0,
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
            const existingByName = rawMaterialData.find(i => i.name.toLowerCase() === data.name.toLowerCase());
            if (existingByName) {
                await db.collection('users').doc(businessId).collection('inventory').doc(existingByName.id).update({
                    category: data.category,
                    unit: data.unit,
                    reorderLevel: data.reorderLevel,
                    costPrice: data.costPrice,
                    supplier: data.supplier,
                    updatedAt: new Date()
                });
            } else {
                // Create new item definition with zero quantity
                data.createdAt = new Date();
                await db.collection('users').doc(businessId).collection('inventory').add(data);
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

window.loadRawMaterials = loadRawMaterials;
