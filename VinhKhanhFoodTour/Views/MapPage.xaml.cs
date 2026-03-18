using Microsoft.Maui.Controls.Maps;
using Microsoft.Maui.Maps;
using VinhKhanhFoodTour.ViewModels;

namespace VinhKhanhFoodTour.Views;

public partial class MapPage : ContentPage
{
    private readonly MapViewModel _viewModel;

    public MapPage(MapViewModel viewModel)
    {
        InitializeComponent();
        BindingContext = _viewModel = viewModel;
        _viewModel.MapControl = FoodMap;
        FoodMap.MapClicked += OnMapClicked;
    }

    protected override async void OnAppearing()
    {
        base.OnAppearing();

        try
        {
            await _viewModel.LoadMapAsync();
        }
        catch (Exception ex)
        {
            System.Diagnostics.Debug.WriteLine($"MapPage error: {ex}");
        }
    }

    private void OnMapClicked(object? sender, MapClickedEventArgs e)
    {
        _viewModel.OnMapTapped(e.Location.Latitude, e.Location.Longitude);
    }
}
