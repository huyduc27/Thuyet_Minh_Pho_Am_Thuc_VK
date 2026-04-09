using System.ComponentModel;
using System.Runtime.CompilerServices;
using System.Collections.Generic;

namespace VinhKhanhFoodTour.Services;

public class LocalizationResourceManager : INotifyPropertyChanged
{
    private static readonly Lazy<LocalizationResourceManager> _instance = new(() => new LocalizationResourceManager());
    public static LocalizationResourceManager Instance => _instance.Value;

    private string _currentCulture = "vi";

    private readonly Dictionary<string, Dictionary<string, string>> _resources = new()
    {
        // === AppShell ===
        ["Tab_List"] = new() { ["vi"] = "Danh sach", ["en"] = "List", ["zh"] = "列表", ["ko"] = "목록" },
        ["Tab_Map"] = new() { ["vi"] = "Ban do", ["en"] = "Map", ["zh"] = "地图", ["ko"] = "지도" },
        ["Tab_Settings"] = new() { ["vi"] = "Cai dat", ["en"] = "Settings", ["zh"] = "设置", ["ko"] = "설정" },

        // === Settings ===
        ["Settings_Title"] = new() { ["vi"] = "CAI DAT", ["en"] = "SETTINGS", ["zh"] = "设置", ["ko"] = "설정" },
        ["Settings_Language"] = new() { ["vi"] = "Ngon ngu", ["en"] = "Language", ["zh"] = "语言", ["ko"] = "언어" },
        ["Settings_SelectLanguageLabel"] = new() { ["vi"] = "Chon ngon ngu thuyet minh:", ["en"] = "Select narration language:", ["zh"] = "选择解说语言：", ["ko"] = "설명 언어 선택:" },
        ["Settings_PickLanguage"] = new() { ["vi"] = "Chon ngon ngu", ["en"] = "Select language", ["zh"] = "选择语言", ["ko"] = "언어 선택" },
        ["Settings_Geofence"] = new() { ["vi"] = "Vung phat hien", ["en"] = "Detection Area", ["zh"] = "探测区域", ["ko"] = "감지 구역" },
        ["Settings_GeofenceDesc"] = new() { ["vi"] = "Dieu chinh he so de tang/giam do nhay phat hien.", ["en"] = "Adjust multiplier to change sensitivity.", ["zh"] = "调整系数以改变灵敏度。", ["ko"] = "배수를 조절하여 감도를 변경하십시오." },
        ["Settings_Sensitivity"] = new() { ["vi"] = "Do nhay:", ["en"] = "Sensitivity:", ["zh"] = "灵敏度:", ["ko"] = "감도:" },
        ["Settings_Cooldown"] = new() { ["vi"] = "Cooldown:", ["en"] = "Cooldown:", ["zh"] = "冷却时间:", ["ko"] = "쿨다운:" },
        ["Settings_Narration"] = new() { ["vi"] = "Thuyet minh", ["en"] = "Narration", ["zh"] = "解说", ["ko"] = "설명" },
        ["Settings_AutoPlay"] = new() { ["vi"] = "Tu dong phat:", ["en"] = "Auto play:", ["zh"] = "自动播放:", ["ko"] = "자동 재생:" },
        ["Settings_Volume"] = new() { ["vi"] = "Am luong:", ["en"] = "Volume:", ["zh"] = "音量:", ["ko"] = "볼륨:" },
        ["Settings_TestTTS"] = new() { ["vi"] = "▶  Thu TTS", ["en"] = "▶  Test TTS", ["zh"] = "▶  测试 TTS", ["ko"] = "▶  TTS 테스트" },
        ["Settings_Data"] = new() { ["vi"] = "Du lieu", ["en"] = "Data", ["zh"] = "数据", ["ko"] = "데이터" },
        ["Settings_ClearHistory"] = new() { ["vi"] = "Xoa lich su thuyet minh", ["en"] = "Clear narration history", ["zh"] = "清除解说历史", ["ko"] = "설명 기록 지우기" },
        ["Settings_About"] = new() { ["vi"] = "Thong tin", ["en"] = "About", ["zh"] = "信息", ["ko"] = "정보" },
        ["Settings_AppTitle"] = new() { ["vi"] = "Pho Am Thuc Vinh Khanh", ["en"] = "Vinh Khanh Food Street", ["zh"] = "永庆美食街", ["ko"] = "빈칸 음식 거리" },
        ["Settings_AppDesc"] = new() { ["vi"] = "Ung dung thuyet minh da ngon ngu", ["en"] = "Multi-language narration app", ["zh"] = "多语言解说应用", ["ko"] = "다국어 설명 앱" },
        ["Settings_Version"] = new() { ["vi"] = "Phien ban 1.0.0", ["en"] = "Version 1.0.0", ["zh"] = "版本 1.0.0", ["ko"] = "버전 1.0.0" },
        ["Settings_AppFoot"] = new() { ["vi"] = "2026 - Do an .NET MAUI", ["en"] = "2026 - .NET MAUI Project", ["zh"] = "2026 - .NET MAUI 项目", ["ko"] = "2026 - .NET MAUI 프로젝트" },
        ["Settings_Minutes"] = new() { ["vi"] = "phút", ["en"] = "minutes", ["zh"] = "分钟", ["ko"] = "분" },

        // === List ===
        ["List_Title"] = new() { ["vi"] = "DANH SACH QUAN AN", ["en"] = "RESTAURANTS LIST", ["zh"] = "餐厅列表", ["ko"] = "식당 목록" },
        ["List_Search"] = new() { ["vi"] = "🔍 Tim kiem quan an...", ["en"] = "🔍 Search restaurants...", ["zh"] = "🔍 搜索餐厅...", ["ko"] = "🔍 식당 검색..." },
        ["List_TabAll"] = new() { ["vi"] = "TAT CA", ["en"] = "ALL", ["zh"] = "全部", ["ko"] = "전체" },
        ["List_TabSnails"] = new() { ["vi"] = "OC", ["en"] = "SNAILS", ["zh"] = "蜗牛", ["ko"] = "달팽이" },
        ["List_TabHotpot"] = new() { ["vi"] = "LAU/NUONG", ["en"] = "HOTPOT/BBQ", ["zh"] = "火锅/烧烤", ["ko"] = "훠궈/바베큐" },
        ["List_TabSeafood"] = new() { ["vi"] = "HAI SAN", ["en"] = "SEAFOOD", ["zh"] = "海鲜", ["ko"] = "해산물" },
        ["List_TabMore"] = new() { ["vi"] = "KHAC", ["en"] = "MORE", ["zh"] = "更多", ["ko"] = "더보기" },
        ["List_Empty"] = new() { ["vi"] = "🍽️ Khong tim thay quan an nao", ["en"] = "🍽️ No restaurants found", ["zh"] = "🍽️ 未找到餐厅", ["ko"] = "🍽️ 식당을 찾을 수 없습니다" },
        ["List_Featured"] = new() { ["vi"] = "QUAN NOI BAT", ["en"] = "FEATURED", ["zh"] = "精选", ["ko"] = "추천" },
        ["Category_All"] = new() { ["vi"] = "Tất cả", ["en"] = "All", ["zh"] = "全部", ["ko"] = "모든" },
        ["Category_Oc"] = new() { ["vi"] = "Ốc", ["en"] = "Snail", ["zh"] = "蜗牛", ["ko"] = "달팽이" },
        ["Category_Lau"] = new() { ["vi"] = "Lẩu", ["en"] = "Hotpot", ["zh"] = "火锅", ["ko"] = "전골" },
        ["Category_Nuong"] = new() { ["vi"] = "Nướng", ["en"] = "Grill", ["zh"] = "烧烤", ["ko"] = "그릴" },
        ["Category_HaiSan"] = new() { ["vi"] = "Hải sản", ["en"] = "Seafood", ["zh"] = "海鲜", ["ko"] = "해산물" },
        ["Category_Bo"] = new() { ["vi"] = "Bò", ["en"] = "Beef", ["zh"] = "牛肉", ["ko"] = "소고기" },
        ["Category_Com"] = new() { ["vi"] = "Cơm", ["en"] = "Rice", ["zh"] = "米饭", ["ko"] = "밥" },
        ["Category_AnVat"] = new() { ["vi"] = "Ăn vặt", ["en"] = "Snacks", ["zh"] = "零食", ["ko"] = "간식" },
        ["Category_Che"] = new() { ["vi"] = "Chè", ["en"] = "Sweet Soup", ["zh"] = "甜汤", ["ko"] = "단팥죽" },
        ["Category_TrangMieng"] = new() { ["vi"] = "Tráng miệng", ["en"] = "Dessert", ["zh"] = "甜点", ["ko"] = "디저트" },

        // === Detail ===
        ["Detail_Rating"] = new() { ["vi"] = "Danh gia:", ["en"] = "Rating:", ["zh"] = "评分:", ["ko"] = "평점:" },
        ["Detail_Category"] = new() { ["vi"] = "The loai:", ["en"] = "Category:", ["zh"] = "类别:", ["ko"] = "범주:" },
        ["Detail_Address"] = new() { ["vi"] = "Dia chi:", ["en"] = "Address:", ["zh"] = "地址:", ["ko"] = "주소:" },
        ["Detail_Opening"] = new() { ["vi"] = "Gio ban:", ["en"] = "Hours:", ["zh"] = "营业:", ["ko"] = "영업시간:" },
        ["Detail_Listen"] = new() { ["vi"] = "🔊 Nghe ngay", ["en"] = "🔊 Listen now", ["zh"] = "🔊 立即收听", ["ko"] = "🔊 즉시 듣기" },
        ["Detail_Desc"] = new() { ["vi"] = "Gioi thieu", ["en"] = "Description", ["zh"] = "描述", ["ko"] = "소개" },
        ["Detail_Info"] = new() { ["vi"] = "Thong tin chi tiet", ["en"] = "Details", ["zh"] = "详细信息", ["ko"] = "상세 정보" }
    };

    public string this[string key] => GetValue(key);

    public string GetValue(string key)
    {
        if (_resources.TryGetValue(key, out var translations))
        {
            if (translations.TryGetValue(_currentCulture, out var value))
            {
                return value;
            }
            if (translations.TryGetValue("vi", out var fallback))
            {
                return fallback;
            }
        }
        return key;
    }

    public void SetCulture(string langCode)
    {
        if (_currentCulture != langCode)
        {
            _currentCulture = langCode;
            OnPropertyChanged("Item"); // "Item" triggers re-evaluation for all indexers this[...]
        }
    }

    public event PropertyChangedEventHandler? PropertyChanged;

    protected void OnPropertyChanged([CallerMemberName] string? propertyName = null)
    {
        PropertyChanged?.Invoke(this, new PropertyChangedEventArgs(propertyName));
    }
}
