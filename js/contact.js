import { remoteConfig } from './firebase-config.js';

const form = document.getElementById('contactForm');
const alertBox = document.getElementById('contactAlert');
const submitBtn = document.getElementById('contactSubmit');

function showAlert(type, message) {
    if (!alertBox) return;
    alertBox.className = `alert alert-${type}`;
    alertBox.innerHTML = message;
    alertBox.classList.remove('d-none');
}

function setLoading(isLoading) {
    if (!submitBtn) return;
    const spinner = submitBtn.querySelector('.spinner-border');
    const icon = submitBtn.querySelector('.fa-paper-plane');
    if (spinner) spinner.classList.toggle('d-none', !isLoading);
    if (icon) icon.classList.toggle('d-none', isLoading);
    submitBtn.disabled = isLoading;
}

async function getFormspreeConfig() {
    if (!remoteConfig) {
        throw new Error('Remote Config not available. Serve the site over http(s) and ensure firebase-remote-config-compat.js is loaded.');
    }

    try {
        await remoteConfig.fetchAndActivate();
    } catch (error) {
        console.warn('Remote Config fetch failed, using existing values.', error);
    }

    return {
        endpoint: remoteConfig.getString('formspree_endpoint')
    };
}

async function handleSubmit(event) {
    event.preventDefault();
    setLoading(true);
    alertBox?.classList.add('d-none');

    try {
        const { endpoint } = await getFormspreeConfig();

        if (!endpoint) {
            throw new Error('Formspree endpoint is missing.');
        }

        const payload = {
            name: document.getElementById('contactName').value.trim(),
            email: document.getElementById('contactEmail').value.trim(),
            subject: document.getElementById('contactSubject').value.trim(),
            message: document.getElementById('contactMessage').value.trim()
        };

        const response = await fetch(endpoint, {
            method: 'POST',
            headers: {
                'Accept': 'application/json',
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(payload)
        });

        if (!response.ok) {
            throw new Error('Formspree request failed.');
        }
        showAlert('success', '<i class="fas fa-check-circle me-2"></i>Your message has been sent.');
        const modalEl = document.getElementById('contactSuccessModal');
        if (modalEl && window.bootstrap?.Modal) {
            const modal = bootstrap.Modal.getOrCreateInstance(modalEl);
            modal.show();
        }
        form.reset();
    } catch (error) {
        console.error('Contact form error:', error);
        const message = error?.message || 'Unable to send. Please try again later.';
        showAlert('danger', `<i class="fas fa-exclamation-circle me-2"></i>${message}`);
    } finally {
        setLoading(false);
    }
}

if (form) {
    form.addEventListener('submit', handleSubmit);
}
