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

    /// <summary>
    /// Nguồn kích hoạt: "geofence", "manual", "qr"
    /// </summary>
    public string Source { get; set; } = "geofence";

    /// <summary>
    /// Tên POI (lưu kèm để hiển thị trên CMS không cần join)
    /// </summary>
    public string PoiName { get; set; } = string.Empty;

    /// <summary>
    /// Đã đồng bộ lên Firestore chưa? (false = chưa sync)
    /// </summary>
    public bool IsSynced { get; set; } = false;
}
