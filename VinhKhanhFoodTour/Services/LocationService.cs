namespace VinhKhanhFoodTour.Services;

public class LocationService
{
    private CancellationTokenSource? _cts;
    private bool _isTracking;

    // Vị trí mặc định: đầu đường Vĩnh Khánh (xa khu ẩm thực, không trigger thuyết minh)
    public const double VinhKhanhLat = 10.76280;
    public const double VinhKhanhLng = 106.70120;
    private const double MaxDistanceFromVinhKhanh = 50000;

    public event EventHandler<Location>? LocationChanged;
    public Location? CurrentLocation { get; private set; }

    public bool IsSimulationMode { get; private set; }

    // === Route Simulation ===
    public static readonly List<Location> VinhKhanhRoute = new()
    {
        // NW start - truoc khu am thuc
        new(10.76190, 106.70208),
        new(10.76184, 106.70215),
        new(10.76178, 106.70222),
        // Doan 1: NW food cluster (Oc Thao, Ba Co Tien, Hai San Be Man, Oc Vu)
        new(10.76173, 106.70230),
        new(10.76168, 106.70237),
        new(10.76162, 106.70245),
        new(10.76155, 106.70255),
        new(10.76148, 106.70264),
        new(10.76142, 106.70270),
        // Doan 2: Oc Sau No, Che, Oc Oanh
        new(10.76135, 106.70276),
        new(10.76127, 106.70280),
        new(10.76120, 106.70283),
        new(10.76112, 106.70288),
        // Doan 3: Cong - duong bat dau re sang huong dong
        new(10.76105, 106.70296),
        new(10.76098, 106.70308),
        new(10.76094, 106.70318),
        new(10.76090, 106.70330),
        // Doan 4: Di huong dong (A Fat, Chilli, Ty Muoi, Oc Dao 2)
        new(10.76086, 106.70348),
        new(10.76082, 106.70368),
        new(10.76078, 106.70388),
        new(10.76074, 106.70406),
        new(10.76070, 106.70422),
        new(10.76074, 106.70440),
        new(10.76078, 106.70455),
        new(10.76084, 106.70468),
        new(10.76090, 106.70478),
        new(10.76096, 106.70486),
        // Doan 5: SE end (Lang Quan)
        new(10.76100, 106.70500),
        new(10.76103, 106.70518),
        new(10.76106, 106.70535),
        new(10.76108, 106.70550),
        new(10.76110, 106.70565),
        new(10.76113, 106.70580),
    };

    private CancellationTokenSource? _routeCts;
    private int _routeIndex;
    private double _routeSpeed = 1.0;

    public bool IsRouteRunning { get; private set; }
    public bool IsRoutePaused { get; private set; }
    public int RouteIndex => _routeIndex;
    public int RouteTotal => VinhKhanhRoute.Count;
    public double RouteSpeed
    {
        get => _routeSpeed;
        set => _routeSpeed = Math.Clamp(value, 1.0, 20.0);
    }

    public event EventHandler<(Location Location, int Index, int Total)>? RouteProgressChanged;
    public event EventHandler? RouteFinished;

    public async Task StartRouteAsync()
    {
        StopRoute();
        _routeIndex = 0;
        IsRouteRunning = true;
        IsRoutePaused = false;
        IsSimulationMode = true;
        _routeCts = new CancellationTokenSource();

        System.Diagnostics.Debug.WriteLine($"=== ROUTE START: {VinhKhanhRoute.Count} waypoints, speed {_routeSpeed}x ===");

        try
        {
            while (_routeIndex < VinhKhanhRoute.Count && !_routeCts.Token.IsCancellationRequested)
            {
                if (IsRoutePaused)
                {
                    await Task.Delay(300, _routeCts.Token);
                    continue;
                }

                var waypoint = VinhKhanhRoute[_routeIndex];
                CurrentLocation = waypoint;
                LocationChanged?.Invoke(this, waypoint);
                RouteProgressChanged?.Invoke(this, (waypoint, _routeIndex, VinhKhanhRoute.Count));

                System.Diagnostics.Debug.WriteLine(
                    $"=== ROUTE [{_routeIndex + 1}/{VinhKhanhRoute.Count}]: {waypoint.Latitude:F5}, {waypoint.Longitude:F5} ===");

                _routeIndex++;
                var intervalMs = (int)(12000.0 / _routeSpeed);
                await Task.Delay(intervalMs, _routeCts.Token);
            }
        }
        catch (TaskCanceledException) { }
        finally
        {
            IsRouteRunning = false;
            IsRoutePaused = false;
            System.Diagnostics.Debug.WriteLine("=== ROUTE ENDED ===");
            RouteFinished?.Invoke(this, EventArgs.Empty);
        }
    }

    public void PauseRoute()
    {
        if (IsRouteRunning && !IsRoutePaused)
        {
            IsRoutePaused = true;
            System.Diagnostics.Debug.WriteLine("=== ROUTE PAUSED ===");
        }
    }

