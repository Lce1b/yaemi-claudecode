#!/usr/bin/env bash
cd "$(dirname "$0")/.."
fails=0
count=0
for t in __tests__/*.test.js; do
  count=$((count + 1))
  echo "--- $(basename "$t") ---"
  if node "$t"; then
    echo "PASS"
  else
    fails=$((fails + 1))
    echo "FAIL"
  fi
  echo ""
done
echo "$count suites, $fails failed"
exit $fails
