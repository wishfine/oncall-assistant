import type { AgentResponse, ToolCall } from "../types";
import { safeReadFile } from "./safeReadFile";
import { parseHtmlDocument } from "./htmlParser";
import { ensureSopIndex } from "./sopIndexGenerator";

// ── Tool Runtime ───────────────────────────────────────────────

type ToolName = "readFile";

const toolImplementations: Record<ToolName, (args: { fname: string }) => string> = {
  readFile: (args) => safeReadFile(args.fname),
};

function callTool(tool: ToolName, args: { fname: string }): string {
  return toolImplementations[tool](args);
}

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
  scoringKeywords: string[]; // used for section scoring after SOP is read
  sopFiles: string[];
}

const intentRules: IntentRule[] = [
  {
    intent: "database_replication",
    keywords: ["数据库", "主从", "复制", "延迟", "慢查询", "连接数", "Redis", "MySQL", "SQL", "DBA"],
    scoringKeywords: [
      "主从", "复制", "延迟", "Binlog", "慢查询", "只读", "连接", "磁盘", "Redis",
      "内存", "DBA", "数据库", "备份", "恢复", "事务", "锁", "SHOW",
    ],
    sopFiles: ["sop-002.html"],
  },
  {
    intent: "backend_oom",
    keywords: ["OOM", "oom", "服务", "后端", "超时", "连接池", "CPU", "内存", "崩溃", "挂了", "挂掉", "宕机", "JVM", "堆"],
    scoringKeywords: [
      "OOM", "服务", "超时", "CPU", "内存", "JVM", "堆", "连接池", "队列",
      "崩溃", "扩容", "回滚", "配置", "线程", "死锁", "Pod", "进程",
    ],
    sopFiles: ["sop-001.html"],
  },
  {
    intent: "p0_escalation",
    keywords: ["P0", "p0", "故障", "升级", "响应流程", "紧急", "恢复"],
    scoringKeywords: [
      "P0", "升级", "故障", "紧急", "响应", "恢复", "值班", "通知", "团队",
      "五分钟", "三分钟", "总监", "VP",
    ],
    sopFiles: ["sop-001.html", "sop-002.html", "sop-004.html", "sop-005.html"],
  },
  {
    intent: "security_intrusion",
    keywords: ["黑客", "攻击", "入侵", "安全", "DDoS", "漏洞", "恶意", "病毒", "木马", "泄露", "注入"],
    scoringKeywords: [
      "安全", "入侵", "DDoS", "攻击", "漏洞", "恶意", "SIEM", "WAF", "隔离",
      "取证", "日志", "升级", "响应", "防火墙", "SQL", "注入", "事件",
    ],
    sopFiles: ["sop-005.html"],
  },
  {
    intent: "recommendation_quality",
    keywords: ["推荐", "模型", "算法", "AI", "机器学习", "推理", "GPU", "特征", "AB实验", "效果"],
    scoringKeywords: [
      "模型", "推荐", "推理", "GPU", "特征", "AB实验", "效果", "下降", "训练",
      "算法", "延迟", "服务", "资源",
    ],
    sopFiles: ["sop-008.html"],
  },
  {
    intent: "frontend",
    keywords: ["前端", "白屏", "页面", "JS", "CORS", "渲染", "浏览器", "CDN资源", "静态资源", "首屏"],
    scoringKeywords: [
      "前端", "白屏", "JS", "CORS", "渲染", "CDN", "静态", "页面", "性能", "错误",
    ],
    sopFiles: ["sop-003.html"],
  },
  {
    intent: "data_pipeline",
    keywords: ["数据平台", "ETL", "Flink", "HDFS", "Kafka", "数据质量", "数据延迟", "Spark", "管道"],
    scoringKeywords: [
      "ETL", "Flink", "HDFS", "Kafka", "数据", "Spark", "管道", "质量", "延迟",
    ],
    sopFiles: ["sop-006.html"],
  },
  {
    intent: "mobile",
    keywords: ["移动", "App", "app", "iOS", "Android", "客户端", "崩溃", "推送", "审核", "商店", "手机"],
    scoringKeywords: [
      "App", "崩溃", "iOS", "Android", "移动", "推送", "审核", "网络", "商店",
    ],
    sopFiles: ["sop-007.html"],
  },
  {
    intent: "qa",
    keywords: ["QA", "测试", "自动化", "性能测试", "测试环境", "Bug", "回归", "用例", "质量"],
    scoringKeywords: [
      "测试", "自动化", "性能", "回归", "用例", "Bug", "环境", "验证",
    ],
    sopFiles: ["sop-009.html"],
  },
  {
    intent: "network_cdn",
    keywords: ["网络", "CDN", "DNS", "负载均衡", "带宽", "丢包", "延迟", "专线", "BGP", "交换机", "路由", "LB"],
    scoringKeywords: [
      "网络", "CDN", "DNS", "负载均衡", "带宽", "丢包", "延迟", "BGP", "交换机",
      "路由", "DDoS", "节点", "流量",
    ],
    sopFiles: ["sop-010.html"],
  },
];

