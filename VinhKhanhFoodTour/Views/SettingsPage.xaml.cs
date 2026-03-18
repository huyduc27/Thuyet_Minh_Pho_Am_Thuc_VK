using VinhKhanhFoodTour.ViewModels;

namespace VinhKhanhFoodTour.Views;

public partial class SettingsPage : ContentPage
{
    public SettingsPage(SettingsViewModel viewModel)
    {
        InitializeComponent();
        BindingContext = viewModel;
    }
}
