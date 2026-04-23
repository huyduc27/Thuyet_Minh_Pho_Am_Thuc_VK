// ========================================
// QR Code Module — Tạo mã QR cho từng POI
// Sử dụng thư viện qrcode.js (CDN) để render trực tiếp trên browser
// ========================================

let allQrPois = [];
let qrPage = 1;

// Base URL cho trang nghe — tự nhận diện cả local (file://) lẫn hosted (http://)
const QR_BASE_URL = window.location.origin !== 'null'
    ? window.location.origin
    : window.location.href.substring(0, window.location.href.lastIndexOf('/'));

/**
 * Load danh sách POI và tạo QR code cho từng quán
 */
async function loadQrCodes() {
    const container = document.getElementById('qrCodeGrid');
    if (!container) return;

    container.innerHTML = '<div class="loading-overlay"><span class="loading-spinner"></span> Đang tạo mã QR...</div>';

    try {
        let snapshot;
        if (window.currentUser && window.currentUser.role === 'owner') {
            if (window.currentUser.shopIds && window.currentUser.shopIds.length > 0) {
                const promises = window.currentUser.shopIds.map(id => db.collection('pois').doc(id).get());
                const docs = await Promise.all(promises);
                const validDocs = docs.filter(d => d.exists);
                snapshot = { empty: validDocs.length === 0, docs: validDocs, size: validDocs.length };
            } else {
                snapshot = { empty: true, docs: [], size: 0 };
            }
        } else {
            snapshot = await db.collection('pois').orderBy('name').get();
        }

        if (snapshot.empty) {
            container.innerHTML = `<div class="empty-state"><div class="icon">📱</div><p>Chưa có POI nào để tạo QR</p></div>`;
            renderPagination('qrPagination', 1, 0, () => {});
            return;
        }

        allQrPois = snapshot.docs;
        qrPage = 1;
        renderQrPage();

        // Cập nhật counter
        document.getElementById('qrCount').textContent = snapshot.size;

    } catch (error) {
        console.error('Error generating QR codes:', error);
        container.innerHTML = `<div class="empty-state"><p>Lỗi tạo QR: ${error.message}</p></div>`;
    }
}

function renderQrPage() {
    const container = document.getElementById('qrCodeGrid');
    container.innerHTML = '';

    const pageItems = getPageSlice(allQrPois, qrPage);

    pageItems.forEach(doc => {
        const poi = doc.data();
        const poiId = doc.id;
        const listenUrl = `${QR_BASE_URL}/checkout.html?id=${poiId}`;

        // Tạo card chứa QR
        const card = document.createElement('div');
        card.className = 'qr-card';
        card.innerHTML = `
            <div class="qr-card-header">
                <span class="qr-poi-name">${poi.name || 'Không tên'}</span>
                <span class="qr-category-badge">${getCategoryIcon(poi.category)} ${poi.category || ''}</span>
            </div>
            <div class="qr-canvas-wrapper" id="qr-wrapper-${poiId}"></div>
            <div class="qr-url-display">${listenUrl}</div>
            <div class="qr-actions">
                <button class="btn btn-sm btn-primary" onclick="downloadQr('${poiId}', '${(poi.name || '').replace(/'/g, "\\'")}')">
                    ⬇️ Tải PNG
                </button>
                <button class="btn btn-sm btn-secondary" onclick="copyQrUrl('${poiId}')">
                    📋 Copy URL
                </button>
                <button class="btn btn-sm btn-secondary" onclick="printSingleQr('${poiId}', '${(poi.name || '').replace(/'/g, "\\'")}')">
                    🖨️ In
                </button>
            </div>
        `;
        container.appendChild(card);

        // Render QR code vào wrapper
        const wrapper = document.getElementById(`qr-wrapper-${poiId}`);
        new QRCode(wrapper, {
            text: listenUrl,
            width: 200,
            height: 200,
            colorDark: '#1a1a2e',
            colorLight: '#ffffff',
            correctLevel: QRCode.CorrectLevel.H  // Cao nhất — in ấn tốt
        });
    });

    renderPagination('qrPagination', qrPage, allQrPois.length, (page) => {
        qrPage = page;
        renderQrPage();
    });
}

/**
 * Lấy icon theo category
 */
