// ========================================
// QR Code Module — Quản lý QR Tổng & Analytics
// ========================================

const QR_BASE_URL = window.location.origin !== 'null'
    ? window.location.origin
    : window.location.href.substring(0, window.location.href.lastIndexOf('/'));

// Chart Configuration & State (Advanced Analytics)
let qrMainChartInstance = null;
let qrCurrentCategory = 'revenue'; // 'revenue' | 'usage'
let qrCurrentPeriod = 'day';     // 'day' | 'week' | 'month' | 'year'
let qrCurrentBaseDate = new Date(); // Ngày gốc đang xem

let currentQrColor = '#e94560';
let currentShowLogo = true;
let currentMasterQr = null;

/**
 * Khởi tạo module QR
 */
async function loadQrCodes() {
    renderMasterQrLive();
    await loadQrAnalytics(false);
    
    // Mặc định về ngày hôm nay
    qrCurrentBaseDate = new Date();
    setTimeout(() => {
        loadQrCharts();
    }, 100);
}

/**
 * Render Master QR
 */
function renderMasterQrLive() {
    const wrapper = document.getElementById('masterQrLiveWrapper');
    if (!wrapper) return;
    wrapper.innerHTML = '';

    const masterUrl = `${QR_BASE_URL}/menu.html`;
    const qrcodeObj = new QRCode(wrapper, {
        text: masterUrl,
        width: 260,
        height: 260,
        colorDark: currentQrColor,
        colorLight: '#ffffff',
        correctLevel: QRCode.CorrectLevel.H
    });

    setTimeout(() => {
        const canvas = wrapper.querySelector('canvas');
        const img = wrapper.querySelector('img');
        if (!canvas) return;

        if (currentShowLogo) {
            const ctx = canvas.getContext('2d');
            const size = canvas.width;
            const center = size / 2;
            const logoBgSize = size * 0.22;

            ctx.fillStyle = '#ffffff';
            ctx.beginPath();
            ctx.arc(center, center, logoBgSize / 2 + 5, 0, 2 * Math.PI);
            ctx.fill();

            ctx.font = `${logoBgSize * 0.7}px Arial`;
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText('🍜', center, center + 2);

            if (img) img.src = canvas.toDataURL();
        }
        
        if (img) {
            img.style.display = 'block';
            img.style.margin = '0 auto';
        }
        currentMasterQr = canvas;
    }, 200);
}

function updateQrStyle() {
    const selectedRadio = document.querySelector('input[name="qrColor"]:checked');
    if (selectedRadio) currentQrColor = selectedRadio.value;
    currentShowLogo = document.getElementById('qrShowLogo').checked;
    renderMasterQrLive();
}

function downloadMasterQrCustom() {
    if (!currentMasterQr) return;
    const link = document.createElement('a');
    link.download = `VinhKhanh_MasterQR_${new Date().getTime()}.png`;
    link.href = currentMasterQr.toDataURL('image/png');
    link.click();
}

function printMasterQrCustom() {
    if (!currentMasterQr) return;
    const dataUrl = currentMasterQr.toDataURL('image/png');
    const windowPrint = window.open('', '_blank');
    windowPrint.document.write(`
        <html>
            <head><title>In Mã QR</title></head>
            <body style="display:flex; flex-direction:column; align-items:center; justify-content:center; height:100vh; font-family:sans-serif;">
                <img src="${dataUrl}" style="width:400px; border: 1px solid #eee; padding: 10px; border-radius: 20px;" />
                <h2 style="margin-top:20px; color:${currentQrColor}">PHỐ ẨM THỰC VĨNH KHÁNH</h2>
                <script>setTimeout(() => { window.print(); window.close(); }, 500);</script>
            </body>
        </html>
    `);
    windowPrint.document.close();
}

function copyMasterQrUrl() {
    const url = `${QR_BASE_URL}/menu.html`;
    navigator.clipboard.writeText(url).then(() => showToast('Đã copy URL!'));
}

