use std::io::{BufRead, BufReader, Write};
use std::process::{Child, ChildStdin, Command, Stdio};
use std::sync::Mutex;

use serde_json::json;
use tauri::{AppHandle, Emitter};

use crate::ai_lyrics_plugin_manager;

pub struct AiLyricsProcess {
    child: Child,
    stdin: ChildStdin,
}

impl AiLyricsProcess {
    fn send(&mut self, json_line: &str) -> Result<(), String> {
        self.stdin
            .write_all(json_line.as_bytes())
            .and_then(|_| self.stdin.write_all(b"\n"))
            .and_then(|_| self.stdin.flush())
            .map_err(|e| format!("Failed to write to AI lyrics engine stdin: {}", e))
    }
}

static AI_LYRICS_ENGINE: Mutex<Option<AiLyricsProcess>> = Mutex::new(None);

fn spawn_engine(app: &AppHandle) -> Result<(), String> {
    let exe = ai_lyrics_plugin_manager::plugin_exe_path(app)?;
    if !exe.exists() {
        return Err(
            "Plugin Local AI Lyrics Engine belum terpasang. Pasang plugin terlebih dahulu.".to_string(),
        );
    }

    let dir = exe.parent().ok_or_else(|| "Failed to get plugin directory".to_string())?;

    let mut cmd = Command::new(&exe);
    cmd.current_dir(dir);
    cmd.stdin(Stdio::piped())
        .stdout(Stdio::piped())
        .stderr(Stdio::null());

    #[cfg(windows)]
    {
        use std::os::windows::process::CommandExt;
        const CREATE_NO_WINDOW: u32 = 0x08000000;
        cmd.creation_flags(CREATE_NO_WINDOW);
    }

    let mut child = cmd
        .spawn()
        .map_err(|e| format!("Failed to start AI lyrics engine: {}", e))?;

    let stdin = child
        .stdin
        .take()
        .ok_or_else(|| "Failed to open AI lyrics engine stdin".to_string())?;
    let stdout = child
        .stdout
        .take()
        .ok_or_else(|| "Failed to open AI lyrics engine stdout".to_string())?;

    let app_handle = app.clone();
    std::thread::spawn(move || {
        let reader = BufReader::new(stdout);
        for line in reader.lines() {
            match line {
                Ok(l) if !l.trim().is_empty() => {
                    if let Err(e) = app_handle.emit("ai-lyrics-event", l) {
                        eprintln!("Failed to emit ai-lyrics-event: {}", e);
                        break;
                    }
                }
                Ok(_) => {}
                Err(_) => break,
            }
        }
        let _ = app_handle.emit("ai-lyrics-engine-exit", ());
    });

    let mut guard = AI_LYRICS_ENGINE.lock().map_err(|e| e.to_string())?;
    *guard = Some(AiLyricsProcess { child, stdin });
    Ok(())
}

pub fn ensure_running(app: &AppHandle) -> Result<bool, String> {
    {
        let mut guard = AI_LYRICS_ENGINE.lock().map_err(|e| e.to_string())?;
        if let Some(proc) = guard.as_mut() {
            match proc.child.try_wait() {
                Ok(None) => return Ok(false),
                _ => *guard = None,
            }
        }
    }

    spawn_engine(app)?;
    Ok(true)
}

pub fn generate_ai_lyrics(
    app: &AppHandle,
    file_path: String,
    model_name: Option<String>,
    language: Option<String>,
    isolate_vocals: Option<bool>,
) -> Result<(), String> {
    ensure_running(app)?;

    let models_dir = ai_lyrics_plugin_manager::plugin_dir(app)?
        .join("models")
        .to_string_lossy()
        .to_string();

    let cmd = json!({
        "command": "transcribe",
        "path": file_path,
        "modelName": model_name.unwrap_or_else(|| "base".to_string()),
        "language": language.unwrap_or_else(|| "auto".to_string()),
        "isolateVocals": isolate_vocals.unwrap_or(false),
        "modelsDir": models_dir
    });

    let line = serde_json::to_string(&cmd).map_err(|e| e.to_string())?;

    let mut guard = AI_LYRICS_ENGINE.lock().map_err(|e| e.to_string())?;
    let proc = guard
        .as_mut()
        .ok_or_else(|| "AI Lyrics engine is not running".to_string())?;
    proc.send(&line)
}

pub fn extract_vocal_ai(
    app: &AppHandle,
    file_path: String,
    output_path: Option<String>,
) -> Result<(), String> {
    ensure_running(app)?;

    let models_dir = ai_lyrics_plugin_manager::plugin_dir(app)?
        .join("models")
        .to_string_lossy()
        .to_string();

    let cmd = json!({
        "command": "extract_vocal",
        "path": file_path,
        "modelPath": output_path,
        "modelsDir": models_dir
    });

    let line = serde_json::to_string(&cmd).map_err(|e| e.to_string())?;

    let mut guard = AI_LYRICS_ENGINE.lock().map_err(|e| e.to_string())?;
    let proc = guard
        .as_mut()
        .ok_or_else(|| "AI Lyrics engine is not running".to_string())?;
    proc.send(&line)
}

pub fn cancel_ai_lyrics(_app: &AppHandle) -> Result<(), String> {
    let mut guard = AI_LYRICS_ENGINE.lock().map_err(|e| e.to_string())?;
    if let Some(proc) = guard.as_mut() {
        let cmd = json!({ "command": "cancel" });
        if let Ok(line) = serde_json::to_string(&cmd) {
            let _ = proc.send(&line);
        }
    }
    Ok(())
}

pub fn stop_engine() {
    if let Ok(mut guard) = AI_LYRICS_ENGINE.lock() {
        if let Some(mut proc) = guard.take() {
            let cmd = json!({ "command": "shutdown" });
            if let Ok(line) = serde_json::to_string(&cmd) {
                let _ = proc.send(&line);
            }
            let _ = proc.child.kill();
        }
    }
}
