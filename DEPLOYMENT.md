# 鉴真 AI 部署配置

## 必需环境变量

- `OPENAI_API_KEY`：服务端图片分析密钥。
- `OPENAI_VISION_MODEL`：默认 `gpt-5.6`。

## 团队数据配置

生产团队版可配置以下 Supabase 环境变量：

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`

密钥只应保存在部署平台的环境变量中，不要提交到代码仓库。

未配置 OpenAI 密钥时，应用会进入演示模式，仍可体验上传、问题标记、历史记录和报告导出。
