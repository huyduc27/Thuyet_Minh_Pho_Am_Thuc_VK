using VinhKhanhFoodTour.Services;
using VinhKhanhFoodTour.Views;

namespace VinhKhanhFoodTour;

public partial class AppShell : Shell
{
    public AppShell(FirebaseSyncService syncService)
    {
        InitializeComponent();

        // Đăng ký navigation route cho chi tiết POI
        Routing.RegisterRoute(nameof(PoiDetailPage), typeof(PoiDetailPage));

        // Firebase sync giờ được xử lý trong App.xaml.cs (đồng bộ trước → start geofence)
        // Không cần sync ở đây nữa để tránh race condition.
    }
}