async function loadQrAnalytics(showToastFlag = true) {
    const elScans = document.getElementById('qrStatScans');
    const elRevenue = document.getElementById('qrStatRevenue');
    try {
        const startOfDay = new Date();
        startOfDay.setHours(0, 0, 0, 0);
        const [scansSnap, paymentsSnap] = await Promise.all([
            db.collection('qrScans').where('scannedAt', '>=', startOfDay).get(),
            db.collection('accessRights').where('purchasedAt', '>=', startOfDay).get()
        ]);
        if (elScans) elScans.textContent = scansSnap.size;
        if (elRevenue) elRevenue.textContent = new Intl.NumberFormat('vi-VN').format(paymentsSnap.size * 5000) + 'đ';
        if (showToastFlag) showToast('Đã cập nhật số liệu hôm nay!');
    } catch (e) { console.error(e); }
}

/**
 * Analytics Filter Logic (Jump to date & Navigate)
 */

function switchQrCategory(category) {
    qrCurrentCategory = category;
    document.querySelectorAll('.qr-tab').forEach(btn => btn.classList.remove('active'));
    document.getElementById(`tab-${category}`).classList.add('active');
    loadQrCharts();
}

function switchQrPeriod(period) {
    qrCurrentPeriod = period;
    // Khi đổi chế độ, thường reset về ngày hôm nay hoặc giữ nguyên ngày đang xem
    loadQrCharts();
    
    // Cập nhật tab UI
    document.querySelectorAll('.qr-period-tab').forEach(btn => btn.classList.remove('active'));
    const activeTab = document.getElementById(`per-${period}`);
    if (activeTab) activeTab.classList.add('active');
}

function navigateQrTime(direction) {
    const date = new Date(qrCurrentBaseDate);
    if (qrCurrentPeriod === 'day') date.setDate(date.getDate() + direction);
    else if (qrCurrentPeriod === 'week') date.setDate(date.getDate() + (direction * 7));
    else if (qrCurrentPeriod === 'month') date.setMonth(date.getMonth() + direction);
    else if (qrCurrentPeriod === 'year') date.setFullYear(date.getFullYear() + direction);
    
    qrCurrentBaseDate = date;
    loadQrCharts();
}

// Kích hoạt bộ chọn lịch
function triggerQrPicker() {
    if (qrCurrentPeriod === 'day' || qrCurrentPeriod === 'week') {
        document.getElementById('qrPickerDate').showPicker();
    } else if (qrCurrentPeriod === 'month') {
        document.getElementById('qrPickerMonth').showPicker();
    }
    // Bỏ qua trường hợp 'year' theo yêu cầu
}

// Xử lý khi chọn ngày từ lịch
function jumpToQrDate(val) {
    if (!val) return;
    qrCurrentBaseDate = new Date(val);
    loadQrCharts();
}

async function loadQrCharts() {
    const mainCanvas = document.getElementById('qrMainChart');
    const labelEl = document.getElementById('qrChartPeriodLabel');
    if (!mainCanvas) return;

    try {
        const { start, end, labels, displayLabel, chartType } = getPeriodBounds(qrCurrentPeriod, qrCurrentBaseDate);
        
        if (labelEl) {
            labelEl.textContent = displayLabel;
            // Chỉ hiện bàn tay và title nếu không phải là view Năm
            if (qrCurrentPeriod === 'year') {
                labelEl.style.cursor = 'default';
                labelEl.title = '';
                labelEl.style.pointerEvents = 'none'; // Khóa click
            } else {
                labelEl.style.cursor = 'pointer';
                labelEl.title = 'Nhấn để chọn cụ thể';
                labelEl.style.pointerEvents = 'auto'; // Mở click
            }
        }

        const collectionName = qrCurrentCategory === 'revenue' ? 'accessRights' : 'qrScans';
        const dateField = qrCurrentCategory === 'revenue' ? 'purchasedAt' : 'scannedAt';

        const snapshot = await db.collection(collectionName)
            .where(dateField, '>=', start)
            .where(dateField, '<=', end)
            .get();

        const buckets = aggregateDataToBuckets(snapshot.docs, dateField, qrCurrentPeriod, start, labels.length);
        const isRevenue = qrCurrentCategory === 'revenue';
        const themeColor = isRevenue ? '#2ecc71' : '#3498db';
        const themeGradient = isRevenue ? 'rgba(46, 204, 113, 0.4)' : 'rgba(52, 152, 219, 0.4)';
        const chartTitle = isRevenue ? "Doanh thu" : "Lượt quét";
        
        renderAdvancedChart(mainCanvas, labels, buckets, chartType, themeColor, themeGradient, chartTitle, isRevenue);
    } catch (e) { console.error(e); }
}