/**
 * Parse sop-index.md into a map of SOP filename → keywords from that section.
 */
function parseIndexKeywords(indexContent: string): Map<string, string[]> {
  const map = new Map<string, string[]>();

  for (let i = 1; i <= 10; i++) {
    const sopId = `sop-${String(i).padStart(3, "0")}`;
    const sectionStart = indexContent.indexOf(`## ${sopId}`);
    if (sectionStart === -1) continue;

    const nextSection = indexContent.indexOf("\n## sop-", sectionStart + 5);
    const section = indexContent.slice(
      sectionStart,
      nextSection > 0 ? nextSection : undefined,
    );

    // Extract keywords from the index section
    const kwMatch = section.match(/\*\*关键词\*\*[：:]\s*(.+)/);
    const typicalMatch = section.match(/\*\*典型问题\*\*[：:]\s*(.+)/);

    const keywords: string[] = [];
    if (kwMatch) {
      keywords.push(...kwMatch[1].split(/[,，、]/).map((k) => k.trim()));
    }
    if (typicalMatch) {
      keywords.push(...typicalMatch[1].split(/[,，、]/).map((k) => k.trim()));
    }

    map.set(`${sopId}.html`, keywords);
  }

  return map;
}

function classifyIntent(
  question: string,
  indexContent: string,
): { intent: Intent; sopFiles: string[] } {
  const q = question.toLowerCase();
  const indexLower = indexContent.toLowerCase();

  // ── Primary: score each SOP via its index keywords ──────────
  const indexKeywords = parseIndexKeywords(indexContent);
  const sopScores: { fname: string; score: number }[] = [];

  for (const [fname, keywords] of indexKeywords) {
    let score = 0;
    for (const kw of keywords) {
      if (q.includes(kw.toLowerCase())) score++;
    }
    if (score > 0) {
      sopScores.push({ fname, score });
    }
  }

  // ── Supplement: search CJK bigrams in index text ────────────
  const searchTerms = new Set<string>();
  for (let i = 0; i < q.length - 1; i++) {
    const pair = q.slice(i, i + 2);
    if (/^[一-鿿]{2}$/.test(pair)) searchTerms.add(pair);
  }
  for (const w of q.split(/\s+/)) {
    const cleaned = w.replace(/[^a-z0-9]/g, "");
    if (cleaned.length > 0) searchTerms.add(cleaned);
  }

  for (const [fname, keywords] of indexKeywords) {
    // Find the index section for this SOP
    const sopId = fname.replace(/\.html$/, "");
    const sectionStart = indexLower.indexOf(`## ${sopId}`);
    if (sectionStart === -1) continue;
    const nextSection = indexLower.indexOf("\n## sop-", sectionStart + 5);
    const section = indexLower.slice(
      sectionStart,
      nextSection > 0 ? nextSection : undefined,
    );

    let bigramScore = 0;
    for (const term of searchTerms) {
      if (section.includes(term)) bigramScore++;
    }

    if (bigramScore > 0) {
      const existing = sopScores.find((s) => s.fname === fname);
      if (existing) {
        existing.score += bigramScore;
      } else {
        sopScores.push({ fname, score: bigramScore });
      }
    }
  }

  // ── Bonus: intent-rule weighting ────────────────────────────
  let bestRule: { intent: Intent; score: number } = {
    intent: "generic",
    score: 0,
  };

  for (const rule of intentRules) {
    let ruleScore = 0;
    for (const kw of rule.keywords) {
      if (q.includes(kw.toLowerCase())) ruleScore++;
    }
    if (ruleScore > bestRule.score) {
      bestRule = { intent: rule.intent, score: ruleScore };
    }

    // Add bonus to index-based SOP scores
    if (ruleScore > 0) {
      for (const fname of rule.sopFiles) {
        const existing = sopScores.find((s) => s.fname === fname);
        if (existing) {
          existing.score += ruleScore;
        } else {
          sopScores.push({ fname, score: ruleScore });
        }
      }
    }
  }

  sopScores.sort((a, b) => b.score - a.score);

  // Select top SOPs (P0 uses more)
  const maxFiles = bestRule.intent === "p0_escalation" ? 5 : 3;
  const sopFiles = sopScores.slice(0, maxFiles).map((s) => s.fname);

  // Fallback: if nothing matched, return at least sop-001
  if (sopFiles.length === 0) {
    return { intent: "generic", sopFiles: ["sop-001.html"] };
  }

  return { intent: bestRule.intent, sopFiles };
}