    public void ResumeRoute()
    {
        if (IsRouteRunning && IsRoutePaused)
        {
            IsRoutePaused = false;
            System.Diagnostics.Debug.WriteLine("=== ROUTE RESUMED ===");
        }
    }

    public void StopRoute()
    {
        _routeCts?.Cancel();
        _routeCts?.Dispose();
        _routeCts = null;
        _routeIndex = 0;
        IsRouteRunning = false;
        IsRoutePaused = false;
    }

    // === Manual Simulation ===
    public void SetSimulatedLocation(double lat, double lng)
    {
        IsSimulationMode = true;
        CurrentLocation = new Location(lat, lng);
        LocationChanged?.Invoke(this, CurrentLocation);
        System.Diagnostics.Debug.WriteLine($"=== SIMULATED GPS: {lat:F5}, {lng:F5} ===");
    }

    public void StopSimulation()
    {
        StopRoute();
        IsSimulationMode = false;
    }

    private Location EnsureNearVinhKhanh(Location? location)
    {
        if (location == null)
            return new Location(VinhKhanhLat, VinhKhanhLng);

        var distance = CalculateDistance(location.Latitude, location.Longitude, VinhKhanhLat, VinhKhanhLng);
        if (distance > MaxDistanceFromVinhKhanh)
        {
            System.Diagnostics.Debug.WriteLine($"GPS too far ({distance:F0}m), using Vinh Khanh default");
            return new Location(VinhKhanhLat, VinhKhanhLng);
        }

        return location;
    }

    public async Task StartTrackingAsync()
    {
        if (_isTracking) return;

        _isTracking = true;
        _cts = new CancellationTokenSource();

        while (_isTracking && !_cts.Token.IsCancellationRequested)
        {
            if (IsSimulationMode)
            {
                try { await Task.Delay(5000, _cts.Token); } catch (TaskCanceledException) { break; }
                continue;
            }

            try
            {
                var request = new GeolocationRequest(GeolocationAccuracy.Medium, TimeSpan.FromSeconds(3));
                var location = await Geolocation.Default.GetLocationAsync(request, _cts.Token);

                CurrentLocation = EnsureNearVinhKhanh(location);
                LocationChanged?.Invoke(this, CurrentLocation);
            }
            catch (FeatureNotSupportedException)
            {
                CurrentLocation = new Location(VinhKhanhLat, VinhKhanhLng);
                LocationChanged?.Invoke(this, CurrentLocation);
                break;
            }
            catch (FeatureNotEnabledException)
            {
                CurrentLocation = new Location(VinhKhanhLat, VinhKhanhLng);
                LocationChanged?.Invoke(this, CurrentLocation);
                break;
            }
            catch (PermissionException)
            {
                CurrentLocation = new Location(VinhKhanhLat, VinhKhanhLng);
                LocationChanged?.Invoke(this, CurrentLocation);
                break;
            }
            catch (Exception)
            {
                if (CurrentLocation == null)
                {
                    CurrentLocation = new Location(VinhKhanhLat, VinhKhanhLng);
                    LocationChanged?.Invoke(this, CurrentLocation);
                }
            }

            try
            {
                await Task.Delay(5000, _cts.Token);
            }
            catch (TaskCanceledException)
            {
                break;
            }
        }
    }

    public void StopTracking()
    {
        _isTracking = false;
        _cts?.Cancel();
        _cts?.Dispose();
        _cts = null;
    }

    public async Task<Location?> GetCurrentLocationAsync()
    {
        if (IsSimulationMode && CurrentLocation != null)
            return CurrentLocation;

        try
        {
            var cts = new CancellationTokenSource(TimeSpan.FromSeconds(3));
            var request = new GeolocationRequest(GeolocationAccuracy.Medium, TimeSpan.FromSeconds(3));
            var location = await Geolocation.Default.GetLocationAsync(request, cts.Token);
            CurrentLocation = EnsureNearVinhKhanh(location);
            return CurrentLocation;
        }
        catch
        {
            try
            {
                var last = await Geolocation.Default.GetLastKnownLocationAsync();
                CurrentLocation = EnsureNearVinhKhanh(last);
                return CurrentLocation;
            }
            catch
            {
                CurrentLocation = new Location(VinhKhanhLat, VinhKhanhLng);
                return CurrentLocation;
            }
        }
    }

    public static double CalculateDistance(double lat1, double lon1, double lat2, double lon2)
    {
        const double EarthRadiusMeters = 6371000;

        var dLat = DegreesToRadians(lat2 - lat1);
        var dLon = DegreesToRadians(lon2 - lon1);

        var a = Math.Sin(dLat / 2) * Math.Sin(dLat / 2) +
                Math.Cos(DegreesToRadians(lat1)) * Math.Cos(DegreesToRadians(lat2)) *
                Math.Sin(dLon / 2) * Math.Sin(dLon / 2);

        var c = 2 * Math.Atan2(Math.Sqrt(a), Math.Sqrt(1 - a));
        return EarthRadiusMeters * c;
    }

    private static double DegreesToRadians(double degrees)
    {
        return degrees * Math.PI / 180.0;
    }
}
