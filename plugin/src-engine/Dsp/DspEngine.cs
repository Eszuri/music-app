namespace Symvonia.Engine;

/// <summary>
/// High-precision 64-bit floating-point audio DSP and Filter Coefficient Engine.
/// Pure standard library math, zero external dependencies.
/// </summary>
public static class DspEngine
{
    public static readonly double[] Frequencies5 = [60, 230, 910, 3600, 14000];
    public static readonly double[] Frequencies10 = [31, 62, 125, 250, 500, 1000, 2000, 4000, 8000, 16000];
    public static readonly double[] Frequencies15 = [25, 40, 63, 100, 160, 250, 400, 630, 1000, 1600, 2500, 4000, 6300, 10000, 16000];
    public static readonly double[] Frequencies31 = [
        20, 25, 31.5, 40, 50, 63, 80, 100, 125, 160,
        200, 250, 315, 400, 500, 630, 800, 1000, 1250, 1600,
        2000, 2500, 3150, 4000, 5000, 6300, 8000, 10000, 12500, 16000, 20000
    ];

    public static double[] GetFrequenciesForBandMode(int bandMode) => bandMode switch
    {
        5 => Frequencies5,
        15 => Frequencies15,
        31 => Frequencies31,
        _ => Frequencies10,
    };

    public struct BiquadCoefficients
    {
        public double B0, B1, B2, A1, A2;
    }

    /// <summary>
    /// Computes peaking EQ biquad filter coefficients (Robert Bristow-Johnson Audio EQ Cookbook formula).
    /// </summary>
    public static BiquadCoefficients ComputePeakingEq(double frequency, double gainDb, double q, double sampleRate = 44100.0)
    {
        double w0 = 2.0 * Math.PI * frequency / sampleRate;
        double cosW0 = Math.Cos(w0);
        double sinW0 = Math.Sin(w0);
        double alpha = sinW0 / (2.0 * Math.Max(q, 0.01));
        double a = Math.Pow(10.0, gainDb / 40.0);

        double b0 = 1.0 + alpha * a;
        double b1 = -2.0 * cosW0;
        double b2 = 1.0 - alpha * a;
        double a0 = 1.0 + alpha / a;
        double a1 = -2.0 * cosW0;
        double a2 = 1.0 - alpha / a;

        return new BiquadCoefficients
        {
            B0 = b0 / a0,
            B1 = b1 / a0,
            B2 = b2 / a0,
            A1 = a1 / a0,
            A2 = a2 / a0,
        };
    }

    /// <summary>
    /// Computes the recommended auto-preamp attenuation (dB) to prevent digital clipping when EQ bands are boosted.
    /// </summary>
    public static double CalculateAutoPreamp(double[] gainsDb)
    {
        double maxGain = 0.0;
        foreach (var g in gainsDb)
        {
            if (g > maxGain) maxGain = g;
        }

        // Apply headroom margin if any band is boosted
        return maxGain > 0.0 ? -maxGain : 0.0;
    }

    /// <summary>
    /// Calculates the interpolated frequency response curve (128 sample points from 20Hz to 20kHz).
    /// </summary>
    public static double[] CalculateResponseCurve(int bandMode, double[] gainsDb, double preampDb = 0.0)
    {
        var freqs = GetFrequenciesForBandMode(bandMode);
        int numPoints = 128;
        double[] curve = new double[numPoints];
        double minLog = Math.Log10(20.0);
        double maxLog = Math.Log10(20000.0);

        for (int i = 0; i < numPoints; i++)
        {
            double logF = minLog + (maxLog - minLog) * (i / (double)(numPoints - 1));
            double f = Math.Pow(10.0, logF);

            double totalGain = preampDb;
            for (int b = 0; b < freqs.Length && b < gainsDb.Length; b++)
            {
                double centerF = freqs[b];
                double gain = gainsDb[b];
                if (Math.Abs(gain) < 0.01) continue;

                // Octave bandwidth distance
                double octDist = Math.Abs(Math.Log2(f / centerF));
                double q = (bandMode == 31) ? 4.3 : (bandMode == 15 ? 2.0 : 1.4);
                double weight = 1.0 / (1.0 + Math.Pow(octDist * q, 2.0));
                totalGain += gain * weight;
            }

            curve[i] = Math.Round(totalGain, 2);
        }

        return curve;
    }
}
