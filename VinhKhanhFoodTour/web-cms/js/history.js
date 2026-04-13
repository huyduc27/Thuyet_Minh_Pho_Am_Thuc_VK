// ========================================
// History Module — Lịch sử sử dụng
// ========================================

const sourceLabels = {
    'geofence': '📍 Geofence',
    'manual': '▶️ Thủ công',
    'qr': '📱 QR Code'
};

async function loadHistory() {
    try {
        const snapshot = await db.collection('narrationLogs')
            .orderBy('playedAt', 'desc')
            .limit(100)
            .get();

        const tbody = document.getElementById('historyTableBody');

        if (snapshot.empty) {
            tbody.innerHTML = `<tr><td colspan="4"><div class="empty-state"><div class="icon">📋</div><p>Chưa có lịch sử thuyết minh</p></div></td></tr>`;
            return;
        }

        // Get POI names for display (fallback nếu log cũ không có poiName)
        const poisSnap = await db.collection('pois').get();
        const poiMap = {};
        poisSnap.docs.forEach(doc => {
            poiMap[doc.id] = doc.data().name;
        });

        const langNames = { vi: '🇻🇳 Tiếng Việt', en: '🇺🇸 English', zh: '🇨🇳 中文', ko: '🇰🇷 한국어' };

        tbody.innerHTML = snapshot.docs.map(doc => {
            const log = doc.data();
            const poiName = log.poiName || poiMap[log.poiId] || `POI #${log.poiId}`;
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

        // Cập nhật thống kê nguồn
        updateSourceStats(snapshot.docs);
    } catch (error) {
        console.error('Error loading history:', error);
        showToast('Lỗi tải lịch sử', 'error');
    }
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
        loadDashboardStats();
    } catch (error) {
        console.error('Error clearing history:', error);
        showToast('Lỗi xóa lịch sử', 'error');
    }
}
