export const runtime = "edge";

const demo = {
  score: 3.7,
  confidence: 88,
  type: "电商场景图",
  findings: [
    {
      id: 1, title: "主体局部结构不自然", category: "结构合理性", severity: "高",
      reason: "局部轮廓与相邻物体出现不合理融合，结构连接关系缺乏真实支撑。",
      advice: "重新生成或精修该局部，明确物体边缘、遮挡层级与连接关系。",
      box: { x: 61, y: 32, width: 18, height: 25 },
    },
    {
      id: 2, title: "光影与环境关系矛盾", category: "光影反射", severity: "中",
      reason: "主体高光方向与背景主光源不一致，接触阴影也偏弱。",
      advice: "统一主光方向，降低冲突高光，并补充符合接触面的自然阴影。",
      box: { x: 42, y: 51, width: 20, height: 29 },
    },
    {
      id: 3, title: "细节纹理存在生成痕迹", category: "材质纹理", severity: "中",
      reason: "局部纹理重复且边缘过度平滑，与真实拍摄的细节变化不符。",
      advice: "减少重复纹理，增加材质细微差异并保留适量真实噪点。",
      box: { x: 46, y: 61, width: 12, height: 10 },
    },
  ],
};

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
  if (!apiKey) return Response.json({ ...demo, demoMode: true });

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
    if (!response.ok) throw new Error("OpenAI request failed");
    const result = await response.json() as { output_text?: string; output?: Array<{ content?: Array<{ text?: string }> }> };
    const raw = result.output_text || result.output?.[0]?.content?.[0]?.text;
    if (!raw) throw new Error("Empty model response");
    return Response.json(JSON.parse(raw));
  } catch {
    return Response.json({ ...demo, fallback: true });
  }
}
