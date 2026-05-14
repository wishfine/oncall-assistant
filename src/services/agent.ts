import type { AgentResponse, ToolCall } from "../types";
import { safeReadFile } from "./safeReadFile";
import { parseHtmlDocument } from "./htmlParser";

type Intent =
  | "database_replication"
  | "backend_oom"
  | "p0_escalation"
  | "security_intrusion"
  | "recommendation_quality"
  | "frontend"
  | "data_pipeline"
  | "mobile"
  | "qa"
  | "network_cdn"
  | "generic";

interface IntentRule {
  intent: Intent;
  keywords: string[];
  sopFiles: string[];
}

const intentRules: IntentRule[] = [
  {
    intent: "database_replication",
    keywords: ["数据库", "主从", "复制", "延迟", "慢查询", "连接数", "Redis", "MySQL", "SQL", "DBA"],
    sopFiles: ["sop-002.html"],
  },
  {
    intent: "backend_oom",
    keywords: ["OOM", "oom", "服务", "后端", "超时", "连接池", "CPU", "内存", "崩溃", "挂了", "挂掉", "宕机", "JVM", "堆"],
    sopFiles: ["sop-001.html"],
  },
  {
    intent: "p0_escalation",
    keywords: ["P0", "p0", "故障", "升级", "响应流程", "紧急", "恢复"],
    sopFiles: ["sop-001.html", "sop-002.html", "sop-004.html", "sop-005.html", "sop-010.html"],
  },
  {
    intent: "security_intrusion",
    keywords: ["黑客", "攻击", "入侵", "安全", "DDoS", "漏洞", "恶意", "病毒", "木马", "泄露", "注入"],
    sopFiles: ["sop-005.html"],
  },
  {
    intent: "recommendation_quality",
    keywords: ["推荐", "模型", "算法", "AI", "机器学习", "推理", "GPU", "特征", "AB实验", "效果"],
    sopFiles: ["sop-008.html"],
  },
  {
    intent: "frontend",
    keywords: ["前端", "白屏", "页面", "JS", "CORS", "渲染", "浏览器", "CDN资源", "静态资源", "首屏"],
    sopFiles: ["sop-003.html"],
  },
  {
    intent: "data_pipeline",
    keywords: ["数据平台", "ETL", "Flink", "HDFS", "Kafka", "数据质量", "数据延迟", "Spark", "管道"],
    sopFiles: ["sop-006.html"],
  },
  {
    intent: "mobile",
    keywords: ["移动", "App", "app", "iOS", "Android", "客户端", "崩溃", "推送", "审核", "商店", "手机"],
    sopFiles: ["sop-007.html"],
  },
  {
    intent: "qa",
    keywords: ["QA", "测试", "自动化", "性能测试", "测试环境", "Bug", "回归", "用例", "质量"],
    sopFiles: ["sop-009.html"],
  },
  {
    intent: "network_cdn",
    keywords: ["网络", "CDN", "DNS", "负载均衡", "带宽", "丢包", "延迟", "专线", "BGP", "交换机", "路由", "LB"],
    sopFiles: ["sop-010.html"],
  },
];

function classifyIntent(question: string): { intent: Intent; sopFiles: string[] } {
  const q = question.toLowerCase();

  // Score each rule by keyword matches
  let best: { intent: Intent; sopFiles: string[]; score: number } = {
    intent: "generic",
    sopFiles: [],
    score: 0,
  };

  for (const rule of intentRules) {
    let score = 0;
    for (const kw of rule.keywords) {
      if (q.includes(kw.toLowerCase())) score++;
    }
    if (score > best.score) {
      best = { intent: rule.intent, sopFiles: rule.sopFiles, score };
    }
  }

  // If no match, fallback: try to match from sop-index keywords
  if (best.score === 0) {
    const indexContent = safeReadFile("sop-index.md").toLowerCase();
    // Find which SOP section the question keywords appear in
    const sopMatches: string[] = [];
    for (let i = 1; i <= 10; i++) {
      const sopId = `sop-${String(i).padStart(3, "0")}`;
      const sectionStart = indexContent.indexOf(`## ${sopId}`);
      if (sectionStart === -1) continue;
      const nextSection = indexContent.indexOf("## sop-", sectionStart + 5);
      const section = indexContent.slice(
        sectionStart,
        nextSection > 0 ? nextSection : undefined,
      );
      // Check if any question word appears in this section
      const qWords = q.split(/\s+/).filter((w) => w.length > 0);
      const matchCount = qWords.filter((w) => section.includes(w)).length;
      if (matchCount > 0) {
        sopMatches.push(`${sopId}.html`);
      }
    }
    if (sopMatches.length > 0) {
      return { intent: "generic", sopFiles: sopMatches };
    }
  }

  return best;
}

