using CommunityToolkit.Mvvm.ComponentModel;
using CommunityToolkit.Mvvm.Input;
using Microsoft.Maui.Controls.Maps;
using Microsoft.Maui.Maps;
using VinhKhanhFoodTour.Models;
using VinhKhanhFoodTour.Services;
using Map = Microsoft.Maui.Controls.Maps.Map;

namespace VinhKhanhFoodTour.ViewModels;

public partial class MapViewModel : ObservableObject
{
    private readonly DatabaseService _databaseService;
    private readonly LocationService _locationService;
    private readonly SettingsService _settingsService;
    private readonly FirebaseSyncService _syncService;
    private readonly GeofenceService _geofenceService;

    private Circle? _userDot;
    private Circle? _userHalo;
    private Polyline? _routeLine;

    public Map? MapControl { get; set; }

    [ObservableProperty]
    private bool _isLoading = true;

    [ObservableProperty]
    private string _locationStatus = "Dang tim vi tri...";

    // === Simulation Mode: Off / Manual / Route ===
    [ObservableProperty]
    private string _manualButtonColor = "#555";

    [ObservableProperty]
    private string _routeButtonColor = "#555";

    [ObservableProperty]
    private bool _isManualMode;

    [ObservableProperty]
    private bool _isRouteMode;

    [ObservableProperty]
    private bool _isRoutePlaying;

    [ObservableProperty]
    private string _routeStatusText = "";

    [ObservableProperty]
    private bool _showRouteControls;

    [ObservableProperty]
    private string _routeSpeedText = "1x";

    [ObservableProperty]
    private string _playPauseIcon = "\u25B6";

    private readonly double[] _speedOptions = { 1, 2, 3, 5, 10 };
    private int _speedIndex = 0;

    public MapViewModel(
        DatabaseService databaseService,
        LocationService locationService,
        SettingsService settingsService,
        FirebaseSyncService syncService,
        GeofenceService geofenceService)
    {
        _databaseService = databaseService;
        _locationService = locationService;
        _settingsService = settingsService;
        _syncService = syncService;
        _geofenceService = geofenceService;

        _locationService.RouteProgressChanged += OnRouteProgress;
        _locationService.RouteFinished += OnRouteFinished;
    }

    private void OnRouteProgress(object? sender, (Location Location, int Index, int Total) e)
    {
        MainThread.BeginInvokeOnMainThread(() =>
        {
            LocationStatus = $"ROUTE [{e.Index + 1}/{e.Total}]: {e.Location.Latitude:F5}, {e.Location.Longitude:F5}";
            RouteStatusText = $"{e.Index + 1} / {e.Total}";
            MoveUserMarker(e.Location.Latitude, e.Location.Longitude);
        });
    }

    private void OnRouteFinished(object? sender, EventArgs e)
    {
        MainThread.BeginInvokeOnMainThread(() =>
        {
            RouteStatusText = "Hoan thanh!";
            IsRoutePlaying = false;
            PlayPauseIcon = "\u25B6";
            LocationStatus = "Route hoan thanh - chon che do tiep theo";
        });
    }

    [RelayCommand]
    public async Task LoadMapAsync()
    {
        if (MapControl == null) return;

        IsLoading = true;
        try
        {
            var pois = await _databaseService.GetAllPoisAsync();
            var lang = _settingsService.GetSelectedLanguage();
            var settings = _settingsService.GetSettings();

            MapControl.Pins.Clear();
            MapControl.MapElements.Clear();
            _userDot = null;
            _userHalo = null;
            _routeLine = null;

            AddPoiPinsWithRadius(pois, lang, settings.RadiusMultiplier);

            Location? userLocation = null;
            try
            {
                LocationStatus = "Dang lay vi tri GPS...";
                userLocation = await _locationService.GetCurrentLocationAsync();
                if (userLocation != null)
                {
                    var mode = _locationService.IsSimulationMode ? " [SIM]" : "";
                    LocationStatus = $"GPS{mode}: {userLocation.Latitude:F5}, {userLocation.Longitude:F5}";
                }
                else
                {
                    LocationStatus = "Khong lay duoc vi tri GPS";
                }
            }
            catch (Exception ex)
            {
                System.Diagnostics.Debug.WriteLine($"GPS error: {ex}");
                LocationStatus = "Loi GPS - dung vi tri mac dinh";
            }

            var centerLat = userLocation?.Latitude ?? LocationService.VinhKhanhLat;
            var centerLng = userLocation?.Longitude ?? LocationService.VinhKhanhLng;

            // Ensure the initial location does not overlap with any POI's radius 
            // so we can test entering geofence areas.
            bool isOverlapping = true;
            int loopCount = 0;
            while (isOverlapping && loopCount < 50)
            {
                isOverlapping = false;
                foreach (var poi in pois)
                {
                    double dist = LocationService.CalculateDistance(centerLat, centerLng, poi.Latitude, poi.Longitude);
                    double effectiveRadius = poi.RadiusMeters * settings.RadiusMultiplier;
                    
                    if (dist <= effectiveRadius)
                    {
                        // Overlaps, move slightly outwards (~11m north-west)
                        centerLat += 0.0001;
                        centerLng -= 0.0001;
                        isOverlapping = true;
                        break;
                    }
                }
                loopCount++;
            }

            // Sync the possibly adjusted location back to LocationService 
            // so geofence starts correctly from outside.
            if (loopCount > 1 || _locationService.IsSimulationMode)
            {
                _locationService.SetSimulatedLocation(centerLat, centerLng);
            }

            AddUserMarker(centerLat, centerLng);

            MapControl.MoveToRegion(MapSpan.FromCenterAndRadius(
                new Location(centerLat, centerLng),
                Distance.FromMeters(300)));
        }
        catch (Exception ex)
        {
            System.Diagnostics.Debug.WriteLine($"Map error: {ex}");
            LocationStatus = "Loi tai ban do";
        }
        finally
        {
            IsLoading = false;
        }
    }

