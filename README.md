# Jenkins UI

Simplified Jenkins dashboard that runs as a cross-platform system tray app.

Built with Electron + Vite + React + TypeScript + Tailwind CSS.

## Features

- **Dashboard**: All jobs grouped by folder with status indicators, search, and one-click build trigger
- **Build History**: Per-job build history with duration, status, and progress bars for running builds
- **Console Output**: Real-time console log viewer with ANSI color support and auto-scroll
- **Nodes Overview**: Agent nodes with executor utilization and running build details
- **Queue Management**: View and cancel queued builds
- **System Tray**: Runs in the background, accessible from the system tray icon

## Quick Start

```bash
# Install dependencies
npm install

# Run in development mode
npm run dev

# Build for production
npm run build

# Package as distributable
npm run dist
```

## Configuration

On first launch, the app opens the Settings page. Configure:

1. **Jenkins URL**: Your Jenkins server URL (e.g., `https://jenkins.example.com`)
2. **Username**: Your Jenkins username or email
3. **API Token**: Generate at Jenkins → User → Configure → API Token

## Architecture

```
src/
├── main/                    # Electron main process
│   ├── index.ts             # App entry, tray, window management
│   ├── jenkins-api.ts       # Jenkins REST API client
│   ├── ipc-handlers.ts      # IPC bridge (main ↔ renderer)
│   └── store.ts             # Settings persistence (electron-store)
├── preload/
│   └── index.ts             # Secure context bridge
└── renderer/src/            # React frontend
    ├── App.tsx              # Root with sidebar navigation
    ├── components/
    │   ├── Dashboard.tsx    # Jobs grid with folders
    │   ├── JobDetail.tsx    # Build history
    │   ├── ConsoleOutput.tsx# Log viewer
    │   ├── NodesView.tsx    # Agent nodes
    │   ├── QueueView.tsx    # Build queue
    │   └── SettingsPage.tsx # Configuration
    ├── hooks/
    │   └── useJenkins.ts    # Polling hooks
    └── lib/
        └── utils.ts         # Colors, formatting, ANSI parser
```

## Jenkins API

Uses the same REST API endpoints as the `mcp-jenkins` MCP server:

| Feature | API Endpoint |
|---------|-------------|
| List jobs | `GET /api/json?tree=jobs[...]` |
| Build history | `GET /job/{name}/api/json?tree=builds[...]` |
| Console output | `GET /job/{name}/{build}/consoleText` |
| Trigger build | `POST /job/{name}/build` |
| Stop build | `POST /job/{name}/{build}/stop` |
| List nodes | `GET /computer/api/json` |
| Queue | `GET /queue/api/json` |
