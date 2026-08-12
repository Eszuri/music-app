using Xunit;
using Symvonia.AiLyrics;

namespace Symvonia.AiLyrics.Tests;

public class VocalExtractorTests
{
    [Fact]
    public void ParseCommand_ExtractVocalJson_ReturnsParsedCommand()
    {
        string json = "{\"command\":\"extract_vocal\",\"path\":\"C:\\\\music\\\\song.mp3\",\"modelsDir\":\"C:\\\\models\"}";

        var cmd = Protocol.ParseCommand(json);

        Assert.NotNull(cmd);
        Assert.Equal("extract_vocal", cmd!.Name);
        Assert.Equal("C:\\music\\song.mp3", cmd.Path);
        Assert.Equal("C:\\models", cmd.ModelsDir);
    }

    [Fact]
    public void VocalExtractor_DefaultModelUrl_IsValid()
    {
        Assert.False(string.IsNullOrEmpty(VocalExtractor.DefaultModelUrl));
        Assert.StartsWith("https://", VocalExtractor.DefaultModelUrl);
        Assert.Equal("htdemucs_ft_vocals.onnx", VocalExtractor.DefaultModelFileName);
    }

    [Fact]
    public void VocalExtractor_ReadAudioTo441kHzStereo_SampleWav_ReturnsFloatArray()
    {
        string samplePath = Path.Combine(AppDomain.CurrentDomain.BaseDirectory, "..", "..", "..", "..", "..", "test_ai", "sample.wav");
        if (File.Exists(samplePath))
        {
            float[] samples = VocalExtractor.ReadAudioTo441kHzStereo(samplePath, out int rate, out int channels, out var duration);
            Assert.NotNull(samples);
            Assert.True(samples.Length > 0);
            Assert.Equal(44100, rate);
            Assert.Equal(2, channels);
        }
    }
}
