fn main() {
    tauri_build::build();

    // Android 15+ 要求 ELF 二进制文件支持 16 KB 页面大小对齐
    // https://developer.android.com/guide/practices/page-sizes
    let target_os = std::env::var("CARGO_CFG_TARGET_OS").unwrap_or_default();
    if target_os == "android" {
        println!("cargo:rustc-link-arg=-Wl,-z,max-page-size=16384");
    }
}