interface SopSection {
  heading: string;
  level: number; // 2 for h2, 3 for h3
  text: string;
}

function extractSections(html: string): SopSection[] {
  // Parse SOP HTML and extract h2/h3 sections
  const doc = parseHtmlDocument("temp", "temp.html", html);
  const sections: SopSection[] = [];

  // Use regex on the parsed text to find heading-bounded sections
  const text = doc.text;

  // Split by headings
  const headingRe = /(一[、．.].+?(?:流程|处理|指标|职责|操作|参考)|二[、．.].+?(?:流程|处理|指标|职责|操作|参考)|三[、．.].+?(?:流程|处理|指标|职责|操作|参考)|四[、．.].+?(?:流程|处理|指标|职责|操作|参考)|五[、．.].+?(?:流程|处理|指标|职责|操作|参考)|六[、．.].+?(?:流程|处理|指标|职责|操作|参考)|场景[一二三四五六七八九十][：:].+)/g;

  const parts = text.split(headingRe);

  // First part before any heading (if text starts with content)
  let i = 0;
  while (i < parts.length) {
    const part = parts[i].trim();
    if (!part) {
      i++;
      continue;
    }

    // Check if this is a heading
    const headingMatch = part.match(headingRe);
    if (headingMatch) {
      // This is a heading — the next part is the content
      const heading = headingMatch[0];
      const content = i + 1 < parts.length ? parts[i + 1].trim() : "";

      let level: number;
      if (/^[一二三四五六]/.test(heading)) {
        level = 2;
      } else if (/^场景/.test(heading)) {
        level = 3;
      } else {
        level = 2;
      }

      sections.push({ heading, level, text: content });
      i += 2;
    } else {
      // Text without heading — treat as content
      if (sections.length === 0) {
        sections.push({ heading: "概述", level: 2, text: part });
      }
      i++;
    }
  }

  return sections;
}

function scoreSections(
  sections: SopSection[],
  question: string,
): SopSection[] {
  const q = question.toLowerCase();
  const scored = sections.map((s) => {
    const text = s.text.toLowerCase();
    const heading = s.heading.toLowerCase();
    let score = 0;

    // Count keyword matches in text
    for (const word of q.split(/\s+/).filter((w) => w.length > 0)) {
      let idx = 0;
      while ((idx = text.indexOf(word, idx)) !== -1) {
        score += 1;
        idx += 1;
      }
    }

    // Heading match bonus
    for (const word of q.split(/\s+/).filter((w) => w.length > 0)) {
      if (heading.includes(word)) {
        score += s.level === 3 ? 3 : 2;
      }
    }

    return { section: s, score };
  });

  scored.sort((a, b) => b.score - a.score);
  return scored.filter((s) => s.score > 0).map((s) => s.section);
}

