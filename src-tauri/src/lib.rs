//! The native shell.
//!
//! Deliberately almost empty. Everything the app does -- playback, radio, album,
//! preferences -- happens in the WebView, so there are no custom commands, no
//! filesystem access and no shell execution to secure.

pub fn run() {
    tauri::Builder::default()
        .run(tauri::generate_context!())
        .expect("error while running Showa Video Cabinet");
}