function getCategoryIcon(category) {
    const icons = {
        'Ốc': '🐚', 'Lẩu': '🍲', 'Nướng': '🔥', 'Hải sản': '🦀',
        'Bò': '🥩', 'Cơm': '🍚', 'Ăn vặt': '🍢', 'Chè': '🍧', 'Tráng miệng': '🍨'
    };
    return icons[category] || '🍽️';
}

/**
 * Tải xuống QR code dưới dạng PNG
 */
function downloadQr(poiId, poiName) {
    const wrapper = document.getElementById(`qr-wrapper-${poiId}`);
    if (!wrapper) return;

    const canvas = wrapper.querySelector('canvas');
    if (!canvas) {
        showToast('Không tìm thấy QR code', 'error');
        return;
    }

    // Tạo canvas mới có label tên quán phía dưới
    const exportCanvas = document.createElement('canvas');
    const padding = 20;
    const labelHeight = 40;
    exportCanvas.width = canvas.width + padding * 2;
    exportCanvas.height = canvas.height + padding * 2 + labelHeight;

    const ctx = exportCanvas.getContext('2d');

    // Background trắng
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, exportCanvas.width, exportCanvas.height);

    // Vẽ QR
    ctx.drawImage(canvas, padding, padding);

    // Vẽ tên quán
    ctx.fillStyle = '#1a1a2e';
    ctx.font = 'bold 14px Arial, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(poiName, exportCanvas.width / 2, canvas.height + padding + 25);

    // Tải xuống
    const link = document.createElement('a');
    const safeName = poiName.replace(/[^a-zA-Z0-9\u00C0-\u024F\u1E00-\u1EFF]/g, '_');
    link.download = `QR_${safeName}.png`;
    link.href = exportCanvas.toDataURL('image/png');
    link.click();

    showToast(`Đã tải QR: ${poiName}`);
}

/**
 * Copy URL listen vào clipboard
 */
function copyQrUrl(poiId) {
    const url = `${QR_BASE_URL}/listen.html?id=${poiId}`;
    navigator.clipboard.writeText(url).then(() => {
        showToast('Đã copy URL!');
    }).catch(() => {
        // Fallback cho trình duyệt cũ
        const input = document.createElement('input');
        input.value = url;
        document.body.appendChild(input);
        input.select();
        document.execCommand('copy');
        document.body.removeChild(input);
        showToast('Đã copy URL!');
    });
}

/**
 * In một QR code đơn lẻ
 */
function printSingleQr(poiId, poiName) {
    const wrapper = document.getElementById(`qr-wrapper-${poiId}`);
    if (!wrapper) return;

    const canvas = wrapper.querySelector('canvas');
    if (!canvas) return;

    const printWindow = window.open('', '_blank');
    printWindow.document.write(`
        <!DOCTYPE html>
        <html>
        <head>
            <title>QR - ${poiName}</title>
            <style>
                body { 
                    display: flex; flex-direction: column; align-items: center; 
                    justify-content: center; min-height: 100vh; margin: 0;
                    font-family: Arial, sans-serif; 
                }
                .qr-print { text-align: center; }
                .qr-print img { width: 250px; height: 250px; }
                .qr-print h2 { margin: 12px 0 4px; font-size: 18px; color: #1a1a2e; }
                .qr-print p { margin: 0; font-size: 11px; color: #888; }
                .qr-print .brand { margin-top: 8px; font-size: 13px; color: #e94560; font-weight: bold; }
            </style>
        </head>
        <body>
            <div class="qr-print">
                <img src="${canvas.toDataURL('image/png')}" alt="QR Code">
                <h2>${poiName}</h2>
                <p>Quét mã QR để nghe thuyết minh</p>
                <div class="brand">🍜 Phố Ẩm Thực Vĩnh Khánh</div>
            </div>
            <script>window.onload = () => { window.print(); window.close(); }<\/script>
        </body>
        </html>
    `);
    printWindow.document.close();
}

/**
 * Tải tất cả QR codes (lần lượt trigger download cho từng file)
 */
async function downloadAllQrCodes() {
    const wrappers = document.querySelectorAll('[id^="qr-wrapper-"]');
    if (wrappers.length === 0) {
        showToast('Chưa có QR code nào', 'error');
        return;
    }

    showToast(`Đang tải ${wrappers.length} mã QR...`);

    for (const wrapper of wrappers) {
        const poiId = wrapper.id.replace('qr-wrapper-', '');
        const card = wrapper.closest('.qr-card');
        const poiName = card?.querySelector('.qr-poi-name')?.textContent || poiId;

        downloadQr(poiId, poiName);

        // Delay nhẹ giữa các lần download để trình duyệt không block
        await new Promise(resolve => setTimeout(resolve, 300));
    }

    showToast(`Đã tải xong ${wrappers.length} mã QR!`);
}

