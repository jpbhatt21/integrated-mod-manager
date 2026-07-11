#[cfg(windows)]
use std::ffi::OsString;
#[cfg(windows)]
use std::os::windows::ffi::OsStringExt;
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::RwLock;
#[cfg(windows)]
use std::time::Duration;
use tauri_plugin_tracing::tracing;
#[cfg(windows)]
use winapi::um::{
    handleapi::CloseHandle,
    processthreadsapi::OpenProcess,
    psapi::{EnumProcesses, GetModuleBaseNameW},
    winnt::{PROCESS_QUERY_INFORMATION, PROCESS_VM_READ},
    winuser::{
        keybd_event, EnumWindows, GetForegroundWindow, GetWindowTextW, GetWindowThreadProcessId,
        MapVirtualKeyW, SetForegroundWindow, KEYEVENTF_KEYUP, MAPVK_VK_TO_VSC, VK_F10,
    },
};

static HOTRELOAD_ENABLED: AtomicBool = AtomicBool::new(false);
static MONITORING_ACTIVE: AtomicBool = AtomicBool::new(false);
static CHANGE: AtomicBool = AtomicBool::new(false);

static MOD_MANAGER_TITLE: &str = "Integrated Mod Manager";
static WINDOW_TARGET: RwLock<String> = RwLock::new(String::new());
static WW_TITLE: &str = "wuthering waves  ";
static ZZ_TITLE: &str = "zenlesszonezero";
static GI_TITLE: &str = "genshin impact";
static SR_TITLE: &str = "honkai: star rail";
static EF_TITLE: &str = "Endfield";

fn init_window_target() {
    if let Ok(mut window_target) = WINDOW_TARGET.write() {
        if window_target.is_empty() {
            *window_target = WW_TITLE.to_string();
        }
    }
}

#[tauri::command]
pub fn set_window_target(target_game: i32) -> Result<(), String> {
    if let Ok(mut window_target) = WINDOW_TARGET.write() {
        *window_target = match target_game {
            0 => MOD_MANAGER_TITLE.to_string(),
            1 => WW_TITLE.to_string(),
            2 => ZZ_TITLE.to_string(),
            3 => GI_TITLE.to_string(),
            4 => SR_TITLE.to_string(),
            5 => EF_TITLE.to_string(),
            _ => {
                return Err(format!(
                    "Invalid target_game value: {}. Must be 0-5",
                    target_game
                ))
            }
        };
        tracing::info!("Window target set to: {}", *window_target);
        Ok(())
    } else {
        Err("Failed to acquire write lock for window target".to_string())
    }
}

#[tauri::command]
pub fn set_hotreload(enabled: bool) -> Result<(), String> {
    HOTRELOAD_ENABLED.store(enabled, Ordering::SeqCst);
    tracing::info!("Hotreload set to: {}", enabled);
    Ok(())
}

#[tauri::command]
pub fn set_change(trigger: bool) -> Result<(), String> {
    CHANGE.store(trigger, Ordering::SeqCst);
    tracing::info!("Change trigger set to: {}", trigger);
    Ok(())
}

#[tauri::command]
pub fn start_window_monitoring() -> Result<(), String> {
    if MONITORING_ACTIVE.load(Ordering::SeqCst) {
        return Ok(());
    }

    MONITORING_ACTIVE.store(true, Ordering::SeqCst);
    tracing::info!("Starting window monitoring for hotreload");

    tauri::async_runtime::spawn(async {
        window_monitor_loop().await;
    });

    Ok(())
}

#[tauri::command]
pub fn stop_window_monitoring() -> Result<(), String> {
    MONITORING_ACTIVE.store(false, Ordering::SeqCst);
    tracing::info!("Stopped window monitoring");
    Ok(())
}

#[derive(serde::Serialize)]
pub struct DependencyStatus {
    pub has_dependencies: bool,
    pub missing_packages: Vec<String>,
    pub install_command: String,
}

