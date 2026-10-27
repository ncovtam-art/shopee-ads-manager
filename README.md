# Shopee Ads Manager

Hệ thống quản lý đội ngũ chạy Facebook Ads Shopee Affiliate.

## 🚀 Hướng dẫn Deploy (cho người không biết code)

Trước khi cập nhật website đang chạy, đọc
[báo cáo nghiệm thu main](docs/MAIN_READINESS.md). Dùng Node 24, `npm ci`,
`npm run typecheck`, `npm run lint`, `npm test`, `npm run build`.
Nhánh `fix/main-auth-readiness` xuất phát từ main của ứng dụng Supabase này;
nhánh `fix/meta-setup-diagnostics` thuộc một lịch sử ứng dụng khác, không merge
hai lịch sử hoặc chạy migration của ứng dụng kia vào database này.

### Bước 1: Tạo tài khoản

1. **GitHub** — vào [github.com](https://github.com), đăng ký bằng email
2. **Vercel** — vào [vercel.com](https://vercel.com), đăng ký bằng GitHub
3. **Supabase** — vào [supabase.com](https://supabase.com), đăng ký bằng GitHub

### Bước 2: Tạo Database trên Supabase

1. Vào [app.supabase.com](https://app.supabase.com)
2. Bấm **New Project**
3. Đặt tên: `shopee-ads-manager`
4. Chọn Region: **Southeast Asia (Singapore)**
5. Đặt password database (lưu lại)
6. Bấm **Create new project**, đợi 2 phút

### Bước 3: Chạy SQL tạo bảng

1. Trong Supabase Dashboard, bấm **SQL Editor** (menu bên trái)
2. Bấm **New query**
3. Với database mới, review và chạy lần lượt `schema.sql`, `migration_v2.sql`,
   `migration_v3.sql`, `migration_v4.sql`, `migration_v5_security.sql`,
   `migration_v6_atomic_imports.sql`, `migration_v7_atomic_page_delete.sql` trong thư mục
   `supabase`. Không chạy lại `schema.sql` trên database đang có dữ liệu.
4. Với database hiện hữu, sao lưu và thử bản sao staging trước khi áp dụng migration
   bảo mật mới. Không reset dữ liệu, tạo lại tài khoản hoặc tự sửa quyền hiện hữu.
5. Các RPC tài chính mà giao diện gọi hiện chưa được lưu định nghĩa trong repo;
   cần đối chiếu/export định nghĩa từ Supabase và kiểm thử quyền trước nghiệm thu
   cài mới. Xem danh sách BLOCKED trong báo cáo; tạo bảng thành công chưa đủ.

### Bước 4: Lấy API Keys

1. Trong Supabase, vào **Settings** → **API**
2. Copy 2 giá trị:
   - **Project URL**: `https://abc123.supabase.co`
   - **anon public key**: `eyJhbGciOiJI...` (dài)
3. Lưu lại, sẽ dùng ở bước 6

### Bước 5: Tạo tài khoản Admin

1. Trong Supabase, vào **Authentication** → **Users**
2. Bấm **Add user** → **Create new user**
3. Nhập email admin và password
4. Bấm **Create user**
5. Vào **SQL Editor**, chạy lệnh:
   ```sql
   UPDATE profiles SET role = 'ADMIN' WHERE email = 'email-ban-vua-tao@gmail.com';
   ```

### Bước 6: Deploy lên Vercel

1. Fork repo này về GitHub của bạn (bấm nút Fork ở góc phải)
2. Vào [vercel.com/new](https://vercel.com/new)
3. Chọn repo `shopee-ads-manager`
4. Ở phần **Environment Variables**, thêm 2 biến:
   - `NEXT_PUBLIC_SUPABASE_URL` = Project URL từ bước 4
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY` = anon key từ bước 4
   - `APP_ORIGIN` = Origin HTTPS chính xác, ví dụ `https://minhtam.click`;
     Preview cần cấu hình Origin riêng, không dùng wildcard.
   - `SUPABASE_SERVICE_ROLE_KEY` = key quản trị nhập riêng trong Vercel khi cần
     tạo nhân viên. Tuyệt đối không thêm tiền tố `NEXT_PUBLIC_`, không đưa vào Git/chat.
5. Bấm **Deploy**
6. Đợi 2-3 phút, Vercel sẽ cho bạn link: `https://shopee-ads-manager.vercel.app`

### Bước 7: Gắn domain minhtam.click

1. Trong Vercel, vào project → **Settings** → **Domains**
2. Nhập `minhtam.click`, bấm **Add**
3. Lấy bản ghi DNS chính xác từ trang Domains của Vercel và nhà cung cấp DNS
   đang quản lý tên miền. Không suy đoán địa chỉ IP/CNAME hoặc nhà cung cấp.
4. `minhtam.click` đã có website chạy: giữ nguyên production/DNS, nghiệm thu trên
   Preview riêng trước. Không thay cấu hình tên miền chỉ để thử một nhánh mới.

### Bước 8: Đăng nhập

Truy cập `https://minhtam.click/login`, dùng email/password đã tạo ở bước 5.

---

## 📋 Cập nhật code

Mỗi khi có code mới:
1. Vào GitHub repo → bấm **Sync fork**
2. Vercel tự động deploy trong 2 phút
3. Không cần gõ lệnh gì

---

## 🛠 Tech Stack

- **Frontend**: Next.js 16.4.3, React 19, TypeScript, Tailwind CSS; Node 24
- **Database**: Supabase (PostgreSQL)
- **Auth**: Supabase Auth
- **Deploy**: Vercel (theo gói tài khoản đang dùng)
- **Charts**: Recharts
