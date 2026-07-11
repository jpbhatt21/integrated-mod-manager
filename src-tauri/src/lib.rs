use futures_util::StreamExt;
use once_cell::sync::Lazy;
use reqwest::Client;
use serde::Serialize;
use std::collections::HashMap;
use std::fs::{remove_file, File};
use std::io::{BufWriter, Write};
use std::path::{Component, Path, PathBuf};
use std::process::Command;
use std::sync::atomic::{AtomicU64, Ordering};
use std::sync::Mutex;
use std::time::Instant;
use tauri::Emitter;
use tauri::Manager;
use tauri_plugin_deep_link::DeepLinkExt;
use tauri_plugin_shell::ShellExt;
use tauri_plugin_tracing::{
    tracing, Builder as Tracing, LevelFilter, MaxFileSize, Rotation, RotationStrategy,
};

mod hotreload;
mod image_server;
mod logger_utils;

const PROGRESS_UPDATE_THRESHOLD: u64 = 1024;
const BUFFER_SIZE: usize = 8192;
const IMAGE_SERVER_PORT: u16 = 3469;
const MAX_DOWNLOAD_BYTES: u64 = 20 * 1024 * 1024 * 1024;
const MAX_EXTRACTED_BYTES: u64 = 40 * 1024 * 1024 * 1024;
const MAX_EXTRACTED_FILES: u64 = 100_000;

#[derive(Serialize, Clone)]
struct DownloadProgress {
    downloaded: f64,
    total: f64,
    speed: String,
    eta: String,
    key: String,
}

#[derive(Serialize, Clone)]
struct DownloadError {
    key: String,
    stage: String,
    message: String,
}

fn emit_download_error(app_handle: &tauri::AppHandle, key: &str, stage: &str, message: &str) {
    let _ = app_handle.emit(
        "download-error",
        DownloadError {
            key: key.to_string(),
            stage: stage.to_string(),
            message: message.to_string(),
        },
    );
}

fn decrement_download_count(key: &str) {
    let Ok(mut counts) = DOWNLOAD_COUNTS.lock() else {
        return;
    };
    if let Some(count) = counts.get_mut(key) {
        if *count > 0 {
            *count -= 1;
        }
        if *count == 0 {
            counts.remove(key);
        }
    }
}

fn validate_file_name(name: &str) -> Result<String, String> {
    let path = Path::new(name);
    let component = path
        .file_name()
        .and_then(|v| v.to_str())
        .ok_or("Invalid file name")?;
    if component != name
        || component.is_empty()
        || component == "."
        || component == ".."
        || path.components().any(|c| {
            matches!(
                c,
                Component::ParentDir | Component::RootDir | Component::Prefix(_)
            )
        })
    {
        return Err("File name must be a simple basename".into());
    }
    Ok(component.to_string())
}

fn validate_destination(path: &Path) -> Result<PathBuf, String> {
    if !path.is_absolute() {
        return Err("Destination must be an absolute path".into());
    }
    const MANAGED_ROOT: &str = "DISABLED - ALL MODS ARE STORED HERE (Managed by IMM)";
    if !path
        .components()
        .any(|component| component.as_os_str() == MANAGED_ROOT)
    {
        return Err("Destination is outside IMM's managed mod directory".into());
    }
    std::fs::create_dir_all(path).map_err(|e| format!("Cannot create destination: {e}"))?;
    let canonical = path
        .canonicalize()
        .map_err(|e| format!("Cannot resolve destination: {e}"))?;
    if canonical
        .components()
        .any(|c| matches!(c, Component::ParentDir))
    {
        return Err("Invalid destination".into());
    }
    Ok(canonical)
}

fn validate_download_url(value: &str) -> Result<(), String> {
    let url = reqwest::Url::parse(value).map_err(|_| "Invalid download URL")?;
    let host = url.host_str().unwrap_or_default();
    if url.scheme() != "https" || !(host == "gamebanana.com" || host.ends_with(".gamebanana.com")) {
        return Err("Downloads are restricted to HTTPS GameBanana hosts".into());
    }
    Ok(())
}

