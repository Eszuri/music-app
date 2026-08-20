cbuffer FrameConstants : register(b0)
{
    float time;
    float intensity;
    float screenWidth;
    float screenHeight;
    float textureWidth;
    float textureHeight;
    uint fitMode; // 0 = fill, 1 = fit, 2 = stretch, 3 = center, 4 = tile
    uint effect;  // 0 = none/clean (default), 1 = reactive_glow, 2 = subtle_pulse, 3 = cinematic_vignette, 4 = grayscale, 5 = dimmed
};

Texture2D coverTexture : register(t0);
SamplerState linearSampler : register(s0);

float4 main(float4 position : SV_POSITION, float2 uv : TEXCOORD0) : SV_TARGET
{
    float2 centered = uv - 0.5;
    float screenAspect = max(screenWidth / max(screenHeight, 1.0), 0.01);
    float texAspect = max(textureWidth / max(textureHeight, 1.0), 0.01);
    centered.x *= screenAspect;

    float4 cover = float4(0.0, 0.0, 0.0, 1.0);

    if (fitMode == 0) // Fill: crop to fill screen preserving aspect ratio
    {
        float2 scale = 1.0;
        if (screenAspect > texAspect)
        {
            scale = float2(1.0, texAspect / screenAspect);
        }
        else
        {
            scale = float2(screenAspect / texAspect, 1.0);
        }
        float2 texUv = (uv - 0.5) * scale + 0.5;
        cover = coverTexture.Sample(linearSampler, texUv);
    }
    else if (fitMode == 1) // Fit: letterbox / pillarbox preserving aspect ratio
    {
        float2 scale = 1.0;
        if (screenAspect > texAspect)
        {
            scale = float2(screenAspect / texAspect, 1.0);
        }
        else
        {
            scale = float2(1.0, texAspect / screenAspect);
        }
        float2 texUv = (uv - 0.5) * scale + 0.5;
        if (texUv.x >= 0.0 && texUv.x <= 1.0 && texUv.y >= 0.0 && texUv.y <= 1.0)
        {
            cover = coverTexture.Sample(linearSampler, texUv);
        }
        else
        {
            // Clean dark neutral background outside letterbox (or soft dim ambient)
            cover = coverTexture.Sample(linearSampler, uv) * 0.20;
        }
    }
    else if (fitMode == 2) // Stretch: fill entire screen without preserving aspect ratio
    {
        cover = coverTexture.Sample(linearSampler, uv);
    }
    else if (fitMode == 3) // Center: 1:1 original pixel scale centered
    {
        float2 pixelOffset = (uv - 0.5) * float2(screenWidth, screenHeight);
        float2 texCoord = pixelOffset / float2(max(textureWidth, 1.0), max(textureHeight, 1.0)) + 0.5;
        if (texCoord.x >= 0.0 && texCoord.x <= 1.0 && texCoord.y >= 0.0 && texCoord.y <= 1.0)
        {
            cover = coverTexture.Sample(linearSampler, texCoord);
        }
        else
        {
            cover = coverTexture.Sample(linearSampler, uv) * 0.15;
        }
    }
    else if (fitMode == 4) // Tile: tile texture across screen
    {
        float2 tileUv = frac(uv * float2(screenWidth, screenHeight) / float2(max(textureWidth, 1.0), max(textureHeight, 1.0)));
        cover = coverTexture.Sample(linearSampler, tileUv);
    }
    else // Default fallback
    {
        cover = coverTexture.Sample(linearSampler, uv);
    }

    // ─── Visual Effects ────────────────────────────────────────────────────────

    if (effect == 0) // None / Clean (Default: Pure original image, zero distortion/tint)
    {
        return float4(cover.rgb, 1.0);
    }
    else if (effect == 1) // Reactive Glow: subtle music pulse and ambient glow
    {
        float pulse = 0.5 + 0.5 * sin(time * 0.8);
        float wave = 0.5 + 0.5 * sin(time * 0.35 + length(centered) * 8.0);
        float3 glow = float3(0.02, 0.25, 0.65) * (0.08 + pulse * 0.12) * intensity;
        float3 vignette = smoothstep(0.95, 0.15, length(centered));
        float3 color = cover.rgb + glow * vignette + cover.rgb * (wave * 0.12) * intensity;
        return float4(saturate(color), 1.0);
    }
    else if (effect == 2) // Subtle Pulse / Breathing: gentle breathing brightness wave
    {
        float breathing = 1.0 + 0.06 * sin(time * 0.6) * intensity;
        return float4(saturate(cover.rgb * breathing), 1.0);
    }
    else if (effect == 3) // Cinematic Vignette: soft darkened edge borders
    {
        float vignette = smoothstep(0.95, 0.20, length(centered));
        float3 color = lerp(cover.rgb * (1.0 - 0.4 * intensity), cover.rgb, vignette);
        return float4(saturate(color), 1.0);
    }
    else if (effect == 4) // Grayscale / Monochrome Noir
    {
        float gray = dot(cover.rgb, float3(0.299, 0.587, 0.114));
        float3 color = lerp(cover.rgb, float3(gray, gray, gray), clamp(intensity, 0.0, 1.0));
        return float4(color, 1.0);
    }
    else if (effect == 5) // Dimmed Desktop: darkened for readable desktop icons
    {
        float dimFactor = clamp(1.0 - 0.45 * intensity, 0.2, 1.0);
        return float4(cover.rgb * dimFactor, 1.0);
    }

    return float4(cover.rgb, 1.0);
}
