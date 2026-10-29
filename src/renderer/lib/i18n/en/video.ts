/** Videos made in a chat (`/video`) — the column beside its transcript. */
export const video = {
  label: "Video",
  show: "Show video",
  hide: "Hide video",
  pick: "Which video",
  engine: {
    missing:
      "Rendering needs the video engine (Remotion and a headless Chrome, about 300MB). It is downloaded once.",
    install: "Download engine",
    installing: "Downloading the video engine…",
    packages: "Installing packages…",
    browser: "Downloading Chrome… {percent}%",
    failed: "Could not install the video engine: {error}",
  },
  state: {
    writing: "Claude is working…",
    bundling: "Preparing… {percent}%",
    rendering: "Rendering… {percent}%",
    frames: "Frame {done} of {total}",
    encoding: "Encoding… {percent}%",
    starting: "Starting the render…",
    failed: "The render failed",
    notRendered: "Not rendered yet.",
  },
  render: "Render",
  renderAgain: "Render again",
  cancel: "Stop",
  sendFailure: "Ask Claude to fix it",
  reveal: "Show folder",
  remove: "Delete",
  removeConfirm: "Move this video's folder to the trash?",
}
