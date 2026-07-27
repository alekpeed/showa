//! The native shell.
//!
//! Deliberately almost empty. Everything the app does -- playback, radio, album,
//! preferences -- happens in the WebView, so there are no custom commands, no
//! filesystem access and no shell execution to secure.

pub fn run() {
    tauri::Builder::default()
        // Outbound HTTP for the daily news reading. Rust-side, so it is not
        // subject to the WebView's CORS rules; the hosts it may reach are
        // pinned in capabilities/default.json.
        .plugin(tauri_plugin_http::init())
        // Silent updates. She must never see a prompt, so the frontend applies
        // these in the background and lets the new version take effect on the
        // next launch -- see src/update/useSilentUpdater.ts.
        .plugin(tauri_plugin_updater::Builder::new().build())
        .plugin(tauri_plugin_process::init())
        .run(tauri::generate_context!())
        .expect("error while running Showa Video Cabinet");
}
