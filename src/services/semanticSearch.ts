import type { DocumentRecord, SearchResult } from "../types";
import { listDocuments, getRepositoryVersion } from "./documentRepository";
import { keywordSearch } from "./keywordSearch";

// ── Concept Dictionary ──────────────────────────────────────────

interface DomainEntry {
  triggers: string[];
  expansions: string[];
  anchors: string[];
}

const domainDict: DomainEntry[] = [
  {
    triggers: ["服务器", "挂了", "不可用", "服务异常", "服务", "后端", "OOM", "oom", "崩溃", "挂掉", "宕机"],
    expansions: ["服务", "超时", "故障", "Kubernetes", "Pod", "Ingress", "节点", "集群", "CPU", "内存", "OOM"],
    anchors: ["服务", "后端"],
  },
  {
    triggers: ["黑客", "攻击", "入侵", "安全", "恶意", "病毒", "木马", "泄露"],
    expansions: ["安全", "DDoS", "SQL注入", "WAF", "SIEM", "恶意软件", "入侵", "数据泄露", "攻击"],
    anchors: ["安全"],
  },
  {
    triggers: ["机器学习", "模型", "推荐", "AI", "算法", "智能", "推理", "训练", "GPU"],
    expansions: ["模型", "推理", "推荐", "效果下降", "GPU", "特征", "AB实验", "算法"],
    anchors: ["模型", "算法"],
  },
  {
    triggers: ["数据库", "主从", "复制", "延迟", "慢查询", "连接数", "MySQL", "Redis", "DBA", "SQL", "存储"],
    expansions: ["数据库", "MySQL", "PostgreSQL", "Redis", "复制", "延迟", "慢查询", "连接", "磁盘"],
    anchors: ["数据库"],
  },
  {
    triggers: ["前端", "页面", "白屏", "JS", "CORS", "web", "Web", "渲染", "浏览器", "CDN", "静态资源"],
    expansions: ["前端", "页面", "白屏", "JS", "CORS", "渲染", "CDN", "静态资源", "性能"],
    anchors: ["前端"],
  },
  {
    triggers: ["数据平台", "ETL", "Flink", "HDFS", "Kafka", "Spark", "数据质量", "数据延迟", "数据管道"],
    expansions: ["数据", "ETL", "Flink", "HDFS", "Kafka", "数据质量", "延迟", "管道"],
    anchors: ["数据"],
  },
  {
    triggers: ["移动", "App", "app", "APP", "iOS", "Android", "崩溃", "推送", "审核", "商店", "客户端", "手机"],
    expansions: ["移动", "App", "崩溃", "推送", "审核", "网络请求", "OOM", "移动端"],
    anchors: ["移动"],
  },
  {
    triggers: ["QA", "测试", "自动化", "性能测试", "测试环境", "Bug", "bug", "回归", "用例", "质量保障"],
    expansions: ["测试", "自动化", "性能测试", "回归", "用例", "质量"],
    anchors: ["测试"],
  },
  {
    triggers: ["网络", "CDN", "DNS", "负载均衡", "LB", "带宽", "延迟", "丢包", "专线", "BGP", "交换机", "路由"],
    expansions: ["网络", "CDN", "DNS", "负载均衡", "带宽", "延迟", "丢包", "节点"],
    anchors: ["网络", "CDN"],
  },
];

// ── Tokenizer ───────────────────────────────────────────────────

function tokenize(text: string): string[] {
  const tokens: string[] = [];
  const lower = text.toLowerCase();

  // Collect CJK runs and non-CJK tokens
  let i = 0;
  while (i < lower.length) {
    const ch = lower[i];
    if (/[一-鿿]/.test(ch)) {
      // CJK character — collect run for bigrams
      const run: string[] = [];
      while (i < lower.length && /[一-鿿]/.test(lower[i])) {
        run.push(lower[i]);
        i++;
      }
      // Add unigrams
      for (const c of run) tokens.push(c);
      // Add bigrams
      for (let j = 0; j < run.length - 1; j++) {
        tokens.push(run[j] + run[j + 1]);
      }
      // Add trigrams for longer runs
      for (let j = 0; j < run.length - 2; j++) {
        tokens.push(run[j] + run[j + 1] + run[j + 2]);
      }
    } else if (/[a-zA-Z0-9]/.test(ch)) {
      // English/alphanumeric token
      let word = "";
      while (i < lower.length && /[a-zA-Z0-9]/.test(lower[i])) {
        word += lower[i];
        i++;
      }
      tokens.push(word);
    } else {
      i++; // skip punctuation, whitespace
    }
  }

  return tokens;
}

// ── TF-IDF ──────────────────────────────────────────────────────

