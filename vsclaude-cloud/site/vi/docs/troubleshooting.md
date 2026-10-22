# Xử lý sự cố

## macOS báo ứng dụng "bị hỏng"

Bản build chưa được ký và file đã bị trình duyệt tải về đánh dấu cách ly. Chạy
lệnh này một lần:

```bash
xattr -dr com.apple.quarantine "/Applications/Vey Studio.app"
```

Hoặc cài bằng script một dòng trong [Bắt đầu](/vi/docs/getting-started#macos),
cách này không gặp vấn đề trên.

## "Could not find `claude`"

Vey Studio chạy chính Claude Code CLI của bạn, và tìm nó giống như login shell
của bạn. Nếu CLI được cài ở chỗ `PATH` của shell không với tới, hãy đặt
`CLAUDE_BIN` thành đường dẫn đầy đủ tới file `claude` trước khi mở app.
**Settings › Updates** cho biết phiên bản nào đã được tìm thấy.

Bạn không cần Claude Code nếu chỉ chat bằng [credit](/vi/docs/credits).

## Tài khoản chưa đăng nhập

Mở **Settings › Claude**. **Check** kiểm tra lại tài khoản; **Log in** đăng nhập
lại. Mỗi tài khoản là một lần đăng nhập Claude Code riêng, nên đăng xuất tài
khoản này không ảnh hưởng tài khoản khác.

## Chat dừng vì chạm giới hạn

Tài khoản đó đã hết hạn mức 5 giờ (hoặc hạn mức tuần). Mở menu **Account** của
chat và chọn tài khoản khác, hoặc **Pay with credits**. Tin nhắn tiếp theo vẫn
nhớ toàn bộ cuộc trò chuyện.

## Chat có vẻ bị treo

- **Chiếc khiên** trên hàng của chat nghĩa là nó đang chờ bạn: mở chat và trả lời
  thẻ phía trên khung soạn tin.
- Nếu không, bấm **Stop** rồi gửi lại tin nhắn.

## Đã chuyển khoản nhưng chưa nhận được credit

Chuyển khoản được đối chiếu bằng mã trong nội dung chuyển khoản, nên hãy giữ
nguyên nội dung như trên trang thanh toán. Credit thường về trong một hai phút.
Nếu chuyển thiếu tiền hoặc nội dung bị sửa, credit sẽ không được cộng tự động —
hãy liên hệ kèm thông tin giao dịch để được xử lý thủ công.

## Chat bằng credit báo prompt quá dài

Khi dùng credit, mỗi request giới hạn 100K token. Vey Studio để Claude Code nén
cuộc trò chuyện trước khi chạm mức đó nên hiếm khi xảy ra; nếu gặp, hãy mở chat
mới hoặc nhờ Claude tóm tắt trước.

## Dữ liệu của tôi nằm ở đâu?

Project của bạn vẫn nằm nguyên chỗ cũ. Dữ liệu riêng của Vey Studio — danh sách
project, cài đặt, chat và các phiên đăng nhập tài khoản Claude — nằm trong
`~/.veystudio` trên máy bạn. Request từ tài khoản Claude của bạn đi thẳng tới
Anthropic; chỉ chat bằng credit mới đi qua server của Vey Studio.
