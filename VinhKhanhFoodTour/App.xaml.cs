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
                // SeedData cũ đã bị thay thế bằng Firebase Sync (trong AppShell)
                System.Diagnostics.Debug.WriteLine("=== FIREBASE SYNC MODE ===");

                _geofenceService.PoisInRange += OnPoisInRange;

                await _geofenceService.StartMonitoringAsync();
                _ = _locationService.StartTrackingAsync();

                System.Diagnostics.Debug.WriteLine("=== GPS TRACKING + GEOFENCE STARTED ===");
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
    /// Khi app mở lại từ nền (Resume) → đồng bộ Firebase lần nữa.
    /// Đảm bảo dữ liệu luôn cập nhật mỗi khi người dùng quay lại app.
    /// </summary>
    protected override void OnResume()
    {
        base.OnResume();
        System.Diagnostics.Debug.WriteLine("[App] 🔄 App Resume → Đồng bộ lại từ Firebase...");
        _ = _syncService.SyncPoisAsync();
    }
}
