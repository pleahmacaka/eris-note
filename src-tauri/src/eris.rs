use std::io::Read;
use std::path::PathBuf;

use tauri::{AppHandle, Manager};

const ERIS_ID: &str = "com.arixlab.eris.windows";
const SNAPSHOT_BYTES: u64 = 16 * 1024 * 1024;
const READABLE: [&str; 2] = ["events.json", "style.json"];
// Eris reads this exact file under Note's data folder; change both apps together
const PUBLISHED: &str = "events.json";

#[tauri::command(async)]
pub fn eris_bridge_publish(app: AppHandle, text: String) -> Result<(), String> {
    if !cfg!(windows) {
        return Ok(());
    }

    let folder = app
        .path()
        .app_data_dir()
        .map_err(|e| e.to_string())?
        .join("bridge");
    let file = folder.join(PUBLISHED);
    let staged = file.with_extension("json.tmp");

    std::fs::create_dir_all(&folder).map_err(|e| e.to_string())?;
    std::fs::write(&staged, text).map_err(|e| e.to_string())?;
    std::fs::rename(&staged, &file).map_err(|e| e.to_string())
}

#[tauri::command(async)]
pub fn eris_bridge_read(name: String) -> Result<Option<String>, String> {
    if !READABLE.contains(&name.as_str()) {
        return Err("unknown bridge file".into());
    }

    if !cfg!(windows) {
        return Ok(None);
    }

    let Some(appdata) = std::env::var_os("APPDATA") else {
        return Ok(None);
    };

    let path = PathBuf::from(appdata)
        .join(ERIS_ID)
        .join("bridge")
        .join(name);
    let Ok(file) = std::fs::File::open(path) else {
        return Ok(None);
    };
    let mut text = String::new();

    file.take(SNAPSHOT_BYTES)
        .read_to_string(&mut text)
        .map_err(|e| e.to_string())?;

    Ok(Some(text))
}
