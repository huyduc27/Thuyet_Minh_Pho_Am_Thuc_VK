// ========================================
// User Management Module — Admin Only
// ========================================

let allUserDocs = [];
let usersPage = 1;

async function loadUsers() {
    try {
        const tbody = document.getElementById('usersTableBody');
        tbody.innerHTML = `<tr><td colspan="5"><div class="empty-state"><div class="icon">⏳</div><p>Đang tải dữ liệu...</p></div></td></tr>`;

        // Lấy tất cả user có role = 'owner'
        const snapshot = await db.collection('users').where('role', '==', 'owner').get();
        
        if (snapshot.empty) {
            tbody.innerHTML = `<tr><td colspan="5"><div class="empty-state"><div class="icon">👥</div><p>Chưa có Chủ quán nào đăng ký</p></div></td></tr>`;
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
        const shopCount = user.shopIds ? user.shopIds.length : 0;
        const status = user.status || 'active';
        
        // Format ngày đăng ký
        let createdAt = 'Không xác định';
        if (user.createdAt) {
            createdAt = user.createdAt.toDate().toLocaleDateString('vi-VN', { year: 'numeric', month: '2-digit', day: '2-digit' });
        }

        // Giao diện nhãn trạng thái
        const statusBadge = status === 'active' 
            ? `<span class="category-badge" style="background: rgba(46, 204, 113, 0.15); color: #2ecc71;">Hoạt động</span>`
            : `<span class="category-badge" style="background: rgba(233, 69, 96, 0.15); color: #e94560;">Bị Khóa</span>`;

        // Nút Thao tác
        const toggleActionName = status === 'active' ? 'Khóa' : 'Mở khóa';
        const toggleActionColor = status === 'active' ? 'var(--accent)' : 'var(--success)';
        
        html += `
            <tr>
                <td style="color: var(--text-primary); font-weight: 500;">${user.email || 'N/A'}</td>
                <td>${statusBadge}</td>
                <td><span style="color:var(--accent); font-weight: bold;">${shopCount}</span> quán</td>
                <td>${createdAt}</td>
                <td>
                    <div class="action-btns">
                        <button onclick="toggleUserStatus('${doc.id}', '${status}', '${user.email}')" style="color: ${toggleActionColor}; border-color: ${toggleActionColor};">
                            ${status === 'active' ? '🔒' : '🔓'} ${toggleActionName}
                        </button>
                        <button class="delete" onclick="deleteUser('${doc.id}', '${user.email}')">❌ Xóa</button>
                    </div>
                </td>
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
