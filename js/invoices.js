import { db, remoteConfig } from './firebase-config.js';
import { checkAuth, formatDate } from './dashboard.js';
import { showAlert } from './auth.js';

const invoicesTable = document.getElementById('invoicesTable');
const createInvoiceBtn = document.getElementById('createInvoiceBtn');
const saveInvoiceBtn = document.getElementById('saveInvoiceBtn');
const invoiceSettingsBtn = document.getElementById('invoiceSettingsBtn');
const saveInvoiceSettingsBtn = document.getElementById('saveInvoiceSettingsBtn');
const invoiceModal = document.getElementById('invoiceModal');
const invItemsContainer = document.getElementById('invItemsContainer');
const invAddItemBtn = document.getElementById('invAddItemBtn');
const clearSignatureBtn = document.getElementById('clearSignatureBtn');
const paymentHistoryModal = document.getElementById('paymentHistoryModal');
const savePaymentBtn = document.getElementById('savePaymentBtn');

let inventoryCache = [];
let currentTemplate = 'modern';
let currentPaymentInvoiceId = null;

// Premium Invoice Templates with Preview System
const invoiceTemplates = {
    modern: {
        name: "Modern Clean",
        description: "Minimalist design with blue accents and ample whitespace",
        category: "Professional",
        color: "#2563eb",
        preview: `
            <div class="template-preview-modern">
                <div class="preview-header">
                    <div class="preview-logo">LOGO</div>
                    <div class="preview-title">INVOICE</div>
                </div>
                <div class="preview-content">
                    <div class="preview-grid">
                        <div class="preview-from">
                            <div class="label">From</div>
                            <div class="value">Your Company</div>
                        </div>
                        <div class="preview-to">
                            <div class="label">Bill To</div>
                            <div class="value">Client Name</div>
                        </div>
                    </div>
                    <div class="preview-items">
                        <div class="preview-item">
                            <div>Septic Tank 1000L</div>
                            <div>1</div>
                            <div>₹12,500</div>
                        </div>
                    </div>
                    <div class="preview-total">
                        <div>Total</div>
                        <div>₹12,500</div>
                    </div>
                </div>
            </div>`
    },
    corporate: {
        name: "Corporate Pro",
        description: "Professional dark header with clean layout",
        category: "Business",
        color: "#1e293b",
        preview: `
            <div class="template-preview-corporate">
                <div class="preview-header-dark">
                    <div class="preview-company">YOUR COMPANY</div>
                    <div class="preview-invoice-tag">INVOICE</div>
                </div>
                <div class="preview-content">
                    <div class="preview-client">
                        <div class="label">BILL TO</div>
                        <div class="value">Client Corporation</div>
                    </div>
                    <div class="preview-items-striped">
                        <div class="preview-item">
                            <div>Item</div>
                            <div>Qty</div>
                            <div>Amount</div>
                        </div>
                    </div>
                    <div class="preview-grand-total">
                        <div>GRAND TOTAL</div>
                        <div>₹25,000</div>
                    </div>
                </div>
            </div>`
    },
    elegant: {
        name: "Elegant Serif",
        description: "Classic typography with traditional layout",
        category: "Classic",
        color: "#444",
        preview: `
            <div class="template-preview-elegant">
                <div class="preview-header-elegant">
                    <div class="preview-company-name">Your Company Name</div>
                    <div class="preview-invoice-no">INVOICE #001</div>
                </div>
                <div class="preview-content">
                    <div class="preview-elegant-grid">
                        <div class="preview-from-elegant">
                            <div>Invoiced To:</div>
                            <div class="client-name">Client Name</div>
                        </div>
                        <div class="preview-date-elegant">
                            <div>Date:</div>
                            <div>${new Date().toLocaleDateString()}</div>
                        </div>
                    </div>
                    <div class="preview-table-elegant">
                        <div class="preview-table-header">
                            <div>Description</div>
                            <div>Amount</div>
                        </div>
                        <div class="preview-table-row">
                            <div>Professional Services</div>
                            <div>₹15,000</div>
                        </div>
                    </div>
                    <div class="preview-total-elegant">
                        <div>Total Due:</div>
                        <div>₹15,000</div>
                    </div>
                </div>
            </div>`
    },
    bold: {
        name: "Bold Impact",
        description: "High contrast design with strong visual hierarchy",
        category: "Modern",
        color: "#000000",
        preview: `
            <div class="template-preview-bold">
                <div class="preview-header-bold">
                    <div class="preview-brand">YOUR BRAND</div>
                    <div class="preview-invoice-bold">INVOICE</div>
                </div>
                <div class="preview-content-bold">
                    <div class="preview-client-box">
                        <div class="label-bold">BILL TO</div>
                        <div class="client-bold">CLIENT NAME</div>
                    </div>
                    <div class="preview-items-bold">
                        <div class="preview-item-bold">
                            <div>Item Description</div>
                            <div>₹10,000</div>
                        </div>
                    </div>
                    <div class="preview-total-bold">
                        <div>TOTAL</div>
                        <div>₹10,000</div>
                    </div>
                </div>
            </div>`
    },
    minimal: {
        name: "Minimal",
        description: "Ultra-clean design with focus on content",
        category: "Modern",
        color: "#6b7280",
        preview: `
            <div class="template-preview-minimal">
                <div class="preview-header-minimal">
                    <div class="preview-minimal-title">Invoice</div>
                    <div class="preview-minimal-number">#2024001</div>
                </div>
                <div class="preview-content-minimal">
                    <div class="preview-minimal-info">
                        <div>
                            <div class="label-minimal">From</div>
                            <div>Your Business</div>
                        </div>
                        <div>
                            <div class="label-minimal">To</div>
                            <div>Client</div>
                        </div>
                    </div>
                    <div class="preview-items-minimal">
                        <div class="preview-item-minimal">
                            <div>Service</div>
                            <div>₹8,500</div>
                        </div>
                    </div>
                    <div class="preview-total-minimal">
                        <div>Total</div>
                        <div>₹8,500</div>
                    </div>
                </div>
            </div>`
    },
    luxury: {
        name: "Luxury Gold",
        description: "Premium design with gold accents",
        category: "Premium",
        color: "#b8860b",
        preview: `
            <div class="template-preview-luxury">
                <div class="preview-header-luxury">
                    <div class="preview-luxury-logo">PREMIUM</div>
                    <div class="preview-luxury-title">INVOICE</div>
                </div>
                <div class="preview-content-luxury">
                    <div class="preview-luxury-client">
                        <div class="label-luxury">CLIENT</div>
                        <div class="value-luxury">Premium Client</div>
                    </div>
                    <div class="preview-items-luxury">
                        <div class="preview-item-luxury">
                            <div>Premium Service</div>
                            <div>₹50,000</div>
                        </div>
                    </div>
                    <div class="preview-total-luxury">
                        <div>TOTAL AMOUNT</div>
                        <div>₹50,000</div>
                    </div>
                </div>
            </div>`
    }
};

document.addEventListener('DOMContentLoaded', async () => {
    await checkAuth();
    loadInvoices();
    loadInvoiceSettings();
    setupEventListeners();
    
    window.addEventListener('sectionChanged', (e) => {
        if (e.detail === 'invoices') loadInvoices();
    });
});

function setupEventListeners() {
    if (createInvoiceBtn) {
        createInvoiceBtn.addEventListener('click', openInvoiceModal);
    }

    if (saveInvoiceBtn) {
        saveInvoiceBtn.addEventListener('click', saveInvoice);
    }

    if (invoiceSettingsBtn) {
        invoiceSettingsBtn.addEventListener('click', openInvoiceSettings);
    }

    if (saveInvoiceSettingsBtn) {
        saveInvoiceSettingsBtn.addEventListener('click', saveInvoiceSettings);
    }

    if (invAddItemBtn) {
        invAddItemBtn.addEventListener('click', addInvoiceItemRow);
    }

    if (invItemsContainer) {
        invItemsContainer.addEventListener('change', calculateInvoiceTotal);
        invItemsContainer.addEventListener('input', calculateInvoiceTotal);
        invItemsContainer.addEventListener('click', (e) => {
            if (e.target.closest('.remove-row')) {
                e.target.closest('tr').remove();
                calculateInvoiceTotal();
            }
        });
    }

    if (clearSignatureBtn) {
        clearSignatureBtn.addEventListener('click', clearSignaturePad);
    }
    
    const transportInput = document.getElementById('invTransportCost');
    const paidInput = document.getElementById('invAmountPaid');
    
    if (transportInput && paidInput) {
        transportInput.addEventListener('input', calculateInvoiceTotal);
        paidInput.addEventListener('input', calculateInvoiceTotal);
    }

    setupSignaturePad();

    if (savePaymentBtn) {
        savePaymentBtn.addEventListener('click', savePayment);
    }

    // Filter projects when customer changes
    const custSelect = document.getElementById('invCustomerSelect');
    const projectSelect = document.getElementById('invProjectSelect');
    if (custSelect && projectSelect) {
        custSelect.addEventListener('change', () => {
            const selectedCustomer = custSelect.value;
            Array.from(projectSelect.options).forEach(opt => {
                if (opt.value === "") return;
                const projectCustomer = opt.getAttribute('data-customer');
                opt.hidden = selectedCustomer && projectCustomer && projectCustomer !== selectedCustomer;
            });
            projectSelect.value = "";
        });
    }
}

