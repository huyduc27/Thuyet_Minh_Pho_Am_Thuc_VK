// ========================================
// Approvals Module — Duyệt yêu cầu từ Owner
// ========================================

let allRequests = [];

async function loadApprovals() {
    const tbody = document.getElementById('approvalsTableBody');
    if (!tbody) return;

    tbody.innerHTML = `<tr><td colspan="6" class="empty-state"><div class="loading-overlay"><span class="loading-spinner"></span> Đang tải yêu cầu...</div></td></tr>`;

    try {
        const snapshot = await db.collection('poiRequests')
            .where('status', '==', 'PENDING')
            .get();

        allRequests = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        // Sắp xếp local để tránh dính lỗi bắt tạo Index trên Firebase
        allRequests.sort((a, b) => {
            const tA = a.createdAt ? a.createdAt.toMillis() : 0;
            const tB = b.createdAt ? b.createdAt.toMillis() : 0;
            return tB - tA;
        });
        renderApprovalsTable(allRequests);
        
        // Also update the dashboard stat if it exists, or a badge
    } catch (error) {
        console.error('Error loading approvals:', error);
        tbody.innerHTML = `<tr><td colspan="6"><div class="empty-state"><p>Lỗi tải dữ liệu: Vui lòng check console F12</p></div></td></tr>`;
        showToast('Lỗi tải danh sách yêu cầu', 'error');
    }
}

function renderApprovalsTable(requests) {
    const tbody = document.getElementById('approvalsTableBody');
    if (!tbody) return;

    if (requests.length === 0) {
        tbody.innerHTML = `<tr><td colspan="6"><div class="empty-state"><div class="icon">✅</div><p>Không có yêu cầu nào chờ duyệt</p></div></td></tr>`;
        return;
    }

    tbody.innerHTML = requests.map(req => {
        const date = req.createdAt ? new Date(req.createdAt.toDate()).toLocaleString('vi-VN') : 'Mới';
        const typeLabel = req.type === 'ADD' ? '<span class="category-badge" style="background:#2ecc71;color:#fff;">Thêm Mới</span>' : '<span class="category-badge" style="background:#3498db;color:#fff;">Chỉnh Sửa</span>';
        const poiName = (req.requestedData && req.requestedData.name) ? escapeHtml(req.requestedData.name) : 'Không tên';

        return `
            <tr>
                <td style="font-size:12px;">${req.requestedBy || 'Không rõ'}</td>
                <td>${typeLabel}</td>
                <td style="font-weight: 500;">${poiName}</td>
                <td style="font-size:12px; color:var(--text-muted);">${date}</td>
                <td><span style="color:#f39c12;font-weight:bold;">Đang chờ</span></td>
                <td>
                    <div class="action-btns" style="gap:4px;">
                        <button onclick="approveRequest('${req.id}')" title="Chấp nhận" style="background:#2ecc71;color:#fff;border-radius:4px;padding:4px 8px;">✔️</button>
                        <button onclick="openRejectModal('${req.id}')" title="Từ chối" style="background:#e74c3c;color:#fff;border-radius:4px;padding:4px 8px;">❌</button>
                    </div>
                </td>
            </tr>
        `;
    }).join('');
}

async function approveRequest(reqId) {
    if (!confirm('Bạn có chắc muốn CHẤP NHẬN yêu cầu này? Dữ liệu sẽ được lưu chính thức vào hệ thống.')) return;

    try {
        const reqDoc = await db.collection('poiRequests').doc(reqId).get();
        if (!reqDoc.exists) return showToast('Yêu cầu không tồn tại', 'error');

        const reqData = reqDoc.data();
        const poiData = reqData.requestedData;
        poiData.updatedAt = firebase.firestore.FieldValue.serverTimestamp();

        let newPoiId = reqData.targetPoiId;

        // Lưu vào POI content
        if (reqData.type === 'ADD') {
            poiData.createdAt = firebase.firestore.FieldValue.serverTimestamp();
            const res = await db.collection('pois').add(poiData);
            newPoiId = res.id;

            // Nạp shopId vào tài khoản owner
            let ownerUid = reqData.requestedByUid;
            if (!ownerUid && reqData.requestedBy) {
                // Phòng trường hợp request cũ chỉ lưu email
                const userSnap = await db.collection('users').where('email', '==', reqData.requestedBy).get();
                if (!userSnap.empty) {
                    ownerUid = userSnap.docs[0].id;
                }
            }

            if (ownerUid) {
                const ownerRef = db.collection('users').doc(ownerUid);
                try {
                    await ownerRef.update({
                        shopIds: firebase.firestore.FieldValue.arrayUnion(newPoiId)
                    });
                } catch (e) {
                    console.error("Lỗi gán shopId vào tài khoản:", e);
                }
            }
        } else if (reqData.type === 'EDIT' && reqData.targetPoiId) {
            await db.collection('pois').doc(reqData.targetPoiId).update(poiData);
        }

        // Cập nhật lại status của request
        await db.collection('poiRequests').doc(reqId).update({
            status: 'APPROVED',
            processedAt: firebase.firestore.FieldValue.serverTimestamp()
        });

        showToast('Đã PHÊ DUYỆT yêu cầu thành công!');
        loadApprovals(); // load lại bảng
        if (typeof loadDashboardStats === 'function') loadDashboardStats();

    } catch (error) {
        console.error('Lỗi khi duyệt yêu cầu:', error);
        showToast('Có lỗi xảy ra: ' + error.message, 'error');
    }
}

// ------ Từ chối (Reject) ------
function openRejectModal(reqId) {
    document.getElementById('rejectReqId').value = reqId;
    document.getElementById('rejectReasonText').value = '';
    document.getElementById('rejectReasonModal').classList.add('show');
}

function closeRejectModal() {
    document.getElementById('rejectReasonModal').classList.remove('show');
}

async function confirmReject() {
    const reqId = document.getElementById('rejectReqId').value;
    const reason = document.getElementById('rejectReasonText').value.trim();

    if (!reason) {
        return showToast('Vui lòng nhập lý do từ chối!', 'error');
    }

    try {
        await db.collection('poiRequests').doc(reqId).update({
            status: 'REJECTED',
            rejectReason: reason,
            processedAt: firebase.firestore.FieldValue.serverTimestamp()
        });

        showToast('Đã TỪ CHỐI yêu cầu!');
        closeRejectModal();
        loadApprovals(); 
    } catch (error) {
        console.error('Lỗi khi từ chối yêu cầu:', error);
        showToast('Có lỗi xảy ra: ' + error.message, 'error');
    }
}