#[cfg(target_os = "linux")]
fn get_install_command(packages: &[&str]) -> String {
    let os_release_path = if is_flatpak() {
        "/run/host/etc/os-release"
    } else {
        "/etc/os-release"
    };
    let os_release = std::fs::read_to_string(os_release_path).unwrap_or_default();

    let id = os_release
        .lines()
        .find(|l| l.starts_with("ID="))
        .map(|l| l.trim_start_matches("ID=").trim_matches('"'))
        .unwrap_or("");

    let id_like = os_release
        .lines()
        .find(|l| l.starts_with("ID_LIKE="))
        .map(|l| l.trim_start_matches("ID_LIKE=").trim_matches('"'))
        .unwrap_or("");
    let pkgs = packages.join(" ");

    match id {
        "arch" | "manjaro" | "endeavouros" | "cachyos" => format!("sudo pacman -S {pkgs}"),
        "ubuntu" | "debian" | "linuxmint" | "pop" => format!("sudo apt install {pkgs}"),
        "fedora" | "nobara" => format!("sudo dnf install {pkgs}"),
        "opensuse-tumbleweed" | "opensuse-leap" => format!("sudo zypper install {pkgs}"),
        "gentoo" => format!("sudo emerge {pkgs}"),
        "void" => format!("sudo xbps-install {pkgs}"),
        _ => {
            if id_like.contains("arch") {
                format!("sudo pacman -S {pkgs}")
            } else if id_like.contains("debian") || id_like.contains("ubuntu") {
                format!("sudo apt install {pkgs}")
            } else if id_like.contains("fedora") {
                format!("sudo dnf install {pkgs}")
            } else {
                format!("Please install: {pkgs}")
            }
        }
    }
}

#[cfg(target_os = "linux")]
fn is_flatpak() -> bool {
    std::path::Path::new("/.flatpak-info").exists()
}

#[cfg(target_os = "linux")]
fn hotreload_command(program: &str) -> std::process::Command {
    if is_flatpak() {
        let mut command = std::process::Command::new("flatpak-spawn");
        command.arg("--host").arg(program);
        command
    } else {
        std::process::Command::new(program)
    }
}

#[cfg(target_os = "linux")]
fn command_exists(program: &str) -> bool {
    let output = if is_flatpak() {
        std::process::Command::new("flatpak-spawn")
            .arg("--host")
            .arg("sh")
            .arg("-c")
            .arg(format!("command -v {program} >/dev/null 2>&1"))
            .output()
    } else {
        std::process::Command::new("which").arg(program).output()
    };

    output.map(|o| o.status.success()).unwrap_or(false)
}

#[cfg(target_os = "linux")]
#[tauri::command]
pub fn check_hotreload_dependencies() -> Result<DependencyStatus, String> {
    let has_xdotool = command_exists("xdotool");
    let has_ydotool = command_exists("ydotool");

    let mut missing_packages = Vec::new();
    if !has_xdotool {
        missing_packages.push("xdotool".to_string());
    }
    if !has_ydotool {
        missing_packages.push("ydotool".to_string());
    }

    let install_command = if missing_packages.is_empty() {
        String::new()
    } else {
        let pkgs_strs: Vec<&str> = missing_packages.iter().map(|s| s.as_str()).collect();
        get_install_command(&pkgs_strs)
    };

    Ok(DependencyStatus {
        has_dependencies: missing_packages.is_empty(),
        missing_packages,
        install_command,
    })
}

#[cfg(not(target_os = "linux"))]
#[tauri::command]
pub fn check_hotreload_dependencies() -> Result<DependencyStatus, String> {
    Ok(DependencyStatus {
        has_dependencies: true,
        missing_packages: vec![],
        install_command: String::new(),
    })
}

#[cfg(windows)]
fn get_focused_window_title() -> Option<String> {
    unsafe {
        let hwnd = GetForegroundWindow();
        if hwnd.is_null() {
            return None;
        }

        let mut buffer = [0u16; 512];
        let len = GetWindowTextW(hwnd, buffer.as_mut_ptr(), buffer.len() as i32);

        if len > 0 {
            let title = OsString::from_wide(&buffer[..len as usize])
                .to_string_lossy()
                .to_string();
            Some(title)
        } else {
            None
        }
    }
}

#[cfg(windows)]
fn get_focused_window_process_name() -> Option<String> {
    unsafe {
        let hwnd = GetForegroundWindow();
        if hwnd.is_null() {
            return None;
        }

        let mut process_id = 0;
        GetWindowThreadProcessId(hwnd, &mut process_id);

        if process_id == 0 {
            return None;
        }

        let process_handle =
            OpenProcess(PROCESS_QUERY_INFORMATION | PROCESS_VM_READ, 0, process_id);

        if process_handle.is_null() {
            return None;
        }

        let mut buffer = [0u16; 512];
        let len = GetModuleBaseNameW(
            process_handle,
            std::ptr::null_mut(),
            buffer.as_mut_ptr(),
            buffer.len() as u32,
        );

        CloseHandle(process_handle);

        if len > 0 {
            let process_name = OsString::from_wide(&buffer[..len as usize])
                .to_string_lossy()
                .to_string();
            Some(process_name)
        } else {
            None
        }
    }
}