async function openInvoiceModal() {
    const user = JSON.parse(localStorage.getItem('user'));
    const businessId = user.businessId || user.uid;
    
    document.getElementById('invoiceForm').reset();
    document.getElementById('invDate').valueAsDate = new Date();
    invItemsContainer.innerHTML = '';
    document.getElementById('invGrandTotal').textContent = '₹0.00';
    document.getElementById('invTransportCost').value = '0';
    document.getElementById('invAmountPaid').value = '0';
    document.getElementById('invBalance').textContent = '₹0.00';
    clearSignaturePad();

    // Load Customers
    const custSelect = document.getElementById('invCustomerSelect');
    const vehicleSelect = document.getElementById('invVehicle');
    const projectSelect = document.getElementById('invProjectSelect');
    custSelect.innerHTML = '<option value="">Loading...</option>';
    
    try {
        const [custSnap, invSnap, vehicleSnap, projectSnap] = await Promise.all([
            db.collection('users').doc(businessId).collection('customers').orderBy('name').get(),
            db.collection('users').doc(businessId).collection('inventory').where('category', 'in', ['Finished Goods', 'Septic Tanks', 'PVC Pipes']).get(),
            db.collection('users').doc(businessId).collection('vehicles').get(),
            db.collection('users').doc(businessId).collection('projects').where('status', 'in', ['Pending', 'In Progress']).get()
        ]);

        custSelect.innerHTML = '<option value="">Select Customer...</option>';
        custSnap.forEach(doc => {
            const c = doc.data();
            const balText = c.outstandingBalance < 0 ? ` (Credit: ₹${Math.abs(c.outstandingBalance)})` : '';
            custSelect.innerHTML += `<option value="${c.name}" data-balance="${c.outstandingBalance || 0}">${c.name}${balText}</option>`;
        });
        
        vehicleSelect.innerHTML = '<option value="">Select Vehicle...</option>';
        vehicleSnap.forEach(doc => {
            vehicleSelect.innerHTML += `<option value="${doc.data().name}">${doc.data().name}</option>`;
        });

        projectSelect.innerHTML = '<option value="">Select Project...</option>';
        projectSnap.forEach(doc => {
            const p = doc.data();
            projectSelect.innerHTML += `<option value="${p.name}" data-customer="${p.customerName}">${p.name}</option>`;
        });

        inventoryCache = invSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        
        addInvoiceItemRow(); // Add first row
        new bootstrap.Modal(invoiceModal).show();

    } catch (e) {
        console.error(e);
        alert("Error loading data");
    }
}

function addInvoiceItemRow() {
    const rowId = Date.now();
    const options = inventoryCache.map(i => `<option value="${i.id}" data-price="${i.sellingPrice || 0}" data-cost="${i.costPrice || 0}">${i.name} (Stock: ${i.quantity})</option>`).join('');
    
    const html = `
        <tr>
            <td>
                <select class="form-select form-select-sm item-select" onchange="updateRowPrice(this)">
                    <option value="">Select Item...</option>
                    ${options}
                </select>
            </td>
            <td><input type="number" class="form-control form-control-sm item-qty" value="1" min="1"></td>
            <td><input type="number" class="form-control form-control-sm item-price" value="0"></td>
            <td class="item-total align-middle">₹0.00</td>
            <td class="text-center"><button type="button" class="btn btn-sm btn-outline-danger remove-row"><i class="fas fa-times"></i></button></td>
        </tr>
    `;
    invItemsContainer.insertAdjacentHTML('beforeend', html);
}

// Expose to window for inline onchange
window.updateRowPrice = (select) => {
    const option = select.selectedOptions[0];
    const price = option.dataset.price || 0;
    const row = select.closest('tr');
    row.querySelector('.item-price').value = price;
    calculateInvoiceTotal();
};

function calculateInvoiceTotal() {
    let total = 0;
    const transportCost = parseFloat(document.getElementById('invTransportCost').value) || 0;
    const amountPaid = parseFloat(document.getElementById('invAmountPaid').value) || 0;
    
    document.querySelectorAll('#invItemsContainer tr').forEach(row => {
        const qty = parseFloat(row.querySelector('.item-qty').value) || 0;
        const price = parseFloat(row.querySelector('.item-price').value) || 0;
        const rowTotal = qty * price;
        row.querySelector('.item-total').textContent = `₹${rowTotal.toFixed(2)}`;
        total += rowTotal;
    });
    
    const grandTotal = total + transportCost;
    const balance = grandTotal - amountPaid;
    
    document.getElementById('invGrandTotal').textContent = `₹${grandTotal.toLocaleString(undefined, {minimumFractionDigits: 2})}`;
    document.getElementById('invBalance').textContent = `₹${balance.toLocaleString(undefined, {minimumFractionDigits: 2})}`;
    
    return grandTotal;
}

async function loadInvoices() {
    const user = JSON.parse(localStorage.getItem('user'));
    if (!user || !invoicesTable) return;
    const businessId = user.businessId || user.uid;

    const tbody = invoicesTable.querySelector('tbody');
    tbody.innerHTML = '<tr><td colspan="5" class="text-center">Loading...</td></tr>';

    try {
        const snapshot = await db.collection('users').doc(businessId)
            .collection('transactions')
            .where('type', '==', 'Invoice')
            .orderBy('date', 'desc')
            .get();

        tbody.innerHTML = '';

        if (snapshot.empty) {
            tbody.innerHTML = '<tr><td colspan="5" class="text-center text-muted">No invoices found</td></tr>';
            return;
        }

        snapshot.forEach(doc => {
            const inv = doc.data();
            const escape = (str) => (str || '').replace(/\\/g, '\\\\').replace(/'/g, "\\'").replace(/"/g, '&quot;').replace(/\n/g, '\\n').replace(/\r/g, '');
            const canDelete = user.permissions ? user.permissions.canDelete : true;
            const row = `
                <tr>
                    <td>${formatDate(inv.date)}</td>
                    <td>#${doc.id.substr(0, 6).toUpperCase()}</td>
                    <td>${inv.customer}</td>
                    <td>₹${(inv.amount || 0).toLocaleString()}</td>
                    <td><span class="badge bg-${inv.status === 'Paid' ? 'success' : 'warning'}">${inv.status}</span></td>
                    <td>
                        <button class="btn btn-sm btn-outline-dark" onclick="window.printInvoice('${doc.id}', '${escape(inv.customer)}', ${inv.amount}, '${formatDate(inv.date)}')"><i class="fas fa-print"></i></button>
                        <button class="btn btn-sm btn-outline-info" onclick="window.openPaymentHistory('${doc.id}')" title="Payments"><i class="fas fa-money-bill-wave"></i></button>
                        <button class="btn btn-sm btn-outline-secondary" onclick="window.printDeliveryChallan('${doc.id}')" title="Delivery Challan"><i class="fas fa-truck"></i></button>
                        <button class="btn btn-sm btn-outline-success" onclick="window.sendWhatsApp('${doc.id}', '${escape(inv.customer)}', ${inv.amount}, '${inv.status}')" title="WhatsApp"><i class="fab fa-whatsapp"></i></button>
                        <button class="btn btn-sm btn-outline-primary" onclick="window.sendEmail('${doc.id}', '${escape(inv.customer)}', ${inv.amount}, '${inv.status}')" title="Email"><i class="fas fa-envelope"></i></button>
                        ${canDelete ? `<button class="btn btn-sm btn-outline-danger" onclick="window.deleteInvoice('${doc.id}')"><i class="fas fa-trash"></i></button>` : ''}
                    </td>
                </tr>
            `;
            tbody.innerHTML += row;
        });
    } catch (error) {
        console.error('Error loading invoices:', error);
        tbody.innerHTML = '<tr><td colspan="5" class="text-center text-danger">Error loading data</td></tr>';
    }
}

async function loadInvoiceSettings() {
    const user = JSON.parse(localStorage.getItem('user'));
    const businessId = user.businessId || user.uid;
    try {
        const doc = await db.collection('users').doc(businessId).collection('settings').doc('invoice').get();
        if (doc.exists && doc.data().template) {
            currentTemplate = doc.data().template;
        }
    } catch (e) { console.error(e); }
}

// Enhanced Invoice Settings Modal with Preview
function openInvoiceSettings() {
    const modalEl = document.getElementById('invoiceSettingsModal');
    const container = document.querySelector('#invoiceSettingsModal .modal-body');
    
    // Hide default footer as we have custom actions
    const footer = document.querySelector('#invoiceSettingsModal .modal-footer');
    if(footer) footer.style.display = 'none';
    
    container.innerHTML = `
        <div class="row">
            <div class="col-md-8">
                <div class="template-preview-container mb-4">
                    <div id="liveTemplatePreview" class="template-live-preview"></div>
                </div>
                
                <div class="template-info-card card border-0 shadow-sm">
                    <div class="card-body">
                        <h5 id="templateName" class="card-title mb-1">Modern Clean</h5>
                        <p id="templateDescription" class="text-muted small mb-3">Minimalist design with blue accents and ample whitespace</p>
                        <div class="d-flex align-items-center">
                            <span class="badge bg-primary me-2" id="templateCategory">Professional</span>
                        </div>
                    </div>
                </div>
            </div>
            
            <div class="col-md-4">
                <div class="template-sidebar">
                    <h6 class="mb-3 text-primary">Choose Template</h6>
                    
                    <div class="template-thumbnails" id="templateThumbnails">
                        ${Object.entries(invoiceTemplates).map(([key, template]) => `
                            <div class="template-thumbnail ${key === currentTemplate ? 'active' : ''}" 
                                 data-template="${key}"
                                 onclick="window.selectTemplate('${key}')">
                                <div class="thumbnail-preview">
                                    ${template.preview}
                                </div>
                                <div class="thumbnail-label">
                                    <span class="thumbnail-name">${template.name}</span>
                                    <span class="thumbnail-badge" style="background-color: ${template.color}"></span>
                                </div>
                            </div>
                        `).join('')}
                    </div>
                    
                    <div class="template-actions mt-4">
                        <button class="btn btn-outline-primary w-100 mb-2" onclick="window.previewFullTemplate()">
                            <i class="fas fa-eye me-2"></i>Full Preview
                        </button>
                        <button class="btn btn-primary w-100" id="applyTemplateBtn">
                            <i class="fas fa-check me-2"></i>Apply Template
                        </button>
                    </div>
                    
                    <input type="hidden" id="selectedTemplate" value="${currentTemplate}">
                </div>
            </div>
        </div>
    `;
    
    // Initialize preview
    updateTemplatePreview(currentTemplate);
    
    // Attach listener to new button
    document.getElementById('applyTemplateBtn').addEventListener('click', saveInvoiceSettings);
    
    new bootstrap.Modal(modalEl).show();
}

