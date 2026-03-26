var builder = WebApplication.CreateBuilder(args);
var app = builder.Build();
app.UseStaticFiles(new StaticFileOptions
{
    FileProvider = new Microsoft.Extensions.FileProviders.PhysicalFileProvider(
        @"g:\Tai Lieu Hoc Tap\C#\Test\VinhKhanhFoodTour\web-cms"
    ),
    RequestPath = ""
});
app.MapGet("/", context =>
{
    context.Response.Redirect("/index.html");
    return Task.CompletedTask;
});
app.Run("http://localhost:8080");