#[cfg(windows)]
#[tauri::command]
pub fn is_game_process_running(game_id: i32) -> bool {
    let game_title = match game_id {
        0 => WW_TITLE,
        1 => ZZ_TITLE,
        2 => GI_TITLE,
        3 => SR_TITLE,
        4 => EF_TITLE,
        _ => return false, // Invalid game_id
    };

    check_process_running(game_title)
}

#[cfg(target_os = "linux")]
#[tauri::command]
pub fn is_game_process_running(game_id: i32) -> bool {
    linux_utils::is_game_process_running(game_id)
}

#[cfg(not(any(windows, target_os = "linux")))]
#[tauri::command]
pub fn is_game_process_running(_game_id: i32) -> bool {
    false
}

#[cfg(windows)]
fn check_process_running(title: &str) -> bool {
    unsafe {
        let mut process_ids: [u32; 1024] = [0; 1024];
        let mut bytes_needed: u32 = 0;

        if EnumProcesses(
            process_ids.as_mut_ptr(),
            (process_ids.len() * std::mem::size_of::<u32>()) as u32,
            &mut bytes_needed,
        ) == 0
        {
            tracing::error!("Failed to enumerate processes");
            return false;
        }

        let process_count = (bytes_needed as usize) / std::mem::size_of::<u32>();
        let target_title_lower = title.to_lowercase();

        for i in 0..process_count {
            let process_id = process_ids[i];
            if process_id == 0 {
                continue;
            }

            let process_handle =
                OpenProcess(PROCESS_QUERY_INFORMATION | PROCESS_VM_READ, 0, process_id);
            if process_handle.is_null() {
                continue;
            }
            CloseHandle(process_handle);

            if check_process_windows(process_id, &target_title_lower) {
                tracing::info!(
                    "Found running process with window title matching: {}",
                    title
                );
                return true;
            }
        }

        false
    }
}

#[cfg(windows)]
fn check_process_windows(process_id: u32, target_title_lower: &str) -> bool {
    use std::sync::atomic::{AtomicBool, Ordering};
    use std::sync::Arc;

    unsafe {
        let found = Arc::new(AtomicBool::new(false));
        let found_clone = Arc::clone(&found);
        let target_title = target_title_lower.to_string();
        let target_process_id = process_id;

        extern "system" fn enum_windows_proc(
            hwnd: winapi::shared::windef::HWND,
            lparam: isize,
        ) -> i32 {
            unsafe {
                let data = &*(lparam as *const (u32, String, Arc<AtomicBool>));
                let (target_process_id, target_title, found) = data;

                let mut window_process_id = 0;
                GetWindowThreadProcessId(hwnd, &mut window_process_id);

                if window_process_id == *target_process_id {
                    let mut buffer = [0u16; 512];
                    let len = GetWindowTextW(hwnd, buffer.as_mut_ptr(), buffer.len() as i32);

                    if len > 0 {
                        let window_title = OsString::from_wide(&buffer[..len as usize])
                            .to_string_lossy()
                            .to_string()
                            .to_lowercase();

                        println!(
                            "Found window: {} for process {}",
                            window_title, window_process_id
                        );

                        if window_title == *target_title {
                            found.store(true, Ordering::SeqCst);
                            return 0;
                        }
                    }
                }
                1
            }
        }

        let data = (target_process_id, target_title, found_clone);
        EnumWindows(Some(enum_windows_proc), &data as *const _ as isize);

        found.load(Ordering::SeqCst)
    }
}

#[cfg(windows)]
fn send_f10_key() -> Result<(), String> {
    let result = send_f10_with_legacy_keybd_event();
    if result.is_ok() {
        tracing::info!("F10 key sent successfully using Legacy keybd_event method");
        println!("F10 key sent successfully using Legacy keybd_event method");
        Ok(())
    } else {
        let error_msg = format!("Legacy keybd_event method failed: {:?}", result.err());
        tracing::error!("{}", error_msg);
        println!("Legacy keybd_event method failed");
        Err(error_msg)
    }
}