function updateTemplatePreview(templateKey) {
    const template = invoiceTemplates[templateKey];
    const previewContainer = document.getElementById('liveTemplatePreview');
    const templateName = document.getElementById('templateName');
    const templateDescription = document.getElementById('templateDescription');
    const templateCategory = document.getElementById('templateCategory');
    
    if (!template) return;
    
    // Update info
    templateName.textContent = template.name;
    templateDescription.textContent = template.description;
    templateCategory.textContent = template.category;
    templateCategory.style.backgroundColor = template.color;
    
    // Update preview
    previewContainer.innerHTML = template.preview;
    previewContainer.className = `template-live-preview preview-${templateKey}`;
    
    // Update active thumbnail
    document.querySelectorAll('.template-thumbnail').forEach(thumb => {
        thumb.classList.remove('active');
        if (thumb.dataset.template === templateKey) {
            thumb.classList.add('active');
        }
    });
    
    // Update hidden input
    document.getElementById('selectedTemplate').value = templateKey;
}

window.selectTemplate = (templateKey) => {
    updateTemplatePreview(templateKey);
};

window.previewFullTemplate = () => {
    const templateKey = document.getElementById('selectedTemplate').value;
    
    // Create dummy data for preview
    const dummyData = {
        id: 'INV-001',
        dateStr: new Date().toLocaleDateString(),
        company: { 
            companyName: 'Your Company Name', 
            address: '123 Business Street', 
            city: 'City', 
            zip: '12345', 
            phone: '555-0123', 
            email: 'info@example.com' 
        },
        customer: 'Client Name',
        items: [
            { name: 'Professional Service', quantity: 1, price: 5000 },
            { name: 'Product Item', quantity: 2, price: 2500 }
        ],
        amount: 10000,
        logoHtml: '<div style="font-weight:bold; font-size:24px; color:#555;">LOGO</div>',
        signatureHtml: '',
        customerSignatureHtml: '',
        project: 'Project Alpha',
        status: 'Pending'
    };
    
    const templateHTML = getInvoiceTemplate(templateKey, dummyData);
    const printWindow = window.open('', '_blank');
    printWindow.document.write(templateHTML);
};

async function saveInvoiceSettings() {
    const user = JSON.parse(localStorage.getItem('user'));
    const businessId = user.businessId || user.uid;
    const tpl = document.getElementById('selectedTemplate').value;
    
    try {
        await db.collection('users').doc(businessId).collection('settings').doc('invoice').set({ template: tpl }, { merge: true });
        currentTemplate = tpl;
        bootstrap.Modal.getInstance(document.getElementById('invoiceSettingsModal')).hide();
        showAlert('success', 'Invoice template saved');
    } catch (e) { console.error(e); }
}

async function saveInvoice() {
    const user = JSON.parse(localStorage.getItem('user'));
    const businessId = user.businessId || user.uid;
    const customer = document.getElementById('invCustomerSelect').value;
    const dateVal = document.getElementById('invDate').value;
    const amount = calculateInvoiceTotal();
    const transportCost = parseFloat(document.getElementById('invTransportCost').value) || 0;
    const amountPaid = parseFloat(document.getElementById('invAmountPaid').value) || 0;
    const vehicle = document.getElementById('invVehicle').value;
    const driver = document.getElementById('invDriver').value;
    const project = document.getElementById('invProjectSelect').value;
    const balance = amount - amountPaid;

    if (!customer || amount <= 0) {
        alert('Please fill in all fields correctly');
        return;
    }

    // Gather Items & Calculate Profit
    const items = [];
    let totalCostPrice = 0;
    
    document.querySelectorAll('#invItemsContainer tr').forEach(row => {
        const select = row.querySelector('.item-select');
        if (select.value) {
            const option = select.selectedOptions[0];
            const costPrice = parseFloat(option.dataset.cost) || 0;
            const qty = parseFloat(row.querySelector('.item-qty').value);
            
            items.push({
                itemId: select.value,
                name: option.text.split(' (')[0],
                quantity: qty,
                price: parseFloat(row.querySelector('.item-price').value),
                costPrice: costPrice
            });
            
            totalCostPrice += (costPrice * qty);
        }
    });
    
    // Profit Calculation
    // Revenue = Amount (includes transport)
    // Cost = Material Cost + Transport Cost
    // Net Profit = (Item Revenue - Item Cost) + (Transport Revenue - Transport Cost)
    // Assuming Transport Cost input is what we charge or what we pay? 
    // Usually "Transport Cost" in invoice is what we charge customer. 
    // Real transport cost comes from Vehicle Expenses. 
    // For "Profit per piece", we use (Selling Price - Cost Price).
    
    const grossProfit = items.reduce((sum, item) => sum + ((item.price - item.costPrice) * item.quantity), 0);
    // We assume the transport cost added to invoice is revenue, and we don't deduct it here unless we have a specific "Actual Transport Cost" field.
    // For simplicity, let's treat the added transport cost as revenue offset by actual vehicle expenses elsewhere.
    // So Profit = Gross Profit from items.

    const saveBtn = document.getElementById('saveInvoiceBtn');
    const originalText = saveBtn.innerHTML;
    saveBtn.disabled = true;
    saveBtn.innerHTML = '<span class="spinner-border spinner-border-sm"></span> Saving...';

    // Handle Signature Upload
    let customerSignatureUrl = null;
    if (!isSignatureEmpty()) {
        try {
            const canvas = document.getElementById('signaturePad');
            const blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/png'));
            const file = new File([blob], 'signature.png', { type: 'image/png' });
            
            const apiKey = await getImgBBApiKey(businessId);
            if (apiKey) {
                customerSignatureUrl = await uploadToImgBB(file, apiKey);
            }
        } catch (e) { console.error("Signature upload failed", e); }
    }

    try {
        // Create Invoice Transaction
        await db.collection('users').doc(businessId).collection('transactions').add({
            type: 'Invoice',
            customer: customer,
            amount: amount,
            amountPaid: amountPaid,
            balance: balance,
            transportCost: transportCost,
            project: project,
            vehicle: vehicle,
            driver: driver,
            items: items,
            profit: grossProfit,
            status: balance <= 0 ? 'Paid' : (amountPaid > 0 ? 'Partial' : 'Pending'),
            description: `Invoice for ${customer}`,
            date: new Date(dateVal),
            createdAt: new Date(),
            customerSignature: customerSignatureUrl
        });

        // Update Customer Balance & Stats
        const customersRef = db.collection('users').doc(businessId).collection('customers');
        const custSnapshot = await customersRef.where('name', '==', customer).get();
        
        if (!custSnapshot.empty) {
            const custDoc = custSnapshot.docs[0];
            const currentSpent = custDoc.data().totalSpent || 0;
            const currentBalance = custDoc.data().outstandingBalance || 0;
            
            await customersRef.doc(custDoc.id).update({
                totalSpent: currentSpent + amount,
                outstandingBalance: currentBalance + balance,
                lastContact: new Date()
            });
        }
        
        // Deduct Stock (Optional - usually done via Delivery Challan, but for simple flow we do it here)
        const batch = db.batch();
        items.forEach(item => {
            const itemRef = db.collection('users').doc(businessId).collection('inventory').doc(item.itemId);
            // We need to read first to decrement safely, but for speed in this snippet we assume sufficient stock or use increment(-qty)
            // Firestore increment is safer
            batch.update(itemRef, { quantity: firebase.firestore.FieldValue.increment(-item.quantity) });
        });
        await batch.commit();
        
        bootstrap.Modal.getInstance(invoiceModal).hide();
        showAlert('success', 'Invoice created successfully');
        loadInvoices();
    } catch (error) {
        console.error('Error creating invoice:', error);
        showAlert('danger', 'Failed to create invoice');
    } finally {
        saveBtn.disabled = false;
        saveBtn.innerHTML = originalText;
    }
}

window.deleteInvoice = async (id) => {
    window.showConfirm('Delete Invoice', 'Delete this invoice?', async () => {
        const user = JSON.parse(localStorage.getItem('user'));
        if (user.permissions && user.permissions.canDelete === false) {
            return showAlert('danger', 'You do not have permission to delete items.');
        }

        const businessId = user.businessId || user.uid;
        try {
            await db.collection('users').doc(businessId).collection('transactions').doc(id).delete();
            showAlert('success', 'Invoice deleted');
            loadInvoices();
        } catch(e) { console.error(e); showAlert('danger', 'Failed to delete invoice'); }
    });
};

