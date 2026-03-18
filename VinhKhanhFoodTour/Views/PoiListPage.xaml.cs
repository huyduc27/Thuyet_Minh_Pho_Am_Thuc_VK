using VinhKhanhFoodTour.ViewModels;

namespace VinhKhanhFoodTour.Views;

public partial class PoiListPage : ContentPage
{
    private readonly PoiListViewModel _viewModel;

    public PoiListPage(PoiListViewModel viewModel)
    {
        InitializeComponent();
        BindingContext = _viewModel = viewModel;
    }

    protected override async void OnAppearing()
    {
        base.OnAppearing();
        try
        {
            await _viewModel.LoadPoisAsync();
        }
        catch (Exception ex)
        {
            System.Diagnostics.Debug.WriteLine($"PoiListPage error: {ex}");
        }
    }
}
