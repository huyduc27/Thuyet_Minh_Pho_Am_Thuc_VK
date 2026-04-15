using CommunityToolkit.Mvvm.ComponentModel;
using CommunityToolkit.Mvvm.Input;
using VinhKhanhFoodTour.Services;
using VinhKhanhFoodTour.Views;

namespace VinhKhanhFoodTour.ViewModels;

public partial class AuthViewModel : ObservableObject
{
    private readonly AuthService _authService;

    [ObservableProperty] private string _email = "";
    [ObservableProperty] private string _password = "";
    [ObservableProperty] private string _confirmPassword = "";
    [ObservableProperty] private string _displayName = "";
    [ObservableProperty] private bool _isLoading;
    [ObservableProperty] private string _errorMessage = "";

    public AuthViewModel(AuthService authService)
    {
        _authService = authService;
    }

    [RelayCommand]
    public async Task LoginAsync()
    {
        if (string.IsNullOrWhiteSpace(Email) || string.IsNullOrWhiteSpace(Password))
        {
            ErrorMessage = "Vui lòng nhập email và mật khẩu.";
            return;
        }

        IsLoading = true;
        ErrorMessage = "";

        var result = await _authService.LoginAsync(Email.Trim(), Password);
        IsLoading = false;

        if (result.Success)
        {
            // Pop LoginPage ve trang truoc (Settings / PoiList / Map)
            // AuthStateChanged se tu dong cap nhat UI cac ViewModel
            await Shell.Current.GoToAsync("..");
        }
        else
        {
            ErrorMessage = result.ErrorMessage ?? "Đăng nhập thất bại.";
        }
    }

    [RelayCommand]
    public async Task RegisterAsync()
    {
        if (string.IsNullOrWhiteSpace(DisplayName) ||
            string.IsNullOrWhiteSpace(Email) ||
            string.IsNullOrWhiteSpace(Password))
        {
            ErrorMessage = "Vui lòng điền đầy đủ thông tin.";
            return;
        }

        if (Password != ConfirmPassword)
        {
            ErrorMessage = "Mật khẩu xác nhận không khớp.";
            return;
        }

        if (Password.Length < 6)
        {
            ErrorMessage = "Mật khẩu phải có ít nhất 6 ký tự.";
            return;
        }

        IsLoading = true;
        ErrorMessage = "";

        var result = await _authService.RegisterAsync(Email.Trim(), Password, DisplayName.Trim());
        IsLoading = false;

        if (result.Success)
        {
            // Pop RegisterPage -> LoginPage -> trang goc
            await Shell.Current.GoToAsync("../..");
        }
        else
        {
            ErrorMessage = result.ErrorMessage ?? "Đăng ký thất bại.";
        }
    }

    [RelayCommand]
    public async Task GoToRegisterAsync()
    {
        ErrorMessage = "";
        await Shell.Current.GoToAsync(nameof(RegisterPage));
    }

    [RelayCommand]
    public async Task GoToLoginAsync()
    {
        ErrorMessage = "";
        await Shell.Current.GoToAsync("..");
    }

    [RelayCommand]
    public async Task GoBackAsync()
    {
        ErrorMessage = "";
        await Shell.Current.GoToAsync("..");
    }
}
