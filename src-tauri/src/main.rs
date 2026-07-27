// Keeps a console window from appearing on Windows release builds. Harmless on
// macOS, which is the only platform this app is actually shipped for.
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

fn main() {
    showa_video_cabinet_lib::run()
}
