# ICGC FMT Live Word

<div align="center">

![ICGC FMT Live Word](resources/icon.png)

**AI-Powered Scripture & Lyrics Display for Live Church Services**

[![Version](https://img.shields.io/badge/version-1.4.2-blue.svg)](https://github.com/Darkbeast-glitch/icgc-live-transcribe/releases)
[![Platform](https://img.shields.io/badge/platform-Windows%20%7C%20macOS-lightgrey.svg)](#installation)
[![License](https://img.shields.io/badge/license-MIT-green.svg)](LICENSE)

[Features](#features) • [Installation](#installation) • [Quick Start](#quick-start) • [Documentation](#documentation) • [Contributing](#contributing)

</div>

---

## Overview

**ICGC FMT Live Word** is a powerful Electron desktop application designed for **International Central Gospel Church (ICGC) Fidel Memorial Temple** and similar churches to display Bible scriptures and song lyrics on projectors during live services.

### What Makes It Special?

The app's standout feature is **AI-powered live scripture detection** — it listens to the preacher through a microphone, automatically detects scripture references from speech in real-time, and queues them for instant one-click display.

---

## Features

### 🎤 **Live Speech-to-Text Transcription**
- Real-time transcription using Deepgram API
- Automatic detection of scripture references from spoken words
- Ghanaian accent-aware detection patterns
- Works with natural speech: "the book of John", "turn to Romans 8"

### ⚡ **Auto Live Mode** (New in v1.4.2)
- Toggle to automatically send detected scriptures to the projector
- No manual clicking required during live services
- Visual indicator (green = auto, gray = manual)
- Perfect for fast-paced preaching

### 📖 **Multi-Translation Bible Support**
- **12+ Bible translations**: KJV, NIV, ESV, NLT, NKJV, NASB, and more
- Offline mode with downloadable KJV database
- Fallback to online APIs when offline data unavailable
- Switch translations on-the-fly without interrupting the service

### 🎵 **Song Lyrics Management**
- Full-text search with FTS5 (Fast Text Search)
- Smart Search using AI embeddings (Xenova/all-MiniLM-L6-v2)
- Lyrics fetching from multiple online sources
- Organize songs into Service Plans

### 📋 **Service Planning**
- Pre-build ordered service plans before the event
- Drag-and-drop reordering
- Mix scriptures, songs, media, and notes
- Save and load plans for recurring services

### 🖥️ **Dual-Display System**
- **Operator Console**: Full control with preview panel
- **Projector Output**: Clean, distraction-free display for congregation
- Program Preview + Live Display workflow (EasyWorship-inspired)
- Keyboard shortcuts for quick navigation (← → for verse stepping)

### 🎨 **Customizable Themes**
- Multiple background themes for projector display
- Adjustable font sizes (Small, Medium, Large, Extra Large)
- Custom background images
- Background library management
- Dark mode operator interface

### 📺 **vMix Integration**
- WebSocket server on port **7788**
- XML and JSON DataSource endpoints
- Real-time sync with broadcast software
- Title overlays for live streaming

### 📝 **Additional Tools**
- **Notes Panel**: Sermon notes and announcements with rich text
- **Media Panel**: Images and videos for display
- **History**: Track all displayed content during the service
- **Timer**: Session timer and countdown features
- **Queue System**: Build a queue of verses to present in order

---

## Screenshots

### Operator Console
*Full control interface with live transcript, scripture browser, and preview panels*

### Projector Display
*Clean, high-contrast display optimized for large screens and distance viewing*

### Auto Live Toggle
*One-click toggle to enable automatic scripture presentation*

---

## Installation

### System Requirements

- **Windows**: Windows 10 or later (64-bit)
- **macOS**: macOS 10.13 (High Sierra) or later
- **RAM**: 4GB minimum, 8GB recommended
- **Storage**: 500MB for app + 100MB for offline Bible data
- **Internet**: Required for initial setup and online features

### Download

Download the latest release for your platform:

#### Windows
```
ICGC-FMT-Live-Word-Setup-1.4.2.exe
```

#### macOS
```
ICGC-FMT-Live-Word-1.4.2.dmg
```

👉 **[Download Latest Release](https://github.com/Darkbeast-glitch/icgc-live-transcribe/releases/latest)**

### Installation Steps

#### Windows
1. Download `ICGC-FMT-Live-Word-Setup-1.4.2.exe`
2. Run the installer
3. Follow the installation wizard
4. Launch from Desktop shortcut or Start Menu

#### macOS
1. Download `ICGC-FMT-Live-Word-1.4.2.dmg`
2. Open the DMG file
3. Drag the app to Applications folder
4. Right-click and select "Open" (first time only, due to Gatekeeper)

---

## Quick Start

### First-Time Setup

1. **Launch the app** — Two windows will open:
   - **Operator window**: Your control center
   - **Projector window**: Move this to your second display/projector

2. **Configure Deepgram API** (for live transcription):
   - Click the "Live Transcript" tab
   - Click the key icon
   - Get a free API key at [console.deepgram.com](https://console.deepgram.com)
   - Paste and save (200 hours/month free, no credit card)

3. **Download Offline Bible** (optional but recommended):
   - Click ⚙️ Settings
   - Scroll to "Bible Management"
   - Click "Download KJV for offline use"
   - Wait for download to complete

4. **Select Bible Translation**:
   - Top bar dropdown (default: KJV)
   - Choose your preferred translation

### Basic Workflow

#### Manual Scripture Display
1. Go to **Scripture** tab
2. Type a reference in the search bar: `John 3:16`
3. Click a verse to **Preview** it (appears in Program Preview)
4. Click **▶ Take Live** to send it to the projector

#### Live Transcript + Auto Detection
1. Go to **Live Transcript** tab
2. Click **Start Transcribing**
3. Allow microphone access
4. As the preacher speaks, detected scriptures appear in the right panel
5. Click any detected scripture to send it live

#### Auto Live Mode (v1.4.2+)
1. Enable the **Auto Live** toggle in the Recent detections panel
2. When enabled (green), detected scriptures automatically go live
3. No clicking required — perfect for fast preaching!

#### Displaying Songs
1. Go to **Songs** tab
2. Search for a song by title or lyrics
3. Click **Present** to display lyrics slide-by-slide

#### Building a Service Plan
1. Go to **Service Plan** tab
2. Add items: scriptures, songs, notes
3. Click **Present** next to each item during the service
4. Export/Import plans for reuse

---

## Documentation

### Project Structure

```
church-display/
├── electron/
│   ├── main/              # Main process (Node.js)
│   │   ├── index.ts       # Entry point
│   │   ├── database.ts    # SQLite setup
│   │   └── handlers/      # IPC handlers
│   │       ├── bible.ts   # Verse fetching
│   │       ├── songs.ts   # Song CRUD
│   │       ├── whisper.ts # Speech-to-text
│   │       ├── semantic.ts# Smart search
│   │       └── vmix-output.ts # vMix integration
│   └── preload/           # Preload scripts
│       └── index.ts       # IPC bridge
├── src/
│   └── renderer/          # React apps
│       ├── operator/      # Operator console
│       │   ├── App.tsx
│       │   └── components/
│       ├── projector/     # Projector display
│       │   └── App.tsx
│       └── shared/        # Shared code
│           ├── types.ts
│           ├── themes.ts
│           └── scriptureDetector.ts
├── resources/             # App icons
├── CLAUDE.md             # AI assistant guidance
├── DESIGN.md             # Visual system spec
├── PRODUCT.md            # Product requirements
└── package.json
```

### Key Technologies

- **Electron 31** - Cross-platform desktop framework
- **React 18** - UI library
- **TypeScript** - Type-safe development
- **Vite** - Fast build tool
- **Tailwind CSS** - Utility-first styling
- **SQLite (better-sqlite3)** - Local database
- **Deepgram API** - Live speech-to-text
- **Xenova Transformers** - Local AI models
- **WebSocket** - vMix real-time communication

### API Integrations

#### Bible APIs
- **bible-api.com** - Free, no key required (KJV, WEB, ASV, etc.)
- **API.Bible** - NIV, NLT, NKJV (API key hardcoded)
- **ESV API** - English Standard Version (API key hardcoded)

#### Speech-to-Text
- **Deepgram** - Real-time transcription (user-provided API key)

### Data Storage

- **Location**: `<userData>/data/church.db`
  - Windows: `%APPDATA%/icgc-fmt-live-word/data/`
  - macOS: `~/Library/Application Support/icgc-fmt-live-word/data/`

- **Tables**:
  - `bible_verses` - Offline scripture cache
  - `songs` - Song library
  - `songs_fts` - Full-text search index
  - `service_history` - Display history log

---

## Development

### Prerequisites

- **Node.js** 18+ and npm
- **Git**
- **Python** (for node-gyp, required by better-sqlite3)

### Setup

```bash
# Clone the repository
git clone https://github.com/Darkbeast-glitch/icgc-live-transcribe.git
cd icgc-live-transcribe

# Install dependencies
npm install

# Rebuild native modules for Electron
npm run postinstall
```

### Development Commands

```bash
# Start dev server (hot reload)
npm run dev

# Build for production
npm run build

# Build type definitions only
npx tsc --noEmit

# Package for current platform
npm run package

# Package for Windows (NSIS installer)
npm run package:win

# Package for macOS (DMG)
npm run package:mac
```

### Project Guidelines

- **Read CLAUDE.md** before making changes — contains architectural decisions and conventions
- **No test suite** — `npm run build` is the verification step
- **Preview ≠ Live** — Never auto-send content to projector without explicit operator action
- **Match EasyWorship workflow** where it makes sense (familiar to church AV teams)
- **Tailwind utilities only** — No CSS custom properties, use exact hex values from DESIGN.md

---

## vMix Integration

### Setup

1. In vMix, add a **Data Source** input:
   - Type: **Web / HTTP**
   - URL: `http://localhost:7788/datasource.xml` (or `.json`)

2. The app automatically starts the server on port **7788**

3. Use vMix Title Designer to map fields:
   - `text` - Scripture text or lyrics
   - `reference` - Scripture reference (e.g., "John 3:16")
   - `translation` - Bible version

### Available Endpoints

- `http://localhost:7788/datasource.xml` - XML format
- `http://localhost:7788/datasource.json` - JSON format
- WebSocket: `ws://localhost:7788` - Real-time updates

---

## Keyboard Shortcuts

| Key | Action |
|-----|--------|
| `←` / `Page Up` | Previous verse (when verse is live) |
| `→` / `Page Down` | Next verse (when verse is live) |
| `Escape` | Close modals |
| `Enter` | Submit search / Take Live |

---

## Troubleshooting

### "Property 'api' does not exist on type 'Window'" error
This is a false positive from standalone TypeScript. The build process resolves it correctly. Ignore or run `npm run build` instead of `npx tsc`.

### Black projector window in vMix/OBS
Hardware acceleration is disabled by default to prevent this. Do not remove `app.disableHardwareAcceleration()` from `electron/main/index.ts`.

### Microphone not working
- Check system permissions (Settings → Privacy → Microphone)
- Verify Deepgram API key is valid
- Check internet connection

### Offline Bible not working
Download the KJV database from Settings → Bible Management. Without it, the app requires internet for scripture lookups.

### vMix not receiving data
- Verify the app is running
- Check that port 7788 is not blocked by firewall
- Use `http://localhost:7788/datasource.xml` as the URL in vMix

---

## Contributing

Contributions are welcome! Here's how:

1. **Fork** the repository
2. **Create** a feature branch: `git checkout -b feature/amazing-feature`
3. **Commit** your changes: `git commit -m 'feat: add amazing feature'`
4. **Push** to the branch: `git push origin feature/amazing-feature`
5. **Open** a Pull Request

### Contribution Guidelines

- Read `CLAUDE.md` for architectural context
- Follow existing code style (Tailwind utilities, TypeScript)
- Test on both Windows and macOS if possible
- Keep PRs focused on a single feature/fix

---

## Roadmap

### Upcoming Features
- [ ] Multi-language support (Twi, Ga, French)
- [ ] Cloud sync for songs and service plans
- [ ] NDI output support
- [ ] Mobile remote control app
- [ ] Advanced presentation animations
- [ ] Import from EasyWorship/ProPresenter

---

## Support

### Get Help

- **Issues**: [GitHub Issues](https://github.com/Darkbeast-glitch/icgc-live-transcribe/issues)
- **Discussions**: [GitHub Discussions](https://github.com/Darkbeast-glitch/icgc-live-transcribe/discussions)
- **Email**: support@icgcfmt.org (if applicable)

### Reporting Bugs

When reporting bugs, please include:
- OS version (Windows 10/11, macOS version)
- App version (check About in Settings)
- Steps to reproduce
- Screenshots if applicable
- Error messages from DevTools (Ctrl+Shift+I / Cmd+Option+I)

---

## Acknowledgments

- **ICGC FMT** - For inspiration and real-world testing
- **EasyWorship** - For defining the mental model church AV teams know
- **Deepgram** - For exceptional speech-to-text API
- **Bible APIs** - For providing free scripture access
- **Xenova Transformers** - For local AI models

---

## License

This project is licensed under the **MIT License** - see the [LICENSE](LICENSE) file for details.

---

## Authors

**Julius Boakye** - *Lead Developer*
- GitHub: [@Darkbeast-glitch](https://github.com/Darkbeast-glitch)

---

<div align="center">

**Built with ❤️ for the Church**

⭐ Star this repo if you find it useful!

[Report Bug](https://github.com/Darkbeast-glitch/icgc-live-transcribe/issues) • [Request Feature](https://github.com/Darkbeast-glitch/icgc-live-transcribe/issues) • [Releases](https://github.com/Darkbeast-glitch/icgc-live-transcribe/releases)

</div>