#[cfg(windows)]
#[tauri::command]
pub fn focus_mod_manager_send_f10_return_to_game() -> Result<(), String> {
    use std::ffi::OsStr;
    use std::os::windows::ffi::OsStrExt;
    use winapi::um::winuser::{FindWindowW, GetForegroundWindow, SetForegroundWindow};

    unsafe {
        if let Ok(window_target) = WINDOW_TARGET.read() {
            if *window_target == MOD_MANAGER_TITLE {
                let game_hwnd = GetForegroundWindow();
                let wide_title: Vec<u16> = OsStr::new(MOD_MANAGER_TITLE)
                    .encode_wide()
                    .chain(std::iter::once(0))
                    .collect();

                let mod_manager_hwnd = FindWindowW(std::ptr::null(), wide_title.as_ptr());
                if mod_manager_hwnd.is_null() {
                    return Err("Mod manager window not found".to_string());
                }

                tracing::info!("Focusing mod manager window");
                if SetForegroundWindow(mod_manager_hwnd) == 0 {
                    return Err("Failed to focus mod manager window".to_string());
                }

                std::thread::sleep(Duration::from_millis(100));

                tracing::info!("Sending F10 to mod manager");
                if let Err(e) = send_f10_key() {
                    tracing::error!("Failed to send F10 to mod manager: {}", e);
                }

                std::thread::sleep(Duration::from_millis(50));

                tracing::info!("Returning focus to game window");
                if SetForegroundWindow(game_hwnd) == 0 {
                    return Err("Failed to return focus to game window".to_string());
                }

                tracing::info!("Successfully focused mod manager, sent F10, and returned to game");
            } else {
                tracing::info!("Sending F10 to game");
                if let Err(e) = send_f10_key() {
                    tracing::error!("Failed to send F10 to game: {}", e);
                }
            }
        }
        Ok(())
    }
}

#[cfg(target_os = "linux")]
#[tauri::command]
pub fn focus_mod_manager_send_f10_return_to_game() -> Result<(), String> {
    linux_utils::focus_mod_manager_send_f10_return_to_game()
}

#[cfg(not(any(windows, target_os = "linux")))]
#[tauri::command]
pub fn focus_mod_manager_send_f10_return_to_game() -> Result<(), String> {
    Err("Focus switching is only supported on Windows and Linux".to_string())
}

#[cfg(windows)]
fn send_f10_with_legacy_keybd_event() -> Result<(), String> {
    unsafe {
        let hwnd = GetForegroundWindow();
        if hwnd.is_null() {
            return Err("No focused window found".to_string());
        }

        SetForegroundWindow(hwnd);
        std::thread::sleep(Duration::from_millis(20));

        let scan_code = MapVirtualKeyW(VK_F10 as u32, MAPVK_VK_TO_VSC) as u8;

        keybd_event(VK_F10 as u8, scan_code, 0, 0);

        std::thread::sleep(Duration::from_millis(10));

        keybd_event(VK_F10 as u8, scan_code, KEYEVENTF_KEYUP as u32, 0);

        tracing::debug!(
            "F10 sent via legacy keybd_event with scan code: {}",
            scan_code
        );
        Ok(())
    }
}

#[cfg(windows)]
fn is_game_window(title: &str, process_name: &str) -> bool {
    let title_lower = title.to_lowercase();
    let process_lower = process_name.to_lowercase();

    init_window_target();

    if let Ok(window_target) = WINDOW_TARGET.read() {
        if !window_target.is_empty()
            && (title_lower.contains(&window_target.to_lowercase())
                || process_lower.contains(&window_target.to_lowercase()))
        {
            return true;
        }
    }

    false
}

#[cfg(windows)]
async fn window_monitor_loop() {
    let mut last_game_state = false;

    while MONITORING_ACTIVE.load(Ordering::SeqCst) {
        if !HOTRELOAD_ENABLED.load(Ordering::SeqCst) {
            tokio::time::sleep(Duration::from_millis(1000)).await;
            continue;
        }

        let window_title = get_focused_window_title().unwrap_or_default();
        let process_name = get_focused_window_process_name().unwrap_or_default();
        let is_game = is_game_window(&window_title, &process_name);

        if is_game != last_game_state {
            if is_game {
                tracing::info!(
                    "Game window detected - Title: '{}', Process: '{}'",
                    window_title,
                    process_name
                );
            } else {
                tracing::info!("Game window lost focus - now focused: '{}'", window_title);
            }
            last_game_state = is_game;
        }

        if is_game && CHANGE.load(Ordering::SeqCst) {
            CHANGE.store(false, Ordering::SeqCst);
            tokio::spawn(send_f10_async());
        }

        tokio::time::sleep(Duration::from_millis(100)).await;
    }

    tracing::info!("Window monitoring stopped.");
}

