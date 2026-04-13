// ========================================
// Auth Module — Đăng nhập / Đăng xuất
// ========================================

// Check if on login page
const loginForm = document.getElementById('loginForm');
const errorMsg = document.getElementById('errorMsg');

if (loginForm) {
    // Already logged in? Redirect to dashboard
    auth.onAuthStateChanged(user => {
        if (user) {
            window.location.href = 'dashboard.html';
        }
    });

    loginForm.addEventListener('submit', async (e) => {
        e.preventDefault();

        const email = document.getElementById('email').value.trim();
        const password = document.getElementById('password').value;
        const loginBtn = document.getElementById('loginBtn');

        // Reset error
        errorMsg.textContent = '';
        errorMsg.classList.remove('show');
        loginBtn.textContent = 'Đang đăng nhập...';
        loginBtn.disabled = true;

        try {
            await auth.signInWithEmailAndPassword(email, password);
            window.location.href = 'dashboard.html';
        } catch (error) {
            let msg = 'Đăng nhập thất bại';
            switch (error.code) {
                case 'auth/user-not-found':
                    msg = 'Email không tồn tại trong hệ thống';
                    break;
                case 'auth/wrong-password':
                case 'auth/invalid-credential':
                    msg = 'Sai mật khẩu, vui lòng thử lại';
                    break;
                case 'auth/invalid-email':
                    msg = 'Email không hợp lệ';
                    break;
                case 'auth/too-many-requests':
                    msg = 'Đăng nhập quá nhiều lần, vui lòng thử lại sau';
                    break;
                default:
                    msg = error.message;
            }
            errorMsg.textContent = msg;
            errorMsg.classList.add('show');
        } finally {
            loginBtn.textContent = 'Đăng nhập';
            loginBtn.disabled = false;
        }
    });
}

// Utility: Check auth on protected pages
// Utility: Check auth on protected pages
function requireAuth() {
    return new Promise((resolve) => {
        // Thêm chữ async ở đây để nhận phản hồi từ Database
        auth.onAuthStateChanged(async (user) => {
            if (!user) {
                window.location.href = 'index.html';
            } else {
                try {
                    // 1. Chóp lấy thông tin quyền từ Database
                    const userDoc = await db.collection('users').doc(user.uid).get();

                    if (userDoc.exists) {
                        // 2. Nếu tìm thấy dữ liệu, ép vào object user
                        const userData = userDoc.data();
                        user.role = userData.role;       // gán quyền (admin / owner)
                        user.shopIds = userData.shopIds || [];   // gán thẻ shopIds mới

                        // 3. Phê duyệt thành công, cho phép vào dashboard
                        resolve(user);
                    } else {
                        // 4. Nếu đăng nhập đúng email/pass nhưng Firebase không có UID này ở bảng users
                        alert("Tài khoản của bạn chưa được cấp quyền truy cập hệ thống!");
                        await auth.signOut(); // Bắt đăng xuất ngay
                        window.location.href = 'index.html';
                    }
                } catch (error) {
                    console.error("Lỗi khi kiểm tra dữ liệu phân quyền:", error);
                    alert("Lỗi truy vấn quyền dữ liệu: " + error.message);
                }
            }
        });
    });
}


// Utility: Logout
function logout() {
    auth.signOut().then(() => {
        window.location.href = 'index.html';
    });
}
