using System.Runtime.InteropServices;
using System.Windows;
using System.Windows.Controls;
using System.Windows.Interop;
using System.Windows.Media;
using MegaHub.Shell.Native;

namespace MegaHub.Shell.Services;

/// <summary>
/// The start choice on several screens: every other screen shows a live copy of the Mega Hub window (a DWM thumbnail, so you can
/// pick from the couch whichever screen you face) and every screen shows a big "Screen N" label (the same numbering as the screen
/// setting: from the left). The windows take no input and no focus; <see cref="Hide"/> removes them all.
/// </summary>
internal sealed class ScreenOverlay
{
    private readonly List<Window> _windows = [];
    private readonly List<IntPtr> _thumbnails = [];

    public bool Active => _windows.Count > 0;

    public void Show(IntPtr mainWindow, bool mirror = true, bool labels = true)
    {
        Hide();
        var screens = Monitors();
        if (screens.Count < 2) return;
        var mainMonitor = NativeMethods.MonitorFromWindow(mainWindow, NativeMethods.MonitorDefaultToNearest);
        for (var i = 0; i < screens.Count; i++)
        {
            var (monitor, bounds, primary) = screens[i];
            var isMain = monitor == mainMonitor;
            try
            {
                if (mirror && !isMain) AddMirror(mainWindow, bounds, screens.First(s => s.Monitor == mainMonitor).Bounds);
                if (labels) AddLabel(i + 1, bounds, primary);
            }
            catch (Exception ex) when (ex is InvalidOperationException or COMException or System.ComponentModel.Win32Exception)
            {
                Console.Error.WriteLine($"[screens] overlay: {ex.Message}");
            }
        }
    }

    public void Hide()
    {
        foreach (var thumb in _thumbnails) DwmUnregisterThumbnail(thumb);
        _thumbnails.Clear();
        foreach (var window in _windows)
        {
            try { window.Close(); } catch (InvalidOperationException) { /* already closed */ }
        }
        _windows.Clear();
    }

    private static List<(IntPtr Monitor, NativeMethods.Rect Bounds, bool Primary)> Monitors()
    {
        var found = new List<(IntPtr, NativeMethods.Rect, bool)>();
        NativeMethods.EnumDisplayMonitors(IntPtr.Zero, IntPtr.Zero, (monitor, _, _, _) =>
        {
            var info = new NativeMethods.MonitorInfo { Size = Marshal.SizeOf<NativeMethods.MonitorInfo>() };
            if (NativeMethods.GetMonitorInfo(monitor, ref info)) found.Add((monitor, info.Monitor, (info.Flags & 1) != 0));
            return true;
        }, IntPtr.Zero);
        // The same order as DisplayService.Screens: from the left.
        DisplayService.SortScreens(found, s => (s.Item2.Left, s.Item2.Top));
        return found;
    }

    private Window NewWindow(NativeMethods.Rect bounds, System.Windows.Media.Brush background, bool transparent)
    {
        var window = new Window
        {
            WindowStyle = WindowStyle.None,
            ResizeMode = ResizeMode.NoResize,
            ShowInTaskbar = false,
            ShowActivated = false,
            Topmost = true,
            AllowsTransparency = transparent,
            Background = background,
            WindowStartupLocation = WindowStartupLocation.Manual
        };
        window.SourceInitialized += (_, _) =>
        {
            var hwnd = new WindowInteropHelper(window).Handle;
            // No focus, no clicks, not in Alt+Tab.
            var style = GetWindowLongPtr(hwnd, GwlExStyle).ToInt64();
            SetWindowLongPtr(hwnd, GwlExStyle, new IntPtr(style | WsExNoActivate | WsExTransparent | WsExToolWindow));
        };
        window.Show();
        var handle = new WindowInteropHelper(window).Handle;
        NativeMethods.SetWindowPos(handle, NativeMethods.HwndTopmost, bounds.Left, bounds.Top, bounds.Right - bounds.Left, bounds.Bottom - bounds.Top,
            NativeMethods.SwpNoActivate | NativeMethods.SwpShowWindow);
        _windows.Add(window);
        return window;
    }

