import { db } from './firebase-config.js';
import { checkAuth, formatDate, downloadCSV } from './dashboard.js';

const paymentInTable = document.getElementById('paymentInTable');
const paymentOutTable = document.getElementById('paymentOutTable');
const paymentInSearch = document.getElementById('paymentInSearch');
const paymentOutSearch = document.getElementById('paymentOutSearch');
const paymentInMode = document.getElementById('paymentInMode');
const paymentOutMode = document.getElementById('paymentOutMode');
const paymentInFrom = document.getElementById('paymentInFrom');
const paymentInTo = document.getElementById('paymentInTo');
const paymentOutFrom = document.getElementById('paymentOutFrom');
const paymentOutTo = document.getElementById('paymentOutTo');
const resetPaymentInFilters = document.getElementById('resetPaymentInFilters');
const resetPaymentOutFilters = document.getElementById('resetPaymentOutFilters');
const paymentInTotal = document.getElementById('paymentInTotal');
const paymentOutTotal = document.getElementById('paymentOutTotal');
const exportPaymentInCsvBtn = document.getElementById('exportPaymentInCsvBtn');
const exportPaymentOutCsvBtn = document.getElementById('exportPaymentOutCsvBtn');
const paymentsViewBtn = document.getElementById('paymentsViewBtn');
const addPaymentInBtn = document.getElementById('addPaymentInBtn');
const addPaymentOutBtn = document.getElementById('addPaymentOutBtn');
const paymentInSelectModal = document.getElementById('paymentInSelectModal');
const paymentOutSelectModal = document.getElementById('paymentOutSelectModal');
const paymentInInvoiceSelect = document.getElementById('paymentInInvoiceSelect');
const paymentOutSupplierSelect = document.getElementById('paymentOutSupplierSelect');
const confirmPaymentInSelect = document.getElementById('confirmPaymentInSelect');
const confirmPaymentOutSelect = document.getElementById('confirmPaymentOutSelect');
const paymentInToggle = document.getElementById('paymentInToggle');
const paymentOutToggle = document.getElementById('paymentOutToggle');

let paymentInData = [];
let paymentOutData = [];

document.addEventListener('DOMContentLoaded', async () => {
    await checkAuth();
    setupListeners();

    if (window.location.hash === '#payments') {
        loadPayments();
        setPaymentsView('in');
    }

    window.addEventListener('sectionChanged', (e) => {
        if (e.detail === 'payments') {
            loadPayments();
            setPaymentsView('in');
        }
    });
});

function setupListeners() {
    if (paymentInSearch) paymentInSearch.addEventListener('input', renderPaymentIn);
    if (paymentOutSearch) paymentOutSearch.addEventListener('input', renderPaymentOut);
    if (paymentInMode) paymentInMode.addEventListener('change', renderPaymentIn);
    if (paymentOutMode) paymentOutMode.addEventListener('change', renderPaymentOut);
    if (paymentInFrom) paymentInFrom.addEventListener('change', renderPaymentIn);
    if (paymentInTo) paymentInTo.addEventListener('change', renderPaymentIn);
    if (paymentOutFrom) paymentOutFrom.addEventListener('change', renderPaymentOut);
    if (paymentOutTo) paymentOutTo.addEventListener('change', renderPaymentOut);

    if (resetPaymentInFilters) {
        resetPaymentInFilters.addEventListener('click', () => {
            if (paymentInSearch) paymentInSearch.value = '';
            if (paymentInMode) paymentInMode.value = 'all';
            if (paymentInFrom) paymentInFrom.value = '';
            if (paymentInTo) paymentInTo.value = '';
            renderPaymentIn();
        });
    }

    if (resetPaymentOutFilters) {
        resetPaymentOutFilters.addEventListener('click', () => {
            if (paymentOutSearch) paymentOutSearch.value = '';
            if (paymentOutMode) paymentOutMode.value = 'all';
            if (paymentOutFrom) paymentOutFrom.value = '';
            if (paymentOutTo) paymentOutTo.value = '';
            renderPaymentOut();
        });
    }

    if (exportPaymentInCsvBtn) {
        exportPaymentInCsvBtn.addEventListener('click', exportPaymentInCSV);
    }
    if (exportPaymentOutCsvBtn) {
        exportPaymentOutCsvBtn.addEventListener('click', exportPaymentOutCSV);
    }

    if (paymentInToggle) {
        paymentInToggle.addEventListener('click', () => setPaymentsView('in'));
    }
    if (paymentOutToggle) {
        paymentOutToggle.addEventListener('click', () => setPaymentsView('out'));
    }

    if (addPaymentInBtn) {
        addPaymentInBtn.addEventListener('click', openPaymentInSelector);
    }
    if (addPaymentOutBtn) {
        addPaymentOutBtn.addEventListener('click', openPaymentOutSelector);
    }
    if (confirmPaymentInSelect) {
        confirmPaymentInSelect.addEventListener('click', () => {
            const id = paymentInInvoiceSelect?.value || '';
            if (!id) return;
            const modal = bootstrap.Modal.getInstance(paymentInSelectModal);
            if (modal) modal.hide();
            if (window.openPaymentHistory) {
                window.openPaymentHistory(id);
            }
        });
    }
    if (confirmPaymentOutSelect) {
        confirmPaymentOutSelect.addEventListener('click', () => {
            const val = paymentOutSupplierSelect?.value || '';
            if (!val) return;
            const [id, name] = val.split('|');
            const modal = bootstrap.Modal.getInstance(paymentOutSelectModal);
            if (modal) modal.hide();
            if (window.recordSupplierPayment) {
                window.recordSupplierPayment(id, name);
            }
        });
    }

    // handled by setPaymentsView
}

