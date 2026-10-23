# 🛡️ Hướng dẫn cài đặt Discord Proxy trên Cloudflare Worker

Hệ thống Discord Proxy này giúp máy chủ Backend trên Render gửi request tới Discord API thông qua mạng lưới Edge IP sạch của Cloudflare, **chống 100% tình trạng bị dính Cloudflare Error 1015 (Rate limit / 429)**.

---

## 🚀 Cách 1: Cài đặt trực tiếp trên Web Dashboard (Đơn giản nhất - Không cần cài tool)

### Bước 1: Tạo Worker trên Cloudflare
1. Đăng nhập vào [Cloudflare Dashboard](https://dash.cloudflare.com/).
2. Ở thanh menu bên trái, chọn **Workers & Pages** -> Bấm nút **Create application** -> Chọn tab **Workers** -> Bấm **Create Worker**.
3. Đặt tên cho worker (ví dụ: `thienthu-discord-proxy`), sau đó bấm **Deploy**.

### Bước 2: Dán code Proxy
1. Sau khi deploy xong worker mặc định, bấm nút **Edit code** (hoặc **Quick edit**).
2. Xóa toàn bộ code cũ trong khung soạn thảo.
3. Mở file [worker.js](./worker.js), copy toàn bộ nội dung và dán vào.
4. Bấm nút **Deploy** (ở góc trên bên phải).

### Bước 3: Kiểm tra Worker hoạt động
1. Bấm vào link Worker vừa tạo (dạng: `https://thienthu-discord-proxy.<tên-subdomain>.workers.dev`).
2. Mở trên trình duyệt, nếu bạn thấy JSON hiển thị:
   ```json
   {
     "status": "online",
     "service": "Discord API Reverse Proxy (Cloudflare Worker)",
     "message": "Proxy is working normally!",
     "instructions": "Đặt biến DISCORD_API_BASE_URL trên Render/Backend thành: https://thienthu-discord-proxy.../api/v10"
   }
   ```
   👉 Có nghĩa là Worker đã hoạt động hoàn hảo!

### Bước 4: Cấu hình vào Backend trên Render
1. Truy cập vào [Render Dashboard](https://dashboard.render.com/).
2. Chọn Web Service **`thienthuhiengia-be`**.
3. Vào tab **Environment** (hoặc **Environment Variables**).
4. Thêm hoặc cập nhật biến môi trường:
   * **Key:** `DISCORD_API_BASE_URL`
   * **Value:** `https://thienthu-discord-proxy.<tên-subdomain>.workers.dev/api/v10`
   *(Nhớ thêm `/api/v10` ở đuôi URL)*
5. Bấm **Save Changes**. Render sẽ tự động redeploy backend với cấu hình mới.

---

## 💻 Cách 2: Deploy bằng dòng lệnh (Dùng pnpm & wrangler)

Nếu bạn muốn deploy nhanh bằng terminal:

1. Di chuyển vào thư mục worker:
   ```bash
   cd discord-proxy-worker
   ```
2. Cài đặt dependency:
   ```bash
   pnpm install
   ```
3. Deploy lên tài khoản Cloudflare của bạn:
   ```bash
   pnpm deploy
   ```
   *(Lần đầu chạy, trình duyệt sẽ tự động mở lên để bạn xác thực tài khoản Cloudflare)*
4. Sau khi deploy thành công, terminal sẽ in ra URL của worker. Bạn lấy URL đó cấu hình vào Render như ở **Bước 4** bên trên.
