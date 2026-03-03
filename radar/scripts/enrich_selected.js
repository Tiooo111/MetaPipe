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

function ensurePeriodZh(text) {
  const s = String(text || '').trim();
  if (!s) return '';
  return /[。！？.!?]$/.test(s) ? s : `${s}。`;
}

function genAuthorView(p) {
  const sents = splitSentences(p.abstract);
  const s1 = sents[0] || firstSentence(p.abstract) || '本文提出了一个面向实际任务的新方法。';
  const s2 = sents[1] || '';

  const claim = `作者主张：${ensurePeriodZh(s1)}`;
  const method = s2
    ? `方法路径：${ensurePeriodZh(s2)}`
    : `方法路径：围绕${(p.tags || []).slice(0, 2).join('、') || '表示学习与优化流程'}进行系统设计，并强调可落地性。`;

  return `${claim}${method}`;
}

function genExpertReview(p) {
  const strengths = [];
  if (p.signals?.watchHit) strengths.push('命中重点作者/实验室 watchlist');
  if (p.signals?.hfTrending?.rank) strengths.push(`进入 HF 趋势榜（#${p.signals.hfTrending.rank}）`);
  if (p.signals?.github?.stars) strengths.push(`代码关注度高（⭐${p.signals.github.stars}）`);
  if (Array.isArray(p.tags) && p.tags.length) strengths.push(`覆盖关键方向：${p.tags.join('、')}`);
  if (!strengths.length) strengths.push('问题定义清晰，方法链路完整，具备继续跟踪价值');

  const risks = [];
  if (!p.signals?.github?.stars) risks.push('暂未观察到强代码/社区信号，复现成本可能偏高');
  if ((p.tags || []).includes('Physics')) risks.push('物理一致性在真实场景中的泛化仍需更强证据');
  if ((p.tags || []).includes('HOI')) risks.push('多人/多体交互边界案例可能成为稳定性瓶颈');
  if (!risks.length) risks.push('跨数据集泛化、鲁棒性与工程效率仍需进一步验证');

  return `顶级AI评审：亮点——${strengths.join('；')}。风险——${risks.slice(0, 2).join('；')}。`;
}

function genScholarTakeaway(p) {
  const tags = p.tags || [];

  let plug = '即插即用：可先复用其训练/评估协议，把关键模块接入你现有 pipeline 做 A/B 验证';
  if (tags.includes('Diffusion')) {
    plug = '即插即用：优先迁移其条件控制/蒸馏策略到现有 Diffusion 或 T2M 管线';
  } else if (tags.includes('HOI')) {
    plug = '即插即用：把接触约束与交互事件建模模块接入现有动作生成或操作策略';
  } else if (tags.includes('Physics')) {
    plug = '即插即用：把物理一致性损失与可微约束加入训练环节，先在离线基准验证';
  } else if (tags.includes('3D')) {
    plug = '即插即用：把 3D 结构先验接入现有表示学习流程，优先验证对位姿/重建误差的收益';
  }

  const titleHead = String(p.title || '该方向').split(':')[0].trim();
  const future = `未来工作启发：围绕「${titleHead}」继续推进跨场景泛化、数据效率与可解释性，并关注可复现工程基线。`;

  return `${plug}。${future}`;
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
