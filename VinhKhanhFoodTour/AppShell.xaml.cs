using VinhKhanhFoodTour.Services;
using VinhKhanhFoodTour.Views;

namespace VinhKhanhFoodTour;

public partial class AppShell : Shell
{
    private readonly FirebaseSyncService _syncService;

    public AppShell(FirebaseSyncService syncService)
    {
        InitializeComponent();
        _syncService = syncService;

        // Đăng ký navigation route cho chi tiết POI
        Routing.RegisterRoute(nameof(PoiDetailPage), typeof(PoiDetailPage));

        // Đồng bộ ngầm khi app mở lên (không chặn UI)
        _ = SyncOnStartupAsync();
    }

    /// <summary>
    /// Đồng bộ dữ liệu từ Firebase về SQLite khi mở app.
    /// Chạy ngầm (Background) — không block màn hình người dùng.
    /// </summary>
    private async Task SyncOnStartupAsync()
    {
        try
        {
            // Kiểm tra kết nối mạng
            var access = Connectivity.Current.NetworkAccess;

            if (access == NetworkAccess.Internet)
            {
                System.Diagnostics.Debug.WriteLine("[App] Có mạng → Đang đồng bộ từ Firebase...");
                var success = await _syncService.SyncPoisAsync();

                if (success)
                    System.Diagnostics.Debug.WriteLine("[App] ✅ Đồng bộ thành công!");
                else
                    System.Diagnostics.Debug.WriteLine("[App] ⚠️ Đồng bộ thất bại, dùng dữ liệu cũ.");
            }
            else
            {
                System.Diagnostics.Debug.WriteLine("[App] 📴 Không có mạng → Dùng dữ liệu Offline.");
            }
        }
        catch (Exception ex)
        {
            System.Diagnostics.Debug.WriteLine($"[App] Sync error: {ex.Message}");
        }
    }
}
