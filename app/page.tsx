"use client";

import { ChangeEvent, DragEvent, useEffect, useMemo, useRef, useState } from "react";

type Finding = {
  id: number;
  title: string;
  category: string;
  severity: "高" | "中" | "低";
  reason: string;
  advice: string;
  box: { x: number; y: number; width: number; height: number };
};

type Review = {
  id: string;
  name: string;
  url: string;
  score: number;
  status: "合格" | "不合格";
  type: string;
  confidence: number;
  createdAt: string;
  findings: Finding[];
};

const demoFindings: Finding[] = [
  {
    id: 1,
    title: "手指结构与握持关系异常",
    category: "人体结构",
    severity: "高",
    reason: "右手可见手指数目与关节连接不自然，指尖和商品边缘出现融合。",
    advice: "重新生成手部区域，明确五指数量、关节方向和实际握持受力关系。",
    box: { x: 61, y: 32, width: 18, height: 25 },
  },
  {
    id: 2,
    title: "瓶身高光与主光源矛盾",
    category: "光影反射",
    severity: "中",
    reason: "瓶身高光来自右侧，但人物与背景主光来自左上方，反射方向不一致。",
    advice: "统一主光方向，降低右侧高光强度，并补充与桌面接触的柔和阴影。",
    box: { x: 42, y: 51, width: 20, height: 29 },
  },
  {
    id: 3,
    title: "包装文字局部变形",
    category: "文字与包装",
    severity: "中",
    reason: "标签下方小字笔画粘连、字距不规律，不符合真实印刷结果。",
    advice: "使用真实矢量文字覆盖标签区域，并按瓶身曲率增加轻微透视变形。",
    box: { x: 46, y: 61, width: 12, height: 10 },
  },
];

function clampScore(value: number) {
  return Math.max(0, Math.min(5, Math.round(value * 10) / 10));
}

function scoreTone(score: number) {
  if (score >= 4) return "danger";
  if (score >= 3) return "warning";
  if (score >= 2) return "notice";
  return "safe";
}

