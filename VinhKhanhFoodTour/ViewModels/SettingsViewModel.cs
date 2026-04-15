using CommunityToolkit.Mvvm.ComponentModel;
using CommunityToolkit.Mvvm.Input;
using VinhKhanhFoodTour.Models;
using VinhKhanhFoodTour.Services;
using VinhKhanhFoodTour.Views;

namespace VinhKhanhFoodTour.ViewModels;

public partial class SettingsViewModel : ObservableObject
{
    private readonly SettingsService _settingsService;
    private readonly DatabaseService _databaseService;
    private readonly AuthService _authService;

    [ObservableProperty]
    private string _selectedLanguage = "vi";

    [ObservableProperty]
    private int _selectedLanguageIndex;

    [ObservableProperty]
    private double _radiusMultiplier = 1.0;

    [ObservableProperty]
    private int _cooldownMinutes = 10;

    [ObservableProperty]
    private bool _autoNarrate = true;

    [ObservableProperty]
    private float _ttsSpeed = 1.0f;

    [ObservableProperty]
    private float _ttsVolume = 1.0f;

    [ObservableProperty]
    private string _radiusMultiplierText = "x1.0";

    [ObservableProperty]
    private string _cooldownText = "10 phut";

    public List<string> LanguageOptions { get; } = new()
    {
        "Tieng Viet",
        "English",
        "Chinese",
        "Korean"
    };

    private readonly string[] _languageCodes = { "vi", "en", "zh", "ko" };

    // === Auth Info ===
    [ObservableProperty] private bool _isLoggedIn;
    [ObservableProperty] private string _userDisplayName = "Khách";
    [ObservableProperty] private string _userEmail = "";

    public SettingsViewModel(SettingsService settingsService, DatabaseService databaseService, AuthService authService)
    {
        _settingsService = settingsService;
        _databaseService = databaseService;
        _authService = authService;

        try { LoadSettings(); }
        catch (Exception ex) { System.Diagnostics.Debug.WriteLine($"Settings load error: {ex}"); }

        RefreshUserInfo();
        _authService.AuthStateChanged += (_, _) => RefreshUserInfo();
    }

    private void RefreshUserInfo()
    {
        IsLoggedIn = _authService.IsLoggedIn;
        UserDisplayName = _authService.CurrentUser?.DisplayName ?? "Khách";
        UserEmail = _authService.CurrentUser?.Email ?? "";
    }

    private void LoadSettings()
    {
        var settings = _settingsService.GetSettings();
        SelectedLanguage = settings.SelectedLanguage;
        SelectedLanguageIndex = Array.IndexOf(_languageCodes, settings.SelectedLanguage);
        if (SelectedLanguageIndex < 0) SelectedLanguageIndex = 0;
        RadiusMultiplier = settings.RadiusMultiplier;
        CooldownMinutes = settings.CooldownMinutes;
        AutoNarrate = settings.AutoNarrate;
        TtsVolume = settings.TtsVolume;
        UpdateDisplayTexts();
        
        // Initialize UI language on boot if arriving from Settings
        LocalizationResourceManager.Instance.SetCulture(SelectedLanguage);
    }

    partial void OnSelectedLanguageIndexChanged(int value)
    {
        if (value >= 0 && value < _languageCodes.Length)
        {
            SelectedLanguage = _languageCodes[value];
            SaveSettings();
            LocalizationResourceManager.Instance.SetCulture(SelectedLanguage);
        }
    }

    partial void OnRadiusMultiplierChanged(double value)
    {
        RadiusMultiplierText = $"x{value:F1}";
        SaveSettings();
    }

    partial void OnCooldownMinutesChanged(int value)
    {
        CooldownText = $"{value} phut";
        SaveSettings();
    }

    partial void OnAutoNarrateChanged(bool value)
    {
        SaveSettings();
    }

    partial void OnTtsVolumeChanged(float value)
    {
        SaveSettings();
    }

    private void UpdateDisplayTexts()
    {
        RadiusMultiplierText = $"x{RadiusMultiplier:F1}";
        CooldownText = $"{CooldownMinutes} phut";
    }

    private void SaveSettings()
    {
        try
        {
            _settingsService.SaveSettings(new AppSettings
            {
                SelectedLanguage = SelectedLanguage,
                RadiusMultiplier = RadiusMultiplier,
                CooldownMinutes = CooldownMinutes,
                AutoNarrate = AutoNarrate,
                TtsSpeed = TtsSpeed,
                TtsVolume = TtsVolume
            });
        }
        catch (Exception ex)
        {
            System.Diagnostics.Debug.WriteLine($"Save settings error: {ex}");
        }
    }

    [RelayCommand]
    private async Task ClearNarrationHistoryAsync()
    {
        try
        {
            await _databaseService.ClearNarrationLogsAsync();
            if (Shell.Current?.CurrentPage != null)
            {
                await Shell.Current.CurrentPage.DisplayAlertAsync(
                    "Done", "Narration history cleared", "OK");
            }
        }
        catch (Exception ex)
        {
            System.Diagnostics.Debug.WriteLine($"Clear history error: {ex}");
        }
    }

    [RelayCommand]
    private async Task LogoutAsync()
    {
        bool confirm = await Shell.Current.CurrentPage!.DisplayAlertAsync(
            "Đăng xuất", "Bạn có chắc muốn đăng xuất?", "Đăng xuất", "Hủy");
        if (!confirm) return;

        await _authService.LogoutAsync();
        // Điều hướng đến LoginPage
        await Shell.Current.GoToAsync(nameof(LoginPage));
    }

    [RelayCommand]
    private async Task GoToLoginAsync()
    {
        await Shell.Current.GoToAsync(nameof(LoginPage));
    }

    [RelayCommand]
    private async Task TestTtsAsync()
    {
        var testText = SelectedLanguage switch
        {
            "vi" => "Xin chao! Day la ung dung thuyet minh pho am thuc Vinh Khanh.",
            "en" => "Hello! This is the Vinh Khanh Food Street narration app.",
            "zh" => "Ni hao! This is Vinh Khanh Food Street app.",
            "ko" => "Hello! This is Vinh Khanh Food Street app.",
            _ => "Xin chao!"
        };

        try
        {
            var locales = await TextToSpeech.Default.GetLocalesAsync();
            var locale = locales.FirstOrDefault(l => l.Language.StartsWith(SelectedLanguage));

            var options = new SpeechOptions
            {
                Volume = TtsVolume,
                Pitch = 1.0f
            };
            if (locale != null) options.Locale = locale;

            await TextToSpeech.Default.SpeakAsync(testText, options);
        }
        catch (Exception ex)
        {
            System.Diagnostics.Debug.WriteLine($"TTS error: {ex}");
            if (Shell.Current?.CurrentPage != null)
            {
                await Shell.Current.CurrentPage.DisplayAlertAsync(
                    "TTS Error", $"Cannot play TTS: {ex.Message}", "OK");
            }
        }
    }
}
