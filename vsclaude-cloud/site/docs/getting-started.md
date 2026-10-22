# Getting started

Vey Studio is a desktop app for running Claude Code conversations against the
folders already on your machine, and reading what they changed — chats,
editor, diffs, commits and a terminal in one window.

## Install

Every build is **unsigned**, so each operating system warns about it in its own
way. The last step of each section is how to get past that.

### macOS

macOS 12 (Monterey) or newer, Apple Silicon or Intel. Run this in Terminal:

```bash
curl -fsSL https://raw.githubusercontent.com/vsclaude/visual-studio-claude/main/install.sh | bash
```

It picks the build for your Mac and copies it into `/Applications`.

::: tip Why not download the .dmg?
A file downloaded in a browser is quarantined, and macOS then calls the app
_"damaged"_ — which only means it is unsigned. If you did download the `.dmg`
from [Releases](https://github.com/vsclaude/visual-studio-claude/releases), run
this once after installing it:

```bash
xattr -dr com.apple.quarantine "/Applications/Vey Studio.app"
```

:::

### Windows

x64. Download the `.exe` from
[Releases](https://github.com/vsclaude/visual-studio-claude/releases) and run
it. When SmartScreen stops it, choose **More info** → **Run anyway**.

### Linux

x64. Download the AppImage from
[Releases](https://github.com/vsclaude/visual-studio-claude/releases), then:

```bash
chmod +x Vey-Studio-*.AppImage
./Vey-Studio-*.AppImage
```

It needs FUSE (`sudo apt install libfuse2` on Debian and Ubuntu).

## Claude Code

Chats run on your own `claude` — the Claude Code CLI. The app opens without
it, but you need it to chat with your own Claude accounts. If you have no
Claude account at all, you can chat on [credits](/docs/credits) instead.

## Your first chat

1. **Add a project.** Click **+** beside **Projects**, choose a folder (or drag
   one in from Finder) and click **Add folder**. A project is a folder already
   on your machine: Vey Studio works on it where it is, and never copies it.
   **From template** starts a new project instead.

   ![The Add a folder dialog, with Existing folder and From template tabs](/screenshots/add-project.png)

2. **Add a Claude account** in **Settings › Claude › Add account** — see
   [Claude accounts](/docs/accounts).
3. **Press `+`** on the project's row to open a chat, and type. See
   [Chats](/docs/chats) for everything the composer can do.

## Updating

When a new release is out, a button appears in the status bar. Click it and the
app downloads and installs the update itself. On Linux it links to the release
page instead.
