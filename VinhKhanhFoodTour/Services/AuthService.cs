using System.Text.Json;
using VinhKhanhFoodTour.Models;

namespace VinhKhanhFoodTour.Services;

/// <summary>
/// Firebase Authentication sử dụng REST API — không cần SDK.
/// Lưu session vào SecureStorage để tự động đăng nhập lại.
/// </summary>
public class AuthService
{
    private const string ApiKey = "AIzaSyCEnL_IT-9OY5mfrRV2TJgPW7ctfDffK4I";
    private const string SignUpUrl = $"https://identitytoolkit.googleapis.com/v1/accounts:signUp?key={ApiKey}";
    private const string SignInUrl = $"https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key={ApiKey}";
    private const string FirestoreBase = "https://firestore.googleapis.com/v1/projects/vinhkhanhfoodtour/databases/(default)/documents";

    private readonly HttpClient _http = new();
    private AuthUser? _currentUser;
    private string _idToken = ""; // Luu in-memory de cap nhat Firestore
    private System.Threading.Timer? _heartbeatTimer; // Gui lastSeen dinh ky

    public bool IsLoggedIn => _currentUser != null;
    public AuthUser? CurrentUser => _currentUser;

    /// <summary>Kích hoạt khi trạng thái đăng nhập thay đổi (true = đăng nhập, false = đăng xuất).</summary>
    public event EventHandler<bool>? AuthStateChanged;

    /// <summary>
    /// Khôi phục session từ SecureStorage khi mở app.
    /// Gọi trong App.xaml.cs trước khi start các services khác.
    /// </summary>
    public async Task InitializeAsync()
    {
        try
        {
            var uid = await SecureStorage.GetAsync("auth_uid");
            var email = await SecureStorage.GetAsync("auth_email");
            var displayName = await SecureStorage.GetAsync("auth_display_name");

            if (!string.IsNullOrEmpty(uid) && !string.IsNullOrEmpty(email))
            {
                _idToken = await SecureStorage.GetAsync("auth_id_token") ?? "";
                _currentUser = new AuthUser
                {
                    Uid = uid,
                    Email = email,
                    DisplayName = displayName ?? email,
                    Role = "tourist"
                };
                System.Diagnostics.Debug.WriteLine($"[Auth] ✅ Restored session: {email}");
                AuthStateChanged?.Invoke(this, true);
                // Cap nhat active + bat heartbeat khi khoi dong lai
                StartHeartbeat();
            }
            else
            {
                System.Diagnostics.Debug.WriteLine("[Auth] ℹ️ No saved session found.");
            }
        }
        catch (Exception ex)
        {
            System.Diagnostics.Debug.WriteLine($"[Auth] InitializeAsync error: {ex.Message}");
        }
    }

    /// <summary>
    /// Đăng ký tài khoản mới với email/password.
    /// Tự động tạo profile trong Firestore sau khi tạo tài khoản thành công.
    /// </summary>
    public async Task<AuthResult> RegisterAsync(string email, string password, string displayName)
    {
        try
        {
            var payload = JsonSerializer.Serialize(new { email, password, returnSecureToken = true });
            var content = new StringContent(payload, System.Text.Encoding.UTF8, "application/json");
            var response = await _http.PostAsync(SignUpUrl, content);
            var json = await response.Content.ReadAsStringAsync();

            if (!response.IsSuccessStatusCode)
                return new AuthResult { Success = false, ErrorMessage = ParseFirebaseError(json) };

            using var doc = JsonDocument.Parse(json);
            var root = doc.RootElement;
            var uid = root.GetProperty("localId").GetString() ?? "";
            var idToken = root.GetProperty("idToken").GetString() ?? "";
            var refreshToken = root.GetProperty("refreshToken").GetString() ?? "";

            await PersistSessionAsync(uid, email, displayName, idToken, refreshToken);
            await CreateUserProfileInFirestoreAsync(uid, email, displayName, idToken);

            _idToken = idToken;
            _currentUser = new AuthUser { Uid = uid, Email = email, DisplayName = displayName };
            System.Diagnostics.Debug.WriteLine($"[Auth] ✅ Registered: {email}");
            AuthStateChanged?.Invoke(this, true);
            StartHeartbeat();

            return new AuthResult { Success = true, Uid = uid, IdToken = idToken };
        }
        catch (Exception ex)
        {
            System.Diagnostics.Debug.WriteLine($"[Auth] Register error: {ex.Message}");
            return new AuthResult { Success = false, ErrorMessage = "Không thể kết nối. Kiểm tra mạng và thử lại." };
        }
    }

