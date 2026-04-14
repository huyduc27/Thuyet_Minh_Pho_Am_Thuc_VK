// ========================================
// Dashboard Module — Tổng quan + Navigation
// ========================================

// Khai báo một biến toàn cục window.currentUser để xài ké ở các file khác (poi.js)
window.currentUser = null;

// Ensure user is authenticated
requireAuth().then(user => {
    // Lưu tạm thông tin user vào biến toàn cục vừa tạo
    window.currentUser = user;

    // 1. Cập nhật giao diện: Gắn thêm mác (Admin / Owner) phía sau Email
    const roleName = user.role === 'admin' ? "Quản trị viên" : "Chủ quán";
    document.getElementById('userEmail').textContent = `${user.email} (${roleName})`;
    document.getElementById('userAvatar').textContent = user.email.charAt(0).toUpperCase();

    // 2. CHECK ROLE: Nếu là Chủ cửa hàng (owner) thì ẨN một số thứ đi
    // 2. CHECK ROLE: Nếu là Chủ cửa hàng (owner) thì ẨN một số thứ đi
    if (user.role === 'owner') {
        // Ẩn Dashboard, Tour và Approvals, còn lại (POI, Bản dịch, Audio, History, QR) vẫn hiển thị
        const restrictedMenus = ['dashboard', 'tour', 'approvals', 'users'];

        restrictedMenus.forEach(menu => {
            const menuElement = document.querySelector(`.nav-item[data-section="${menu}"]`);
            if (menuElement) {
                menuElement.style.display = 'none'; // Lệnh ẩn tàng hình
            }
        });

        // Ẩn nút xóa lịch sử đối với Chủ quán
        const btnClear = document.getElementById('btnClearHistory');
        if (btnClear) btnClear.style.display = 'none';

        // ÁP GIẢI CHỦ QUÁN: Vừa vào web là đẩy bắt buộc sang tab Quản lý POI luôn
        switchSection('poi');

    } else {
        // 3. Nếu role là 'admin', mặc định vào sẽ thấy và đọc dữ liệu Tổng quan
        loadDashboardStats();
    }

    // 4. KIỂM TRA QUYỀN XONG: Giấu màn hình Loading và mở bức màn Sân khấu
    const loader = document.getElementById('initialLoader');
    const appLayout = document.getElementById('mainAppLayout');
    if (loader && appLayout) {
        loader.style.opacity = '0';
        appLayout.style.opacity = '1';
        appLayout.style.pointerEvents = 'all';
        setTimeout(() => loader.style.display = 'none', 500); // Đợi hiệu ứng mờ kết thúc rồi xóa hẳn
    }
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
        case 'approvals': if(typeof loadApprovals === 'function') loadApprovals(); break;
        case 'poi': loadPois(); break;
        case 'translation': loadTranslations(); break;
        case 'audio': loadAudioPoiFilter(); break;
        case 'history': loadHistory(); break;
        case 'tour': loadTours(); break;
        case 'qrcode': loadQrCodes(); break;
        case 'users': loadUsers(); break;
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