function buildAnswer(
  question: string,
  intent: Intent,
  allSections: { sopId: string; section: SopSection }[],
  sources: string[],
): string {
  if (allSections.length === 0) {
    return `根据现有 SOP 文档，未找到与「${question}」直接相关的内容。建议联系对应团队值班人员获取帮助。`;
  }

  // Collect relevant info from sections
  const upgradeSteps: string[] = [];
  const processSteps: string[] = [];
  const forbiddenItems: string[] = [];
  const notes: string[] = [];

  for (const { sopId, section } of allSections) {
    const text = section.text.slice(0, 500); // Limit per section
    if (/升级|P0|紧急/.test(section.heading)) {
      upgradeSteps.push(`[${sopId}] ${section.heading}: ${text.slice(0, 200)}`);
    }
    if (/处理|故障|场景/.test(section.heading)) {
      processSteps.push(`[${sopId}] ${section.heading}: ${text.slice(0, 200)}`);
    }
    if (/禁止/.test(section.heading)) {
      const items = text.match(/[一二三四五六七八九十]、[^。；]+/g) || [];
      forbiddenItems.push(...items.slice(0, 5).map((i) => `[${sopId}] ${i}`));
    }
  }

  const sourceList = sources.map((s) => `sop-${s.replace(/\.html$/, "")}.html`).join("、");

  const intentLabel: Record<string, string> = {
    database_replication: "数据库主从复制/延迟问题",
    backend_oom: "后端服务 OOM / 资源类问题",
    p0_escalation: "P0 故障响应",
    security_intrusion: "安全入侵/攻击事件",
    recommendation_quality: "推荐/模型效果下降问题",
    frontend: "前端页面问题",
    data_pipeline: "数据平台/管道问题",
    mobile: "移动端 App 问题",
    qa: "QA/测试问题",
    network_cdn: "网络/CDN 问题",
    generic: "通用 On-Call 问题",
  };

  let answer = `根据 ${sourceList}，这是${intentLabel[intent] || "On-Call 问题"}。\n\n`;

  if (processSteps.length > 0) {
    answer += "建议按以下步骤处理：\n";
    for (let i = 0; i < Math.min(processSteps.length, 5); i++) {
      answer += `${i + 1}. ${processSteps[i]}\n`;
    }
    answer += "\n";
  }

  if (upgradeSteps.length > 0) {
    answer += "升级条件：\n";
    for (const step of upgradeSteps.slice(0, 3)) {
      answer += `- ${step}\n`;
    }
    answer += "\n";
  }

  if (forbiddenItems.length > 0) {
    answer += "禁止/注意：\n";
    for (const item of forbiddenItems.slice(0, 5)) {
      answer += `- ${item}\n`;
    }
    answer += "\n";
  }

  if (sources.length > 0) {
    answer += `来源：\n`;
    for (const s of sources) {
      answer += `- ${s} / 相关章节\n`;
    }
  }

  return answer.trim();
}

// ── Main Agent Entry Point ──────────────────────────────────────

export async function runAgent(question: string): Promise<AgentResponse> {
  const toolCalls: ToolCall[] = [];

  // Step 1: Read sop-index.md
  let indexContent: string;
  try {
    indexContent = safeReadFile("sop-index.md");
    toolCalls.push({
      tool: "readFile",
      args: { fname: "sop-index.md" },
      observation: `读取成功，${indexContent.length} 字符`,
    });
  } catch (e) {
    toolCalls.push({
      tool: "readFile",
      args: { fname: "sop-index.md" },
      observation: `读取失败: ${(e as Error).message}`,
    });
    return {
      answer: "无法读取 SOP 索引文件，请检查服务状态。",
      toolCalls,
      sources: [],
    };
  }

  // Step 2: Classify intent and select SOP files
  const { intent, sopFiles } = classifyIntent(question);

  // Step 3: Read selected SOP files
  const allSections: { sopId: string; section: SopSection }[] = [];
  const sources: string[] = [];

  for (const fname of sopFiles) {
    try {
      const html = safeReadFile(fname);
      const sections = extractSections(html);
      const relevant = scoreSections(sections, question);

      const summary =
        relevant.length > 0
          ? `提取到 ${relevant.length} 个相关章节：${relevant.map((s) => s.heading).join("、")}`
          : `读取成功，未找到高度相关章节`;

      toolCalls.push({
        tool: "readFile",
        args: { fname },
        observation: `${summary}（文件长度 ${html.length} 字符）`,
      });

      for (const s of relevant.slice(0, 5)) {
        allSections.push({ sopId: fname.replace(/\.html$/, ""), section: s });
      }
      sources.push(fname);
    } catch (e) {
      toolCalls.push({
        tool: "readFile",
        args: { fname },
        observation: `读取失败: ${(e as Error).message}`,
      });
    }
  }

  // Step 4: Build answer
  const answer = buildAnswer(question, intent, allSections, sources);

  return { answer, toolCalls, sources };
}
