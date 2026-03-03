import { readJson, firstSentence } from './lib.js';
import fs from 'node:fs/promises';
import path from 'node:path';

function parseArgs(argv) {
  const args = {};
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--in') args.in = argv[++i];
    else if (a === '--out') args.out = argv[++i];
  }
  return args;
}

function splitSentences(text) {
  const s = String(text || '').replace(/\s+/g, ' ').trim();
  if (!s) return [];
  return s
    .split(/(?<=[。！？.!?])\s+/)
    .map((x) => x.trim())
    .filter(Boolean);
}

function detectModulesDetailed(p) {
  const txt = `${p.title || ''}\n${p.abstract || ''}`.toLowerCase();
  const modules = [];

  if (/diffusion|rectified flow|flow distillation|score model|denois/.test(txt)) {
    modules.push({
      name: '生成主干（Diffusion/Flow）',
      role: '负责从条件信息生成候选动作/轨迹，直接影响质量、多样性与稳定性。',
      integration: '将现有生成主干替换为同类扩散/流模型；先冻结条件编码器，再做小学习率对齐微调。',
      placement: '放在主推理链路的采样阶段，与约束控制模块并行协同。'
    });
  }

  if (/condition|controllable|trajectory|keyframe|prompt|text-to-motion|sketch/.test(txt)) {
    modules.push({
      name: '条件控制模块',
      role: '将文本、轨迹、关键帧等条件映射为结构化控制信号，降低“生成跑偏”。',
      integration: '在条件编码器后接入 cross-attention / adapter；优先做“是否开启控制模块”的A/B实验。',
      placement: '位于输入条件到生成主干之间，适合交互式编辑与约束驱动生成。'
    });
  }

  if (/interaction|contact|grasp|handoff|human-object|hoi|ctmc|planner/.test(txt)) {
    modules.push({
      name: '交互事件建模模块',
      role: '显式建模接触、抓取、交接等离散事件，提升多人/人物体交互的时序一致性。',
      integration: '先训练事件预测器（中间监督），再将事件状态注入时序解码器做联合训练。',
      placement: '用于 HOI、多体协作与操作任务，通常接在时序建模层之前。'
    });
  }

  if (/physics|physical|dynamics|simulation|constraint|plausib/.test(txt)) {
    modules.push({
      name: '物理一致性约束模块',
      role: '约束速度、接触与动力学一致性，减少脚滑、穿模和不合理受力。',
      integration: '把物理损失作为可插拔正则项接入总损失；从低权重开始并随训练稳定后逐步增大。',
      placement: '用于训练阶段（主）和后处理阶段（辅），适合仿真到真实迁移。'
    });
  }

  if (/3d|mesh|smpl|reconstruct|stereo|pose/.test(txt)) {
    modules.push({
      name: '3D表示与几何先验模块',
      role: '提供跨视角几何一致性，提升姿态估计与重建稳定性。',
      integration: '先将3D latent作为前置表示，再在下游任务上端到端或分阶段微调。',
      placement: '位于输入编码后、时序预测前，适用于重建/姿态/世界模型任务。'
    });
  }

  if (!modules.length) {
    modules.push({
      name: '核心建模模块',
      role: '建立从输入条件到输出预测的主链路。',
      integration: '抽取主损失、主网络骨架与关键训练策略，先做最小可行复现。',
      placement: '优先用于验证论文方法在你当前数据与任务上的可迁移性。'
    });
  }

  return modules.slice(0, 3);
}

function signalsLine(p) {
  const sig = [];
  if (p.signals?.watchHit) sig.push('watchlist命中');
  if (p.signals?.hfTrending?.rank) sig.push(`HF趋势#${p.signals.hfTrending.rank}`);
  if (p.signals?.github?.stars) sig.push(`GitHub⭐${p.signals.github.stars}`);
  return sig.length ? sig.join('，') : '暂无强外部热度信号';
}

function buildPaperSection(p, idx) {
  const sents = splitSentences(p.abstract);
  const s1 = sents[0] || firstSentence(p.abstract) || '论文提出了新的方法设定。';
  const s2 = sents[1] || '方法通过结构化建模提升性能。';
  const s3 = sents[2] || '实验显示在核心指标上有改进。';

  const modules = detectModulesDetailed(p);
  const moduleMd = modules
    .map((m, i) => [
      `- 模块${i + 1}：**${m.name}**`,
      `  - 作用：${m.role}`,
      `  - 接入方式：${m.integration}`,
      `  - 适用位置/任务：${m.placement}`
    ].join('\n'))
    .join('\n');

  const risk = [
    !p.signals?.github?.stars ? '复现细节公开程度一般，工程成本需预留缓冲。' : null,
    (p.tags || []).includes('Physics') ? '真实复杂场景中的物理一致性仍需额外验证。' : null,
    (p.tags || []).includes('HOI') ? '多人/多体交互边界案例的稳定性可能成为瓶颈。' : null,
  ].filter(Boolean);

  const riskLine = risk.length ? risk.join(' ') : '主要风险在于跨数据泛化与部署时延之间的权衡。';

  return [
    `## ${String(idx + 1).padStart(2, '0')}. ${p.title}`,
    `- arXiv：${p.arxivId}`,
    `- 标签：${(p.tags || []).join('、') || '—'}`,
    `- 信号：${signalsLine(p)}`,
    `- 链接：${p.absUrl}`,
    '',
    '### 1) 作者陈述（完整）',
    `${s1} ${s2} ${s3}`,
    '',
    '### 2) 专家评议（完整）',
    `从研究价值看，该工作在“问题定义—方法实现—实验验证”链条上较完整。当前证据显示其在目标场景具有潜在优势，但仍需重点复核跨域泛化能力、消融实验覆盖度以及工程复现成本。${riskLine}`,
    '',
    '### 3) 研究落地与后续方向（完整）',
    moduleMd,
    '',
    '- 建议实验路线：',
    '  1. 最小可行复现（先对齐输入输出与核心损失）；',
    '  2. 单模块A/B（逐个验证模块边际收益）；',
    '  3. 组合联调（检查模块耦合后的稳定性和效率）；',
    '  4. 跨数据验证（确认泛化与部署可行性）。',
    '',
    '---',
    ''
  ].join('\n');
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (!args.in || !args.out) {
    console.error('Usage: node write_report_md.js --in <enriched.json> --out <report.md>');
    process.exit(2);
  }

  const enriched = await readJson(args.in);
  const papers = enriched.papers || [];

  const lines = [];
  lines.push(`# ${enriched.title || 'Scholar Radar'}`);
  lines.push('');
  lines.push(`${enriched.subtitle || ''}`);
  lines.push('');
  lines.push('> 本文档为详细版解读；海报为精简版摘要。');
  lines.push('');

  papers.forEach((p, i) => {
    lines.push(buildPaperSection(p, i));
  });

  const content = lines.join('\n').trim() + '\n';
  await fs.mkdir(path.dirname(args.out), { recursive: true });
  await fs.writeFile(args.out, content, 'utf-8');

  console.log(JSON.stringify({ ok: true, out: args.out, count: papers.length }, null, 2));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
