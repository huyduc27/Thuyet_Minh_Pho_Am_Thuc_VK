// ========================================
// POI Module — CRUD quản lý điểm ẩm thực
// ========================================

let allPois = [];

async function loadPois() {
    try {
        const snapshot = await db.collection('pois').orderBy('name').get();
        allPois = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        renderPoiTable(allPois);
    } catch (error) {
        console.error('Error loading POIs:', error);
        showToast('Lỗi tải danh sách POI', 'error');
    }
}

function renderPoiTable(pois) {
    const tbody = document.getElementById('poiTableBody');

    if (pois.length === 0) {
        tbody.innerHTML = `<tr><td colspan="6"><div class="empty-state"><div class="icon">📍</div><p>Chưa có POI nào</p></div></td></tr>`;
        return;
    }

    const categoryIcons = {
        'Ốc': '🐚', 'Lẩu': '🍲', 'Nướng': '🔥', 'Hải sản': '🦀',
        'Bò': '🥩', 'Cơm': '🍚', 'Ăn vặt': '🍢', 'Chè': '🍧', 'Tráng miệng': '🍨'
    };

    tbody.innerHTML = pois.map(poi => `
        <tr>
            <td style="color: var(--text-primary); font-weight: 500;">${poi.name || ''}</td>
            <td><span class="category-badge">${categoryIcons[poi.category] || '🍽️'} ${poi.category || ''}</span></td>
            <td>${poi.address || ''}</td>
            <td class="rating-stars">${'⭐'.repeat(Math.round(poi.rating || 0))} ${(poi.rating || 0).toFixed(1)}</td>
            <td>${poi.radiusMeters || 50}m</td>
            <td>
                <div class="action-btns">
                    <button onclick="editPoi('${poi.id}')" title="Sửa">✏️</button>
                    <button class="delete" onclick="deletePoi('${poi.id}', '${(poi.name || '').replace(/'/g, "\\'")}')" title="Xóa">🗑️</button>
                </div>
            </td>
        </tr>
    `).join('');
}

function filterPois() {
    const search = document.getElementById('poiSearch').value.toLowerCase();
    const category = document.getElementById('poiCategoryFilter').value;

    const filtered = allPois.filter(poi => {
        const matchSearch = (poi.name || '').toLowerCase().includes(search) ||
                          (poi.address || '').toLowerCase().includes(search);
        const matchCategory = !category || poi.category === category;
        return matchSearch && matchCategory;
    });

    renderPoiTable(filtered);
}

// === Modal ===
function openPoiModal(editData = null) {
    document.getElementById('poiModal').classList.add('show');
    document.getElementById('poiEditId').value = '';
    document.getElementById('poiModalTitle').textContent = '📍 Thêm POI mới';

    // Clear form
    ['poiName', 'poiNameEn', 'poiLat', 'poiLng', 'poiAddress', 'poiRadius', 'poiPriority', 'poiRating', 'poiHours', 'poiDescVi', 'poiDescEn'].forEach(id => {
        document.getElementById(id).value = '';
    });
    document.getElementById('poiRadius').value = '50';
    document.getElementById('poiPriority').value = '3';

    if (editData) {
        document.getElementById('poiModalTitle').textContent = '✏️ Chỉnh sửa POI';
        document.getElementById('poiEditId').value = editData.id;
        document.getElementById('poiName').value = editData.name || '';
        document.getElementById('poiNameEn').value = editData.nameEn || '';
        document.getElementById('poiLat').value = editData.latitude || '';
        document.getElementById('poiLng').value = editData.longitude || '';
        document.getElementById('poiCategory').value = editData.category || 'Ốc';
        document.getElementById('poiRating').value = editData.rating || '';
        document.getElementById('poiAddress').value = editData.address || '';
        document.getElementById('poiRadius').value = editData.radiusMeters || 50;
        document.getElementById('poiPriority').value = editData.priority || 3;
        document.getElementById('poiHours').value = editData.openingHours || '';
        document.getElementById('poiDescVi').value = editData.descriptionVi || '';
        document.getElementById('poiDescEn').value = editData.descriptionEn || '';
    }
}

function closePoiModal() {
    document.getElementById('poiModal').classList.remove('show');
}

async function editPoi(id) {
    const poi = allPois.find(p => p.id === id);
    if (poi) openPoiModal(poi);
}

async function savePoi() {
    const editId = document.getElementById('poiEditId').value;

    const data = {
        name: document.getElementById('poiName').value.trim(),
        nameEn: document.getElementById('poiNameEn').value.trim(),
        nameZh: '',
        nameKo: '',
        latitude: parseFloat(document.getElementById('poiLat').value) || 0,
        longitude: parseFloat(document.getElementById('poiLng').value) || 0,
        category: document.getElementById('poiCategory').value,
        rating: parseFloat(document.getElementById('poiRating').value) || 0,
        address: document.getElementById('poiAddress').value.trim(),
        radiusMeters: parseInt(document.getElementById('poiRadius').value) || 50,
        priority: parseInt(document.getElementById('poiPriority').value) || 3,
        openingHours: document.getElementById('poiHours').value.trim(),
        descriptionVi: document.getElementById('poiDescVi').value.trim(),
        descriptionEn: document.getElementById('poiDescEn').value.trim(),
        descriptionZh: '',
        descriptionKo: '',
        updatedAt: firebase.firestore.FieldValue.serverTimestamp()
    };

    if (!data.name) {
        showToast('Vui lòng nhập tên quán', 'error');
        return;
    }

    try {
        if (editId) {
            await db.collection('pois').doc(editId).update(data);
            showToast('Đã cập nhật POI thành công!');
        } else {
            data.createdAt = firebase.firestore.FieldValue.serverTimestamp();
            await db.collection('pois').add(data);
            showToast('Đã thêm POI mới thành công!');
        }

        closePoiModal();
        loadPois();
        loadDashboardStats();
    } catch (error) {
        console.error('Error saving POI:', error);
        showToast('Lỗi lưu POI: ' + error.message, 'error');
    }
}