fn validate_extracted_tree(root: &Path) -> Result<(), String> {
    let root = root.canonicalize().map_err(|e| e.to_string())?;
    let mut pending = vec![root.clone()];
    let mut files = 0_u64;
    let mut bytes = 0_u64;
    while let Some(dir) = pending.pop() {
        for entry in std::fs::read_dir(&dir).map_err(|e| e.to_string())? {
            let entry = entry.map_err(|e| e.to_string())?;
            let metadata = std::fs::symlink_metadata(entry.path()).map_err(|e| e.to_string())?;
            if metadata.file_type().is_symlink() {
                return Err("Archive contains a symbolic link".into());
            }
            let canonical = entry.path().canonicalize().map_err(|e| e.to_string())?;
            if !canonical.starts_with(&root) {
                return Err("Archive escaped the staging directory".into());
            }
            if metadata.is_dir() {
                pending.push(canonical);
            } else {
                files += 1;
                bytes = bytes.saturating_add(metadata.len());
                if files > MAX_EXTRACTED_FILES || bytes > MAX_EXTRACTED_BYTES {
                    return Err("Archive exceeds extraction resource limits".into());
                }
            }
        }
    }
    Ok(())
}

/// Format bytes into human-readable format (KB, MB, GB)
fn format_bytes(bytes: u64) -> String {
    const KB: u64 = 1024;
    const MB: u64 = KB * 1024;
    const GB: u64 = MB * 1024;

    if bytes >= GB {
        format!("{:.2} GB", bytes as f64 / GB as f64)
    } else if bytes >= MB {
        format!("{:.2} MB", bytes as f64 / MB as f64)
    } else if bytes >= KB {
        format!("{:.2} KB", bytes as f64 / KB as f64)
    } else {
        format!("{} B", bytes)
    }
}

/// Format speed in bytes per second
fn format_speed(bytes_per_sec: f64) -> String {
    const KB: f64 = 1024.0;
    const MB: f64 = KB * 1024.0;
    const GB: f64 = MB * 1024.0;

    if bytes_per_sec >= GB {
        format!("{:.2} GB/s", bytes_per_sec / GB)
    } else if bytes_per_sec >= MB {
        format!("{:.2} MB/s", bytes_per_sec / MB)
    } else if bytes_per_sec >= KB {
        format!("{:.2} KB/s", bytes_per_sec / KB)
    } else {
        format!("{:.2} B/s", bytes_per_sec)
    }
}

/// Format time duration into human-readable format
fn format_duration(seconds: u64) -> String {
    let hours = seconds / 3600;
    let minutes = (seconds % 3600) / 60;
    let secs = seconds % 60;

    if hours > 0 {
        format!("{}h {}m {}s", hours, minutes, secs)
    } else if minutes > 0 {
        format!("{}m {}s", minutes, secs)
    } else {
        format!("{}s", secs)
    }
}

static SESSION_ID: AtomicU64 = AtomicU64::new(0);
static STAGING_ID: AtomicU64 = AtomicU64::new(0);
static DOWNLOAD_COUNTS: Lazy<Mutex<HashMap<String, u64>>> =
    Lazy::new(|| Mutex::new(HashMap::new()));

const MIME_EXTENSIONS: &[(&str, &str)] = &[
    ("image/jpeg", "jpg"),
    ("image/jpg", "jpg"),
    ("image/png", "png"),
    ("image/gif", "gif"),
    ("application/pdf", "pdf"),
    ("text/plain", "txt"),
    ("text/html", "html"),
    ("application/json", "json"),
    ("application/zip", "zip"),
    ("application/x-tar", "tar"),
    ("application/gzip", "gz"),
    ("application/x-bzip2", "bz2"),
    ("application/x-xz", "xz"),
    ("text/csv", "csv"),
    ("application/vnd.ms-excel", "xls"),
    (
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "xlsx",
    ),
    ("application/vnd.ms-powerpoint", "ppt"),
    (
        "application/vnd.openxmlformats-officedocument.presentationml.presentation",
        "pptx",
    ),
    ("application/msword", "doc"),
    (
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        "docx",
    ),
];

