using CommunityToolkit.Maui;
using Microsoft.Extensions.Logging;
using Microsoft.Maui.Controls.Maps;
using VinhKhanhFoodTour.Services;
using VinhKhanhFoodTour.ViewModels;
using VinhKhanhFoodTour.Views;

namespace VinhKhanhFoodTour;

public static class MauiProgram
{
    public static MauiApp CreateMauiApp()
    {
        var builder = MauiApp.CreateBuilder();
        builder
            .UseMauiApp<App>()
            .UseMauiCommunityToolkit()
            .UseMauiMaps()
            .ConfigureFonts(fonts =>
            {
                fonts.AddFont("OpenSans-Regular.ttf", "OpenSansRegular");
                fonts.AddFont("OpenSans-Semibold.ttf", "OpenSansSemibold");
            });

        // === Services (Singleton) ===
        builder.Services.AddSingleton<DatabaseService>();
        builder.Services.AddSingleton<LocationService>();
        builder.Services.AddSingleton<SettingsService>();
        builder.Services.AddSingleton<GeofenceService>();
        builder.Services.AddSingleton<NarrationService>();

        // === ViewModels ===
        builder.Services.AddTransient<PoiListViewModel>();
        builder.Services.AddTransient<PoiDetailViewModel>();
        builder.Services.AddTransient<SettingsViewModel>();
        builder.Services.AddTransient<MapViewModel>();

        // === Pages ===
        builder.Services.AddTransient<PoiListPage>();
        builder.Services.AddTransient<PoiDetailPage>();
        builder.Services.AddTransient<SettingsPage>();
        builder.Services.AddTransient<MapPage>();

#if DEBUG
        builder.Logging.AddDebug();
#endif

        return builder.Build();
    }
}