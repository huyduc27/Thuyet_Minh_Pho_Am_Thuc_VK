using VinhKhanhFoodTour.ViewModels;

namespace VinhKhanhFoodTour.Views;

public partial class PoiDetailPage : ContentPage
{
    private readonly PoiDetailViewModel _viewModel;

    public PoiDetailPage(PoiDetailViewModel viewModel)
    {
        InitializeComponent();
        BindingContext = _viewModel = viewModel;
    }

    protected override void OnAppearing()
    {
        base.OnAppearing();
        _viewModel.Subscribe();
    }

    protected override void OnDisappearing()
    {
        base.OnDisappearing();
        _viewModel.Unsubscribe();
    }
}
