import { db } from './firebase-config.js';
import { checkAuth, formatDate, downloadCSV, downloadPDF } from './dashboard.js';

let currentProjectId = null;
let projectsData = [];
let inventoryCache = [];
const exportProjectsPdfBtn = document.getElementById('exportProjectsPdfBtn');
const exportProjectsCsvBtn = document.getElementById('exportProjectsCsvBtn');
const orderItemsContainer = document.getElementById('orderItemsContainer');
const orderAddItemBtn = document.getElementById('orderAddItemBtn');
const orderGrandTotal = document.getElementById('orderGrandTotal');
const orderSearch = document.getElementById('orderSearch');
const orderStatusFilter = document.getElementById('orderStatusFilter');
const orderDateFrom = document.getElementById('orderDateFrom');
const orderDateTo = document.getElementById('orderDateTo');
const resetOrderFilters = document.getElementById('resetOrderFilters');

document.addEventListener('DOMContentLoaded', async () => {
    await checkAuth();
    loadProjects();
    checkPendingActions();
    
    window.addEventListener('sectionChanged', (e) => {
        if (e.detail === 'projects') {
            loadProjects();
            checkPendingActions();
        }
    });
    
    document.getElementById('addProjectBtn').addEventListener('click', () => {
        resetProjectForm();
        new bootstrap.Modal(document.getElementById('projectModal')).show();
    });
    
    document.getElementById('projectModal').addEventListener('hidden.bs.modal', resetProjectForm);

    document.getElementById('saveProjectBtn').addEventListener('click', saveProject);

    if (orderAddItemBtn) {
        orderAddItemBtn.addEventListener('click', addOrderItemRow);
    }
    if (orderItemsContainer) {
        orderItemsContainer.addEventListener('change', (e) => {
            const select = e.target.closest('.order-item-select');
            if (select) {
                const option = select.selectedOptions[0];
                const price = option?.dataset?.price || 0;
                const row = select.closest('tr');
                const priceInput = row?.querySelector('.order-item-price');
                if (priceInput) priceInput.value = price;
                calculateOrderTotal();
            }
        });
        orderItemsContainer.addEventListener('input', calculateOrderTotal);
        orderItemsContainer.addEventListener('click', (e) => {
            if (e.target.closest('.order-remove-row')) {
                e.target.closest('tr')?.remove();
                calculateOrderTotal();
            }
        });
    }

    if (exportProjectsCsvBtn) {
        exportProjectsCsvBtn.addEventListener('click', exportProjectsCSV);
    }

    if (exportProjectsPdfBtn) {
        exportProjectsPdfBtn.addEventListener('click', exportProjectsPDF);
    }

    if (orderSearch) {
        orderSearch.addEventListener('input', applyOrderFilters);
    }
    if (orderStatusFilter) {
        orderStatusFilter.addEventListener('change', applyOrderFilters);
    }
    if (orderDateFrom) {
        orderDateFrom.addEventListener('change', applyOrderFilters);
    }
    if (orderDateTo) {
        orderDateTo.addEventListener('change', applyOrderFilters);
    }
    if (resetOrderFilters) {
        resetOrderFilters.addEventListener('click', () => {
            if (orderSearch) orderSearch.value = '';
            if (orderStatusFilter) orderStatusFilter.value = 'all';
            if (orderDateFrom) orderDateFrom.value = '';
            if (orderDateTo) orderDateTo.value = '';
            applyOrderFilters();
        });
    }
});

