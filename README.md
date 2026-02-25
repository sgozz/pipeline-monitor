# Jenkins UI

Simplified Jenkins dashboard that runs as a cross-platform system tray app.

Built with Electron + Vite + React + TypeScript + Tailwind CSS.

## Features

### Dashboard
- **Hierarchical Job View** — Jobs grouped by Folder → Job → Branch with expandable tree
- **Search** — Instant search across all job names (Cmd+K)
- **Status Filters** — Filter by Failed / Running / Unstable / Success with live counts
- **Favorites** — Star jobs for quick access at the top of the dashboard
- **Pinned Folders** — Pin folders to keep them at the top
- **Jenkins Views Grouping** — Toggle to group jobs by Jenkins Views instead of folders
- **One-Click Build Trigger** — Trigger builds directly from the dashboard
- **Build Parameters Dialog** — Automatically detects parameterized jobs and shows an input dialog with text, boolean, and choice fields before triggering

### Build History & Pipeline
- **Build History** — Last 30 builds per job with status badges, duration, progress bars, and relative timestamps
- **Pipeline Stages** — Visual stage flow with connected boxes, status colors, and durations
- **Stage Logs** — Click any pipeline stage to view its specific log output
- **Build Duration Trend** — Sparkline chart showing duration trends for the last 20 builds, color-coded by result
- **Build Comparison** — Select two builds to compare stage-by-stage with duration deltas
- **Pipeline Input Handling** — Respond to pipeline input steps directly from the app with parameter support (text, boolean, choice)

### Test Results
- **Test Report View** — View test results per build with pass/fail/skip counts and total duration
- **Expandable Suites** — Drill into test suites, see individual test cases with status icons
- **Error Details** — Failed tests show error messages and stack traces inline
- **Test Filters** — Filter by All / Failed / Passed / Skipped

### Console Output
- **Real-Time Viewer** — Live-updating console log with ANSI color support
- **Search & Highlight** — Cmd+F to search in console output with match highlighting and prev/next navigation
- **Auto-Scroll** — Automatically scrolls to bottom, pauses when you scroll up
- **Copy Output** — One-click copy of the full console text

### Notifications & Alerts
- **Desktop Notifications** — Native OS notifications when builds complete (success, failure, unstable, aborted)
- **Input Required Alerts** — Notification when a pipeline is waiting for input
- **Sound Alerts** — Optional system beep on build failure or unstable result
- **Dynamic Tray Icon** — System tray icon changes color based on global build status (green/red/yellow/blue/gray)

### Multi-Jenkins Support
- **Server Profiles** — Save, load, and delete connection profiles for multiple Jenkins servers
- **Quick Switch** — Switch between Jenkins instances from the Settings page

### Keyboard Shortcuts
| Shortcut | Action |
|----------|--------|
| `Cmd+K` | Focus search |
| `Cmd+R` | Refresh current view |
| `Cmd+1` | Go to Dashboard |
| `Cmd+2` | Go to Nodes |
| `Cmd+3` | Go to Queue |
| `Cmd+,` | Go to Settings |
| `Cmd+F` | Search in console output |
| `Escape` | Go back |

### Other
- **Nodes Overview** — Agent nodes with executor utilization bars and running build details
- **Queue Management** — View queued builds with reasons, cancel from the app
- **System Tray** — Runs in the background, click tray icon to show/hide
- **Dark / Light Theme** — Toggle between dark and light themes in Settings
- **Auto-Update** — Automatic update detection, download progress, and one-click install
- **Smart Polling** — Pauses API polling when the app is hidden or minimized, resumes on focus
- **Response Caching** — TTL-based cache with deduplication to minimize Jenkins API load

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
├── main/                           # Electron main process
│   ├── index.ts                    # App entry, tray, window management
│   ├── jenkins-api.ts              # Jenkins REST API client
│   ├── ipc-handlers.ts             # IPC bridge (main ↔ renderer)
│   ├── store.ts                    # Settings & profiles persistence
│   ├── cache.ts                    # API response cache with TTL
│   ├── notifier.ts                 # Build status monitor & notifications
│   └── updater.ts                  # Auto-updater
├── preload/
│   └── index.ts                    # Secure context bridge
└── renderer/src/                   # React frontend
    ├── App.tsx                     # Root with sidebar, routing, shortcuts
    ├── components/
    │   ├── Dashboard.tsx           # Jobs grid with filters & views
    │   ├── JobDetail.tsx           # Build history, stages, comparison
    │   ├── ConsoleOutput.tsx       # Log viewer with search
    │   ├── TestResultsView.tsx     # Test report viewer
    │   ├── StageLogView.tsx        # Per-stage log viewer
    │   ├── BuildParamsDialog.tsx   # Parameterized build dialog
    │   ├── InputDialog.tsx         # Pipeline input step modal
    │   ├── NodesView.tsx           # Agent nodes
    │   ├── QueueView.tsx           # Build queue
    │   └── SettingsPage.tsx        # Configuration & profiles
    ├── hooks/
    │   ├── useJenkins.ts           # Polling hooks with visibility pause
    │   ├── useKeyboardShortcuts.ts # Global keyboard shortcuts
    │   └── useTheme.ts            # Dark/light theme management
    └── lib/
        └── utils.ts                # Colors, formatting, ANSI parser
```

## Jenkins API

Uses the Jenkins REST API:

| Feature | API Endpoint |
|---------|-------------|
| List jobs | `GET /api/json?tree=jobs[...]` |
| Build history | `GET /job/{name}/api/json?tree=builds[...]` |
| Console output | `GET /job/{name}/{build}/consoleText` |
| Test report | `GET /job/{name}/{build}/testReport/api/json` |
| Pipeline stages | `GET /job/{name}/{build}/wfapi/describe` |
| Stage log | `GET /job/{name}/{build}/execution/node/{id}/wfapi/log` |
| Pending inputs | `GET /job/{name}/{build}/wfapi/pendingInputActions` |
| Build parameters | `GET /job/{name}/api/json?tree=property[parameterDefinitions[...]]` |
| Trigger build | `POST /job/{name}/build` |
| Trigger with params | `POST /job/{name}/buildWithParameters` |
| Stop build | `POST /job/{name}/{build}/stop` |
| Submit input | `POST /job/{name}/{build}/wfapi/inputSubmit` |
| Abort input | `POST /job/{name}/{build}/input/{id}/abort` |
| List nodes | `GET /computer/api/json` |
| Queue | `GET /queue/api/json` |
| Views | `GET /api/json?tree=views[...]` |
