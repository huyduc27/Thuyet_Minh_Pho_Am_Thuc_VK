using VinhKhanhFoodTour.Models;

namespace VinhKhanhFoodTour.Services;

/// <summary>
/// Service quản lý cài đặt ứng dụng (lưu qua Preferences)
/// </summary>
public class SettingsService
{
    private const string LangKey = "selected_language";
    private const string MultiplierKey = "radius_multiplier";
    private const string CooldownKey = "cooldown_minutes";
    private const string AutoNarrateKey = "auto_narrate";
    private const string TtsSpeedKey = "tts_speed";
    private const string TtsVolumeKey = "tts_volume";

    public AppSettings GetSettings()
    {
        try
        {
            return new AppSettings
            {
                SelectedLanguage = Preferences.Default.Get(LangKey, "vi"),
                RadiusMultiplier = Preferences.Default.Get(MultiplierKey, 1.0),
                CooldownMinutes = Preferences.Default.Get(CooldownKey, 10),
                AutoNarrate = Preferences.Default.Get(AutoNarrateKey, true),
                TtsSpeed = Preferences.Default.Get(TtsSpeedKey, 1.0f),
                TtsVolume = Preferences.Default.Get(TtsVolumeKey, 1.0f)
            };
        }
        catch (Exception ex)
        {
            System.Diagnostics.Debug.WriteLine($"GetSettings error: {ex}");
            return new AppSettings();
        }
    }

    public void SaveSettings(AppSettings settings)
    {
        try
        {
            Preferences.Default.Set(LangKey, settings.SelectedLanguage);
            Preferences.Default.Set(MultiplierKey, settings.RadiusMultiplier);
            Preferences.Default.Set(CooldownKey, settings.CooldownMinutes);
            Preferences.Default.Set(AutoNarrateKey, settings.AutoNarrate);
            Preferences.Default.Set(TtsSpeedKey, settings.TtsSpeed);
            Preferences.Default.Set(TtsVolumeKey, settings.TtsVolume);
        }
        catch (Exception ex)
        {
            System.Diagnostics.Debug.WriteLine($"SaveSettings error: {ex}");
        }
    }

    public string GetSelectedLanguage()
    {
        try
        {
            return Preferences.Default.Get(LangKey, "vi");
        }
        catch
        {
            return "vi";
        }
    }

    public void SetSelectedLanguage(string langCode)
    {
        try
        {
            Preferences.Default.Set(LangKey, langCode);
        }
        catch (Exception ex)
        {
            System.Diagnostics.Debug.WriteLine($"SetLanguage error: {ex}");
        }
    }

    public static string GetLanguageDisplayName(string langCode)
    {
        return langCode switch
        {
            "vi" => "Tieng Viet",
            "en" => "English",
            "zh" => "Chinese",
            "ko" => "Korean",
            _ => "Tieng Viet"
        };
    }

    public static List<(string Code, string DisplayName)> GetSupportedLanguages()
    {
        return new List<(string, string)>
        {
            ("vi", "Tieng Viet"),
            ("en", "English"),
            ("zh", "Chinese"),
            ("ko", "Korean")
        };
    }
}