    /// <summary>Đăng nhập bằng email/password.</summary>
    public async Task<AuthResult> LoginAsync(string email, string password)
    {
        try
        {
            var payload = JsonSerializer.Serialize(new { email, password, returnSecureToken = true });
            var content = new StringContent(payload, System.Text.Encoding.UTF8, "application/json");
            var response = await _http.PostAsync(SignInUrl, content);
            var json = await response.Content.ReadAsStringAsync();

            if (!response.IsSuccessStatusCode)
                return new AuthResult { Success = false, ErrorMessage = ParseFirebaseError(json) };

            using var doc = JsonDocument.Parse(json);
            var root = doc.RootElement;
            var uid = root.GetProperty("localId").GetString() ?? "";
            var idToken = root.GetProperty("idToken").GetString() ?? "";
            var refreshToken = root.GetProperty("refreshToken").GetString() ?? "";
            var name = root.TryGetProperty("displayName", out var dn) ? dn.GetString() ?? email : email;

            await PersistSessionAsync(uid, email, name, idToken, refreshToken);

            _idToken = idToken;
            _currentUser = new AuthUser { Uid = uid, Email = email, DisplayName = name };
            System.Diagnostics.Debug.WriteLine($"[Auth] ✅ Logged in: {email}");
            AuthStateChanged?.Invoke(this, true);
            StartHeartbeat();

            return new AuthResult { Success = true, Uid = uid, IdToken = idToken };
        }
        catch (Exception ex)
        {
            System.Diagnostics.Debug.WriteLine($"[Auth] Login error: {ex.Message}");
            return new AuthResult { Success = false, ErrorMessage = "Không thể kết nối. Kiểm tra mạng và thử lại." };
        }
    }

    /// <summary>Đăng xuất và xóa session.</summary>
    public async Task LogoutAsync()
    {
        // Dung heartbeat + cap nhat offline TRUOC khi xoa credentials
        StopHeartbeat();
        await UpdateUserStatusAsync("offline");

        _currentUser = null;
        _idToken = "";
        SecureStorage.Remove("auth_uid");
        SecureStorage.Remove("auth_email");
        SecureStorage.Remove("auth_display_name");
        SecureStorage.Remove("auth_id_token");
        SecureStorage.Remove("auth_refresh_token");
        System.Diagnostics.Debug.WriteLine("[Auth] Logged out.");
        AuthStateChanged?.Invoke(this, false);
    }

    // ===== Helpers =====

    /// <summary>
    /// Bat heartbeat: gui lastSeen + status=active moi 30 giay.
    /// Neu app bi force-kill, timer tu dung va CMS co the phat hien offline sau 2 phut.
    /// </summary>
    public void StartHeartbeat()
    {
        StopHeartbeat();
        // Chay ngay lap tuc + lap lai moi 30 giay
        _heartbeatTimer = new System.Threading.Timer(
            async _ => await UpdateUserStatusAsync("active"),
            null,
            TimeSpan.Zero,
            TimeSpan.FromSeconds(30));
        System.Diagnostics.Debug.WriteLine("[Auth] Heartbeat started.");
    }

    /// <summary>Dung heartbeat (khi sleep/logout).</summary>
    public void StopHeartbeat()
    {
        _heartbeatTimer?.Dispose();
        _heartbeatTimer = null;
        System.Diagnostics.Debug.WriteLine("[Auth] Heartbeat stopped.");
    }

