using CommunityToolkit.Mvvm.ComponentModel;
using CommunityToolkit.Mvvm.Input;
using System.Collections.ObjectModel;
using VinhKhanhFoodTour.Models;
using VinhKhanhFoodTour.Services;
using VinhKhanhFoodTour.Views;

namespace VinhKhanhFoodTour.ViewModels;

public partial class PoiListViewModel : ObservableObject
{
    private readonly DatabaseService _databaseService;
    private readonly LocationService _locationService;
    private readonly NarrationService _narrationService;
    private readonly SettingsService _settingsService;
    private readonly FirebaseSyncService _syncService;
    private readonly AuthService _authService;

    [ObservableProperty]
    private bool _isLoggedIn;

    // Hien overlay "can dang nhap" khi user tap POI ma chua login
    [ObservableProperty]
    private bool _isAuthOverlayVisible;

    [ObservableProperty]
    private ObservableCollection<PoiItemViewModel> _pois = new();

    [ObservableProperty]
    private ObservableCollection<PoiItemViewModel> _filteredPois = new();

    [ObservableProperty]
    private ObservableCollection<PoiItemViewModel> _featuredPois = new();

    [ObservableProperty]
    private string _searchText = string.Empty;

    [ObservableProperty]
    private CategoryViewModel _selectedCategory;

    [ObservableProperty]
    private bool _isLoading;

    [ObservableProperty]
    private bool _isRefreshing;

    public ObservableCollection<CategoryViewModel> Categories { get; } = new()
    {
        new CategoryViewModel { DatabaseValue = "All", TranslationKey = "Category_All" },
        new CategoryViewModel { DatabaseValue = "Ốc", TranslationKey = "Category_Oc" },
        new CategoryViewModel { DatabaseValue = "Lẩu", TranslationKey = "Category_Lau" },
        new CategoryViewModel { DatabaseValue = "Nướng", TranslationKey = "Category_Nuong" },
        new CategoryViewModel { DatabaseValue = "Hải sản", TranslationKey = "Category_HaiSan" },
        new CategoryViewModel { DatabaseValue = "Bò", TranslationKey = "Category_Bo" },
        new CategoryViewModel { DatabaseValue = "Cơm", TranslationKey = "Category_Com" },
        new CategoryViewModel { DatabaseValue = "Ăn vặt", TranslationKey = "Category_AnVat" },
        new CategoryViewModel { DatabaseValue = "Chè", TranslationKey = "Category_Che" },
        new CategoryViewModel { DatabaseValue = "Tráng miệng", TranslationKey = "Category_TrangMieng" }
    };

    public PoiListViewModel(DatabaseService dbService, LocationService locService,
        NarrationService narService, SettingsService settingsService,
        FirebaseSyncService syncService, AuthService authService)
    {
        _databaseService = dbService;
        _locationService = locService;
        _narrationService = narService;
        _settingsService = settingsService;
        _syncService = syncService;
        _authService = authService;

        _selectedCategory = Categories[0];

        // Track auth state cho UI (PoiListPage an/hien search + filter)
        IsLoggedIn = _authService.IsLoggedIn;
        _authService.AuthStateChanged += (_, isLoggedIn) => { IsLoggedIn = isLoggedIn; };
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

    partial void OnSelectedCategoryChanged(CategoryViewModel value)
    {
        ApplyFilter();
    }

    private void ApplyFilter()
    {
        try
        {
            var filtered = Pois.AsEnumerable();

            if (SelectedCategory.DatabaseValue != "All")
            {
                filtered = filtered.Where(p => p.Poi.Category == SelectedCategory.DatabaseValue);
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
    private void DismissAuthOverlay()
    {
        IsAuthOverlayVisible = false;
    }

    [RelayCommand]
    private async Task GoToLoginAsync()
    {
        IsAuthOverlayVisible = false;
        await Shell.Current.GoToAsync(nameof(LoginPage));
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

    public string DisplayCategory => LocalizationResourceManager.Instance[GetTranslationKey(Poi.Category)];

    public PoiItemViewModel()
    {
        LocalizationResourceManager.Instance.PropertyChanged += (s, e) => OnPropertyChanged(nameof(DisplayCategory));
    }

    private static string GetTranslationKey(string dbValue)
    {
        return dbValue switch
        {
            "Ốc" => "Category_Oc",
            "Lẩu" => "Category_Lau",
            "Nướng" => "Category_Nuong",
            "Hải sản" => "Category_HaiSan",
            "Bò" => "Category_Bo",
            "Cơm" => "Category_Com",
            "Ăn vặt" => "Category_AnVat",
            "Chè" => "Category_Che",
            "Tráng miệng" => "Category_TrangMieng",
            _ => "Category_All"
        };
    }
}

public partial class CategoryViewModel : ObservableObject
{
    public string DatabaseValue { get; set; } = "";
    public string TranslationKey { get; set; } = "";
    public string DisplayName => LocalizationResourceManager.Instance[TranslationKey];

    public CategoryViewModel()
    {
        LocalizationResourceManager.Instance.PropertyChanged += (s, e) => OnPropertyChanged(nameof(DisplayName));
    }
}
