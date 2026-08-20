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
    float intensity = 0.8f;
    float width = 1.0f;
    float height = 1.0f;
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
        error = hresultMessage("Query IDXGIDevice", result);
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

    const auto compileShader = [&](const std::filesystem::path& path, const char* target, auto createShader) {
        ComPtr<ID3DBlob> byteCode;
        ComPtr<ID3DBlob> errors;
        const auto widePath = pathToWide(path);
        HRESULT compileResult = D3DCompileFromFile(
            widePath.c_str(),
            nullptr,
            D3D_COMPILE_STANDARD_FILE_INCLUDE,
            "main",
            target,
            D3DCOMPILE_ENABLE_STRICTNESS,
            0,
            &byteCode,
            &errors);
        if (FAILED(compileResult)) {
            if (errors) {
                error.assign(static_cast<const char*>(errors->GetBufferPointer()), errors->GetBufferSize());
            } else {
                error = hresultMessage("D3DCompileFromFile", compileResult);
            }
            return false;
        }
        return createShader(byteCode);
    };

    if (!compileShader(shaderDirectory / "fullscreen_vs.hlsl", "vs_5_0", [&](const ComPtr<ID3DBlob>& blob) {
            const HRESULT shaderResult = device_->CreateVertexShader(blob->GetBufferPointer(), blob->GetBufferSize(), nullptr, &vertexShader_);
            if (FAILED(shaderResult)) error = hresultMessage("CreateVertexShader", shaderResult);
            return SUCCEEDED(shaderResult);
        })) return false;

    if (!compileShader(shaderDirectory / "cover_reactive_ps.hlsl", "ps_5_0", [&](const ComPtr<ID3DBlob>& blob) {
            const HRESULT shaderResult = device_->CreatePixelShader(blob->GetBufferPointer(), blob->GetBufferSize(), nullptr, &pixelShader_);
            if (FAILED(shaderResult)) error = hresultMessage("CreatePixelShader", shaderResult);
            return SUCCEEDED(shaderResult);
        })) return false;

    D3D11_BUFFER_DESC constants{};
    constants.ByteWidth = sizeof(FrameConstants);
    constants.Usage = D3D11_USAGE_DEFAULT;
    constants.BindFlags = D3D11_BIND_CONSTANT_BUFFER;
    result = device_->CreateBuffer(&constants, nullptr, &frameConstants_);
    if (FAILED(result)) {
        error = hresultMessage("CreateBuffer", result);
        return false;
    }

    D3D11_SAMPLER_DESC samplerDesc{};
    samplerDesc.Filter = D3D11_FILTER_MIN_MAG_MIP_LINEAR;
    samplerDesc.AddressU = D3D11_TEXTURE_ADDRESS_CLAMP;
    samplerDesc.AddressV = D3D11_TEXTURE_ADDRESS_CLAMP;
    samplerDesc.AddressW = D3D11_TEXTURE_ADDRESS_CLAMP;
    samplerDesc.MaxLOD = D3D11_FLOAT32_MAX;
    result = device_->CreateSamplerState(&samplerDesc, &sampler_);
    if (FAILED(result)) {
        error = hresultMessage("CreateSamplerState", result);
        return false;
    }

    std::array<unsigned char, 4> white{255, 255, 255, 255};
    D3D11_TEXTURE2D_DESC textureDesc{};
    textureDesc.Width = 1;
    textureDesc.Height = 1;
    textureDesc.MipLevels = 1;
    textureDesc.ArraySize = 1;
    textureDesc.Format = DXGI_FORMAT_B8G8R8A8_UNORM;
    textureDesc.SampleDesc.Count = 1;
    textureDesc.Usage = D3D11_USAGE_DEFAULT;
    textureDesc.BindFlags = D3D11_BIND_SHADER_RESOURCE;
    D3D11_SUBRESOURCE_DATA textureData{};
    textureData.pSysMem = white.data();
    textureData.SysMemPitch = 4;
    ComPtr<ID3D11Texture2D> defaultTexture;
    result = device_->CreateTexture2D(&textureDesc, &textureData, &defaultTexture);
    if (FAILED(result)) {
        error = hresultMessage("CreateTexture2D", result);
        return false;
    }
    result = device_->CreateShaderResourceView(defaultTexture.Get(), nullptr, &textureView_);
    if (FAILED(result)) {
        error = hresultMessage("CreateShaderResourceView", result);
        return false;
    }
    return true;
}

Renderer::Surface* Renderer::findSurface(HWND window) {
    const auto found = std::find_if(surfaces_.begin(), surfaces_.end(), [window](const auto& surface) {
        return surface.window == window;
    });
    return found == surfaces_.end() ? nullptr : &*found;
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
    // WorkerW is a child desktop host. The blt-model swap effect is more
    // compatible with child windows than the flip model on older Windows 10
    // desktop compositions.
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

bool Renderer::render(HWND window, float elapsedSeconds, float intensity, std::string& error) {
    auto* surface = findSurface(window);
    if (!surface || !surface->renderTarget) return false;

    FrameConstants constants;
    constants.time = elapsedSeconds;
    constants.intensity = intensity;
    constants.width = static_cast<float>(surface->width);
    constants.height = static_cast<float>(surface->height);
    context_->UpdateSubresource(frameConstants_.Get(), 0, nullptr, &constants, 0, 0);

    const float clear[] = {0.005f, 0.007f, 0.012f, 1.0f};
    context_->OMSetRenderTargets(1, surface->renderTarget.GetAddressOf(), nullptr);
    D3D11_VIEWPORT viewport{};
    viewport.Width = constants.width;
    viewport.Height = constants.height;
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

    const HRESULT result = surface->swapChain->Present(1, 0);
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
