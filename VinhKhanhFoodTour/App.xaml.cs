using VinhKhanhFoodTour.Models;
using VinhKhanhFoodTour.Services;

namespace VinhKhanhFoodTour;

public partial class App : Application
{
    private readonly DatabaseService _databaseService;
    private readonly LocationService _locationService;
    private readonly GeofenceService _geofenceService;
    private readonly NarrationService _narrationService;

    public App(
        DatabaseService databaseService,
        LocationService locationService,
        GeofenceService geofenceService,
        NarrationService narrationService)
    {
        InitializeComponent();
        _databaseService = databaseService;
        _locationService = locationService;
        _geofenceService = geofenceService;
        _narrationService = narrationService;
    }

    protected override Window CreateWindow(IActivationState? activationState)
    {
        var window = new Window(new AppShell());

        MainThread.BeginInvokeOnMainThread(async () =>
        {
            await Task.Delay(500);
            try
            {
                await _databaseService.SeedDataAsync();
                System.Diagnostics.Debug.WriteLine("=== SEED DATA OK ===");

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
}
