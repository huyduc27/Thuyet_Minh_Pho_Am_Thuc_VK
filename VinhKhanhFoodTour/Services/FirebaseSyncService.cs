using System.Text.Json;
using VinhKhanhFoodTour.Models;

namespace VinhKhanhFoodTour.Services;

/// <summary>
/// Service đồng bộ dữ liệu từ Firebase Firestore về SQLite local.
/// Sử dụng Firestore REST API — không cần SDK, chạy mượt trên mọi nền tảng.
/// </summary>
public class FirebaseSyncService
{
    private readonly DatabaseService _db;
    private readonly HttpClient _http;

    // Firebase Project ID
    private const string ProjectId = "vinhkhanhfoodtour";
    private const string BaseUrl = $"https://firestore.googleapis.com/v1/projects/{ProjectId}/databases/(default)/documents";

    public FirebaseSyncService(DatabaseService db)
    {
        _db = db;
        _http = new HttpClient();
    }

    /// <summary>
    /// Đồng bộ toàn bộ POI từ Firebase Firestore xuống SQLite.
    /// Gọi hàm này mỗi khi mở app (nếu có mạng).
    /// </summary>
    public async Task<bool> SyncPoisAsync()
    {
        try
        {
            System.Diagnostics.Debug.WriteLine("[FirebaseSync] Bắt đầu đồng bộ POI từ Firestore...");

            var url = $"{BaseUrl}/pois";
            var response = await _http.GetAsync(url);

            if (!response.IsSuccessStatusCode)
            {
                System.Diagnostics.Debug.WriteLine($"[FirebaseSync] HTTP Error: {response.StatusCode}");
                return false;
            }

            var json = await response.Content.ReadAsStringAsync();
            var pois = ParsePoisFromFirestore(json);

            if (pois.Count == 0)
            {
                System.Diagnostics.Debug.WriteLine("[FirebaseSync] Không có POI nào trên Firestore.");
                return false;
            }

            // Đồng bộ xuống SQLite: xóa cũ → chèn mới
            await _db.SyncPoisAsync(pois);

            System.Diagnostics.Debug.WriteLine($"[FirebaseSync] ✅ Đã đồng bộ {pois.Count} POI thành công!");
            return true;
        }
        catch (HttpRequestException ex)
        {
            System.Diagnostics.Debug.WriteLine($"[FirebaseSync] Lỗi mạng: {ex.Message}");
            return false;
        }
        catch (Exception ex)
        {
            System.Diagnostics.Debug.WriteLine($"[FirebaseSync] Lỗi: {ex.Message}");
            return false;
        }
    }

    /// <summary>
    /// Phân tích cú pháp JSON đặc thù của Firestore REST API
    /// và chuyển đổi thành danh sách PointOfInterest.
    /// </summary>
    private List<PointOfInterest> ParsePoisFromFirestore(string json)
    {
        var result = new List<PointOfInterest>();

        try
        {
            using var doc = JsonDocument.Parse(json);
            var root = doc.RootElement;

            // Firestore trả về dạng: { "documents": [ ... ] }
            if (!root.TryGetProperty("documents", out var documents))
                return result;

            foreach (var document in documents.EnumerateArray())
            {
                if (!document.TryGetProperty("fields", out var fields))
                    continue;

                var poi = new PointOfInterest
                {
                    // Lấy ID từ đường dẫn document (vd: "projects/.../pois/abc123" → "abc123")
                    // Dùng GetHashCode để chuyển string ID thành int ID cho SQLite
                    Id = 0, // Sẽ được AutoIncrement khi Insert vào SQLite

                    Name = GetStringField(fields, "name"),
                    NameEn = GetStringField(fields, "nameEn"),
                    NameZh = GetStringField(fields, "nameZh"),
                    NameKo = GetStringField(fields, "nameKo"),

                    Latitude = GetDoubleField(fields, "latitude"),
                    Longitude = GetDoubleField(fields, "longitude"),
                    RadiusMeters = GetDoubleField(fields, "radiusMeters"),
                    Priority = (int)GetDoubleField(fields, "priority"),

                    DescriptionVi = GetStringField(fields, "descriptionVi"),
                    DescriptionEn = GetStringField(fields, "descriptionEn"),
                    DescriptionZh = GetStringField(fields, "descriptionZh"),
                    DescriptionKo = GetStringField(fields, "descriptionKo"),

                    Category = GetStringField(fields, "category"),
                    Address = GetStringField(fields, "address"),
                    Rating = GetDoubleField(fields, "rating"),
                    OpeningHours = GetStringField(fields, "openingHours"),
                    ImageUrl = GetStringField(fields, "imageUrl"),
                    PhoneNumber = GetStringField(fields, "phoneNumber"),
                };

                result.Add(poi);
            }
        }
        catch (Exception ex)
        {
            System.Diagnostics.Debug.WriteLine($"[FirebaseSync] Parse error: {ex.Message}");
        }

        return result;
    }