window.openPaymentHistory = async (id) => {
    currentPaymentInvoiceId = id;
    const user = JSON.parse(localStorage.getItem('user'));
    const businessId = user.businessId || user.uid;
    
    const tbody = document.querySelector('#paymentHistoryTable tbody');
    tbody.innerHTML = '<tr><td colspan="4" class="text-center">Loading...</td></tr>';
    document.getElementById('phInvoiceNo').textContent = '';
    document.getElementById('phBalance').textContent = '';
    document.getElementById('paymentForm').reset();
    document.getElementById('payDate').valueAsDate = new Date();
    
    new bootstrap.Modal(paymentHistoryModal).show();

    try {
        const doc = await db.collection('users').doc(businessId).collection('transactions').doc(id).get();
        if (!doc.exists) return;
        
        const inv = doc.data();
        document.getElementById('phInvoiceNo').textContent = `#${id.substr(0,6).toUpperCase()}`;
        document.getElementById('phBalance').textContent = `₹${(inv.balance || 0).toLocaleString()}`;
        
        tbody.innerHTML = '';
        const payments = inv.payments || [];
        
        // Also include initial payment if any
        if (payments.length === 0 && inv.amountPaid > 0) {
            // Legacy support for invoices created before payment tracking
            tbody.innerHTML += `
                <tr class="table-light text-muted">
                    <td>${formatDate(inv.date)}</td>
                    <td>Initial</td>
                    <td>-</td>
                    <td class="text-end">₹${inv.amountPaid.toLocaleString()}</td>
                </tr>
            `;
        }

        payments.forEach(p => {
            tbody.innerHTML += `
                <tr>
                    <td>${formatDate(p.date)}</td>
                    <td>${p.mode}</td>
                    <td>${p.reference || '-'}</td>
                    <td class="text-end fw-bold text-success">₹${p.amount.toLocaleString()}</td>
                </tr>
            `;
        });
        
        if (tbody.innerHTML === '') {
            tbody.innerHTML = '<tr><td colspan="4" class="text-center text-muted">No payments recorded</td></tr>';
        }
    } catch(e) { console.error(e); }
};

async function savePayment() {
    if (!currentPaymentInvoiceId) return;
    const user = JSON.parse(localStorage.getItem('user'));
    const businessId = user.businessId || user.uid;
    
    const amount = parseFloat(document.getElementById('payAmount').value);
    const date = document.getElementById('payDate').value;
    const mode = document.getElementById('payMode').value;
    const ref = document.getElementById('payRef').value;

    if (!amount || amount <= 0 || !date) return alert("Invalid amount or date");

    const btn = document.getElementById('savePaymentBtn');
    const originalText = btn.innerHTML;
    btn.disabled = true;
    btn.innerHTML = '<span class="spinner-border spinner-border-sm"></span> Saving...';

    try {
        await db.runTransaction(async (transaction) => {
            const invRef = db.collection('users').doc(businessId).collection('transactions').doc(currentPaymentInvoiceId);
            const invDoc = await transaction.get(invRef);
            if (!invDoc.exists) throw "Invoice not found";
            
            const inv = invDoc.data();
            const newAmountPaid = (inv.amountPaid || 0) + amount;
            const newBalance = (inv.amount || 0) - newAmountPaid;
            const newStatus = newBalance <= 0 ? 'Paid' : 'Partial';
            
            const paymentObj = { amount, date: new Date(date), mode, reference: ref, createdAt: new Date() };
            const payments = inv.payments || [];
            payments.push(paymentObj);

            transaction.update(invRef, {
                amountPaid: newAmountPaid,
                balance: newBalance,
                status: newStatus,
                payments: payments
            });

            // Update Customer Balance
            // Note: We don't update customer doc here inside transaction for simplicity as it requires querying by name.
            // Ideally customer ID should be stored on invoice. 
            // We will do a separate update for customer balance outside transaction or assume eventual consistency.
        });

        // Update Customer Balance (Separate Op)
        const invDoc = await db.collection('users').doc(businessId).collection('transactions').doc(currentPaymentInvoiceId).get();
        const inv = invDoc.data();
        const customersRef = db.collection('users').doc(businessId).collection('customers');
        const custSnap = await customersRef.where('name', '==', inv.customer).limit(1).get();
        if (!custSnap.empty) {
            const custDoc = custSnap.docs[0];
            const currentBal = custDoc.data().outstandingBalance || 0;
            await customersRef.doc(custDoc.id).update({
                outstandingBalance: currentBal - amount,
                lastContact: new Date()
            });
        }

        // Add Payment Transaction Record for Ledger
        await db.collection('users').doc(businessId).collection('transactions').add({
            type: 'Payment',
            description: `Payment for Inv #${currentPaymentInvoiceId.substr(0,6).toUpperCase()}`,
            customer: inv.customer,
            amount: amount,
            date: new Date(date),
            mode: mode,
            reference: ref,
            invoiceId: currentPaymentInvoiceId,
            status: 'Paid',
            createdAt: new Date()
        });

        showAlert('success', 'Payment recorded');
        window.openPaymentHistory(currentPaymentInvoiceId); // Refresh modal
        loadInvoices(); // Refresh list
    } catch (e) {
        console.error(e);
        showAlert('danger', 'Failed to record payment');
    } finally {
        btn.disabled = false;
        btn.innerHTML = originalText;
    }
}

// Premium Invoice Print Function
window.printInvoice = async (id, customer, amount, dateStr) => {
    const user = JSON.parse(localStorage.getItem('user'));
    const businessId = user.businessId || user.uid;
    // Fetch company settings for the header
    let company = { companyName: 'My Company', address: '', phone: '', email: '' };
    try {
        const doc = await db.collection('users').doc(businessId).collection('settings').doc('business').get();
        if (doc.exists) company = doc.data();
    } catch(e) {}

    // Fetch Invoice Items if available
    let itemsHtml = '';
    let itemsData = [{name: 'Septic Tank / Pipe Supply', quantity: 1, price: amount}];
    let invoiceData = {};
    try {
        const invDoc = await db.collection('users').doc(businessId).collection('transactions').doc(id).get();
        if (invDoc.exists) {
            invoiceData = invDoc.data();
            if (invoiceData.items) itemsData = invoiceData.items;
        }
        const items = itemsData;
        itemsHtml = items.map(i => `
            <tr><td>${i.name}</td><td>${i.quantity}</td><td style="text-align:right">₹${i.price}</td><td style="text-align:right">₹${i.quantity * i.price}</td></tr>
        `).join('');
    } catch(e) {}

    // Logo & Signature HTML
    const logoHtml = company.logoUrl 
        ? `<img src="${company.logoUrl}" style="max-height: 80px; max-width: 200px; margin-bottom: 10px;">` 
        : '<div class="invoice-title">INVOICE</div>';
        
    const signatureHtml = company.signatureUrl
        ? `<div style="text-align: right; margin-top: 30px;"><img src="${company.signatureUrl}" style="max-height: 60px; max-width: 150px;"><br><small>Authorized Signature</small></div>`
        : `<div style="text-align: right; margin-top: 60px; border-top: 1px solid #ccc; display: inline-block; padding-top: 5px; width: 200px;">Authorized Signature</div>`;

    const customerSignatureHtml = invoiceData.customerSignature
        ? `<div style="text-align: left; margin-top: 30px;"><img src="${invoiceData.customerSignature}" style="max-height: 60px; max-width: 150px;"><br><small>Receiver's Signature</small></div>`
        : '';

    const templateHTML = getInvoiceTemplate(currentTemplate, {
        id, dateStr, company, customer, items: itemsData, amount, logoHtml, signatureHtml, customerSignatureHtml, project: invoiceData.project, status: invoiceData.status, balance: invoiceData.balance
    });
    const printWindow = window.open('', '_blank');
    printWindow.document.write(templateHTML);
    
    // Ensure images load before printing
    printWindow.onload = function() {
        setTimeout(() => {
            printWindow.focus();
            printWindow.print();
        }, 500);
    };
};

