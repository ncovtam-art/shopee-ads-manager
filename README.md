# Shopee Ads Manager

Hệ thống quản lý đội ngũ chạy Facebook Ads Shopee Affiliate.

## 🚀 Hướng dẫn Deploy (cho người không biết code)

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
3. Copy toàn bộ nội dung file `supabase/schema.sql` paste vào
4. Bấm **Run** (hoặc Ctrl+Enter)
5. Nếu thấy "Success" là xong

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
5. Bấm **Deploy**
6. Đợi 2-3 phút, Vercel sẽ cho bạn link: `https://shopee-ads-manager.vercel.app`

### Bước 7: Gắn domain minhtam.click

1. Trong Vercel, vào project → **Settings** → **Domains**
2. Nhập `minhtam.click`, bấm **Add**
3. Vercel sẽ hiện hướng dẫn trỏ DNS:
   - Vào Tenten.vn → Quản lý DNS cho minhtam.click
   - Thêm bản ghi **CNAME**: Host = `@`, Value = `cname.vercel-dns.com`
4. Đợi 5-30 phút → truy cập `https://minhtam.click` 🎉

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

- **Frontend**: Next.js 15, React, TypeScript, Tailwind CSS
- **Database**: Supabase (PostgreSQL)
- **Auth**: Supabase Auth
- **Deploy**: Vercel (free)
- **Charts**: Recharts
