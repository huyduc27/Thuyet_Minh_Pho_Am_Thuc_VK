// ========================================
// Gemini AI Auto-Translation Module
// Dịch tự động Tiếng Việt → EN, ZH, KO
// Gộp 1 prompt duy nhất, chống spam bấm
// ========================================

const GEMINI_API_KEY = 'AIzaSyDQ-V9B3n070Iz9DRUXhuV2WPtVRDF3xB4';
const GEMINI_MODEL = 'gemini-2.5-flash';
const GEMINI_API_URL = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${GEMINI_API_KEY}`;

// Biến toàn cục chống spam: chỉ cho phép 1 request tại 1 thời điểm
let isTranslating = false;

/**
 * Gọi Gemini AI để dịch tự động từ Tiếng Việt sang EN, ZH, KO.
 * Gộp TẤT CẢ trường (Tên + Mô tả) vào 1 prompt duy nhất → 1 API call duy nhất.
 * @param {string} poiId - ID của POI cần dịch
 */
async function autoTranslate(poiId) {
    // === Chống spam: không cho bấm nếu đang dịch ===
    if (isTranslating) {
        showToast('⏳ Đang dịch rồi, vui lòng chờ...', 'error');
        return;
    }

    const nameVi = document.getElementById(`name-vi-${poiId}`).value.trim();
    const descVi = document.getElementById(`desc-vi-${poiId}`).value.trim();

    if (!nameVi && !descVi) {
        showToast('Vui lòng nhập tên hoặc mô tả Tiếng Việt trước!', 'error');
        return;
    }

    // === Disable nút + hiện trạng thái "Đang dịch..." ===
    isTranslating = true;
    const btn = document.getElementById(`btn-translate-${poiId}`);
    const originalHTML = btn.innerHTML;
    btn.innerHTML = '⏳ Đang dịch...';
    btn.disabled = true;
    btn.style.opacity = '0.6';
    btn.style.cursor = 'not-allowed';

    try {
        // === Gộp 1 prompt duy nhất cho cả Tên + Mô tả ===
        const prompt = buildSinglePrompt(nameVi, descVi);
        const result = await callGeminiWithRetry(prompt, 2); // retry tối đa 2 lần
        const translations = parseJSON(result);

        if (translations) {
            // Điền kết quả vào các ô input
            fillField(`name-en-${poiId}`, translations.nameEn);
            fillField(`name-zh-${poiId}`, translations.nameZh);
            fillField(`name-ko-${poiId}`, translations.nameKo);
            fillField(`desc-en-${poiId}`, translations.descEn);
            fillField(`desc-zh-${poiId}`, translations.descZh);
            fillField(`desc-ko-${poiId}`, translations.descKo);

            showToast('🤖 Dịch tự động thành công! Kiểm tra rồi bấm Lưu nhé.');
        } else {
            showToast('Không thể phân tích kết quả. Thử lại sau!', 'error');
        }
    } catch (error) {
        console.error('Gemini translate error:', error);

        if (error.message.includes('429')) {
            showToast('⚠️ API đang bị giới hạn (rate limit). Chờ 1 phút rồi thử lại!', 'error');
        } else {
            showToast('Lỗi dịch: ' + error.message, 'error');
        }
    } finally {
        // === Khôi phục nút về trạng thái ban đầu ===
        isTranslating = false;
        btn.innerHTML = originalHTML;
        btn.disabled = false;
        btn.style.opacity = '1';
        btn.style.cursor = 'pointer';
    }
}

/**
 * Điền giá trị vào ô input/textarea (nếu có giá trị)
 */
function fillField(elementId, value) {
    if (value) {
        const el = document.getElementById(elementId);
        if (el) el.value = value;
    }
}

/**
 * Tạo 1 prompt DUY NHẤT gộp cả Tên + Mô tả
 * → Gemini trả về 1 JSON chứa tất cả bản dịch
 */
function buildSinglePrompt(nameVi, descVi) {
    return `Bạn là chuyên gia dịch thuật du lịch ẩm thực Việt Nam.
