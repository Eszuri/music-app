#include "renderer.h"

#include <d3dcompiler.h>
#include <wincodec.h>

#include <algorithm>
#include <array>
#include <cstring>
#include <sstream>

namespace symvonia::wallpaper {
namespace {

using Microsoft::WRL::ComPtr;

struct FrameConstants {
    float time = 0.0f;
    float intensity = 1.0f;
    float screenWidth = 1.0f;
    float screenHeight = 1.0f;
    float textureWidth = 1.0f;
    float textureHeight = 1.0f;
    uint32_t fitMode = 0;
    uint32_t effect = 0;
};

static_assert(sizeof(FrameConstants) % 16 == 0);

std::wstring pathToWide(const std::filesystem::path& path) {
    return path.wstring();
}

} // namespace

std::string Renderer::hresultMessage(const char* operation, HRESULT result) {
    std::ostringstream out;
    out << operation << " failed (HRESULT 0x" << std::hex << static_cast<unsigned long>(result) << ")";
    return out.str();
}

bool Renderer::initialize(const std::filesystem::path& shaderDirectory, std::string& error) {
    UINT flags = D3D11_CREATE_DEVICE_BGRA_SUPPORT;
    const D3D_FEATURE_LEVEL levels[] = {
        D3D_FEATURE_LEVEL_11_1,
        D3D_FEATURE_LEVEL_11_0,
    };
    D3D_FEATURE_LEVEL selected{};
    HRESULT result = D3D11CreateDevice(
        nullptr,
        D3D_DRIVER_TYPE_HARDWARE,
        nullptr,
        flags,
        levels,
        static_cast<UINT>(std::size(levels)),
        D3D11_SDK_VERSION,
        &device_,
        &selected,
        &context_);
    if (FAILED(result)) {
        error = hresultMessage("D3D11CreateDevice", result);
        return false;
    }

    ComPtr<IDXGIDevice> dxgiDevice;
    result = device_.As(&dxgiDevice);
    if (FAILED(result)) {
        error = hresultMessage("ID3D11Device::As(IDXGIDevice)", result);
        return false;
    }
    ComPtr<IDXGIAdapter> adapter;
    result = dxgiDevice->GetAdapter(&adapter);
    if (FAILED(result)) {
        error = hresultMessage("IDXGIDevice::GetAdapter", result);
        return false;
    }
    result = adapter->GetParent(IID_PPV_ARGS(&factory_));
    if (FAILED(result)) {
        error = hresultMessage("IDXGIAdapter::GetParent", result);
        return false;
    }

    const auto vsPath = shaderDirectory / "fullscreen_vs.hlsl";
    const auto psPath = shaderDirectory / "cover_reactive_ps.hlsl";
    if (!std::filesystem::exists(vsPath) || !std::filesystem::exists(psPath)) {
        error = "Shader files were not found in: " + shaderDirectory.string();
        return false;
    }

    ComPtr<ID3DBlob> vsBlob;
    ComPtr<ID3DBlob> vsErrors;
    result = D3DCompileFromFile(
        pathToWide(vsPath).c_str(),
        nullptr,
        D3D_COMPILE_STANDARD_FILE_INCLUDE,
        "main",
        "vs_5_0",
        0,
        0,
        &vsBlob,
        &vsErrors);
    if (FAILED(result)) {
        error = vsErrors ? static_cast<const char*>(vsErrors->GetBufferPointer()) : hresultMessage("Compile VS", result);
        return false;
    }

    ComPtr<ID3DBlob> psBlob;
    ComPtr<ID3DBlob> psErrors;
    result = D3DCompileFromFile(
        pathToWide(psPath).c_str(),
        nullptr,
        D3D_COMPILE_STANDARD_FILE_INCLUDE,
        "main",
        "ps_5_0",
        0,
        0,
        &psBlob,
        &psErrors);
    if (FAILED(result)) {
        error = psErrors ? static_cast<const char*>(psErrors->GetBufferPointer()) : hresultMessage("Compile PS", result);
        return false;
    }

    result = device_->CreateVertexShader(vsBlob->GetBufferPointer(), vsBlob->GetBufferSize(), nullptr, &vertexShader_);
    if (FAILED(result)) {
        error = hresultMessage("CreateVertexShader", result);
        return false;
    }
    result = device_->CreatePixelShader(psBlob->GetBufferPointer(), psBlob->GetBufferSize(), nullptr, &pixelShader_);
    if (FAILED(result)) {
        error = hresultMessage("CreatePixelShader", result);
        return false;
    }

    D3D11_BUFFER_DESC bufferDesc{};
    bufferDesc.ByteWidth = sizeof(FrameConstants);
    bufferDesc.Usage = D3D11_USAGE_DEFAULT;
    bufferDesc.BindFlags = D3D11_BIND_CONSTANT_BUFFER;
    result = device_->CreateBuffer(&bufferDesc, nullptr, &frameConstants_);
    if (FAILED(result)) {
        error = hresultMessage("CreateBuffer(constants)", result);
        return false;
    }

    D3D11_SAMPLER_DESC samplerDesc{};
    samplerDesc.Filter = D3D11_FILTER_MIN_MAG_MIP_LINEAR;
    samplerDesc.AddressU = D3D11_TEXTURE_ADDRESS_WRAP;
    samplerDesc.AddressV = D3D11_TEXTURE_ADDRESS_WRAP;
    samplerDesc.AddressW = D3D11_TEXTURE_ADDRESS_WRAP;
    samplerDesc.ComparisonFunc = D3D11_COMPARISON_NEVER;
    samplerDesc.MinLOD = 0.0f;
    samplerDesc.MaxLOD = D3D11_FLOAT32_MAX;
    result = device_->CreateSamplerState(&samplerDesc, &sampler_);
    if (FAILED(result)) {
        error = hresultMessage("CreateSamplerState", result);
        return false;
    }

    D3D11_TEXTURE2D_DESC defaultTexDesc{};
    defaultTexDesc.Width = 1;
    defaultTexDesc.Height = 1;
    defaultTexDesc.MipLevels = 1;
    defaultTexDesc.ArraySize = 1;
    defaultTexDesc.Format = DXGI_FORMAT_B8G8R8A8_UNORM;
    defaultTexDesc.SampleDesc.Count = 1;
    defaultTexDesc.Usage = D3D11_USAGE_DEFAULT;
    defaultTexDesc.BindFlags = D3D11_BIND_SHADER_RESOURCE;
    const uint32_t fallbackPixel = 0xFF0B0F19;
    D3D11_SUBRESOURCE_DATA defaultData{};
    defaultData.pSysMem = &fallbackPixel;
    defaultData.SysMemPitch = sizeof(fallbackPixel);
    ComPtr<ID3D11Texture2D> defaultTex;
    result = device_->CreateTexture2D(&defaultTexDesc, &defaultData, &defaultTex);
    if (FAILED(result)) {
        error = hresultMessage("CreateTexture2D(default)", result);
        return false;
    }
    result = device_->CreateShaderResourceView(defaultTex.Get(), nullptr, &textureView_);
    if (FAILED(result)) {
        error = hresultMessage("CreateShaderResourceView(default)", result);
        return false;
    }

    textureWidth_ = 1.0f;
    textureHeight_ = 1.0f;
    fitMode_ = 0; // Fill by default
    effect_ = 0;  // Clean/None by default

    return true;
}

Renderer::Surface* Renderer::findSurface(HWND window) {
    const auto it = std::find_if(surfaces_.begin(), surfaces_.end(), [window](const auto& surface) {
        return surface.window == window;
    });
    return it == surfaces_.end() ? nullptr : &(*it);
}

bool Renderer::createRenderTarget(Surface& surface, std::string& error) {
    ComPtr<ID3D11Texture2D> backBuffer;
    const HRESULT result = surface.swapChain->GetBuffer(0, IID_PPV_ARGS(&backBuffer));
    if (FAILED(result)) {
        error = hresultMessage("IDXGISwapChain::GetBuffer", result);
        return false;
    }
    const HRESULT viewResult = device_->CreateRenderTargetView(backBuffer.Get(), nullptr, &surface.renderTarget);
    if (FAILED(viewResult)) {
        error = hresultMessage("CreateRenderTargetView", viewResult);
        return false;
    }
    return true;
}

bool Renderer::attach(HWND window, std::string& error) {
    if (!window || !device_ || !factory_) {
        error = "Renderer is not initialized or window is invalid.";
        return false;
    }
    if (findSurface(window)) return true;

    DXGI_SWAP_CHAIN_DESC1 desc{};
    desc.Format = DXGI_FORMAT_B8G8R8A8_UNORM;
    desc.SampleDesc.Count = 1;
    desc.BufferUsage = DXGI_USAGE_RENDER_TARGET_OUTPUT;
    desc.BufferCount = 2;
    desc.SwapEffect = DXGI_SWAP_EFFECT_DISCARD;
    desc.Scaling = DXGI_SCALING_STRETCH;

    Surface surface;
    surface.window = window;
    const HRESULT result = factory_->CreateSwapChainForHwnd(device_.Get(), window, &desc, nullptr, nullptr, &surface.swapChain);
    if (FAILED(result)) {
        error = hresultMessage("CreateSwapChainForHwnd", result);
        return false;
    }
    factory_->MakeWindowAssociation(window, DXGI_MWA_NO_ALT_ENTER);
    surfaces_.push_back(std::move(surface));
    if (!resize(window, error)) {
        detach(window);
        return false;
    }
    return true;
}

bool Renderer::detach(HWND window) {
    const auto found = std::find_if(surfaces_.begin(), surfaces_.end(), [window](const auto& surface) {
        return surface.window == window;
    });
    if (found == surfaces_.end()) return true;
    context_->OMSetRenderTargets(0, nullptr, nullptr);
    surfaces_.erase(found);
    return true;
}

bool Renderer::resize(HWND window, std::string& error) {
    auto* surface = findSurface(window);
    if (!surface) {
        error = "Swap chain surface not found.";
        return false;
    }
    context_->OMSetRenderTargets(0, nullptr, nullptr);
    surface->renderTarget.Reset();
    const HRESULT result = surface->swapChain->ResizeBuffers(0, 0, 0, DXGI_FORMAT_UNKNOWN, 0);
    if (FAILED(result)) {
        error = hresultMessage("ResizeBuffers", result);
        return false;
    }
    RECT rect{};
    GetClientRect(window, &rect);
    surface->width = std::max<LONG>(1, rect.right - rect.left);
    surface->height = std::max<LONG>(1, rect.bottom - rect.top);
    return createRenderTarget(*surface, error);
}

bool Renderer::setFitMode(const std::string& mode) {
    if (mode == "fill") fitMode_ = 0;
    else if (mode == "fit") fitMode_ = 1;
    else if (mode == "stretch") fitMode_ = 2;
    else if (mode == "center") fitMode_ = 3;
    else if (mode == "tile") fitMode_ = 4;
    else fitMode_ = 0;
    return true;
}

std::string Renderer::fitMode() const {
    switch (fitMode_) {
    case 0: return "fill";
    case 1: return "fit";
    case 2: return "stretch";
    case 3: return "center";
    case 4: return "tile";
    default: return "fill";
    }
}

bool Renderer::setEffect(const std::string& effect) {
    if (effect == "reactive_glow" || effect == "glow" || effect == "reactive") effect_ = 1;
    else if (effect == "subtle_pulse" || effect == "pulse" || effect == "breathing") effect_ = 2;
    else if (effect == "cinematic_vignette" || effect == "vignette") effect_ = 3;
    else if (effect == "grayscale" || effect == "black_white" || effect == "monochrome") effect_ = 4;
    else if (effect == "dimmed" || effect == "dim") effect_ = 5;
    else effect_ = 0; // none / clean by default
    return true;
}

std::string Renderer::effect() const {
    switch (effect_) {
    case 1: return "reactive_glow";
    case 2: return "subtle_pulse";
    case 3: return "cinematic_vignette";
    case 4: return "grayscale";
    case 5: return "dimmed";
    case 0:
    default: return "none";
    }
}

bool Renderer::render(HWND window, float elapsedSeconds, float intensity, std::string& error) {
    auto* surface = findSurface(window);
    if (!surface || !surface->renderTarget) return false;

    FrameConstants constants;
    constants.time = elapsedSeconds;
    constants.intensity = intensity;
    constants.screenWidth = static_cast<float>(surface->width);
    constants.screenHeight = static_cast<float>(surface->height);
    constants.textureWidth = textureWidth_ > 0.0f ? textureWidth_ : static_cast<float>(surface->width);
    constants.textureHeight = textureHeight_ > 0.0f ? textureHeight_ : static_cast<float>(surface->height);
    constants.fitMode = fitMode_;
    constants.effect = effect_;
    context_->UpdateSubresource(frameConstants_.Get(), 0, nullptr, &constants, 0, 0);

    const float clear[] = {0.005f, 0.007f, 0.012f, 1.0f};
    context_->OMSetRenderTargets(1, surface->renderTarget.GetAddressOf(), nullptr);
    D3D11_VIEWPORT viewport{};
    viewport.Width = constants.screenWidth;
    viewport.Height = constants.screenHeight;
    viewport.MaxDepth = 1.0f;
    context_->RSSetViewports(1, &viewport);
    context_->ClearRenderTargetView(surface->renderTarget.Get(), clear);
    context_->IASetPrimitiveTopology(D3D11_PRIMITIVE_TOPOLOGY_TRIANGLELIST);
    context_->VSSetShader(vertexShader_.Get(), nullptr, 0);
    context_->PSSetShader(pixelShader_.Get(), nullptr, 0);
    context_->PSSetConstantBuffers(0, 1, frameConstants_.GetAddressOf());
    context_->PSSetShaderResources(0, 1, textureView_.GetAddressOf());
    context_->PSSetSamplers(0, 1, sampler_.GetAddressOf());
    context_->Draw(3, 0);

    const HRESULT result = surface->swapChain->Present(0, 0);
    if (FAILED(result)) {
        error = hresultMessage("Present", result);
        return false;
    }
    return true;
}

bool Renderer::loadTextureWic(const std::filesystem::path& path, std::string& error) {
    ComPtr<IWICImagingFactory> imagingFactory;
    HRESULT result = CoCreateInstance(
        CLSID_WICImagingFactory,
        nullptr,
        CLSCTX_INPROC_SERVER,
        IID_PPV_ARGS(&imagingFactory));
    if (FAILED(result)) {
        error = hresultMessage("CoCreateInstance(WIC)", result);
        return false;
    }

    ComPtr<IWICBitmapDecoder> decoder;
    const auto widePath = pathToWide(path);
    result = imagingFactory->CreateDecoderFromFilename(
        widePath.c_str(),
        nullptr,
        GENERIC_READ,
        WICDecodeMetadataCacheOnLoad,
        &decoder);
    if (FAILED(result)) {
        error = hresultMessage("WIC decoder", result);
        return false;
    }
    ComPtr<IWICBitmapFrameDecode> frame;
    result = decoder->GetFrame(0, &frame);
    if (FAILED(result)) {
        error = hresultMessage("WIC frame", result);
        return false;
    }
    ComPtr<IWICFormatConverter> converter;
    result = imagingFactory->CreateFormatConverter(&converter);
    if (FAILED(result)) {
        error = hresultMessage("WIC converter", result);
        return false;
    }
    result = converter->Initialize(
        frame.Get(),
        GUID_WICPixelFormat32bppPBGRA,
        WICBitmapDitherTypeNone,
        nullptr,
        0.0,
        WICBitmapPaletteTypeCustom);
    if (FAILED(result)) {
        error = hresultMessage("WIC converter initialize", result);
        return false;
    }

    UINT width = 0;
    UINT height = 0;
    converter->GetSize(&width, &height);
    if (width == 0 || height == 0) {
        error = "Texture has an invalid size.";
        return false;
    }
    std::vector<unsigned char> pixels(static_cast<size_t>(width) * height * 4);
    result = converter->CopyPixels(nullptr, width * 4, static_cast<UINT>(pixels.size()), pixels.data());
    if (FAILED(result)) {
        error = hresultMessage("WIC CopyPixels", result);
        return false;
    }

    D3D11_TEXTURE2D_DESC textureDesc{};
    textureDesc.Width = width;
    textureDesc.Height = height;
    textureDesc.MipLevels = 1;
    textureDesc.ArraySize = 1;
    textureDesc.Format = DXGI_FORMAT_B8G8R8A8_UNORM;
    textureDesc.SampleDesc.Count = 1;
    textureDesc.Usage = D3D11_USAGE_DEFAULT;
    textureDesc.BindFlags = D3D11_BIND_SHADER_RESOURCE;
    D3D11_SUBRESOURCE_DATA textureData{};
    textureData.pSysMem = pixels.data();
    textureData.SysMemPitch = width * 4;

    ComPtr<ID3D11Texture2D> texture;
    result = device_->CreateTexture2D(&textureDesc, &textureData, &texture);
    if (FAILED(result)) {
        error = hresultMessage("CreateTexture2D(texture)", result);
        return false;
    }
    ComPtr<ID3D11ShaderResourceView> view;
    result = device_->CreateShaderResourceView(texture.Get(), nullptr, &view);
    if (FAILED(result)) {
        error = hresultMessage("CreateShaderResourceView(texture)", result);
        return false;
    }
    textureView_ = std::move(view);
    textureWidth_ = static_cast<float>(width);
    textureHeight_ = static_cast<float>(height);
    return true;
}

bool Renderer::setTexture(const std::filesystem::path& path, std::string& error) {
    if (!std::filesystem::is_regular_file(path)) {
        error = "Texture file does not exist: " + path.string();
        return false;
    }
    return loadTextureWic(path, error);
}

} // namespace symvonia::wallpaper