async function loadPayments() {
    const user = JSON.parse(localStorage.getItem('user'));
    if (!user) return;
    const businessId = user.businessId || user.uid;

    if (paymentInTable) {
        paymentInTable.querySelector('tbody').innerHTML = '<tr><td colspan="6" class="text-center">Loading...</td></tr>';
    }
    if (paymentOutTable) {
        paymentOutTable.querySelector('tbody').innerHTML = '<tr><td colspan="6" class="text-center">Loading...</td></tr>';
    }

    try {
        const [paymentInSnap, paymentOutSnap, invoiceSnap] = await Promise.all([
            db.collection('users').doc(businessId).collection('transactions')
                .where('type', '==', 'Payment')
                .orderBy('date', 'desc')
                .get(),
            db.collection('users').doc(businessId).collection('transactions')
                .where('type', '==', 'SupplierPayment')
                .orderBy('date', 'desc')
                .get(),
            db.collection('users').doc(businessId).collection('transactions')
                .where('type', '==', 'Invoice')
                .orderBy('date', 'desc')
                .limit(200)
                .get()
        ]);

        paymentInData = [];
        const paymentTotals = {};
        paymentInSnap.forEach(doc => {
            const p = doc.data();
            if (p.invoiceId) {
                paymentTotals[p.invoiceId] = (paymentTotals[p.invoiceId] || 0) + (p.amount || 0);
            }
            paymentInData.push({
                id: doc.id,
                date: p.date,
                customer: p.customer || '-',
                mode: p.mode || '-',
                reference: p.reference || '-',
                description: p.description || 'Payment In',
                amount: p.amount ?? 0
            });
        });

        invoiceSnap.forEach(doc => {
            const inv = doc.data();
            const paid = Number(inv.amountPaid || 0);
            if (paid <= 0) return;
            const recorded = Number(paymentTotals[doc.id] || 0);
            const diff = paid - recorded;
            if (diff > 0.01) {
                paymentInData.push({
                    id: `${doc.id}_initial`,
                    date: inv.date,
                    customer: inv.customer || '-',
                    mode: 'Initial',
                    reference: `#${doc.id.substr(0,6).toUpperCase()}`,
                    description: 'Initial payment (legacy)',
                    amount: diff
                });
            }
        });
        paymentInData.sort((a, b) => {
            const ad = a.date?.toDate ? a.date.toDate() : (a.date ? new Date(a.date) : new Date(0));
            const bd = b.date?.toDate ? b.date.toDate() : (b.date ? new Date(b.date) : new Date(0));
            return bd - ad;
        });

        paymentOutData = [];
        paymentOutSnap.forEach(doc => {
            const p = doc.data();
            paymentOutData.push({
                id: doc.id,
                date: p.date,
                supplier: p.supplier || '-',
                mode: p.mode || '-',
                reference: p.reference || '-',
                description: p.description || 'Payment Out',
                amount: p.amount ?? 0
            });
        });
        paymentOutData.sort((a, b) => {
            const ad = a.date?.toDate ? a.date.toDate() : (a.date ? new Date(a.date) : new Date(0));
            const bd = b.date?.toDate ? b.date.toDate() : (b.date ? new Date(b.date) : new Date(0));
            return bd - ad;
        });

        renderPaymentIn();
        renderPaymentOut();
    } catch (e) {
        console.error('Error loading payments', e);
        if (paymentInTable) {
            paymentInTable.querySelector('tbody').innerHTML = '<tr><td colspan="6" class="text-center text-danger">Error loading data</td></tr>';
        }
        if (paymentOutTable) {
            paymentOutTable.querySelector('tbody').innerHTML = '<tr><td colspan="6" class="text-center text-danger">Error loading data</td></tr>';
        }
    }
}

