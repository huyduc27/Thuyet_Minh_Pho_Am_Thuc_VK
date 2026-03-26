// ========================================
// Dashboard Module — Tổng quan + Navigation
// ========================================

// Ensure user is authenticated
requireAuth().then(user => {
    // Update UI with user info
    document.getElementById('userEmail').textContent = user.email;
    document.getElementById('userAvatar').textContent = user.email.charAt(0).toUpperCase();

    // Load dashboard stats
    loadDashboardStats();
});

// === Section Navigation ===
function switchSection(section) {
    // Hide all sections
    document.querySelectorAll('.section-panel').forEach(el => el.classList.remove('active'));
    document.querySelectorAll('.nav-item').forEach(el => el.classList.remove('active'));

    // Show selected section
    document.getElementById(`section-${section}`).classList.add('active');
    document.querySelector(`.nav-item[data-section="${section}"]`).classList.add('active');

    // Load data for section
    switch (section) {
        case 'dashboard': loadDashboardStats(); break;
        case 'poi': loadPois(); break;
        case 'translation': loadTranslations(); break;
        case 'audio': loadAudioPoiFilter(); break;
        case 'history': loadHistory(); break;
        case 'tour': loadTours(); break;
    }
}

// === Dashboard Stats ===
async function loadDashboardStats() {
    try {
        const [poisSnap, audioSnap, toursSnap, historySnap] = await Promise.all([
            db.collection('pois').get(),
            db.collection('audioFiles').get(),
            db.collection('tours').get(),
            db.collection('narrationLogs').get()
        ]);

        document.getElementById('statPoi').textContent = poisSnap.size;
        document.getElementById('statAudio').textContent = audioSnap.size;
        document.getElementById('statTour').textContent = toursSnap.size;
        document.getElementById('statHistory').textContent = historySnap.size;
    } catch (error) {
        console.error('Error loading stats:', error);
    }
}

// === Toast Notifications ===
function showToast(message, type = 'success') {
    const container = document.getElementById('toastContainer');
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.textContent = message;
    container.appendChild(toast);

    setTimeout(() => {
        toast.remove();
    }, 3000);
}

// === Utility ===
function formatDate(timestamp) {
    if (!timestamp) return '—';
    const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
    return date.toLocaleDateString('vi-VN', {
        day: '2-digit', month: '2-digit', year: 'numeric',
        hour: '2-digit', minute: '2-digit'
    });
}
