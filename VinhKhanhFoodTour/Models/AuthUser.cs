namespace VinhKhanhFoodTour.Models;

public class AuthUser
{
    public string Uid { get; set; } = "";
    public string Email { get; set; } = "";
    public string DisplayName { get; set; } = "";
    public string Role { get; set; } = "tourist";
}

public class AuthResult
{
    public bool Success { get; set; }
    public string? ErrorMessage { get; set; }
    public string? IdToken { get; set; }
    public string? RefreshToken { get; set; }
    public string? Uid { get; set; }
}