fn mime_to_extension(mime_type: &str) -> Option<&'static str> {
    let clean_mime = mime_type.split(';').next().unwrap_or("").trim();
    MIME_EXTENSIONS
        .iter()
        .find(|(mime, _)| *mime == clean_mime)
        .map(|(_, ext)| *ext)
}
/// Resource-relative path of the bundled 7-Zip binary for the current platform,
/// or `None` on platforms/architectures where no binary is bundled. Returning an
/// `Option` (rather than gating with `#[cfg]` alone) keeps the crate compiling on
/// unsupported targets and lets callers emit a clear runtime error instead.
fn seven_zip_program_name() -> Option<&'static str> {
    #[cfg(target_os = "windows")]
    {
        Some("ext/7z.exe")
    }
    #[cfg(all(target_os = "linux", target_arch = "x86_64"))]
    {
        Some("ext/7zz")
    }
    #[cfg(all(target_os = "linux", target_arch = "aarch64"))]
    {
        Some("ext/7zz-aarch64")
    }
    #[cfg(not(any(
        target_os = "windows",
        all(target_os = "linux", target_arch = "x86_64"),
        all(target_os = "linux", target_arch = "aarch64")
    )))]
    {
        None
    }
}

async fn decompress_file(
    app_handle: tauri::AppHandle,
    file_path: &str,
    save_path: &str,
) -> Result<(), String> {
    let program_name = seven_zip_program_name().ok_or_else(|| {
        "No bundled 7-Zip binary for this platform/architecture; archive extraction is unsupported"
            .to_string()
    })?;

    let program_path = app_handle
        .path()
        .resolve(program_name, tauri::path::BaseDirectory::Resource)
        .map_err(|e| e.to_string())?;

    let output = app_handle
        .shell()
        .command(
            program_path
                .to_str()
                .ok_or("7-Zip path is not valid UTF-8")?,
        )
        .args(["x", file_path, &format!("-o{}", save_path), "-y"])
        .output()
        .await
        .map_err(|e| e.to_string())?;

    if output.status.success() {
        Ok(())
    } else {
        let err = String::from_utf8_lossy(&output.stderr);
        Err(if err.is_empty() {
            String::from_utf8_lossy(&output.stdout).to_string()
        } else {
            err.to_string()
        })
    }
}

async fn validate_archive_listing(
    app_handle: &tauri::AppHandle,
    file_path: &str,
) -> Result<(), String> {
    let program_name =
        seven_zip_program_name().ok_or("Archive extraction is unsupported on this platform")?;
    let program_path = app_handle
        .path()
        .resolve(program_name, tauri::path::BaseDirectory::Resource)
        .map_err(|e| e.to_string())?;
    let program = program_path
        .to_str()
        .ok_or("7-Zip path is not valid UTF-8")?;
    let output = app_handle
        .shell()
        .command(program)
        .args(["l", "-slt", file_path])
        .output()
        .await
        .map_err(|e| e.to_string())?;
    if !output.status.success() {
        return Err("Archive validation failed".into());
    }

    // let listing = String::from_utf8_lossy(&output.stdout);
    // let mut entries = 0_u64;
    // let mut expanded = 0_u64;
    // for line in listing.lines() {
    //     if let Some(value) = line.strip_prefix("Path = ") {
    //         let path = Path::new(value);
    //         if entries > 0
    //             && (path.is_absolute()
    //                 || path.components().any(|c| {
    //                     matches!(
    //                         c,
    //                         Component::ParentDir | Component::RootDir | Component::Prefix(_)
    //                     )
    //                 }))
    //         {
    //             return Err("Archive contains an unsafe path".into());
    //         }
    //         entries += 1;
    //     } else if let Some(value) = line.strip_prefix("Size = ") {
    //         expanded =
    //             expanded.saturating_add(value.parse::<u64>().unwrap_or(MAX_EXTRACTED_BYTES + 1));
    //     } 
        // else if line.starts_with("Symbolic Link = ") || line.starts_with("Hard Link = ") {
        //     return Err("Archive contains a link".into());
        // }
        // if entries > MAX_EXTRACTED_FILES || expanded > MAX_EXTRACTED_BYTES {
        //     return Err("Archive exceeds extraction resource limits".into());
        // }
    // }
    Ok(())
}

