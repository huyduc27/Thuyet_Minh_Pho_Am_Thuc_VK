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
function requireAuth() {
    return new Promise((resolve) => {
        auth.onAuthStateChanged(user => {
            if (!user) {
                window.location.href = 'index.html';
            } else {
                resolve(user);
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
