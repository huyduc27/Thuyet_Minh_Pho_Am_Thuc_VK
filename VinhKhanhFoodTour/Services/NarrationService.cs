using VinhKhanhFoodTour.Models;
namespace VinhKhanhFoodTour.Services;

/// <summary>
/// Narration Engine: Quản lý phát thuyết minh TTS với hàng chờ tích lũy.
/// Mỗi lần GPS thay đổi, POI mới được THÊM vào hàng chờ (không hủy cái đang đọc).
/// </summary>
public class NarrationService
{
    private readonly DatabaseService _databaseService;
    private readonly SettingsService _settingsService;
    private readonly List<PointOfInterest> _queue = new();
    private readonly object _queueLock = new();
    private bool _isProcessing;
    private int _currentPoiId;
    private CancellationTokenSource? _cts;
    private bool _isSpeaking;

    public event EventHandler<PointOfInterest>? NarrationStarted;
    public event EventHandler<PointOfInterest>? NarrationFinished;

    public bool IsSpeaking => _isSpeaking;

    public NarrationService(DatabaseService databaseService, SettingsService settingsService)
    {
        _databaseService = databaseService;
        _settingsService = settingsService;
    }

    /// <summary>
    /// Thêm POI vào hàng chờ (không hủy cái đang đọc).
    /// POI trùng, đang đọc, hoặc còn cooldown sẽ bị bỏ qua.
    /// </summary>
    public async Task EnqueueAndNarrateAsync(List<PointOfInterest> pois)
    {
        var settings = _settingsService.GetSettings();
        if (!settings.AutoNarrate) return;

        int added = 0;
        foreach (var poi in pois)
        {
            if (poi.Id == _currentPoiId && _isSpeaking)
            {
                System.Diagnostics.Debug.WriteLine($"=== SKIP (đang đọc): {poi.Name} ===");
                continue;
            }

            bool alreadyInQueue;
            lock (_queueLock) { alreadyInQueue = _queue.Any(p => p.Id == poi.Id); }
            if (alreadyInQueue)
            {
                System.Diagnostics.Debug.WriteLine($"=== SKIP (đã trong hàng chờ): {poi.Name} ===");
                continue;
            }

            var hasPlayed = await _databaseService.HasPlayedRecentlyAsync(poi.Id, settings.CooldownMinutes);
            if (hasPlayed)
            {
                System.Diagnostics.Debug.WriteLine($"=== SKIP (cooldown): {poi.Name} ===");
                continue;
            }

            lock (_queueLock) { _queue.Add(poi); }
            added++;
            System.Diagnostics.Debug.WriteLine($"=== QUEUE ADD: {poi.Name} (total: {QueueCount}) ===");
        }

        if (added > 0 && !_isProcessing)
        {
            await ProcessQueueAsync();
        }
    }

    private int QueueCount { get { lock (_queueLock) { return _queue.Count; } } }

    private async Task ProcessQueueAsync()
    {
        if (_isProcessing) return;
        _isProcessing = true;

        try
        {
            while (true)
            {
                PointOfInterest? poi;
                lock (_queueLock)
                {
                    if (_queue.Count == 0) break;
                    poi = _queue[0];
                    _queue.RemoveAt(0);
                }

                _currentPoiId = poi.Id;
                var remaining = QueueCount;
                System.Diagnostics.Debug.WriteLine($"=== NARRATING: {poi.Name} (còn chờ: {remaining}) ===");

                await SpeakSingleAsync(poi);
                _currentPoiId = 0;

                if (QueueCount > 0)
                {
                    await Task.Delay(500);
                }
            }
        }
        catch (Exception ex)
        {
            System.Diagnostics.Debug.WriteLine($"=== QUEUE ERROR: {ex.Message} ===");
        }
        finally
        {
            _isProcessing = false;
            _currentPoiId = 0;
            System.Diagnostics.Debug.WriteLine("=== QUEUE FINISHED ===");
        }

        // Recheck: nếu có POI được thêm vào trong lúc đang thoát vòng lặp
        if (QueueCount > 0)
        {
            await ProcessQueueAsync();
        }
    }

    private async Task SpeakSingleAsync(PointOfInterest poi)
    {
        var settings = _settingsService.GetSettings();
        var text = poi.GetLocalizedDescription(settings.SelectedLanguage);
        if (string.IsNullOrWhiteSpace(text)) return;

        _isSpeaking = true;
        _cts = new CancellationTokenSource();
        NarrationStarted?.Invoke(this, poi);

        try
        {
            var locale = await GetLocaleForLanguageAsync(settings.SelectedLanguage);

            var speechOptions = new SpeechOptions
            {
                Volume = settings.TtsVolume,
                Pitch = 1.0f
            };

            if (locale != null)
            {
                speechOptions.Locale = locale;
            }

            await TextToSpeech.Default.SpeakAsync(text, speechOptions, _cts.Token);
            await _databaseService.LogNarrationAsync(poi.Id, settings.SelectedLanguage);
        }
        catch (TaskCanceledException)
        {
            System.Diagnostics.Debug.WriteLine($"=== TTS CANCELLED: {poi.Name} ===");
        }
        catch (Exception ex)
        {
            System.Diagnostics.Debug.WriteLine($"=== TTS ERROR: {ex.Message} ===");
        }
        finally
        {
            _isSpeaking = false;
            _cts?.Dispose();
            _cts = null;
            NarrationFinished?.Invoke(this, poi);
        }
    }

    /// <summary>
    /// Phát thuyết minh tự động (single POI, kiểm tra cooldown)
    /// </summary>
    public async Task<bool> TryAutoNarrateAsync(PointOfInterest poi)
    {
        var settings = _settingsService.GetSettings();
        if (!settings.AutoNarrate) return false;

        var hasPlayed = await _databaseService.HasPlayedRecentlyAsync(poi.Id, settings.CooldownMinutes);
        if (hasPlayed) return false;

        await SpeakAsync(poi);
        return true;
    }

    /// <summary>
    /// Phát thuyết minh thủ công (dừng tất cả trước, rồi đọc POI này)
    /// </summary>
    public async Task SpeakAsync(PointOfInterest poi)
    {
        await StopAsync();
        await Task.Delay(200);
        _currentPoiId = poi.Id;
        await SpeakSingleAsync(poi);
        _currentPoiId = 0;
    }

    /// <summary>
    /// Dừng hoàn toàn: hủy TTS + xóa hàng chờ
    /// </summary>
    public async Task StopAsync()
    {
        lock (_queueLock) { _queue.Clear(); }
        _cts?.Cancel();
        _cts?.Dispose();
        _cts = null;
        _isSpeaking = false;
        _isProcessing = false;
        _currentPoiId = 0;
        await Task.CompletedTask;
    }

    private async Task<Locale?> GetLocaleForLanguageAsync(string langCode)
    {
        var locales = await TextToSpeech.Default.GetLocalesAsync();
        var localeList = locales.ToList();

        var targetLang = langCode switch
        {
            "vi" => "vi",
            "en" => "en",
            "zh" => "zh",
            "ko" => "ko",
            _ => "vi"
        };

        return localeList.FirstOrDefault(l => l.Language.StartsWith(targetLang, StringComparison.OrdinalIgnoreCase));
    }

    public async Task<List<Locale>> GetAvailableLocalesAsync()
    {
        var locales = await TextToSpeech.Default.GetLocalesAsync();
        return locales.ToList();
    }
}
