using CouchHud.Sdk;
using MegaHub.Core.Plugins;
using Xunit;

namespace MegaHub.Core.Tests;

public class PluginPageLookTests
{
    [Fact]
    public void An_add_on_gets_a_preset_or_a_colour_and_a_plugin_gets_nothing()
    {
        var look = new PluginPageLook("Aurora", "#FFAA00");
        var view = PluginPageLooks.Check(look, "addon");
        Assert.Equal("aurora", view?.Background);
        Assert.Equal("#ffaa00", view?.Accent);
        Assert.Null(PluginPageLooks.Check(look, "plugin"));
    }

    [Theory]
    [InlineData("url(https://evil.example/x.png)")]
    [InlineData("red; position: fixed")]
    [InlineData("#12345")]
    [InlineData("nonsense")]
    public void Anything_that_is_not_a_known_word_or_colour_is_dropped(string value)
    {
        Assert.Null(PluginPageLooks.Check(new PluginPageLook(value, value), "addon"));
        Assert.Equal("#102030", PluginPageLooks.Check(new PluginPageLook(value, "#102030"), "addon")?.Accent);
    }

    [Fact]
    public void No_look_is_no_look() => Assert.Null(PluginPageLooks.Check(null, "addon"));
}
