import { db } from './firebase-config.js';
import { checkAuth, formatDate } from './dashboard.js';
import { showAlert } from './auth.js';

const suppliersContainer = document.getElementById('suppliersContainer');
const addSupplierBtn = document.getElementById('addSupplierBtn');
const supplierModal = document.getElementById('supplierModal');
const supplierForm = document.getElementById('supplierForm');
const saveSupplierBtn = document.getElementById('saveSupplierBtn');
const searchSuppliers = document.getElementById('searchSuppliers');
const filterSupplierType = document.getElementById('filterSupplierType');
const supplierPaymentModal = document.getElementById('supplierPaymentModal');
const saveSupplierPaymentBtn = document.getElementById('saveSupplierPaymentBtn');
const supplierLedgerModal = document.getElementById('supplierLedgerModal');
const filterSupplierLedgerBtn = document.getElementById('filterSupplierLedgerBtn');

let currentSupplierId = null;
let suppliersCache = [];

const SUPPLIER_TYPES = [
    'Cement', 'Dust/Sand', 'Aggregate', 'Steel', 'PVC/Fittings', 
    'Molds/Equipment', 'Logistics', 'General'
];

document.addEventListener('DOMContentLoaded', async () => {
    await checkAuth();
    populateTypeFilter();
    loadSuppliers();

    window.addEventListener('sectionChanged', (e) => {
        if (e.detail === 'suppliers') loadSuppliers();
    });

    if (addSupplierBtn) {
        addSupplierBtn.addEventListener('click', () => {
            currentSupplierId = null;
            supplierForm.reset();
            document.querySelector('#supplierModal .modal-title').textContent = 'Add Supplier';
            new bootstrap.Modal(supplierModal).show();
        });
    }

    if (saveSupplierBtn) {
        saveSupplierBtn.addEventListener('click', saveSupplier);
    }

    if (searchSuppliers) {
        searchSuppliers.addEventListener('input', renderSupplierCards);
    }

    if (filterSupplierType) {
        filterSupplierType.addEventListener('change', renderSupplierCards);
    }

    if (saveSupplierPaymentBtn) {
        saveSupplierPaymentBtn.addEventListener('click', saveSupplierPayment);
    }

    if (filterSupplierLedgerBtn) {
        filterSupplierLedgerBtn.addEventListener('click', loadSupplierLedgerData);
    }
});

function populateTypeFilter() {
    if (!filterSupplierType) return;
    filterSupplierType.innerHTML = '<option value="all">All Types</option>';
    SUPPLIER_TYPES.forEach(type => {
        filterSupplierType.innerHTML += `<option value="${type}">${type}</option>`;
    });
}

async function loadSuppliers() {
    const user = JSON.parse(localStorage.getItem('user'));
    if (!user || !suppliersContainer) return;
    const businessId = user.businessId || user.uid;

    suppliersContainer.innerHTML = '<div class="col-12 text-center p-5"><span class="spinner-border"></span></div>';

    try {
        const snapshot = await db.collection('users').doc(businessId).collection('suppliers').orderBy('name').get();
        
        suppliersCache = [];
        snapshot.forEach(doc => {
            suppliersCache.push({ id: doc.id, ...doc.data() });
        });

        renderSupplierCards();

    } catch (error) {
        console.error("Error loading suppliers", error);
        suppliersContainer.innerHTML = '<div class="col-12 text-center text-danger p-5">Error loading data</div>';
    }
}