// ── Section extraction ───────────────────────────────────────────

interface SopSection {
  heading: string;
  level: number;
  text: string;
}

function extractSections(html: string): SopSection[] {
  const doc = parseHtmlDocument("temp", "temp.html", html);
  const text = doc.text;
  const sections: SopSection[] = [];

  // Headings: 一、... 到 六、... plus 场景X：
  const headingRe =
    /(一[、．.]值班职责|二[、．.]监控指标|三[、．.]常见故障处理|四[、．.]升级流程|五[、．.]禁止操作|六[、．.]工具[^\n]*|场景[一二三四五六七八九十]+[：:][^\n]+)/g;

  const parts: { heading: string; content: string }[] = [];
  let lastIdx = 0;
  let match: RegExpExecArray | null;

  while ((match = headingRe.exec(text)) !== null) {
    const heading = match[0];
    const start = match.index;

    // Text before this heading belongs to previous section or preamble
    if (parts.length === 0 && start > 0) {
      const preamble = text.slice(0, start).trim();
      if (preamble.length > 20) {
        parts.push({ heading: "概述", content: preamble });
      }
    } else if (parts.length > 0) {
      // Close previous section's content up to this heading
      parts[parts.length - 1].content = text
        .slice(lastIdx, start)
        .trim();
    }

    parts.push({ heading, content: "" });
    lastIdx = match.index + heading.length;
  }

  // Last section content
  if (parts.length > 0 && lastIdx < text.length) {
    parts[parts.length - 1].content = text.slice(lastIdx).trim();
  }

  // Fallback: if regex didn't match, just split on heading patterns
  if (parts.length === 0) {
    const altHeadings = /(值班职责|监控指标|常见故障|升级流程|禁止操作|工具与命令)/g;
    const altParts = text.split(altHeadings);
    for (let i = 0; i < altParts.length; i++) {
      if (altParts[i].match(altHeadings)) {
        const heading = altParts[i];
        const content = i + 1 < altParts.length ? altParts[i + 1].trim() : "";
        parts.push({ heading, content });
        i++; // skip content
      }
    }
  }

  for (const p of parts) {
    let level = 2;
    if (/^场景/.test(p.heading)) level = 3;
    sections.push({ heading: p.heading, level, text: p.content });
  }

  return sections;
}

// ── Section scoring with intent-specific keywords ────────────────

function getScoringKeywords(
  intent: Intent,
  question: string,
): string[] {
  // Start with intent-specific scoring keywords
  const rule = intentRules.find((r) => r.intent === intent);
  const kwSet = new Set(rule?.scoringKeywords || []);

  // Also extract any CJK bigrams from the question as fallback
  const q = question.toLowerCase();
  for (let i = 0; i < q.length - 1; i++) {
    const pair = q.slice(i, i + 2);
    if (/^[一-鿿]{2}$/.test(pair)) {
      kwSet.add(pair);
    }
  }
  // Add English words
  for (const w of q.split(/\s+/)) {
    if (w.length > 0) kwSet.add(w);
  }

  return Array.from(kwSet);
}

