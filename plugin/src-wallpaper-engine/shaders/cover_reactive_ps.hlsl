cbuffer FrameConstants : register(b0)
{
    float time;
    float intensity;
    float width;
    float height;
};

Texture2D coverTexture : register(t0);
SamplerState linearSampler : register(s0);

float4 main(float4 position : SV_POSITION, float2 uv : TEXCOORD0) : SV_TARGET
{
    float2 centered = uv - 0.5;
    float aspect = max(width / max(height, 1.0), 0.01);
    centered.x *= aspect;

    float pulse = 0.5 + 0.5 * sin(time * 0.8);
    float wave = 0.5 + 0.5 * sin(time * 0.35 + length(centered) * 8.0);
    float2 textureUv = float2(uv.x, uv.y);
    float4 cover = coverTexture.Sample(linearSampler, textureUv);

    float3 ambient = float3(0.005, 0.008, 0.018);
    float3 glow = float3(0.02, 0.25, 0.65) * (0.12 + pulse * 0.18) * intensity;
    float3 vignette = smoothstep(0.95, 0.15, length(centered));
    float3 color = ambient + glow * vignette + cover.rgb * (0.15 + wave * 0.12) * intensity;
    return float4(saturate(color), 1.0);
}

