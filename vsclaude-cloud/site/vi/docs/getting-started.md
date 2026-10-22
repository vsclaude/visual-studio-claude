# Bắt đầu

VS Claude là ứng dụng desktop để chạy các cuộc chat Claude Code trên những thư
mục đã có sẵn trong máy bạn, và xem lại chúng đã thay đổi gì: chat, editor,
diff, commit và terminal trong cùng một cửa sổ.

## Cài đặt

Các bản build đều **chưa được ký (unsigned)**, nên mỗi hệ điều hành sẽ cảnh báo
theo cách riêng. Bước cuối của mỗi phần dưới đây là cách vượt qua cảnh báo đó.

### macOS

macOS 12 (Monterey) trở lên, chip Apple Silicon hoặc Intel. Chạy lệnh này trong
Terminal:

```bash
curl -fsSL https://raw.githubusercontent.com/vsclaude/visual-studio-claude/main/install.sh | bash
```

Script tự chọn bản build phù hợp với máy và chép vào `/Applications`.

::: tip Sao không tải file .dmg?
File tải bằng trình duyệt sẽ bị macOS cách ly, và macOS báo ứng dụng _"bị hỏng"_
(_"damaged"_), thực ra chỉ vì nó chưa được ký. Nếu bạn đã tải `.dmg` từ
[Releases](https://github.com/vsclaude/visual-studio-claude/releases), hãy chạy
lệnh này một lần sau khi cài:

```bash
xattr -dr com.apple.quarantine "/Applications/VS Claude.app"
```

:::

### Windows

x64. Tải file `.exe` từ
[Releases](https://github.com/vsclaude/visual-studio-claude/releases) rồi chạy.
Khi SmartScreen chặn, chọn **More info** → **Run anyway**.

### Linux

x64. Tải file AppImage từ
[Releases](https://github.com/vsclaude/visual-studio-claude/releases), rồi:

```bash
chmod +x Visual-Studio-Claude-*-x64.AppImage
./Visual-Studio-Claude-*-x64.AppImage
```

Cần có FUSE (`sudo apt install libfuse2` trên Debian và Ubuntu).

## Claude Code

Chat chạy trên chính `claude` của bạn, tức Claude Code CLI. Ứng dụng vẫn mở
được khi chưa có CLI, nhưng bạn cần nó để chat bằng tài khoản Claude của mình.
Nếu chưa có tài khoản Claude nào, bạn có thể chat bằng [credit](/vi/docs/credits).

## Cuộc chat đầu tiên

1. **Thêm project.** Project là một thư mục đã có trong máy. VS Claude làm việc
   ngay tại chỗ, không bao giờ sao chép nó.
2. **Thêm tài khoản Claude** trong **Settings › Claude › Add account**. Xem
   [Tài khoản Claude](/vi/docs/accounts).
3. **Bấm `+`** trên hàng của project để mở chat, rồi gõ tin nhắn.

## Cập nhật

Khi có bản mới, một nút sẽ hiện trên thanh trạng thái. Bấm vào, ứng dụng tự tải
và cài bản cập nhật. Trên Linux, nút này mở trang release.
