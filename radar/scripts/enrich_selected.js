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

function detectModules(p) {
  const txt = `${p.title || ''}\n${p.abstract || ''}`.toLowerCase();
  const modules = [];

  if (/diffusion|rectified flow|flow distillation|score model|denois/.test(txt)) {
    modules.push({
      name: '生成主干（Diffusion / Flow）',
      role: '负责从条件信息采样出高质量动作/轨迹，并决定多样性与稳定性',
      how: '把你的生成器主干替换成同类扩散或流匹配结构，先冻结编码器做小规模对齐训练',
      where: '用于动作生成主流程（采样阶段），直接影响可控性与保真度'
    });
  }

  if (/condition|controllable|trajectory|keyframe|prompt|text-to-motion|sketch/.test(txt)) {
    modules.push({
      name: '条件控制模块',
      role: '把文本/草图/轨迹/关键帧等条件映射到可执行约束，减少“生成跑偏”',
      how: '先接入你现有条件编码器，再把控制信号注入 cross-attn 或时序适配层做 ablation',
      where: '用于推理时的可控生成入口，适合交互式编辑和约束驱动任务'
    });
  }

  if (/interaction|contact|grasp|handoff|human-object|hoi|ctmc|planner/.test(txt)) {
    modules.push({
      name: '交互事件/接触建模模块',
      role: '显式建模触碰、抓取、交接等离散事件，提升多人/人物体协同时序准确性',
      how: '将事件序列作为中间监督，先在短序列上训练事件预测，再并入端到端生成',
      where: '用于 HOI、多体协作、操作任务等需要接触一致性的场景'
    });
  }

  if (/physics|physical|dynamics|simulation|constraint|plausib/.test(txt)) {
    modules.push({
      name: '物理一致性约束模块',
      role: '约束速度/接触/能量等物理量，减少脚滑、穿模、不合理受力',
      how: '把物理损失作为可插拔正则项接到训练目标，先低权重启动后逐步提升',
      where: '用于训练阶段和后处理阶段，尤其适合真实机器人或仿真迁移'
    });
  }

  if (/3d|mesh|smpl|reconstruct|stereo|pose/.test(txt)) {
    modules.push({
      name: '3D表示与重建模块',
      role: '提供结构先验与几何一致性，提升跨视角稳定性和姿态精度',
      how: '将其作为前置表征层（3D latent）接入你现有时序模型，再对下游任务微调',
      where: '用于姿态估计、三维重建、世界模型与动作理解任务'
    });
  }

  if (/distill|efficient|real-time|fps|lightweight/.test(txt)) {
    modules.push({
      name: '效率优化/蒸馏模块',
      role: '降低推理时延和显存占用，保持可部署性',
      how: '先用 teacher-student 蒸馏得到轻量模型，再针对目标硬件做量化/裁剪',
      where: '用于在线系统、实时交互和资源受限部署'
    });
  }

  // fallback
  if (!modules.length) {
    modules.push({
      name: '任务核心模块',
      role: '围绕论文目标构建从输入条件到输出预测的端到端链路',
      how: '先抽取其主损失和主网络骨架，映射到你现有 pipeline 做最小可行复现',
      where: '用于快速验证论文思想是否能在你的数据与任务上成立'
    });
  }

  return modules.slice(0, 3);
}

function genAuthorView(p) {
  const sents = splitSentences(p.abstract);
  const s1 = sents[0] || firstSentence(p.abstract) || '本文提出一个针对关键难点的新方法。';
  const s2 = sents[1] || '方法上通过结构化建模与训练策略改进来提升效果。';
  const s3 = sents[2] || '实验显示在核心指标或主观质量上有明显收益。';

  return [
    `作者视角-问题：${ensurePeriod(s1)}`,
    `作者视角-方法：${ensurePeriod(s2)}`,
    `作者视角-结果：${ensurePeriod(s3)}`
  ].join(' ');
}

function genExpertReview(p) {
  const strengths = [];
  if (p.signals?.watchHit) strengths.push('命中重点作者/实验室，方向相关性高');
  if (p.signals?.hfTrending?.rank) strengths.push(`进入 HF 趋势榜（#${p.signals.hfTrending.rank}），讨论热度高`);
  if (p.signals?.github?.stars) strengths.push(`代码关注度较高（⭐${p.signals.github.stars}）`);
  if ((p.tags || []).length) strengths.push(`覆盖关键主题：${p.tags.join('、')}`);
  if (!strengths.length) strengths.push('问题定义清晰、方法链路完整，具备持续跟踪价值');

  const risks = [];
  if (!p.signals?.github?.stars) risks.push('公开工程信号偏弱，复现成本和细节不确定性偏高');
  if ((p.tags || []).includes('Physics')) risks.push('物理一致性可能在复杂真实场景下退化');
  if ((p.tags || []).includes('HOI')) risks.push('多人/多体交互的极端边界案例仍可能不稳定');
  if (!risks.length) risks.push('跨数据集泛化与误差分解需要更细证据');

  return `顶级AI评审：亮点——${strengths.slice(0, 3).join('；')}。风险——${risks.slice(0, 2).join('；')}。建议优先核验：消融完整性、跨域泛化、推理效率三项。`;
}

function genScholarTakeaway(p) {
  const modules = detectModules(p);

  const moduleLines = modules.map((m, i) => {
    return `模块${i + 1}「${m.name}」：作用=${m.role}；怎么用=${m.how}；用在哪里=${m.where}`;
  });

  const titleHead = String(p.title || '该方向').split(':')[0].trim();
  const plan = [
    '落地顺序建议：先复现最小基线（1-2天）→ 插入单模块做A/B（2-3天）→ 多模块联调并做失败案例分析（3-5天）。',
    `未来工作启发：围绕「${titleHead}」优先做三件事——(1) 模块解耦与可解释性；(2) 跨场景/跨数据泛化；(3) 面向部署的延迟与稳定性优化。`
  ];

  return `${moduleLines.join(' ')} ${plan.join(' ')}`;
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
    const authorView = genAuthorView(p);
    const expertReview = genExpertReview(p);
    const scholarTakeaway = genScholarTakeaway(p);

    return {
      ...p,
      summary,
      authorView,
      expertReview,
      scholarTakeaway
    };
  });

  const rangeText = range?.from && range?.to
    ? `${range.from} → ${range.to}`
    : date;

  const title = `Scholar Radar · ${date} · Motion + HOI`;
  const subtitle = `${kindLabel(kind)} · ${rangeText} · Top ${papers.length}`;
  const footer = '三板块：作者视角 / 顶级AI评审 / 学者即插即用+未来启发';

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
