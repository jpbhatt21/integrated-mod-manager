// Prevents additional console window on Windows in release, DO NOT REMOVE!!
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]
#[cfg(not(dev))]
use std::env;
fn main() {
    #[cfg(not(dev))]
    {
        env::set_var("WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS", "--ignore-gpu-blocklist --enable-gpu-rasterization");
        #[cfg(not(target_os = "linux"))]
        if let Ok(exe_path) = env::current_exe() {
            // Get the directory containing the executable
            if let Some(exe_dir) = exe_path.parent() {
                // Set the current working directory to the exe's location
                if let Err(e) = env::set_current_dir(exe_dir) {
                    eprintln!("Failed to set working directory: {}", e);
                }
            }
        }
    }
    #[cfg(target_os = "linux")]
    unsafe {
        std::env::set_var("WEBKIT_DISABLE_DMABUF_RENDERER", "1");
        std::env::set_var("WEBKIT_DISABLE_COMPOSITING_MODE", "1");
    }
    wuwa_mod_manager_lib::run()
}
