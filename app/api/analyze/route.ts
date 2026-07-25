export const runtime = "nodejs";

export async function POST(request: Request) {
  const form = await request.formData();
  const file = form.get("image");
  if (!(file instanceof File)) {
    return Response.json({ error: "缺少图片文件" }, { status: 400 });
  }
  if (!file.type.startsWith("image/") || file.size > 15 * 1024 * 1024) {
    return Response.json({ error: "图片格式或大小不符合要求" }, { status: 400 });
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return Response.json(
      { error: "Gemini 服务尚未配置，请联系管理员设置 API Key。", code: "GEMINI_NOT_CONFIGURED" },
      { status: 503 },
    );
  }

  try {
    const bytes = new Uint8Array(await file.arrayBuffer());
    let binary = "";
    for (const byte of bytes) binary += String.fromCharCode(byte);
    const imageBase64 = btoa(binary);
    const model = process.env.GEMINI_VISION_MODEL || "gemini-3.5-flash";
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`,
      {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-goog-api-key": apiKey },
      body: JSON.stringify({
        contents: [{
          role: "user",
          parts: [
            { text: `你是面向设计与电商团队的图片真实性审核专家。你的任务是评估图片中可见的“不自然程度”，而不是猜测文件来源。

先整体判断它更像手机/相机实拍、后期合成、3D渲染还是AI生成，再检查人体/生物结构、商品结构、光影反射、透视空间、材质纹理、边缘融合、文字Logo、重复元素和场景物理逻辑。

评分必须基于图片证据：
- 0：自然实拍，未发现异常
- 1：基本真实，只有普通拍摄或压缩瑕疵
- 2：存在轻微可疑细节，但不足以判为AI感明显
- 3：存在一处以上明确且影响可信度的生成/合成异常
- 4：多处明显异常，整体不真实
- 5：高度典型的AI生成视觉

不要把景深、噪点、摩尔纹、运动模糊、屏幕反光、JPEG压缩、手机夜景算法或普通修图本身当作AI证据。每个问题必须对应图片里真实可见的位置；没有可靠问题时 findings 返回空数组。3分及以上为不合格。

只输出JSON，不要Markdown：{"score":number,"confidence":number,"type":string,"findings":[{"id":number,"title":string,"category":string,"severity":"高"|"中"|"低","reason":string,"advice":string,"box":{"x":number,"y":number,"width":number,"height":number}}]}。score范围0-5，confidence范围0-100，坐标使用0-100百分比。不要声称能法证判断生成来源。` },
            { inline_data: { mime_type: file.type, data: imageBase64 } },
          ],
        }],
        generationConfig: {
          responseMimeType: "application/json",
          temperature: 0.1,
        },
      }),
    });
    if (!response.ok) {
      const failure = await response.json().catch(() => null) as { error?: { code?: string; message?: string } } | null;
      const quotaExceeded = response.status === 429;
      return Response.json(
        {
          error: quotaExceeded
            ? "Gemini 当前无可用额度或请求过于频繁，请检查配额设置。"
            : "Gemini 检测服务调用失败，请稍后重试。",
          code: quotaExceeded ? "GEMINI_QUOTA_EXCEEDED" : failure?.error?.code || "GEMINI_REQUEST_FAILED",
          ...(process.env.AI_DEBUG_ERRORS === "true" && {
            detail: failure?.error?.message || `Gemini HTTP ${response.status}`,
          }),
        },
        { status: quotaExceeded ? 503 : 502 },
      );
    }
    const result = await response.json() as {
      candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
    };
    const raw = result.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!raw) throw new Error("Empty model response");
    const parsed = JSON.parse(raw.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, ""));
    if (
      typeof parsed?.score !== "number"
      || parsed.score < 0
      || parsed.score > 5
      || !Array.isArray(parsed.findings)
    ) {
      throw new Error("Invalid model response");
    }
    return Response.json(parsed);
  } catch (error) {
    return Response.json(
      {
        error: "Gemini 检测服务连接失败或返回格式异常，请稍后重试。",
        code: "GEMINI_CONNECTION_FAILED",
        ...(process.env.AI_DEBUG_ERRORS === "true" && {
          detail: error instanceof Error ? error.message : "Unknown error",
        }),
      },
      { status: 502 },
    );
  }
}