#[cfg(windows)]
async fn send_f10_async() {
    tokio::time::sleep(Duration::from_millis(100)).await;
    if let Err(e) = send_f10_key() {
        tracing::error!("Failed to send F10 key: {}", e);
    }
}

#[cfg(target_os = "linux")]
async fn window_monitor_loop() {
    linux_utils::window_monitor_loop().await;
}

#[cfg(not(any(windows, target_os = "linux")))]
async fn window_monitor_loop() {}

#[cfg(target_os = "linux")]
mod linux_utils {
    use super::*;
    use std::time::Duration;
    use tauri_plugin_tracing::tracing;

    pub fn is_game_process_running(game_id: i32) -> bool {
        let title = match game_id {
            0 => WW_TITLE,
            1 => ZZ_TITLE,
            2 => GI_TITLE,
            3 => SR_TITLE,
            4 => EF_TITLE,
            _ => return false,
        };

        let output = hotreload_command("xdotool")
            .arg("search")
            .arg("--name")
            .arg(title)
            .output();

        if let Ok(output) = output {
            output.status.success() && !output.stdout.is_empty()
        } else {
            false
        }
    }

    pub fn focus_mod_manager_send_f10_return_to_game() -> Result<(), String> {
        let current_window = hotreload_command("xdotool")
            .arg("getactivewindow")
            .output()
            .map_err(|e| e.to_string())?;

        let current_window_id = String::from_utf8_lossy(&current_window.stdout)
            .trim()
            .to_string();

        let window_target = {
            let win = WINDOW_TARGET.read().unwrap();
            win.clone()
        };

        if window_target == MOD_MANAGER_TITLE {
            let output = hotreload_command("xdotool")
                .arg("search")
                .arg("--name")
                .arg(MOD_MANAGER_TITLE)
                .output()
                .map_err(|e| e.to_string())?;

            if !output.status.success() || output.stdout.is_empty() {
                return Err("Mod manager window not found".to_string());
            }

            let mod_manager_id = String::from_utf8_lossy(&output.stdout)
                .lines()
                .next()
                .unwrap_or("")
                .trim()
                .to_string();

            hotreload_command("xdotool")
                .arg("windowactivate")
                .arg("--sync")
                .arg(&mod_manager_id)
                .status()
                .map_err(|e| e.to_string())?;

            std::thread::sleep(Duration::from_millis(100));
            send_f10_key()?;
            std::thread::sleep(Duration::from_millis(50));

            if !current_window_id.is_empty() {
                hotreload_command("xdotool")
                    .arg("windowactivate")
                    .arg(&current_window_id)
                    .status()
                    .map_err(|e| e.to_string())?;
            }
        } else {
            send_f10_key()?;
        }

        Ok(())
    }

    fn send_f10_key() -> Result<(), String> {
        let status = hotreload_command("ydotool")
            .arg("key")
            .arg("68:1")
            .arg("68:0")
            .status()
            .map_err(|e| format!("Failed to run ydotool: {}", e))?;

        if status.success() {
            tracing::info!("F10 key sent successfully using ydotool");
            Ok(())
        } else {
            let error_msg = "ydotool command failed".to_string();
            tracing::error!("{}", error_msg);
            Err(error_msg)
        }
    }

    fn ensure_ydotoold() {
        let running = hotreload_command("pgrep")
            .arg("ydotoold")
            .output()
            .map(|o| o.status.success())
            .unwrap_or(false);

        if !running {
            hotreload_command("ydotoold").spawn().ok();
        }
    }