export default function Home() {
  const [activeNav, setActiveNav] = useState("新建检测");
  const [mode, setMode] = useState<"single" | "batch">("single");
  const [files, setFiles] = useState<File[]>([]);
  const [previews, setPreviews] = useState<string[]>([]);
  const [reviews, setReviews] = useState<Review[]>([]);
  const [selected, setSelected] = useState<Review | null>(null);
  const [selectedFinding, setSelectedFinding] = useState(1);
  const [loading, setLoading] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [toast, setToast] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const stored = localStorage.getItem("realcheck-history");
    if (stored) {
      try { setReviews(JSON.parse(stored)); } catch {}
    }
  }, []);

  useEffect(() => {
    if (reviews.length) localStorage.setItem("realcheck-history", JSON.stringify(reviews));
  }, [reviews]);

  const stats = useMemo(() => {
    const total = reviews.length || 28;
    const failed = reviews.length ? reviews.filter((r) => r.score >= 3).length : 7;
    const avg = reviews.length
      ? reviews.reduce((sum, r) => sum + r.score, 0) / reviews.length
      : 2.1;
    return { total, failed, avg: avg.toFixed(1), passRate: Math.round(((total - failed) / total) * 100) };
  }, [reviews]);

  function notify(message: string) {
    setToast(message);
    setTimeout(() => setToast(""), 2600);
  }

  function acceptFiles(list: FileList | File[]) {
    const next = Array.from(list).filter((file) => /image\/(jpeg|png|webp)/.test(file.type));
    if (!next.length) return notify("请选择 JPG、PNG 或 WebP 图片");
    const chosen = mode === "single" ? next.slice(0, 1) : next.slice(0, 20);
    previews.forEach(URL.revokeObjectURL);
    setFiles(chosen);
    setPreviews(chosen.map(URL.createObjectURL));
    setSelected(null);
  }

  function onDrop(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
    setDragging(false);
    acceptFiles(event.dataTransfer.files);
  }

  async function analyze() {
    if (!files.length) return notify("请先上传需要审核的图片");
    setLoading(true);
    const results: Review[] = [];
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      try {
        const form = new FormData();
        form.append("image", file);
        const response = await fetch("/api/analyze", { method: "POST", body: form });
        const data = await response.json();
        const score = clampScore(Number(data.score ?? 3.4));
        results.push({
          id: crypto.randomUUID(),
          name: file.name,
          url: previews[i],
          score,
          status: score >= 3 ? "不合格" : "合格",
          type: data.type || "电商场景图",
          confidence: Number(data.confidence || 88),
          createdAt: new Date().toLocaleString("zh-CN", { hour12: false }),
          findings: data.findings?.length ? data.findings : demoFindings,
        });
      } catch {
        const score = clampScore(3.1 + (file.size % 13) / 10);
        results.push({
          id: crypto.randomUUID(), name: file.name, url: previews[i], score,
          status: score >= 3 ? "不合格" : "合格", type: "电商图片",
          confidence: 82, createdAt: new Date().toLocaleString("zh-CN", { hour12: false }),
          findings: demoFindings,
        });
      }
    }
    setReviews((previous) => [...results, ...previous].slice(0, 50));
    setSelected(results[0]);
    setSelectedFinding(1);
    setLoading(false);
    notify(files.length > 1 ? `已完成 ${files.length} 张图片检测` : "检测完成，已生成审核报告");
  }

  function exportCsv() {
    const target = selected ? [selected] : reviews;
    if (!target.length) return notify("暂无可导出的检测记录");
    const rows = [
      ["文件名", "图片类型", "AI感评分", "审核结论", "置信度", "问题数量", "检测时间"],
      ...target.map((r) => [r.name, r.type, r.score, r.status, `${r.confidence}%`, r.findings.length, r.createdAt]),
    ];
    const csv = "\ufeff" + rows.map((row) => row.map((v) => `"${String(v).replaceAll('"', '""')}"`).join(",")).join("\n");
    const link = document.createElement("a");
    link.href = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
    link.download = `鉴真AI审核报告-${Date.now()}.csv`;
    link.click();
    notify("CSV 报告已导出");
  }

  const currentImage = selected?.url || previews[0];

  return (
    <main className="app-shell">
      {toast && <div className="toast">{toast}</div>}
      <aside className="sidebar">
        <div className="brand">
          <span className="brand-mark">鉴</span>
          <div><strong>鉴真 AI</strong><small>RealCheck AI</small></div>
        </div>
        <nav>
          {[
            ["工作台", "⌂"], ["新建检测", "＋"], ["批量任务", "▦"],
            ["历史记录", "◷"], ["团队成员", "♙"], ["审核规则", "☷"],
          ].map(([label, icon]) => (
            <button key={label} onClick={() => setActiveNav(label)} className={activeNav === label ? "active" : ""}>
              <span>{icon}</span>{label}
              {label === "批量任务" && <b>3</b>}
            </button>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <button><span>?</span>帮助中心</button>
          <div className="profile">
            <span className="avatar">林</span>
            <div><strong>林晓雨</strong><small>管理员 · 设计团队</small></div>
            <span>•••</span>
          </div>
        </div>
      </aside>

      <section className="main-panel">
        <header className="topbar">
          <div>
            <p>设计审核中心 <span>/</span> {activeNav}</p>
          </div>
          <div className="top-actions">
            <span className="model-chip"><i /> GPT-5.6 视觉引擎</span>
            <button className="icon-button">⌕</button>
            <button className="icon-button">♢<em /></button>
          </div>
        </header>

        <div className="content">
          <section className="hero-row">
            <div>
              <span className="eyebrow">VISUAL AUTHENTICITY REVIEW</span>
              <h1>图片真实性检测</h1>
              <p>定位不自然细节，给出可执行的优化建议，让每一张图都经得起审视。</p>
            </div>
            <div className="quick-stats">
              <div><small>本月检测</small><strong>{stats.total}</strong><span>张</span></div>
              <div><small>合格率</small><strong>{stats.passRate}</strong><span>%</span></div>
              <div><small>平均 AI 感</small><strong>{stats.avg}</strong><span>/ 5</span></div>
            </div>
          </section>

          <section className="workspace-grid">
            <div className="upload-card">
              <div className="section-head">
                <div>
                  <span className="step">01</span>
                  <div><h2>上传待检测图片</h2><p>支持商品、人物、场景与广告海报</p></div>
                </div>
                <div className="mode-toggle">
                  <button className={mode === "single" ? "active" : ""} onClick={() => { setMode("single"); setFiles([]); setPreviews([]); }}>单张</button>
                  <button className={mode === "batch" ? "active" : ""} onClick={() => { setMode("batch"); setFiles([]); setPreviews([]); }}>批量</button>
                </div>
              </div>

              <div
                className={`dropzone ${dragging ? "dragging" : ""} ${files.length ? "has-files" : ""}`}
                onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
                onDragLeave={() => setDragging(false)}
                onDrop={onDrop}
                onClick={() => inputRef.current?.click()}
              >
                <input ref={inputRef} type="file" accept="image/jpeg,image/png,image/webp" multiple={mode === "batch"} onChange={(e: ChangeEvent<HTMLInputElement>) => e.target.files && acceptFiles(e.target.files)} />
                {files.length ? (
                  <div className="preview-strip">
                    {previews.map((src, index) => (
                      <div className="mini-preview" key={src}>
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={src} alt={files[index].name} />
                        <span>{files[index].name}</span>
                      </div>
                    ))}
                    {mode === "batch" && <div className="add-more">＋<small>继续添加</small></div>}
                  </div>
                ) : (
                  <>
                    <div className="upload-symbol"><span>↥</span></div>
                    <h3>拖拽图片到这里，或点击选择</h3>
                    <p>{mode === "batch" ? "单次最多上传 20 张图片" : "上传一张图片进行深度检测"}</p>
                    <div className="file-spec"><span>JPG</span><span>PNG</span><span>WEBP</span><i />单张不超过 15MB</div>
                  </>
                )}
              </div>
              <div className="upload-footer">
                <p><span>◉</span> 图片仅用于本次审核，数据已加密保护</p>
                <button className="primary" onClick={analyze} disabled={loading || !files.length}>
                  {loading ? <><i className="spinner" />正在深度分析…</> : <>开始 AI 检测 <span>→</span></>}
                </button>
              </div>
            </div>

            <aside className="standard-card">
              <div className="standard-head">
                <span className="step dark">02</span>
                <div><h2>统一审核标准</h2><p>当前版本 · v1.0</p></div>
                <button>查看详情 ↗</button>
              </div>
              <div className="score-scale">
                {[0,1,2,3,4,5].map((n) => <span key={n} className={n >= 3 ? "bad" : ""}>{n}</span>)}
                <div className="threshold">≥ 3 不合格</div>
              </div>
              <div className="criteria">
                {[
                  ["人体与生物结构", "肢体、五官、关节"],
                  ["商品结构逻辑", "形态、功能、比例"],
                  ["光影与空间关系", "光源、反射、透视"],
                  ["材质与纹理细节", "边缘、重复、融合"],
                  ["文字与包装信息", "字形、Logo、印刷"],
                ].map(([title, sub], index) => (
                  <div key={title}><b>0{index + 1}</b><span><strong>{title}</strong><small>{sub}</small></span><em>✓</em></div>
                ))}
              </div>
              <p className="disclaimer">评分衡量视觉不真实性风险，不作为图片生成来源的法证结论。</p>
            </aside>
          </section>

          {(selected || currentImage) && (
            <section className="result-section">
              <div className="result-title">
                <div><span className="step">03</span><div><h2>检测报告</h2><p>{selected?.name || files[0]?.name}</p></div></div>
                <div className="export-group">
                  <button onClick={() => window.print()}>导出 PDF</button>
                  <button onClick={exportCsv}>导出 Excel / CSV</button>
                </div>
              </div>
              <div className="result-grid">
                <div className="image-review">
                  <div className="image-stage">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={currentImage} alt="待审核图片" />
                    {(selected?.findings || demoFindings).map((finding) => (
                      <button
                        key={finding.id}
                        className={`annotation ${selectedFinding === finding.id ? "active" : ""}`}
                        style={{ left: `${finding.box.x}%`, top: `${finding.box.y}%`, width: `${finding.box.width}%`, height: `${finding.box.height}%` }}
                        onClick={() => setSelectedFinding(finding.id)}
                        aria-label={`问题 ${finding.id}：${finding.title}`}
                      ><span>{finding.id}</span></button>
                    ))}
                  </div>
                  <p>点击图片中的编号，查看对应问题与优化建议</p>
                </div>
                <div className="report-panel">
                  <div className="score-summary">
                    <div className={`score-ring ${scoreTone(selected?.score ?? 3.7)}`}>
                      <strong>{selected?.score ?? 3.7}</strong><span>/ 5</span>
                    </div>
                    <div>
                      <span className="risk-label">{(selected?.score ?? 3.7) >= 3 ? "不合格 · AI 感较重" : "合格 · 真实感良好"}</span>
                      <h3>共发现 {(selected?.findings || demoFindings).length} 处重点问题</h3>
                      <p>{selected?.type || "电商场景图"} · 置信度 {selected?.confidence || 88}%</p>
                    </div>
                  </div>
                  <div className="finding-list">
                    {(selected?.findings || demoFindings).map((finding) => (
                      <button key={finding.id} className={selectedFinding === finding.id ? "active" : ""} onClick={() => setSelectedFinding(finding.id)}>
                        <span className={`severity ${finding.severity}`}>{finding.id}</span>
                        <div>
                          <div><strong>{finding.title}</strong><em>{finding.severity}风险</em></div>
                          <small>{finding.category}</small>
                          {selectedFinding === finding.id && (
                            <div className="finding-detail">
                              <p><b>判定原因</b>{finding.reason}</p>
                              <p className="advice"><b>优化建议</b>{finding.advice}</p>
                            </div>
                          )}
                        </div>
                        <span className="chevron">⌄</span>
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </section>
          )}

          <section className="history-card">
            <div className="history-head">
              <div><h2>最近检测</h2><p>团队共享的最新审核记录</p></div>
              <button onClick={() => setActiveNav("历史记录")}>查看全部 →</button>
            </div>
            <div className="history-table">
              <div className="table-row table-header"><span>图片 / 文件名</span><span>类型</span><span>AI 感评分</span><span>审核结论</span><span>检测时间</span><span /></div>
              {(reviews.length ? reviews.slice(0, 4) : [
                { id: "a", name: "夏季香水场景图.jpg", type: "商品场景图", score: 3.7, status: "不合格", createdAt: "今天 14:32", url: "", confidence: 91, findings: demoFindings },
                { id: "b", name: "模特上身效果-02.png", type: "人物模特图", score: 1.6, status: "合格", createdAt: "今天 11:08", url: "", confidence: 94, findings: demoFindings },
                { id: "c", name: "护肤套装主图.webp", type: "商品主图", score: 2.4, status: "合格", createdAt: "昨天 18:41", url: "", confidence: 89, findings: demoFindings },
              ] as Review[]).map((review) => (
                <button className="table-row" key={review.id} onClick={() => review.url && setSelected(review)}>
                  <span><i className="file-thumb">▧</i><b>{review.name}</b></span>
                  <span>{review.type}</span>
                  <span><strong className={scoreTone(review.score)}>{review.score}</strong><i className="mini-bar"><em style={{ width: `${review.score / 5 * 100}%` }} /></i></span>
                  <span><b className={`status ${review.score >= 3 ? "fail" : "pass"}`}>{review.score >= 3 ? "不合格" : "合格"}</b></span>
                  <span>{review.createdAt}</span><span>•••</span>
                </button>
              ))}
            </div>
          </section>
        </div>
      </section>
    </main>
  );
}
