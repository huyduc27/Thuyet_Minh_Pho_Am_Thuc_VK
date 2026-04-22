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
        const restrictedMenus = ['dashboard', 'tour', 'approvals', 'owners', 'tourists'];

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
        case 'owners': loadOwners(); break;
        case 'tourists': loadTourists(); break;
    }
}

// === Dashboard Stats ===
let heatmapInstance = null;
let heatLayer = null;
let markerLayer = null;

async function loadDashboardStats() {
    try {
        const [poisSnap, audioSnap, toursSnap, historySnap, pendingSnap] = await Promise.all([
            db.collection('pois').get(),
            db.collection('audioFiles').get(),
            db.collection('tours').get(),
            db.collection('narrationLogs').get(),
            db.collection('poiRequests').where('status', '==', 'PENDING').get()
        ]);

        document.getElementById('statPoi').textContent = poisSnap.size;
        document.getElementById('statAudio').textContent = audioSnap.size;
        document.getElementById('statTour').textContent = toursSnap.size;
        document.getElementById('statHistory').textContent = historySnap.size;
        document.getElementById('statPending').textContent = pendingSnap.size;

        // Lưu tạm dữ liệu để heatmap dùng khi toggle
        window._heatmapPoisSnap = poisSnap;
        window._heatmapHistorySnap = historySnap;

        // Nếu heatmap đang hiện → cập nhật luôn
        const mapEl = document.getElementById('heatmap');
        if (mapEl && mapEl.style.display !== 'none') {
            loadHeatmap(poisSnap, historySnap);
        }

        // Render biểu đồ Top 5
        loadTop5Chart(poisSnap, historySnap);

        // Kích hoạt Real-time Listener cho số người Online (nếu chưa bật)
        if (!window._onlineUsersListenerActive) {
            initOnlineUsersListener();
            window._onlineUsersListenerActive = true;
        }

    } catch (error) {
        console.error('Error loading stats:', error);
    }
}

// === Theo dõi Người dùng Trực tuyến ===
let onlineUsersUnsubscribe = null;
let onlineGuestsUnsubscribe = null;

function initOnlineUsersListener() {
    if (onlineUsersUnsubscribe) onlineUsersUnsubscribe();
    if (onlineGuestsUnsubscribe) onlineGuestsUnsubscribe();
    
    onlineUsersUnsubscribe = db.collection('users')
        .where('status', '==', 'active')
        .onSnapshot(snapshot => {
            window._lastActiveUsersDocs = snapshot.docs; 
            updateOnlineUsersCount();
        }, err => {
            console.error('Lỗi khi lắng nghe user online:', err);
        });

    onlineGuestsUnsubscribe = db.collection('onlineGuests')
        .onSnapshot(snapshot => {
            window._lastActiveGuestsDocs = snapshot.docs;
            updateOnlineUsersCount();
        }, err => {
            console.error('Lỗi khi lắng nghe guest online:', err);
        });

    // Cập nhật lại số đếm mỗi 30s để tự động lọc những người đã thoái trào (quá thời gian ngưỡng)
    if (!window._onlineInterval) {
        window._onlineInterval = setInterval(() => {
            updateOnlineUsersCount();
        }, 30000);
    }
}

function updateOnlineUsersCount() {
    const seventySecondsAgo = new Date(Date.now() - 70 * 1000); // Ngưỡng 70s theo yêu cầu demo
    let appOnlineCount = 0;
    let webOnlineCount = 0;
    
    if (window._lastActiveUsersDocs) {
        window._lastActiveUsersDocs.forEach(doc => {
            const user = doc.data();
            if (user.lastSeen) {
                const lastSeenDate = user.lastSeen.toDate ? user.lastSeen.toDate() : new Date(user.lastSeen);
                if (lastSeenDate >= seventySecondsAgo) {
                    appOnlineCount++;
                }
            }
        });
    }

    if (window._lastActiveGuestsDocs) {
        window._lastActiveGuestsDocs.forEach(doc => {
            const guest = doc.data();
            if (guest.lastSeen) {
                const lastSeenDate = guest.lastSeen.toDate ? guest.lastSeen.toDate() : new Date(guest.lastSeen);
                if (lastSeenDate >= seventySecondsAgo) {
                    webOnlineCount++;
                }
            }
        });
    }

    const totalOnlineCount = appOnlineCount + webOnlineCount;

    const statOnline = document.getElementById('statOnline');
    const statOnlineApp = document.getElementById('statOnlineApp');
    const statOnlineWeb = document.getElementById('statOnlineWeb');

    if (statOnline) {
        if (statOnline.textContent !== totalOnlineCount.toString()) {
            statOnline.style.transform = 'scale(1.2)';
            setTimeout(() => statOnline.style.transform = 'scale(1)', 200);
        }
        statOnline.textContent = totalOnlineCount;
        if (statOnlineApp) statOnlineApp.textContent = appOnlineCount;
        if (statOnlineWeb) statOnlineWeb.textContent = webOnlineCount;
    }
}

// === Top 5 Chart ===
let top5ChartInstance = null;

