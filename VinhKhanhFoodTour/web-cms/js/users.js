// ========================================
// User Management Module — Admin Only
// ========================================

let allOwnerDocs = [];
let allTouristDocs = [];
let filteredOwnerDocs = [];
let filteredTouristDocs = [];

let ownersPage = 1;
let touristsPage = 1;

/**
 * Tính trạng thái online dựa trên lastSeen
 */
function computeOnlineStatus(user) {
    if (user.status === 'disabled') return 'disabled';
    if (user.lastSeen) {
        const diffMs = Date.now() - user.lastSeen.toDate().getTime();
        return diffMs < 2 * 60 * 1000 ? 'active' : 'offline'; // < 2 phút
    }
    // Không có lastSeen (tài khoản cũ) -> dùng status field
    return user.status || 'offline';
}

// ========================
// CHỦ QUÁN (OWNERS)
// ========================

async function loadOwners() {
    try {
        const tbody = document.getElementById('ownersTableBody');
        tbody.innerHTML = `<tr><td colspan="5"><div class="empty-state"><div class="icon">⏳</div><p>Đang tải dữ liệu...</p></div></td></tr>`;

        const snapshot = await db.collection('users').where('role', '==', 'owner').get();
        if (snapshot.empty) {
            tbody.innerHTML = `<tr><td colspan="5"><div class="empty-state"><div class="icon">👑</div><p>Chưa có chủ sở hữu nào</p></div></td></tr>`;
            renderPagination('ownersPagination', 1, 0, () => {});
            return;
        }

        allOwnerDocs = snapshot.docs;
        // Mặc định không có query tìm kiếm lúc đầu
        document.getElementById('searchOwners').value = '';
        filteredOwnerDocs = [...allOwnerDocs];
        ownersPage = 1;
        renderUsersTable('owner');

    } catch (error) {
        console.error('Error loading owners:', error);
        showToast('Lỗi tải danh sách chủ quán', 'error');
    }
}

function onSearchOwners() {
    const query = document.getElementById('searchOwners').value.toLowerCase().trim();
    if (!query) {
        filteredOwnerDocs = [...allOwnerDocs];
    } else {
        filteredOwnerDocs = allOwnerDocs.filter(doc => {
            const user = doc.data();
            const name = (user.displayName || '').toLowerCase();
            const email = (user.email || '').toLowerCase();
            return name.includes(query) || email.includes(query);
        });
    }
    ownersPage = 1;
    renderUsersTable('owner');
}

// ========================
// KHÁCH DU LỊCH (TOURISTS)
// ========================

async function loadTourists() {
    try {
        const tbody = document.getElementById('touristsTableBody');
        tbody.innerHTML = `<tr><td colspan="5"><div class="empty-state"><div class="icon">⏳</div><p>Đang tải dữ liệu...</p></div></td></tr>`;

        const snapshot = await db.collection('users').where('role', '==', 'tourist').get();
        if (snapshot.empty) {
            tbody.innerHTML = `<tr><td colspan="5"><div class="empty-state"><div class="icon">🧳</div><p>Chưa có khách du lịch nào</p></div></td></tr>`;
            renderPagination('touristsPagination', 1, 0, () => {});
            return;
        }

        allTouristDocs = snapshot.docs;
        document.getElementById('searchTourists').value = '';
        filteredTouristDocs = [...allTouristDocs];
        touristsPage = 1;
        renderUsersTable('tourist');

    } catch (error) {
        console.error('Error loading tourists:', error);
        showToast('Lỗi tải danh sách khách', 'error');
    }
}

function onSearchTourists() {
    const query = document.getElementById('searchTourists').value.toLowerCase().trim();
    if (!query) {
        filteredTouristDocs = [...allTouristDocs];
    } else {
        filteredTouristDocs = allTouristDocs.filter(doc => {
            const user = doc.data();
            const name = (user.displayName || '').toLowerCase();
            const email = (user.email || '').toLowerCase();
            return name.includes(query) || email.includes(query);
        });
    }
    touristsPage = 1;
    renderUsersTable('tourist');
}

// ========================
// RENDER BẢNG CHUNG
// ========================

