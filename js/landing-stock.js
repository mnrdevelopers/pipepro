import { db, getPublicBusinessId } from './firebase-config.js';

const grid = document.getElementById('landingStockGrid');
const LANDING_PRODUCT_LIMIT = 4;

function sanitizePhone(value) {
    if (!value) return '';
    return String(value).replace(/[^\d]/g, '');
}

function renderEmpty(message) {
    if (!grid) return;
    grid.innerHTML = `<div class="col-12 text-center text-muted">${message}</div>`;
}

function createStockCard(item, phone, whatsapp) {
    const img = item.imageUrl || 'factory-hero.png';
    const qty = item.quantity ?? 0;
    const unit = item.unit || 'pcs';
    const callLink = phone ? `tel:+${phone}` : '#';
    const waText = encodeURIComponent(`Hi, I want pricing for ${item.name}.`);
    const waLink = whatsapp ? `https://wa.me/${whatsapp}?text=${waText}` : '#';

    return `
        <div class="col-md-6 col-lg-3">
            <div class="stock-card h-100">
                <div class="stock-image">
                    <img src="${img}" alt="${item.name || 'Stock item'}">
                </div>
                <div class="stock-body">
                    <div class="stock-title">${item.name || 'Item'}</div>
                    <div class="stock-qty">Available: <strong>${qty}</strong> ${unit}</div>
                    <div class="stock-quick compact">
                        <a class="btn btn-sm btn-call ${phone ? '' : 'disabled'}" href="${callLink}" title="Call">
                            <i class="fas fa-phone-alt"></i>
                        </a>
                        <a class="btn btn-sm btn-whatsapp ${whatsapp ? '' : 'disabled'}" href="${waLink}" title="WhatsApp">
                            <i class="fab fa-whatsapp"></i>
                        </a>
                    </div>
                </div>
            </div>
        </div>
    `;
}

async function loadLandingStock() {
    if (!grid) return;
    if (!db) {
        renderEmpty('Stock is unavailable.');
        return;
    }
    const businessId = await getPublicBusinessId();
    if (!businessId) {
        renderEmpty('Set `public_business_id` in Firebase Remote Config to load stock.');
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
            renderEmpty('No featured stock available right now.');
            return;
        }

        const cards = [];
        snapshot.forEach(doc => {
            if (cards.length < LANDING_PRODUCT_LIMIT) {
                cards.push(createStockCard(doc.data(), phone, whatsapp));
            }
        });
        grid.innerHTML = cards.join('');
    } catch (err) {
        console.error('Failed to load landing stock', err);
        renderEmpty('Failed to load stock.');
    }
}

document.addEventListener('DOMContentLoaded', loadLandingStock);