function scoreSections(
  sections: SopSection[],
  question: string,
  intent: Intent,
): SopSection[] {
  const keywords = getScoringKeywords(intent, question);

  const scored = sections.map((s) => {
    const text = s.text.toLowerCase();
    const heading = s.heading.toLowerCase();
    let score = 0;

    for (const kw of keywords) {
      const kwLower = kw.toLowerCase();
      if (kwLower.length < 2) continue; // skip single chars

      // Count matches in text
      let idx = 0;
      while ((idx = text.indexOf(kwLower, idx)) !== -1) {
        score += 1;
        idx += kwLower.length;
      }

      // Heading match bonus
      if (heading.includes(kwLower)) {
        score += s.level === 3 ? 3 : 2;
      }
    }

    return { section: s, score };
  });

  scored.sort((a, b) => b.score - a.score);
  return scored.filter((s) => s.score > 0).map((s) => s.section);
}

// ── Answer building ──────────────────────────────────────────────

function buildAnswer(
  question: string,
  intent: Intent,
  allSections: { sopId: string; section: SopSection }[],
  sources: string[],
): string {
  if (allSections.length === 0) {
    return `根据现有 SOP 文档，未找到与「${question}」直接相关的内容。建议联系对应团队值班人员获取帮助。`;
  }

  const upgradeSteps: string[] = [];
  const processSteps: string[] = [];
  const forbiddenItems: string[] = [];

  for (const { sopId, section } of allSections) {
    const text = section.text.slice(0, 500);
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

  const sourceList = sources.join("、");

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

export interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

export async function runAgent(
  question: string,
  history?: ChatMessage[],
): Promise<AgentResponse> {
  const toolCalls: ToolCall[] = [];

  // If history provided, prepend recent context to the question
  let contextualQuestion = question;
  if (history && history.length > 0) {
    const recentUser = history
      .filter((m) => m.role === "user")
      .slice(-3)
      .map((m) => m.content)
      .join("；");
    if (recentUser && !recentUser.includes(question)) {
      contextualQuestion = `${recentUser}；${question}`;
    }
  }

  // Ensure sop-index.md is fresh
  try {
    ensureSopIndex();
  } catch {
    // Non-fatal: proceed with existing index
  }

  // Step 1: Read sop-index.md via the readFile tool
  let indexContent: string;
  try {
    indexContent = callTool("readFile", { fname: "sop-index.md" });
    toolCalls.push({
      tool: "readFile",
      args: { fname: "sop-index.md" },
      reason: "需要先读取 SOP 索引以定位相关文档",
      observation: `读取成功，${indexContent.length} 字符`,
    });
  } catch (e) {
    toolCalls.push({
      tool: "readFile",
      args: { fname: "sop-index.md" },
      reason: "需要先读取 SOP 索引以定位相关文档",
      observation: `读取失败: ${(e as Error).message}`,
    });
    return {
      answer: "无法读取 SOP 索引文件，请检查服务状态。",
      toolCalls,
      sources: [],
    };
  }

  // Step 2: Classify intent and select SOP files via sop-index.md
  const { intent, sopFiles } = classifyIntent(contextualQuestion, indexContent);

  // Step 3: Read selected SOP files via the readFile tool
  const allSections: { sopId: string; section: SopSection }[] = [];
  const sources: string[] = [];

  for (const fname of sopFiles) {
    try {
      const html = callTool("readFile", { fname });
      const sections = extractSections(html);
      const relevant = scoreSections(sections, contextualQuestion, intent);

      const summary =
        relevant.length > 0
          ? `提取到 ${relevant.length} 个相关章节：${relevant.map((s) => s.heading).join("、")}`
          : `读取成功，未找到高度相关章节`;

      toolCalls.push({
        tool: "readFile",
        args: { fname },
        reason: `用户问题与索引中 ${fname} 的关键词匹配，需要读取该 SOP 获取详细处理流程`,
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
        reason: `索引匹配到 ${fname}，尝试读取`,
        observation: `读取失败: ${(e as Error).message}`,
      });
    }
  }

  // Step 4: Build answer
  const answer = buildAnswer(contextualQuestion, intent, allSections, sources);

  return { answer, toolCalls, sources };
}
