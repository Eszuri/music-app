using Xunit;
using Symvonia.AiLyrics;

namespace Symvonia.AiLyrics.Tests;

public class ProtocolTests
{
    [Fact]
    public void ParseCommand_ValidTranscribeJson_ReturnsParsedCommand()
    {
        string json = "{\"command\":\"transcribe\",\"path\":\"C:\\\\music\\\\song.mp3\",\"modelName\":\"base\",\"language\":\"id\"}";

        var cmd = Protocol.ParseCommand(json);

        Assert.NotNull(cmd);
        Assert.Equal("transcribe", cmd!.Name);
        Assert.Equal("C:\\music\\song.mp3", cmd.Path);
        Assert.Equal("base", cmd.ModelName);
        Assert.Equal("id", cmd.Language);
    }

    [Fact]
    public void ParseCommand_InvalidJson_ReturnsNull()
    {
        string json = "{ invalid json line }";

        var cmd = Protocol.ParseCommand(json);

        Assert.Null(cmd);
    }

    [Fact]
    public void ModelUrls_ContainsSupportedModels()
    {
        Assert.True(WhisperTranscriber.ModelUrls.ContainsKey("tiny"));
        Assert.True(WhisperTranscriber.ModelUrls.ContainsKey("base"));
        Assert.True(WhisperTranscriber.ModelUrls.ContainsKey("small"));
        Assert.StartsWith("https://", WhisperTranscriber.ModelUrls["base"]);
    }
}
