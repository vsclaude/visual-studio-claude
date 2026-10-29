import type { Messages } from "../en"

export const video: Messages["video"] = {
  label: "Video",
  show: "Hiện video",
  hide: "Ẩn video",
  pick: "Chọn video",
  engine: {
    missing:
      "Để render cần engine video (Remotion và Chrome headless, khoảng 300MB). Chỉ tải một lần.",
    install: "Tải engine",
    installing: "Đang tải engine video…",
    packages: "Đang cài package…",
    browser: "Đang tải Chrome… {percent}%",
    failed: "Không cài được engine video: {error}",
  },
  state: {
    writing: "Claude đang làm…",
    bundling: "Đang chuẩn bị… {percent}%",
    rendering: "Đang render… {percent}%",
    frames: "Frame {done}/{total}",
    encoding: "Đang mã hoá… {percent}%",
    starting: "Đang bắt đầu render…",
    failed: "Render thất bại",
    notRendered: "Chưa render.",
  },
  render: "Render",
  renderAgain: "Render lại",
  cancel: "Dừng",
  sendFailure: "Nhờ Claude sửa",
  reveal: "Mở thư mục",
  remove: "Xoá",
  removeConfirm: "Chuyển thư mục của video này vào thùng rác?",
}
