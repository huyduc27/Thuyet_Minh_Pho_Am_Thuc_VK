// ========================================
// History Module — Lịch sử sử dụng
// ========================================

const sourceLabels = {
    'geofence': '📍 Geofence',
    'manual': '▶️ Thủ công',
    'qr': '📱 QR Code'
};

let allHistoryDocs = [];      // Toàn bộ docs tải về (limit 100)
let filteredHistoryDocs = []; // Dữ liệu sau khi lọc
let historyPoiMap = {};
let historyPage = 1;

async function loadHistory() {
    try {
        allHistoryDocs = [];

        if (window.currentUser && window.currentUser.role === 'owner') {
            const shopIds = window.currentUser.shopIds || [];
            if (shopIds.length === 0) {
                renderEmptyHistory('Bạn chưa sở hữu quán nào nên không có lịch sử');
                return;
            }

            let poiNames = [];
            for (let i = 0; i < shopIds.length; i += 10) {
                const chunk = shopIds.slice(i, i + 10);
                const poiSnap = await db.collection('pois')
                    .where(firebase.firestore.FieldPath.documentId(), 'in', chunk)
                    .get();
                poiSnap.docs.forEach(doc => {
                    const name = doc.data().name;
                    if (name) poiNames.push(name);
                });
            }

            if (poiNames.length === 0) {
                renderEmptyHistory('Không tìm thấy tên quán của bạn');
                return;
            }

            for (let i = 0; i < poiNames.length; i += 10) {
                const chunk = poiNames.slice(i, i + 10);
                const snapshot = await db.collection('narrationLogs')
                    .where('poiName', 'in', chunk)
                    .get();
                allHistoryDocs = allHistoryDocs.concat(snapshot.docs);
            }

            allHistoryDocs.sort((a, b) => {
                const tA = a.data().playedAt ? a.data().playedAt.toMillis() : 0;
                const tB = b.data().playedAt ? b.data().playedAt.toMillis() : 0;
                return tB - tA;
            });
            allHistoryDocs = allHistoryDocs.slice(0, 100);

        } else {
            // Admin: Lấy toàn bộ mới nhất
            const snapshot = await db.collection('narrationLogs')
                .orderBy('playedAt', 'desc')
                .limit(100)
                .get();
            allHistoryDocs = snapshot.docs;
        }

        // Tạo map POI và populate bộ lọc POI
        const poisSnap = await db.collection('pois').get();
        historyPoiMap = {};
        const poiNamesList = [];
        poisSnap.docs.forEach(doc => {
            const name = doc.data().name;
            historyPoiMap[doc.id] = name;
            poiNamesList.push(name);
        });
        populatePoiFilter(poiNamesList);

        // Khởi tạo hiển thị
        filterHistory(); // Tự động gọi lọc lần đầu (đang là rỗng => hiện tất cả)

    } catch (error) {
        console.error('Error loading history:', error);
        showToast('Lỗi tải lịch sử', 'error');
    }
}

function renderEmptyHistory(msg) {
    const tbody = document.getElementById('historyTableBody');
    tbody.innerHTML = `<tr><td colspan="4"><div class="empty-state"><div class="icon">📋</div><p>${msg}</p></div></td></tr>`;
    renderPagination('historyPagination', 1, 0, () => {});
}

function populatePoiFilter(names) {
    const select = document.getElementById('historyPoiFilter');
    if (!select) return;
    const currentVal = select.value;
    select.innerHTML = '<option value="">🔍 Tất cả địa điểm</option>';
    
    // Sắp xếp tên quán A-Z
    names.sort().forEach(name => {
        const opt = document.createElement('option');
        opt.value = name;
        opt.textContent = name;
        select.appendChild(opt);
    });
    select.value = currentVal;
}

/**
 * Hàm lọc dữ liệu Local
 */
function filterHistory() {
    const poiFilter = document.getElementById('historyPoiFilter').value;
    const sourceFilter = document.getElementById('historySourceFilter').value;

    filteredHistoryDocs = allHistoryDocs.filter(doc => {
        const log = doc.data();
        const poiName = log.poiName || historyPoiMap[log.poiId] || '';
        
        const matchPoi = !poiFilter || poiName === poiFilter;
        const matchSource = !sourceFilter || log.source === sourceFilter;
        
        return matchPoi && matchSource;
    });

    historyPage = 1;
    renderHistoryTable();
    updateSourceStats(filteredHistoryDocs);
}

function renderHistoryTable() {
    const tbody = document.getElementById('historyTableBody');
    if (!tbody) return;

    if (filteredHistoryDocs.length === 0) {
        tbody.innerHTML = `<tr><td colspan="4" class="empty-state">Không có lịch sử khớp với bộ lọc</td></tr>`;
        renderPagination('historyPagination', 1, 0, () => {});
        return;
    }

    const langNames = { vi: '🇻🇳 Tiếng Việt', en: '🇺🇸 English', zh: '🇨🇳 中文', ko: '🇰🇷 한국어' };
    const pageItems = getPageSlice(filteredHistoryDocs, historyPage);

    tbody.innerHTML = pageItems.map(doc => {
        const log = doc.data();
        const poiName = log.poiName || historyPoiMap[log.poiId] || `POI #${log.poiId}`;
        const source = sourceLabels[log.source] || log.source || '—';
        return `
            <tr>
                <td style="color: var(--text-primary); font-weight: 500;">${poiName}</td>
                <td>${langNames[log.language] || log.language || '—'}</td>
                <td>${source}</td>
                <td>${formatDate(log.playedAt)}</td>
            </tr>
        `;
    }).join('');

    renderPagination('historyPagination', historyPage, filteredHistoryDocs.length, (page) => {
        historyPage = page;
        renderHistoryTable();
    });
}

function updateSourceStats(docs) {
    const stats = { geofence: 0, manual: 0, qr: 0 };
    docs.forEach(doc => {
        const source = doc.data().source || 'geofence';
        if (stats[source] !== undefined) stats[source]++;
    });

    const el = document.getElementById('historySourceStats');
    if (el) {
        el.innerHTML = `
            <span class="source-stat">📝 Tổng cộng: <strong style="color: #fff;">${docs.length}</strong></span>
            <span style="opacity: 0.3; margin: 0 4px;">|</span>
            <span class="source-stat">📍 Geofence: <strong>${stats.geofence}</strong></span>
            <span class="source-stat">▶️ Thủ công: <strong>${stats.manual}</strong></span>
            <span class="source-stat">📱 QR: <strong>${stats.qr}</strong></span>
        `;
    }
}

async function clearHistory() {
    if (!confirm('Bạn có chắc muốn xóa toàn bộ lịch sử? Thao tác này không thể hoàn tác.')) return;
    try {
        const snapshot = await db.collection('narrationLogs').get();
        const batch = db.batch();
        snapshot.docs.forEach(doc => batch.delete(doc.ref));
        await batch.commit();
        showToast('Đã xóa toàn bộ lịch sử');
        loadHistory();
        if (typeof loadDashboardStats === 'function') loadDashboardStats();
    } catch (error) {
        console.error('Error clearing history:', error);
        showToast('Lỗi xóa lịch sử', 'error');
    }
}
