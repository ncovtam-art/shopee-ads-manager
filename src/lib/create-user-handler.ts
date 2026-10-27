type Actor = { id: string; role: string; status: string };
export type StaffInput = {
  email: string; password: string; name: string; phone: string | null;
  role: "ADMIN" | "LEADER" | "EMPLOYEE";
};
export type StaffDependencies = {
  resolveActor(): Promise<Actor | null>;
  configurationReady: boolean;
  createAccount(input: StaffInput): Promise<string | null>;
  updateProfile(id: string, input: StaffInput): Promise<boolean>;
  removeNewAccount(id: string): Promise<boolean>;
};

const reply = (status: number, error: string) => Response.json({ error }, {
  status, headers: { "Cache-Control": "no-store" },
});

export async function handleCreateUser(request: Request, deps: StaffDependencies, appOrigin?: string) {
  try {
    let origin: string;
    try {
      const parsed = new URL(appOrigin ?? "");
      if (parsed.origin !== appOrigin ||
          !(parsed.protocol === "https:" || (parsed.protocol === "http:" && ["localhost", "127.0.0.1"].includes(parsed.hostname))))
        return reply(503, "APP_ORIGIN chưa được cấu hình hợp lệ ở máy chủ.");
      origin = parsed.origin;
    } catch { return reply(503, "APP_ORIGIN chưa được cấu hình hợp lệ ở máy chủ."); }
    if (request.headers.get("origin") !== origin)
      return reply(403, "Địa chỉ gửi yêu cầu không được phép.");
    const actor = await deps.resolveActor();
    if (!actor) return reply(401, "Chưa đăng nhập.");
    if (actor.status !== "ACTIVE" || !["ADMIN", "LEADER"].includes(actor.role))
      return reply(403, "Không có quyền tạo nhân viên.");
    if (request.headers.get("content-type")?.split(";")[0].trim().toLowerCase() !== "application/json")
      return reply(415, "Yêu cầu phải dùng application/json.");
    const reader = request.body?.getReader();
    if (!reader) return reply(400, "Thiếu dữ liệu nhân viên.");
    const chunks: Uint8Array[] = [];
    let size = 0;
    while (true) {
      const part = await reader.read();
      if (part.done) break;
      size += part.value.byteLength;
      if (size > 8192) { await reader.cancel(); return reply(413, "Dữ liệu nhân viên quá lớn."); }
      chunks.push(part.value);
    }
    let body: unknown;
    try { body = JSON.parse(Buffer.concat(chunks).toString("utf8")); }
    catch { return reply(400, "Dữ liệu JSON không hợp lệ."); }
    if (!body || typeof body !== "object" || Array.isArray(body))
      return reply(400, "Dữ liệu nhân viên không hợp lệ.");
    const value = body as Record<string, unknown>;
    if (Object.keys(value).some(key => !["email", "password", "name", "phone", "role"].includes(key)))
      return reply(400, "Dữ liệu chứa trường không được hỗ trợ.");
    const { email, password, name, phone } = value;
    const role = value.role ?? "EMPLOYEE";
    if (typeof email !== "string" || email.trim().length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim()) ||
        typeof password !== "string" || password.length < 12 || password.length > 128 ||
        typeof name !== "string" || !name.trim() || name.trim().length > 100 ||
        !(phone === undefined || phone === null || (typeof phone === "string" && phone.trim().length <= 32)) ||
        typeof role !== "string" || !["ADMIN", "LEADER", "EMPLOYEE"].includes(role))
      return reply(400, "Kiểm tra email, tên, quyền và mật khẩu từ 12 đến 128 ký tự.");
    if (actor.role === "LEADER" && role !== "EMPLOYEE")
      return reply(403, "Leader chỉ được tạo tài khoản nhân viên.");
    if (!deps.configurationReady)
      return reply(503, "Máy chủ chưa có cấu hình quản trị Supabase. Liên hệ quản trị viên.");
    const input: StaffInput = {
      email: email.trim().toLowerCase(), password, name: name.trim(),
      phone: typeof phone === "string" && phone.trim() ? phone.trim() : null,
      role: role as StaffInput["role"],
    };
    const id = await deps.createAccount(input);
    if (!id) return reply(409, "Không tạo được tài khoản. Kiểm tra tài khoản đã tồn tại hoặc thử lại sau.");
    let saved = false;
    try { saved = await deps.updateProfile(id, input); } catch { /* Không trả exception chứa dữ liệu. */ }
    if (!saved) {
      let removed = false;
      try { removed = await deps.removeNewAccount(id); } catch { /* Chỉ báo trạng thái. */ }
      return reply(503, removed
        ? "Chưa lưu được hồ sơ; tài khoản mới đã được thu hồi. Vui lòng thử lại sau."
        : "Chưa hoàn tất hồ sơ. Cần quản trị viên kiểm tra tài khoản vừa tạo trước khi thử lại.");
    }
    return Response.json({ success: true, userId: id }, { headers: { "Cache-Control": "no-store" } });
  } catch { return reply(500, "Không thể xử lý yêu cầu tạo nhân viên. Vui lòng thử lại sau."); }
}
