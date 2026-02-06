import { db } from './firebase-config.js';

const form = document.getElementById('attendanceForm');
const messageDiv = document.getElementById('message');
const submitBtn = document.getElementById('submitBtn');

// Get Owner UID from URL
const urlParams = new URLSearchParams(window.location.search);
const ownerUid = urlParams.get('uid');

if (!ownerUid) {
    showMessage('danger', 'Invalid QR Code. Owner ID missing.');
    submitBtn.disabled = true;
}

form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const mobile = normalizeMobile(document.getElementById('mobile').value);
    
    if (!mobile) return;
    
    setLoading(true);

    try {
        // 1. Check Time Restrictions
        const settingsDoc = await db.collection('users').doc(ownerUid).collection('settings').doc('attendance').get();
        if (settingsDoc.exists) {
            const s = settingsDoc.data();
            const now = new Date();
            const currentTime = now.toTimeString().slice(0, 5); // HH:MM
            
            if (s.startTime && currentTime < s.startTime) throw `Check-in not allowed before ${s.startTime}`;
            if (s.endTime && currentTime > s.endTime) throw `Check-in closed at ${s.endTime}`;

            // 1b. Check Location Restrictions (if configured)
            const allowedLat = parseFloat(s.allowedLat);
            const allowedLng = parseFloat(s.allowedLng);
            const allowedRadius = parseFloat(s.allowedRadius);
            let locationCapture = null;
            if (isValidNumber(allowedLat) && isValidNumber(allowedLng)) {
                const radius = isValidNumber(allowedRadius) ? allowedRadius : 200;
                const position = await getCurrentPosition();
                const distance = getDistanceMeters(
                    { lat: allowedLat, lng: allowedLng },
                    { lat: position.coords.latitude, lng: position.coords.longitude }
                );

                if (distance > radius) {
                    throw `Wrong location. You are ${Math.round(distance)}m away (allowed ${radius}m).`;
                }
                locationCapture = {
                    lat: position.coords.latitude,
                    lng: position.coords.longitude,
                    accuracy: position.coords.accuracy ?? null,
                    distanceMeters: Math.round(distance),
                    verifiedAt: new Date()
                };
            }
        }

        // 2. Find Staff by Mobile
        const staffSnapshot = await db.collection('users').doc(ownerUid)
            .collection('staff')
            .where('mobile', '==', mobile)
            .where('active', '==', true)
            .get();

        if (staffSnapshot.empty) {
            throw "Staff not found or inactive. Check mobile number.";
        }

        const staffDoc = staffSnapshot.docs[0];
        const staff = staffDoc.data();

        // 3. Mark Attendance
        // We use a deterministic ID (staffId_date) to prevent duplicates without needing read permissions.
        const todayStr = new Date().toISOString().split('T')[0];
        const docId = `${staffDoc.id}_${todayStr}`;

        try {
            await db.collection('users').doc(ownerUid).collection('attendance').doc(docId).set({
                staffId: staffDoc.id,
                staffName: staff.name,
                role: staff.role,
                wageEarned: staff.dailyWage,
                timestamp: new Date(),
                dateString: todayStr,
                status: 'Present',
                location: locationCapture
            });
        } catch (err) {
            // If permission denied, it likely means the document already exists (update denied for public users)
            if (err.code === 'permission-denied') {
                throw "Attendance already marked for today.";
            }
            throw err;
        }

        showMessage('success', `Welcome, ${staff.name}! Attendance marked. Location verified.`);
        form.reset();

    } catch (error) {
        console.error(error);
        showMessage('danger', error.toString());
    } finally {
        setLoading(false);
    }
});

function showMessage(type, text) {
    messageDiv.className = `alert alert-${type}`;
    messageDiv.textContent = text;
    messageDiv.classList.remove('d-none');
}

function setLoading(isLoading) {
    if (isLoading) {
        submitBtn.disabled = true;
        submitBtn.innerHTML = '<span class="spinner-border spinner-border-sm"></span> Processing...';
    } else {
        submitBtn.disabled = false;
        submitBtn.innerHTML = 'Mark Present';
    }
}

function normalizeMobile(value) {
    return (value || '').replace(/\D/g, '');
}

function isValidNumber(val) {
    return typeof val === 'number' && !Number.isNaN(val);
}

function getCurrentPosition() {
    return new Promise((resolve, reject) => {
        if (!navigator.geolocation) {
            reject(new Error('Geolocation is not supported in this browser.'));
            return;
        }
        navigator.geolocation.getCurrentPosition(resolve, (err) => {
            reject(new Error('Location permission is required to mark attendance.'));
        }, { enableHighAccuracy: true, timeout: 10000 });
    });
}

function getDistanceMeters(a, b) {
    const toRad = (deg) => (deg * Math.PI) / 180;
    const R = 6371000;
    const dLat = toRad(b.lat - a.lat);
    const dLng = toRad(b.lng - a.lng);
    const lat1 = toRad(a.lat);
    const lat2 = toRad(b.lat);
    const sinDLat = Math.sin(dLat / 2);
    const sinDLng = Math.sin(dLng / 2);
    const h = sinDLat * sinDLat + Math.cos(lat1) * Math.cos(lat2) * sinDLng * sinDLng;
    return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)));
}