    [RelayCommand]
    public async Task ReloadAsync()
    {
        StopAllSimulation();

        // Refresh = Đồng bộ từ Firebase CMS trước khi tải lại bản đồ
        try
        {
            if (Connectivity.Current.NetworkAccess == NetworkAccess.Internet)
            {
                var success = await _syncService.SyncPoisAsync();
                if (success)
                {
                    await _geofenceService.RefreshPoisAsync();
                    System.Diagnostics.Debug.WriteLine("[Map Refresh] ✅ Đã đồng bộ + refresh geofence!");
                }
            }
        }
        catch (Exception ex)
        {
            System.Diagnostics.Debug.WriteLine($"[Map Refresh] Sync error: {ex.Message}");
        }

        await LoadMapAsync();
    }

    // === Mode: Manual (click map to move GPS) ===
    [RelayCommand]
    public void ToggleManual()
    {
        if (IsManualMode)
        {
            StopAllSimulation();
        }
        else
        {
            StopAllSimulation();
            IsManualMode = true;
            ManualButtonColor = "#e94560";
            _locationService.SetSimulatedLocation(
                _locationService.CurrentLocation?.Latitude ?? LocationService.VinhKhanhLat,
                _locationService.CurrentLocation?.Longitude ?? LocationService.VinhKhanhLng);
            LocationStatus = "MANUAL - nhan vao ban do de di chuyen";
        }
    }

    // === Mode: Route (auto walk along Vinh Khanh) ===
    [RelayCommand]
    public async Task ToggleRouteAsync()
    {
        if (IsRouteMode)
        {
            StopAllSimulation();
        }
        else
        {
            StopAllSimulation();
            IsRouteMode = true;
            ShowRouteControls = true;
            RouteButtonColor = "#e94560";
            RouteStatusText = "San sang";

            DrawRouteLine();
            ZoomToRoute();
        }
    }

    [RelayCommand]
    public async Task PlayPauseRouteAsync()
    {
        if (!IsRouteMode) return;

        if (_locationService.IsRouteRunning && !_locationService.IsRoutePaused)
        {
            _locationService.PauseRoute();
            IsRoutePlaying = false;
            PlayPauseIcon = "\u25B6";
            RouteStatusText = $"Tam dung - {_locationService.RouteIndex}/{_locationService.RouteTotal}";
        }
        else if (_locationService.IsRouteRunning && _locationService.IsRoutePaused)
        {
            _locationService.ResumeRoute();
            IsRoutePlaying = true;
            PlayPauseIcon = "\u23F8";
        }
        else
        {
            _locationService.RouteSpeed = _speedOptions[_speedIndex];
            IsRoutePlaying = true;
            PlayPauseIcon = "\u23F8";
            await _locationService.StartRouteAsync();
        }
    }

    [RelayCommand]
    public void StopRoute()
    {
        _locationService.StopRoute();
        IsRoutePlaying = false;
        PlayPauseIcon = "\u25B6";
        RouteStatusText = "Da dung - nhan Play de bat dau lai";
    }

    [RelayCommand]
    public void CycleSpeed()
    {
        _speedIndex = (_speedIndex + 1) % _speedOptions.Length;
        var speed = _speedOptions[_speedIndex];
        _locationService.RouteSpeed = speed;
        RouteSpeedText = speed >= 10 ? $"{speed:F0}x" : $"{speed:F0}x";
    }

