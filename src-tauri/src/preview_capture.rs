use once_cell::sync::Lazy;
use serde::{Deserialize, Serialize};
use std::path::{Path, PathBuf};
use std::sync::Mutex;
use std::time::{Duration, SystemTime, UNIX_EPOCH};

const PREVIEW_EXTENSIONS: [&str; 5] = ["png", "jpg", "jpeg", "webp", "gif"];

#[derive(Deserialize)]
pub struct ScreenCaptureCrop {
    x: i32,
    y: i32,
    width: u32,
    height: u32,
}

#[derive(Serialize, Clone)]
pub struct CaptureBounds {
    left: i32,
    top: i32,
    width: u32,
    height: u32,
}

#[derive(Clone)]
struct StoredWindowState {
    x: i32,
    y: i32,
    width: u32,
    height: u32,
}

static WINDOW_STATE_BEFORE_CAPTURE: Lazy<Mutex<Option<StoredWindowState>>> =
    Lazy::new(|| Mutex::new(None));

fn timestamp() -> u128 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap_or_default()
        .as_millis()
}

#[cfg(windows)]
fn game_title_fragment(game: &str) -> &'static str {
    match game {
        "ZZ" => "zenlesszonezero",
        "GI" => "genshin impact",
        "SR" => "honkai: star rail",
        "EF" => "endfield",
        _ => "wuthering waves",
    }
}

#[cfg(windows)]
fn find_game_window(game: &str) -> Result<winapi::shared::windef::HWND, String> {
    use std::ffi::OsString;
    use std::os::windows::ffi::OsStringExt;
    use winapi::shared::windef::HWND;
    use winapi::um::winuser::{EnumWindows, GetWindowTextW, IsWindowVisible};

    struct FindData {
        target: String,
        hwnd: HWND,
    }

    unsafe extern "system" fn enum_window(hwnd: HWND, data_ptr: isize) -> i32 {
        let data = &mut *(data_ptr as *mut FindData);
        if IsWindowVisible(hwnd) == 0 {
            return 1;
        }

        let mut buffer = [0u16; 512];
        let length = GetWindowTextW(hwnd, buffer.as_mut_ptr(), buffer.len() as i32);
        if length <= 0 {
            return 1;
        }

        let title = OsString::from_wide(&buffer[..length as usize])
            .to_string_lossy()
            .to_lowercase();
        if title.contains(&data.target) {
            data.hwnd = hwnd;
            return 0;
        }
        1
    }

    let mut data = FindData {
        target: game_title_fragment(game).to_string(),
        hwnd: std::ptr::null_mut(),
    };
    unsafe {
        EnumWindows(Some(enum_window), &mut data as *mut _ as isize);
    }

    if data.hwnd.is_null() {
        Err("Game window not found. Open the game before starting a capture.".to_string())
    } else {
        Ok(data.hwnd)
    }
}

#[cfg(windows)]
fn window_bounds(hwnd: winapi::shared::windef::HWND) -> Result<CaptureBounds, String> {
    use winapi::shared::windef::RECT;
    use winapi::um::winuser::GetWindowRect;

    let mut rect = RECT {
        left: 0,
        top: 0,
        right: 0,
        bottom: 0,
    };
    unsafe {
        if GetWindowRect(hwnd, &mut rect) == 0 {
            return Err("Could not read the game window bounds.".to_string());
        }
    }

    Ok(CaptureBounds {
        left: rect.left,
        top: rect.top,
        width: (rect.right - rect.left).max(1) as u32,
        height: (rect.bottom - rect.top).max(1) as u32,
    })
}

#[cfg(windows)]
fn screen_for_point(x: i32, y: i32) -> Result<screenshots::Screen, String> {
    screenshots::Screen::all()
        .map_err(|error| error.to_string())?
        .into_iter()
        .find(|screen| {
            let info = &screen.display_info;
            x >= info.x
                && x < info.x + info.width as i32
                && y >= info.y
                && y < info.y + info.height as i32
        })
        .ok_or_else(|| "No display was found for the selected area.".to_string())
}

#[cfg(windows)]
fn restore_main_window(app_handle: &tauri::AppHandle) {
    use tauri::Manager;

    if let Some(window) = app_handle.get_webview_window("main") {
        let _ = window.set_ignore_cursor_events(false);
        let _ = window.set_always_on_top(false);
        let _ = window.unminimize();
        let _ = window.show();
        if let Ok(mut stored_state) = WINDOW_STATE_BEFORE_CAPTURE.lock() {
            if let Some(stored) = stored_state.take() {
                let _ = window.set_position(tauri::PhysicalPosition::new(stored.x, stored.y));
                let _ = window.set_size(tauri::PhysicalSize::new(stored.width, stored.height));
            }
        }
        let _ = window.set_focus();
    }
}

