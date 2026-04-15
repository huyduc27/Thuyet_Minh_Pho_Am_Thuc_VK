namespace VinhKhanhFoodTour.Views;

public partial class AuthRequiredPopup : ContentPage
{
    // TaskCompletionSource de cho cho den khi user bam nut
    private readonly TaskCompletionSource<bool> _resultSource = new();

    public AuthRequiredPopup()
    {
        InitializeComponent();
    }

    /// <summary>
    /// Goi sau PushModalAsync de doi user tuong tac.
    /// Returns true = muon login, false = huy.
    /// </summary>
    public Task<bool> WaitForResultAsync() => _resultSource.Task;

    private async void OnBackgroundTapped(object? sender, TappedEventArgs e)
    {
        _resultSource.TrySetResult(false);
        await Navigation.PopModalAsync(animated: false);
    }

    private async void OnCancelTapped(object? sender, TappedEventArgs e)
    {
        _resultSource.TrySetResult(false);
        await Navigation.PopModalAsync(animated: false);
    }

    private async void OnLoginTapped(object? sender, TappedEventArgs e)
    {
        _resultSource.TrySetResult(true);
        await Navigation.PopModalAsync(animated: false);
    }
}
