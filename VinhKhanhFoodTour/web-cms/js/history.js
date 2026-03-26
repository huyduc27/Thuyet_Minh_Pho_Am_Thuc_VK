// ========================================
// History Module — Lịch sử sử dụng
// ========================================

async function loadHistory() {
    try {
        const snapshot = await db.collection('narrationLogs')
            .orderBy('playedAt', 'desc')
            .limit(100)
            .get();

        const tbody = document.getElementById('historyTableBody');

        if (snapshot.empty) {
            tbody.innerHTML = `<tr><td colspan="3"><div class="empty-state"><div class="icon">📋</div><p>Chưa có lịch sử thuyết minh</p></div></td></tr>`;
            return;
        }

        // Get POI names for display
        const poisSnap = await db.collection('pois').get();
        const poiMap = {};
        poisSnap.docs.forEach(doc => {
            poiMap[doc.id] = doc.data().name;
        });

        const langNames = { vi: '🇻🇳 Tiếng Việt', en: '🇺🇸 English', zh: '🇨🇳 中文', ko: '🇰🇷 한국어' };

        tbody.innerHTML = snapshot.docs.map(doc => {
            const log = doc.data();
            const poiName = poiMap[log.poiId] || log.poiName || `POI #${log.poiId}`;
            return `
                <tr>
                    <td style="color: var(--text-primary); font-weight: 500;">${poiName}</td>
                    <td>${langNames[log.language] || log.language || '—'}</td>
                    <td>${formatDate(log.playedAt)}</td>
                </tr>
            `;
        }).join('');
    } catch (error) {
        console.error('Error loading history:', error);
        showToast('Lỗi tải lịch sử', 'error');
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