/**
 * In tất cả QR codes trên 1 trang (grid layout)
 */
function printAllQrCodes() {
    const cards = document.querySelectorAll('.qr-card');
    if (cards.length === 0) {
        showToast('Chưa có QR code nào', 'error');
        return;
    }

    let qrItems = '';
    cards.forEach(card => {
        const canvas = card.querySelector('canvas');
        const name = card.querySelector('.qr-poi-name')?.textContent || '';
        if (canvas) {
            qrItems += `
                <div class="qr-item">
                    <img src="${canvas.toDataURL('image/png')}" alt="QR">
                    <div class="name">${name}</div>
                    <div class="hint">Quét để nghe thuyết minh</div>
                </div>
            `;
        }
    });

    const printWindow = window.open('', '_blank');
    printWindow.document.write(`
        <!DOCTYPE html>
        <html>
        <head>
            <title>QR Codes - Phố Ẩm Thực Vĩnh Khánh</title>
            <style>
                * { box-sizing: border-box; margin: 0; padding: 0; }
                body { font-family: Arial, sans-serif; padding: 20px; }
                h1 { text-align: center; margin-bottom: 20px; font-size: 20px; color: #1a1a2e; }
                .grid { 
                    display: grid; 
                    grid-template-columns: repeat(3, 1fr); 
                    gap: 24px; 
                    max-width: 800px; 
                    margin: 0 auto; 
                }
                .qr-item { 
                    text-align: center; 
                    border: 1px solid #eee; 
                    border-radius: 8px; 
                    padding: 16px; 
                    break-inside: avoid; 
                }
                .qr-item img { width: 150px; height: 150px; }
                .qr-item .name { font-weight: bold; font-size: 12px; margin-top: 8px; color: #1a1a2e; }
                .qr-item .hint { font-size: 10px; color: #888; margin-top: 4px; }
                @media print {
                    .grid { grid-template-columns: repeat(3, 1fr); }
                }
            </style>
        </head>
        <body>
            <h1>🍜 Mã QR — Phố Ẩm Thực Vĩnh Khánh</h1>
            <div class="grid">${qrItems}</div>
            <script>window.onload = () => { window.print(); }<\/script>
        </body>
        </html>
    `);
    printWindow.document.close();
}

// ========================================
// MÃ QR TỔNG (CHUNG) — Trỏ về trang menu.html
// ========================================

/**
 * Mở modal hiển thị mã QR Tổng (chung cho cả phố)
 */
function generateMasterQr() {
    const masterUrl = `${QR_BASE_URL}/menu.html`;

    // Tạo modal overlay
    let modal = document.getElementById('masterQrModal');
    if (modal) modal.remove(); // Xoá modal cũ nếu có

    modal = document.createElement('div');
    modal.id = 'masterQrModal';
    modal.className = 'modal-overlay';
    modal.innerHTML = `
        <div class="modal" style="max-width: 420px; text-align: center;">
            <h2 style="margin-bottom: 6px; justify-content: center;">🔲 Mã QR Tổng — Phố Vĩnh Khánh</h2>
            <p style="color: var(--text-muted); font-size: 13px; margin-bottom: 18px;">
                Khách quét mã này sẽ thấy <strong>danh sách toàn bộ quán ăn</strong>, tự chọn quán → thanh toán → nghe audio.
            </p>
            <div id="masterQrWrapper" style="
                background: #fff; border-radius: 16px; padding: 20px;
                display: inline-block; margin-bottom: 14px;
                box-shadow: 0 8px 24px rgba(0,0,0,0.3);
            "></div>
            <div style="font-size: 12px; color: var(--text-muted); margin-bottom: 16px; word-break: break-all;">
                ${masterUrl}
            </div>
            <div style="display: flex; gap: 8px; justify-content: center; flex-wrap: wrap;">
                <button class="btn btn-primary btn-sm" onclick="downloadMasterQr()">⬇️ Tải PNG</button>
                <button class="btn btn-secondary btn-sm" onclick="printMasterQr()">🖨️ In</button>
                <button class="btn btn-secondary btn-sm" onclick="copyMasterQrUrl()">📋 Copy URL</button>
                <button class="btn btn-secondary btn-sm" onclick="closeMasterQrModal()">❌ Đóng</button>
            </div>
        </div>
    `;

    document.body.appendChild(modal);

    // Trigger CSS transition: thêm class 'show' sau 1 frame để animation chạy mượt
    requestAnimationFrame(() => {
        modal.classList.add('show');
    });

    // Render QR vào wrapper
    const wrapper = document.getElementById('masterQrWrapper');
    new QRCode(wrapper, {
        text: masterUrl,
        width: 240,
        height: 240,
        colorDark: '#1a1a2e',
        colorLight: '#ffffff',
        correctLevel: QRCode.CorrectLevel.H
    });
}