#[cfg(windows)]
#[tauri::command]
pub fn enter_preview_capture_overlay(
    app_handle: tauri::AppHandle,
    game: String,
) -> Result<CaptureBounds, String> {
    use tauri::Manager;
    use winapi::um::winuser::SetForegroundWindow;

    let game_window = find_game_window(&game)?;
    let bounds = window_bounds(game_window)?;
    let main_window = app_handle
        .get_webview_window("main")
        .ok_or_else(|| "Main window not found.".to_string())?;

    if let (Ok(position), Ok(size)) = (main_window.outer_position(), main_window.outer_size()) {
        if let Ok(mut stored_state) = WINDOW_STATE_BEFORE_CAPTURE.lock() {
            if stored_state.is_none() {
                *stored_state = Some(StoredWindowState {
                    x: position.x,
                    y: position.y,
                    width: size.width,
                    height: size.height,
                });
            }
        }
    }

    unsafe {
        SetForegroundWindow(game_window);
    }
    std::thread::sleep(Duration::from_millis(200));

    main_window
        .set_always_on_top(true)
        .map_err(|error| error.to_string())?;
    main_window
        .set_position(tauri::PhysicalPosition::new(bounds.left, bounds.top))
        .map_err(|error| error.to_string())?;
    main_window
        .set_size(tauri::PhysicalSize::new(bounds.width, bounds.height))
        .map_err(|error| error.to_string())?;
    main_window.show().map_err(|error| error.to_string())?;
    main_window.set_focus().map_err(|error| error.to_string())?;

    Ok(bounds)
}

#[cfg(not(windows))]
#[tauri::command]
pub fn enter_preview_capture_overlay(
    _app_handle: tauri::AppHandle,
    _game: String,
) -> Result<CaptureBounds, String> {
    Err("Screen capture is currently supported on Windows only.".to_string())
}

#[cfg(windows)]
#[tauri::command]
pub fn pause_preview_capture_overlay(
    app_handle: tauri::AppHandle,
    game: String,
) -> Result<(), String> {
    use tauri::Manager;
    use winapi::um::winuser::{GetAsyncKeyState, SetForegroundWindow, VK_RBUTTON};

    let game_window = find_game_window(&game)?;
    let main_window = app_handle
        .get_webview_window("main")
        .ok_or_else(|| "Main window not found.".to_string())?;
    main_window
        .set_ignore_cursor_events(true)
        .map_err(|error| error.to_string())?;
    unsafe {
        SetForegroundWindow(game_window);
    }

    loop {
        let pressed = unsafe { (GetAsyncKeyState(VK_RBUTTON) as u16 & 0x8000) != 0 };
        if !pressed {
            break;
        }
        std::thread::sleep(Duration::from_millis(16));
    }

    main_window
        .set_ignore_cursor_events(false)
        .map_err(|error| error.to_string())?;
    main_window.set_focus().map_err(|error| error.to_string())?;
    Ok(())
}

#[cfg(not(windows))]
#[tauri::command]
pub fn pause_preview_capture_overlay(
    _app_handle: tauri::AppHandle,
    _game: String,
) -> Result<(), String> {
    Ok(())
}

#[cfg(windows)]
#[tauri::command]
pub fn capture_preview_screen_region(
    app_handle: tauri::AppHandle,
    crop: ScreenCaptureCrop,
) -> Result<String, String> {
    use tauri::Manager;

    if let Some(window) = app_handle.get_webview_window("main") {
        let _ = window.hide();
    }
    std::thread::sleep(Duration::from_millis(180));

    let result = (|| {
        let screen = screen_for_point(crop.x, crop.y)?;
        let info = &screen.display_info;
        let image = screen
            .capture_area(
                crop.x - info.x,
                crop.y - info.y,
                crop.width.max(1),
                crop.height.max(1),
            )
            .map_err(|error| error.to_string())?;
        let stage_path =
            std::env::temp_dir().join(format!("imm-preview-capture-{}.png", timestamp()));
        image.save(&stage_path).map_err(|error| error.to_string())?;
        Ok(stage_path.to_string_lossy().to_string())
    })();

    restore_main_window(&app_handle);
    result
}

#[cfg(not(windows))]
#[tauri::command]
pub fn capture_preview_screen_region(
    _app_handle: tauri::AppHandle,
    _crop: ScreenCaptureCrop,
) -> Result<String, String> {
    Err("Screen capture is currently supported on Windows only.".to_string())
}

#[cfg(windows)]
#[tauri::command]
pub fn cancel_preview_capture_overlay(app_handle: tauri::AppHandle) -> Result<(), String> {
    restore_main_window(&app_handle);
    Ok(())
}

#[cfg(not(windows))]
#[tauri::command]
pub fn cancel_preview_capture_overlay(_app_handle: tauri::AppHandle) -> Result<(), String> {
    Ok(())
}

fn existing_previews(mod_directory: &Path) -> Vec<PathBuf> {
    PREVIEW_EXTENSIONS
        .iter()
        .map(|extension| mod_directory.join(format!("preview.{}", extension)))
        .filter(|path| path.is_file())
        .collect()
}

