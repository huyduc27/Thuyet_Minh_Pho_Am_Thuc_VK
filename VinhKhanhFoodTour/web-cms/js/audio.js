// ========================================
// Audio Module — Quản lý audio bằng URL
// ========================================

async function loadAudioPoiFilter() {
    try {
        const snapshot = await db.collection('pois').orderBy('name').get();
        const select = document.getElementById('audioPoiFilter');
        const selectModal = document.getElementById('audioPoiSelect');

        select.innerHTML = '<option value="">-- Chọn POI --</option>';
        selectModal.innerHTML = '';

        snapshot.docs.forEach(doc => {
            const poi = doc.data();
            select.innerHTML += `<option value="${doc.id}">${poi.name}</option>`;
            selectModal.innerHTML += `<option value="${doc.id}">${poi.name}</option>`;
        });
    } catch (error) {
        console.error('Error loading POIs for audio:', error);
    }
}

async function loadAudioForPoi() {
    const poiId = document.getElementById('audioPoiFilter').value;
    const container = document.getElementById('audioList');
    const btnAdd = document.getElementById('btnUploadAudio');

    if (!poiId) {
        container.innerHTML = `<div class="empty-state"><div class="icon">🎵</div><p>Chọn một POI để xem audio</p></div>`;
        btnAdd.disabled = true;
        return;
    }

    btnAdd.disabled = false;

    try {
        const snapshot = await db.collection('audioFiles')
            .where('poiId', '==', poiId)
            .orderBy('createdAt', 'desc')
            .get();

        if (snapshot.empty) {
            container.innerHTML = `<div class="empty-state"><div class="icon">🔇</div><p>Chưa có audio cho POI này</p></div>`;
            return;
        }

        const langNames = { vi: '🇻🇳 Tiếng Việt', en: '🇺🇸 English', zh: '🇨🇳 中文', ko: '🇰🇷 한국어' };

        container.innerHTML = snapshot.docs.map(doc => {
            const audio = doc.data();
            return `
                <div class="audio-item">
                    <button class="btn btn-secondary btn-icon" onclick="playAudio('${audio.url}')">▶️</button>
                    <div class="audio-info">
                        <div class="audio-name">${audio.title || 'Audio'}</div>
                        <div class="audio-meta">${langNames[audio.language] || audio.language} • ${formatDate(audio.createdAt)}</div>
                        <div class="audio-meta" style="word-break:break-all; max-width:400px;">${audio.url || ''}</div>
                    </div>
                    <div class="action-btns">
                        <button onclick="editAudio('${doc.id}')">✏️</button>
                        <button class="delete" onclick="deleteAudio('${doc.id}')">🗑️</button>
                    </div>
                </div>
            `;
        }).join('');
    } catch (error) {
        console.error('Error loading audio:', error);
        container.innerHTML = `<div class="empty-state"><p>Lỗi tải audio</p></div>`;
    }
}

function openAudioUpload() {
    const poiId = document.getElementById('audioPoiFilter').value;
    if (!poiId) {
        showToast('Vui lòng chọn POI trước', 'error');
        return;
    }

    document.getElementById('audioPoiSelect').value = poiId;
    document.getElementById('audioEditId').value = '';
    document.getElementById('audioTitle').value = '';
    document.getElementById('audioUrl').value = '';
    document.getElementById('audioLang').value = 'vi';
    document.getElementById('audioModalTitle').textContent = '🎵 Thêm Audio';
    document.getElementById('audioModal').classList.add('show');
}

function closeAudioModal() {
    document.getElementById('audioModal').classList.remove('show');
}

async function editAudio(docId) {
    try {
        const doc = await db.collection('audioFiles').doc(docId).get();
        if (!doc.exists) return;

        const data = doc.data();
        document.getElementById('audioEditId').value = docId;
        document.getElementById('audioPoiSelect').value = data.poiId || '';
        document.getElementById('audioTitle').value = data.title || '';
        document.getElementById('audioUrl').value = data.url || '';
        document.getElementById('audioLang').value = data.language || 'vi';
        document.getElementById('audioModalTitle').textContent = '✏️ Sửa Audio';
        document.getElementById('audioModal').classList.add('show');
    } catch (error) {
        console.error('Error loading audio:', error);
        showToast('Lỗi tải audio', 'error');
    }
}

async function saveAudio() {
    const editId = document.getElementById('audioEditId').value;
    const poiId = document.getElementById('audioPoiSelect').value;
    const title = document.getElementById('audioTitle').value.trim();
    const url = document.getElementById('audioUrl').value.trim();
    const language = document.getElementById('audioLang').value;

    if (!url) {
        showToast('Vui lòng nhập URL audio', 'error');
        return;
    }

    const data = {
        poiId,
        title: title || 'Audio',
        url,
        language,
        updatedAt: firebase.firestore.FieldValue.serverTimestamp()
    };

    try {
        if (editId) {
            await db.collection('audioFiles').doc(editId).update(data);
            showToast('Đã cập nhật audio!');
        } else {
            data.createdAt = firebase.firestore.FieldValue.serverTimestamp();
            await db.collection('audioFiles').add(data);
            showToast('Đã thêm audio mới!');
        }

        closeAudioModal();
        loadAudioForPoi();
        loadDashboardStats();
    } catch (error) {
        console.error('Error saving audio:', error);
        showToast('Lỗi lưu audio: ' + error.message, 'error');
    }
}

function playAudio(url) {
    const audio = new Audio(url);
    audio.play().catch(err => {
        console.error('Play error:', err);
        showToast('Không thể phát audio. Kiểm tra lại URL hoặc quyền truy cập.', 'error');
    });
}

async function deleteAudio(docId) {
    if (!confirm('Xóa audio này?')) return;

    try {
        await db.collection('audioFiles').doc(docId).delete();
        showToast('Đã xóa audio');
        loadAudioForPoi();
        loadDashboardStats();
    } catch (error) {
        console.error('Delete error:', error);
        showToast('Lỗi xóa audio', 'error');
    }
}