function closeMasterQrModal() {
    const modal = document.getElementById('masterQrModal');
    if (modal) {
        modal.classList.remove('show');
        setTimeout(() => modal.remove(), 250);
    }
}

function downloadMasterQr() {
    const wrapper = document.getElementById('masterQrWrapper');
    if (!wrapper) return;
    const canvas = wrapper.querySelector('canvas');
    if (!canvas) { showToast('Không tìm thấy QR', 'error'); return; }

    // Tạo canvas xuất có label
    const exportCanvas = document.createElement('canvas');
    const padding = 24;
    const labelHeight = 50;
    exportCanvas.width = canvas.width + padding * 2;
    exportCanvas.height = canvas.height + padding * 2 + labelHeight;

    const ctx = exportCanvas.getContext('2d');
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, exportCanvas.width, exportCanvas.height);
    ctx.drawImage(canvas, padding, padding);

    ctx.fillStyle = '#1a1a2e';
    ctx.font = 'bold 16px Arial, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('🍜 Phố Ẩm Thực Vĩnh Khánh', exportCanvas.width / 2, canvas.height + padding + 22);
    ctx.font = '11px Arial, sans-serif';
    ctx.fillStyle = '#888';
    ctx.fillText('Quét để xem danh sách quán ăn', exportCanvas.width / 2, canvas.height + padding + 40);

    const link = document.createElement('a');
    link.download = 'QR_TONG_Pho_Vinh_Khanh.png';
    link.href = exportCanvas.toDataURL('image/png');
    link.click();

    showToast('Đã tải QR Tổng!');
}

function printMasterQr() {
    const wrapper = document.getElementById('masterQrWrapper');
    if (!wrapper) return;
    const canvas = wrapper.querySelector('canvas');
    if (!canvas) return;

    const printWindow = window.open('', '_blank');
    printWindow.document.write(`
        <!DOCTYPE html>
        <html>
        <head>
            <title>QR Tổng - Phố Ẩm Thực Vĩnh Khánh</title>
            <style>
                body {
                    display: flex; flex-direction: column; align-items: center;
                    justify-content: center; min-height: 100vh; margin: 0;
                    font-family: Arial, sans-serif;
                }
                .qr-print { text-align: center; }
                .qr-print img { width: 300px; height: 300px; }
                .qr-print h2 { margin: 16px 0 6px; font-size: 22px; color: #1a1a2e; }
                .qr-print p { margin: 0; font-size: 13px; color: #888; }
                .qr-print .brand { margin-top: 10px; font-size: 15px; color: #e94560; font-weight: bold; }
            </style>
        </head>
        <body>
            <div class="qr-print">
                <img src="${canvas.toDataURL('image/png')}" alt="QR Tổng">
                <h2>Phố Ẩm Thực Vĩnh Khánh</h2>
                <p>Quét mã QR để xem danh sách quán ăn & nghe thuyết minh</p>
                <div class="brand">🍜 Quận 4, TP. Hồ Chí Minh</div>
            </div>
            <script>window.onload = () => { window.print(); window.close(); }<\/script>
        </body>
        </html>
    `);
    printWindow.document.close();
}

function copyMasterQrUrl() {
    const url = `${QR_BASE_URL}/menu.html`;
    navigator.clipboard.writeText(url).then(() => {
        showToast('Đã copy URL menu!');
    }).catch(() => {
        const input = document.createElement('input');
        input.value = url;
        document.body.appendChild(input);
        input.select();
        document.execCommand('copy');
        document.body.removeChild(input);
        showToast('Đã copy URL menu!');
    });
}
