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
        let allDocs = [];

        if (window.currentUser && window.currentUser.role === 'owner') {
            const shopIds = window.currentUser.shopIds || [];
            if (shopIds.length === 0) {
                const tbody = document.getElementById('historyTableBody');
                tbody.innerHTML = `<tr><td colspan="4"><div class="empty-state"><div class="icon">📋</div><p>Bạn chưa sở hữu quán nào nên không có lịch sử</p></div></td></tr>`;
                return;
            }

            // Chia shopIds thành từng mảng con tối đa 10 phần tử (giới hạn của Firebase 'in' query)
            for (let i = 0; i < shopIds.length; i += 10) {
                const chunk = shopIds.slice(i, i + 10);
                // Lấy tất cả log của các POI này. Không dùng orderBy ở đây để tránh lỗi composite index
                const snapshot = await db.collection('narrationLogs')
                    .where('poiId', 'in', chunk)
                    .get();
                allDocs = allDocs.concat(snapshot.docs);
            }

            // Tự sắp xếp giảm dần ở Local (theo thời gian) 
            allDocs.sort((a, b) => {
                const tA = a.data().playedAt ? a.data().playedAt.toMillis() : 0;
                const tB = b.data().playedAt ? b.data().playedAt.toMillis() : 0;
                return tB - tA;
            });

            // Lấy 100 dòng mới nhất
            allDocs = allDocs.slice(0, 100);

        } else {
            // Admin: Lấy toàn bộ không giới hạn
            const snapshot = await db.collection('narrationLogs')
                .orderBy('playedAt', 'desc')
                .limit(100)
                .get();
            allDocs = snapshot.docs;
        }

        const tbody = document.getElementById('historyTableBody');

        if (allDocs.length === 0) {
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

        tbody.innerHTML = allDocs.map(doc => {
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
        updateSourceStats(allDocs);
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
