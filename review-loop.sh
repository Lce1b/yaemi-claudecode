#!/bin/bash
# 独立进程审查循环 — 每轮 claude -p 全新进程，天然隔离无偏见
# 用法: ./review-loop.sh [间隔秒数] [最大轮次]
set -e

INTERVAL=${1:-60}
MAX_ROUNDS=${2:-20}
PROJECT_DIR="$(cd "$(dirname "$0")" && pwd)"
RATING_FILE="$PROJECT_DIR/review_rating.md"
PROMPT_FILE="$PROJECT_DIR/review-prompt.md"

echo "=== Review Loop ==="
echo "项目:   $PROJECT_DIR"
echo "间隔:   ${INTERVAL}s"
echo "上限:   $MAX_ROUNDS 轮"
echo "机制:   每轮全新 claude -p 进程"
echo "================================"

# 初始化
if [ ! -f "$RATING_FILE" ]; then
  echo "# 代码审查评级" > "$RATING_FILE"
  echo "" >> "$RATING_FILE"
  echo "> 待首次审查..." >> "$RATING_FILE"
fi

for ((round=1; round<=MAX_ROUNDS; round++)); do
  echo ""
  echo "━━━━━━━━━━ 第 $round 轮 ━━━━━━━━━━"
  echo "$(date '+%H:%M:%S') 启动独立审查..."

  # 生成本轮 prompt
  sed "s|PROJECT_DIR_PLACEHOLDER|$PROJECT_DIR|g; s|ROUND_PLACEHOLDER|$round|g" "$PROMPT_FILE" > /tmp/review-prompt-round-$round.md

  # 全新进程审查+修复
  cd "$PROJECT_DIR"
  claude -p "$(cat /tmp/review-prompt-round-$round.md)" 2>&1
  EXIT_CODE=$?

  # 检查结果
  if grep -qi "ALL_PASSED" "$RATING_FILE" 2>/dev/null; then
    echo ""
    echo "══════════════════════════════════"
    echo "  ✓  全部维度 A 级 — 审查通过！"
    echo "     总轮次: $round"
    echo "══════════════════════════════════"
    rm -f /tmp/review-prompt-round-*.md
    exit 0
  fi

  # 统计非A维度
  NON_A=$(grep -cP '^\|.*\| [B-D] \|' "$RATING_FILE" 2>/dev/null || echo "?")
  echo "第 $round 轮完成 | 非A维度: $NON_A | 退出码: $EXIT_CODE"

  # 等待后进入下一轮
  if [ "$round" -lt "$MAX_ROUNDS" ]; then
    echo "等待 ${INTERVAL}s..."
    sleep "$INTERVAL"
  fi
done

echo ""
echo "已达上限 $MAX_ROUNDS 轮。"
rm -f /tmp/review-prompt-round-*.md
