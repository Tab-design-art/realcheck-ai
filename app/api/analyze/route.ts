export const runtime = "edge";

export async function POST(request: Request) {
  const form = await request.formData();
  const file = form.get("image");
  if (!(file instanceof File)) {
    return Response.json({ error: "缺少图片文件" }, { status: 400 });
  }
  if (!file.type.startsWith("image/") || file.size > 15 * 1024 * 1024) {
    return Response.json({ error: "图片格式或大小不符合要求" }, { status: 400 });
  }

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return Response.json(
      { error: "AI 服务尚未配置，请联系管理员设置 API Key。", code: "AI_NOT_CONFIGURED" },
      { status: 503 },
    );
  }

  try {
    const bytes = new Uint8Array(await file.arrayBuffer());
    let binary = "";
    for (const byte of bytes) binary += String.fromCharCode(byte);
    const image = `data:${file.type};base64,${btoa(binary)}`;
    const response = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({
        model: process.env.OPENAI_VISION_MODEL || "gpt-5.6",
        input: [{
          role: "user",
          content: [
            { type: "input_text", text: `你是面向设计与电商团队的图片真实性审核专家。检查人体/生物结构、商品结构、光影反射、透视空间、材质纹理、边缘融合、文字Logo、重复元素和场景物理逻辑。给出0-5分，越高视觉AI感越重，3分及以上不合格。只输出JSON：{"score":number,"confidence":number,"type":string,"findings":[{"id":number,"title":string,"category":string,"severity":"高"|"中"|"低","reason":string,"advice":string,"box":{"x":number,"y":number,"width":number,"height":number}}]}。坐标使用0-100百分比。不要声称能法证判断生成来源。` },
            { type: "input_image", image_url: image, detail: "high" },
          ],
        }],
        text: { format: { type: "json_object" } },
      }),
    });
    if (!response.ok) {
      const failure = await response.json().catch(() => null) as { error?: { code?: string; message?: string } } | null;
      const quotaExceeded = response.status === 429;
      return Response.json(
        {
          error: quotaExceeded
            ? "OpenAI API 当前无可用额度，请管理员检查计费设置。"
            : "AI 检测服务调用失败，请稍后重试。",
          code: quotaExceeded ? "AI_QUOTA_EXCEEDED" : failure?.error?.code || "AI_REQUEST_FAILED",
        },
        { status: quotaExceeded ? 503 : 502 },
      );
    }
    const result = await response.json() as { output_text?: string; output?: Array<{ content?: Array<{ text?: string }> }> };
    const raw = result.output_text || result.output?.[0]?.content?.[0]?.text;
    if (!raw) throw new Error("Empty model response");
    return Response.json(JSON.parse(raw));
  } catch {
    return Response.json(
      { error: "AI 检测服务连接失败，请稍后重试。", code: "AI_CONNECTION_FAILED" },
      { status: 502 },
    );
  }
}
