using Xunit;
using Symvonia.AiLyrics;

namespace Symvonia.AiLyrics.Tests;

public class WhisperTranscriberTests
{
    [Theory]
    [InlineData("Thank you.")]
    [InlineData("Thank you for watching!")]
    [InlineData("Subtitles by Amara.org")]
    [InlineData("Subtitles by the Amara.org community")]
    [InlineData("Subscribe to my channel")]
    [InlineData("[music]")]
    [InlineData("(applause)")]
    [InlineData("   ")]
    public void CleanSegmentText_HallucinatedArtifact_ReturnsNull(string input)
    {
        string? cleaned = WhisperTranscriber.CleanSegmentText(input);
        Assert.Null(cleaned);
    }

    [Theory]
    [InlineData("I will be the strongest that he ever knew", "I will be the strongest that he ever knew")]
    [InlineData("♪ And we'll leave you alone ♪", "And we'll leave you alone")]
    [InlineData("yeah yeah yeah yeah yeah yeah", "yeah yeah")]
    public void CleanSegmentText_ValidLyric_ReturnsCleanedText(string input, string expected)
    {
        string? cleaned = WhisperTranscriber.CleanSegmentText(input);
        Assert.Equal(expected, cleaned);
    }

    [Theory]
    [InlineData(0.05f, 0.005f, "hi", true)]
    [InlineData(0.50f, 0.005f, "short", true)]
    [InlineData(0.85f, 0.60f, "I love music", false)]
    public void IsLowConfidenceSegment_EvaluatesThresholdsCorrectly(float prob, float minProb, string text, bool expectedDrop)

    {
        bool drop = WhisperTranscriber.IsLowConfidenceSegment(prob, minProb, text);
        Assert.Equal(expectedDrop, drop);
    }

    [Fact]
    public void CalculateRmsEnergy_DeadSilence_ReturnsZeroOrVeryLow()
    {
        float[] silentSamples = new float[16000];
        float rms = WhisperTranscriber.CalculateRmsEnergy(silentSamples, 16000, 0, 1.0);
        Assert.Equal(0.0f, rms);
    }

    [Fact]
    public void CalculateRmsEnergy_AudioSignal_ReturnsCorrectRms()
    {
        float[] samples = new float[16000];
        for (int i = 0; i < samples.Length; i++)
        {
            samples[i] = 0.5f;
        }
        float rms = WhisperTranscriber.CalculateRmsEnergy(samples, 16000, 0, 1.0);
        Assert.InRange(rms, 0.49f, 0.51f);
    }

    [Fact]
    public void HasTokenTimestampAnomalies_StuckToken_ReturnsTrue()
    {
        var tokens = new List<dynamic>
        {
            new { Text = "a", Start = TimeSpan.FromSeconds(0), End = TimeSpan.FromSeconds(4.5), Probability = 0.9f }
        };
        bool hasAnomaly = WhisperTranscriber.HasTokenTimestampAnomalies(tokens, 5.0);
        Assert.True(hasAnomaly);
    }

    [Fact]
    public void ConvertAudioTo16kHzWavStream_ValidMp3_ConvertsSuccessfully()
    {
        string mp3Path = @"d:\Codingan\Project-Next JS\music-app\tes.mp3";
        if (System.IO.File.Exists(mp3Path))
        {
            // Call WhisperTranscriber method
            float[] samples = Array.Empty<float>();
            var exception = Record.Exception(() =>
            {
                using var stream = (System.IO.MemoryStream)typeof(WhisperTranscriber)
                    .GetMethod("ConvertAudioTo16kHzWavStream", System.Reflection.BindingFlags.NonPublic | System.Reflection.BindingFlags.Static)!
                    .Invoke(null, new object[] { mp3Path, null! })!;
                
                byte[] bytes = stream.ToArray();
                samples = WhisperTranscriber.ExtractPcmSamples(bytes);
            });

            Assert.Null(exception);
            Assert.NotEmpty(samples);
        }
    }
}