/// Extract archive file (zip, rar, or 7z) to the specified path
#[tauri::command]
async fn extract_archive(
    app_handle: tauri::AppHandle,
    file_path: String,
    save_path: String,
    file_name: String,
    emit: bool,
    key: String,
    current_sid: u64,
    del: bool,
) -> Result<(), String> {
    let file_path = PathBuf::from(&file_path);
    if !file_path.is_file() {
        return Err("Archive does not exist".into());
    }
    let destination = validate_destination(Path::new(&save_path))?;
    let parent = destination.parent().ok_or("Destination has no parent")?;
    let archive_path = file_path
        .to_str()
        .ok_or("Archive path is not valid UTF-8")?;
    validate_archive_listing(&app_handle, archive_path).await?;
    let nonce = format!(
        "{}-{}",
        std::process::id(),
        STAGING_ID.fetch_add(1, Ordering::Relaxed)
    );
    let staging = parent.join(format!(".imm-extract-{nonce}"));
    let backup = parent.join(format!(".imm-rollback-{nonce}"));
    std::fs::create_dir(&staging)
        .map_err(|e| format!("Cannot create extraction staging directory: {e}"))?;

    let before = Instant::now();
    let staging_path = staging.to_str().ok_or("Staging path is not valid UTF-8")?;
    let extraction = decompress_file(app_handle.clone(), archive_path, staging_path)
        .await
        .and_then(|_| validate_extracted_tree(&staging));
    if let Err(e) = extraction {
        let _ = std::fs::remove_dir_all(&staging);
        if emit {
            decrement_download_count(&key);
        }
        emit_download_error(&app_handle, &key, "extract", &e);
        return Err(e);
    }
    tracing::info!("Validated archive extraction in {:.2?}", before.elapsed());

    std::fs::rename(&destination, &backup)
        .map_err(|e| format!("Cannot preserve existing mod directory: {e}"))?;
    if let Err(e) = std::fs::rename(&staging, &destination) {
        let _ = std::fs::rename(&backup, &destination);
        return Err(format!("Cannot install extracted mod: {e}"));
    }
    for extension in ["jpg", "jpeg", "png", "gif", "webp"] {
        let preview = backup.join(format!("preview.{extension}"));
        if preview.is_file() {
            let _ = std::fs::copy(&preview, destination.join(format!("preview.{extension}")));
        }
    }
    if let Err(e) = std::fs::remove_dir_all(&backup) {
        tracing::warn!(
            "Could not remove extraction rollback directory {}: {}",
            backup.display(),
            e
        );
    }

    if !del {
        app_handle
            .emit("fin", serde_json::json!({ "key": key, "type": "manual" }))
            .map_err(|e| e.to_string())?;
        return Ok(());
    }
    if emit {
        // let global_sid = SESSION_ID.load(Ordering::SeqCst);
        let mut valid = false;
        let mut counts = DOWNLOAD_COUNTS
            .lock()
            .map_err(|_| "Download state lock is poisoned")?;
        if let Some(count) = counts.get_mut(&key) {
            if *count >= 1 {
                valid = true;
                *count -= 1;
                if counts.get(&key) == Some(&0) {
                    counts.remove(&key);
                }
            }
        }
        tracing::info!(
            "Emitting completion event for session {}: {}",
            current_sid,
            file_name
        );
        if !valid {
            tracing::warn!(
                "Download state was invalid after extraction for key '{}'",
                key
            );
            return Err(format!(
                "Session changed during processing, operation cancelled (file: {})",
                file_name
            ));
        }
        app_handle
            .emit("fin", serde_json::json!({ "key": key , "type": "auto" }))
            .map_err(|e| e.to_string())?;
    }
    Ok(())
}
#[tauri::command]
async fn download_and_unzip(
    app_handle: tauri::AppHandle,
    file_name: String,
    download_url: String,
    save_path: String,
    key: String,
    emit: bool,
) -> Result<(), String> {
    validate_download_url(&download_url)?;
    let current_sid = SESSION_ID.load(Ordering::SeqCst);
    tracing::info!(
        "Starting download for session ID: {}, file: {}",
        current_sid,
        file_name
    );

    let client = Client::new();

    let response = client
        .get(&download_url)
        .send()
        .await
        .map_err(|e| {
            let message = e.to_string();
            if emit {
                decrement_download_count(&key);
                emit_download_error(&app_handle, &key, "download", &message);
            }
            message
        })?
        .error_for_status()
        .map_err(|e| e.to_string())?;
    validate_download_url(response.url().as_str())?;

    let ext = response
        .url()
        .path_segments()
        .and_then(|segments| segments.last())
        .and_then(|name| std::path::Path::new(name).extension())
        .and_then(|ext| ext.to_str())
        .or_else(|| {
            response
                .headers()
                .get("content-type")
                .and_then(|ct| ct.to_str().ok())
                .and_then(|ct| mime_to_extension(ct))
        })
        .unwrap_or("")
        .to_owned();

    let file_name = if !ext.is_empty() {
        format!("{}.{}", validate_file_name(&file_name)?, ext)
    } else {
        validate_file_name(&file_name)?
    };
    let total_size = response.content_length().unwrap_or(0);
    if total_size > MAX_DOWNLOAD_BYTES {
        return Err("Download exceeds the configured size limit".into());
    }
    let destination = validate_destination(Path::new(&save_path))?;
    let file_path = destination.join(&file_name);
    if emit {
        let mut counts = DOWNLOAD_COUNTS
            .lock()
            .map_err(|_| "Download state lock is poisoned")?;
        *counts.entry(key.clone()).or_insert(0) += 1;
    }

    let file = File::create(&file_path).map_err(|e| {
        let message = e.to_string();
        if emit {
            decrement_download_count(&key);
            emit_download_error(&app_handle, &key, "download", &message);
        }
        message
    })?;
    let mut writer = BufWriter::with_capacity(BUFFER_SIZE, file);

    let mut stream = response.bytes_stream();
    let mut downloaded: u64 = 0;
    let mut last_progress_update: u64 = 0;

    // Variables for speed calculation
    let start_time = Instant::now();

    while let Some(item) = stream.next().await {
        let global_sid = SESSION_ID.load(Ordering::SeqCst);
        if global_sid != current_sid {
            tracing::info!(
                "Session changed during download (was: {}, now: {}), aborting download of: {}",
                current_sid,
                global_sid,
                file_name
            );

            drop(writer);
            if emit {
                decrement_download_count(&key);
            }
            let _ = remove_file(&file_path);
            return Err(format!(
                "Download cancelled due to session change (file: {})",
                file_name
            ));
        }

        if emit {
            let counts = DOWNLOAD_COUNTS
                .lock()
                .map_err(|_| "Download state lock is poisoned")?;
            let count = counts.get(&key).copied().unwrap_or(0);
            drop(counts);
            if count == 0 {
                tracing::info!(
                    "Download cancelled for key '{}', aborting download of: {}",
                    key,
                    file_name
                );
                drop(writer);
                let _ = remove_file(&file_path);
                return Err(format!("Download cancelled (file: {})", file_name));
            }
        }

        let chunk = item.map_err(|e| {
            let message = e.to_string();
            if emit {
                decrement_download_count(&key);
                emit_download_error(&app_handle, &key, "download", &message);
            }
            message
        })?;
        writer.write_all(&chunk).map_err(|e| {
            let message = e.to_string();
            if emit {
                decrement_download_count(&key);
                emit_download_error(&app_handle, &key, "download", &message);
            }
            message
        })?;
        downloaded += chunk.len() as u64;
        if downloaded > MAX_DOWNLOAD_BYTES {
            drop(writer);
            let _ = remove_file(&file_path);
            return Err("Download exceeds the configured size limit".into());
        }

        if emit && (downloaded - last_progress_update) >= PROGRESS_UPDATE_THRESHOLD {
            // Calculate speed and ETA asynchronously to avoid blocking download
            let total_elapsed = start_time.elapsed().as_secs_f64();
            let avg_speed = if total_elapsed > 0.0 {
                downloaded as f64 / total_elapsed
            } else {
                0.0
            };

            let remaining_bytes = total_size.saturating_sub(downloaded);
            let eta_secs = if avg_speed > 0.0 {
                (remaining_bytes as f64 / avg_speed) as u64
            } else {
                0
            };

            let progress_data = DownloadProgress {
                downloaded: downloaded as f64,
                total: total_size as f64,
                speed: format_speed(avg_speed),
                eta: format_duration(eta_secs),
                key: key.clone(),
            };

            // Emit asynchronously to not block download
            let app_handle_clone = app_handle.clone();
            tauri::async_runtime::spawn(async move {
                let _ = app_handle_clone.emit("download-progress", progress_data);
            });

            last_progress_update = downloaded;
        }
    }

    let global_sid = SESSION_ID.load(Ordering::SeqCst);
    if global_sid != current_sid {
        tracing::info!("Session changed after download completed (was: {}, now: {}), aborting processing of: {}", current_sid, global_sid, file_name);

        drop(writer);
        if emit {
            decrement_download_count(&key);
        }
        let _ = remove_file(&file_path);
        return Err(format!(
            "Download cancelled due to session change after completion (file: {})",
            file_name
        ));
    }

    writer.flush().map_err(|e| {
        let message = e.to_string();
        if emit {
            decrement_download_count(&key);
            emit_download_error(&app_handle, &key, "download", &message);
        }
        message
    })?;

    drop(writer);

    // Log final download statistics
    let total_elapsed = start_time.elapsed().as_secs_f64();
    let avg_speed = if total_elapsed > 0.0 {
        downloaded as f64 / total_elapsed
    } else {
        0.0
    };

    tracing::info!(
        "Download completed for '{}': {} in {:.2}s (Avg Speed: {})",
        file_name,
        format_bytes(downloaded),
        total_elapsed,
        format_speed(avg_speed)
    );

    tracing::info!(
        "Download completed successfully for session {}: {}",
        current_sid,
        file_name
    );

    // Emit final progress update showing download complete
    if emit {
        let final_speed = format_speed(avg_speed);
        app_handle
            .emit(
                "ext",
                DownloadProgress {
                    downloaded: total_size as f64,
                    total: total_size as f64,
                    speed: final_speed,
                    eta: "0s".to_string(),
                    key: key.clone(),
                },
            )
            .map_err(|e| e.to_string())?;

        // Extract archive if it's a supported format
        extract_archive(
            app_handle.clone(),
            file_path.to_string_lossy().to_string(),
            save_path.clone(),
            file_name.clone(),
            emit,
            key,
            current_sid,
            true,
        )
        .await?;
    }

    tracing::info!(
        "Download and extraction completed successfully for session {}: {}",
        current_sid,
        file_name
    );

    Ok(())
}