function buildTfidfVectors(docs: DocumentRecord[]): {
  vectors: Map<string, Map<string, number>>;
  idf: Map<string, number>;
} {
  const N = docs.length;
  const docTokens: string[][] = [];
  const df = new Map<string, number>(); // document frequency

  for (const doc of docs) {
    const titleTokens = tokenize(doc.title);
    const textTokens = tokenize(doc.text);

    // Title tokens x4, text tokens x1
    const tokens: string[] = [];
    for (const t of titleTokens) {
      tokens.push(t, t, t, t);
    }
    for (const t of textTokens) {
      tokens.push(t);
    }

    docTokens.push(tokens);

    // Count document frequency (unique per doc)
    const unique = new Set(tokens);
    for (const t of unique) {
      df.set(t, (df.get(t) || 0) + 1);
    }
  }

  // IDF: log(N / df) with smoothing
  const idf = new Map<string, number>();
  for (const [token, count] of df) {
    idf.set(token, Math.log((N + 1) / (count + 1)) + 1);
  }

  // TF-IDF vectors
  const vectors = new Map<string, Map<string, number>>();
  for (let i = 0; i < docs.length; i++) {
    const vec = new Map<string, number>();
    const tokens = docTokens[i];
    const total = tokens.length || 1;

    // Count term frequencies
    const tfCount = new Map<string, number>();
    for (const t of tokens) {
      tfCount.set(t, (tfCount.get(t) || 0) + 1);
    }

    // TF-IDF
    for (const [t, count] of tfCount) {
      const tf = count / total;
      const idfVal = idf.get(t) || 0;
      vec.set(t, tf * idfVal);
    }

    vectors.set(docs[i].id, vec);
  }

  return { vectors, idf };
}

// ── Query Expansion ─────────────────────────────────────────────

interface TokenWeight {
  token: string;
  weight: number;
}

function expandQuery(rawQuery: string): TokenWeight[] {
  const rawTokens = tokenize(rawQuery);
  if (rawTokens.length === 0) return [];

  const result: TokenWeight[] = [];
  const seen = new Set<string>();

  // Add original tokens with x2 weight
  for (const t of rawTokens) {
    if (!seen.has(t)) {
      result.push({ token: t, weight: 2 });
      seen.add(t);
    }
  }

  // Check against domain dictionary — use substring match on raw query
  const qLower = rawQuery.toLowerCase();
  for (const domain of domainDict) {
    let triggered = false;
    for (const trigger of domain.triggers) {
      if (qLower.includes(trigger.toLowerCase())) {
        triggered = true;
        break;
      }
    }
    if (!triggered) continue;

    // Add expansion words (x1)
    for (const w of domain.expansions) {
      if (!seen.has(w)) {
        result.push({ token: w, weight: 1 });
        seen.add(w);
      }
    }

    // Add domain anchors (x1.5)
    for (const a of domain.anchors) {
      if (!seen.has(a)) {
        result.push({ token: a, weight: 1.5 });
        seen.add(a);
      }
    }
  }

  return result;
}

// ── Cosine Similarity ───────────────────────────────────────────

function cosineSimilarity(
  vecA: Map<string, number>,
  vecB: Map<string, number>,
): number {
  let dot = 0;
  let normA = 0;
  let normB = 0;

  for (const [token, weightA] of vecA) {
    const weightB = vecB.get(token) || 0;
    dot += weightA * weightB;
    normA += weightA * weightA;
  }

  for (const [, weightB] of vecB) {
    normB += weightB * weightB;
  }

  if (normA === 0 || normB === 0) return 0;
  return dot / (Math.sqrt(normA) * Math.sqrt(normB));
}

// ── Snippet from text ───────────────────────────────────────────

function makeSemanticSnippet(text: string, maxLen = 150): string {
  const normalized = text.replace(/\s+/g, " ").trim();
  if (normalized.length <= maxLen) return normalized;
  return normalized.slice(0, maxLen) + "…";
}

// ── TF-IDF Cache ────────────────────────────────────────────────

let cachedVectors: Map<string, Map<string, number>> | null = null;
let cachedVersion = -1;

function getOrBuildVectors(
  docs: DocumentRecord[],
): Map<string, Map<string, number>> {
  const version = getRepositoryVersion();
  if (cachedVectors && version === cachedVersion) {
    return cachedVectors;
  }
  const { vectors } = buildTfidfVectors(docs);
  cachedVectors = vectors;
  cachedVersion = version;
  return vectors;
}

// ── Main Search ─────────────────────────────────────────────────

export function semanticSearch(query: string): SearchResult[] {
  if (!query) return [];

  const docs = listDocuments();
  if (docs.length === 0) return [];

  const expanded = expandQuery(query);
  if (expanded.length === 0) return [];

  // Build query vector from expanded tokens
  const queryVec = new Map<string, number>();
  for (const { token, weight } of expanded) {
    queryVec.set(token, (queryVec.get(token) || 0) + weight);
  }

  // Get or build TF-IDF vectors (cached when doc count unchanged)
  const vectors = getOrBuildVectors(docs);

  // Compute cosine similarity for each document
  const results: SearchResult[] = [];
  for (const doc of docs) {
    const docVec = vectors.get(doc.id);
    if (!docVec) continue;

    let score = cosineSimilarity(queryVec, docVec);

    // Title exact match bonus
    if (doc.title.toLowerCase().includes(query.toLowerCase())) {
      score += 0.1;
    }

    // Cap at 1.0 for normalized semantic relevance
    score = Math.min(1, score);

    if (score <= 0) continue;

    results.push({
      id: doc.id,
      title: doc.title,
      snippet: makeSemanticSnippet(doc.text),
      score: Math.round(score * 100) / 100,
    });
  }

  results.sort((a, b) => b.score - a.score);

  // Fallback to keyword search if no results
  if (results.length === 0) {
    return keywordSearch(query);
  }

  return results;
}