async function openPaymentInSelector() {
    if (!paymentInSelectModal || !paymentInInvoiceSelect) return;
    paymentInInvoiceSelect.innerHTML = '<option value="">Loading...</option>';

    const user = JSON.parse(localStorage.getItem('user'));
    if (!user) return;
    const businessId = user.businessId || user.uid;

    try {
        const snap = await db.collection('users').doc(businessId)
            .collection('transactions')
            .where('type', '==', 'Invoice')
            .orderBy('date', 'desc')
            .limit(200)
            .get();

        const options = [];
        snap.forEach(doc => {
            const inv = doc.data();
            const balance = Number(inv.balance || 0);
            if (balance <= 0) return;
            const invNo = inv.invoiceNo || `#${doc.id.substr(0,6).toUpperCase()}`;
            const label = `${invNo} - ${inv.customer || 'Customer'} (Bal: ₹${balance.toLocaleString()})`;
            options.push(`<option value="${doc.id}">${label}</option>`);
        });

        if (!options.length) {
            paymentInInvoiceSelect.innerHTML = '<option value="">No unpaid invoices</option>';
        } else {
            paymentInInvoiceSelect.innerHTML = '<option value="">Select Invoice...</option>' + options.join('');
        }
    } catch (e) {
        console.error('Failed to load invoices', e);
        paymentInInvoiceSelect.innerHTML = '<option value="">Error loading invoices</option>';
    }

    new bootstrap.Modal(paymentInSelectModal).show();
}

async function openPaymentOutSelector() {
    if (!paymentOutSelectModal || !paymentOutSupplierSelect) return;
    paymentOutSupplierSelect.innerHTML = '<option value="">Loading...</option>';

    const user = JSON.parse(localStorage.getItem('user'));
    if (!user) return;
    const businessId = user.businessId || user.uid;

    try {
        const snap = await db.collection('users').doc(businessId)
            .collection('suppliers')
            .orderBy('name')
            .get();

        const options = [];
        snap.forEach(doc => {
            const s = doc.data();
            const name = s.name || 'Supplier';
            options.push(`<option value="${doc.id}|${name}">${name}</option>`);
        });

        if (!options.length) {
            paymentOutSupplierSelect.innerHTML = '<option value="">No suppliers found</option>';
        } else {
            paymentOutSupplierSelect.innerHTML = '<option value="">Select Supplier...</option>' + options.join('');
        }
    } catch (e) {
        console.error('Failed to load suppliers', e);
        paymentOutSupplierSelect.innerHTML = '<option value="">Error loading suppliers</option>';
    }

    new bootstrap.Modal(paymentOutSelectModal).show();
}

function withinDateRange(dateValue, fromVal, toVal) {
    if (!dateValue) return true;
    const dateObj = dateValue.toDate ? dateValue.toDate() : new Date(dateValue);
    if (Number.isNaN(dateObj.getTime())) return true;
    if (fromVal) {
        const fromDate = new Date(fromVal);
        if (dateObj < fromDate) return false;
    }
    if (toVal) {
        const toDate = new Date(toVal);
        toDate.setHours(23, 59, 59, 999);
        if (dateObj > toDate) return false;
    }
    return true;
}

function renderPaymentIn() {
    if (!paymentInTable) return;
    const tbody = paymentInTable.querySelector('tbody');
    const searchTerm = (paymentInSearch?.value || '').toLowerCase();
    const modeFilter = paymentInMode?.value || 'all';
    const fromVal = paymentInFrom?.value || '';
    const toVal = paymentInTo?.value || '';

    const filtered = paymentInData.filter(p => {
        const text = `${p.customer} ${p.reference} ${p.description}`.toLowerCase();
        if (searchTerm && !text.includes(searchTerm)) return false;
        if (modeFilter !== 'all' && (p.mode || '-') !== modeFilter) return false;
        if (!withinDateRange(p.date, fromVal, toVal)) return false;
        return true;
    });

    if (!filtered.length) {
        tbody.innerHTML = '<tr><td colspan="6" class="text-center text-muted">No payments found</td></tr>';
    } else {
        tbody.innerHTML = filtered.map(p => `
            <tr>
                <td>${p.date ? formatDate(p.date) : '-'}</td>
                <td>${p.customer}</td>
                <td>${p.mode}</td>
                <td>${p.reference}</td>
                <td>${p.description}</td>
                <td class="text-end text-success fw-bold">&#8377;${Number(p.amount || 0).toLocaleString()}</td>
            </tr>
        `).join('');
    }

    const total = filtered.reduce((sum, p) => sum + (p.amount || 0), 0);
    if (paymentInTotal) paymentInTotal.innerHTML = `&#8377;${total.toLocaleString()}`;
}

