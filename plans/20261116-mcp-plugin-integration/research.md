# Research và evidence ledger

Đối chiếu tài liệu chính thức ngày 2026-11-16. Schema/version phải kiểm tra lại khi triển khai. Không thực hiện đăng ký OAuth, tạo plugin, migration hay deployment.

| Nguồn | Điều dùng trong plan |
|---|---|
| [OpenAI plugin concepts](https://developers.openai.com/plugins/concepts/plugins) | Plugin là gói kết nối/instructions có thể dùng cho ChatGPT/Codex; MCP server cung cấp runtime tools |
| [Package your plugin](https://developers.openai.com/plugins/build/plugins) | Manifest, MCP config, skills; remote Streamable HTTP; metadata host-specific |
| [Build MCP server](https://developers.openai.com/plugins/build/mcp-server) | Tools rõ mục tiêu, schema/annotations, structured results; UI không bắt buộc |
| [Plugin authentication](https://developers.openai.com/plugins/build/auth) | OAuth, metadata discovery, PKCE, issuer/audience/resource, securitySchemes và auth challenge |
| [Connect and test](https://developers.openai.com/plugins/deploy/connect-chatgpt) | Kết nối/test private MCP qua HTTPS/tunnel; kiểm host thực tế |
| [Supabase OAuth MCP authentication](https://supabase.com/docs/guides/auth/oauth-server/mcp-authentication) | OAuth server + user JWT/RLS là hướng phù hợp; cần enable/configure/consent |
| [Supabase OAuth setup](https://supabase.com/docs/guides/auth/oauth-server/getting-started) | Setup issuer/client registration; không coi cookie login hiện có là đủ |
| [Supabase OAuth flows — supported scopes](https://supabase.com/docs/guides/auth/oauth-server/oauth-flows) | Supabase hỗ trợ `openid`, `email`, `profile`, `phone`; custom OAuth scopes chưa hỗ trợ. `documents:read/write/compile` cần application-level permission design, không được gửi như OAuth scopes. |
| [MCP Tasks extension](https://tasks.extensions.modelcontextprotocol.io/specification/2026-07-28/tasks) | Có extension cho task dài nhưng chưa xác minh hai host support; không dùng làm dependency MVP |

## Kết luận thiết kế, không phải đặc tính có sẵn

- Cùng backend remote MCP cho hai host; plugin đóng gói discovery/config/instructions.
- Supabase OAuth là lựa chọn ưu tiên vì app dùng Supabase, nhưng compatibility spike vẫn phải xác minh token audience/resource và RLS trong project thật.
- Job polling ở tầng ứng dụng được chọn để không ràng buộc call dài với host timeout hoặc native Tasks support.
- PDF link/grant cần host download test; không khẳng định link tự render thành PDF attachment trong mọi client.

## Công việc đã thực hiện

- Root đọc source auth/storage/routes/config/migrations/deployment; agent architecture đọc luồng domain; agent research đối chiếu docs chính thức.
- GitNexus CLI query thất bại do native @ladybugdb/core; index stale so với HEAD. Source inspection là bằng chứng khảo sát thay thế, không có impact report hợp lệ.
- Chỉ ghi bộ tài liệu plan này. Không sửa application code, không chạy app/compile/test, không kiểm runtime production.
- User đã chọn host viết LaTeX, server compile/lưu PDF làm ưu tiên MVP. Các chức năng AI nội bộ giữ phase sau.
- 2026-11-17: P1 ban đầu đề xuất `documents:*` OAuth scopes đã được kiểm tra lại theo Supabase OAuth docs; custom scopes không được hỗ trợ. User chọn một consent bundle đọc/sửa/compile; consent UI và migration 0010 enforce bundle qua live OAuth grant, không triển khai custom scope. Local SQL consent-revoke checks pass; cloud còn pending.
- Review kiến trúc độc lập phát hiện mutable PDF và stale worker publication; plan đã bổ sung immutable artifact snapshot, lease fencing và cấm direct client job mutation. Đây là review thiết kế, không phải bằng chứng runtime.
