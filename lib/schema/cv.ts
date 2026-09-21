import { z } from "zod";

export const cvHeaderSchema = z.object({
  name: z.string().describe("Họ và tên ứng viên"),
  phone: z.string().describe("Số điện thoại liên hệ"),
  email: z.string().describe("Địa chỉ email"),
  link: z.string().describe("Link cá nhân (LinkedIn, GitHub, Portfolio)"),
});

export const cvExperienceSchema = z.object({
  company: z.string().describe("Tên công ty hoặc tổ chức"),
  role: z.string().describe("Vị trí công việc hoặc chức danh"),
  date: z.string().describe("Thời gian làm việc (ví dụ: 06/2022 - Nay)"),
  bullets: z.array(z.string()).describe("Các bullet point mô tả công việc (Sử dụng cấu trúc: Action Verb + Context + Impact)."),
});

export const cvProjectSchema = z.object({
  name: z.string().describe("Tên dự án"),
  date: z.string().describe("Thời gian thực hiện (ví dụ: 2023)"),
  bullets: z.array(z.string()).describe("Các bullet point mô tả dự án (công nghệ, vai trò, kết quả)."),
});

export const cvSchema = z.object({
  header: cvHeaderSchema,
  summary: z.string().optional().describe("Đoạn tóm tắt mục tiêu nghề nghiệp, tóm gọn giá trị bản thân phù hợp với JD."),
  education: z.array(cvExperienceSchema).optional().describe("Học vấn (Sử dụng format giống experience: Trường, Ngành học, Thời gian)."),
  experience: z.array(cvExperienceSchema).optional().describe("Kinh nghiệm làm việc chuyên môn."),
  projects: z.array(cvProjectSchema).optional().describe("Dự án cá nhân hoặc dự án mã nguồn mở đáng chú ý."),
  skills: z.array(z.string()).optional().describe("Kỹ năng chuyên môn, kỹ năng mềm (được format sẵn dưới dạng bullet point hoặc phân loại)."),
});

export type CVData = z.infer<typeof cvSchema>;