#[tauri::command]
fn cancel_extract(key: String) -> Result<(), String> {
    let mut counts = DOWNLOAD_COUNTS
        .lock()
        .map_err(|_| "Download state lock is poisoned")?;
    if let Some(count) = counts.get_mut(&key) {
        if *count > 0 {
            *count -= 1;
            // Remove key if count reaches 0
            if *count == 0 {
                counts.remove(&key);
            }
            Ok(())
        } else {
            Err(format!("Key '{}' already has count of 0", key))
        }
    } else {
        Err(format!("Key '{}' not found in download counts", key))
    }
}

#[tauri::command]
fn get_username() -> String {
    let new_sid = SESSION_ID.fetch_add(1, Ordering::SeqCst) + 1;
    tracing::info!("Session changed, new session ID: {}", new_sid);

    let username = std::env::var("USERNAME").unwrap_or_else(|_| "Unknown".to_string());
    username
}
#[tauri::command]
fn exit_app() {
    std::process::exit(0x0);
}

#[tauri::command]
fn get_image_server_url() -> String {
    format!("http://127.0.0.1:{}", IMAGE_SERVER_PORT)
}

#[tauri::command]
fn get_session_id() -> u64 {
    SESSION_ID.load(Ordering::SeqCst)
}

#[tauri::command]
fn execute_with_args(exe_path: String, args: Vec<String>) -> Result<String, String> {
    if !Path::new(&exe_path).exists() {
        return Err(format!("Executable not found: {}", exe_path));
    }

    let mut command;
    // Windows executables can't be exec'd natively on Linux, so run them
    // through Wine (the game itself already runs under Wine/Proton).
    #[cfg(target_os = "linux")]
    {
        let is_exe = Path::new(&exe_path)
            .extension()
            .map(|e| e.eq_ignore_ascii_case("exe"))
            .unwrap_or(false);
        let parent = Path::new(&exe_path)
            .parent()
            .and_then(|p| p.to_str())
            .map(|s| s.to_string());
        if is_exe {
            if Path::new("/.flatpak-info").exists() {
                // Inside a flatpak sandbox there is no Wine; run it on the host
                // (where Wine and the game's Wine prefix actually live) via the
                // spawn portal.
                command = Command::new("flatpak-spawn");
                command.arg("--host");
                if let Some(ref dir) = parent {
                    command.arg(format!("--directory={}", dir));
                }
                command.arg("wine").arg(&exe_path);
            } else {
                command = Command::new("wine");
                command.arg(&exe_path);
                if let Some(ref dir) = parent {
                    command.current_dir(dir);
                }
            }
        } else {
            command = Command::new(&exe_path);
        }
    }
    #[cfg(not(target_os = "linux"))]
    {
        command = Command::new(&exe_path);
    }

    for arg in &args {
        command.arg(arg);
    }

    match command.spawn() {
        Ok(child) => {
            tracing::info!(
                "Successfully started process: {} with args: {:?}",
                exe_path,
                args
            );
            Ok(format!(
                "Process started successfully with PID: {}",
                child.id()
            ))
        }
        Err(e) => {
            tracing::error!("Failed to start process {}: {}", exe_path, e);
            Err(format!("Failed to start process: {}", e))
        }
    }
}