function renderPaymentOut() {
    if (!paymentOutTable) return;
    const tbody = paymentOutTable.querySelector('tbody');
    const searchTerm = (paymentOutSearch?.value || '').toLowerCase();
    const modeFilter = paymentOutMode?.value || 'all';
    const fromVal = paymentOutFrom?.value || '';
    const toVal = paymentOutTo?.value || '';

    const filtered = paymentOutData.filter(p => {
        const text = `${p.supplier} ${p.reference} ${p.description}`.toLowerCase();
        if (searchTerm && !text.includes(searchTerm)) return false;
        if (modeFilter !== 'all' && (p.mode || '-') !== modeFilter) return false;
        if (!withinDateRange(p.date, fromVal, toVal)) return false;
        return true;
    });

    if (!filtered.length) {
        tbody.innerHTML = '<tr><td colspan="6" class="text-center text-muted">No payments found</td></tr>';
    } else {
        tbody.innerHTML = filtered.map(p => `
            <tr>
                <td>${p.date ? formatDate(p.date) : '-'}</td>
                <td>${p.supplier}</td>
                <td>${p.mode}</td>
                <td>${p.reference}</td>
                <td>${p.description}</td>
                <td class="text-end text-danger fw-bold">&#8377;${Number(p.amount || 0).toLocaleString()}</td>
            </tr>
        `).join('');
    }

    const total = filtered.reduce((sum, p) => sum + (p.amount || 0), 0);
    if (paymentOutTotal) paymentOutTotal.innerHTML = `&#8377;${total.toLocaleString()}`;
}

function setPaymentsView(mode) {
    const inPane = document.getElementById('paymentInPane');
    const outPane = document.getElementById('paymentOutPane');
    if (!inPane || !outPane) return;

    if (mode === 'out') {
        inPane.classList.remove('show', 'active');
        outPane.classList.add('show', 'active');
        if (paymentInToggle) paymentInToggle.classList.remove('active');
        if (paymentOutToggle) paymentOutToggle.classList.add('active');
        if (paymentsViewBtn) paymentsViewBtn.innerHTML = '<i class="fas fa-exchange-alt me-1"></i> View: Payment Out';
    } else {
        outPane.classList.remove('show', 'active');
        inPane.classList.add('show', 'active');
        if (paymentOutToggle) paymentOutToggle.classList.remove('active');
        if (paymentInToggle) paymentInToggle.classList.add('active');
        if (paymentsViewBtn) paymentsViewBtn.innerHTML = '<i class="fas fa-exchange-alt me-1"></i> View: Payment In';
    }
}

function getPaymentInExportRows() {
    return paymentInData.map(p => ([
        p.date ? formatDate(p.date) : '',
        p.customer || '',
        p.mode || '',
        p.reference || '',
        p.description || '',
        p.amount ?? 0
    ]));
}

function getPaymentOutExportRows() {
    return paymentOutData.map(p => ([
        p.date ? formatDate(p.date) : '',
        p.supplier || '',
        p.mode || '',
        p.reference || '',
        p.description || '',
        p.amount ?? 0
    ]));
}

function exportPaymentInCSV() {
    if (!paymentInData.length) {
        alert('No payment in data to export.');
        return;
    }
    const headers = ['Date', 'Customer', 'Mode', 'Reference', 'Description', 'Amount'];
    const rows = getPaymentInExportRows();
    const filename = `payment_in_${new Date().toISOString().split('T')[0]}.csv`;
    downloadCSV(filename, headers, rows);
}

function exportPaymentOutCSV() {
    if (!paymentOutData.length) {
        alert('No payment out data to export.');
        return;
    }
    const headers = ['Date', 'Supplier', 'Mode', 'Reference', 'Description', 'Amount'];
    const rows = getPaymentOutExportRows();
    const filename = `payment_out_${new Date().toISOString().split('T')[0]}.csv`;
    downloadCSV(filename, headers, rows);
}
