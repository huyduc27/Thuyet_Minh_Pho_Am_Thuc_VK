using CommunityToolkit.Mvvm.ComponentModel;
using CommunityToolkit.Mvvm.Input;
using VinhKhanhFoodTour.Models;
using VinhKhanhFoodTour.Services;

namespace VinhKhanhFoodTour.ViewModels;

[QueryProperty(nameof(PoiId), "PoiId")]
public partial class PoiDetailViewModel : ObservableObject
{
    private readonly DatabaseService _databaseService;
    private readonly NarrationService _narrationService;
    private readonly SettingsService _settingsService;

    [ObservableProperty]
    private int _poiId;

    [ObservableProperty]
    private PointOfInterest? _poi;

    [ObservableProperty]
    private string _displayName = string.Empty;

    [ObservableProperty]
    private string _displayDescription = string.Empty;

    [ObservableProperty]
    private string _categoryIcon = string.Empty;

    [ObservableProperty]
    private string _categoryColor = "#636E72";

    [ObservableProperty]
    private bool _isSpeaking;

    [ObservableProperty]
    private string _playButtonText = "Play";

    [ObservableProperty]
    private string _currentLanguage = string.Empty;

    public PoiDetailViewModel(DatabaseService dbService, NarrationService narService, SettingsService settingsService)
    {
        _databaseService = dbService;
        _narrationService = narService;
        _settingsService = settingsService;
    }

    public void Subscribe()
    {
        _narrationService.NarrationStarted += OnNarrationStarted;
        _narrationService.NarrationFinished += OnNarrationFinished;
    }

    public void Unsubscribe()
    {
        _narrationService.NarrationStarted -= OnNarrationStarted;
        _narrationService.NarrationFinished -= OnNarrationFinished;
    }

    private void OnNarrationStarted(object? sender, PointOfInterest e)
    {
        IsSpeaking = true;
        PlayButtonText = "Stop";
    }

    private void OnNarrationFinished(object? sender, PointOfInterest e)
    {
        IsSpeaking = false;
        PlayButtonText = "Play";
    }

    partial void OnPoiIdChanged(int value)
    {
        _ = LoadPoiAsync();
    }

    [RelayCommand]
    public async Task LoadPoiAsync()
    {
        try
        {
            if (PoiId <= 0) return;

            Poi = await _databaseService.GetPoiByIdAsync(PoiId);
            if (Poi == null) return;

            var lang = _settingsService.GetSelectedLanguage();
            DisplayName = Poi.GetLocalizedName(lang);
            DisplayDescription = Poi.GetLocalizedDescription(lang);
            CurrentLanguage = SettingsService.GetLanguageDisplayName(lang);
            CategoryIcon = GetCategoryIcon(Poi.Category);
            CategoryColor = GetCategoryColor(Poi.Category);
        }
        catch (Exception ex)
        {
            System.Diagnostics.Debug.WriteLine($"LoadPoi error: {ex}");
        }
    }

    [RelayCommand]
    private async Task ToggleNarrationAsync()
    {
        try
        {
            if (Poi == null)
            {
                System.Diagnostics.Debug.WriteLine("=== TOGGLE NARRATION: Poi is NULL! ===");
                return;
            }

            System.Diagnostics.Debug.WriteLine($"=== TOGGLE NARRATION: '{Poi.Name}' | IsSpeaking={IsSpeaking} | DescVi='{Poi.DescriptionVi?.Length}' chars ===");

            if (IsSpeaking)
            {
                await _narrationService.StopAsync();
            }
            else
            {
                await _narrationService.SpeakAsync(Poi);
            }
        }
        catch (Exception ex)
        {
            System.Diagnostics.Debug.WriteLine($"Narration error: {ex}");
        }
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
