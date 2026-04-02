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

    public App(
        DatabaseService databaseService,
        LocationService locationService,
        GeofenceService geofenceService,
        NarrationService narrationService,
        FirebaseSyncService syncService)
    {
        InitializeComponent();
        _databaseService = databaseService;
        _locationService = locationService;
        _geofenceService = geofenceService;
        _narrationService = narrationService;
        _syncService = syncService;
    }

    protected override Window CreateWindow(IActivationState? activationState)
    {
        var window = new Window(new AppShell(_syncService));

        MainThread.BeginInvokeOnMainThread(async () =>
        {
            await Task.Delay(500);
            try
            {
                // === Bước 1: Đồng bộ Firebase trước (nếu có mạng) ===
                if (Connectivity.Current.NetworkAccess == NetworkAccess.Internet)
                {
                    System.Diagnostics.Debug.WriteLine("[App] Có mạng → Đồng bộ Firebase trước khi start geofence...");
                    var success = await _syncService.SyncPoisAsync();
                    System.Diagnostics.Debug.WriteLine(success
                        ? "[App] ✅ Đồng bộ Firebase xong!"
                        : "[App] ⚠️ Đồng bộ thất bại, dùng dữ liệu cũ.");
                }
                else
                {
                    System.Diagnostics.Debug.WriteLine("[App] 📴 Không có mạng → Dùng dữ liệu Offline.");
                }

                // === Bước 2: Start Geofence SAU KHI sync xong (đảm bảo có POI) ===
                _geofenceService.PoisInRange += OnPoisInRange;
                await _geofenceService.StartMonitoringAsync();

                // === Bước 3: Start GPS tracking ===
                _ = _locationService.StartTrackingAsync();

                var poiCount = await _databaseService.GetPoiCountAsync();
                System.Diagnostics.Debug.WriteLine($"=== GPS TRACKING + GEOFENCE STARTED ({poiCount} POIs) ===");
            }
            catch (Exception ex)
            {
                System.Diagnostics.Debug.WriteLine($"=== STARTUP ERROR: {ex} ===");
            }
        });

        return window;
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

    /// <summary>
    /// Khi app mở lại từ nền (Resume) → đồng bộ Firebase lần nữa → refresh geofence.
    /// </summary>
    protected override void OnResume()
    {
        base.OnResume();
        _ = SyncAndRefreshAsync();
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
                    // Refresh geofence để dùng danh sách POI mới
                    await _geofenceService.RefreshPoisAsync();
                    System.Diagnostics.Debug.WriteLine("[App] ✅ Đồng bộ + Refresh geofence xong!");
                }
            }
        }
        catch (Exception ex)
        {
            System.Diagnostics.Debug.WriteLine($"[App] Sync/Refresh error: {ex.Message}");
        }
    }
}