function loadTop5Chart(poisSnap, historySnap) {
    const canvas = document.getElementById('top5Chart');
    if (!canvas) return;

    // 1. Đếm log theo POI
    const logCountMap = {};
    historySnap.docs.forEach(doc => {
        const poiId = doc.data().poiId;
        if (poiId) {
            logCountMap[poiId] = (logCountMap[poiId] || 0) + 1;
        }
    });

    // 2. Map POI id → name
    const poiNameMap = {};
    poisSnap.docs.forEach(doc => {
        poiNameMap[doc.id] = doc.data().name || 'POI';
    });

    // 3. Sắp xếp và lấy top 5
    const sorted = Object.entries(logCountMap)
        .map(([id, count]) => ({ name: poiNameMap[id] || `POI #${id.slice(0,6)}`, count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 5);

    // 4. Nếu không có data
    if (sorted.length === 0) {
        sorted.push({ name: 'Chưa có dữ liệu', count: 0 });
    }

    const labels = sorted.map(p => p.name);
    const data = sorted.map(p => p.count);
    const barColors = ['#fbbf24', '#f97316', '#e94560', '#a78bfa', '#22d3ee'];

    // 5. Destroy old chart nếu có
    if (top5ChartInstance) {
        top5ChartInstance.destroy();
    }

    // 6. Render chart
    top5ChartInstance = new Chart(canvas, {
        type: 'bar',
        data: {
            labels: labels,
            datasets: [{
                label: 'Lượt nghe',
                data: data,
                backgroundColor: barColors.slice(0, labels.length),
                borderColor: 'transparent',
                borderRadius: 6,
                borderSkipped: false,
                barThickness: 28
            }]
        },
        options: {
            indexAxis: 'y',
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { display: false },
                tooltip: {
                    backgroundColor: '#1a1a24',
                    titleColor: '#f0f0f5',
                    bodyColor: '#e8a838',
                    borderColor: '#333344',
                    borderWidth: 1,
                    padding: 10,
                    cornerRadius: 8,
                    callbacks: {
                        label: ctx => `${ctx.raw} lượt phát`
                    }
                }
            },
            scales: {
                x: {
                    beginAtZero: true,
                    grid: { color: 'rgba(255,255,255,0.05)' },
                    ticks: {
                        color: '#666677',
                        font: { family: 'Inter', size: 11 },
                        precision: 0
                    }
                },
                y: {
                    grid: { display: false },
                    ticks: {
                        color: '#f0f0f5',
                        font: { family: 'Inter', size: 12, weight: 500 },
                        padding: 8
                    }
                }
            }
        }
    });
}

// === Heatmap Toggle ===
let heatmapVisible = false;

function toggleHeatmap() {
    const mapEl = document.getElementById('heatmap');
    const btn = document.getElementById('btnToggleHeatmap');
    if (!mapEl || !btn) return;

    heatmapVisible = !heatmapVisible;

    if (heatmapVisible) {
        mapEl.style.display = 'block';
        btn.textContent = '🗺️ Ẩn bản đồ';
        // Render heatmap với dữ liệu đã cache
        if (window._heatmapPoisSnap && window._heatmapHistorySnap) {
            loadHeatmap(window._heatmapPoisSnap, window._heatmapHistorySnap);
        }
    } else {
        mapEl.style.display = 'none';
        btn.textContent = '🗺️ Hiện bản đồ';
    }
}

// === Heatmap Render ===
function loadHeatmap(poisSnap, historySnap) {
    const mapEl = document.getElementById('heatmap');
    if (!mapEl) return;

    // 1. Đếm số lượt nghe theo từng POI
    const logCountMap = {};
    historySnap.docs.forEach(doc => {
        const poiId = doc.data().poiId;
        if (poiId) {
            logCountMap[poiId] = (logCountMap[poiId] || 0) + 1;
        }
    });

    // 2. Chuẩn bị dữ liệu POI với tọa độ + weight
    const poiData = [];
    poisSnap.docs.forEach(doc => {
        const d = doc.data();
        if (d.latitude && d.longitude) {
            poiData.push({
                id: doc.id,
                name: d.name || 'POI',
                category: d.category || '',
                lat: d.latitude,
                lng: d.longitude,
                count: logCountMap[doc.id] || 0
            });
        }
    });

    // 3. Khởi tạo hoặc cập nhật bản đồ Leaflet
    const center = [10.7612, 106.7035]; // Trung tâm Vĩnh Khánh
    const zoom = 17;

    if (!heatmapInstance) {
        heatmapInstance = L.map('heatmap', {
            center: center,
            zoom: zoom,
            zoomControl: true,
            scrollWheelZoom: false  // TẮT scroll zoom để không cản scroll page
        });

        // Dark theme tile
        L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
            attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OSM</a> &copy; <a href="https://carto.com/">CARTO</a>',
            maxZoom: 19
        }).addTo(heatmapInstance);
    }

    // 4. Xóa layer cũ nếu đã có (cho refresh)
    if (heatLayer) {
        heatmapInstance.removeLayer(heatLayer);
    }
    if (markerLayer) {
        heatmapInstance.removeLayer(markerLayer);
    }

    // 5. Tạo heatmap data: [lat, lng, intensity]
    // Dùng LOG SCALE để tránh 1 quán quá nổi bật làm mờ hết các quán khác
    const maxLog = Math.log(Math.max(...poiData.map(p => p.count), 1) + 1);
    const heatData = poiData.map(p => [
        p.lat,
        p.lng,
        Math.max(Math.log(p.count + 1) / maxLog, 0.2) // min 0.2 để luôn nhìn thấy
    ]);

    heatLayer = L.heatLayer(heatData, {
        radius: 35,
        blur: 25,
        maxZoom: 18,
        max: 1.0,
        gradient: {
            0.0: '#1a1a2e',
            0.25: '#16213e',
            0.5: '#e94560',
            0.75: '#f97316',
            1.0: '#fbbf24'
        }
    }).addTo(heatmapInstance);

    // 6. Thêm circle markers với popup
    const categoryIcons = {
        'Ốc': '🐚', 'Lẩu': '🍲', 'Nướng': '🔥', 'Hải sản': '🦀',
        'Bò': '🥩', 'Cơm': '🍚', 'Ăn vặt': '🍢', 'Chè': '🍧', 'Tráng miệng': '🍨'
    };

    markerLayer = L.layerGroup();
    poiData.forEach(p => {
        const icon = categoryIcons[p.category] || '📍';
        const circle = L.circleMarker([p.lat, p.lng], {
            radius: 6,
            fillColor: '#e8a838',
            fillOpacity: 0.85,
            color: '#fff',
            weight: 1.5
        });

        circle.bindPopup(`
            <div class="heatmap-popup-name">${icon} ${p.name}</div>
            <div class="heatmap-popup-count">${p.count}</div>
            <div class="heatmap-popup-label">lượt nghe thuyết minh</div>
        `, { closeButton: false });

        circle.on('mouseover', function() { this.openPopup(); });
        circle.on('mouseout', function() { this.closePopup(); });

        markerLayer.addLayer(circle);
    });

    markerLayer.addTo(heatmapInstance);

    // 7. Fix Leaflet render issue khi container vừa display:block
    setTimeout(() => {
        heatmapInstance.invalidateSize();
    }, 250);
}

