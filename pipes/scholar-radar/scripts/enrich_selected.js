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

function topicFromTags(tags) {
  const t = new Set(tags || []);
  if (t.has('HOI') && t.has('Physics')) return '人物-物体交互与物理一致性';
  if (t.has('HOI')) return '人物-物体交互';
  if (t.has('Diffusion')) return '可控生成';
  if (t.has('3D')) return '三维建模与重建';
  if (t.has('Physics')) return '物理一致性建模';
  return '目标任务建模';
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
  const modules = detectModules(p);
  const topic = topicFromTags(p.tags || []);
  const core = modules[0]?.name || '核心建模模块';
  return `作者陈述：聚焦${topic}任务，核心方法采用${core}来提升结果稳定性与可控性。`;
}

function genExpertReview(p) {
  const innovation = detectModules(p)[0]?.name || '核心建模模块';
  const evidence = p.signals?.hfTrending?.rank
    ? `外部热度较高（HF趋势#${p.signals.hfTrending.rank}）`
    : '当前外部热度证据中性';

  let risk = '跨数据集泛化仍需进一步实证';
  if ((p.tags || []).includes('Physics')) risk = '复杂真实场景下的物理一致性有待验证';
  else if ((p.tags || []).includes('HOI')) risk = '多体交互边界案例稳定性有待验证';

  return `专家评议：创新点在${innovation}；证据强度方面，${evidence}；主要风险是${risk}。`;
}

function genResearchIntegration(p) {
  const modules = detectModules(p);
  const m1 = modules[0] || { name: '核心建模模块', where: '主训练与推理链路' };
  const m2 = modules[1];

  const step1 = `先将${m1.name}接入${m1.where}`;
  const step2 = m2 ? `再联调${m2.name}` : '再进行关键损失与推理路径联调';

  return `研究落地与后续方向：${step1}，${step2}；随后重点验证泛化能力、系统稳定性与推理时延。`;
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