#[tauri::command]
async fn create_symlink(link_path: String, target_path: String) -> Result<(), String> {
    // First, check if the target path exists
    let _target_metadata = std::fs::metadata(&target_path).map_err(|e| e.to_string())?;

    // Use platform-specific functions
    #[cfg(windows)]
    {
        if _target_metadata.is_dir() {
            // On Windows, use symlink_dir for directories
            std::os::windows::fs::symlink_dir(&target_path, &link_path)
                .map_err(|e| e.to_string())?;
        } else {
            // and symlink_file for files
            std::os::windows::fs::symlink_file(&target_path, &link_path)
                .map_err(|e| e.to_string())?;
        }
    }
    #[cfg(unix)]
    {
        // On Unix-like systems, symlink works for both files and directories
        std::os::unix::fs::symlink(&target_path, &link_path).map_err(|e| e.to_string())?;
    }
    #[cfg(not(any(windows, unix)))]
    {
        return Err("Symbolic links are not supported on this platform.".to_string());
    }

    Ok(())
}

#[tauri::command]
async fn set_window_icon(app_handle: tauri::AppHandle, game: String) -> Result<(), String> {
    {
        let icon_bytes = match game.as_str() {
            "WW" => include_bytes!("../icons/WW128x128.png").as_slice(),
            "ZZ" => include_bytes!("../icons/ZZ128x128.png").as_slice(),
            "GI" => include_bytes!("../icons/GI128x128.png").as_slice(),
            "SR" => include_bytes!("../icons/SR128x128.png").as_slice(),
            "EF" => include_bytes!("../icons/EF128x128.png").as_slice(),
            _ => include_bytes!("../icons/128x128.png").as_slice(),
        };

        if let Ok(icon) = tauri::image::Image::from_bytes(icon_bytes) {
            if let Some(window) = app_handle.get_webview_window("main") {
                let _ = window.set_icon(icon);
            }
        }
    }
    Ok(())
}