function getPeriodBounds(period, baseDate) {
    let start = new Date(baseDate);
    let end = new Date(baseDate);
    let labels = [];
    let displayLabel = "";
    let chartType = 'bar';

    if (period === 'day') {
        start.setHours(0, 0, 0, 0);
        end.setHours(23, 59, 59, 999);
        displayLabel = start.toLocaleDateString('vi-VN');
        labels = Array.from({ length: 24 }, (_, i) => `${i}h`);
    } 
    else if (period === 'week') {
        const dayOfWeek = start.getDay() || 7;
        start.setDate(start.getDate() - (dayOfWeek - 1));
        start.setHours(0, 0, 0, 0);
        end = new Date(start);
        end.setDate(start.getDate() + 6);
        end.setHours(23, 59, 59, 999);
        displayLabel = `${start.getDate()}/${start.getMonth()+1} - ${end.getDate()}/${end.getMonth()+1}`;
        labels = ['Thứ 2', 'Thứ 3', 'Thứ 4', 'Thứ 5', 'Thứ 6', 'Thứ 7', 'CN'];
    }
    else if (period === 'month') {
        start.setDate(1);
        start.setHours(0, 0, 0, 0);
        end = new Date(start.getFullYear(), start.getMonth() + 1, 0);
        end.setHours(23, 59, 59, 999);
        displayLabel = `Tháng ${start.getMonth() + 1} / ${start.getFullYear()}`;
        labels = Array.from({ length: end.getDate() }, (_, i) => `${i + 1}`);
        chartType = 'line';
    }
    else if (period === 'year') {
        start.setMonth(0, 1);
        start.setHours(0, 0, 0, 0);
        end = new Date(start.getFullYear(), 11, 31);
        end.setHours(23, 59, 59, 999);
        displayLabel = `Năm ${start.getFullYear()}`;
        labels = ['T1', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'T8', 'T9', 'T10', 'T11', 'T12'];
    }
    return { start, end, labels, displayLabel, chartType };
}

function aggregateDataToBuckets(docs, dateField, period, startTime, bucketCount) {
    const buckets = new Array(bucketCount).fill(0);
    const isRevenue = qrCurrentCategory === 'revenue';
    docs.forEach(doc => {
        const timestamp = doc.data()[dateField];
        if (!timestamp) return;
        const date = timestamp.toDate();
        let index = -1;
        if (period === 'day') index = date.getHours();
        else if (period === 'week') {
            const diff = date.getTime() - startTime.getTime();
            index = Math.floor(diff / (1000 * 60 * 60 * 24));
        }
        else if (period === 'month') index = date.getDate() - 1;
        else if (period === 'year') index = date.getMonth();
        if (index >= 0 && index < bucketCount) buckets[index] += isRevenue ? 5000 : 1;
    });
    return buckets;
}

function renderAdvancedChart(canvas, labels, data, type, color, gradient, title, isRevenue) {
    if (qrMainChartInstance) qrMainChartInstance.destroy();
    qrMainChartInstance = new Chart(canvas, {
        type: type,
        data: {
            labels: labels,
            datasets: [{
                label: title,
                data: data,
                backgroundColor: type === 'line' ? gradient : color + '99',
                borderColor: color,
                borderWidth: 2,
                fill: type === 'line',
                tension: 0.4,
                pointRadius: type === 'line' ? 3 : 0
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { display: false },
                tooltip: {
                    backgroundColor: '#1a1a24',
                    callbacks: {
                        label: (ctx) => isRevenue 
                            ? `${new Intl.NumberFormat('vi-VN').format(ctx.raw)}đ`
                            : `${ctx.raw} lượt`
                    }
                }
            },
            scales: {
                y: { beginAtZero: true, grid: { color: 'rgba(255,255,255,0.05)' } },
                x: { grid: { display: false }, ticks: { autoSkip: true } }
            }
        }
    });
}
