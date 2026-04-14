// ========================================
// POI Module — CRUD quản lý điểm ẩm thực
// ========================================

let allPois = [];

async function loadPois() {
    try {
        // 1. Phân quyền truy vấn dữ liệu
        if (window.currentUser && window.currentUser.role === 'owner') {
            // Dành cho CHỦ QUÁN: Dùng cái shopIds mình dán trong Database hồi nãy 
            // để vào kho lấy danh sách quán đó ra.
            if (!window.currentUser.shopIds || window.currentUser.shopIds.length === 0) {
                // Đây là chuyện bình thường với user mới đăng ký, không cần hiển thị thông báo lỗi
                allPois = [];
            } else {
                const promises = window.currentUser.shopIds.map(id => db.collection('pois').doc(id).get());
                const docs = await Promise.all(promises);
                const validDocs = docs.filter(d => d.exists);
                allPois = validDocs.map(doc => ({ id: doc.id, ...doc.data() })); 
            }
        } else {
            // Dành cho ADMIN: Lôi hết tất cả ra
            const snapshot = await db.collection('pois').orderBy('name').get();
            allPois = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        }

        // 2. Chắp vá cái bảng danh sách hiện ra màn hình
        renderPoiTable(allPois);

        // 3. "Phong ấn" các nút Tối Cao nếu là Chủ quán (Giấu nút Thêm, Xóa)
        if (window.currentUser && window.currentUser.role === 'owner') {
            // Hiển thị lại nút [+ Thêm POI] để Chủ Quán có thể tạo Request
            const addBtn = document.querySelector('button[onclick="openPoiModal()"]');
            if (addBtn) addBtn.style.display = 'inline-block';

            // Ẩn thanh tìm kiếm (có mỗi 1 quán thì tìm kiếm cái gì nữa :D)
            const searchBar = document.querySelector('#section-poi .search-bar');
            if (searchBar) searchBar.style.display = 'none';

            // Ẩn luôn nút Thùng rác (Xóa quán) ở thao tác
            document.querySelectorAll('.action-btns .delete').forEach(btn => {
                btn.style.display = 'none';
            });

            // Tải danh sách yêu cầu của Chủ quán
            loadOwnerRequests();
        }

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
    ['poiName', 'poiNameEn', 'poiNameZh', 'poiNameKo', 'poiLat', 'poiLng', 'poiAddress', 'poiRadius', 'poiPriority', 'poiRating', 'poiHours', 'poiDescVi', 'poiDescEn', 'poiDescZh', 'poiDescKo'].forEach(id => {
        document.getElementById(id).value = '';
    });
    document.getElementById('poiRadius').value = '50';
    document.getElementById('poiPriority').value = '3';

    if (editData) {
        document.getElementById('poiModalTitle').textContent = '✏️ Chỉnh sửa POI';
        document.getElementById('poiEditId').value = editData.id;
        document.getElementById('poiName').value = editData.name || '';
        document.getElementById('poiNameEn').value = editData.nameEn || '';
        document.getElementById('poiNameZh').value = editData.nameZh || '';
        document.getElementById('poiNameKo').value = editData.nameKo || '';
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
        document.getElementById('poiDescZh').value = editData.descriptionZh || '';
        document.getElementById('poiDescKo').value = editData.descriptionKo || '';
    }

    // Nếu là Owner: Disable Location, Radius, Priority, Category (Chỉ cho nhập Text)
    if (window.currentUser && window.currentUser.role === 'owner') {
        const disabledIds = ['poiLat', 'poiLng', 'poiAddress', 'poiRadius', 'poiPriority', 'poiCategory', 'poiRating'];
        disabledIds.forEach(id => {
            const el = document.getElementById(id);
            if (el) {
                el.disabled = true;
                el.style.backgroundColor = '#f0f0f0';
            }
        });
        document.getElementById('poiModalTitle').innerHTML += ' <br><small style="color:#e94560; font-size:12px;">(Admin sẽ duyệt thông tin trước khi áp dụng)</small>';
    } else {
        // Trả lại form bình thường cho Admin
        const disabledIds = ['poiLat', 'poiLng', 'poiAddress', 'poiRadius', 'poiPriority', 'poiCategory', 'poiRating'];
        disabledIds.forEach(id => {
            const el = document.getElementById(id);
            if (el) { el.disabled = false; el.style.backgroundColor = ''; }
        });
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
        nameZh: document.getElementById('poiNameZh').value.trim(),
        nameKo: document.getElementById('poiNameKo').value.trim(),
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
        descriptionZh: document.getElementById('poiDescZh').value.trim(),
        descriptionKo: document.getElementById('poiDescKo').value.trim(),
        updatedAt: firebase.firestore.FieldValue.serverTimestamp()
    };

    if (!data.name) {
        showToast('Vui lòng nhập tên quán', 'error');
        return;
    }

    try {
        if (window.currentUser && window.currentUser.role === 'owner') {
            // Luồng của Owner: Bắn Request để chờ duyệt thay vì lưu thẳng
            await db.collection('poiRequests').add({
                type: editId ? 'EDIT' : 'ADD',
                targetPoiId: editId || null,
                requestedData: data,
                status: 'PENDING',
                requestedBy: window.currentUser.email || 'Không rõ email',
                requestedByUid: window.currentUser.uid,
                createdAt: firebase.firestore.FieldValue.serverTimestamp()
            });
            showToast('Đã gửi yêu cầu cho Admin phê duyệt!');
        } else {
            // Luồng của Admin: Lưu thẳng cánh
            if (editId) {
                await db.collection('pois').doc(editId).update(data);
                showToast('Đã cập nhật POI thành công!');
            } else {
                data.createdAt = firebase.firestore.FieldValue.serverTimestamp();
                await db.collection('pois').add(data);
                showToast('Đã thêm POI mới thành công!');
            }
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
        // 1. Xóa POI khỏi bảng danh sách POIs
        await db.collection('pois').doc(id).delete();
        
        // 2. TÌM VÀ DIỆT: Xóa sạch ID của Quán này khỏi túi (shopIds) của tất cả Owner đang giữ nó
        const usersSnap = await db.collection('users').where('shopIds', 'array-contains', id).get();
        if (!usersSnap.empty) {
            const batch = db.batch();
            usersSnap.docs.forEach(doc => {
                batch.update(doc.ref, {
                    shopIds: firebase.firestore.FieldValue.arrayRemove(id)
                });
            });
            await batch.commit(); // Xóa đồng loạt khỏi tất cả user liên quan
        }

        showToast(`Đã xóa "${name}" và làm sạch dữ liệu thành công!`);
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
        // ===== ỐC (Snail Restaurants) =====
        {
            name: "Ốc Oanh 1 - Vĩnh Khánh", nameEn: "Oc Oanh Snail Restaurant", nameZh: "", nameKo: "",
            latitude: 10.76142, longitude: 106.70283, radiusMeters: 80, priority: 5,
            category: "Ốc", address: "534 Vĩnh Khánh, P.8, Q.4",
            descriptionVi: "Ốc Oanh là quán ốc nổi tiếng nhất phố Vĩnh Khánh, được Michelin Guide công nhận. Đặc sản gồm nghêu nướng mỡ hành, sò điệp phô mai, càng ghẹ rang muối ớt. Quán có hơn 50 món ốc và hải sản đa dạng, thường xuyên có hàng dài khách chờ.",
            descriptionEn: "Oc Oanh is the most famous snail restaurant on Vinh Khanh Street, recognized by the Michelin Guide. Specialties include grilled clams with green onion oil, cheese-baked scallops, and salt-chili crab claws. With over 50 dishes, queues are common.",
            descriptionZh: "", descriptionKo: "",
            rating: 4.3, openingHours: "16:00 - 23:00"
        },
        {
            name: "Quán Ốc Sáu Nở", nameEn: "Sau No Snail Restaurant", nameZh: "", nameKo: "",
            latitude: 10.76115, longitude: 106.70275, radiusMeters: 60, priority: 4,
            category: "Ốc", address: "128 Vĩnh Khánh, P.8, Q.4",
            descriptionVi: "Ốc Sáu Nở là một trong những quán ốc lâu đời trên phố ốc Vĩnh Khánh, nằm gần cầu Calmet. Quán phục vụ đa dạng món ốc và hải sản với giá bình dân, không gian thoáng mát phù hợp nhóm bạn.",
            descriptionEn: "Sau No is one of the long-established snail restaurants on Vinh Khanh snail street, near Calmet Bridge. Serves a wide variety of snail and seafood dishes at affordable prices in a breezy open-air setting.",
            descriptionZh: "", descriptionKo: "",
            rating: 3.8, openingHours: "16:00 - 00:00"
        },
        {
            name: "Ốc Thảo - Vĩnh Khánh", nameEn: "Thao Snail Restaurant", nameZh: "", nameKo: "",
            latitude: 10.76171, longitude: 106.70235, radiusMeters: 45, priority: 3,
            category: "Ốc", address: "383 Vĩnh Khánh, P.8, Q.4",
            descriptionVi: "Ốc Thảo là quán ốc và hải sản trên phố Vĩnh Khánh với không gian rộng rãi. Quán phục vụ nhiều loại ốc nướng, hải sản chế biến đa dạng. Giá hợp lý, dễ tìm trên đường Vĩnh Khánh.",
            descriptionEn: "Oc Thao is a spacious snail and seafood restaurant on Vinh Khanh Street. Offers various grilled snail dishes and diverse seafood at reasonable prices.",
            descriptionZh: "", descriptionKo: "",
            rating: 3.5, openingHours: "10:00 - 00:00"
        },
        {
            name: "Ốc Đào 2 - Vĩnh Khánh", nameEn: "Oc Dao 2 Snail Restaurant", nameZh: "", nameKo: "",
            latitude: 10.76098, longitude: 106.70485, radiusMeters: 75, priority: 5,
            category: "Ốc", address: "232/123 Vĩnh Khánh, P.10, Q.4",
            descriptionVi: "Ốc Đào 2 là chi nhánh tại phố ẩm thực Vĩnh Khánh của quán ốc Ốc Đào nổi tiếng (gốc ở Quận 1). Quán nổi tiếng với ốc len xào dừa, nghêu nướng mỡ hành, và răng mực xào bơ. Không gian vỉa hè sôi động.",
            descriptionEn: "Oc Dao 2 is the Vinh Khanh branch of the legendary Oc Dao (original in District 1). Famous for snails in coconut milk, grilled clams with scallion oil, and squid teeth in butter. Lively sidewalk atmosphere.",
            descriptionZh: "", descriptionKo: "",
            rating: 4.1, openingHours: "10:00 - 00:00"
        },
        {
            name: "Quán Ốc Vũ", nameEn: "Vu Snail Restaurant", nameZh: "", nameKo: "",
            latitude: 10.76144, longitude: 106.70267, radiusMeters: 45, priority: 3,
            category: "Ốc", address: "37 Vĩnh Khánh, P.8, Q.4",
            descriptionVi: "Quán Ốc Vũ nằm ở đầu phố Vĩnh Khánh, nổi tiếng với hải sản tươi sống và giá cả bình dân. Nhân viên phục vụ chu đáo, không gian rộng rãi. Đặc biệt đông khách vào cuối tuần.",
            descriptionEn: "Oc Vu is located at the start of Vinh Khanh Street, known for fresh live seafood at very affordable prices. Attentive service and spacious seating. Especially popular on weekends.",
            descriptionZh: "", descriptionKo: "",
            rating: 4.2, openingHours: "15:00 - 22:00"
        },
        // ===== LẨU NƯỚNG =====
        {
            name: "Lãng Quán - Vĩnh Khánh", nameEn: "Lang Quan Restaurant", nameZh: "", nameKo: "",
            latitude: 10.76108, longitude: 106.70550, radiusMeters: 45, priority: 3,
            category: "Lẩu", address: "122/34/31 Vĩnh Khánh, P.10, Q.4",
            descriptionVi: "Lãng Quán là quán lẩu nướng nổi tiếng được ví như 'pub thu nhỏ ở Quận 4'. Phục vụ các món lẩu và nướng đa dạng trong không gian mở thoáng mát.",
            descriptionEn: "Lang Quan is a renowned hotpot and BBQ restaurant on Vinh Khanh food street. Praised as 'District 4 pub with restaurant quality.'",
            descriptionZh: "", descriptionKo: "",
            rating: 4.0, openingHours: "16:00 - 22:00"
        },
        {
            name: "Ớt Xiêm Quán", nameEn: "Ot Xiem (Bird's Eye Chili) Restaurant", nameZh: "", nameKo: "",
            latitude: 10.76096, longitude: 106.70312, radiusMeters: 40, priority: 3,
            category: "Nướng", address: "568 Vĩnh Khánh, P.8, Q.4",
            descriptionVi: "Ớt Xiêm Quán chuyên các món nướng và lẩu kiểu Việt. Nổi tiếng với đậu hủ khói lửa, cánh gà nướng, gà kho và lẩu gà cay. Giá bình dân.",
            descriptionEn: "Ot Xiem specializes in Vietnamese-style grilled and hotpot dishes. Famous for smoky tofu, grilled chicken wings, braised chicken, and spicy chicken hotpot.",
            descriptionZh: "", descriptionKo: "",
            rating: 3.8, openingHours: "16:00 - 00:00"
        },
        {
            name: "Chilli - Lẩu Nướng Tự Chọn", nameEn: "Chilli Self-Select Hotpot & BBQ", nameZh: "", nameKo: "",
            latitude: 10.76079, longitude: 106.70458, radiusMeters: 60, priority: 4,
            category: "Lẩu", address: "232/105 Vĩnh Khánh, P.10, Q.4",
            descriptionVi: "Chilli là quán lẩu nướng tự chọn nổi tiếng giữa phố ẩm thực Vĩnh Khánh. Menu đa dạng gồm lẩu hải sản, bạch tuộc, và đặc biệt dừa hỏa diệm sơn (dừa lửa).",
            descriptionEn: "Chilli is a popular self-select hotpot and BBQ spot in the heart of Vinh Khanh. Diverse menu including seafood hotpot, octopus, and the signature 'fire meteor coconut' dessert.",
            descriptionZh: "", descriptionKo: "",
            rating: 4.3, openingHours: "16:00 - 23:00"
        },
        {
            name: "A Fat Hot Pot - Lẩu HongKong", nameEn: "A Fat Hong Kong Hot Pot & BBQ", nameZh: "", nameKo: "",
            latitude: 10.76066, longitude: 106.70424, radiusMeters: 45, priority: 3,
            category: "Lẩu", address: "668 Vĩnh Khánh, P.8, Q.4",
            descriptionVi: "A Fat Hot Pot là quán lẩu nướng phong cách Hong Kong trên đường Vĩnh Khánh. Có 4 loại nước lẩu, phục vụ bò chất lượng, bạch tuộc, và các món lựa chọn tự do.",
            descriptionEn: "A Fat Hot Pot serves Hong Kong-style hotpot and BBQ on Vinh Khanh Street. Offers 4 types of broth, quality beef, octopus, and self-select sides.",
            descriptionZh: "", descriptionKo: "",
            rating: 4.0, openingHours: "17:00 - 23:00"
        },
        {
            name: "Sườn Muối Ớt - Vĩnh Khánh", nameEn: "Salt & Chili Grilled Ribs", nameZh: "", nameKo: "",
            latitude: 10.76088, longitude: 106.70330, radiusMeters: 35, priority: 3,
            category: "Nướng", address: "Vĩnh Khánh, P.8, Q.4",
            descriptionVi: "Sườn Muối Ớt chuyên sườn heo nướng muối ớt, một trong những món đặc trưng của phố ẩm thực. Sườn nướng than hoa thơm lừng, gia vị đậm đà, kèm rau sống.",
            descriptionEn: "Suon Muoi Ot specializes in salt and chili grilled pork ribs, a signature dish. Charcoal-grilled ribs with rich seasoning, served with fresh vegetables.",
            descriptionZh: "", descriptionKo: "",
            rating: 4.0, openingHours: "16:00 - 23:00"
        },
        {
            name: "Tỷ Muội Quán", nameEn: "Ty Muoi (Sisters) Restaurant", nameZh: "", nameKo: "",
            latitude: 10.76095, longitude: 106.70480, radiusMeters: 40, priority: 3,
            category: "Nướng", address: "232/59 Vĩnh Khánh, P.10, Q.4",
            descriptionVi: "Tỷ Muội Quán là quán nhậu bình dân phục vụ các món nướng, lẩu, gà, bò, heo đa dạng. Mở cửa khuya đến 2 giờ sáng.",
            descriptionEn: "Ty Muoi is a casual Vietnamese eatery serving diverse grilled, hotpot, chicken, beef, and pork dishes. Open late until 2 AM.",
            descriptionZh: "", descriptionKo: "",
            rating: 3.9, openingHours: "16:00 - 02:00"
        },
        {
            name: "Ba Cô Tiên - Quán Ăn Gia Đình", nameEn: "Three Fairies Family Restaurant", nameZh: "", nameKo: "",
            latitude: 10.76164, longitude: 106.70240, radiusMeters: 40, priority: 3,
            category: "Nướng", address: "400 Vĩnh Khánh, P.8, Q.4",
            descriptionVi: "Ba Cô Tiên là quán ăn gia đình trên phố ẩm thực. Phục vụ đa dạng món Việt từ hải sản, nướng, đến các món nhậu bình dân.",
            descriptionEn: "Three Fairies is a family restaurant on Vinh Khanh food street. Serves diverse Vietnamese dishes from seafood and grilled items to casual pub fare.",
            descriptionZh: "", descriptionKo: "",
            rating: 3.8, openingHours: "16:00 - 23:00"
        },
        // ===== HẢI SẢN & TRÁNG MIỆNG =====
        {
            name: "Hải Sản Bé Mặn", nameEn: "Be Man Seafood", nameZh: "", nameKo: "",
            latitude: 10.76150, longitude: 106.70260, radiusMeters: 60, priority: 4,
            category: "Hải sản", address: "466 Vĩnh Khánh, P.8, Q.4",
            descriptionVi: "Hải Sản Bé Mặn nổi tiếng với hải sản tươi sống từ biển về mỗi ngày. Đặc biệt có tôm hùm nướng phô mai, cua sốt trứng muối.",
            descriptionEn: "Be Man Seafood is famous for daily fresh seafood. Highlights include cheese-baked lobster, salted egg crab, and Hong Kong-style steamed grouper.",
            descriptionZh: "", descriptionKo: "",
            rating: 4.5, openingHours: "15:00 - 23:00"
        },
        {
            name: "Cua Biển Tươi Sống", nameEn: "Fresh Live Sea Crab", nameZh: "", nameKo: "",
            latitude: 10.76094, longitude: 106.70316, radiusMeters: 55, priority: 4,
            category: "Hải sản", address: "570 Vĩnh Khánh, P.8, Q.4",
            descriptionVi: "Quán chuyên cua biển tươi sống với nhiều cách chế biến: cua rang me, cua sốt trứng muối, cua hấp bia. Cua được nhập từ Cà Mau, đảm bảo tươi sống mỗi ngày.",
            descriptionEn: "Specializes in live sea crabs: tamarind crab, salted egg yolk crab, beer-steamed crab. Crabs sourced from Ca Mau, guaranteed fresh daily.",
            descriptionZh: "", descriptionKo: "",
            rating: 4.6, openingHours: "15:00 - 23:00"
        },
        {
            name: "Chè Vĩnh Khánh", nameEn: "Vinh Khanh Sweet Soup Dessert", nameZh: "", nameKo: "",
            latitude: 10.76112, longitude: 106.70280, radiusMeters: 30, priority: 2,
            category: "Chè", address: "150 Vĩnh Khánh, P.8, Q.4",
            descriptionVi: "Quán chè mát lành giữa phố ẩm thực nóng bức. Có đa dạng chè như chè Thái, chè ba màu, chè đậu đỏ nước cốt dừa, sương sáo. Điểm dừng chân hoàn hảo sau bữa ốc.",
            descriptionEn: "A refreshing dessert stop amid the hot food street. Offers Thai-style mixed dessert, three-color dessert, grass jelly. Perfect cooldown after seafood.",
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

// ------ LỊCH SỬ YÊU CẦU DÀNH CHO CHỦ QUÁN ------
async function loadOwnerRequests() {
    try {
        const authEmail = window.currentUser ? window.currentUser.email : '';
        const uid = window.currentUser ? window.currentUser.uid : '';
        // Truy vấn xem thẻ có khớp 1 trong 2 giá trị này không
        const query = await db.collection('poiRequests')
            .where('requestedBy', 'in', [authEmail, uid])
            .get();
        if (query.empty) return;

        const requests = query.docs.map(doc => ({id: doc.id, ...doc.data()}));
        // Sắp xếp local để tránh dính lỗi bắt tạo Index trên Firebase
        requests.sort((a, b) => {
            const tA = a.createdAt ? a.createdAt.toMillis() : 0;
            const tB = b.createdAt ? b.createdAt.toMillis() : 0;
            return tB - tA;
        });

        let reqHtml = '<ul style="list-style:none; padding:0; margin:0; display:flex; flex-direction:column; gap:8px;">';

        requests.forEach(req => {
            let statusBadge = '';
            if (req.status === 'PENDING') statusBadge = '<span style="background:#f39c12; color:#fff; padding:3px 8px; border-radius:4px; font-size:11px;">ĐANG CHỜ</span>';
            else if (req.status === 'APPROVED') statusBadge = '<span style="background:#2ecc71; color:#fff; padding:3px 8px; border-radius:4px; font-size:11px;">ĐÃ DUYỆT</span>';
            else if (req.status === 'REJECTED') statusBadge = '<span style="background:#e74c3c; color:#fff; padding:3px 8px; border-radius:4px; font-size:11px;">BỊ TỪ CHỐI</span>';

            const type = req.type === 'ADD' ? 'Thêm mới' : 'Chỉnh sửa';
            const name = req.requestedData?.name || 'Không rõ';

            let rejectInfo = '';
            if (req.status === 'REJECTED' && req.rejectReason) {
                rejectInfo = `<div style="color:#e74c3c; font-size:13px; margin-top:6px; padding-left:12px; border-left:3px solid #e74c3c;"><strong>Lý do từ chối:</strong> ${req.rejectReason}</div>`;
            }

            reqHtml += `
                <li style="border:1px solid #ddd; background:#fafafa; border-radius:8px; padding:12px; margin-bottom:4px;">
                    <div style="display:flex; justify-content:space-between; align-items:center;">
                        <span><strong style="color:var(--accent);">[${type}]</strong> ${name}</span>
                        ${statusBadge}
                    </div>
                    ${rejectInfo}
                    <div style="font-size:11px; color:#888; margin-top:4px;">Tạo lúc: ${req.createdAt ? new Date(req.createdAt.toDate()).toLocaleString('vi-VN') : 'Mới'}</div>
                </li>
            `;
        });

        reqHtml += '</ul>';

        // Đổ vảo Modal container
        const container = document.getElementById('ownerRequestsContainer');
        if (container) container.innerHTML = reqHtml;

        // Hiện nút bấm Notification
        const btn = document.getElementById('btnOwnerRequests');
        if (btn) btn.style.display = 'inline-block';

    } catch(err) {
        console.error('Error load owner requests', err);
    }
}

function openOwnerRequestsModal() {
    document.getElementById('ownerRequestsModal').classList.add('show');
}
function closeOwnerRequestsModal() {
    document.getElementById('ownerRequestsModal').classList.remove('show');
}
