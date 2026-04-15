using VinhKhanhFoodTour.Models;

namespace VinhKhanhFoodTour.Services;

/// <summary>
/// Geofence Engine: Xác định các POI trong bán kính khi người dùng di chuyển
/// </summary>
public class GeofenceService
{
    private readonly DatabaseService _databaseService;
    private readonly LocationService _locationService;
    private readonly SettingsService _settingsService;
    private List<PointOfInterest> _pois = new();
    private PointOfInterest? _currentPoi;
    private HashSet<int> _currentPoiIds = new();
    private bool _isMonitoring;

    public event EventHandler<List<PointOfInterest>>? PoisInRange;

    public PointOfInterest? CurrentPoi => _currentPoi;

    public GeofenceService(DatabaseService databaseService, LocationService locationService, SettingsService settingsService)
    {
        _databaseService = databaseService;
        _locationService = locationService;
        _settingsService = settingsService;
    }

    public async Task StartMonitoringAsync()
    {
        if (_isMonitoring) return;

        _pois = await _databaseService.GetAllPoisAsync();
        _isMonitoring = true;
        _locationService.LocationChanged += OnLocationChanged;
        System.Diagnostics.Debug.WriteLine($"[Geofence] Started monitoring with {_pois.Count} POIs");
    }

    /// <summary>
    /// Reload danh sách POI từ SQLite (gọi sau khi Firebase sync xong).
    /// </summary>
    public async Task RefreshPoisAsync()
    {
        _pois = await _databaseService.GetAllPoisAsync();
        _currentPoiIds.Clear();
        _currentPoi = null;
        System.Diagnostics.Debug.WriteLine($"[Geofence] Refreshed → {_pois.Count} POIs loaded");
    }

    public void StopMonitoring()
    {
        _isMonitoring = false;
        _locationService.LocationChanged -= OnLocationChanged;
    }

    private void OnLocationChanged(object? sender, Location location)
    {
        if (!_isMonitoring || _pois.Count == 0) return;

        var multiplier = _settingsService.GetSettings().RadiusMultiplier;

        var poisInRange = new List<(PointOfInterest Poi, double Distance)>();

        foreach (var poi in _pois)
        {
            var distance = LocationService.CalculateDistance(
                location.Latitude, location.Longitude,
                poi.Latitude, poi.Longitude);

            var effectiveRadius = poi.RadiusMeters * multiplier;

            if (distance <= effectiveRadius)
            {
                poisInRange.Add((poi, distance));
            }
        }

        var sorted = poisInRange
            .OrderByDescending(x => x.Poi.Priority)
            .ThenBy(x => x.Distance)
            .Select(x => x.Poi)
            .ToList();

        if (sorted.Count > 0)
        {
            var newPoiIds = new HashSet<int>(sorted.Select(p => p.Id));
            var poisChanged = !newPoiIds.SetEquals(_currentPoiIds);

            _currentPoi = sorted[0];
            _currentPoiIds = newPoiIds;

            // Simulation: luôn fire mỗi lần tap
            // Real GPS: chỉ fire khi tập POI thay đổi
            if (_locationService.IsSimulationMode || poisChanged)
            {
                System.Diagnostics.Debug.WriteLine($"=== GEOFENCE: {sorted.Count} POIs in range, sim={_locationService.IsSimulationMode} ===");
                foreach (var poi in sorted)
                {
                    System.Diagnostics.Debug.WriteLine($"    -> {poi.Name} (P{poi.Priority})");
                }
                PoisInRange?.Invoke(this, sorted);
            }
        }
        else if (_currentPoi != null)
        {
            _currentPoi = null;
            _currentPoiIds.Clear();
        }
    }

    public List<(PointOfInterest Poi, double Distance)> GetPoisSortedByDistance(Location currentLocation)
    {
        return _pois
            .Select(poi => (Poi: poi, Distance: LocationService.CalculateDistance(
                currentLocation.Latitude, currentLocation.Longitude,
                poi.Latitude, poi.Longitude)))
            .OrderBy(x => x.Distance)
            .ToList();
    }
}
