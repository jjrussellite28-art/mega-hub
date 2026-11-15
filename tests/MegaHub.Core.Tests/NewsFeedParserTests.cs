using MegaHub.Core.Plugins;
using Xunit;

namespace MegaHub.Core.Tests;

public class NewsFeedParserTests
{
    [Fact]
    public void An_rss_item_becomes_plain_text_with_picture_and_time()
    {
        var xml = """
            <rss version="2.0" xmlns:media="http://search.yahoo.com/mrss/"><channel><title>T</title>
            <item><title>Hello &amp; welcome</title><link>https://example.org/a</link><pubDate>Sat, 14 Nov 2026 10:00:00 GMT</pubDate>
            <description><![CDATA[<p>First <b>part</b></p><p>Second part</p>]]></description>
            <media:thumbnail url="https://example.org/a.jpg"/></item></channel></rss>
            """;
        var items = NewsFeedParser.Parse(xml, "Example");
        var item = Assert.Single(items);
        Assert.Equal("Hello & welcome", item.Title);
        Assert.Equal("https://example.org/a", item.Link);
        Assert.Equal("https://example.org/a.jpg", item.Image);
        Assert.Equal("First part", item.Summary);
        Assert.Equal(2, item.Paragraphs.Count);
        Assert.True(item.Published > 0);
    }

    [Fact]
    public void An_atom_entry_is_read_and_a_doctype_is_refused()
    {
        var atom = """<feed xmlns="http://www.w3.org/2005/Atom"><entry><title>A</title><link rel="alternate" href="https://example.org/e"/><updated>2026-11-14T10:00:00Z</updated><summary>S</summary></entry></feed>""";
        Assert.Single(NewsFeedParser.Parse(atom, "F"));
        Assert.Empty(NewsFeedParser.Parse("<!DOCTYPE x [<!ENTITY y SYSTEM \"file:///c:/windows/win.ini\">]><rss><channel><item><title>&y;</title><link>https://e.org</link></item></channel></rss>", "F"));
        Assert.Empty(NewsFeedParser.Parse("not xml", "F"));
    }
}
