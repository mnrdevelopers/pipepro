import { db, getPublicBusinessId } from './firebase-config.js';

const grid = document.getElementById('productsGrid');
const tabs = document.getElementById('productCategoryTabs');

function sanitizePhone(value) {
    if (!value) return '';
    return String(value).replace(/[^\d]/g, '');
}

function normalizeCategory(value) {
    const text = String(value || '').trim();
    return text || 'Other';
}

function renderEmpty(message) {
    if (!grid) return;
    grid.innerHTML = `<div class="col-12 text-center text-muted">${message}</div>`;
}

function createProductCard(item, phone, whatsapp) {
    const img = item.imageUrl || 'factory-hero.png';
    const qty = item.quantity ?? 0;
    const unit = item.unit || 'pcs';
    const callLink = phone ? `tel:+${phone}` : '#';
    const waText = encodeURIComponent(`Hi, I want pricing for ${item.name}.`);
    const waLink = whatsapp ? `https://wa.me/${whatsapp}?text=${waText}` : '#';
    const specs = [];

    if (item.specs) specs.push(item.specs);
    if (item.diameter) specs.push(`Dia: ${item.diameter}`);
    if (item.length) specs.push(`Length: ${item.length}`);

    return `
        <div class="col-md-6 col-lg-4">
            <div class="product-card">
                <img src="${img}" alt="${item.name || 'Product'}" class="product-img">
                <h5>${item.name || 'Product'}</h5>
                <p>${item.description || 'High-strength pipe solution for infrastructure projects.'}</p>
                <div class="product-specs">
                    <span>Available: ${qty} ${unit}</span>
                    ${specs.map(s => `<span>${s}</span>`).join('')}
                </div>
                <div class="stock-quick compact product-actions">
                    <a class="btn btn-sm btn-call ${phone ? '' : 'disabled'}" href="${callLink}" title="Call">
                        <i class="fas fa-phone-alt"></i>
                    </a>
                    <a class="btn btn-sm btn-whatsapp ${whatsapp ? '' : 'disabled'}" href="${waLink}" title="WhatsApp">
                        <i class="fab fa-whatsapp"></i>
                    </a>
                </div>
            </div>
        </div>
    `;
}

function renderTabs(categories, active) {
    if (!tabs) return;
    const pills = ['All', ...categories];
    tabs.innerHTML = pills.map(cat => {
        const isActive = cat === active;
        return `<button type="button" class="category-pill ${isActive ? 'active' : ''}" data-category="${cat}">${cat}</button>`;
    }).join('');
}

async function loadProducts() {
    if (!grid) return;
    if (!db) {
        renderEmpty('Products are unavailable.');
        return;
    }

    const businessId = await getPublicBusinessId();
    if (!businessId) {
        renderEmpty('Set `public_business_id` in Firebase Remote Config to load products.');
        return;
    }

    try {
        const publicDoc = await db.collection('public').doc(businessId).get();
        const publicData = publicDoc.exists ? publicDoc.data() : {};
        const phone = sanitizePhone(publicData.phone || publicData.companyPhone || '');
        const whatsapp = sanitizePhone(publicData.whatsapp || publicData.companyWhatsapp || phone);

        const snapshot = await db.collection('public')
            .doc(businessId)
            .collection('featured_stock')
            .orderBy('name')
            .get();

        if (snapshot.empty) {
            renderEmpty('No products available right now.');
            return;
        }

        const items = [];
        snapshot.forEach(doc => {
            const data = doc.data();
            items.push({
                id: doc.id,
                ...data,
                category: normalizeCategory(data.category || data.type)
            });
        });

        const categories = Array.from(new Set(items.map(i => i.category))).sort();
        let activeCategory = 'All';

        const renderGrid = () => {
            const filtered = activeCategory === 'All'
                ? items
                : items.filter(i => i.category === activeCategory);
            if (!filtered.length) {
                renderEmpty('No products found in this category.');
                return;
            }
            grid.innerHTML = filtered.map(item => createProductCard(item, phone, whatsapp)).join('');
        };

        renderTabs(categories, activeCategory);
        renderGrid();

        if (tabs) {
            tabs.addEventListener('click', (e) => {
                const btn = e.target.closest('.category-pill');
                if (!btn) return;
                activeCategory = btn.dataset.category;
                renderTabs(categories, activeCategory);
                renderGrid();
            });
        }
    } catch (err) {
        console.error('Failed to load products', err);
        renderEmpty('Failed to load products.');
    }
}

document.addEventListener('DOMContentLoaded', loadProducts);