async function deletePoi(id, name) {
    if (!confirm(`Bạn có chắc muốn xóa "${name}"?`)) return;

    try {
        await db.collection('pois').doc(id).delete();
        showToast(`Đã xóa "${name}"`);
        loadPois();
        loadDashboardStats();
    } catch (error) {
        console.error('Error deleting POI:', error);
        showToast('Lỗi xóa POI', 'error');
    }
}

// === Seed data from app to Firestore ===
async function seedPoisToFirestore() {
    const existing = await db.collection('pois').get();
    if (existing.size > 0) {
        if (!confirm(`Đã có ${existing.size} POI. Bạn có muốn thêm dữ liệu mẫu?`)) return;
    }

    const seedData = [
        {
            name: "Ốc Oanh 1 - Vĩnh Khánh", nameEn: "Oc Oanh Snail Restaurant", nameZh: "", nameKo: "",
            latitude: 10.76142, longitude: 106.70283, radiusMeters: 80, priority: 5,
            category: "Ốc", address: "534 Vĩnh Khánh, P.8, Q.4",
            descriptionVi: "Ốc Oanh là quán ốc nổi tiếng nhất phố Vĩnh Khánh, được Michelin Guide công nhận. Đặc sản gồm nghêu nướng mỡ hành, sò điệp phô mai, càng ghẹ rang muối ớt.",
            descriptionEn: "Oc Oanh is the most famous snail restaurant on Vinh Khanh Street, recognized by the Michelin Guide.",
            descriptionZh: "", descriptionKo: "",
            rating: 4.3, openingHours: "16:00 - 23:00"
        },
        {
            name: "Quán Ốc Sáu Nở", nameEn: "Sau No Snail Restaurant", nameZh: "", nameKo: "",
            latitude: 10.76115, longitude: 106.70275, radiusMeters: 60, priority: 4,
            category: "Ốc", address: "128 Vĩnh Khánh, P.8, Q.4",
            descriptionVi: "Ốc Sáu Nở là một trong những quán ốc lâu đời trên phố ốc Vĩnh Khánh.",
            descriptionEn: "Sau No is one of the long-established snail restaurants on Vinh Khanh snail street.",
            descriptionZh: "", descriptionKo: "",
            rating: 3.8, openingHours: "16:00 - 00:00"
        },
        {
            name: "Hải Sản Bé Mặn", nameEn: "Be Man Seafood", nameZh: "", nameKo: "",
            latitude: 10.76150, longitude: 106.70260, radiusMeters: 60, priority: 4,
            category: "Hải sản", address: "466 Vĩnh Khánh, P.8, Q.4",
            descriptionVi: "Hải Sản Bé Mặn nổi tiếng với hải sản tươi sống từ biển về mỗi ngày.",
            descriptionEn: "Be Man Seafood is famous for daily fresh seafood.",
            descriptionZh: "", descriptionKo: "",
            rating: 4.5, openingHours: "15:00 - 23:00"
        },
        {
            name: "Chilli - Lẩu Nướng Tự Chọn", nameEn: "Chilli Self-Select Hotpot & BBQ", nameZh: "", nameKo: "",
            latitude: 10.76079, longitude: 106.70458, radiusMeters: 60, priority: 4,
            category: "Lẩu", address: "232/105 Vĩnh Khánh, P.10, Q.4",
            descriptionVi: "Chilli là quán lẩu nướng tự chọn nổi tiếng giữa phố ẩm thực Vĩnh Khánh.",
            descriptionEn: "Chilli is a popular self-select hotpot and BBQ spot in the heart of Vinh Khanh.",
            descriptionZh: "", descriptionKo: "",
            rating: 4.3, openingHours: "16:00 - 23:00"
        },
        {
            name: "Chè Vĩnh Khánh", nameEn: "Vinh Khanh Sweet Soup Dessert", nameZh: "", nameKo: "",
            latitude: 10.76112, longitude: 106.70280, radiusMeters: 30, priority: 2,
            category: "Chè", address: "150 Vĩnh Khánh, P.8, Q.4",
            descriptionVi: "Quán chè mát lành giữa phố ẩm thực nóng bức.",
            descriptionEn: "A refreshing dessert stop amid the hot food street.",
            descriptionZh: "", descriptionKo: "",
            rating: 3.9, openingHours: "14:00 - 23:00"
        }
    ];

    try {
        const batch = db.batch();
        for (const poi of seedData) {
            const ref = db.collection('pois').doc();
            batch.set(ref, {
                ...poi,
                createdAt: firebase.firestore.FieldValue.serverTimestamp(),
                updatedAt: firebase.firestore.FieldValue.serverTimestamp()
            });
        }
        await batch.commit();
        showToast(`Đã thêm ${seedData.length} POI mẫu!`);
        loadPois();
        loadDashboardStats();
    } catch (error) {
        console.error('Seed error:', error);
        showToast('Lỗi seed data: ' + error.message, 'error');
    }
}