    /// <summary>A black window with a live copy of the Mega Hub window, as large as fits and centered.</summary>
    private void AddMirror(IntPtr source, NativeMethods.Rect target, NativeMethods.Rect sourceBounds)
    {
        var window = NewWindow(target, System.Windows.Media.Brushes.Black, false);
        var hwnd = new WindowInteropHelper(window).Handle;
        if (DwmRegisterThumbnail(hwnd, source, out var thumb) != 0) return;
        _thumbnails.Add(thumb);
        double targetW = target.Right - target.Left, targetH = target.Bottom - target.Top;
        double sourceW = Math.Max(1, sourceBounds.Right - sourceBounds.Left), sourceH = Math.Max(1, sourceBounds.Bottom - sourceBounds.Top);
        var scale = Math.Min(targetW / sourceW, targetH / sourceH);
        var w = (int)(sourceW * scale);
        var h = (int)(sourceH * scale);
        var left = (int)((targetW - w) / 2);
        var top = (int)((targetH - h) / 2);
        var properties = new DwmThumbnailProperties
        {
            Flags = DwmTnpRectDestination | DwmTnpVisible | DwmTnpOpacity,
            Destination = new NativeMethods.Rect { Left = left, Top = top, Right = left + w, Bottom = top + h },
            Opacity = 255,
            Visible = true
        };
        DwmUpdateThumbnailProperties(thumb, ref properties);
    }

    /// <summary>"Screen N" in big letters at the top middle of the screen.</summary>
    private void AddLabel(int number, NativeMethods.Rect bounds, bool primary)
    {
        var width = bounds.Right - bounds.Left;
        var label = new System.Windows.Controls.Border
        {
            Background = new SolidColorBrush(System.Windows.Media.Color.FromArgb(200, 10, 14, 26)),
            CornerRadius = new CornerRadius(24),
            Padding = new Thickness(48, 16, 48, 20),
            HorizontalAlignment = System.Windows.HorizontalAlignment.Center,
            VerticalAlignment = System.Windows.VerticalAlignment.Top,
            Margin = new Thickness(0, 40, 0, 0),
            Child = new TextBlock
            {
                Text = MegaHub.Core.Localization.Strings.Get("screens.label", number) + (primary ? " · " + MegaHub.Core.Localization.Strings.Get("screens.main") : ""),
                Foreground = System.Windows.Media.Brushes.White,
                FontSize = Math.Max(48, width / 22.0),
                FontWeight = FontWeights.Bold
            }
        };
        var window = NewWindow(bounds, System.Windows.Media.Brushes.Transparent, true);
        window.Content = new Grid { Children = { label } };
    }

    private const int GwlExStyle = -20;
    private const long WsExNoActivate = 0x08000000, WsExTransparent = 0x20, WsExToolWindow = 0x80;
    private const int DwmTnpRectDestination = 0x1, DwmTnpOpacity = 0x4, DwmTnpVisible = 0x8;

    [StructLayout(LayoutKind.Sequential)]
    private struct DwmThumbnailProperties
    {
        public int Flags;
        public NativeMethods.Rect Destination;
        public NativeMethods.Rect Source;
        public byte Opacity;
        [MarshalAs(UnmanagedType.Bool)] public bool Visible;
        [MarshalAs(UnmanagedType.Bool)] public bool SourceClientAreaOnly;
    }

    [DllImport("dwmapi.dll")]
    private static extern int DwmRegisterThumbnail(IntPtr destination, IntPtr source, out IntPtr thumbnail);

    [DllImport("dwmapi.dll")]
    private static extern int DwmUpdateThumbnailProperties(IntPtr thumbnail, ref DwmThumbnailProperties properties);

    [DllImport("dwmapi.dll")]
    private static extern int DwmUnregisterThumbnail(IntPtr thumbnail);

    [DllImport("user32.dll", EntryPoint = "GetWindowLongPtrW")]
    private static extern IntPtr GetWindowLongPtr(IntPtr hWnd, int index);

    [DllImport("user32.dll", EntryPoint = "SetWindowLongPtrW")]
    private static extern IntPtr SetWindowLongPtr(IntPtr hWnd, int index, IntPtr value);
}
