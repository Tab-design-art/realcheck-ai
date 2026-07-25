# 鉴真 AI（RealCheck AI）

面向设计与电商团队的图片真实性审核平台。

## 主要能力

- 单张与批量图片上传
- 0–5 分 AI 感评分（3 分及以上不合格）
- 图片问题框选、原因解释与优化建议
- 历史记录与 PDF、Excel/CSV 导出
- OpenAI 多模态视觉分析

线上演示：https://realcheck-ai-cn.chenyuyuan90917.chatgpt.site

## 本地运行

```bash
pnpm install
pnpm dev
```

复制 `.env.example` 为 `.env.local`，并配置 `OPENAI_API_KEY`。任何真实密钥都不得提交到仓库。
