#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

EXPECTED_URL="https://qianfengwen.github.io/CSC316-A3/"
PORT=4173
SERVER_PID=""
BROWSER_OPENED=0

cleanup() {
    if [[ -n "$SERVER_PID" ]] && kill -0 "$SERVER_PID" 2>/dev/null; then
        kill "$SERVER_PID" >/dev/null 2>&1 || true
        wait "$SERVER_PID" 2>/dev/null || true
    fi

    if [[ "$BROWSER_OPENED" -eq 1 ]]; then
        export CODEX_HOME="${CODEX_HOME:-$HOME/.codex}"
        export PWCLI="$CODEX_HOME/skills/playwright/scripts/playwright_cli.sh"
        bash "$PWCLI" close >/dev/null 2>&1 || true
    fi
}

trap cleanup EXIT

fail() {
    echo "FAIL: $1" >&2
    exit 1
}

command -v npx >/dev/null 2>&1 || fail "npx is required for the Playwright CLI wrapper"

export CODEX_HOME="${CODEX_HOME:-$HOME/.codex}"
export PWCLI="$CODEX_HOME/skills/playwright/scripts/playwright_cli.sh"

grep -q "$EXPECTED_URL" writeup.md || fail "writeup.md does not contain the deployed GitHub Pages URL"
grep -q "NameGrapher" index.html || fail "index.html does not acknowledge the visualization inspiration on the page"
grep -q "synthetic" index.html || fail "index.html does not mention the synthetic data augmentation on the page"

python3 -m http.server "$PORT" >/tmp/csc316-a3-http.log 2>&1 &
SERVER_PID=$!
sleep 1

bash "$PWCLI" open "http://127.0.0.1:${PORT}/" >/tmp/csc316-a3-browser.log 2>&1
BROWSER_OPENED=1

TITLE_RESULT="$(bash "$PWCLI" run-code "async (page) => {
  await page.locator('#filter-metric').selectOption('revenue');
  await page.waitForTimeout(250);
  return await page.evaluate(() => document.querySelector('#panel-trajectory .panel-title')?.textContent?.trim());
}" 2>/dev/null)"

echo "$TITLE_RESULT" | grep -q 'SEQUEL TRAJECTORY — Revenue by Entry #' || fail "trajectory panel title does not update when the metric changes to Revenue"

echo "PASS: submission cleanup checks"
