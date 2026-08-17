using System.Runtime.InteropServices;
using Symvonia.Equalizer;

[DllImport("kernel32.dll", SetLastError = true)]
static extern IntPtr GetStdHandle(int nStdHandle);

try
{
    IntPtr hOut = GetStdHandle(-11);
    if (hOut != IntPtr.Zero && hOut != new IntPtr(-1))
    {
        var outStream = new FileStream(new Microsoft.Win32.SafeHandles.SafeFileHandle(hOut, false), FileAccess.Write, 4096);
        Console.SetOut(new StreamWriter(outStream, new System.Text.UTF8Encoding(false)) { AutoFlush = true });
    }
}
catch { }

try
{
    IntPtr hIn = GetStdHandle(-10);
    if (hIn != IntPtr.Zero && hIn != new IntPtr(-1))
    {
        var inStream = new FileStream(new Microsoft.Win32.SafeHandles.SafeFileHandle(hIn, false), FileAccess.Read, 4096);
        Console.SetIn(new StreamReader(inStream, System.Text.Encoding.UTF8));
    }
}
catch { }

if (args.Length >= 2 && args[0] == "--verify")
{
    Protocol.EmitVerify(args[1]);
    return;
}

Protocol.EmitReady();

string? line;
while ((line = Console.ReadLine()) != null)
{
    if (string.IsNullOrWhiteSpace(line)) continue;
    var cmd = Protocol.ParseCommand(line);
    if (cmd == null || string.IsNullOrEmpty(cmd.Name)) continue;

    switch (cmd.Name)
    {
        case "ping":
            Protocol.EmitSimple("pong");
            break;

        case "get_curve":
            {
                int bandMode = cmd.BandMode ?? 10;
                double[] bands = cmd.Bands ?? [];
                double preamp = cmd.Preamp ?? 0.0;
                double[] curve = DspEngine.CalculateResponseCurve(bandMode, bands, preamp);
                double autoPreamp = DspEngine.CalculateAutoPreamp(bands);
                Protocol.EmitCurve(bandMode, curve, autoPreamp);
                break;
            }

        case "calculate_coefficients":
            {
                int bandMode = cmd.BandMode ?? 10;
                double[] bands = cmd.Bands ?? [];
                int sampleRate = cmd.SampleRate ?? 44100;
                var freqs = DspEngine.GetFrequenciesForBandMode(bandMode);
                var coeffs = new List<Protocol.FilterCoeffDto>();

                for (int i = 0; i < freqs.Length && i < bands.Length; i++)
                {
                    double q = (bandMode == 31) ? 4.3 : (bandMode == 15 ? 2.0 : 1.4);
                    var bq = DspEngine.ComputePeakingEq(freqs[i], bands[i], q, sampleRate);
                    coeffs.Add(new Protocol.FilterCoeffDto
                    {
                        Freq = freqs[i],
                        Gain = bands[i],
                        B0 = bq.B0,
                        B1 = bq.B1,
                        B2 = bq.B2,
                        A1 = bq.A1,
                        A2 = bq.A2
                    });
                }

                Protocol.EmitCoefficients(bandMode, sampleRate, coeffs);
                break;
            }

        case "shutdown":
            Protocol.EmitSimple("bye");
            return;
    }
}