// === Refresh Dashboard ===
async function refreshDashboard() {
    const btn = document.getElementById('btnRefreshDashboard');
    if (btn) {
        btn.classList.add('spinning');
    }
    try {
        await loadDashboardStats();
        showToast('Đã cập nhật dữ liệu tổng quan!', 'success');
    } catch (e) {
        showToast('Lỗi khi làm mới', 'error');
    } finally {
        if (btn) {
            setTimeout(() => btn.classList.remove('spinning'), 600);
        }
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

// === Pagination Utility ===
const PAGE_SIZE = 10;

/**
 * Render pagination bar vào container
 * @param {string} containerId - ID của div chứa pagination
 * @param {number} currentPage - Trang hiện tại (1-based)
 * @param {number} totalItems - Tổng số phần tử
 * @param {function} onPageChange - Callback khi đổi trang: onPageChange(newPage)
 */
function renderPagination(containerId, currentPage, totalItems, onPageChange) {
    const container = document.getElementById(containerId);
    if (!container) return;

    const totalPages = Math.ceil(totalItems / PAGE_SIZE);
    if (totalPages <= 1) {
        container.innerHTML = '';
        return;
    }

    let html = '<div class="pagination">';

    // Prev
    html += `<button class="page-btn" ${currentPage <= 1 ? 'disabled' : ''} 
        onclick="window._paginationCallbacks['${containerId}'](${currentPage - 1})">‹</button>`;

    // Page numbers
    for (let i = 1; i <= totalPages; i++) {
        if (totalPages <= 7 || i === 1 || i === totalPages ||
            (i >= currentPage - 1 && i <= currentPage + 1)) {
            html += `<button class="page-btn ${i === currentPage ? 'active' : ''}" 
                onclick="window._paginationCallbacks['${containerId}'](${i})">${i}</button>`;
        } else if (i === currentPage - 2 || i === currentPage + 2) {
            html += '<span class="page-dots">…</span>';
        }
    }

    // Next
    html += `<button class="page-btn" ${currentPage >= totalPages ? 'disabled' : ''} 
        onclick="window._paginationCallbacks['${containerId}'](${currentPage + 1})">›</button>`;

    html += `<span class="page-info">${currentPage}/${totalPages}</span>`;
    html += '</div>';

    container.innerHTML = html;

    // Store callback globally for onclick
    if (!window._paginationCallbacks) window._paginationCallbacks = {};
    window._paginationCallbacks[containerId] = onPageChange;
}

/**
 * Lấy slice phần tử cho trang hiện tại
 */
function getPageSlice(items, page) {
    const start = (page - 1) * PAGE_SIZE;
    return items.slice(start, start + PAGE_SIZE);
}