fn backup_previews(mod_directory: &Path, previews: &[PathBuf]) -> Result<Option<PathBuf>, String> {
    if previews.is_empty() {
        return Ok(None);
    }

    let backup_directory = mod_directory
        .join("_preview_backups")
        .join(timestamp().to_string());
    std::fs::create_dir_all(&backup_directory).map_err(|error| error.to_string())?;
    for preview in previews {
        if let Some(file_name) = preview.file_name() {
            std::fs::copy(preview, backup_directory.join(file_name))
                .map_err(|error| error.to_string())?;
        }
    }
    Ok(Some(backup_directory))
}

fn validated_stage_path(stage_path: String) -> Result<PathBuf, String> {
    let stage = PathBuf::from(stage_path);
    let file_name = stage
        .file_name()
        .and_then(|name| name.to_str())
        .unwrap_or_default();
    if stage.parent() != Some(std::env::temp_dir().as_path())
        || !file_name.starts_with("imm-preview-capture-")
        || stage.extension().and_then(|extension| extension.to_str()) != Some("png")
    {
        return Err("Invalid capture staging path.".to_string());
    }
    Ok(stage)
}

#[cfg(windows)]
#[tauri::command]
pub fn save_mod_preview_stage(
    stage_path: String,
    mod_path: String,
) -> Result<Option<String>, String> {
    let stage = validated_stage_path(stage_path)?;
    if !stage.is_file() {
        return Err("Captured image not found.".to_string());
    }

    let mod_directory = Path::new(&mod_path);
    if !mod_directory.is_dir() {
        return Err("Mod folder not found.".to_string());
    }

    let image = image::open(&stage).map_err(|error| error.to_string())?;
    let final_image = if image.height() > 1200 {
        let height = 1200;
        let width = ((image.width() as f32 / image.height() as f32) * height as f32)
            .round()
            .max(1.0) as u32;
        image.resize(width, height, image::imageops::FilterType::Lanczos3)
    } else {
        image
    };

    let pending_path = mod_directory.join(format!(".preview-capture-{}.png", timestamp()));
    final_image
        .save(&pending_path)
        .map_err(|error| error.to_string())?;

    let previews = existing_previews(mod_directory);
    let backup = backup_previews(mod_directory, &previews)?;
    for preview in previews {
        std::fs::remove_file(preview).map_err(|error| error.to_string())?;
    }

    let destination = mod_directory.join("preview.png");
    std::fs::rename(&pending_path, &destination).map_err(|error| error.to_string())?;
    let _ = std::fs::remove_file(stage);

    Ok(backup.map(|path| path.to_string_lossy().to_string()))
}

#[cfg(not(windows))]
#[tauri::command]
pub fn save_mod_preview_stage(
    _stage_path: String,
    _mod_path: String,
) -> Result<Option<String>, String> {
    Err("Screen capture is currently supported on Windows only.".to_string())
}

#[tauri::command]
pub fn discard_preview_capture_stage(stage_path: String) -> Result<(), String> {
    let stage = validated_stage_path(stage_path)?;
    if stage.exists() {
        std::fs::remove_file(stage).map_err(|error| error.to_string())?;
    }
    Ok(())
}

#[cfg(all(test, windows))]
mod tests {
    use super::*;
    use image::{ImageBuffer, Rgba};

    #[test]
    fn saving_a_capture_backs_up_the_previous_preview() {
        let mod_directory = tempfile::tempdir().unwrap();
        let old_preview = mod_directory.path().join("preview.png");
        ImageBuffer::from_pixel(2, 2, Rgba([10u8, 20, 30, 255]))
            .save(&old_preview)
            .unwrap();

        let stage = std::env::temp_dir().join(format!(
            "imm-preview-capture-test-{}-{}.png",
            std::process::id(),
            timestamp()
        ));
        ImageBuffer::from_pixel(4, 3, Rgba([40u8, 50, 60, 255]))
            .save(&stage)
            .unwrap();

        let backup = save_mod_preview_stage(
            stage.to_string_lossy().to_string(),
            mod_directory.path().to_string_lossy().to_string(),
        )
        .unwrap()
        .map(PathBuf::from)
        .unwrap();

        assert!(backup.join("preview.png").is_file());
        let saved_preview = image::open(mod_directory.path().join("preview.png")).unwrap();
        assert_eq!((saved_preview.width(), saved_preview.height()), (4, 3));
        assert!(!stage.exists());
    }

    #[test]
    fn discard_rejects_paths_outside_the_capture_staging_area() {
        let unrelated_file = tempfile::NamedTempFile::new().unwrap();
        let path = unrelated_file.path().to_string_lossy().to_string();
        assert!(discard_preview_capture_stage(path).is_err());
        assert!(unrelated_file.path().is_file());
    }
}