    public void OnMapTapped(double lat, double lng)
    {
        if (!IsManualMode) return;

        _locationService.SetSimulatedLocation(lat, lng);
        LocationStatus = $"MANUAL: {lat:F5}, {lng:F5}";
        MoveUserMarker(lat, lng);
    }

    private void StopAllSimulation()
    {
        _locationService.StopSimulation();

        IsManualMode = false;
        IsRouteMode = false;
        ShowRouteControls = false;
        IsRoutePlaying = false;

        ManualButtonColor = "#555";
        RouteButtonColor = "#555";
        PlayPauseIcon = "\u25B6";
        RouteStatusText = "";

        LocationStatus = "GPS that - dang theo doi...";

        RemoveRouteLine();
    }

    private void DrawRouteLine()
    {
        if (MapControl == null) return;

        _routeLine = new Polyline
        {
            StrokeColor = Color.FromArgb("#4285F4"),
            StrokeWidth = 5
        };

        foreach (var loc in LocationService.VinhKhanhRoute)
        {
            _routeLine.Geopath.Add(loc);
        }

        MapControl.MapElements.Add(_routeLine);
    }

    private void RemoveRouteLine()
    {
        if (MapControl == null || _routeLine == null) return;
        MapControl.MapElements.Remove(_routeLine);
        _routeLine = null;
    }

    private void ZoomToRoute()
    {
        if (MapControl == null) return;

        var route = LocationService.VinhKhanhRoute;
        var midIndex = route.Count / 2;
        var center = route[midIndex];

        MapControl.MoveToRegion(MapSpan.FromCenterAndRadius(
            center, Distance.FromMeters(350)));
    }

    private void AddPoiPinsWithRadius(List<PointOfInterest> pois, string lang, double multiplier)
    {
        if (MapControl == null) return;

        foreach (var poi in pois)
        {
            var icon = poi.Category switch
            {
                "\u1ED0c" => "\U0001F41A",
                "L\u1EA9u" => "\U0001F372",
                "N\u01B0\u1EDBng" => "\U0001F525",
                "H\u1EA3i s\u1EA3n" => "\U0001F980",
                "B\u00F2" => "\U0001F969",
                "C\u01A1m" => "\U0001F35A",
                "\u0102n v\u1EB7t" => "\U0001F362",
                "Ch\u00E8" => "\U0001F367",
                "Tr\u00E1ng mi\u1EC7ng" => "\U0001F368",
                _ => "\U0001F37D"
            };

            var name = poi.GetLocalizedName(lang);
            var desc = poi.GetLocalizedDescription(lang);
            if (desc.Length > 80) desc = desc[..80] + "...";

            var effectiveRadius = poi.RadiusMeters * multiplier;

            var pin = new Pin
            {
                Label = $"{icon} {name}",
                Address = $"{poi.Category} | \u2605{poi.Rating:F1} | R:{effectiveRadius:F0}m",
                Location = new Location(poi.Latitude, poi.Longitude),
                Type = PinType.Place
            };
            MapControl.Pins.Add(pin);

            var circle = new Circle
            {
                Center = new Location(poi.Latitude, poi.Longitude),
                Radius = Distance.FromMeters(effectiveRadius),
                StrokeColor = Color.FromArgb("#60e94560"),
                StrokeWidth = 1,
                FillColor = Color.FromArgb("#15e94560")
            };
            MapControl.MapElements.Add(circle);
        }
    }

    private void AddUserMarker(double lat, double lng)
    {
        if (MapControl == null) return;

        // Outer halo
        _userHalo = new Circle
        {
            Center = new Location(lat, lng),
            Radius = Distance.FromMeters(15), 
            FillColor = Color.FromArgb("#334285F4"), // 20% opacity blue
            StrokeColor = Colors.Transparent,
            StrokeWidth = 0
        };

        // Inner blue dot
        _userDot = new Circle
        {
            Center = new Location(lat, lng),
            Radius = Distance.FromMeters(4),
            FillColor = Color.FromArgb("#4285F4"), // Google blue
            StrokeColor = Color.FromArgb("#FFFFFF"), // White border
            StrokeWidth = 2
        };

        MapControl.MapElements.Add(_userHalo);
        MapControl.MapElements.Add(_userDot);
    }

    private void MoveUserMarker(double lat, double lng)
    {
        if (MapControl == null) return;

        if (_userHalo != null)
        {
            MapControl.MapElements.Remove(_userHalo);
        }
        if (_userDot != null)
        {
            MapControl.MapElements.Remove(_userDot);
        }

        AddUserMarker(lat, lng);
    }
}
