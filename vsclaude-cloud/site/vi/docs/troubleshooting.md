# Xử lý sự cố

## "Could not find `claude`"

Vey Studio chạy chính Claude Code CLI của bạn, và tìm nó giống như login shell
của bạn. Nếu CLI được cài ở chỗ `PATH` của shell không với tới, hãy đặt
`CLAUDE_BIN` thành đường dẫn đầy đủ tới file `claude` trước khi mở app.
**Settings › Updates** cho biết phiên bản nào đã được tìm thấy.

## Tài khoản chưa đăng nhập

Mở menu của tài khoản trong mục **Accounts** ở cuối cột chat. **Check again**
kiểm tra lại tài khoản; **Sign in…** đăng nhập lại. Mỗi tài khoản là một lần đăng nhập Claude Code riêng, nên đăng xuất tài
khoản này không ảnh hưởng tài khoản khác.

## Chat dừng vì chạm giới hạn

Tài khoản đó đã hết hạn mức 5 giờ (hoặc hạn mức tuần). Mở menu **Account** của
chat và chọn tài khoản khác. Tin nhắn tiếp theo vẫn
nhớ toàn bộ cuộc trò chuyện.

## Chat có vẻ bị treo

- **Chiếc khiên** trên hàng của chat nghĩa là nó đang chờ bạn: mở chat và trả lời
  thẻ phía trên khung soạn tin.
- Nếu không, bấm **Stop** rồi gửi lại tin nhắn.

## Đã chuyển khoản mua Pro nhưng chưa thấy bật

Chuyển khoản được đối chiếu bằng mã trong nội dung chuyển khoản, nên hãy giữ
nguyên nội dung như trên trang thanh toán. Pro thường bật trong một hai phút,
trên máy đã mua — bấm vào cửa sổ ứng dụng để nó hỏi lại. Trên máy khác, hãy
dán khoá licence trong email. Nếu chuyển thiếu tiền hoặc nội dung bị sửa, đơn sẽ
không được đối chiếu tự động — hãy liên hệ kèm thông tin giao dịch để được xử
lý thủ công.

## Dữ liệu của tôi nằm ở đâu?

Project của bạn vẫn nằm nguyên chỗ cũ. Dữ liệu riêng của Vey Studio — danh sách
project, cài đặt, khoá Pro, chat và các phiên đăng nhập tài khoản Claude — nằm trong
`~/.veystudio` trên máy bạn. Mọi chat đi thẳng từ tài khoản Claude của bạn tới
Anthropic; server của Vey Studio chỉ tham gia khi đăng nhập và mua Pro.
