using SQLite;

namespace VinhKhanhFoodTour.Models;

/// <summary>
/// Điểm quan tâm (quán ăn/địa điểm trên phố Vĩnh Khánh)
/// </summary>
public class PointOfInterest
{
    [PrimaryKey, AutoIncrement]
    public int Id { get; set; }

    // Tên đa ngôn ngữ
    public string Name { get; set; } = string.Empty;           // Tiếng Việt
    public string NameEn { get; set; } = string.Empty;         // English
    public string NameZh { get; set; } = string.Empty;         // 中文
    public string NameKo { get; set; } = string.Empty;         // 한국어

    // Tọa độ GPS
    public double Latitude { get; set; }
    public double Longitude { get; set; }

    // Geofence
    public double RadiusMeters { get; set; } = 50;             // Bán kính geofence (mặc định 50m)
    public int Priority { get; set; } = 1;                     // Ưu tiên thuyết minh (1 = thấp, 5 = cao)

    // Nội dung thuyết minh đa ngôn ngữ
    public string DescriptionVi { get; set; } = string.Empty;
    public string DescriptionEn { get; set; } = string.Empty;
    public string DescriptionZh { get; set; } = string.Empty;
    public string DescriptionKo { get; set; } = string.Empty;

    // Thông tin bổ sung
    public string ImageUrl { get; set; } = string.Empty;
    public string Category { get; set; } = string.Empty;       // "Ốc", "Lẩu", "Nướng", "Hải sản"...
    public string Address { get; set; } = string.Empty;
    public string PhoneNumber { get; set; } = string.Empty;
    public double Rating { get; set; }                         // Đánh giá (1-5)
    public string OpeningHours { get; set; } = string.Empty;

    /// <summary>
    /// Lấy tên theo ngôn ngữ
    /// </summary>
    public string GetLocalizedName(string langCode)
    {
        return langCode switch
        {
            "en" => string.IsNullOrEmpty(NameEn) ? Name : NameEn,
            "zh" => string.IsNullOrEmpty(NameZh) ? Name : NameZh,
            "ko" => string.IsNullOrEmpty(NameKo) ? Name : NameKo,
            _ => Name
        };
    }

    /// <summary>
    /// Lấy nội dung thuyết minh theo ngôn ngữ
    /// </summary>
    public string GetLocalizedDescription(string langCode)
    {
        return langCode switch
        {
            "en" => string.IsNullOrEmpty(DescriptionEn) ? DescriptionVi : DescriptionEn,
            "zh" => string.IsNullOrEmpty(DescriptionZh) ? DescriptionVi : DescriptionZh,
            "ko" => string.IsNullOrEmpty(DescriptionKo) ? DescriptionVi : DescriptionKo,
            _ => DescriptionVi
        };
    }
}
