using VinhKhanhFoodTour.ViewModels;

namespace VinhKhanhFoodTour.Views;

public partial class RegisterPage : ContentPage
{
    public RegisterPage(AuthViewModel vm)
    {
        InitializeComponent();
        BindingContext = vm;
    }
}