    // === Helper: Đọc giá trị String từ Firestore JSON ===
    // Firestore format: { "fieldName": { "stringValue": "abc" } }
    private static string GetStringField(JsonElement fields, string fieldName)
    {
        if (fields.TryGetProperty(fieldName, out var field))
        {
            if (field.TryGetProperty("stringValue", out var val))
                return val.GetString() ?? string.Empty;
        }
        return string.Empty;
    }

    // === Helper: Đọc giá trị Double từ Firestore JSON ===
    // Firestore format: { "fieldName": { "doubleValue": 10.5 } } hoặc { "integerValue": "50" }
    private static double GetDoubleField(JsonElement fields, string fieldName)
    {
        if (fields.TryGetProperty(fieldName, out var field))
        {
            if (field.TryGetProperty("doubleValue", out var dVal))
                return dVal.GetDouble();

            if (field.TryGetProperty("integerValue", out var iVal))
            {
                // Firestore trả integerValue dưới dạng string (!)
                if (double.TryParse(iVal.GetString(), out var parsed))
                    return parsed;
            }
        }
        return 0;
    }

    // ===== Sync NarrationLogs LÊN Firestore =====

    /// <summary>
    /// Đẩy các NarrationLog chưa sync từ SQLite lên Firestore.
    /// Gọi khi app mở hoặc resume (nếu có mạng).
    /// </summary>
    public async Task<int> SyncLogsToFirestoreAsync()
    {
        try
        {
            var unsyncedLogs = await _db.GetUnsyncedLogsAsync();
            if (unsyncedLogs.Count == 0)
            {
                System.Diagnostics.Debug.WriteLine("[FirebaseSync] Không có log mới để sync.");
                return 0;
            }

            System.Diagnostics.Debug.WriteLine($"[FirebaseSync] Đang sync {unsyncedLogs.Count} narration logs lên Firestore...");

            var syncedIds = new List<int>();

            foreach (var log in unsyncedLogs)
            {
                try
                {
                    var firestoreDoc = new
                    {
                        fields = new Dictionary<string, object>
                        {
                            ["poiId"] = new { integerValue = log.PoiId.ToString() },
                            ["poiName"] = new { stringValue = log.PoiName ?? "" },
                            ["language"] = new { stringValue = log.Language ?? "vi" },
                            ["source"] = new { stringValue = log.Source ?? "geofence" },
                            ["playedAt"] = new { timestampValue = log.PlayedAt.ToUniversalTime().ToString("o") }
                        }
                    };

                    var json = JsonSerializer.Serialize(firestoreDoc);
                    var content = new StringContent(json, System.Text.Encoding.UTF8, "application/json");

                    var url = $"{BaseUrl}/narrationLogs";
                    var response = await _http.PostAsync(url, content);

                    if (response.IsSuccessStatusCode)
                    {
                        syncedIds.Add(log.Id);
                    }
                    else
                    {
                        System.Diagnostics.Debug.WriteLine($"[FirebaseSync] Log sync failed: {response.StatusCode}");
                    }
                }
                catch (Exception ex)
                {
                    System.Diagnostics.Debug.WriteLine($"[FirebaseSync] Log sync error: {ex.Message}");
                }
            }

            // Đánh dấu đã sync thành công
            if (syncedIds.Count > 0)
            {
                await _db.MarkLogsSyncedAsync(syncedIds);
                System.Diagnostics.Debug.WriteLine($"[FirebaseSync] ✅ Đã sync {syncedIds.Count}/{unsyncedLogs.Count} logs lên Firestore!");
            }

            return syncedIds.Count;
        }
        catch (Exception ex)
        {
            System.Diagnostics.Debug.WriteLine($"[FirebaseSync] SyncLogs error: {ex.Message}");
            return 0;
        }
    }
}
