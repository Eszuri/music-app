use std::time::Duration;
use tauri::{AppHandle, Emitter, Manager, Url, WebviewUrl, WebviewWindowBuilder};

fn is_media_url(url: &str) -> bool {
    if url.contains("youtube.com/watch?v=")
        || url.contains("youtu.be/")
        || url.contains("/shorts/")
    {
        return true;
    }
    if url.contains("music.youtube.com/watch?v=")
        || url.contains("music.youtube.com/playlist?list=")
    {
        return true;
    }
    if url.contains("open.spotify.com/track/")
        || url.contains("open.spotify.com/album/")
        || url.contains("open.spotify.com/playlist/")
        || url.contains("open.spotify.com/episode/")
        || url.contains("open.spotify.com/show/")
    {
        return true;
    }
    if url.contains("soundcloud.com/") {
        let path = url.split("soundcloud.com/").nth(1).unwrap_or("");
        let segments: Vec<&str> = path.split('/').filter(|s| !s.is_empty()).collect();
        if segments.len() >= 2 {
            return true;
        }
    }
    if url.contains("bandcamp.com/track/")
        || url.contains(".bandcamp.com/track/")
        || url.contains("bandcamp.com/album/")
        || url.contains(".bandcamp.com/album/")
    {
        return true;
    }
    if url.contains("deezer.com/track/")
        || url.contains("deezer.com/album/")
        || url.contains("deezer.com/playlist/")
    {
        return true;
    }
    if url.contains("tidal.com/track/")
        || url.contains("tidal.com/album/")
        || url.contains("tidal.com/playlist/")
    {
        return true;
    }
    if url.contains("music.apple.com/") {
        let path_segments: Vec<&str> = url.split('/').filter(|s| !s.is_empty()).collect();
        if path_segments.iter().any(|s| *s == "album" || *s == "song" || *s == "playlist") {
            return true;
        }
    }
    false
}

#[tauri::command]
pub async fn open_webview_stream(
    app: AppHandle,
    url: String,
    label: String,
    title: String,
) -> Result<(), String> {
    let parsed = Url::parse(&url).map_err(|_| "Invalid stream URL".to_string())?;
    if !matches!(parsed.scheme(), "http" | "https") || parsed.host().is_none() {
        return Err("Only http and https stream URLs are allowed".to_string());
    }

    if let Some(window) = app.get_webview_window(&label) {
        let _ = window.navigate(parsed);
        let _ = window.show();
        let _ = window.set_focus();
        return Ok(());
    }

    let _window = WebviewWindowBuilder::new(
        &app,
        &label,
        WebviewUrl::External(parsed),
    )
    .title(&title)
    .inner_size(1200.0, 800.0)
    .min_inner_size(800.0, 600.0)
    .build()
    .map_err(|e| e.to_string())?;

    let app_clone = app.clone();
    let label_clone = label.clone();
    std::thread::spawn(move || {
        let mut last_url: Option<String> = None;
        loop {
            std::thread::sleep(Duration::from_secs(1));
            if let Some(w) = app_clone.get_webview_window(&label_clone) {
                match w.url() {
                    Ok(current_url) => {
                        let url_str = current_url.as_str().to_string();
                        let is_new = match &last_url {
                            Some(prev) => &url_str != prev,
                            None => true,
                        };
                        if is_new && is_media_url(&url_str) {
                            let _ = app_clone.emit("stream-url-changed", &url_str);
                        }
                        last_url = Some(url_str);
                    }
                    Err(_) => {
                        // webview not ready yet, skip
                    }
                }
            } else {
                break; // window closed
            }
        }
    });

    Ok(())
}
