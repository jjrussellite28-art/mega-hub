using System.Globalization;
using System.Net;
using System.Security.Cryptography;
using System.Text;
using System.Text.RegularExpressions;
using System.Xml;
using System.Xml.Linq;
using CouchHud.Sdk;

namespace MegaHub.Core.Plugins;

/// <summary>
/// Reads an RSS 2.0 or Atom feed into <see cref="PluginNewsItem"/>s. Plain text only (markup is stripped), no DTD, no external entities;
/// anything that does not parse gives an empty list. Used by Mega Hub's own News tab, which needs no plugin.
/// </summary>
public static partial class NewsFeedParser
{
    private static readonly XNamespace Atom = "http://www.w3.org/2005/Atom";
    private static readonly XNamespace Content = "http://purl.org/rss/1.0/modules/content/";
    private static readonly XNamespace Media = "http://search.yahoo.com/mrss/";

    [GeneratedRegex("<[^>]*>", RegexOptions.CultureInvariant)]
    private static partial Regex Tags();

    [GeneratedRegex(@"<img[^>]+src\s*=\s*[""']([^""']+)[""']", RegexOptions.CultureInvariant | RegexOptions.IgnoreCase)]
    private static partial Regex FirstImage();

    [GeneratedRegex(@"</(p|div|li|h[1-6]|br)\s*>|<br\s*/?>", RegexOptions.CultureInvariant | RegexOptions.IgnoreCase)]
    private static partial Regex Breaks();

    public static IReadOnlyList<PluginNewsItem> Parse(string xml, string feedName, int max = 25)
    {
        XDocument doc;
        try
        {
            var settings = new XmlReaderSettings { DtdProcessing = DtdProcessing.Prohibit, XmlResolver = null, MaxCharactersFromEntities = 0 };
            using var reader = XmlReader.Create(new StringReader(xml), settings);
            doc = XDocument.Load(reader);
        }
        catch (Exception ex) when (ex is XmlException or InvalidOperationException)
        {
            return [];
        }
        var items = new List<PluginNewsItem>();
        var root = doc.Root;
        if (root is null) return items;
        foreach (var node in root.Descendants().Where(e => e.Name.LocalName is "item" or "entry").Take(max))
        {
            var title = PlainText(Child(node, "title"));
            var link = LinkOf(node);
            if (title.Length == 0 || link.Length == 0) continue;
            var body = Child(node, "encoded", Content) is { Length: > 0 } full ? full : Child(node, "content", Atom) is { Length: > 0 } c ? c : Child(node, "description") is { Length: > 0 } d ? d : Child(node, "summary", Atom);
            var paragraphs = Paragraphs(body);
            var summary = paragraphs.Count > 0 ? paragraphs[0] : "";
            if (summary.Length > 400) summary = summary[..400].TrimEnd() + "…";
            items.Add(new PluginNewsItem(Hash(link), feedName, title, summary, link, ImageOf(node, body), PublishedOf(node), paragraphs.Take(30).ToList()));
        }
        return items;
    }

    private static string Child(XElement e, string local, XNamespace? ns = null)
    {
        var found = e.Elements().FirstOrDefault(x => x.Name.LocalName == local && (ns is null || x.Name.Namespace == ns || x.Name.Namespace == XNamespace.None));
        return found?.Value ?? "";
    }

    private static string LinkOf(XElement node)
    {
        foreach (var l in node.Elements().Where(x => x.Name.LocalName == "link"))
        {
            var href = (string?)l.Attribute("href");
            var rel = (string?)l.Attribute("rel");
            if (!string.IsNullOrWhiteSpace(href) && (rel is null or "alternate")) return href.Trim();
        }
        var text = Child(node, "link").Trim();
        if (text.Length > 0) return text;
        return Child(node, "guid").Trim() is { } g && g.StartsWith("http", StringComparison.OrdinalIgnoreCase) ? g : "";
    }

    private static string? ImageOf(XElement node, string body)
    {
        foreach (var e in node.Descendants())
        {
            var name = e.Name.LocalName;
            if (name is "thumbnail" or "content" && e.Name.Namespace == Media && (string?)e.Attribute("url") is { Length: > 0 } mediaUrl) return mediaUrl;
            if (name == "enclosure" && ((string?)e.Attribute("type"))?.StartsWith("image/", StringComparison.OrdinalIgnoreCase) == true && (string?)e.Attribute("url") is { Length: > 0 } encUrl) return encUrl;
        }
        var m = FirstImage().Match(body ?? "");
        return m.Success ? WebUtility.HtmlDecode(m.Groups[1].Value) : null;
    }

    private static long PublishedOf(XElement node)
    {
        foreach (var name in new[] { "pubDate", "published", "updated", "date" })
        {
            var text = Child(node, name).Trim();
            if (text.Length > 0 && DateTimeOffset.TryParse(text, CultureInfo.InvariantCulture, DateTimeStyles.AssumeUniversal, out var when))
                return when.ToUnixTimeMilliseconds();
        }
        return 0;
    }

    private static List<string> Paragraphs(string html)
    {
        if (string.IsNullOrWhiteSpace(html)) return [];
        var broken = Breaks().Replace(html, "$0\n");
        var text = WebUtility.HtmlDecode(Tags().Replace(broken, " "));
        return text.Split('\n', StringSplitOptions.RemoveEmptyEntries).Select(p => Regex.Replace(p, @"\s+", " ").Trim()).Where(p => p.Length > 0).ToList();
    }

    private static string PlainText(string s) => Regex.Replace(WebUtility.HtmlDecode(Tags().Replace(s ?? "", " ")), @"\s+", " ").Trim();

    private static string Hash(string link) => Convert.ToHexString(SHA256.HashData(Encoding.UTF8.GetBytes(link)))[..32].ToLowerInvariant();
}
