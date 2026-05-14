#!/usr/bin/env bash
# smoke.sh — On-Call Assistant 验收脚本
# 使用前提：服务已启动在 localhost:3000
# 用法：bash scripts/smoke.sh

set -euo pipefail

BASE="${SMOKE_BASE:-http://localhost:3000}"
PASS=0
FAIL=0
RED='\033[0;31m'
GREEN='\033[0;32m'
NC='\033[0m' # No Color

check() {
  local label="$1"
  local method="$2"
  local url="$3"
  local data="$4"
  local expect="$5"
  local jq_filter="$6"

  if [ "$method" = "POST" ]; then
    resp=$(curl -s -X POST "${BASE}${url}" \
      -H 'Content-Type: application/json' \
      -d "${data}" 2>/dev/null || echo '{"error":"curl failed"}')
  else
    resp=$(curl -s "${BASE}${url}" 2>/dev/null || echo '{"error":"curl failed"}')
  fi

  local actual
  actual=$(echo "$resp" | python3 -c "import sys,json; d=json.load(sys.stdin); print(${jq_filter})" 2>/dev/null || echo "PARSE_ERROR")

  if echo "$actual" | grep -qF "$expect" 2>/dev/null; then
    echo -e "  ${GREEN}PASS${NC} $label"
    PASS=$((PASS + 1))
  else
    echo -e "  ${RED}FAIL${NC} $label (expected to contain: $expect, got: $actual)"
    FAIL=$((FAIL + 1))
  fi
}

check_contains() {
  local label="$1"
  local method="$2"
  local url="$3"
  local data="$4"
  local expect="$5"

  if [ "$method" = "POST" ]; then
    resp=$(curl -s -X POST "${BASE}${url}" \
      -H 'Content-Type: application/json' \
      -d "${data}" 2>/dev/null || echo '{"error":"curl failed"}')
  else
    resp=$(curl -s "${BASE}${url}" 2>/dev/null || echo '{"error":"curl failed"}')
  fi

  if echo "$resp" | grep -qF "$expect" 2>/dev/null; then
    echo -e "  ${GREEN}PASS${NC} $label"
    PASS=$((PASS + 1))
  else
    echo -e "  ${RED}FAIL${NC} $label (response does not contain: $expect)"
    FAIL=$((FAIL + 1))
  fi
}

check_count_gt() {
  local label="$1"
  local url="$2"
  local min="$3"

  resp=$(curl -s "${BASE}${url}" 2>/dev/null || echo '{"results":[]}')
  count=$(echo "$resp" | python3 -c "import sys,json; print(len(json.load(sys.stdin)['results']))" 2>/dev/null || echo "0")

  if [ "$count" -gt "$min" ]; then
    echo -e "  ${GREEN}PASS${NC} $label (got $count results)"
    PASS=$((PASS + 1))
  else
    echo -e "  ${RED}FAIL${NC} $label (expected >$min results, got $count)"
    FAIL=$((FAIL + 1))
  fi
}

check_count_eq() {
  local label="$1"
  local url="$2"
  local expect="$3"

  resp=$(curl -s "${BASE}${url}" 2>/dev/null || echo '{"results":[]}')
  count=$(echo "$resp" | python3 -c "import sys,json; print(len(json.load(sys.stdin)['results']))" 2>/dev/null || echo "0")

  if [ "$count" -eq "$expect" ]; then
    echo -e "  ${GREEN}PASS${NC} $label (got $count results)"
    PASS=$((PASS + 1))
  else
    echo -e "  ${RED}FAIL${NC} $label (expected $expect results, got $count)"
    FAIL=$((FAIL + 1))
  fi
}

echo "========================================"
echo "On-Call Assistant Smoke Tests"
echo "Base URL: $BASE"
echo "========================================"

# ── Health ────────────────────────────────────────────────────
echo ""
echo "[Health]"
check "Health endpoint" "GET" "/health" "" "ok" "d.get('ok')"

# ── Phase 1 ───────────────────────────────────────────────────
echo ""
echo "[Phase 1 — Keyword Search]"
check "OOM → sop-001" "GET" "/v1/search?q=OOM" "" "sop-001" "','.join([r.get('id','') for r in d['results']])"
check_count_gt "故障 → multiple" "/v1/search?q=%E6%95%85%E9%9A%9C" 1
check_count_eq "replication → empty" "/v1/search?q=replication" 0
check "CDN → sop-003 + sop-010" "GET" "/v1/search?q=CDN" "" "sop-003" "','.join([r.get('id','') for r in d['results']])"
check "CDN → sop-010" "GET" "/v1/search?q=CDN" "" "sop-010" "','.join([r.get('id','') for r in d['results']])"
check_contains "%26 → results" "GET" "/v1/search?q=%26" "" "&"
check_contains "case-insensitive oom" "GET" "/v1/search?q=oom" "" "sop-001"

# ── Phase 2 ───────────────────────────────────────────────────
echo ""
echo "[Phase 2 — Semantic Search]"
check "服务器挂了" "GET" "/v2/search?q=%E6%9C%8D%E5%8A%A1%E5%99%A8%E6%8C%82%E4%BA%86" "" "sop-001" "','.join([r.get('id','') for r in d['results']])"
check "黑客攻击 → sop-005" "GET" "/v2/search?q=%E9%BB%91%E5%AE%A2%E6%94%BB%E5%87%BB" "" "sop-005" "d['results'][0]['id']"
check "ML模型 → sop-008" "GET" "/v2/search?q=%E6%9C%BA%E5%99%A8%E5%AD%A6%E4%B9%A0%E6%A8%A1%E5%9E%8B%E5%87%BA%E9%97%AE%E9%A2%98" "" "sop-008" "d['results'][0]['id']"

# ── Phase 3 ───────────────────────────────────────────────────
echo ""
echo "[Phase 3 — Agent]"
check_contains "DB replication" "POST" "/v3/chat" '{"message":"数据库主从延迟超过30秒怎么处理？"}' "sop-002"
check_contains "OOM" "POST" "/v3/chat" '{"message":"服务 OOM 了怎么办？"}' "sop-001"
check_contains "P0" "POST" "/v3/chat" '{"message":"P0 故障的响应流程是什么？"}' "升级"
check_contains "Intrusion" "POST" "/v3/chat" '{"message":"怀疑有人入侵了系统"}' "sop-005"
check_contains "Recommendation" "POST" "/v3/chat" '{"message":"推荐结果质量下降了"}' "sop-008"

# ── Summary ───────────────────────────────────────────────────
echo ""
echo "========================================"
TOTAL=$((PASS + FAIL))
echo "Results: $PASS / $TOTAL passed"
if [ $FAIL -eq 0 ]; then
  echo -e "${GREEN}All smoke tests passed!${NC}"
  exit 0
else
  echo -e "${RED}$FAIL test(s) failed${NC}"
  exit 1
fi
