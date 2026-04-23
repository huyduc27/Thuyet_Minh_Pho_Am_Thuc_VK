using VinhKhanhFoodTour.Models;
using VinhKhanhFoodTour.Services;

namespace VinhKhanhFoodTour;

public partial class App : Application
{
    private readonly DatabaseService _databaseService;
    private readonly LocationService _locationService;
    private readonly GeofenceService _geofenceService;
    private readonly NarrationService _narrationService;
    private readonly FirebaseSyncService _syncService;
    private readonly AuthService _authService;

    private bool _servicesStarted;

    public App(
        DatabaseService databaseService,
        LocationService locationService,
        GeofenceService geofenceService,
        NarrationService narrationService,
        FirebaseSyncService syncService,
        SettingsService settingsService,
        AuthService authService)
    {
        InitializeComponent();

        LocalizationResourceManager.Instance.SetCulture(settingsService.GetSelectedLanguage());

        _databaseService = databaseService;
        _locationService = locationService;
        _geofenceService = geofenceService;
        _narrationService = narrationService;
        _syncService = syncService;
        _authService = authService;

        // Lắng nghe khi user đăng nhập → khởi động services
        _authService.AuthStateChanged += OnAuthStateChanged;
    }

    protected override Window CreateWindow(IActivationState? activationState)
    {
        var window = new Window(new AppShell(_syncService));

        MainThread.BeginInvokeOnMainThread(async () =>
        {
            await Task.Delay(500);
            try
            {
                // Bước 1: Khôi phục session (nếu đã đăng nhập trước đó)
                await _authService.InitializeAsync();

                // Bước 2: Khởi động sync + geofence cho TẤT CẢ user (kể cả chưa đăng nhập)
                await StartServicesAsync();
            }
            catch (Exception ex)
            {
                System.Diagnostics.Debug.WriteLine($"=== STARTUP ERROR: {ex} ===");
            }
        });

        return window;
    }

    /// <summary>
    /// Khi user đăng nhập thành công → bắt đầu sync log lên Firestore
    /// </summary>
    private async void OnAuthStateChanged(object? sender, bool isLoggedIn)
    {
        if (isLoggedIn)
        {
            // Sync logs lên Firestore khi đăng nhập
            if (Connectivity.Current.NetworkAccess == NetworkAccess.Internet)
            {
                _ = _syncService.SyncLogsToFirestoreAsync();
            }
        }
    }

    /// <summary>
    /// Khởi động Firebase sync, Geofence, và GPS tracking.
    /// Gọi cho tất cả user (kể cả chưa đăng nhập).
    /// </summary>
    private async Task StartServicesAsync()
    {
        if (_servicesStarted) return;
        _servicesStarted = true;

        try
        {
            // Đồng bộ Firebase trước (nếu có mạng)
            if (Connectivity.Current.NetworkAccess == NetworkAccess.Internet)
            {
                System.Diagnostics.Debug.WriteLine("[App] Có mạng → Đồng bộ Firebase...");
                var success = await _syncService.SyncPoisAsync();
                System.Diagnostics.Debug.WriteLine(success
                    ? "[App] ✅ Đồng bộ Firebase xong!"
                    : "[App] ⚠️ Đồng bộ thất bại, dùng dữ liệu cũ.");

                // Chỉ sync log khi đã đăng nhập (cần user identity)
                if (_authService.IsLoggedIn)
                {
                    _ = _syncService.SyncLogsToFirestoreAsync();
                }
            }

            // Start Geofence + GPS
            _geofenceService.PoisInRange += OnPoisInRange;
            _narrationService.NarrationFinished += OnNarrationFinished;
            await _geofenceService.StartMonitoringAsync();
            _ = _locationService.StartTrackingAsync();

            var poiCount = await _databaseService.GetPoiCountAsync();
            System.Diagnostics.Debug.WriteLine($"=== GPS TRACKING + GEOFENCE STARTED ({poiCount} POIs) ===");
        }
        catch (Exception ex)
        {
            System.Diagnostics.Debug.WriteLine($"[App] StartServices error: {ex}");
            _servicesStarted = false; // cho phép thử lại
        }
    }

    private async void OnPoisInRange(object? sender, List<PointOfInterest> pois)
    {
        try
        {
            System.Diagnostics.Debug.WriteLine($"=== POIS IN RANGE: {pois.Count} ===");
            await _narrationService.EnqueueAndNarrateAsync(pois);
        }
        catch (Exception ex)
        {
            System.Diagnostics.Debug.WriteLine($"=== NARRATION ERROR: {ex} ===");
        }
    }

    /// <summary>Khi phát thuyết minh xong → đẩy log lên Firestore ngay lập tức</summary>
    private async void OnNarrationFinished(object? sender, PointOfInterest poi)
    {
        try
        {
            if (Connectivity.Current.NetworkAccess == NetworkAccess.Internet)
            {
                var count = await _syncService.SyncLogsToFirestoreAsync();
                System.Diagnostics.Debug.WriteLine($"[App] ✅ Đã sync {count} log!");
            }
        }
        catch (Exception ex)
        {
            System.Diagnostics.Debug.WriteLine($"[App] Sync log error: {ex.Message}");
        }
    }

    /// <summary>Khi app resume → khoi dong lai heartbeat</summary>
    protected override void OnResume()
    {
        base.OnResume();
        if (_authService.IsLoggedIn)
        {
            _authService.StartHeartbeat(); // Bat heartbeat + gui active ngay lap tuc
            _ = SyncAndRefreshAsync();
        }
    }

    /// <summary>Khi app vao background → dung heartbeat + cap nhat offline</summary>
    protected override void OnSleep()
    {
        base.OnSleep();
        if (_authService.IsLoggedIn)
        {
            _authService.StopHeartbeat();
            // Best-effort: cap nhat offline khi user chuyen ung dung
            _ = _authService.UpdateUserStatusAsync("offline");
        }
    }

    private async Task SyncAndRefreshAsync()
    {
        try
        {
            if (Connectivity.Current.NetworkAccess == NetworkAccess.Internet)
            {
                System.Diagnostics.Debug.WriteLine("[App] 🔄 App Resume → Đồng bộ lại từ Firebase...");
                var success = await _syncService.SyncPoisAsync();
                if (success)
                {
                    await _geofenceService.RefreshPoisAsync();
                    System.Diagnostics.Debug.WriteLine("[App] ✅ Đồng bộ + Refresh geofence xong!");
                }
                _ = _syncService.SyncLogsToFirestoreAsync();
            }
        }
        catch (Exception ex)
        {
            System.Diagnostics.Debug.WriteLine($"[App] Sync/Refresh error: {ex.Message}");
        }
    }
}