function renderUsersTable(roleType) {
    const isOwner = roleType === 'owner';
    const tbody = document.getElementById(isOwner ? 'ownersTableBody' : 'touristsTableBody');
    const paginationId = isOwner ? 'ownersPagination' : 'touristsPagination';
    
    const docs = isOwner ? filteredOwnerDocs : filteredTouristDocs;
    let currentPage = isOwner ? ownersPage : touristsPage;

    if (docs.length === 0) {
        tbody.innerHTML = `<tr><td colspan="${isOwner ? 6 : 5}"><div class="empty-state"><div class="icon">🔍</div><p>Không tìm thấy kết quả</p></div></td></tr>`;
        renderPagination(paginationId, 1, 0, () => {});
        return;
    }

    const pageItems = getPageSlice(docs, currentPage);
    let html = '';

    pageItems.forEach(doc => {
        const user = doc.data();
        const onlineStatus = computeOnlineStatus(user);
        
        let createdAt = 'Không xác định';
        if (user.createdAt) {
            createdAt = user.createdAt.toDate().toLocaleDateString('vi-VN', { year: 'numeric', month: '2-digit', day: '2-digit' });
        }

        let lastSeenText = 'Chưa có';
        if (user.lastSeen) {
            const diffMs = Date.now() - user.lastSeen.toDate().getTime();
            const diffMin = Math.floor(diffMs / 60000);
            if (diffMin < 1) lastSeenText = 'Vừa xong';
            else if (diffMin < 60) lastSeenText = `${diffMin} phút trước`;
            else lastSeenText = user.lastSeen.toDate().toLocaleTimeString('vi-VN');
        }

        let statusBadge;
        if (onlineStatus === 'active') {
            statusBadge = `<span class="category-badge" style="background:rgba(46,204,113,0.15);color:#2ecc71;">🟢 Online</span>`;
        } else if (onlineStatus === 'disabled') {
            statusBadge = `<span class="category-badge" style="background:rgba(233,69,96,0.15);color:#e94560;">🔒 Bị khóa</span>`;
        } else {
            statusBadge = `<span class="category-badge" style="background:rgba(128,128,128,0.15);color:#888;">⚫ Offline</span>`;
        }

        const roleBadge = isOwner
            ? `<span class="category-badge" style="background:rgba(155,89,182,0.15);color:#9b59b6;">👑 Owner</span>`
            : `<span class="category-badge" style="background:rgba(52,152,219,0.15);color:#3498db;">🧳 Tourist</span>`;

        // Tính số lượng quán (POI) an toàn
        const poiCountTd = isOwner 
            ? `<td><span class="category-badge" style="background:rgba(232,168,56,0.15);color:#e8a838;font-weight:600;">${(user.shopIds || []).length} quán</span></td>` 
            : '';

        // Hành động
        let actionBtns = '';
        if (isOwner) {
            const st = user.status || 'active';
            const toggleName = st === 'active' ? 'Khóa' : 'Mở khóa';
            const toggleColor = st === 'active' ? 'var(--accent)' : 'var(--success)';
            actionBtns += `
                <button onclick="toggleUserStatus('${doc.id}', '${st}', '${user.email}', 'owner')" style="color:${toggleColor};border-color:${toggleColor};">
                    ${st === 'active' ? '🔒' : '🔓'} ${toggleName}
                </button>`;
        }
        actionBtns += `<button class="delete" onclick="deleteUser('${doc.id}', '${user.email}', '${roleType}')">❌ Xóa</button>`;

        html += `
            <tr>
                <td style="color:var(--text-primary);font-weight:500;">
                    ${user.displayName || user.email || 'N/A'}<br>
                    <small style="color:#888;font-weight:400;">${user.email || ''}</small>
                </td>
                <td>${roleBadge}</td>
                ${poiCountTd}
                <td>${statusBadge}<br><small style="color:#888;">${lastSeenText}</small></td>
                <td>${createdAt}</td>
                <td><div class="action-btns">${actionBtns}</div></td>
            </tr>
        `;
    });

    tbody.innerHTML = html;

    renderPagination(paginationId, currentPage, docs.length, (page) => {
        if (isOwner) {
            ownersPage = page;
        } else {
            touristsPage = page;
        }
        renderUsersTable(roleType);
    });
}

// ========================
// TƯƠNG TÁC DỮ LIỆU
// ========================

async function toggleUserStatus(uid, currentStatus, email, roleType) {
    const newStatus = currentStatus === 'active' ? 'disabled' : 'active';
    const actionText = newStatus === 'disabled' ? 'KHÓA' : 'MỞ KHÓA';
    
    if (!confirm(`Bạn có chắc muốn ${actionText} tài khoản của: ${email}?`)) {
        return;
    }

    try {
        await db.collection('users').doc(uid).update({
            status: newStatus,
            updatedAt: firebase.firestore.FieldValue.serverTimestamp()
        });
        showToast(`Đã ${actionText} thành công!`, 'success');
        
        if (roleType === 'owner') loadOwners();
        else loadTourists();
    } catch (error) {
        console.error('Error toggling user status:', error);
        showToast(`Lỗi: ${error.message}`, 'error');
    }
}

async function deleteUser(uid, email, roleType) {
    if (!confirm(`⚠️ CẢNH BÁO: Bạn có chắc muốn xóa tài khoản này (${email}) không? Họ sẽ bị mất toàn bộ quyền truy cập.`)) {
        return;
    }

    try {
        await db.collection('users').doc(uid).delete();
        showToast(`Đã xóa thành công người dùng: ${email}`, 'success');
        
        if (roleType === 'owner') loadOwners();
        else loadTourists();
    } catch (error) {
        console.error('Error deleting user:', error);
        showToast(`Lỗi khi xóa tài khoản: ${error.message}`, 'error');
    }
}
