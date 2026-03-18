using VinhKhanhFoodTour.Views;

namespace VinhKhanhFoodTour;

public partial class AppShell : Shell
{
    public AppShell()
    {
        InitializeComponent();

        // Đăng ký navigation route cho chi tiết POI
        Routing.RegisterRoute(nameof(PoiDetailPage), typeof(PoiDetailPage));
    }
}
