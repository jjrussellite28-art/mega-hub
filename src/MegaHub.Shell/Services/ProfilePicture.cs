using System.IO;
using System.Windows;
using System.Windows.Media.Imaging;

namespace MegaHub.Shell.Services;

/// <summary>Makes a profile picture out of an image file: a square cut from the middle, 128 pixels, JPEG, as a data URL.</summary>
public static class ProfilePicture
{
    private const int Size = 128;
    private const long MaxFileBytes = 12L * 1024 * 1024;
    private static readonly string[] Extensions = [".png", ".jpg", ".jpeg", ".gif", ".bmp", ".webp"];

    public static string FromFile(string path)
    {
        if (string.IsNullOrWhiteSpace(path) || !Path.IsPathRooted(path) || !Extensions.Contains(Path.GetExtension(path), StringComparer.OrdinalIgnoreCase))
            throw new InvalidOperationException("not a picture file");
        var info = new FileInfo(path);
        if (!info.Exists || info.Length is 0 or > MaxFileBytes) throw new InvalidOperationException("picture file missing or too large");

        var source = new BitmapImage();
        source.BeginInit();
        source.CacheOption = BitmapCacheOption.OnLoad;
        source.CreateOptions = BitmapCreateOptions.IgnoreColorProfile;
        source.UriSource = new Uri(path, UriKind.Absolute);
        source.EndInit();
        source.Freeze();

        var side = Math.Min(source.PixelWidth, source.PixelHeight);
        if (side <= 0) throw new InvalidOperationException("empty picture");
        var square = new CroppedBitmap(source, new Int32Rect((source.PixelWidth - side) / 2, (source.PixelHeight - side) / 2, side, side));
        var scaled = new TransformedBitmap(square, new System.Windows.Media.ScaleTransform((double)Size / side, (double)Size / side));
        var flat = new FormatConvertedBitmap(scaled, System.Windows.Media.PixelFormats.Bgr24, null, 0);
        var encoder = new JpegBitmapEncoder { QualityLevel = 85 };
        encoder.Frames.Add(BitmapFrame.Create(flat));
        using var stream = new MemoryStream();
        encoder.Save(stream);
        return "data:image/jpeg;base64," + Convert.ToBase64String(stream.ToArray());
    }
}
