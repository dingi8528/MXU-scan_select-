//! Open a package-relative link clicked in the native desktop client.
//!
//! There is deliberately no HTTP equivalent: a remote WebUI must not launch
//! files on the computer running MXU merely by following a description link.

use tauri_plugin_opener::OpenerExt;

use super::local_link_path::resolve_local_link;
use super::utils::get_exe_directory;

/// Open a single existing package file or directory with its default handler.
/// No program name or command-line arguments can be supplied by the description.
#[tauri::command]
pub fn open_local_link(app: tauri::AppHandle, relative_path: String) -> Result<(), String> {
    let root = get_exe_directory().map_err(|_| "LOCAL_LINK_NOT_FOUND".to_string())?;
    let target = resolve_local_link(&root, &relative_path)?;
    let target_text = target
        .to_str()
        .ok_or_else(|| "LOCAL_LINK_INVALID".to_string())?;

    // The existing opener dependency enables `shellexecute-on-windows`: with no
    // application override it passes lpFile directly to ShellExecuteExW rather
    // than constructing `cmd /c start <description text>`.
    app.opener()
        .open_path(target_text, None::<&str>)
        .map_err(|error| {
            log::warn!("Failed to open package link {:?}: {}", target, error);
            "LOCAL_LINK_OPEN_FAILED".to_string()
        })
}
