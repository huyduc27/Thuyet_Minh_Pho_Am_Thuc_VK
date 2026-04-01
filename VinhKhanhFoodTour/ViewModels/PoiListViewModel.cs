using CommunityToolkit.Mvvm.ComponentModel;
using CommunityToolkit.Mvvm.Input;
using System.Collections.ObjectModel;
using VinhKhanhFoodTour.Models;
using VinhKhanhFoodTour.Services;

namespace VinhKhanhFoodTour.ViewModels;

public partial class PoiListViewModel : ObservableObject
{
    private readonly DatabaseService _databaseService;
    private readonly LocationService _locationService;
    private readonly NarrationService _narrationService;
    private readonly SettingsService _settingsService;
    private readonly FirebaseSyncService _syncService;

    [ObservableProperty]
    private ObservableCollection<PoiItemViewModel> _pois = new();

    [ObservableProperty]
    private ObservableCollection<PoiItemViewModel> _filteredPois = new();

    [ObservableProperty]
    private ObservableCollection<PoiItemViewModel> _featuredPois = new();

    [ObservableProperty]
    private string _searchText = string.Empty;

    [ObservableProperty]
    private string _selectedCategory = "All";

    [ObservableProperty]
    private bool _isLoading;

    [ObservableProperty]
    private bool _isRefreshing;

    public List<string> Categories { get; } = new()
    {
        "All", "Ốc", "Lẩu", "Nướng", "Hải sản", "Bò", "Cơm", "Ăn vặt", "Chè", "Tráng miệng"
    };

    public PoiListViewModel(DatabaseService dbService, LocationService locService,
        NarrationService narService, SettingsService settingsService,
        FirebaseSyncService syncService)
    {
        _databaseService = dbService;
        _locationService = locService;
        _narrationService = narService;
        _settingsService = settingsService;
        _syncService = syncService;
    }

    [RelayCommand]
    public async Task LoadPoisAsync()
    {
        IsLoading = true;
        try
        {
            var allPois = await _databaseService.GetAllPoisAsync();
            var lang = _settingsService.GetSelectedLanguage();
            var currentLoc = _locationService.CurrentLocation;

            Pois.Clear();
            foreach (var poi in allPois)
            {
                double distance = 0;
                if (currentLoc != null)
                {
                    distance = LocationService.CalculateDistance(
                        currentLoc.Latitude, currentLoc.Longitude,
                        poi.Latitude, poi.Longitude);
                }

                Pois.Add(new PoiItemViewModel
                {
                    Poi = poi,
                    DisplayName = poi.GetLocalizedName(lang),
                    DisplayDescription = poi.GetLocalizedDescription(lang),
                    ShortDescription = TruncateText(poi.GetLocalizedDescription(lang), 60),
                    DistanceMeters = distance,
                    DistanceText = FormatDistance(distance),
                    CategoryIcon = GetCategoryIcon(poi.Category),
                    CategoryColor = GetCategoryColor(poi.Category)
                });
            }

            FeaturedPois = new ObservableCollection<PoiItemViewModel>(
                Pois.Where(p => p.Poi.Priority >= 4)
                    .OrderByDescending(p => p.Poi.Rating)
                    .Take(5));

            ApplyFilter();
        }
        catch (Exception ex)
        {
            System.Diagnostics.Debug.WriteLine($"LoadPois error: {ex}");
        }
        finally
        {
            IsLoading = false;
            IsRefreshing = false;
        }
    }

    [RelayCommand]
    private async Task RefreshAsync()
    {
        IsRefreshing = true;
        try
        {
            // Kéo xuống = Đồng bộ từ Firebase CMS trước
            if (Connectivity.Current.NetworkAccess == NetworkAccess.Internet)
            {
                await _syncService.SyncPoisAsync();
                System.Diagnostics.Debug.WriteLine("[Refresh] ✅ Đã đồng bộ từ Firebase!");
            }
        }
        catch (Exception ex)
        {
            System.Diagnostics.Debug.WriteLine($"[Refresh] Sync error: {ex.Message}");
        }
        // Sau khi sync xong → load lại từ SQLite
        await LoadPoisAsync();
    }

    partial void OnSearchTextChanged(string value)
    {
        ApplyFilter();
    }

    partial void OnSelectedCategoryChanged(string value)
    {
        ApplyFilter();
    }

    private void ApplyFilter()
    {
        try
        {
            var filtered = Pois.AsEnumerable();

            if (SelectedCategory != "All")
            {
                filtered = filtered.Where(p => p.Poi.Category == SelectedCategory);
            }

            if (!string.IsNullOrWhiteSpace(SearchText))
            {
                var search = SearchText.ToLower();
                filtered = filtered.Where(p =>
                    p.DisplayName.ToLower().Contains(search) ||
                    p.Poi.Address.ToLower().Contains(search));
            }

            filtered = filtered.OrderBy(p => p.DistanceMeters);

            FilteredPois = new ObservableCollection<PoiItemViewModel>(filtered);
        }
        catch (Exception ex)
        {
            System.Diagnostics.Debug.WriteLine($"Filter error: {ex}");
        }
    }

    [RelayCommand]
    private async Task PlayNarrationAsync(PoiItemViewModel? item)
    {
        try
        {
            if (item?.Poi != null)
            {
                await _narrationService.SpeakAsync(item.Poi);
            }
        }
        catch (Exception ex)
        {
            System.Diagnostics.Debug.WriteLine($"PlayNarration error: {ex}");
        }
    }

    [RelayCommand]
    private async Task NavigateToDetailAsync(PoiItemViewModel? item)
    {
        try
        {
            if (item?.Poi != null)
            {
                await Shell.Current.GoToAsync($"{nameof(Views.PoiDetailPage)}?PoiId={item.Poi.Id}");
            }
        }
        catch (Exception ex)
        {
            System.Diagnostics.Debug.WriteLine($"Navigate error: {ex}");
        }
    }

    private static string FormatDistance(double meters)
    {
        if (meters <= 0) return "";
        if (meters < 1000) return $"{meters:F0}m";
        return $"{meters / 1000:F1}km";
    }

    private static string TruncateText(string text, int maxLength)
    {
        if (string.IsNullOrEmpty(text) || text.Length <= maxLength) return text;
        return text[..maxLength] + "...";
    }

    private static string GetCategoryIcon(string category)
    {
        return category switch
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
    }

    private static string GetCategoryColor(string category)
    {
        return category switch
        {
            "\u1ED0c" => "#FF6B35",
            "L\u1EA9u" => "#E94560",
            "N\u01B0\u1EDBng" => "#D63031",
            "H\u1EA3i s\u1EA3n" => "#0984E3",
            "B\u00F2" => "#A0522D",
            "C\u01A1m" => "#00B894",
            "\u0102n v\u1EB7t" => "#FDCB6E",
            "Ch\u00E8" => "#E17055",
            "Tr\u00E1ng mi\u1EC7ng" => "#FD79A8",
            _ => "#636E72"
        };
    }
}

public partial class PoiItemViewModel : ObservableObject
{
    public PointOfInterest Poi { get; set; } = new();
    public string DisplayName { get; set; } = string.Empty;
    public string DisplayDescription { get; set; } = string.Empty;
    public string ShortDescription { get; set; } = string.Empty;
    public double DistanceMeters { get; set; }
    public string DistanceText { get; set; } = string.Empty;
    public string CategoryIcon { get; set; } = "\U0001F37D";
    public string CategoryColor { get; set; } = "#636E72";
}
