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

    // ===== Seed Data =====

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

    private const int SeedVersion = 5;

    public async Task SeedDataAsync()
    {
        var db = await GetDatabaseAsync();
        var count = await GetPoiCountAsync();

        var needReseed = count == 0 || Preferences.Get("seed_version", 0) < SeedVersion;
        if (!needReseed) return;

        await db.DeleteAllAsync<PointOfInterest>();
        await db.DeleteAllAsync<NarrationLog>();
        Preferences.Set("seed_version", SeedVersion);

        var pois = new List<PointOfInterest>
        {
            // ===== ỐC (Snail Restaurants) =====
            new()
            {
                Name = "Ốc Oanh 1 - Vĩnh Khánh", NameEn = "Oc Oanh Snail Restaurant",
                Latitude = 10.76142, Longitude = 106.70283, RadiusMeters = 80, Priority = 5,
                Category = "Ốc", Address = "534 Vĩnh Khánh, P.8, Q.4",
                DescriptionVi = "Ốc Oanh là quán ốc nổi tiếng nhất phố Vĩnh Khánh, được Michelin Guide công nhận. Đặc sản gồm nghêu nướng mỡ hành, sò điệp phô mai, càng ghẹ rang muối ớt. Quán có hơn 50 món ốc và hải sản đa dạng, thường xuyên có hàng dài khách chờ.",
                DescriptionEn = "Oc Oanh is the most famous snail restaurant on Vinh Khanh Street, recognized by the Michelin Guide. Specialties include grilled clams with green onion oil, cheese-baked scallops, and salt-chili crab claws. With over 50 dishes, queues are common.",
                Rating = 4.3, OpeningHours = "16:00 - 23:00"
            },
            new()
            {
                Name = "Quán Ốc Sáu Nở", NameEn = "Sau No Snail Restaurant",
                Latitude = 10.76115, Longitude = 106.70275, RadiusMeters = 60, Priority = 4,
                Category = "Ốc", Address = "128 Vĩnh Khánh, P.8, Q.4",
                DescriptionVi = "Ốc Sáu Nở là một trong những quán ốc lâu đời trên phố ốc Vĩnh Khánh, nằm gần cầu Calmet. Quán phục vụ đa dạng món ốc và hải sản với giá bình dân, không gian thoáng mát phù hợp nhóm bạn.",
                DescriptionEn = "Sau No is one of the long-established snail restaurants on Vinh Khanh snail street, near Calmet Bridge. Serves a wide variety of snail and seafood dishes at affordable prices in a breezy open-air setting.",
                Rating = 3.8, OpeningHours = "16:00 - 00:00"
            },
            new()
            {
                Name = "Ốc Thảo - Vĩnh Khánh", NameEn = "Thao Snail Restaurant",
                Latitude = 10.76171, Longitude = 106.70235, RadiusMeters = 45, Priority = 3,
                Category = "Ốc", Address = "383 Vĩnh Khánh, P.8, Q.4",
                DescriptionVi = "Ốc Thảo là quán ốc và hải sản trên phố Vĩnh Khánh với không gian rộng rãi. Quán phục vụ nhiều loại ốc nướng, hải sản chế biến đa dạng. Giá hợp lý, dễ tìm trên đường Vĩnh Khánh.",
                DescriptionEn = "Oc Thao is a spacious snail and seafood restaurant on Vinh Khanh Street. Offers various grilled snail dishes and diverse seafood at reasonable prices.",
                Rating = 3.5, OpeningHours = "10:00 - 00:00"
            },
            new()
            {
                Name = "Ốc Đào 2 - Vĩnh Khánh", NameEn = "Oc Dao 2 Snail Restaurant",
                Latitude = 10.76098, Longitude = 106.70485, RadiusMeters = 75, Priority = 5,
                Category = "Ốc", Address = "232/123 Vĩnh Khánh, P.10, Q.4",
                DescriptionVi = "Ốc Đào 2 là chi nhánh tại phố ẩm thực Vĩnh Khánh của quán ốc Ốc Đào nổi tiếng (gốc ở Quận 1). Quán nổi tiếng với ốc len xào dừa, nghêu nướng mỡ hành, và răng mực xào bơ. Không gian vỉa hè sôi động.",
                DescriptionEn = "Oc Dao 2 is the Vinh Khanh branch of the legendary Oc Dao (original in District 1). Famous for snails in coconut milk, grilled clams with scallion oil, and squid teeth in butter. Lively sidewalk atmosphere.",
                Rating = 4.1, OpeningHours = "10:00 - 00:00"
            },
            new()
            {
                Name = "Quán Ốc Vũ", NameEn = "Vu Snail Restaurant",
                Latitude = 10.76144, Longitude = 106.70267, RadiusMeters = 45, Priority = 3,
                Category = "Ốc", Address = "37 Vĩnh Khánh, P.8, Q.4",
                DescriptionVi = "Quán Ốc Vũ nằm ở đầu phố Vĩnh Khánh, nổi tiếng với hải sản tươi sống và giá cả bình dân. Nhân viên phục vụ chu đáo, không gian rộng rãi. Đặc biệt đông khách vào cuối tuần.",
                DescriptionEn = "Oc Vu is located at the start of Vinh Khanh Street, known for fresh live seafood at very affordable prices. Attentive service and spacious seating. Especially popular on weekends.",
                Rating = 4.2, OpeningHours = "15:00 - 22:00"
            },

            // ===== LẨU NƯỚNG (Hotpot & BBQ) =====
            new()
            {
                Name = "Lãng Quán - Vĩnh Khánh", NameEn = "Lang Quan Restaurant",
                Latitude = 10.76108, Longitude = 106.70550, RadiusMeters = 45, Priority = 3,
                Category = "Lẩu", Address = "122/34/31 Vĩnh Khánh, P.10, Q.4",
                DescriptionVi = "Lãng Quán là quán lẩu nướng nổi tiếng tại phố ẩm thực Vĩnh Khánh. Được đánh giá 'quán nhậu Q4 chất lượng nhà hàng'. Quán phục vụ các món lẩu, nướng đa dạng trong không gian thoáng mát.",
                DescriptionEn = "Lang Quan is a renowned hotpot and BBQ restaurant on Vinh Khanh food street. Praised as 'District 4 pub with restaurant quality.' Serves diverse hotpot and grilled dishes in a breezy setting.",
                Rating = 4.0, OpeningHours = "16:00 - 22:00"
            },
            new()
            {
                Name = "Ớt Xiêm Quán", NameEn = "Ot Xiem (Bird's Eye Chili) Restaurant",
                Latitude = 10.76096, Longitude = 106.70312, RadiusMeters = 40, Priority = 3,
                Category = "Nướng", Address = "568 Vĩnh Khánh, P.8, Q.4",
                DescriptionVi = "Ớt Xiêm Quán chuyên các món nướng và lẩu kiểu Việt. Nổi tiếng với đậu hủ khói lửa, cánh gà nướng, gà kho và lẩu gà cay. Giá bình dân, nằm trên đoạn cuối phố ẩm thực.",
                DescriptionEn = "Ot Xiem specializes in Vietnamese-style grilled and hotpot dishes. Famous for smoky tofu, grilled chicken wings, braised chicken, and spicy chicken hotpot. Affordable prices.",
                Rating = 3.8, OpeningHours = "16:00 - 00:00"
            },
            new()
            {
                Name = "Chilli - Lẩu Nướng Tự Chọn", NameEn = "Chilli Self-Select Hotpot & BBQ",
                Latitude = 10.76079, Longitude = 106.70458, RadiusMeters = 60, Priority = 4,
                Category = "Lẩu", Address = "232/105 Vĩnh Khánh, P.10, Q.4",
                DescriptionVi = "Chilli là quán lẩu nướng tự chọn nổi tiếng giữa phố ẩm thực Vĩnh Khánh. Menu đa dạng gồm lẩu hải sản, bạch tuộc, và đặc biệt dừa hỏa diệm sơn (dừa lửa). Không gian sôi động, giá phải chăng.",
                DescriptionEn = "Chilli is a popular self-select hotpot and BBQ spot in the heart of Vinh Khanh. Diverse menu including seafood hotpot, octopus, and the signature 'fire meteor coconut' dessert.",
                Rating = 4.3, OpeningHours = "16:00 - 23:00"
            },
            new()
            {
                Name = "A Fat Hot Pot - Lẩu HongKong", NameEn = "A Fat Hong Kong Hot Pot & BBQ",
                Latitude = 10.76066, Longitude = 106.70424, RadiusMeters = 45, Priority = 3,
                Category = "Lẩu", Address = "668 Vĩnh Khánh, P.8, Q.4",
                DescriptionVi = "A Fat Hot Pot là quán lẩu nướng phong cách Hong Kong trên đường Vĩnh Khánh. Có 4 loại nước lẩu, phục vụ bò chất lượng, bạch tuộc, và các món lựa chọn tự do. Đặc biệt có tủy heo và óc heo.",
                DescriptionEn = "A Fat Hot Pot serves Hong Kong-style hotpot and BBQ on Vinh Khanh Street. Offers 4 types of broth, quality beef, octopus, and self-select sides. Specialty items include pork marrow and brain.",
                Rating = 4.0, OpeningHours = "17:00 - 23:00"
            },
            new()
            {
                Name = "Sườn Muối Ớt - Vĩnh Khánh", NameEn = "Salt & Chili Grilled Ribs",
                Latitude = 10.76088, Longitude = 106.70330, RadiusMeters = 35, Priority = 3,
                Category = "Nướng", Address = "Vĩnh Khánh, P.8, Q.4",
                DescriptionVi = "Sườn Muối Ớt là quán nướng chuyên sườn heo nướng muối ớt, một trong những món đặc trưng của phố ẩm thực Vĩnh Khánh. Sườn nướng than hoa thơm lừng, gia vị đậm đà, kèm rau sống và nước chấm đặc biệt.",
                DescriptionEn = "Suon Muoi Ot specializes in salt and chili grilled pork ribs, a signature dish of Vinh Khanh food street. Charcoal-grilled ribs with rich seasoning, served with fresh vegetables and special dipping sauce.",
                Rating = 4.0, OpeningHours = "16:00 - 23:00"
            },
            new()
            {
                Name = "Tỷ Muội Quán", NameEn = "Ty Muoi (Sisters) Restaurant",
                Latitude = 10.76095, Longitude = 106.70480, RadiusMeters = 40, Priority = 3,
                Category = "Nướng", Address = "232/59 Vĩnh Khánh, P.10, Q.4",
                DescriptionVi = "Tỷ Muội Quán là quán nhậu bình dân phục vụ các món nướng, lẩu, gà, bò, heo đa dạng. Phù hợp cho gia đình, nhóm bạn và dân văn phòng. Mở cửa khuya đến 2 giờ sáng.",
                DescriptionEn = "Ty Muoi is a casual Vietnamese eatery serving diverse grilled, hotpot, chicken, beef, and pork dishes. Suitable for families and groups. Open late until 2 AM.",
                Rating = 3.9, OpeningHours = "16:00 - 02:00"
            },
            new()
            {
                Name = "Ba Cô Tiên - Quán Ăn Gia Đình", NameEn = "Three Fairies Family Restaurant",
                Latitude = 10.76164, Longitude = 106.70240, RadiusMeters = 40, Priority = 3,
                Category = "Nướng", Address = "400 Vĩnh Khánh, P.8, Q.4",
                DescriptionVi = "Ba Cô Tiên là quán ăn gia đình trên phố ẩm thực Vĩnh Khánh. Phục vụ đa dạng món Việt từ hải sản, nướng, đến các món nhậu bình dân. Không gian gia đình ấm cúng, giá cả phải chăng.",
                DescriptionEn = "Three Fairies is a family restaurant on Vinh Khanh food street. Serves diverse Vietnamese dishes from seafood and grilled items to casual pub fare. Cozy atmosphere at affordable prices.",
                Rating = 3.8, OpeningHours = "16:00 - 23:00"
            },

            // ===== HẢI SẢN & TRÁNG MIỆNG =====
            new()
            {
                Name = "Hải Sản Bé Mặn", NameEn = "Be Man Seafood",
                Latitude = 10.76150, Longitude = 106.70260, RadiusMeters = 60, Priority = 4,
                Category = "Hải sản", Address = "466 Vĩnh Khánh, P.8, Q.4",
                DescriptionVi = "Hải Sản Bé Mặn nổi tiếng với hải sản tươi sống từ biển về mỗi ngày. Đặc biệt có tôm hùm nướng phô mai, cua sốt trứng muối, và cá bống mú hấp Hồng Kông. Không gian rộng, có phòng riêng cho nhóm.",
                DescriptionEn = "Be Man Seafood is famous for daily fresh seafood. Highlights include cheese-baked lobster, salted egg crab, and Hong Kong-style steamed grouper. Spacious venue with private rooms.",
                Rating = 4.5, OpeningHours = "15:00 - 23:00"
            },
            new()
            {
                Name = "Cua Biển Tươi Sống", NameEn = "Fresh Live Sea Crab",
                Latitude = 10.76094, Longitude = 106.70316, RadiusMeters = 55, Priority = 4,
                Category = "Hải sản", Address = "570 Vĩnh Khánh, P.8, Q.4",
                DescriptionVi = "Quán chuyên cua biển tươi sống với nhiều cách chế biến: cua rang me, cua sốt trứng muối, cua hấp bia, cua lột chiên giòn. Cua được nhập từ Cà Mau, đảm bảo tươi sống mỗi ngày.",
                DescriptionEn = "Specializes in live sea crabs: tamarind crab, salted egg yolk crab, beer-steamed crab, and crispy soft-shell crab. Crabs sourced from Ca Mau, guaranteed fresh daily.",
                Rating = 4.6, OpeningHours = "15:00 - 23:00"
            },
            new()
            {
                Name = "Chè Vĩnh Khánh", NameEn = "Vinh Khanh Sweet Soup Dessert",
                Latitude = 10.76112, Longitude = 106.70280, RadiusMeters = 30, Priority = 2,
                Category = "Chè", Address = "150 Vĩnh Khánh, P.8, Q.4",
                DescriptionVi = "Quán chè mát lành giữa phố ẩm thực nóng bức. Có đa dạng chè như chè Thái, chè ba màu, chè đậu đỏ nước cốt dừa, sương sáo, và trái cây dầm. Điểm dừng chân hoàn hảo sau bữa ốc.",
                DescriptionEn = "A refreshing dessert stop amid the hot food street. Offers Thai-style mixed dessert, three-color dessert, red bean with coconut milk, grass jelly, and mixed fruit. Perfect cooldown after seafood.",
                Rating = 3.9, OpeningHours = "14:00 - 23:00"
            }
        };

        await InsertAllPoisAsync(pois);
    }
}