async function loadProjects() {
    const user = JSON.parse(localStorage.getItem('user'));
    if (!user) return;
    const businessId = user.businessId || user.uid;
    const tbody = document.querySelector('#projectsTable tbody');
    tbody.innerHTML = '<tr><td colspan="7" class="text-center">Loading...</td></tr>';

    try {
        await loadInventoryCache(businessId);

        const snapshot = await db.collection('users').doc(businessId).collection('orders').orderBy('createdAt', 'desc').get();
        tbody.innerHTML = '';
        
        if (snapshot.empty) {
            tbody.innerHTML = '<tr><td colspan="7" class="text-center">No orders found</td></tr>';
            return;
        }

        projectsData = [];
        snapshot.forEach(doc => {
            const p = doc.data();
            projectsData.push({ id: doc.id, ...p });
            const escape = (str) => (str || '').replace(/\\/g, '\\\\').replace(/'/g, "\\'").replace(/\"/g, '&quot;').replace(/\n/g, '\\n').replace(/\r/g, '');
            const canDelete = user.permissions ? user.permissions.canDelete : true;
            const row = `
                <tr>
                    <td>${p.name || '-'}</td>
                    <td>${p.customerName || '-'}</td>
                    <td><span class="badge bg-${getStatusColor(p.status)}">${p.status || 'Pending'}</span></td>
                    <td>${formatDate(p.orderDate || p.createdAt)}</td>
                    <td>${p.deliveryDate ? formatDate(p.deliveryDate) : '-'}</td>
                    <td>₹${(p.total || 0).toLocaleString()}</td>
                    <td>
                        <button class="btn btn-sm btn-outline-primary me-1" onclick="editProject('${doc.id}')">
                            <i class="fas fa-edit"></i>
                        </button>
                        <button class="btn btn-sm btn-outline-success me-1" onclick="createInvoiceFromOrder('${doc.id}')">
                            <i class="fas fa-file-invoice"></i>
                        </button>
                        ${canDelete ? `<button class="btn btn-sm btn-outline-danger" onclick="deleteProject('${doc.id}')">
                            <i class="fas fa-trash"></i>
                        </button>` : ''}
                    </td>
                </tr>
            `;
            tbody.innerHTML += row;
        });
        applyOrderFilters();
    } catch (e) {
        console.error(e);
        tbody.innerHTML = '<tr><td colspan="7" class="text-center text-danger">Error loading orders</td></tr>';
    }
}
async function loadInventoryCache(businessId) {
    if (inventoryCache.length) return;
    try {
        const snapshot = await db.collection('users').doc(businessId).collection('inventory').get();
        inventoryCache = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    } catch (e) {
        console.error('Error loading inventory', e);
    }
}

function addOrderItemRow(prefill = {}) {
    if (!orderItemsContainer) return;
    const options = inventoryCache.map(i => `
        <option value="${i.id}" data-price="${i.sellingPrice || 0}" data-cost="${i.costPrice || 0}">${i.name} (Stock: ${i.quantity})</option>
    `).join('');

    const row = document.createElement('tr');
    row.innerHTML = `
        <td>
            <select class="form-select form-select-sm order-item-select">
                <option value="">Select Item...</option>
                ${options}
            </select>
        </td>
        <td><input type="number" class="form-control form-control-sm order-item-qty" value="${prefill.quantity || 1}" min="1"></td>
        <td><input type="number" class="form-control form-control-sm order-item-price" value="${prefill.price || 0}"></td>
        <td class="order-item-total">₹0.00</td>
        <td class="text-center"><button type="button" class="btn btn-sm btn-outline-danger order-remove-row"><i class="fas fa-times"></i></button></td>
    `;

    const select = row.querySelector('.order-item-select');
    if (prefill.itemId) {
        select.value = prefill.itemId;
    }
    if (prefill.name && !select.value) {
        const opt = document.createElement('option');
        opt.value = '__custom__';
        opt.textContent = `${prefill.name} (Custom)`;
        opt.dataset.price = prefill.price || 0;
        opt.dataset.cost = prefill.costPrice || 0;
        select.appendChild(opt);
        select.value = '__custom__';
    }

    orderItemsContainer.appendChild(row);
    calculateOrderTotal();
}

function calculateOrderTotal() {
    if (!orderItemsContainer) return 0;
    let total = 0;
    orderItemsContainer.querySelectorAll('tr').forEach(row => {
        const qty = parseFloat(row.querySelector('.order-item-qty')?.value) || 0;
        const price = parseFloat(row.querySelector('.order-item-price')?.value) || 0;
        const rowTotal = qty * price;
        const totalEl = row.querySelector('.order-item-total');
        if (totalEl) totalEl.textContent = `₹${rowTotal.toFixed(2)}`;
        total += rowTotal;
    });
    if (orderGrandTotal) {
        orderGrandTotal.textContent = `₹${total.toLocaleString(undefined, { minimumFractionDigits: 2 })}`;
    }
    return total;
}
function toInputDate(value) {
    if (!value) return '';
    const d = value.toDate ? value.toDate() : new Date(value);
    return d.toISOString().split('T')[0];
}

function getOrderItemsFromForm() {
    if (!orderItemsContainer) return [];
    const items = [];
    orderItemsContainer.querySelectorAll('tr').forEach(row => {
        const select = row.querySelector('.order-item-select');
        const itemId = select?.value || '';
        const option = select?.selectedOptions?.[0];
        const name = option ? option.textContent.replace(/ \(.*\)$/, '') : '';
        const quantity = parseFloat(row.querySelector('.order-item-qty')?.value) || 0;
        const price = parseFloat(row.querySelector('.order-item-price')?.value) || 0;
        const costPrice = parseFloat(option?.dataset?.cost || 0) || 0;
        if (name && quantity > 0) {
            items.push({ itemId, name, quantity, price, costPrice });
        }
    });
    return items;
}

function setOrderItems(items = []) {
    if (!orderItemsContainer) return;
    orderItemsContainer.innerHTML = '';
    if (!items.length) {
        addOrderItemRow();
        return;
    }
    items.forEach(item => addOrderItemRow(item));
}

function getProjectsExportRows() {
    return projectsData.map(p => ([
        p.name || '',
        p.customerName || '',
        p.status || '',
        formatDate(p.orderDate || p.createdAt),
        p.deliveryDate ? formatDate(p.deliveryDate) : '',
        p.total ?? 0
    ]));
}

function exportProjectsCSV() {
    if (!projectsData.length) {
        alert('No orders to export.');
        return;
    }

    const headers = ['Order Name', 'Customer', 'Status', 'Order Date', 'Delivery Date', 'Total'];
    const rows = getProjectsExportRows();
    const filename = `orders_${new Date().toISOString().split('T')[0]}.csv`;
    downloadCSV(filename, headers, rows);
}

function exportProjectsPDF() {
    if (!projectsData.length) {
        alert('No orders to export.');
        return;
    }

    const headers = ['Order Name', 'Customer', 'Status', 'Order Date', 'Delivery Date', 'Total'];
    const rows = getProjectsExportRows();
    const filename = `orders_${new Date().toISOString().split('T')[0]}.pdf`;
    downloadPDF(filename, 'Orders Report', headers, rows);
}

function applyOrderFilters() {
    const table = document.getElementById('projectsTable');
    if (!table) return;
    const rows = table.querySelectorAll('tbody tr');
    const searchTerm = (orderSearch?.value || '').toLowerCase();
    const statusFilter = orderStatusFilter?.value || 'all';
    const fromVal = orderDateFrom?.value || '';
    const toVal = orderDateTo?.value || '';
    const fromDate = fromVal ? new Date(fromVal) : null;
    const toDate = toVal ? new Date(toVal) : null;

    rows.forEach(row => {
        if (row.querySelector('td[colspan]')) return;
        const cells = row.querySelectorAll('td');
        const rowText = row.textContent.toLowerCase();
        if (searchTerm && !rowText.includes(searchTerm)) {
            row.style.display = 'none';
            return;
        }

        const statusText = cells[2]?.textContent?.trim() || '';
        if (statusFilter !== 'all' && statusText !== statusFilter) {
            row.style.display = 'none';
            return;
        }

        if (fromDate || toDate) {
            const dateText = cells[3]?.textContent?.trim() || '';
            const dateObj = dateText ? new Date(dateText) : null;
            if (fromDate && dateObj && dateObj < fromDate) {
                row.style.display = 'none';
                return;
            }
            if (toDate && dateObj) {
                const end = new Date(toDate);
                end.setHours(23, 59, 59, 999);
                if (dateObj > end) {
                    row.style.display = 'none';
                    return;
                }
            }
        }

        row.style.display = '';
    });
}

async function saveProject() {
    const user = JSON.parse(localStorage.getItem('user'));
    const businessId = user.businessId || user.uid;
    const name = document.getElementById('projectName').value;
    const customerName = document.getElementById('projectCustomerName').value;
    const status = document.getElementById('projectStatus').value;
    const orderDate = document.getElementById('projectOrderDate').value;
    const deliveryDate = document.getElementById('projectDeliveryDate').value;
    const notes = document.getElementById('projectNotes').value;
    const items = getOrderItemsFromForm();
    const total = calculateOrderTotal();

    if (!name || !customerName || !status || !orderDate) return alert('Please fill required fields');

    try {
        const projectData = {
            name,
            customerName,
            status,
            orderDate: new Date(orderDate),
            deliveryDate: deliveryDate ? new Date(deliveryDate) : null,
            notes: notes || '',
            items,
            total,
            updatedAt: new Date()
        };

        if (currentProjectId) {
            await db.collection('users').doc(businessId).collection('orders').doc(currentProjectId).update(projectData);
        } else {
            projectData.createdAt = new Date();
            await db.collection('users').doc(businessId).collection('orders').add(projectData);

            // Update customer stats
            const custSnap = await db.collection('users').doc(businessId)
                .collection('customers')
                .where('name', '==', customerName)
                .limit(1)
                .get();
            if (!custSnap.empty) {
                const custDoc = custSnap.docs[0];
                const currentTotal = custDoc.data().totalProjects || 0;
                await custDoc.ref.update({
                    totalProjects: currentTotal + 1,
                    lastContact: new Date()
                });
            }
        }
        
        bootstrap.Modal.getInstance(document.getElementById('projectModal')).hide();
        resetProjectForm();
        loadProjects();
    } catch (e) {
        console.error(e);
        alert('Failed to save order');
    }
}

function getStatusColor(status) {
    if (status === 'Completed') return 'success';
    if (status === 'Dispatched') return 'info';
    if (status === 'Processing') return 'primary';
    if (status === 'Cancelled') return 'danger';
    return 'warning';
}

function resetProjectForm() {
    currentProjectId = null;
    document.getElementById('projectForm').reset();
    document.querySelector('#projectModal .modal-title').textContent = 'New Order';
    const orderDateInput = document.getElementById('projectOrderDate');
    if (orderDateInput) orderDateInput.valueAsDate = new Date();
    if (orderItemsContainer) orderItemsContainer.innerHTML = '';
    if (orderGrandTotal) orderGrandTotal.textContent = '₹0.00';
    addOrderItemRow();
}

window.editProject = async (id) => {
    const user = JSON.parse(localStorage.getItem('user'));
    if (!user) return;
    const businessId = user.businessId || user.uid;
    try {
        await loadInventoryCache(businessId);
        const doc = await db.collection('users').doc(businessId).collection('orders').doc(id).get();
        if (!doc.exists) return;
        const order = doc.data();

        currentProjectId = id;
        document.getElementById('projectName').value = order.name || '';
        document.getElementById('projectCustomerName').value = order.customerName || '';
        document.getElementById('projectStatus').value = order.status || 'Pending';
        document.getElementById('projectOrderDate').value = order.orderDate ? toInputDate(order.orderDate) : '';
        document.getElementById('projectDeliveryDate').value = order.deliveryDate ? toInputDate(order.deliveryDate) : '';
        document.getElementById('projectNotes').value = order.notes || '';
        setOrderItems(order.items || []);

        document.querySelector('#projectModal .modal-title').textContent = 'Edit Order';
        new bootstrap.Modal(document.getElementById('projectModal')).show();
    } catch (e) {
        console.error(e);
    }
};

function checkPendingActions() {
    const openModal = sessionStorage.getItem('openOrderModal') || sessionStorage.getItem('openProjectModal');
    if (openModal) {
        sessionStorage.removeItem('openOrderModal');
        sessionStorage.removeItem('openProjectModal');
        
        resetProjectForm();
        
        // Check for selected customer
        const customerData = sessionStorage.getItem('selectedCustomer');
        if (customerData) {
            const customer = JSON.parse(customerData);
            document.getElementById('projectCustomerName').value = customer.name;
            sessionStorage.removeItem('selectedCustomer');
        }
        
        new bootstrap.Modal(document.getElementById('projectModal')).show();
    }
}

window.createInvoiceFromOrder = async (id) => {
    const user = JSON.parse(localStorage.getItem('user'));
    if (!user) return;
    const businessId = user.businessId || user.uid;
    try {
        const doc = await db.collection('users').doc(businessId).collection('orders').doc(id).get();
        if (!doc.exists) return;
        const order = { id: doc.id, ...doc.data() };
        if (window.openInvoiceModalWithOrder) {
            window.openInvoiceModalWithOrder(order);
        } else {
            alert('Invoice module not loaded.');
        }
    } catch (e) {
        console.error(e);
        alert('Failed to open invoice');
    }
};

// Expose delete globally for the onclick handler
window.deleteProject = async (id) => {
    if(!confirm('Delete this order?')) return;
    const user = JSON.parse(localStorage.getItem('user'));
    if (user.permissions && user.permissions.canDelete === false) {
        return alert('You do not have permission to delete items.');
    }

    const businessId = user.businessId || user.uid;
    try {
        await db.collection('users').doc(businessId).collection('orders').doc(id).delete();
        loadProjects();
    } catch(e) {
        console.error(e);
    }
};









