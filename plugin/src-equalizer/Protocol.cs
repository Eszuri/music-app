using System.Text.Json;
using System.Text.Json.Serialization;

namespace Symvonia.Equalizer;

public static class Protocol
{
    public sealed class Command
    {
        [JsonPropertyName("command")] public string? Name { get; set; }
        [JsonPropertyName("bandMode")] public int? BandMode { get; set; }
        [JsonPropertyName("bands")] public double[]? Bands { get; set; }
        [JsonPropertyName("preamp")] public double? Preamp { get; set; }
        [JsonPropertyName("autoPreamp")] public bool? AutoPreamp { get; set; }
        [JsonPropertyName("sampleRate")] public int? SampleRate { get; set; }
    }

    public sealed class VerifyResponse
    {
        [JsonPropertyName("event")] public string Event { get; set; } = "verify_response";
        [JsonPropertyName("token")] public string Token { get; set; } = "";
        [JsonPropertyName("engine")] public string Engine { get; set; } = "Symvonia Equalizer DSP Engine";
        [JsonPropertyName("version")] public string Version { get; set; } = "1.0.0";
    }

    public sealed class ReadyEvent
    {
        [JsonPropertyName("event")] public string Event { get; set; } = "ready";
        [JsonPropertyName("engine")] public string Engine { get; set; } = "Symvonia Equalizer DSP Engine";
        [JsonPropertyName("version")] public string Version { get; set; } = "1.0.0";
    }

    public sealed class CurveResponse
    {
        [JsonPropertyName("event")] public string Event { get; set; } = "curve_result";
        [JsonPropertyName("bandMode")] public int BandMode { get; set; }
        [JsonPropertyName("curve")] public double[] Curve { get; set; } = [];
        [JsonPropertyName("suggestedAutoPreamp")] public double SuggestedAutoPreamp { get; set; }
    }

    public sealed class FilterCoeffDto
    {
        [JsonPropertyName("freq")] public double Freq { get; set; }
        [JsonPropertyName("gain")] public double Gain { get; set; }
        [JsonPropertyName("b0")] public double B0 { get; set; }
        [JsonPropertyName("b1")] public double B1 { get; set; }
        [JsonPropertyName("b2")] public double B2 { get; set; }
        [JsonPropertyName("a1")] public double A1 { get; set; }
        [JsonPropertyName("a2")] public double A2 { get; set; }
    }

    public sealed class CoefficientsResponse
    {
        [JsonPropertyName("event")] public string Event { get; set; } = "coefficients_result";
        [JsonPropertyName("bandMode")] public int BandMode { get; set; }
        [JsonPropertyName("sampleRate")] public int SampleRate { get; set; }
        [JsonPropertyName("filters")] public List<FilterCoeffDto> Filters { get; set; } = [];
    }

    public sealed class SimpleEvent
    {
        [JsonPropertyName("event")] public string Event { get; set; } = "";
    }

    public static Command? ParseCommand(string line)
    {
        try
        {
            return JsonSerializer.Deserialize(line, DspJsonContext.Default.Command);
        }
        catch
        {
            return null;
        }
    }

    private static readonly object LogLock = new();

    public static void EmitVerify(string token)
    {
        var res = new VerifyResponse { Token = token };
        string line = JsonSerializer.Serialize(res, DspJsonContext.Default.VerifyResponse);
        EmitRaw(line);
    }

    public static void EmitReady()
    {
        var res = new ReadyEvent();
        string line = JsonSerializer.Serialize(res, DspJsonContext.Default.ReadyEvent);
        EmitRaw(line);
    }

    public static void EmitCurve(int bandMode, double[] curve, double autoPreamp)
    {
        var res = new CurveResponse
        {
            BandMode = bandMode,
            Curve = curve,
            SuggestedAutoPreamp = autoPreamp,
        };
        string line = JsonSerializer.Serialize(res, DspJsonContext.Default.CurveResponse);
        EmitRaw(line);
    }

    public static void EmitCoefficients(int bandMode, int sampleRate, List<FilterCoeffDto> filters)
    {
        var res = new CoefficientsResponse
        {
            BandMode = bandMode,
            SampleRate = sampleRate,
            Filters = filters,
        };
        string line = JsonSerializer.Serialize(res, DspJsonContext.Default.CoefficientsResponse);
        EmitRaw(line);
    }

    public static void EmitSimple(string eventName)
    {
        var res = new SimpleEvent { Event = eventName };
        string line = JsonSerializer.Serialize(res, DspJsonContext.Default.SimpleEvent);
        EmitRaw(line);
    }

    private static void EmitRaw(string line)
    {
        lock (LogLock)
        {
            Console.Out.WriteLine(line);
            Console.Out.Flush();
        }
    }
}

[JsonSourceGenerationOptions(PropertyNamingPolicy = JsonKnownNamingPolicy.CamelCase, WriteIndented = false)]
[JsonSerializable(typeof(Protocol.Command))]
[JsonSerializable(typeof(Protocol.VerifyResponse))]
[JsonSerializable(typeof(Protocol.ReadyEvent))]
[JsonSerializable(typeof(Protocol.CurveResponse))]
[JsonSerializable(typeof(Protocol.FilterCoeffDto))]
[JsonSerializable(typeof(Protocol.CoefficientsResponse))]
[JsonSerializable(typeof(Protocol.SimpleEvent))]
internal partial class DspJsonContext : JsonSerializerContext
{
}
