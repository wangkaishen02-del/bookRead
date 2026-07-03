# BookRead

BookRead is a macOS reading planner app built with Tauri 2 and a lightweight HTML/CSS/JS frontend.

## Development

Prerequisites:

- Node.js 22+
- Rust toolchain
- Xcode Command Line Tools

Install dependencies:

```bash
npm install
```

Start the app in development mode:

```bash
npm run tauri:dev
```

## Build macOS App

Build a macOS `.app` bundle and `.dmg` package:

```bash
npm run tauri:build
```

Build artifacts will be generated under `src-tauri/target/release/bundle/`.
