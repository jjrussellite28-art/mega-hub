using System.Text.RegularExpressions;
using CouchHud.Sdk;

namespace MegaHub.Core.Plugins;

/// <summary>
/// The look an add-on may give its page (<see cref="PluginPageLook"/>). Only fixed words and "#rrggbb" colours get through, never free CSS or
/// addresses, so a page can change how it looks but never what it can reach. A plugin (not an add-on) gets no look at all.
/// </summary>
public static partial class PluginPageLooks
{
    public static readonly IReadOnlyList<string> Presets = ["aurora", "sunset", "forest", "midnight", "ember", "ocean"];

    [GeneratedRegex(@"^#[0-9a-fA-F]{6}\z")]
    private static partial Regex ColourPattern();

    /// <summary>What the page may show: null for a plugin or when nothing valid is set.</summary>
    public static PluginPageLookView? Check(PluginPageLook? look, string kind)
    {
        if (look is null || !string.Equals(kind, "addon", StringComparison.Ordinal)) return null;
        string? background = look.Background?.Trim();
        background = background is not null && (Presets.Contains(background.ToLowerInvariant()) || ColourPattern().IsMatch(background)) ? background.ToLowerInvariant() : null;
        var accent = look.Accent?.Trim();
        accent = accent is not null && ColourPattern().IsMatch(accent) ? accent.ToLowerInvariant() : null;
        return background is null && accent is null ? null : new PluginPageLookView(background, accent);
    }
}

/// <summary>The cleaned look that goes to the page.</summary>
public sealed record PluginPageLookView(string? Background, string? Accent);