Dịch nội dung sau sang 3 ngôn ngữ: English (en), Chinese Simplified (zh), Korean (ko).

QUY TẮC:
- Tên quán ăn giữ nguyên phiên âm (VD: "Ốc Oanh" → "Oc Oanh" trong tiếng Anh)
- Dịch tự nhiên, phù hợp app du lịch
- CHỈ trả về JSON thuần, KHÔNG có markdown, KHÔNG giải thích

TÊN QUÁN (Tiếng Việt): ${nameVi || '(trống)'}
MÔ TẢ (Tiếng Việt): ${descVi || '(trống)'}

Trả về đúng định dạng JSON này:
{"nameEn":"...","nameZh":"...","nameKo":"...","descEn":"...","descZh":"...","descKo":"..."}`;
}

/**
 * Gọi Gemini API có cơ chế retry tự động khi bị 429
 * @param {string} prompt
 * @param {number} maxRetries - Số lần thử lại tối đa
 */
async function callGeminiWithRetry(prompt, maxRetries = 2) {
    let lastError;

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
        try {
            if (attempt > 0) {
                // Chờ trước khi retry (tăng dần: 3s, 6s, ...)
                const waitMs = attempt * 3000;
                console.log(`[Gemini] Retry ${attempt}/${maxRetries}, chờ ${waitMs / 1000}s...`);
                await new Promise(r => setTimeout(r, waitMs));
            }

            const response = await fetch(GEMINI_API_URL, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    contents: [{ parts: [{ text: prompt }] }],
                    generationConfig: {
                        temperature: 0.3,
                        maxOutputTokens: 1024,
                        responseMimeType: "application/json"
                    }
                })
            });

            if (response.status === 429) {
                lastError = new Error('429 - Rate limit. Quota API đã hết.');
                console.warn(`[Gemini] 429 Rate Limit (attempt ${attempt + 1})`);
                continue; // Thử lại
            }

            if (!response.ok) {
                const errText = await response.text();
                throw new Error(`API error (${response.status}): ${errText}`);
            }

            const data = await response.json();

            // Gemini 2.5 Flash (Thinking model) trả về nhiều parts:
            // parts[0] = { thought: true, text: "suy nghĩ..." }
            // parts[1] = { text: "JSON kết quả thực tế" }
            // → Lấy part CUỐI CÙNG không phải thought
            const parts = data.candidates?.[0]?.content?.parts;
            if (!parts || parts.length === 0) throw new Error('Gemini không trả về kết quả');

            // Tìm part cuối cùng không phải thought
            let text = null;
            for (let i = parts.length - 1; i >= 0; i--) {
                if (!parts[i].thought && parts[i].text) {
                    text = parts[i].text;
                    break;
                }
            }
            if (!text) text = parts[parts.length - 1].text; // Fallback: lấy part cuối
            if (!text) throw new Error('Gemini không trả về text');

            console.log('[Gemini] Response:', text);
            return text;

        } catch (err) {
            lastError = err;
            if (!err.message.includes('429')) throw err; // Chỉ retry khi 429
        }
    }

    throw lastError;
}

/**
 * Phân tích JSON từ response Gemini
 * Xử lý cả trường hợp Gemini bọc trong ```json ... ```
 */
function parseJSON(text) {
    try {
        let cleaned = text.trim();
        // Loại bỏ markdown code block
        cleaned = cleaned.replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/i, '');
        cleaned = cleaned.trim();
        return JSON.parse(cleaned);
    } catch (e) {
        console.error('Parse error:', e, 'Raw:', text);
        // Thử tìm JSON trong text
        const match = text.match(/\{[\s\S]*\}/);
        if (match) {
            try { return JSON.parse(match[0]); } catch { }
        }
        return null;
    }
}
