#pragma once

#include <d3d11.h>
#include <dxgi1_2.h>
#include <wrl/client.h>
#include <windows.h>

#include <filesystem>
#include <string>
#include <vector>

namespace symvonia::wallpaper {

class Renderer {
public:
    Renderer() = default;
    ~Renderer() = default;

    Renderer(const Renderer&) = delete;
    Renderer& operator=(const Renderer&) = delete;

    bool initialize(const std::filesystem::path& shaderDirectory, std::string& error);
    bool attach(HWND window, std::string& error);
    bool detach(HWND window);
    bool resize(HWND window, std::string& error);
    bool render(HWND window, float elapsedSeconds, float intensity, std::string& error);
    bool setTexture(const std::filesystem::path& path, std::string& error);
    bool setFitMode(const std::string& mode);
    std::string fitMode() const;
    bool setEffect(const std::string& effect);
    std::string effect() const;
    bool setTransition(const std::string& transition);
    std::string transition() const;

private:
    using Device = Microsoft::WRL::ComPtr<ID3D11Device>;
    using Context = Microsoft::WRL::ComPtr<ID3D11DeviceContext>;

    struct Surface {
        HWND window = nullptr;
        Microsoft::WRL::ComPtr<IDXGISwapChain1> swapChain;
        Microsoft::WRL::ComPtr<ID3D11RenderTargetView> renderTarget;
        UINT width = 0;
        UINT height = 0;
    };

    Surface* findSurface(HWND window);
    bool createRenderTarget(Surface& surface, std::string& error);
    bool loadTextureWic(
        const std::filesystem::path& path,
        Microsoft::WRL::ComPtr<ID3D11ShaderResourceView>& outView,
        float& outWidth,
        float& outHeight,
        std::string& error
    );
    static std::string hresultMessage(const char* operation, HRESULT result);

    Device device_;
    Context context_;
    Microsoft::WRL::ComPtr<IDXGIFactory2> factory_;
    Microsoft::WRL::ComPtr<ID3D11VertexShader> vertexShader_;
    Microsoft::WRL::ComPtr<ID3D11PixelShader> pixelShader_;
    Microsoft::WRL::ComPtr<ID3D11Buffer> frameConstants_;
    Microsoft::WRL::ComPtr<ID3D11ShaderResourceView> currentTextureView_;
    Microsoft::WRL::ComPtr<ID3D11ShaderResourceView> nextTextureView_;
    Microsoft::WRL::ComPtr<ID3D11SamplerState> sampler_;
    std::vector<Surface> surfaces_;

    float textureWidth_ = 0.0f;
    float textureHeight_ = 0.0f;
    float prevTextureWidth_ = 0.0f;
    float prevTextureHeight_ = 0.0f;
    float nextTextureWidth_ = 0.0f;
    float nextTextureHeight_ = 0.0f;

    uint32_t fitMode_ = 0;        // 0 = fill, 1 = fit, 2 = stretch, 3 = center, 4 = tile
    uint32_t effect_ = 0;         // 0 = none, 1 = reactive_glow, 2 = subtle_pulse, 3 = cinematic_vignette, 4 = grayscale, 5 = dimmed
    uint32_t transitionType_ = 1; // 0 = none, 1 = fade, 2 = zoom_in, 3 = zoom_out, 4 = slide
    float transitionProgress_ = 1.0f;
    float transitionDuration_ = 0.8f;
    float lastFrameTime_ = 0.0f;
    bool hasValidTexture_ = false;
};

} // namespace symvonia::wallpaper