function getInvoiceTemplate(type, data) {
    const { id, dateStr, company, customer, items, amount, logoHtml, signatureHtml, customerSignatureHtml, project, status } = data;
    
    const itemsRows = items.map(i => `
        <tr>
            <td>${i.name}</td>
            <td style="text-align:center">${i.quantity}</td>
            <td style="text-align:right">₹${(i.price || 0).toLocaleString()}</td>
            <td style="text-align:right">₹${((i.price || 0) * (i.quantity || 0)).toLocaleString()}</td>
        </tr>
    `).join('');

    // UPI QR Code Generation
    let qrCodeHtml = '';
    if (company && company.upiId) {
        const upiString = `upi://pay?pa=${company.upiId}&pn=${encodeURIComponent(company.companyName || 'Merchant')}&am=${amount}&cu=INR`;
        const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${encodeURIComponent(upiString)}`;
        qrCodeHtml = `
            <div class="qr-code-box" style="text-align: center; margin: 0 20px;">
                <img src="${qrUrl}" alt="UPI QR" style="width: 90px; height: 90px; border: 1px solid #eee; padding: 4px;">
                <div style="font-size: 10px; margin-top: 4px; color: #555; font-weight: 500;">Scan to Pay</div>
            </div>`;
    }

    const commonCSS = `
        @page { size: A4; margin: 0; }
        body { margin: 0; padding: 0; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
        .page-container { width: 210mm; min-height: 297mm; margin: 0 auto; background: white; padding: 40px; box-sizing: border-box; position: relative; }
        .footer { position: absolute; bottom: 40px; left: 40px; right: 40px; text-align: center; font-size: 12px; color: #aaa; border-top: 1px solid #eee; padding-top: 20px; }
        .signatures { display: flex; justify-content: space-between; align-items: flex-end; margin-top: 60px; page-break-inside: avoid; }
        .qr-code { text-align: center; margin-top: 30px; border: 1px dashed #ccc; padding: 10px; width: 120px; margin-left: auto; }
    `;

    // --- TEMPLATE 1: MODERN CLEAN ---
    if (type === 'modern') {
        return `
    <html>
    <head>
        <title>Invoice #${id.substr(0,6).toUpperCase()}</title>
        <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;600;700&display=swap" rel="stylesheet">
        <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css">
        <style>
            ${commonCSS}
            body { font-family: 'Inter', sans-serif; color: #1f2937; line-height: 1.5; }
            .header { display: flex; justify-content: space-between; margin-bottom: 40px; padding-bottom: 20px; border-bottom: 1px solid #e5e7eb; }
            .company-name { font-size: 22px; font-weight: 700; color: #111827; margin-top: 10px; }
            .invoice-title { font-size: 32px; font-weight: 800; color: #2563eb; text-transform: uppercase; letter-spacing: -0.5px; text-align: right; }
            .invoice-meta { text-align: right; margin-top: 5px; color: #6b7280; font-size: 14px; }
            .invoice-meta strong { color: #374151; }
            
            .bill-grid { display: flex; justify-content: space-between; margin-bottom: 40px; gap: 40px; }
            .bill-col { flex: 1; }
            .bill-label { font-size: 11px; text-transform: uppercase; letter-spacing: 1px; color: #9ca3af; font-weight: 600; margin-bottom: 8px; }
            .bill-name { font-size: 16px; font-weight: 600; color: #111827; margin-bottom: 4px; }
            .bill-address { font-size: 14px; color: #4b5563; white-space: pre-line; }
            
            .items-table { width: 100%; border-collapse: collapse; margin-bottom: 30px; }
            .items-table th { background-color: #f9fafb; color: #374151; font-weight: 600; font-size: 12px; text-transform: uppercase; letter-spacing: 0.5px; padding: 12px 16px; text-align: left; border-bottom: 1px solid #e5e7eb; }
            .items-table td { padding: 16px; border-bottom: 1px solid #f3f4f6; font-size: 14px; color: #4b5563; }
            .items-table tr:last-child td { border-bottom: none; }
            
            .total-section { display: flex; justify-content: flex-end; }
            .total-box { width: 300px; }
            .total-row { display: flex; justify-content: space-between; padding: 8px 0; font-size: 14px; color: #4b5563; }
            .grand-total { font-size: 20px; font-weight: 700; color: #2563eb; border-top: 2px solid #e5e7eb; padding-top: 12px; margin-top: 8px; }
            
            .status-badge { display: inline-block; padding: 6px 12px; border-radius: 6px; font-size: 12px; font-weight: 600; text-transform: uppercase; margin-top: 10px; }
            .status-paid { background: #dcfce7; color: #166534; border: 1px solid #bbf7d0; }
            .status-pending { background: #fef9c3; color: #854d0e; border: 1px solid #fde047; }
        </style>
    </head>
    <body>
        <div class="page-container">
            <div class="header">
                <div>
                    ${logoHtml}
                    <div class="company-name">${company.companyName || 'PipePro Business'}</div>
                </div>
                <div>
                    <div class="invoice-title">Invoice</div>
                    <div class="invoice-meta">#${id.substr(0,6).toUpperCase()}</div>
                    <div class="invoice-meta">Date: <strong>${dateStr}</strong></div>
                    ${status ? `<div style="text-align: right;"><span class="status-badge ${status === 'Paid' ? 'status-paid' : 'status-pending'}">${status}</span></div>` : ''}
                </div>
            </div>

            <div class="bill-grid">
                <div class="bill-col">
                    <div class="bill-label">From</div>
                    <div class="bill-name">${company.companyName || 'PipePro Business'}</div>
                    <div class="bill-address">
                        ${company.address || ''}
                        ${company.city ? `<br>${company.city} ${company.zip || ''}` : ''}
                        ${company.phone ? `<br>Phone: ${company.phone}` : ''}
                        ${company.email ? `<br>Email: ${company.email}` : ''}
                    </div>
                </div>
                <div class="bill-col" style="text-align: right;">
                    <div class="bill-label">Bill To</div>
                    <div class="bill-name">${customer}</div>
                    <div class="bill-address">
                        ${project ? `Project: ${project}` : ''}
                    </div>
                </div>
            </div>

            <table class="items-table">
                <thead>
                    <tr>
                        <th style="width: 50%">Description</th>
                        <th style="width: 15%; text-align: center;">Qty</th>
                        <th style="width: 15%; text-align: right;">Price</th>
                        <th style="width: 20%; text-align: right;">Amount</th>
                    </tr>
                </thead>
                <tbody>
                    ${itemsRows}
                </tbody>
            </table>

            <div class="total-section">
                ${qrCodeHtml}
                <div class="total-box">
                    <div class="total-row">
                        <span>Subtotal</span>
                        <span>₹${amount.toLocaleString()}</span>
                    </div>
                    <div class="total-row grand-total">
                        <span>Total</span>
                        <span>₹${amount.toLocaleString()}</span>
                    </div>
                </div>
            </div>

            <div class="signatures">
                ${customerSignatureHtml}
                ${signatureHtml}
            </div>

            <div class="footer">
                Thank you for your business!
            </div>
        </div>
    </body>
    </html>`;
    }

    // --- TEMPLATE 2: CORPORATE PRO ---
    if (type === 'corporate') {
        return `
    <html>
    <head>
        <title>Invoice #${id.substr(0,6).toUpperCase()}</title>
        <link href="https://fonts.googleapis.com/css2?family=Roboto:wght@400;500;700&display=swap" rel="stylesheet">
        <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css">
        <style>
            ${commonCSS}
            body { font-family: 'Roboto', sans-serif; color: #222; }
            .header-bg { background: #1e293b; color: white; padding: 40px; margin: -40px -40px 40px -40px; display: flex; justify-content: space-between; align-items: center; }
            .company-name { font-size: 28px; font-weight: 700; margin-bottom: 5px; letter-spacing: 0.5px; }
            .items-table { width: 100%; border-collapse: collapse; margin-bottom: 30px; }
            .items-table th { background: #f1f5f9; color: #334155; font-weight: 700; padding: 12px; text-align: left; border-bottom: 2px solid #cbd5e1; text-transform: uppercase; font-size: 12px; }
            .items-table td { padding: 12px; border-bottom: 1px solid #ecf0f1; }
            .items-table tr:nth-child(even) { background-color: #f9f9f9; }
            .total-amount { font-size: 24px; font-weight: 700; color: #1e293b; }
            .bill-to-label { color: #64748b; text-transform: uppercase; font-size: 11px; font-weight: 700; letter-spacing: 1px; margin-bottom: 5px; }
        </style>
    </head>
    <body>
        <div class="page-container">
            <div class="header-bg">
                <div>
                    ${logoHtml ? `<div style="background:white; padding:8px; border-radius:4px; display:inline-block; margin-bottom: 10px;">${logoHtml}</div>` : ''}
                    <div class="company-name">${company.companyName || 'PipePro Business'}</div>
                    <div style="font-size: 13px; opacity: 0.8; line-height: 1.4;">
                        ${company.address || ''}<br>
                        ${company.city || ''} ${company.zip || ''}<br>
                        ${company.phone || ''}
                    </div>
                </div>
                <div style="text-align: right;">
                    <h1 style="margin: 0; font-size: 42px; font-weight: 300; letter-spacing: 2px;">INVOICE</h1>
                    <div style="font-size: 18px; opacity: 0.9; margin-top: 5px;">#${id.substr(0,6).toUpperCase()}</div>
                </div>
            </div>

            <div style="margin-bottom: 40px; display: flex; justify-content: space-between;">
                <div>
                    <div class="bill-to-label">Bill To</div>
                    <div style="font-size: 16px; font-weight: 500;">${customer}</div>
                    ${project ? `<div style="font-size: 14px; color: #555;">Project: ${project}</div>` : ''}
                </div>
                <div style="text-align: right;">
                    <div class="bill-to-label">Date</div>
                    <div style="font-size: 16px; font-weight: 500;">${dateStr}</div>
                    ${status ? `<div style="margin-top: 5px;"><span style="background: #e2e8f0; color: #334155; padding: 4px 8px; border-radius: 4px; font-size: 12px; font-weight: bold; text-transform: uppercase;">${status}</span></div>` : ''}
                </div>
            </div>

            <table class="items-table">
                <thead>
                    <tr>
                        <th>Description</th>
                        <th style="text-align: center;">Qty</th>
                        <th style="text-align: right;">Price</th>
                        <th style="text-align: right;">Total</th>
                    </tr>
                </thead>
                <tbody>
                    ${itemsRows}
                </tbody>
            </table>

            <div style="display: flex; justify-content: flex-end; align-items: center; margin-top: 20px;">
                ${qrCodeHtml}
                <div style="text-align: right;">
                    <span style="font-size: 16px; margin-right: 20px;">Grand Total:</span>
                    <span class="total-amount">₹${amount.toLocaleString()}</span>
                </div>
            </div>

            <div class="signatures">
                ${customerSignatureHtml}
                ${signatureHtml}
            </div>

            <div class="footer">
                Thank you for your business!
            </div>
        </div>
    </body>
    </html>`;
    }

    // --- TEMPLATE 3: ELEGANT SERIF ---
    if (type === 'elegant') {
        return `
    <html>
    <head>
        <title>Invoice #${id.substr(0,6).toUpperCase()}</title>
        <link href="https://fonts.googleapis.com/css2?family=Playfair+Display:wght@400;700&family=Lato:wght@300;400&display=swap" rel="stylesheet">
        <style>
            ${commonCSS}
            body { font-family: 'Lato', sans-serif; color: #444; }
            h1, h2, h3, .company-name { font-family: 'Playfair Display', serif; }
            .page-container { border: 1px solid #ddd; padding: 60px; }
            .header { text-align: center; margin-bottom: 60px; border-bottom: 1px double #ccc; padding-bottom: 30px; }
            .company-name { font-size: 32px; color: #222; margin-bottom: 10px; }
            .items-table th { border-top: 1px solid #444; border-bottom: 1px solid #444; padding: 10px; text-transform: uppercase; font-size: 12px; letter-spacing: 1px; }
            .items-table td { padding: 15px 10px; }
            .total-amount { font-family: 'Playfair Display', serif; font-size: 24px; font-weight: 700; }
        </style>
    </head>
    <body>
        <div class="page-container">
            <div class="header">
                ${logoHtml}
                <div class="company-name">${company.companyName || 'PipePro Business'}</div>
                <div style="font-size: 12px; letter-spacing: 1px; text-transform: uppercase;">${company.city || ''} | ${company.phone || ''}</div>
            </div>

            <div style="display: flex; justify-content: space-between; margin-bottom: 40px;">
                <div>
                    <div style="font-size: 11px; text-transform: uppercase; color: #888;">Invoiced To</div>
                    <div style="font-size: 18px; margin-top: 5px;">${customer}</div>
                    ${project ? `<div style="font-size: 14px; color: #666; margin-top: 2px;">Project: ${project}</div>` : ''}
                </div>
                <div style="text-align: right;">
                    <div style="font-size: 11px; text-transform: uppercase; color: #888;">Invoice No.</div>
                    <div style="font-size: 18px; margin-top: 5px;">#${id.substr(0,6).toUpperCase()}</div>
                    <div style="font-size: 14px; color: #666; margin-top: 2px;">${dateStr}</div>
                </div>
            </div>

            <table class="items-table">
                <thead>
                    <tr>
                        <th>Description</th>
                        <th style="text-align: center;">Qty</th>
                        <th style="text-align: right;">Price</th>
                        <th style="text-align: right;">Amount</th>
                    </tr>
                </thead>
                <tbody>
                    ${itemsRows}
                </tbody>
            </table>

            <div style="display: flex; justify-content: flex-end; align-items: center; margin-top: 30px; border-top: 1px solid #eee; padding-top: 20px;">
                ${qrCodeHtml}
                <div style="text-align: right;">
                    <span style="margin-right: 20px; font-size: 14px; text-transform: uppercase; letter-spacing: 1px;">Total Due</span>
                    <span class="total-amount">₹${amount.toLocaleString()}</span>
                </div>
            </div>

            <div class="signatures">
                ${customerSignatureHtml}
                ${signatureHtml}
            </div>
        </div>
    </body>
    </html>`;
    }

    // --- TEMPLATE 4: MINIMAL ---
    if (type === 'minimal') {
        return `
    <html>
    <head>
        <title>Invoice #${id.substr(0,6).toUpperCase()}</title>
        <link href="https://fonts.googleapis.com/css2?family=Open+Sans:wght@300;400;600&display=swap" rel="stylesheet">
        <style>
            ${commonCSS}
            body { font-family: 'Open Sans', sans-serif; color: #4a5568; }
            .header { padding-bottom: 20px; border-bottom: 1px solid #e2e8f0; margin-bottom: 40px; display: flex; justify-content: space-between; }
            .invoice-title { font-size: 32px; font-weight: 300; color: #2d3748; letter-spacing: 2px; }
            .invoice-number { color: #718096; margin-top: 5px; }
            .meta-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 40px; margin-bottom: 40px; }
            .label { font-size: 11px; text-transform: uppercase; color: #a0aec0; font-weight: 600; margin-bottom: 4px; }
            .value { font-size: 15px; color: #2d3748; }
            .items-table { width: 100%; border-collapse: collapse; margin-bottom: 30px; }
            .items-table th { text-align: left; padding: 12px 0; border-bottom: 1px solid #e2e8f0; font-weight: 600; color: #718096; font-size: 12px; text-transform: uppercase; }
            .items-table td { padding: 16px 0; border-bottom: 1px solid #edf2f7; }
            .total-section { display: flex; justify-content: flex-end; margin-top: 20px; }
            .total-row { display: flex; justify-content: space-between; width: 250px; padding: 10px 0; font-size: 18px; font-weight: 600; color: #2d3748; }
        </style>
    </head>
    <body>
        <div class="page-container">
            <div class="header">
                <div>
                    <div class="invoice-title">Invoice</div>
                    <div class="invoice-number">#${id.substr(0,6).toUpperCase()}</div>
                </div>
                <div style="text-align: right;">
                    ${logoHtml}
                </div>
            </div>
            
            <div class="meta-grid">
                <div>
                    <div class="label">From</div>
                    <div class="value">${company.companyName || 'PipePro'}</div>
                    <div style="font-size: 13px; margin-top: 5px;">${company.address || ''}</div>
                </div>
                <div>
                    <div class="label">To</div>
                    <div class="value">${customer}</div>
                    <div class="label" style="margin-top: 15px;">Date</div>
                    <div class="value">${dateStr}</div>
                </div>
            </div>
            
            <table class="items-table">
                <thead>
                    <tr><th>Item</th><th style="text-align:center">Qty</th><th style="text-align:right">Price</th><th style="text-align:right">Total</th></tr>
                </thead>
                <tbody>${itemsRows}</tbody>
            </table>
            
            <div class="total-section">
                ${qrCodeHtml}
                <div class="total-row">
                    <span>Total</span>
                    <span>₹${amount.toLocaleString()}</span>
                </div>
            </div>
            
            <div class="signatures">${customerSignatureHtml}${signatureHtml}</div>
        </div>
    </body>
    </html>`;
    }

    // --- TEMPLATE 5: LUXURY ---
    if (type === 'luxury') {
        return `
    <html>
    <head>
        <title>Invoice #${id.substr(0,6).toUpperCase()}</title>
        <link href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond:wght@400;600;700&display=swap" rel="stylesheet">
        <style>
            ${commonCSS}
            body { font-family: 'Cormorant Garamond', serif; color: #333; }
            .header { background: linear-gradient(135deg, #1a1a1a 0%, #333 100%); color: #b8860b; padding: 40px; text-align: center; margin: -40px -40px 40px -40px; }
            .company-name { font-size: 36px; font-weight: 300; letter-spacing: 3px; text-transform: uppercase; }
            .invoice-label { font-size: 14px; letter-spacing: 3px; opacity: 0.8; margin-bottom: 5px; text-transform: uppercase; }
            .client-section { text-align: center; margin-bottom: 40px; padding-bottom: 20px; border-bottom: 1px solid #f0f0f0; }
            .label { font-size: 12px; letter-spacing: 2px; color: #b8860b; text-transform: uppercase; margin-bottom: 5px; }
            .value { font-size: 24px; font-weight: 600; }
            .items-table { width: 100%; border-collapse: collapse; margin-bottom: 30px; }
            .items-table th { text-align: left; padding: 15px; border-bottom: 1px solid #b8860b; color: #b8860b; font-weight: 600; text-transform: uppercase; letter-spacing: 1px; font-size: 12px; }
            .items-table td { padding: 20px 15px; border-bottom: 1px solid #f0f0f0; font-size: 18px; }
            .total-section { background: #fafafa; padding: 30px; display: flex; justify-content: space-between; align-items: center; margin: 0 -40px; }
            .total-label { font-size: 14px; letter-spacing: 2px; color: #b8860b; text-transform: uppercase; }
            .total-amount { font-size: 32px; font-weight: 700; color: #b8860b; }
        </style>
    </head>
    <body>
        <div class="page-container">
            <div class="header">
                <div class="invoice-label">INVOICE #${id.substr(0,6).toUpperCase()}</div>
                <div class="company-name">${company.companyName || 'PipePro'}</div>
            </div>
            
            <div class="client-section">
                <div class="label">BILLED TO</div>
                <div class="value">${customer}</div>
                <div style="margin-top: 10px; font-size: 16px; color: #666;">${dateStr}</div>
            </div>
            
            <table class="items-table">
                <thead>
                    <tr><th>Description</th><th style="text-align:center">Qty</th><th style="text-align:right">Price</th><th style="text-align:right">Total</th></tr>
                </thead>
                <tbody>${itemsRows}</tbody>
            </table>
            
            <div class="total-section">
                ${qrCodeHtml}
                <div class="total-label">Total Amount</div>
                <div class="total-amount">₹${amount.toLocaleString()}</div>
            </div>
            
            <div class="signatures" style="padding: 0 40px;">${customerSignatureHtml}${signatureHtml}</div>
        </div>
    </body>
    </html>`;
    }

    // --- TEMPLATE 6: BOLD IMPACT (Default Fallback) ---
    return `
    <html>
    <head>
        <title>Invoice #${id.substr(0,6).toUpperCase()}</title>
        <link href="https://fonts.googleapis.com/css2?family=Oswald:wght@400;700&family=Open+Sans:wght@400;600&display=swap" rel="stylesheet">
        <style>
            ${commonCSS}
            body { font-family: 'Open Sans', sans-serif; color: #000; }
            h1, .company-name { font-family: 'Oswald', sans-serif; text-transform: uppercase; }
            .header { border-bottom: 4px solid #000; padding-bottom: 20px; margin-bottom: 40px; display: flex; justify-content: space-between; align-items: flex-end; }
            .company-name { font-size: 36px; line-height: 1; }
            .invoice-tag { background: #000; color: #fff; padding: 5px 15px; font-family: 'Oswald', sans-serif; font-size: 24px; display: inline-block; }
            .items-table th { background: #000; color: #fff; padding: 10px; font-family: 'Oswald', sans-serif; letter-spacing: 1px; }
            .items-table td { padding: 15px 10px; border-bottom: 1px solid #000; font-weight: 600; }
            .total-amount { font-family: 'Oswald', sans-serif; font-size: 28px; background: #000; color: #fff; padding: 5px 15px; }
        </style>
    </head>
    <body>
        <div class="page-container">
            <div class="header">
                <div>
                    ${logoHtml}
                    <div class="company-name">${company.companyName || 'PipePro'}</div>
                    <div>${company.phone || ''}</div>
                </div>
                <div style="text-align: right;">
                    <div class="invoice-tag">INVOICE</div>
                    <div style="font-size: 18px; font-weight: 700; margin-top: 10px;">#${id.substr(0,6).toUpperCase()}</div>
                    <div>${dateStr}</div>
                </div>
            </div>

            <div style="margin-bottom: 40px; background: #f0f0f0; padding: 20px; border-left: 4px solid #000;">
                <div style="font-size: 12px; text-transform: uppercase; font-weight: 700;">Bill To</div>
                <div style="font-size: 20px; font-weight: 700;">${customer}</div>
                ${project ? `<div style="font-size: 14px; margin-top: 5px;">Project: ${project}</div>` : ''}
            </div>

            <table class="items-table">
                <thead>
                    <tr>
                        <th>Item</th>
                        <th style="text-align: center;">Qty</th>
                        <th style="text-align: right;">Rate</th>
                        <th style="text-align: right;">Total</th>
                    </tr>
                </thead>
                <tbody>
                    ${itemsRows}
                </tbody>
            </table>

            <div style="display: flex; justify-content: flex-end; align-items: center; margin-top: 30px;">
                ${qrCodeHtml}
                <div style="text-align: right;">
                    <span class="total-amount">₹${amount.toLocaleString()}</span>
                </div>
            </div>

            <div class="signatures">
                ${customerSignatureHtml}
                ${signatureHtml}
            </div>
        </div>
    </body>
    </html>`;
}

// Delivery Challan Print Function (No Prices)
window.printDeliveryChallan = async (id) => {
    const user = JSON.parse(localStorage.getItem('user'));
    const businessId = user.businessId || user.uid;
    
    try {
        const [settingsDoc, transDoc] = await Promise.all([
            db.collection('users').doc(businessId).collection('settings').doc('business').get(),
            db.collection('users').doc(businessId).collection('transactions').doc(id).get()
        ]);

        let company = settingsDoc.exists ? settingsDoc.data() : { companyName: 'My Company' };
        if (!transDoc.exists) return alert("Invoice not found");
        
        const inv = transDoc.data();
        const items = inv.items || [];
        const dateStr = formatDate(inv.date);

        const receiverSignatureHtml = inv.customerSignature
            ? `<div class="signature-box" style="border-top: none;"><img src="${inv.customerSignature}" style="max-height: 50px; display: block; margin: 0 auto;"><span style="border-top: 1px solid #333; display: block; width: 100%; padding-top: 5px;">Receiver's Signature</span></div>`
            : `<div class="signature-box">Receiver's Signature</div>`;

        const html = `
        <html>
        <head>
            <title>Delivery Challan #${id.substr(0,6).toUpperCase()}</title>
            <style>
                body { font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; color: #555; padding: 0; margin: 0; }
                .challan-box { max-width: 800px; margin: auto; padding: 30px; border: 1px solid #eee; box-shadow: 0 0 10px rgba(0, 0, 0, .15); font-size: 16px; line-height: 24px; }
                .header { display: flex; justify-content: space-between; margin-bottom: 50px; }
                .company-details { text-align: right; }
                .company-name { font-size: 28px; font-weight: bold; color: #333; margin-bottom: 5px; }
                .title { font-size: 32px; color: #333; font-weight: bold; text-transform: uppercase; }
                .info-table { width: 100%; margin-bottom: 40px; }
                .info-table td { padding: 5px; vertical-align: top; }
                .items-table { width: 100%; border-collapse: collapse; margin-bottom: 40px; }
                .items-table th { background: #f8f9fa; color: #333; font-weight: bold; padding: 12px; text-align: left; border-bottom: 2px solid #ddd; }
                .items-table td { padding: 12px; border-bottom: 1px solid #eee; }
                .footer { margin-top: 50px; text-align: center; font-size: 12px; color: #aaa; border-top: 1px solid #eee; padding-top: 20px; }
                .signatures { display: flex; justify-content: space-between; margin-top: 80px; }
                .signature-box { border-top: 1px solid #333; width: 200px; text-align: center; padding-top: 10px; }
            </style>
        </head>
        <body>
            <div class="challan-box">
                <div class="header">
                    <div>
                        <div class="title">DELIVERY CHALLAN</div>
                        <div>#${id.substr(0,6).toUpperCase()}</div>
                        <div>Date: ${dateStr}</div>
                    </div>
                    <div class="company-details">
                        <div class="company-name">${company.companyName || 'PipePro Business'}</div>
                        <div>${company.address || ''}</div>
                        <div>${company.city || ''} ${company.zip || ''}</div>
                        <div>${company.phone || ''}</div>
                    </div>
                </div>

                <table class="info-table">
                    <tr>
                        <td>
                            <strong>Delivered To:</strong><br>
                            ${inv.customer}<br>
                            ${inv.vehicle ? '<br><strong>Vehicle:</strong> ' + inv.vehicle : ''}
                            ${inv.driver ? '<br><strong>Driver:</strong> ' + inv.driver : ''}
                        </td>
                    </tr>
                </table>

                <table class="items-table">
                    <thead>
                        <tr>
                            <th>Item Description</th>
                            <th>Quantity</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${items.map(i => `
                        <tr>
                            <td>${i.name}</td>
                            <td>${i.quantity}</td>
                        </tr>
                        `).join('')}
                    </tbody>
                </table>

                <div class="signatures">
                    ${receiverSignatureHtml}
                    <div class="signature-box">Authorized Signatory</div>
                </div>

                <div class="footer">
                    This is a computer generated delivery challan.
                </div>
            </div>
            <script>window.print();</script>
        </body>
        </html>`;

        const printWindow = window.open('', '_blank');
        printWindow.document.write(html);
        printWindow.document.close();

    } catch(e) {
        console.error(e);
        alert("Failed to generate challan");
    }
};

// Send WhatsApp Reminder
window.sendWhatsApp = async (id, customerName, amount, status) => {
    const user = JSON.parse(localStorage.getItem('user'));
    const businessId = user.businessId || user.uid;
    
    try {
        const snapshot = await db.collection('users').doc(businessId).collection('customers')
            .where('name', '==', customerName).limit(1).get();
            
        if (snapshot.empty) return alert('Customer details not found');
        
        const customer = snapshot.docs[0].data();
        if (!customer.phone) return alert('Customer phone number missing');
        
        // Basic formatting for India (defaulting if no country code)
        let phone = customer.phone.replace(/\D/g, '');
        if (phone.length === 10) phone = '91' + phone;
        
        const text = encodeURIComponent(`Hello ${customerName},\n\nInvoice #${id.substr(0,6).toUpperCase()} for ₹${amount.toLocaleString()} is currently ${status}.\n\nPlease check and process payment if pending.\n\nThank you.`);
        window.open(`https://wa.me/${phone}?text=${text}`, '_blank');
        
    } catch(e) { 
        console.error(e); 
        alert('Error sending WhatsApp'); 
    }
};

// Send Email Reminder
window.sendEmail = async (id, customerName, amount, status) => {
    const user = JSON.parse(localStorage.getItem('user'));
    const businessId = user.businessId || user.uid;
    
    try {
        const snapshot = await db.collection('users').doc(businessId).collection('customers')
            .where('name', '==', customerName).limit(1).get();
            
        if (snapshot.empty) return alert('Customer details not found');
        
        const customer = snapshot.docs[0].data();
        if (!customer.email) return alert('Customer email missing');
        
        const subject = encodeURIComponent(`Invoice #${id.substr(0,6).toUpperCase()} - Payment Reminder`);
        const body = encodeURIComponent(`Hello ${customerName},\n\nThis is a reminder regarding Invoice #${id.substr(0,6).toUpperCase()}.\nAmount: ₹${amount.toLocaleString()}\nStatus: ${status}\n\nPlease arrange for payment at your earliest convenience.\n\nThank you.`);
        
        window.location.href = `mailto:${customer.email}?subject=${subject}&body=${body}`;
        
    } catch(e) { console.error(e); alert('Error sending Email'); }
};

// --- Signature Pad Logic ---
let isDrawing = false;

function setupSignaturePad() {
    const canvas = document.getElementById('signaturePad');
    if (!canvas) return;
    
    const ctx = canvas.getContext('2d');
    ctx.lineWidth = 2;
    ctx.lineCap = 'round';
    ctx.strokeStyle = '#000';

    const getPos = (e) => {
        const rect = canvas.getBoundingClientRect();
        const clientX = e.clientX || (e.touches && e.touches[0].clientX);
        const clientY = e.clientY || (e.touches && e.touches[0].clientY);
        return {
            x: clientX - rect.left,
            y: clientY - rect.top
        };
    };

    const startDraw = (e) => {
        isDrawing = true;
        const pos = getPos(e);
        ctx.beginPath();
        ctx.moveTo(pos.x, pos.y);
    };

    const draw = (e) => {
        if (!isDrawing) return;
        e.preventDefault();
        const pos = getPos(e);
        ctx.lineTo(pos.x, pos.y);
        ctx.stroke();
    };

    const stopDraw = () => {
        isDrawing = false;
    };

    canvas.addEventListener('mousedown', startDraw);
    canvas.addEventListener('mousemove', draw);
    canvas.addEventListener('mouseup', stopDraw);
    canvas.addEventListener('mouseout', stopDraw);

    canvas.addEventListener('touchstart', startDraw);
    canvas.addEventListener('touchmove', draw);
    canvas.addEventListener('touchend', stopDraw);
}

function clearSignaturePad() {
    const canvas = document.getElementById('signaturePad');
    if (canvas) {
        const ctx = canvas.getContext('2d');
        ctx.clearRect(0, 0, canvas.width, canvas.height);
    }
}

function isSignatureEmpty() {
    const canvas = document.getElementById('signaturePad');
    if (!canvas) return true;
    const blank = document.createElement('canvas');
    blank.width = canvas.width;
    blank.height = canvas.height;
    return canvas.toDataURL() === blank.toDataURL();
}

// --- Image Upload Helpers (Reused) ---
async function getImgBBApiKey(businessId) {
    try {
        await remoteConfig.fetchAndActivate();
        const rcKey = remoteConfig.getValue('imgbb_api_key').asString();
        if (rcKey) return rcKey;
        const doc = await db.collection('users').doc(businessId).collection('settings').doc('integrations').get();
        if (doc.exists && doc.data().imgbbApiKey) return doc.data().imgbbApiKey;
        return "031d6299529790696342316431f5516a"; // Fallback
    } catch (e) { return null; }
}

async function uploadToImgBB(file, apiKey) {
    const formData = new FormData();
    formData.append('image', file);
    const response = await fetch(`https://api.imgbb.com/1/upload?key=${apiKey}`, { method: 'POST', body: formData });
    const data = await response.json();
    if (data.success) return data.data.url;
    throw new Error(data.error ? data.error.message : 'Upload failed');
}

// Inject CSS for Template Previews
const templateStyles = `
<style>
/* Template Preview Container */
.template-preview-container {
    background: #f8f9fa;
    border-radius: 12px;
    padding: 30px;
    border: 2px solid #e9ecef;
    min-height: 400px;
    display: flex;
    align-items: center;
    justify-content: center;
}
.template-live-preview {
    width: 100%;
    max-width: 500px;
    background: white;
    border-radius: 8px;
    box-shadow: 0 10px 30px rgba(0,0,0,0.08);
    overflow: hidden;
    margin: 0 auto;
}
/* Template Thumbnails */
.template-thumbnails {
    display: grid;
    gap: 15px;
    max-height: 500px;
    overflow-y: auto;
    padding-right: 10px;
}
.template-thumbnail {
    border: 2px solid #e9ecef;
    border-radius: 8px;
    padding: 15px;
    cursor: pointer;
    transition: all 0.3s ease;
    background: white;
}
.template-thumbnail:hover {
    border-color: #dee2e6;
    transform: translateY(-2px);
    box-shadow: 0 5px 15px rgba(0,0,0,0.05);
}
.template-thumbnail.active {
    border-color: #0d6efd;
    background: linear-gradient(135deg, #f8f9ff 0%, #e8f4ff 100%);
    box-shadow: 0 5px 20px rgba(13, 110, 253, 0.15);
}
.thumbnail-preview {
    height: 120px;
    overflow: hidden;
    border-radius: 6px;
    margin-bottom: 10px;
    transform: scale(0.8);
    transform-origin: top left;
}
.thumbnail-label {
    display: flex;
    justify-content: space-between;
    align-items: center;
}
.thumbnail-name {
    font-weight: 500;
    font-size: 14px;
    color: #2d3748;
}
.thumbnail-badge {
    width: 12px;
    height: 12px;
    border-radius: 50%;
    display: inline-block;
}
/* Modern Preview */
.template-preview-modern { font-family: 'Inter', sans-serif; color: #1f2937; }
.preview-header { display: flex; justify-content: space-between; padding: 25px; border-bottom: 1px solid #e5e7eb; }
.preview-logo { font-weight: 700; color: #2563eb; }
.preview-title { font-weight: 800; color: #2563eb; }
.preview-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 30px; padding: 25px; }
.preview-from .label, .preview-to .label { font-size: 11px; text-transform: uppercase; color: #6b7280; font-weight: 600; }
.preview-items { padding: 0 25px; }
.preview-item { display: grid; grid-template-columns: 2fr 1fr 1fr; gap: 15px; padding: 12px 0; border-bottom: 1px solid #f3f4f6; font-size: 14px; }
.preview-total { display: flex; justify-content: space-between; padding: 25px; font-weight: 700; color: #2563eb; border-top: 2px solid #e5e7eb; }
/* Corporate Preview */
.template-preview-corporate { font-family: 'Roboto', sans-serif; }
.preview-header-dark { background: #1e293b; color: white; padding: 30px; display: flex; justify-content: space-between; }
.preview-company { font-weight: 700; }
.preview-client { padding: 25px; background: #f8fafc; }
.preview-items-striped { padding: 0 25px; }
.preview-items-striped .preview-item { display: grid; grid-template-columns: 2fr 1fr 1fr; gap: 15px; padding: 15px; background: #f1f5f9; }
.preview-grand-total { padding: 25px; text-align: right; font-weight: 700; color: #1e293b; }
/* Elegant Preview */
.template-preview-elegant { font-family: 'Playfair Display', serif; color: #444; }
.preview-header-elegant { text-align: center; padding: 30px; border-bottom: 1px double #ccc; }
.preview-company-name { font-size: 24px; margin-bottom: 5px; }
.preview-elegant-grid { display: flex; justify-content: space-between; padding: 25px; }
.preview-table-elegant { padding: 0 25px; }
.preview-table-header { display: flex; justify-content: space-between; padding: 12px 0; border-top: 1px solid #444; border-bottom: 1px solid #444; text-transform: uppercase; font-size: 12px; }
.preview-table-row { display: flex; justify-content: space-between; padding: 15px 0; }
.preview-total-elegant { text-align: right; padding: 25px; border-top: 1px solid #eee; font-weight: 700; }
/* Bold Preview */
.template-preview-bold { font-family: 'Oswald', sans-serif; color: #000; }
.preview-header-bold { border-bottom: 4px solid #000; padding: 20px; display: flex; justify-content: space-between; }
.preview-brand { font-size: 24px; font-weight: 700; }
.preview-invoice-bold { background: #000; color: #fff; padding: 5px 15px; }
.preview-client-box { background: #f0f0f0; padding: 20px; border-left: 4px solid #000; margin: 25px; }
.preview-items-bold { padding: 0 25px; }
.preview-item-bold { display: flex; justify-content: space-between; padding: 15px 0; border-bottom: 1px solid #000; font-weight: 600; }
.preview-total-bold { text-align: right; padding: 25px; font-size: 24px; background: #000; color: #fff; margin: 25px; }
/* Minimal Preview */
.template-preview-minimal { font-family: 'Open Sans', sans-serif; color: #4a5568; }
.preview-header-minimal { padding: 25px; border-bottom: 1px solid #e2e8f0; }
.preview-minimal-title { font-size: 24px; font-weight: 300; color: #2d3748; }
.preview-minimal-info { display: grid; grid-template-columns: 1fr 1fr; gap: 25px; padding: 25px; }
.label-minimal { font-size: 11px; text-transform: uppercase; color: #a0aec0; font-weight: 600; }
.preview-items-minimal { padding: 0 25px; }
.preview-item-minimal { display: flex; justify-content: space-between; padding: 12px 0; border-bottom: 1px solid #edf2f7; }
.preview-total-minimal { display: flex; justify-content: space-between; padding: 25px; font-weight: 600; color: #2d3748; }
/* Luxury Preview */
.template-preview-luxury { font-family: 'Cormorant Garamond', serif; color: #333; }
.preview-header-luxury { background: linear-gradient(135deg, #1a1a1a 0%, #333 100%); color: #b8860b; padding: 30px; text-align: center; }
.preview-luxury-title { font-size: 28px; letter-spacing: 3px; }
.preview-luxury-client { padding: 30px; text-align: center; border-bottom: 1px solid #e8e8e8; }
.label-luxury { font-size: 11px; letter-spacing: 2px; color: #b8860b; text-transform: uppercase; }
.preview-items-luxury { padding: 30px; }
.preview-item-luxury { display: flex; justify-content: space-between; padding: 15px 0; border-bottom: 1px solid #f0f0f0; }
.preview-total-luxury { background: #fafafa; padding: 25px 30px; display: flex; justify-content: space-between; font-weight: 600; color: #b8860b; }
/* Scrollbar */
.template-thumbnails::-webkit-scrollbar { width: 6px; }
.template-thumbnails::-webkit-scrollbar-track { background: #f1f1f1; border-radius: 3px; }
.template-thumbnails::-webkit-scrollbar-thumb { background: #c1c1c1; border-radius: 3px; }
</style>
`;
document.head.insertAdjacentHTML('beforeend', templateStyles);