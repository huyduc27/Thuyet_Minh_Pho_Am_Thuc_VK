// ========================================
// User Management Module — Admin Only
// ========================================

let allUserDocs = [];
let usersPage = 1;

/**
 * Tinh trang thai online dua tren lastSeen:
 * - Neu status == 'disabled'           -> "disabled" (bi khoa boi admin)
 * - Neu co lastSeen < 2 phut truoc     -> "active"   (heartbeat con song)
 * - Neu co lastSeen >= 2 phut truoc    -> "offline"  (heartbeat da mat)
 * - Neu KHONG co lastSeen (tai khoan cu) -> tin thang vao status field
 */
function computeOnlineStatus(user) {
    if (user.status === 'disabled') return 'disabled';
    if (user.lastSeen) {
        const diffMs = Date.now() - user.lastSeen.toDate().getTime();
        return diffMs < 2 * 60 * 1000 ? 'active' : 'offline'; // < 2 phut
    }
    // Khong co lastSeen (tai khoan cu chua cap nhat app) -> dung status field
    return user.status || 'offline';
}

async function loadUsers() {
    try {
        const tbody = document.getElementById('usersTableBody');
        tbody.innerHTML = `<tr><td colspan="5"><div class="empty-state"><div class="icon">⏳</div><p>Đang tải dữ liệu...</p></div></td></tr>`;

        // Load ca owner va tourist
        const snapshot = await db.collection('users').get();
        
        if (snapshot.empty) {
            tbody.innerHTML = `<tr><td colspan="5"><div class="empty-state"><div class="icon">👥</div><p>Chưa có người dùng nào</p></div></td></tr>`;
            renderPagination('usersPagination', 1, 0, () => {});
            return;
        }

        allUserDocs = snapshot.docs;
        usersPage = 1;
        renderUsersTable();

    } catch (error) {
        console.error('Error loading users:', error);
        showToast('Lỗi tải danh sách người dùng', 'error');
    }
}

function renderUsersTable() {
    const tbody = document.getElementById('usersTableBody');
    const pageItems = getPageSlice(allUserDocs, usersPage);

    let html = '';
    pageItems.forEach(doc => {
        const user = doc.data();
        const role = user.role || 'tourist';
        const onlineStatus = computeOnlineStatus(user);
        
        // Format ngay dang ky
        let createdAt = 'Không xác định';
        if (user.createdAt) {
            createdAt = user.createdAt.toDate().toLocaleDateString('vi-VN', { year: 'numeric', month: '2-digit', day: '2-digit' });
        }

        // Format lastSeen
        let lastSeenText = 'Chưa có';
        if (user.lastSeen) {
            const diffMs = Date.now() - user.lastSeen.toDate().getTime();
            const diffMin = Math.floor(diffMs / 60000);
            if (diffMin < 1) lastSeenText = 'Vừa xong';
            else if (diffMin < 60) lastSeenText = `${diffMin} phút trước`;
            else lastSeenText = user.lastSeen.toDate().toLocaleTimeString('vi-VN');
        }

        // Badge trang thai
        let statusBadge;
        if (onlineStatus === 'active') {
            statusBadge = `<span class="category-badge" style="background:rgba(46,204,113,0.15);color:#2ecc71;">🟢 Online</span>`;
        } else if (onlineStatus === 'disabled') {
            statusBadge = `<span class="category-badge" style="background:rgba(233,69,96,0.15);color:#e94560;">🔒 Bị khóa</span>`;
        } else {
            statusBadge = `<span class="category-badge" style="background:rgba(128,128,128,0.15);color:#888;">⚫ Offline</span>`;
        }

        // Role badge
        const roleBadge = role === 'owner'
            ? `<span class="category-badge" style="background:rgba(155,89,182,0.15);color:#9b59b6;">👑 Owner</span>`
            : `<span class="category-badge" style="background:rgba(52,152,219,0.15);color:#3498db;">🧳 Tourist</span>`;

        // Action buttons (chi owner moi co nut khoa)
        let actionBtns = '';
        if (role === 'owner') {
            const st = user.status || 'active';
            const toggleName = st === 'active' ? 'Khóa' : 'Mở khóa';
            const toggleColor = st === 'active' ? 'var(--accent)' : 'var(--success)';
            actionBtns = `
                <button onclick="toggleUserStatus('${doc.id}', '${st}', '${user.email}')" style="color:${toggleColor};border-color:${toggleColor};">
                    ${st === 'active' ? '🔒' : '🔓'} ${toggleName}
                </button>`;
        }
        actionBtns += `<button class="delete" onclick="deleteUser('${doc.id}', '${user.email}')">❌ Xóa</button>`;

        html += `
            <tr>
                <td style="color:var(--text-primary);font-weight:500;">
                    ${user.displayName || user.email || 'N/A'}<br>
                    <small style="color:#888;font-weight:400;">${user.email || ''}</small>
                </td>
                <td>${roleBadge}</td>
                <td>${statusBadge}<br><small style="color:#888;">${lastSeenText}</small></td>
                <td>${createdAt}</td>
                <td><div class="action-btns">${actionBtns}</div></td>
            </tr>
        `;
    });

    tbody.innerHTML = html;

    renderPagination('usersPagination', usersPage, allUserDocs.length, (page) => {
        usersPage = page;
        renderUsersTable();
    });
}

async function toggleUserStatus(uid, currentStatus, email) {
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
        loadUsers();
    } catch (error) {
        console.error('Error toggling user status:', error);
        showToast(`Lỗi: ${error.message}`, 'error');
    }
}

async function deleteUser(uid, email) {
    if (!confirm(`⚠️ CẢNH BÁO: Xóa tài khoản này ra khỏi Database?\n\nNgười dùng (${email}) sẽ không thể đăng nhập vào CMS được nữa. Bạn có chắc chắn?`)) {
        return;
    }

    try {
        await db.collection('users').doc(uid).delete();
        showToast(`Đã xóa thành công Chủ quán: ${email}`, 'success');
        loadUsers();
    } catch (error) {
        console.error('Error deleting user:', error);
        showToast(`Lỗi khi xóa tài khoản: ${error.message}`, 'error');
    }
}
