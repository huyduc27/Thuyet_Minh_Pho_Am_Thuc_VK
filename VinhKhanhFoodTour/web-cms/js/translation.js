// ========================================
// Translation Module — Quản lý bản dịch đa ngôn ngữ
// ========================================

let translationPois = [];

async function loadTranslations() {
    try {
        const snapshot = await db.collection('pois').orderBy('name').get();
        translationPois = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        renderTranslations(translationPois);
    } catch (error) {
        console.error('Error loading translations:', error);
        showToast('Lỗi tải bản dịch', 'error');
    }
}

function renderTranslations(pois) {
    const container = document.getElementById('translationList');

    if (pois.length === 0) {
        container.innerHTML = `<div class="empty-state"><div class="icon">🌐</div><p>Chưa có POI nào để dịch</p></div>`;
        return;
    }

    container.innerHTML = pois.map(poi => `
        <div class="translation-card" id="trans-${poi.id}">
            <h4>📍 ${poi.name || 'Không tên'} <span style="font-size:12px; color:var(--text-muted); font-weight:normal;">${poi.category || ''}</span></h4>

            <!-- Tên -->
            <p style="font-size:12px; color:var(--accent); margin-bottom:8px; font-weight:600;">TÊN QUÁN</p>
            <div class="translation-grid">
                <div class="form-group">
                    <label>🇻🇳 Tiếng Việt</label>
                    <input type="text" value="${escapeHtml(poi.name || '')}" id="name-vi-${poi.id}">
                </div>
                <div class="form-group">
                    <label>🇺🇸 English</label>
                    <input type="text" value="${escapeHtml(poi.nameEn || '')}" id="name-en-${poi.id}">
                </div>
                <div class="form-group">
                    <label>🇨🇳 中文</label>
                    <input type="text" value="${escapeHtml(poi.nameZh || '')}" id="name-zh-${poi.id}" placeholder="Nhập tên tiếng Trung...">
                </div>
                <div class="form-group">
                    <label>🇰🇷 한국어</label>
                    <input type="text" value="${escapeHtml(poi.nameKo || '')}" id="name-ko-${poi.id}" placeholder="Nhập tên tiếng Hàn...">
                </div>
            </div>

            <!-- Mô tả -->
            <p style="font-size:12px; color:var(--accent); margin: 16px 0 8px; font-weight:600;">MÔ TẢ THUYẾT MINH</p>
            <div class="translation-grid">
                <div class="form-group">
                    <label>🇻🇳 Tiếng Việt</label>
                    <textarea id="desc-vi-${poi.id}">${escapeHtml(poi.descriptionVi || '')}</textarea>
                </div>
                <div class="form-group">
                    <label>🇺🇸 English</label>
                    <textarea id="desc-en-${poi.id}">${escapeHtml(poi.descriptionEn || '')}</textarea>
                </div>
                <div class="form-group">
                    <label>🇨🇳 中文</label>
                    <textarea id="desc-zh-${poi.id}" placeholder="Nhập mô tả tiếng Trung...">${escapeHtml(poi.descriptionZh || '')}</textarea>
                </div>
                <div class="form-group">
                    <label>🇰🇷 한국어</label>
                    <textarea id="desc-ko-${poi.id}" placeholder="Nhập mô tả tiếng Hàn...">${escapeHtml(poi.descriptionKo || '')}</textarea>
                </div>
            </div>

            <div style="display: flex; justify-content: flex-end; gap: 8px; margin-top: 12px;">
                <button class="btn btn-secondary btn-sm" id="btn-translate-${poi.id}" onclick="autoTranslate('${poi.id}')">🤖 Dịch tự động (Gemini AI)</button>
                <button class="btn btn-primary btn-sm" onclick="saveTranslation('${poi.id}')">💾 Lưu bản dịch</button>
            </div>
        </div>
    `).join('');
}

function filterTranslations() {
    const search = document.getElementById('transSearch').value.toLowerCase();
    const filtered = translationPois.filter(poi =>
        (poi.name || '').toLowerCase().includes(search) ||
        (poi.nameEn || '').toLowerCase().includes(search)
    );
    renderTranslations(filtered);
}

async function saveTranslation(poiId) {
    try {
        const data = {
            name: document.getElementById(`name-vi-${poiId}`).value.trim(),
            nameEn: document.getElementById(`name-en-${poiId}`).value.trim(),
            nameZh: document.getElementById(`name-zh-${poiId}`).value.trim(),
            nameKo: document.getElementById(`name-ko-${poiId}`).value.trim(),
            descriptionVi: document.getElementById(`desc-vi-${poiId}`).value.trim(),
            descriptionEn: document.getElementById(`desc-en-${poiId}`).value.trim(),
            descriptionZh: document.getElementById(`desc-zh-${poiId}`).value.trim(),
            descriptionKo: document.getElementById(`desc-ko-${poiId}`).value.trim(),
            updatedAt: firebase.firestore.FieldValue.serverTimestamp()
        };

        await db.collection('pois').doc(poiId).update(data);
        showToast('Đã lưu bản dịch thành công!');

        // Update local data
        const idx = translationPois.findIndex(p => p.id === poiId);
        if (idx !== -1) {
            translationPois[idx] = { ...translationPois[idx], ...data };
        }
    } catch (error) {
        console.error('Error saving translation:', error);
        showToast('Lỗi lưu bản dịch: ' + error.message, 'error');
    }
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}
