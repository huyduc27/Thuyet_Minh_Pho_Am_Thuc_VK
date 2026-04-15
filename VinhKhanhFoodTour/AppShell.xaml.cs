using VinhKhanhFoodTour.Services;
using VinhKhanhFoodTour.Views;

namespace VinhKhanhFoodTour;

public partial class AppShell : Shell
{
    public AppShell(FirebaseSyncService syncService)
    {
        InitializeComponent();

        // Đăng ký route cho chi tiết POI
        Routing.RegisterRoute(nameof(PoiDetailPage), typeof(PoiDetailPage));

        // Đăng ký route cho màn hình Auth (không nằm trong TabBar)
        Routing.RegisterRoute(nameof(LoginPage), typeof(LoginPage));
        Routing.RegisterRoute(nameof(RegisterPage), typeof(RegisterPage));
    }
}

