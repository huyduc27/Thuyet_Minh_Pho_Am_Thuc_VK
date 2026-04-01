using SQLite;
using VinhKhanhFoodTour.Models;

namespace VinhKhanhFoodTour.Services;

/// <summary>
/// Service quản lý database SQLite: CRUD PointOfInterest, NarrationLog
/// </summary>
public class DatabaseService
{
    private SQLiteAsyncConnection? _database;
    private readonly string _dbPath;
    private bool _isInitialized;

    public DatabaseService()
    {
        _dbPath = Path.Combine(FileSystem.AppDataDirectory, "vinhkhanh_foodtour.db3");
    }

    private async Task<SQLiteAsyncConnection> GetDatabaseAsync()
    {
        if (_database != null && _isInitialized)
            return _database;

        try
        {
            _database = new SQLiteAsyncConnection(_dbPath);
            await _database.CreateTableAsync<PointOfInterest>();
            await _database.CreateTableAsync<NarrationLog>();
            _isInitialized = true;
        }
        catch (Exception ex)
        {
            System.Diagnostics.Debug.WriteLine($"DB init error: {ex}");
            throw;
        }

        return _database;
    }

    // ===== PointOfInterest CRUD =====

    public async Task<List<PointOfInterest>> GetAllPoisAsync()
    {
        try
        {
            var db = await GetDatabaseAsync();
            return await db.Table<PointOfInterest>().ToListAsync();
        }
        catch (Exception ex)
        {
            System.Diagnostics.Debug.WriteLine($"GetAllPois error: {ex}");
            return new List<PointOfInterest>();
        }
    }

    public async Task<PointOfInterest?> GetPoiByIdAsync(int id)
    {
        try
        {
            var db = await GetDatabaseAsync();
            return await db.Table<PointOfInterest>().FirstOrDefaultAsync(p => p.Id == id);
        }
        catch (Exception ex)
        {
            System.Diagnostics.Debug.WriteLine($"GetPoiById error: {ex}");
            return null;
        }
    }

    public async Task<List<PointOfInterest>> GetPoisByCategoryAsync(string category)
    {
        try
        {
            var db = await GetDatabaseAsync();
            return await db.Table<PointOfInterest>().Where(p => p.Category == category).ToListAsync();
        }
        catch
        {
            return new List<PointOfInterest>();
        }
    }

    public async Task<int> SavePoiAsync(PointOfInterest poi)
    {
        var db = await GetDatabaseAsync();
        if (poi.Id != 0)
            return await db.UpdateAsync(poi);
        else
            return await db.InsertAsync(poi);
    }

    public async Task<int> InsertAllPoisAsync(List<PointOfInterest> pois)
    {
        var db = await GetDatabaseAsync();
        return await db.InsertAllAsync(pois);
    }

    // ===== NarrationLog =====

    public async Task<int> LogNarrationAsync(int poiId, string language)
    {
        try
        {
            var db = await GetDatabaseAsync();
            var log = new NarrationLog
            {
                PoiId = poiId,
                PlayedAt = DateTime.Now,
                Language = language
            };
            return await db.InsertAsync(log);
        }
        catch
        {
            return 0;
        }
    }

    public async Task<bool> HasPlayedRecentlyAsync(int poiId, int cooldownMinutes)
    {
        try
        {
            var db = await GetDatabaseAsync();
            var cutoff = DateTime.Now.AddMinutes(-cooldownMinutes);
            var recent = await db.Table<NarrationLog>()
                .Where(l => l.PoiId == poiId && l.PlayedAt > cutoff)
                .FirstOrDefaultAsync();
            return recent != null;
        }
        catch
        {
            return false;
        }
    }

    public async Task ClearNarrationLogsAsync()
    {
        try
        {
            var db = await GetDatabaseAsync();
            await db.DeleteAllAsync<NarrationLog>();
        }
        catch (Exception ex)
        {
            System.Diagnostics.Debug.WriteLine($"ClearLogs error: {ex}");
        }
    }

    // ===== Sync từ Firebase =====

    public async Task<int> GetPoiCountAsync()
    {
        try
        {
            var db = await GetDatabaseAsync();
            return await db.Table<PointOfInterest>().CountAsync();
        }
        catch
        {
            return 0;
        }
    }

    /// <summary>
    /// Nhận danh sách POI mới từ Firebase, xóa hết dữ liệu cũ trong SQLite rồi chèn mới.
    /// Đây là cơ chế "Offline-First": tải 1 lần → dùng offline mãi mãi cho đến lần sync tiếp theo.
    /// </summary>
    public async Task SyncPoisAsync(List<PointOfInterest> remotePois)
    {
        var db = await GetDatabaseAsync();

        // Xóa POI cũ, giữ nguyên NarrationLog (lịch sử phát)
        await db.DeleteAllAsync<PointOfInterest>();

        // Đảm bảo tất cả Id = 0 để SQLite tự AutoIncrement  
        foreach (var poi in remotePois)
            poi.Id = 0;

        await db.InsertAllAsync(remotePois);

        // Lưu thời điểm đồng bộ gần nhất
        Preferences.Set("last_sync", DateTime.Now.ToString("o"));

        System.Diagnostics.Debug.WriteLine($"[DB] Đã sync {remotePois.Count} POI vào SQLite.");
    }

    /// <summary>
    /// Kiểm tra xem đã từng đồng bộ chưa (dùng để hiện thông báo cho người dùng)
    /// </summary>
    public bool HasSyncedBefore()
    {
        return !string.IsNullOrEmpty(Preferences.Get("last_sync", string.Empty));
    }

    /// <summary>
    /// SeedData cũ — giờ chỉ giữ lại làm fallback.
    /// Nếu chưa từng sync và không có mạng, app sẽ không có dữ liệu.
    /// </summary>
    public async Task SeedDataAsync()
    {
        // Dữ liệu giờ đã sống trên Firebase CMS. 
        // Không cần seed cứng nữa. App sẽ tự đồng bộ khi mở lên.
        await Task.CompletedTask;
    }
}
