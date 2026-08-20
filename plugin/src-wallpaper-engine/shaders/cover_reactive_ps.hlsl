cbuffer FrameConstants : register(b0)
{
    float time;
    float intensity;
    float screenWidth;
    float screenHeight;
    float textureWidth;
    float textureHeight;
    uint fitMode;             // 0 = fill, 1 = fit, 2 = stretch, 3 = center, 4 = tile
    uint effect;              // 0 = none/clean (default), 1 = reactive_glow, 2 = subtle_pulse, 3 = cinematic_vignette, 4 = grayscale, 5 = dimmed
    uint transitionType;      // 0 = none, 1 = fade, 2 = zoom_in, 3 = zoom_out, 4 = slide
    float transitionProgress; // 0.0 to 1.0 (1.0 = transition complete)
    float prevTextureWidth;
    float prevTextureHeight;
};

Texture2D currentTexture : register(t0);
Texture2D nextTexture    : register(t1);
SamplerState linearSampler : register(s0);

float4 sampleFitted(Texture2D tex, float texW, float texH, float2 uv, float screenW, float screenH, uint mode, float2 offset, float zoomScale)
{
    float screenAspect = max(screenW / max(screenH, 1.0), 0.01);
    float texAspect = max(texW / max(texH, 1.0), 0.01);

    // Apply zoom scale around center (0.5, 0.5) and translation offset
    float2 transformedUv = (uv - 0.5) / max(zoomScale, 0.001) + 0.5 - offset;

    if (mode == 0) // Fill: crop to fill screen preserving aspect ratio
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
        float2 texUv = (transformedUv - 0.5) * scale + 0.5;
        return tex.Sample(linearSampler, texUv);
    }
    else if (mode == 1) // Fit: letterbox / pillarbox preserving aspect ratio
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
        float2 texUv = (transformedUv - 0.5) * scale + 0.5;
        if (texUv.x >= 0.0 && texUv.x <= 1.0 && texUv.y >= 0.0 && texUv.y <= 1.0)
        {
            return tex.Sample(linearSampler, texUv);
        }
        else
        {
            // Dimmed ambient background outside letterbox boundary
            return tex.Sample(linearSampler, transformedUv) * 0.20;
        }
    }
    else if (mode == 2) // Stretch: fill entire screen without preserving aspect ratio
    {
        return tex.Sample(linearSampler, transformedUv);
    }
    else if (mode == 3) // Center: 1:1 original pixel scale centered
    {
        float2 pixelOffset = (transformedUv - 0.5) * float2(screenW, screenH);
        float2 texCoord = pixelOffset / float2(max(texW, 1.0), max(texH, 1.0)) + 0.5;
        if (texCoord.x >= 0.0 && texCoord.x <= 1.0 && texCoord.y >= 0.0 && texCoord.y <= 1.0)
        {
            return tex.Sample(linearSampler, texCoord);
        }
        else
        {
            return tex.Sample(linearSampler, transformedUv) * 0.15;
        }
    }
    else if (mode == 4) // Tile: tile texture across screen
    {
        float2 tileUv = frac(transformedUv * float2(screenW, screenH) / float2(max(texW, 1.0), max(texH, 1.0)));
        return tex.Sample(linearSampler, tileUv);
    }

    return tex.Sample(linearSampler, transformedUv);
}

float4 main(float4 position : SV_POSITION, float2 uv : TEXCOORD0) : SV_TARGET
{
    float2 centered = uv - 0.5;
    float screenAspect = max(screenWidth / max(screenHeight, 1.0), 0.01);
    centered.x *= screenAspect;

    float4 cover = float4(0.0, 0.0, 0.0, 1.0);

    if (transitionProgress >= 1.0 || transitionType == 0)
    {
        // No active transition: sample current texture directly
        cover = sampleFitted(currentTexture, textureWidth, textureHeight, uv, screenWidth, screenHeight, fitMode, float2(0.0, 0.0), 1.0);
    }
    else
    {
        float t = smoothstep(0.0, 1.0, clamp(transitionProgress, 0.0, 1.0));

        if (transitionType == 1) // Crossfade / Fade
        {
            float4 colorCurrent = sampleFitted(currentTexture, prevTextureWidth > 0.0 ? prevTextureWidth : textureWidth, prevTextureHeight > 0.0 ? prevTextureHeight : textureHeight, uv, screenWidth, screenHeight, fitMode, float2(0.0, 0.0), 1.0);
            float4 colorNext = sampleFitted(nextTexture, textureWidth, textureHeight, uv, screenWidth, screenHeight, fitMode, float2(0.0, 0.0), 1.0);
            cover = lerp(colorCurrent, colorNext, t);
        }
        else if (transitionType == 2) // Zoom In: old texture zooms slightly in while fading, new texture enters zooming in
        {
            float scaleOld = 1.0 + 0.12 * t;
            float scaleNew = 0.90 + 0.10 * t;
            float4 colorCurrent = sampleFitted(currentTexture, prevTextureWidth > 0.0 ? prevTextureWidth : textureWidth, prevTextureHeight > 0.0 ? prevTextureHeight : textureHeight, uv, screenWidth, screenHeight, fitMode, float2(0.0, 0.0), scaleOld);
            float4 colorNext = sampleFitted(nextTexture, textureWidth, textureHeight, uv, screenWidth, screenHeight, fitMode, float2(0.0, 0.0), scaleNew);
            cover = lerp(colorCurrent, colorNext, t);
        }
        else if (transitionType == 3) // Zoom Out: old texture zooms out, new texture enters zooming out from larger
        {
            float scaleOld = 1.0 - 0.10 * t;
            float scaleNew = 1.12 - 0.12 * t;
            float4 colorCurrent = sampleFitted(currentTexture, prevTextureWidth > 0.0 ? prevTextureWidth : textureWidth, prevTextureHeight > 0.0 ? prevTextureHeight : textureHeight, uv, screenWidth, screenHeight, fitMode, float2(0.0, 0.0), scaleOld);
            float4 colorNext = sampleFitted(nextTexture, textureWidth, textureHeight, uv, screenWidth, screenHeight, fitMode, float2(0.0, 0.0), scaleNew);
            cover = lerp(colorCurrent, colorNext, t);
        }
        else if (transitionType == 4) // Slide: smooth horizontal push slide
        {
            float2 offsetOld = float2(-0.25 * t, 0.0);
            float2 offsetNew = float2(0.25 * (1.0 - t), 0.0);
            float4 colorCurrent = sampleFitted(currentTexture, prevTextureWidth > 0.0 ? prevTextureWidth : textureWidth, prevTextureHeight > 0.0 ? prevTextureHeight : textureHeight, uv, screenWidth, screenHeight, fitMode, offsetOld, 1.0);
            float4 colorNext = sampleFitted(nextTexture, textureWidth, textureHeight, uv, screenWidth, screenHeight, fitMode, offsetNew, 1.0);
            cover = lerp(colorCurrent, colorNext, t);
        }
        else
        {
            cover = sampleFitted(currentTexture, textureWidth, textureHeight, uv, screenWidth, screenHeight, fitMode, float2(0.0, 0.0), 1.0);
        }
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