    /// <summary>
    /// Cap nhat truong status trong Firestore (active / offline).
    /// Fire-and-forget OK — best effort, khong block UI.
    /// </summary>
    public async Task UpdateUserStatusAsync(string status)
    {
        if (_currentUser == null || string.IsNullOrEmpty(_idToken)) return;
        try
        {
            // Ghi ca status lan lastSeen de CMS co the tinh offline theo thoi gian
            var body = new
            {
                fields = new Dictionary<string, object>
                {
                    ["status"] = new { stringValue = status },
                    ["lastSeen"] = new { timestampValue = DateTime.UtcNow.ToString("o") }
                }
            };
            var json = System.Text.Json.JsonSerializer.Serialize(body);
            var content = new StringContent(json, System.Text.Encoding.UTF8, "application/json");

            // Chi update 2 truong, khong ghi de document
            var url = $"{FirestoreBase}/users/{_currentUser.Uid}" +
                      "?updateMask.fieldPaths=status&updateMask.fieldPaths=lastSeen";
            var request = new HttpRequestMessage(HttpMethod.Patch, url);
            request.Content = content;
            request.Headers.Add("Authorization", $"Bearer {_idToken}");

            var resp = await _http.SendAsync(request);
            System.Diagnostics.Debug.WriteLine($"[Auth] Status -> {status}: {resp.StatusCode}");
        }
        catch (Exception ex)
        {
            System.Diagnostics.Debug.WriteLine($"[Auth] UpdateStatus error: {ex.Message}");
        }
    }

    private static async Task PersistSessionAsync(string uid, string email, string displayName, string idToken, string refreshToken)
    {
        await SecureStorage.SetAsync("auth_uid", uid);
        await SecureStorage.SetAsync("auth_email", email);
        await SecureStorage.SetAsync("auth_display_name", displayName);
        await SecureStorage.SetAsync("auth_id_token", idToken);
        await SecureStorage.SetAsync("auth_refresh_token", refreshToken);
    }

    private async Task CreateUserProfileInFirestoreAsync(string uid, string email, string displayName, string idToken)
    {
        try
        {
            var doc = new
            {
                fields = new Dictionary<string, object>
                {
                    ["email"] = new { stringValue = email },
                    ["displayName"] = new { stringValue = displayName },
                    ["role"] = new { stringValue = "tourist" },
                    ["status"] = new { stringValue = "active" },
                    ["createdAt"] = new { timestampValue = DateTime.UtcNow.ToString("o") }
                }
            };

            var json = JsonSerializer.Serialize(doc);
            var content = new StringContent(json, System.Text.Encoding.UTF8, "application/json");

            // PATCH /users/{uid} để tạo hoặc merge document
            var request = new HttpRequestMessage(HttpMethod.Patch, $"{FirestoreBase}/users/{uid}");
            request.Content = content;
            request.Headers.Add("Authorization", $"Bearer {idToken}");

            var resp = await _http.SendAsync(request);
            System.Diagnostics.Debug.WriteLine($"[Auth] Create Firestore profile: {resp.StatusCode}");
        }
        catch (Exception ex)
        {
            System.Diagnostics.Debug.WriteLine($"[Auth] Create profile error: {ex.Message}");
        }
    }

    private static string ParseFirebaseError(string json)
    {
        try
        {
            using var doc = JsonDocument.Parse(json);
            var msg = doc.RootElement.GetProperty("error").GetProperty("message").GetString();
            return msg switch
            {
                "EMAIL_EXISTS" => "Email này đã được đăng ký.",
                "INVALID_EMAIL" => "Địa chỉ email không hợp lệ.",
                "WEAK_PASSWORD : Password should be at least 6 characters" => "Mật khẩu phải có ít nhất 6 ký tự.",
                "INVALID_PASSWORD" or "INVALID_LOGIN_CREDENTIALS" or "EMAIL_NOT_FOUND" => "Email hoặc mật khẩu không đúng.",
                "USER_DISABLED" => "Tài khoản đã bị khóa.",
                "TOO_MANY_ATTEMPTS_TRY_LATER" => "Quá nhiều lần thử. Vui lòng thử lại sau.",
                _ => msg ?? "Có lỗi xảy ra. Vui lòng thử lại."
            };
        }
        catch { return "Có lỗi xảy ra. Vui lòng thử lại."; }
    }
}
