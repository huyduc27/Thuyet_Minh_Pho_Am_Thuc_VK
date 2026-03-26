// ========================================
// Tour Module — Quản lý tour ẩm thực
// ========================================

let tourPois = [];

async function loadTours() {
    try {
        // Load POIs for checklist
        const poisSnap = await db.collection('pois').orderBy('name').get();
        tourPois = poisSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));

        // Load tours
        const toursSnap = await db.collection('tours').orderBy('createdAt', 'desc').get();
        const container = document.getElementById('tourList');

        if (toursSnap.empty) {
            container.innerHTML = `<div class="empty-state"><div class="icon">🗺️</div><p>Chưa có tour nào</p></div>`;
            return;
        }

        container.innerHTML = toursSnap.docs.map(doc => {
            const tour = doc.data();
            const poiNames = (tour.poiIds || []).map(id => {
                const poi = tourPois.find(p => p.id === id);
                return poi ? poi.name : '(Đã xóa)';
            });

            return `
                <div class="translation-card">
                    <h4>🗺️ ${tour.name || 'Tour'}
                        <span style="font-size:12px; color:var(--text-muted); font-weight:normal; margin-left:8px;">
                            ${tour.estimatedMinutes || 60} phút • ${poiNames.length} điểm
                            ${tour.isActive ? '<span style="color:var(--success);">● Đang hoạt động</span>' : '<span style="color:var(--text-muted);">○ Tắt</span>'}
                        </span>
                    </h4>
                    <p style="font-size:13px; color:var(--text-secondary); margin: 8px 0;">${tour.description || ''}</p>
                    <div style="margin: 12px 0;">
                        ${poiNames.map((name, i) => `
                            <div class="tour-poi-item" style="cursor:default;">
                                <span class="order-num">${i + 1}</span>
                                <span class="poi-name">${name}</span>
                            </div>
                        `).join('')}
                    </div>
                    <div class="action-btns" style="margin-top: 12px;">
                        <button onclick="editTour('${doc.id}')">✏️ Sửa</button>
                        <button onclick="toggleTourActive('${doc.id}', ${!tour.isActive})">${tour.isActive ? '⏸️ Tắt' : '▶️ Bật'}</button>
                        <button class="delete" onclick="deleteTour('${doc.id}', '${(tour.name || '').replace(/'/g, "\\'")}')">🗑️ Xóa</button>
                    </div>
                </div>
            `;
        }).join('');
    } catch (error) {
        console.error('Error loading tours:', error);
        showToast('Lỗi tải danh sách tour', 'error');
    }
}

function openTourModal(editData = null) {
    document.getElementById('tourModal').classList.add('show');
    document.getElementById('tourEditId').value = '';
    document.getElementById('tourModalTitle').textContent = '🗺️ Tạo Tour mới';
    document.getElementById('tourName').value = '';
    document.getElementById('tourDesc').value = '';
    document.getElementById('tourDuration').value = '60';

    // Build POI checklist
    const checklist = document.getElementById('tourPoiChecklist');
    checklist.innerHTML = tourPois.map(poi => `
        <label class="tour-poi-item" style="cursor:pointer;">
            <input type="checkbox" value="${poi.id}" style="accent-color: var(--accent); width:16px; height:16px;">
            <span class="poi-name">${poi.name} <span style="color:var(--text-muted); font-size:11px;">${poi.category || ''}</span></span>
        </label>
    `).join('');

    if (editData) {
        document.getElementById('tourModalTitle').textContent = '✏️ Chỉnh sửa Tour';
        document.getElementById('tourEditId').value = editData.id;
        document.getElementById('tourName').value = editData.name || '';
        document.getElementById('tourDesc').value = editData.description || '';
        document.getElementById('tourDuration').value = editData.estimatedMinutes || 60;

        // Check existing POIs
        (editData.poiIds || []).forEach(poiId => {
            const cb = checklist.querySelector(`input[value="${poiId}"]`);
            if (cb) cb.checked = true;
        });
    }
}

function closeTourModal() {
    document.getElementById('tourModal').classList.remove('show');
}

async function editTour(id) {
    try {
        const doc = await db.collection('tours').doc(id).get();
        if (doc.exists) {
            openTourModal({ id: doc.id, ...doc.data() });
        }
    } catch (error) {
        console.error('Error loading tour:', error);
    }
}

async function saveTour() {
    const editId = document.getElementById('tourEditId').value;
    const name = document.getElementById('tourName').value.trim();
    const description = document.getElementById('tourDesc').value.trim();
    const estimatedMinutes = parseInt(document.getElementById('tourDuration').value) || 60;

    if (!name) {
        showToast('Vui lòng nhập tên tour', 'error');
        return;
    }

    // Get selected POI IDs (in order)
    const checklist = document.getElementById('tourPoiChecklist');
    const poiIds = Array.from(checklist.querySelectorAll('input[type="checkbox"]:checked'))
        .map(cb => cb.value);

    if (poiIds.length === 0) {
        showToast('Vui lòng chọn ít nhất 1 POI cho tour', 'error');
        return;
    }

    const data = {
        name,
        description,
        estimatedMinutes,
        poiIds,
        isActive: true,
        updatedAt: firebase.firestore.FieldValue.serverTimestamp()
    };

    try {
        if (editId) {
            await db.collection('tours').doc(editId).update(data);
            showToast('Đã cập nhật tour!');
        } else {
            data.createdAt = firebase.firestore.FieldValue.serverTimestamp();
            await db.collection('tours').add(data);
            showToast('Đã tạo tour mới!');
        }

        closeTourModal();
        loadTours();
        loadDashboardStats();
    } catch (error) {
        console.error('Error saving tour:', error);
        showToast('Lỗi lưu tour: ' + error.message, 'error');
    }
}

async function toggleTourActive(id, isActive) {
    try {
        await db.collection('tours').doc(id).update({ isActive });
        showToast(isActive ? 'Đã bật tour' : 'Đã tắt tour');
        loadTours();
    } catch (error) {
        console.error('Error toggling tour:', error);
        showToast('Lỗi cập nhật tour', 'error');
    }
}

async function deleteTour(id, name) {
    if (!confirm(`Xóa tour "${name}"?`)) return;

    try {
        await db.collection('tours').doc(id).delete();
        showToast(`Đã xóa tour "${name}"`);
        loadTours();
        loadDashboardStats();
    } catch (error) {
        console.error('Error deleting tour:', error);
        showToast('Lỗi xóa tour', 'error');
    }
}