use tauri_plugin_window_state::{Builder, StateFlags};
#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .plugin(
            Tracing::new()
                .with_max_level(
                    if cfg!(debug_assertions) {
                        LevelFilter::DEBUG
                    } else {
                        LevelFilter::INFO
                    }
                )
                .with_file_logging()
                .with_rotation(Rotation::Daily)
                .with_rotation_strategy(RotationStrategy::KeepSome(10))
                .with_max_file_size(MaxFileSize::mb(25))
                .with_default_subscriber()
                .build()
        )
        .plugin(
            Builder::default()
                // sets the flags to only track and restore size
                .with_state_flags(StateFlags::all().difference(StateFlags::DECORATIONS))
                .build(),
        )
        .plugin(tauri_plugin_single_instance::init(|_app, argv, _cwd| {
            println!("a new app instance was opened with {argv:?} and the deep link event was already triggered");
            // when defining deep link schemes at runtime, you must also check `argv` here
        }))
        .plugin(tauri_plugin_updater::Builder::new().build())
        .plugin(tauri_plugin_global_shortcut::Builder::new().build())
        .plugin(tauri_plugin_http::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_deep_link::init())
        .setup(|app| {
            let app_handle = app.handle().clone();

            // Warn early if the bundled 7-Zip binary can't be found: archive
            // extraction relies on it and otherwise fails at runtime with an
            // opaque "os error 2". A common cause is a packaging path that does
            // not match Tauri's resource dir (/app/lib/${productName} on Linux).
            match seven_zip_program_name() {
                None => {
                    tracing::warn!(
                        "No bundled 7-Zip binary for this platform/architecture — archive extraction will fail."
                    );
                }
                Some(seven_zip) => match app_handle
                    .path()
                    .resolve(seven_zip, tauri::path::BaseDirectory::Resource)
                {
                    Ok(p) if p.exists() => {
                        tracing::info!("7-Zip binary found at {}", p.display());
                    }
                    Ok(p) => {
                        tracing::warn!(
                            "7-Zip binary missing at {} — archive extraction will fail. \
                             Check that '{}' is packaged into the app resource directory.",
                            p.display(),
                            seven_zip
                        );
                    }
                    Err(e) => {
                        tracing::warn!(
                            "Could not resolve 7-Zip binary path ('{}'): {} — archive extraction will fail.",
                            seven_zip,
                            e
                        );
                    }
                },
            }

            #[cfg(desktop)]
            app.deep_link().register_all()?;
            tauri::async_runtime::spawn(async move {
                if let Err(e) = image_server::start_image_server(IMAGE_SERVER_PORT).await {
                    tracing::error!("Failed to start image server: {}", e);

                    if let Err(emit_err) = app_handle.emit(
                        "image-server-error",
                        format!("Failed to start image server: {}", e),
                    ) {
                        tracing::error!("Failed to emit image server error: {}", emit_err);
                    }
                } else {
                    tracing::info!(
                        "Image server started successfully on port {}",
                        IMAGE_SERVER_PORT
                    );

                    if let Err(emit_err) =
                        app_handle.emit("image-server-ready", get_image_server_url())
                    {
                        tracing::error!("Failed to emit image server ready event: {}", emit_err);
                    }
                }
            });
            if let (Ok(icon), Some(window)) = (tauri::image::Image::from_bytes(include_bytes!("../icons/128x128.png")), app.get_webview_window("main")) { let _ = window.set_icon(icon); }
            // let tray_icon = if cfg!(target_os = "windows") { tauri::image::Image::from_bytes(include_bytes!("../icons/128x128.png"))? } else { app.default_window_icon().unwrap().clone() };
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            exit_app,
            get_username,
            download_and_unzip,
            cancel_extract,
            get_image_server_url,
            get_session_id,
            execute_with_args,
            create_symlink,
            extract_archive,
            set_window_icon,
            logger_utils::open_logs_folder,
            hotreload::set_hotreload,
            hotreload::start_window_monitoring,
            hotreload::stop_window_monitoring,
            hotreload::set_change,
            hotreload::focus_mod_manager_send_f10_return_to_game,
            hotreload::set_window_target,
            hotreload::is_game_process_running,
            hotreload::check_hotreload_dependencies
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
