using SQLite;

namespace VinhKhanhFoodTour.Models;

/// <summary>
/// Ghi log đã phát thuyết minh, tránh phát lập lại
/// </summary>
public class NarrationLog
{
    [PrimaryKey, AutoIncrement]
    public int Id { get; set; }

    public int PoiId { get; set; }
    public DateTime PlayedAt { get; set; }
    public string Language { get; set; } = string.Empty;
}