function renderSupplierCards() {
    suppliersContainer.innerHTML = '';

    const searchTerm = searchSuppliers ? searchSuppliers.value.toLowerCase() : '';
    const filterType = filterSupplierType ? filterSupplierType.value : 'all';

    const filtered = suppliersCache.filter(s => {
        const matchesSearch = (s.name || '').toLowerCase().includes(searchTerm) || 
                              (s.contactPerson || '').toLowerCase().includes(searchTerm) ||
                              (s.phone || '').includes(searchTerm);
        const matchesType = filterType === 'all' || s.type === filterType;
        return matchesSearch && matchesType;
    });

    if (filtered.length === 0) {
        suppliersContainer.innerHTML = '<div class="col-12 text-center text-muted p-5"><h5>No suppliers found</h5></div>';
        return;
    }

    const user = JSON.parse(localStorage.getItem('user'));
    const canDelete = user.permissions ? user.permissions.canDelete : true;

    filtered.forEach(s => {
        const typeBadge = getTypeBadge(s.type);
        const escape = (str) => (str || '').replace(/'/g, "\\'");
        
        const totalPurchase = s.totalPurchase || 0;
        const balance = s.balance || 0;
        const balanceClass = balance > 0 ? 'text-danger' : 'text-success';
        
        const cardHtml = `
        <div class="col-xl-4 col-md-6 mb-4">
            <div class="card h-100 shadow-sm border-start-primary">
                <div class="card-body d-flex flex-column">
                    <div class="d-flex justify-content-between">
                        <div>
                            <h5 class="card-title fw-bold text-primary mb-1">${s.name}</h5>
                            ${typeBadge}
                        </div>
                        <div class="dropdown">
                            <button class="btn btn-link text-secondary p-0" type="button" data-bs-toggle="dropdown"><i class="fas fa-ellipsis-v"></i></button>
                            <ul class="dropdown-menu dropdown-menu-end">
                                <li><a class="dropdown-item" href="#" onclick="window.editSupplier('${s.id}')"><i class="fas fa-edit fa-fw me-2"></i>Edit</a></li>
                                <li><a class="dropdown-item" href="#" onclick="window.recordSupplierPayment('${s.id}', '${escape(s.name)}')"><i class="fas fa-money-bill-wave fa-fw me-2"></i>Record Payment</a></li>
                                <li><a class="dropdown-item" href="#" onclick="window.viewSupplierLedger('${s.id}', '${escape(s.name)}')"><i class="fas fa-book fa-fw me-2"></i>View Ledger</a></li>
                                <li><a class="dropdown-item" href="#" onclick="window.viewSupplierHistory('${escape(s.name)}')"><i class="fas fa-history fa-fw me-2"></i>Purchase History</a></li>
                                ${canDelete ? `<li><hr class="dropdown-divider"></li><li><a class="dropdown-item text-danger" href="#" onclick="window.deleteSupplier('${s.id}')"><i class="fas fa-trash fa-fw me-2"></i>Delete</a></li>` : ''}
                            </ul>
                        </div>
                    </div>
                    <div class="mt-3">
                        <p class="card-text mb-2"><i class="fas fa-user-tie fa-fw me-2 text-muted"></i> ${s.contactPerson || 'N/A'}</p>
                        <p class="card-text mb-2"><i class="fas fa-phone fa-fw me-2 text-muted"></i> ${s.phone || 'N/A'}</p>
                    </div>
                    
                    <div class="row g-2 mt-3">
                        <div class="col-6">
                            <div class="p-2 bg-light rounded border text-center">
                                <small class="d-block text-muted text-uppercase" style="font-size:0.65rem;">Purchases</small>
                                <span class="fw-bold text-dark">₹${totalPurchase.toLocaleString()}</span>
                            </div>
                        </div>
                        <div class="col-6">
                            <div class="p-2 bg-light rounded border text-center">
                                <small class="d-block text-muted text-uppercase" style="font-size:0.65rem;">Balance</small>
                                <span class="fw-bold ${balanceClass}">₹${balance.toLocaleString()}</span>
                            </div>
                        </div>
                    </div>

                    <div class="mt-auto pt-3 border-top border-light">
                        <small class="text-muted">GSTIN: <strong>${s.gstin || 'N/A'}</strong></small>
                    </div>
                </div>
            </div>
        </div>
        `;
        suppliersContainer.innerHTML += cardHtml;
    });
}

function getTypeBadge(type) {
    const map = {
        'Cement': 'bg-secondary',
        'Dust/Sand': 'bg-warning text-dark',
        'Aggregate': 'bg-dark',
        'Steel': 'bg-danger',
        'PVC/Fittings': 'bg-info text-dark',
        'Molds/Equipment': 'bg-primary',
        'Logistics': 'bg-success',
        'General': 'bg-light text-dark border'
    };
    const cls = map[type] || 'bg-light text-dark border';
    return `<span class="badge ${cls}">${type || 'General'}</span>`;
}

async function saveSupplier() {
    const user = JSON.parse(localStorage.getItem('user'));
    const name = document.getElementById('supplierName').value;
    const type = document.getElementById('supplierType').value;
    const businessId = user.businessId || user.uid;
    
    if (!name) return alert("Supplier Name is required");
    if (!type) return alert("Supplier Type is required");

    const btn = document.getElementById('saveSupplierBtn');
    const originalText = btn.innerHTML;
    btn.disabled = true;
    btn.innerHTML = '<span class="spinner-border spinner-border-sm"></span> Saving...';

    try {
        const data = {
            name,
            type,
            contactPerson: document.getElementById('supplierContact').value,
            phone: document.getElementById('supplierPhone').value,
            email: document.getElementById('supplierEmail').value,
            address: document.getElementById('supplierAddress').value,
            gstin: document.getElementById('supplierGstin').value,
            updatedAt: new Date()
        };

        if (currentSupplierId) {
            await db.collection('users').doc(businessId).collection('suppliers').doc(currentSupplierId).update(data);
            showAlert('success', 'Supplier updated successfully');
        } else {
            data.createdAt = new Date();
            await db.collection('users').doc(businessId).collection('suppliers').add(data);
            showAlert('success', 'Supplier added successfully');
        }

        bootstrap.Modal.getInstance(supplierModal).hide();
        loadSuppliers();
    } catch (error) {
        console.error("Error saving supplier", error);
        showAlert('danger', 'Failed to save supplier');
    } finally {
        btn.disabled = false;
        btn.innerHTML = originalText;
    }
}

window.editSupplier = (id) => {
    const s = suppliersCache.find(sup => sup.id === id);
    if (!s) return;

    currentSupplierId = id;
    document.getElementById('supplierName').value = s.name;
    document.getElementById('supplierType').value = s.type || 'General';
    document.getElementById('supplierContact').value = s.contactPerson || '';
    document.getElementById('supplierPhone').value = s.phone || '';
    document.getElementById('supplierEmail').value = s.email || '';
    document.getElementById('supplierAddress').value = s.address || '';
    document.getElementById('supplierGstin').value = s.gstin || '';
    
    document.querySelector('#supplierModal .modal-title').textContent = 'Edit Supplier';
    new bootstrap.Modal(supplierModal).show();
};

window.deleteSupplier = async (id) => {
    if(!confirm('Delete this supplier?')) return;
    const user = JSON.parse(localStorage.getItem('user'));
    if (user.permissions && user.permissions.canDelete === false) {
        return showAlert('danger', 'You do not have permission to delete items.');
    }

    const businessId = user.businessId || user.uid;
    try {
        await db.collection('users').doc(businessId).collection('suppliers').doc(id).delete();
        loadSuppliers();
        showAlert('success', 'Supplier deleted');
    } catch(e) {
        console.error(e);
        showAlert('danger', 'Failed to delete');
    }
};

window.viewSupplierHistory = async (supplierName) => {
    const user = JSON.parse(localStorage.getItem('user'));
    const businessId = user.businessId || user.uid;
    const historyModal = new bootstrap.Modal(document.getElementById('supplierHistoryModal'));
    const tbody = document.querySelector('#supplierHistoryTable tbody');
    document.getElementById('historySupplierName').textContent = supplierName;
    
    tbody.innerHTML = '<tr><td colspan="5" class="text-center">Loading...</td></tr>';
    historyModal.show();

    try {
        const snapshot = await db.collection('users').doc(businessId)
            .collection('purchases')
            .where('supplier', '==', supplierName)
            .orderBy('date', 'desc')
            .get();

        tbody.innerHTML = '';
        if (snapshot.empty) {
            tbody.innerHTML = '<tr><td colspan="5" class="text-center">No purchase history found</td></tr>';
            return;
        }

        snapshot.forEach(doc => {
            const p = doc.data();
            tbody.innerHTML += `
                <tr>
                    <td>${formatDate(p.date)}</td>
                    <td>${p.itemName}</td>
                    <td>${p.quantity}</td>
                    <td>₹${p.unitCost}</td>
                    <td>${p.invoiceNo || '-'}</td>
                </tr>
            `;
        });
    } catch (error) {
        console.error(error);
        tbody.innerHTML = '<tr><td colspan="5" class="text-center text-danger">Error loading history</td></tr>';
    }
};

window.recordSupplierPayment = (id, name) => {
    document.getElementById('spId').value = id;
    document.getElementById('spName').value = name;
    document.getElementById('spNameDisplay').value = name;
    document.getElementById('spDate').valueAsDate = new Date();
    document.getElementById('spAmount').value = '';
    document.getElementById('spRef').value = '';
    document.getElementById('spNotes').value = '';
    new bootstrap.Modal(supplierPaymentModal).show();
};

async function saveSupplierPayment() {
    const user = JSON.parse(localStorage.getItem('user'));
    const businessId = user.businessId || user.uid;
    
    const supplierId = document.getElementById('spId').value;
    const supplierName = document.getElementById('spName').value;
    const amount = parseFloat(document.getElementById('spAmount').value);
    const date = document.getElementById('spDate').value;
    const mode = document.getElementById('spMode').value;
    const ref = document.getElementById('spRef').value;
    const notes = document.getElementById('spNotes').value;

    if (!amount || amount <= 0 || !date) return alert("Invalid amount or date");

    const btn = document.getElementById('saveSupplierPaymentBtn');
    const originalText = btn.innerHTML;
    btn.disabled = true;
    btn.innerHTML = '<span class="spinner-border spinner-border-sm"></span> Saving...';

    try {
        await db.collection('users').doc(businessId).collection('transactions').add({
            type: 'SupplierPayment',
            description: notes || 'Payment to Supplier',
            supplierId: supplierId,
            supplier: supplierName, // Important for linking with purchases which use name
            amount: amount,
            date: new Date(date),
            mode: mode,
            reference: ref,
            createdAt: new Date()
        });

        // Update Supplier Balance
        const supplierRef = db.collection('users').doc(businessId).collection('suppliers').doc(supplierId);
        await db.runTransaction(async (t) => {
            const doc = await t.get(supplierRef);
            if (doc.exists) {
                const currentBal = doc.data().balance || 0;
                t.update(supplierRef, { 
                    balance: currentBal - amount,
                    updatedAt: new Date()
                });
            }
        });

        bootstrap.Modal.getInstance(supplierPaymentModal).hide();
        showAlert('success', 'Payment recorded successfully');
        loadSuppliers();
    } catch (e) {
        console.error(e);
        showAlert('danger', 'Failed to record payment');
    } finally {
        btn.disabled = false;
        btn.innerHTML = originalText;
    }
}

let currentLedgerSupplier = null;

window.viewSupplierLedger = (id, name) => {
    currentLedgerSupplier = { id, name };
    document.getElementById('slName').textContent = name;
    
    // Default dates (Current Month)
    const date = new Date();
    const firstDay = new Date(date.getFullYear(), date.getMonth(), 1);
    const lastDay = new Date(date.getFullYear(), date.getMonth() + 1, 0);
    
    // Timezone fix for date input
    const toISODate = (d) => {
        const offset = d.getTimezoneOffset() * 60000;
        return new Date(d.getTime() - offset).toISOString().split('T')[0];
    };

    document.getElementById('slStartDate').value = toISODate(firstDay);
    document.getElementById('slEndDate').value = toISODate(lastDay);

    new bootstrap.Modal(supplierLedgerModal).show();
    loadSupplierLedgerData();
};

async function loadSupplierLedgerData() {
    if (!currentLedgerSupplier) return;
    const user = JSON.parse(localStorage.getItem('user'));
    const businessId = user.businessId || user.uid;
    
    const startDate = new Date(document.getElementById('slStartDate').value);
    const endDate = new Date(document.getElementById('slEndDate').value);
    endDate.setHours(23, 59, 59);

    const tbody = document.querySelector('#supplierLedgerTable tbody');
    tbody.innerHTML = '<tr><td colspan="6" class="text-center">Loading...</td></tr>';

    try {
        // 1. Fetch Purchases (Credits) - Linked by Name
        const purchasesSnap = await db.collection('users').doc(businessId).collection('purchases')
            .where('supplier', '==', currentLedgerSupplier.name)
            .get();

        // 2. Fetch Payments (Debits) - Linked by Name (safer as legacy might not have ID) or ID
        const paymentsSnap = await db.collection('users').doc(businessId).collection('transactions')
            .where('type', '==', 'SupplierPayment')
            .where('supplier', '==', currentLedgerSupplier.name)
            .get();

        let transactions = [];
        
        purchasesSnap.forEach(doc => {
            const d = doc.data();
            transactions.push({
                date: d.date.toDate(),
                desc: `Purchase: ${d.itemName} (${d.quantity})`,
                ref: d.invoiceNo || '-',
                credit: d.totalCost || 0, // We owe this
                debit: 0
            });
        });

        paymentsSnap.forEach(doc => {
            const d = doc.data();
            transactions.push({
                date: d.date.toDate(),
                desc: d.description || 'Payment',
                ref: d.reference || d.mode,
                credit: 0,
                debit: d.amount || 0 // We paid this
            });
        });

        // Sort by Date
        transactions.sort((a, b) => a.date - b.date);

        // Render
        tbody.innerHTML = '';
        let balance = 0; // Positive means we owe money
        let totalCr = 0, totalDr = 0;

        transactions.forEach(t => {
            if (t.date >= startDate && t.date <= endDate) {
                balance += (t.credit - t.debit);
                totalCr += t.credit;
                totalDr += t.debit;
                
                tbody.innerHTML += `
                    <tr>
                        <td>${formatDate(t.date)}</td>
                        <td>${t.desc}</td>
                        <td>${t.ref}</td>
                        <td class="text-end text-danger">${t.credit > 0 ? '₹'+t.credit.toLocaleString() : '-'}</td>
                        <td class="text-end text-success">${t.debit > 0 ? '₹'+t.debit.toLocaleString() : '-'}</td>
                        <td class="text-end fw-bold">₹${balance.toLocaleString()}</td>
                    </tr>
                `;
            } else if (t.date < startDate) {
                balance += (t.credit - t.debit);
            }
        });

        // Prepend Opening Balance
        const openingRow = `
            <tr class="table-secondary">
                <td colspan="3"><strong>Opening Balance</strong></td>
                <td colspan="2"></td>
                <td class="text-end fw-bold">₹${(balance - (totalCr - totalDr)).toLocaleString()}</td>
            </tr>
        `;
        tbody.insertAdjacentHTML('afterbegin', openingRow);

        document.getElementById('slTotalPurchase').textContent = `₹${totalCr.toLocaleString()}`;
        document.getElementById('slTotalPayment').textContent = `₹${totalDr.toLocaleString()}`;
        document.getElementById('slFinalBalance').textContent = `₹${balance.toLocaleString()}`;

    } catch (e) {
        console.error(e);
        tbody.innerHTML = '<tr><td colspan="6" class="text-center text-danger">Error loading ledger</td></tr>';
    }
}

window.printSupplierLedger = () => {
    const name = document.getElementById('slName').textContent;
    const table = document.getElementById('supplierLedgerTable').outerHTML;
    const win = window.open('', '_blank');
    win.document.write(`
        <html><head><title>Supplier Ledger - ${name}</title>
        <link href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.0/dist/css/bootstrap.min.css" rel="stylesheet">
        <style>body{padding:20px} table{font-size:12px}</style>
        </head><body>
        <h4 class="text-center mb-4">Supplier Ledger: ${name}</h4>
        ${table}
        <script>window.print()</script>
        </body></html>
    `);
    win.document.close();
};