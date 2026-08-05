use std::io::{BufRead, BufReader, Write};
use std::process::{Child, ChildStdin, Command, Stdio};
use std::sync::Mutex;

use tauri::{AppHandle, Emitter};

use crate::plugin_manager;

/// Running instance of the C# audio engine process.
pub struct AudioEngineProcess {
    child: Child,
    stdin: ChildStdin,
}

impl AudioEngineProcess {
    fn send(&mut self, json_line: &str) -> Result<(), String> {
        self.stdin
            .write_all(json_line.as_bytes())
            .and_then(|_| self.stdin.write_all(b"\n"))
            .and_then(|_| self.stdin.flush())
            .map_err(|e| format!("Failed to write to audio engine stdin: {}", e))
    }
}

/// Global handle — at most one engine process at a time.
static ENGINE: Mutex<Option<AudioEngineProcess>> = Mutex::new(None);

fn spawn_engine(app: &AppHandle) -> Result<(), String> {
    let exe = plugin_manager::plugin_exe_path(app)?;
    if !exe.exists() {
        return Err(
            "Bit-perfect audio engine is not installed. Install the plugin first.".to_string(),
        );
    }

    let mut cmd = Command::new(&exe);
    cmd.stdin(Stdio::piped())
        .stdout(Stdio::piped())
        .stderr(Stdio::null());

    // Prevent a console window from flashing on Windows.
    #[cfg(windows)]
    {
        use std::os::windows::process::CommandExt;
        const CREATE_NO_WINDOW: u32 = 0x08000000;
        cmd.creation_flags(CREATE_NO_WINDOW);
    }

    let mut child = cmd
        .spawn()
        .map_err(|e| format!("Failed to start audio engine: {}", e))?;

    let stdin = child
        .stdin
        .take()
        .ok_or_else(|| "Failed to open audio engine stdin".to_string())?;
    let stdout = child
        .stdout
        .take()
        .ok_or_else(|| "Failed to open audio engine stdout".to_string())?;

    // Forward every stdout JSON line to the frontend as an `audio-event`.
    let app_handle = app.clone();
    std::thread::spawn(move || {
        let reader = BufReader::new(stdout);
        for line in reader.lines() {
            match line {
                Ok(l) if !l.trim().is_empty() => {
                    // Payload is the raw JSON line from the engine; the
                    // frontend parses it. This keeps Rust a dumb, fast pipe.
                    if let Err(e) = app_handle.emit("audio-event", l) {
                        eprintln!("Failed to emit audio-event: {}", e);
                        break;
                    }
                }
                Ok(_) => {}
                Err(_) => break, // stdout closed → engine exited
            }
        }
        let _ = app_handle.emit("audio-engine-exit", ());
    });

    let mut guard = ENGINE.lock().map_err(|e| e.to_string())?;
    *guard = Some(AudioEngineProcess { child, stdin });
    Ok(())
}

/// Starts the engine if not already running. Returns true if a new process
/// was spawned, false if one was already alive.
pub fn ensure_running(app: &AppHandle) -> Result<bool, String> {
    // Check liveness of an existing process first.
    {
        let mut guard = ENGINE.lock().map_err(|e| e.to_string())?;
        if let Some(proc) = guard.as_mut() {
            match proc.child.try_wait() {
                Ok(None) => return Ok(false), // still running
                _ => *guard = None,           // exited → clear stale handle
            }
        }
    }

    // Wait for the engine's "ready" event? Not needed: the C# side queues
    // nothing, but stdin writes are buffered by the OS pipe, so commands sent
    // immediately after spawn are still delivered in order.
    spawn_engine(app)?;
    Ok(true)
}

pub fn send_command(app: &AppHandle, json: &str) -> Result<(), String> {
    ensure_running(app)?;
    let mut guard = ENGINE.lock().map_err(|e| e.to_string())?;
    match guard.as_mut() {
        Some(proc) => proc.send(json),
        None => Err("Audio engine failed to start".to_string()),
    }
}

pub fn stop_engine() -> Result<(), String> {
    let mut guard = ENGINE.lock().map_err(|e| e.to_string())?;
    if let Some(mut proc) = guard.take() {
        // Ask politely, then force-kill if it doesn't exit in time.
        let _ = proc.send(r#"{"command":"shutdown"}"#);
        let start = std::time::Instant::now();
        loop {
            match proc.child.try_wait() {
                Ok(Some(_)) => break,
                Ok(None) if start.elapsed().as_millis() < 2000 => {
                    std::thread::sleep(std::time::Duration::from_millis(50));
                }
                _ => {
                    let _ = proc.child.kill();
                    break;
                }
            }
        }
        let _ = proc.child.wait();
    }
    Ok(())
}

pub fn is_running() -> bool {
    if let Ok(mut guard) = ENGINE.lock() {
        if let Some(proc) = guard.as_mut() {
            return matches!(proc.child.try_wait(), Ok(None));
        }
    }
    false
}