    pub async fn window_monitor_loop() {
        ensure_ydotoold();
        let mut last_game_state = false;

        while MONITORING_ACTIVE.load(Ordering::SeqCst) {
            if !HOTRELOAD_ENABLED.load(Ordering::SeqCst) {
                tokio::time::sleep(Duration::from_millis(1000)).await;
                continue;
            }

            let output = hotreload_command("xdotool").arg("getactivewindow").output();

            let active_win_id = if let Ok(output) = output {
                String::from_utf8_lossy(&output.stdout).trim().to_string()
            } else {
                String::new()
            };

            let window_title = if !active_win_id.is_empty() {
                if let Ok(out2) = hotreload_command("xdotool")
                    .arg("getwindowname")
                    .arg(&active_win_id)
                    .output()
                {
                    String::from_utf8_lossy(&out2.stdout).trim().to_string()
                } else {
                    String::new()
                }
            } else {
                String::new()
            };

            let title_lower = window_title.to_lowercase();
            init_window_target();

            let (is_game, is_imm_mode, window_target_str) =
                if let Ok(window_target) = WINDOW_TARGET.read() {
                    let wt = window_target.to_lowercase();
                    (
                        !wt.is_empty() && title_lower.contains(&wt),
                        wt == MOD_MANAGER_TITLE.to_lowercase(),
                        wt.clone(),
                    )
                } else {
                    (false, false, String::new())
                };

            if is_game != last_game_state {
                if is_game {
                    tracing::info!(
                        "[IMM-Hotreload] Window match acquired! Title: '{}' (Targetting: '{}')",
                        window_title,
                        window_target_str
                    );
                } else {
                    tracing::info!("[IMM-Hotreload] Window match lost - current window: '{}' (Targetting: '{}')", window_title, window_target_str);
                }
                last_game_state = is_game;
            }

            let should_trigger = is_game || is_imm_mode;

            if should_trigger && CHANGE.load(Ordering::SeqCst) {
                CHANGE.store(false, Ordering::SeqCst);
                tracing::info!(
                    "[IMM-Hotreload] Executing Hotreload! is_game={}, is_imm_mode={}",
                    is_game,
                    is_imm_mode
                );
                let wt_str = window_target_str.clone();

                tokio::spawn(async move {
                    tokio::time::sleep(Duration::from_millis(100)).await;

                    if is_imm_mode {
                        tracing::info!("[IMM-Hotreload] Bouncing focus to game to bypass Wayland restrictions...");

                        let mut game_win_id = None;
                        for game in &[WW_TITLE, ZZ_TITLE, GI_TITLE, SR_TITLE, EF_TITLE] {
                            if let Ok(res) = hotreload_command("xdotool")
                                .arg("search")
                                .arg("--name")
                                .arg(game)
                                .output()
                            {
                                if res.status.success() && !res.stdout.is_empty() {
                                    if let Some(id) =
                                        String::from_utf8_lossy(&res.stdout).lines().next()
                                    {
                                        game_win_id = Some(id.trim().to_string());
                                        break;
                                    }
                                }
                            }
                        }

                        if let Some(gid) = game_win_id {
                            let _ = hotreload_command("xdotool")
                                .arg("windowactivate")
                                .arg("--sync")
                                .arg(&gid)
                                .status();
                            std::thread::sleep(Duration::from_millis(100));
                            if let Err(e) = send_f10_key() {
                                tracing::error!("[IMM-Hotreload] Failed to send F10 key: {}", e);
                            }
                            std::thread::sleep(Duration::from_millis(50));

                            let alt_tab_status = hotreload_command("ydotool")
                                .arg("key")
                                .arg("56:1")
                                .arg("15:1")
                                .arg("15:0")
                                .arg("56:0")
                                .status();

                            if let Err(e) = alt_tab_status {
                                tracing::error!(
                                    "[IMM-Hotreload] Failed to Alt+Tab back to IMM: {:?}",
                                    e
                                );
                            } else {
                                tracing::info!("[IMM-Hotreload] Successfully bounced focus to game, injected F10, and Alt+Tabbed back!");
                            }
                        } else {
                            tracing::error!("[IMM-Hotreload] Could not find running game window to bounce focus!");
                        }
                    } else {
                        if let Err(e) = send_f10_key() {
                            tracing::error!("[IMM-Hotreload] Failed to send F10 key: {}", e);
                        } else {
                            tracing::info!("[IMM-Hotreload] Successfully injected F10 into already-focused window: {}", wt_str);
                        }
                    }
                });
            }

            tokio::time::sleep(Duration::from_millis(100)).await;
        }

        tracing::info!("Window monitoring stopped.");
    }
}
