namespace VinhKhanhFoodTour.Models;

/// <summary>
/// Cài đặt ứng dụng (lưu qua Preferences)
/// </summary>
public class AppSettings
{
    public string SelectedLanguage { get; set; } = "vi";
    public double RadiusMultiplier { get; set; } = 1.0;     // Hệ số nhân bán kính (0.5x - 3.0x)
    public int CooldownMinutes { get; set; } = 10;          // Không phát lại trong X phút
    public bool AutoNarrate { get; set; } = true;
    public float TtsSpeed { get; set; } = 1.0f;
    public float TtsVolume { get; set; } = 1.0f;
}
