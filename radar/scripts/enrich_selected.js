import { readJson, writeJson, firstSentence } from './lib.js';

function parseArgs(argv) {
  const args = {};
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--in') args.in = argv[++i];
    else if (a === '--out') args.out = argv[++i];
    else if (a === '--kind') args.kind = argv[++i];
  }
  return args;
}

function kindLabel(kind) {
  const k = String(kind || 'daily').toLowerCase();
  if (k === 'weekly') return 'Weekly';
  if (k === 'monthly') return 'Monthly';
  return 'Daily';
}

function splitSentences(text) {
  const s = String(text || '').replace(/\s+/g, ' ').trim();
  if (!s) return [];
  return s
    .split(/(?<=[。！？.!?])\s+/)
    .map((x) => x.trim())
    .filter(Boolean);
}

function ensurePeriod(text) {
  const s = String(text || '').trim();
  if (!s) return '';
  return /[。！？.!?]$/.test(s) ? s : `${s}。`;
}

function clip(s, n) {
  const t = String(s || '').replace(/\s+/g, ' ').trim();
  if (!t) return '';
  return t.length <= n ? t : `${t.slice(0, n - 1)}…`;
}

function detectModules(p) {
  const txt = `${p.title || ''}\n${p.abstract || ''}`.toLowerCase();
  const modules = [];

  if (/diffusion|rectified flow|flow distillation|score model|denois/.test(txt)) {
    modules.push({
      name: '生成主干（Diffusion/Flow）',
      role: '控制生成质量与稳定性',
      how: '替换主干并冻结编码器做对齐微调',
      where: '用于动作生成采样阶段'
    });
  }

  if (/condition|controllable|trajectory|keyframe|prompt|text-to-motion|sketch/.test(txt)) {
    modules.push({
      name: '条件控制模块',
      role: '把文本/轨迹约束映射到可控生成',
      how: '条件编码后注入 cross-attn 或时序适配层',
      where: '用于交互式编辑与约束驱动生成'
    });
  }

  if (/interaction|contact|grasp|handoff|human-object|hoi|ctmc|planner/.test(txt)) {
    modules.push({
      name: '交互事件建模模块',
      role: '提升接触与协同时序准确性',
      how: '先训练事件预测，再并入端到端生成',
      where: '用于 HOI、多体协作与操作任务'
    });
  }

  if (/physics|physical|dynamics|simulation|constraint|plausib/.test(txt)) {
    modules.push({
      name: '物理一致性约束模块',
      role: '降低脚滑/穿模等物理违例',
      how: '将物理损失作为可插拔正则逐步加权',
      where: '用于训练与后处理阶段'
    });
  }

  if (/3d|mesh|smpl|reconstruct|stereo|pose/.test(txt)) {
    modules.push({
      name: '3D表示模块',
      role: '提供几何先验并提升姿态精度',
      how: '作为前置表征层接入时序模型',
      where: '用于重建、姿态与世界模型任务'
    });
  }

  if (!modules.length) {
    modules.push({
      name: '核心建模模块',
      role: '构建从条件到预测的主链路',
      how: '抽取主损失和骨架后做最小复现',
      where: '用于快速验证论文可迁移性'
    });
  }

  return modules.slice(0, 2);
}

function genAuthorStatement(p) {
  const sents = splitSentences(p.abstract);
  const problem = sents[0] || firstSentence(p.abstract) || '论文针对关键任务提出新方法。';
  const method = sents[1] || '通过结构化建模与训练策略改进性能。';
  return `作者陈述：问题=${ensurePeriod(clip(problem, 70))} 方法=${ensurePeriod(clip(method, 70))}`;
}

function genExpertReview(p) {
  const strengths = [];
  if (p.signals?.watchHit) strengths.push('命中重点作者/实验室');
  if (p.signals?.hfTrending?.rank) strengths.push(`HF趋势#${p.signals.hfTrending.rank}`);
  if (p.signals?.github?.stars) strengths.push(`代码热度⭐${p.signals.github.stars}`);
  if (!strengths.length) strengths.push('问题定义清晰、方法链路完整');

  const risks = [];
  if (!p.signals?.github?.stars) risks.push('工程复现细节不足');
  if ((p.tags || []).includes('Physics')) risks.push('真实场景物理泛化待验证');
  if ((p.tags || []).includes('HOI')) risks.push('交互边界案例稳定性待验证');
  if (!risks.length) risks.push('跨数据集泛化证据仍需增强');

  return `专家评议：亮点=${strengths.slice(0, 2).join('；')}；风险=${risks[0]}；建议优先复核跨域泛化与推理效率。`;
}

function genResearchIntegration(p) {
  const modules = detectModules(p);
  const m1 = modules[0];
  const m2 = modules[1];

  const part1 = m1
    ? `模块A(${m1.name})：作用=${m1.role}；接入=${m1.how}；应用=${m1.where}。`
    : '';
  const part2 = m2
    ? `模块B(${m2.name})：作用=${m2.role}；接入=${m2.how}；应用=${m2.where}。`
    : '';

  const direction = '后续方向：优先做模块解耦实验、跨数据泛化验证、低延迟部署优化。';
  return `研究落地与后续方向：${clip(part1, 88)} ${clip(part2, 88)} ${direction}`.trim();
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (!args.in || !args.out) {
    console.error('Usage: node enrich_selected.js --in <selected.json> --out <enriched.json> [--kind daily|weekly|monthly]');
    process.exit(2);
  }

  const selected = await readJson(args.in);
  const kind = args.kind || selected.kind || 'daily';
  const date = selected.date || 'unknown';
  const range = selected.range;

  const papers = (selected.papers || []).map((p) => {
    const summary = (p.summary || firstSentence(p.abstract) || '').trim();
    return {
      ...p,
      summary,
      authorView: genAuthorStatement(p),
      expertReview: genExpertReview(p),
      scholarTakeaway: genResearchIntegration(p)
    };
  });

  const rangeText = range?.from && range?.to ? `${range.from} → ${range.to}` : date;

  const title = `Scholar Radar · ${date} · Motion + HOI`;
  const subtitle = `${kindLabel(kind)} · ${rangeText} · Top ${papers.length}`;
  const footer = '三板块：作者陈述 / 专家评议 / 研究落地与后续方向';

  const enriched = {
    ...selected,
    title,
    subtitle,
    footer,
    papers
  };

  await writeJson(args.out, enriched);

  console.log(JSON.stringify({ ok: true, kind, in: args.in, out: args.out, count: papers.length }, null, 2));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
