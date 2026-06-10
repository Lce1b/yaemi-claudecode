# Yaemi Claudecode

> Claude Code 的安全带。给实习生装上，他删不掉代码、推不了密钥、跳不过 CI。
> 等你看到他 commit message 全是 `feat:` 开头、文件从不超过 800 行、每次改完自动格式化 —— 你会回来谢我。

Hook pipeline for [Claude Code](https://claude.ai/code) that sits between Claude and your codebase like a code-reviewing coworker who never sleeps. **Zero dependencies.** 35 handlers. 3 profiles. 7 hook events.

**The pitch in one sentence:** One `npm install -g` and your junior dev's Claude Code stops being a loose cannon — no secrets in commits, no `--no-verify`, no `rm -rf`, no force push, no editing without understanding what depends on it. Auto-formats on save. Warns when tests are missing. And with **CodeGraph + DeepSeek**: AST-level code review that fires automatically when the diff gets real — callers, callees, impact analysis, sub-second turnaround, sub-cent cost.

---

### What it actually blocks

| Intern does this | Yaemi says |
|---|---|
| `git commit -m "sk-abc123..."` | **BLOCKED.** Secrets detected. Use env vars. |
| `git commit -m "fix"` | Warning: description too short, use conventional commits |
| `git push --force origin main` | **BLOCKED.** Destructive command. |
| `git push --no-verify` | **BLOCKED.** Let hooks run. |
| `rm -rf ./src` | **BLOCKED.** Irreversible. |
| Write a 2000-line god file | **BLOCKED.** Split it up. |
| Edit a file without checking callers | **BLOCKED.** Show dependencies first. |
| 3 files / 200 lines edited | "Hey, maybe run /code-review?" |
| Session ends | Desktop notification. Auto-build. Format everything. |

### Three profiles, one command

```bash
npm install -g yaemi-claudecode
yhk install
```

| Profile | For who | What it does |
|---------|---------|-------------|
| `minimal` | "Just keep them from nuking the repo" | Secret scan, block `--no-verify`, block destructive commands |
| `standard` | "I want quality gates but not nagging" | + commit format, file size guard, format-on-save, MCP health, push reminder, gate guard, test reminder |
| `strict` | "I want AST-level review + full CI gates" | + **CodeGraph + DeepSeek auto-review**, cost tracking, desktop notify, debug check, build-on-stop |

When the intern proves they know what they're doing: bump them from `minimal` to `standard`. When you want to scare them straight: `strict`.

---

## Installation

```bash
npm install -g yaemi-claudecode
yhk install
```

That's it. `yhk install` adds the bridge to all 7 hook events in `~/.claude/settings.json`. Use `--local` for project-level install, `--dry-run` to preview.

Start with `YAEMI_HOOK_PROFILE=standard` in your settings.json `env` section, or `export YAEMI_HOOK_PROFILE=strict` if you want the full suite.

## Profiles

| Profile | Handlers | What you get |
|---------|----------|-------------|
| `minimal` | 4 | Secret scan, block `--no-verify`, block destructive commands, tool failure handler |
| `standard` | 18 | All of minimal + commit quality, file size guard, format-on-save, MCP health, push reminder, gate guard, test reminder, batch format/typecheck on stop |
| `strict` | 35 | All of standard + LLM auto-review, cost tracking, desktop notify, debug statement check, design quality, session tracking, pre-compact, build-on-stop |

Switch at any time:

```bash
export YAEMI_HOOK_PROFILE=strict
```

Disable individual handlers:

```bash
export YAEMI_HOOK_DISABLED=desktop-notify,cost-tracker
```

## CLI

```
yhk install              install to ~/.claude/settings.json (global)
yhk install --local       install to ./.claude/settings.json (project)
yhk install --dry-run     preview without writing
yhk uninstall             remove all yaemi hooks
yhk status                show hook status and profile
```

## Handler catalog

### Core (all profiles)

| Handler | Event | Priority | What it does |
|---------|-------|----------|-------------|
| block-secrets | PreToolUse | 45 | Scans `git commit -m` for API keys, private keys, JWT tokens, hardcoded passwords. Blocks with exitCode 2 on match. |
| block-no-verify | PreToolUse | 52 | Rejects `--no-verify` and `--no-gpg-sign` flags. Hooks exist for a reason. |
| block-destructive | PreToolUse | 54 | Blocks `rm -rf`, `git reset --hard`, `git push --force`, `git clean -fdx`, and Windows equivalents. |
| post-tool-use-failure | PostToolUseFailure | 500 | Handles tool failure events gracefully. |

### Standard (minimal + these)

| Handler | Event | Priority | What it does |
|---------|-------|----------|-------------|
| bash-guard | PreToolUse | 50 | Guards against dangerous bash patterns (recursive chmod, fork bombs, etc.) |
| commit-quality | PreToolUse | 60 | Validates conventional commit format (`type: description`), warns on non-conforming messages. |
| push-reminder | PreToolUse | 62 | Warns before `git push` — verify your remote and branch. |
| gateguard | PreToolUse | 80 | Pre-edit fact-forcing gate. On first edit of a file per session, requires Claude to show what depends on it before proceeding. Test files and small files auto-pass; bypass list configurable. |
| config-protection | PreToolUse | 55 | Protects ESLint, Prettier, Biome, Ruff, tsconfig, Cargo.toml, pyproject.toml from accidental edits. |
| file-size-guard | PreToolUse | 85 | Blocks writes exceeding the line limit (default 800). Override with `YAEMI_FILE_SIZE_LIMIT`. |
| mcp-health | PreToolUse | 150 | Probes MCP servers before tool calls. Exponential backoff on failure, auto-restore on recovery. |
| dev-server-blocker | PreToolUse | 70 | Blocks `npm run dev`, `pnpm dev`, `cargo run` etc. in hook context. |
| post-format | PostToolUse | 100 | Auto-formats edited files (ruff for Python, biome/prettier for JS/TS). Non-blocking. |
| stop-format-typecheck | Stop | 300 | Batch format + typecheck all modified files at session end. |
| todo-check | PostToolUse | 350 | Warns if TODO/FIXME/HACK comments are introduced. |
| test-file-reminder | PostToolUse | 200 | Reminds to add tests when new source files are created without corresponding test files. |
| doc-file-warning | PostToolUse | 250 | Warns when .md files are written — documentation drift check. |
| governance | PreToolUse | 90 | Pre-tool governance checks. |
| governance-post | PostToolUse | 300 | Post-tool governance verification. |
| cost-tracker | Stop | 200 | Logs token usage + estimated cost to `~/.yaemi/cost-log.jsonl`. |

### Strict (standard + these)

| Handler | Event | Priority | What it does |
|---------|-------|----------|-------------|
| review-reminder | PostToolUse | 400 | Tracks edits per session. After 3+ files and 200+ lines changed, suggests `/code-review`. If `YAEMI_REVIEW_API_KEY` is set, runs LLM code review automatically (async, non-blocking). |
| cost-tracker | Stop | 200 | Logs token usage + estimated cost to `~/.yaemi/cost-log.jsonl`. |
| desktop-notify | Stop | 900 | Cross-platform desktop notification when Claude finishes responding (macOS/osascript, Windows/Toast, Linux/notify-send). |
| debug-check | PostToolUse | 150 | Warns on `console.log`, `debugger`, `print()` debug statements. |
| design-quality | PostToolUse | 350 | Design quality lint for frontend files. |
| edit-accumulator | PostToolUse | 100 | Accumulates edit records for cross-session analysis. |
| notification | Notification | 500 | Handles notification hook events. |
| observe-runner | PostToolUse | 400 | Runs observe commands after tool use. |
| pre-compact | PreCompact | 100 | Prepares context before compaction. |
| session-activity-tracker | PostToolUse | 50 | Tracks tool use activity within sessions. |
| session-start | SessionStart | 100 | Session initialization. |
| session-end | Stop | 100 | Session teardown and cleanup. |
| stop-build | Stop | 800 | Runs project build at session end to verify nothing is broken. |
| suggest-compact | Stop | 600 | Suggests context compaction when approaching limits. |
| quality-trend | Stop | 700 | Tracks quality metrics trend across sessions. |
| tmux-reminder | Stop | 850 | Reminds about tmux session management. |

## Architecture

```
Claude Code hook event
        │
        ▼
  settings.json hooks
        │
        ▼
  bin/bridge.js (yhk)          ← stdin JSON from Claude
        │
        ├─ scanHandlers()       ← registry.js: discovers all .js files under handlers/
        ├─ filterByProfile()    ← profile.js: drops handlers outside active profile
        ├─ sortByPriority()     ← registry.js: orders by priority
        │
        ▼
  for-each matching handler:
        ├─ handler.match(event) → boolean
        ├─ handler.run(event, ctx) → { exitCode, stdout, stderr }
        ├─ ctx.deny(reason)     → permissionDecision: deny
        ├─ ctx.warn(msg)        → non-blocking stderr
        ├─ ctx.error(msg)       → blocking stderr
        │
        ▼
  stdout JSON → Claude Code
```

### Handler contract

Two formats. Prefer the new one:

**New contract (recommended):**

```js
module.exports = {
  on: 'PreToolUse',                              // hook event name
  match: (event) => event.tool_name === 'Bash',  // whether this handler applies
  priority: 60,                                   // lower runs first
  profile: ['standard', 'strict'],                // which profiles include this
  async: false,                                   // fire-and-forget if true
  timeout: 10,                                    // timeout in seconds (async only)
  run: async (event, ctx) => { return { exitCode: 0 }; },
};
```

**Legacy contract (backward-compatible):**

```js
module.exports = {
  run: async (rawInput) => { /* raw JSON string */ },
};
// Event name inferred from directory/filename
```

### Context API

Every handler receives `ctx` (HookContext):

| Method | Effect |
|--------|--------|
| `ctx.log(msg)` | Write to debug log (`~/.yaemi/hook-debug.log`) |
| `ctx.warn(msg)` | Non-blocking warning → stderr |
| `ctx.error(msg)` | Blocking error → stderr, exitCode 2 |
| `ctx.deny(reason)` | `permissionDecision: deny` — forces Claude to explain and retry |
| `ctx.sink.fire(endpoint, body)` | Fire-and-forget event to sink |
| `ctx.sink.call(endpoint, body, timeout)` | Call sink with timeout |

### Sink system

Decouples handlers from output. Built-in sinks:

| Sink | Behavior |
|------|----------|
| `stdout` (default) | JSON to stdout |
| `null` | No-op |

Register custom sinks via `registerSink(name, { fire, call })` for integration with the desktop pet, monitoring, or anything else.

### Project-local custom handlers

Drop `.js` files into `.claude/hooks/custom/` — they're auto-discovered and merged into the pipeline. Same contract, project-scoped.

## Configuration

### Environment variables

| Variable | Default | Description |
|----------|---------|-------------|
| `YAEMI_HOOK_PROFILE` | `standard` | `minimal` / `standard` / `strict` |
| `YAEMI_HOOK_DISABLED` | — | Comma-separated handler IDs to disable |
| `YAEMI_HOOK_SINK` | `stdout` | Sink mode (`stdout`, `null`, or custom) |
| `YAEMI_DATA_DIR` | `~/.yaemi` | State/log file directory |
| `YAEMI_FILE_SIZE_LIMIT` | `800` | Max lines per file |
| `YAEMI_FORMAT_TIMEOUT` | `30000` | Formatter timeout in ms |
| `YAEMI_REVIEW_API_KEY` | — | LLM API key for auto-review |
| `YAEMI_REVIEW_MODEL` | `deepseek-v4-flash` | Model for auto-review |
| `YAEMI_REVIEW_API_URL` | DeepSeek Anthropic API | API endpoint for auto-review |
| `YAEMI_REVIEW_MAX_TOKENS` | `1024` | Max tokens for review response |

### .hookrc.json

Project-level config (looked up in `.hookrc.json` or `.yaemi/hookrc.json`):

```json
{
  "gateguard.bypass": "CLAUDE.md,package.json"
}
```

## Auto-Review

The strict profile's `review-reminder` handler supports three tiers:

| Tier | Requirement | Capability |
|------|-------------|------------|
| None | No `YAEMI_REVIEW_API_KEY` | Text reminder only |
| Basic | API key set, no CodeGraph CLI | git diff + full file content → LLM |
| Full | API key + `codegraph` CLI | Basic + callers/callees/impact from AST index |

The review prompt focuses on **correctness and safety** — not style. It flags CRITICAL (security, crash, data loss) and HIGH (bugs, wrong behavior) issues only.

Crash or timeout in the review path? Handler keeps going. Review is non-blocking by design.

Works best with DeepSeek (uses Anthropic-compatible API), but any compatible endpoint works — set `YAEMI_REVIEW_API_URL`.

## Custom sink example: desktop pet

```js
// In your app's initialization
const { registerSink } = require('yaemi-claudecode/bin/bridge');

registerSink('miko', {
  fire(endpoint, body) {
    // endpoint = '/api/hook/review-suggestion'
    // body = { session_id, file_count, total_lines, reason }
    fetch('http://127.0.0.1:9527' + endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }).catch(() => {});
  },
  call(endpoint, body, timeout) {
    return fetch('http://127.0.0.1:9527' + endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(timeout),
    });
  },
});
```

Then run with `YAEMI_HOOK_SINK=miko` — the desktop pet receives review suggestions, cost summaries, and session events in real time.

## Design decisions

**Zero dependencies.** The hook runs before every tool call. Cold start matters. `require('yaemi-claudecode')` adds ~0ms to your edit latency.

**Non-blocking formatting & review.** A slow formatter or LLM should never block your edit. Formatting runs synchronously but swallows errors. Review is fully async with a 30s timeout.

**Profile gates, not feature flags.** Every handler declares which profiles it belongs to. No runtime config parsing in handlers — just check the profile once at startup.

**Security-critical hooks never exit 0.** PreToolUse and SessionStart blocks always propagate their exit code. Other events degrade gracefully.

**Path sandbox.** Handler files are validated to be inside the plugin root before loading — prevents path traversal from compromised config.

## FAQ

**Does this work with other LLM providers?** Yes. The hook system itself is provider-agnostic. Auto-review uses the Anthropic-compatible API format — DeepSeek, OpenRouter, or any compatible endpoint works.

**Can I use it without the desktop pet?** Yes. It's a standalone npm package. The desktop pet is a separate project that can consume hook events via the sink system, but the hook system works independently.

**Why not use Claude Code's built-in hooks directly?** You are. `yhk install` writes the bridge command into `settings.json` hooks. Yaemi Claudecode is a pipeline *on top of* the native hook system — it adds profiles, priority ordering, context API, sinks, and 35 pre-built handlers so you don't write them from scratch.

**How does this compare to ECC's hook system?** It's extracted from the same codebase. Yaemi Claudecode is the standalone npm distribution of the hook pipeline that powers the Yae Miko desktop pet. ECC users get the same handlers via their rules/skills install.

## Links

- GitHub: https://github.com/Lce1b/yaemi-claudecode
- npm: https://www.npmjs.com/package/yaemi-claudecode
- Desktop pet: [Yae Miko](https://github.com/Lce1b/yae-miko)

---

# Yaemi Claudecode（中文）

> Claude Code 的安全带。给实习生装上，他删不掉代码、推不了密钥、跳不过 CI。
> 等你看到他 commit message 全是 `feat:` 开头、文件从不超过 800 行、每次改完自动格式化 —— 你会回来谢我。

坐在 Claude 和你的代码库之间的 Hook 管道，像一个永远不会下班的 code reviewer。**零依赖。** 35 个处理器。3 个 Profile。7 个 Hook 事件。

**一句话说清楚：** 一个 `npm install -g`，你手下实习生的 Claude Code 就不再是脱缰野马 —— 密钥推不上去、`--no-verify` 跳不过去、`rm -rf` 删不掉、force push 按不下去、不了解依赖关系就改不了文件。保存自动格式化。缺测试会提醒。配上 **CodeGraph + DeepSeek**：改动大了自动跑 AST 级代码审查 —— 调用者分析、影响范围、子秒响应、次美分成本。

---

### 实际会拦下什么

| 实习生干这个 | Yaemi 的反应 |
|---|---|
| `git commit -m "sk-abc123..."` | **拦截。** 检测到密钥。用环境变量。 |
| `git commit -m "fix"` | 警告：描述太短，用 conventional commit 格式 |
| `git push --force origin main` | **拦截。** 危险命令。 |
| `git push --no-verify` | **拦截。** 让 hook 正常跑。 |
| `rm -rf ./src` | **拦截。** 不可逆操作。 |
| 写一个 2000 行的上帝文件 | **拦截。** 拆成小模块。 |
| 不检查调用方就改文件 | **拦截。** 先展示依赖关系。 |
| 改了 3 个文件 / 200 行 | "要不要跑一下 /code-review？" |
| 会话结束 | 桌面通知 + 自动构建 + 全量格式化 |

### 三个 Profile，一条命令

```bash
npm install -g yaemi-claudecode
yhk install
```

| Profile | 适合谁 | 干的事 |
|---------|-------|--------|
| `minimal` | "别让他把仓库炸了就行" | 密钥扫描、禁止 `--no-verify`、禁止危险命令 |
| `standard` | "要有质量门禁但别太烦" | + 提交规范检查、文件大小限制、保存格式化、MCP 健康探测、推送提醒、上下文门禁、测试提醒 |
| `strict` | "我要 AST 级审查 + 完整 CI 门禁" | + **CodeGraph + DeepSeek 自动审查**、成本追踪、桌面通知、debug 检查、结束构建验证 |

实习生证明自己靠谱之后：从 `minimal` 升到 `standard`。想让他长记性：直接 `strict`。

```bash
npm install -g yaemi-claudecode
yhk install
```

`yhk install` 会把 bridge 写入 `~/.claude/settings.json` 的全部 7 个 Hook 事件。加 `--local` 装到项目级，加 `--dry-run` 预览。

在 settings.json 的 `env` 里设 `YAEMI_HOOK_PROFILE=standard`，或者 `export YAEMI_HOOK_PROFILE=strict` 开启全套。

## 三级 Profile

| Profile | 处理器数 | 内容 |
|---------|---------|------|
| `minimal` | 4 | 密钥扫描、禁止 `--no-verify`、禁止危险命令、工具失败处理 |
| `standard` | 18 | minimal 全部 + 提交规范检查、文件大小门禁、保存时自动格式化、MCP 健康探测、推送提醒、GateGuard 上下文门禁、测试提醒、会话结束时批量格式化+类型检查 |
| `strict` | 35 | standard 全部 + LLM 自动代码审查、成本追踪、桌面通知、debug 语句检查、设计质量、会话追踪、压缩前准备、结束时构建验证 |

随时切换：

```bash
export YAEMI_HOOK_PROFILE=strict
```

禁用单个处理器：

```bash
export YAEMI_HOOK_DISABLED=desktop-notify,cost-tracker
```

## CLI

```
yhk install              安装到 ~/.claude/settings.json（全局）
yhk install --local       安装到 ./.claude/settings.json（项目级）
yhk install --dry-run     预览，不写入
yhk uninstall             移除所有 yaemi hook
yhk status                查看 hook 状态和当前 Profile
```

## 处理器目录

### Core（所有 Profile 生效）

| 处理器 | 事件 | 优先级 | 作用 |
|--------|------|--------|------|
| block-secrets | PreToolUse | 45 | 扫描 `git commit -m` 中的 API 密钥、私钥、JWT Token、硬编码密码，命中则拦截 |
| block-no-verify | PreToolUse | 52 | 禁止 `--no-verify` 和 `--no-gpg-sign`，hook 就是用来跑的 |
| block-destructive | PreToolUse | 54 | 拦截 `rm -rf`、`git reset --hard`、`git push --force`、`git clean -fdx` 等危险命令 |
| post-tool-use-failure | PostToolUseFailure | 500 | 优雅处理工具执行失败事件 |

### Standard（minimal + 以下）

| 处理器 | 事件 | 优先级 | 作用 |
|--------|------|--------|------|
| bash-guard | PreToolUse | 50 | 拦截危险 bash 模式（递归 chmod、fork 炸弹等） |
| commit-quality | PreToolUse | 60 | 校验 conventional commit 格式，不规范则警告 |
| push-reminder | PreToolUse | 62 | `git push` 前提醒确认远程和分支 |
| gateguard | PreToolUse | 80 | 编辑前上下文门禁。首次编辑某文件时要求 Claude 展示依赖关系后才放行。测试文件和小文件自动放行，支持白名单 |
| config-protection | PreToolUse | 55 | 保护 ESLint、Prettier、Biome、Ruff、tsconfig、Cargo.toml 等配置文件不被误改 |
| file-size-guard | PreToolUse | 85 | 拦截超行数文件写入（默认 800 行），可通过 `YAEMI_FILE_SIZE_LIMIT` 调整 |
| mcp-health | PreToolUse | 150 | MCP 工具调用前探测服务器健康状态，失败指数退避，恢复自动感知 |
| dev-server-blocker | PreToolUse | 70 | 在 hook 上下文中拦截 `npm run dev` 等开发服务器启动 |
| post-format | PostToolUse | 100 | 保存后自动格式化（Python→ruff，JS/TS→biome/prettier），不阻塞 |
| stop-format-typecheck | Stop | 300 | 会话结束时批量格式化+类型检查所有修改文件 |
| todo-check | PostToolUse | 350 | 新增 TODO/FIXME/HACK 注释时警告 |
| test-file-reminder | PostToolUse | 200 | 新建源文件但没有对应测试文件时提醒加测试 |
| doc-file-warning | PostToolUse | 250 | 写入 .md 文件时警告文档漂移 |
| governance | PreToolUse | 90 | 工具调用前治理检查 |
| governance-post | PostToolUse | 300 | 工具调用后治理验证 |
| cost-tracker | Stop | 200 | 将 Token 用量和估算费用写入 `~/.yaemi/cost-log.jsonl` |

### Strict（standard + 以下）

| 处理器 | 事件 | 优先级 | 作用 |
|--------|------|--------|------|
| review-reminder | PostToolUse | 400 | 追踪会话编辑量。3+ 文件且 200+ 行改动后提醒 `/code-review`。若设了 `YAEMI_REVIEW_API_KEY` 则自动跑 LLM 代码审查（异步，不阻塞） |
| desktop-notify | Stop | 900 | Claude 响应完成时桌面通知（macOS/osascript、Windows/Toast、Linux/notify-send） |
| debug-check | PostToolUse | 150 | 检测 `console.log`、`debugger`、`print()` 等调试语句并警告 |
| design-quality | PostToolUse | 350 | 前端文件设计质量检查 |
| edit-accumulator | PostToolUse | 100 | 累积编辑记录供跨会话分析 |
| notification | Notification | 500 | 处理通知类 Hook 事件 |
| observe-runner | PostToolUse | 400 | 工具调用后执行观察命令 |
| pre-compact | PreCompact | 100 | 上下文压缩前准备 |
| session-activity-tracker | PostToolUse | 50 | 追踪会话内工具使用活动 |
| session-start | SessionStart | 100 | 会话初始化 |
| session-end | Stop | 100 | 会话结束清理 |
| stop-build | Stop | 800 | 会话结束时跑构建验证 |
| suggest-compact | Stop | 600 | 接近上下文限制时建议压缩 |
| quality-trend | Stop | 700 | 跨会话质量趋势追踪 |
| tmux-reminder | Stop | 850 | tmux 会话管理提醒 |

## 架构

```
Claude Code hook 事件
        │
        ▼
  settings.json hooks
        │
        ▼
  bin/bridge.js (yhk)          ← Claude 通过 stdin 传入 JSON
        │
        ├─ scanHandlers()       ← registry.js: 扫描 handlers/ 下所有 .js
        ├─ filterByProfile()    ← profile.js: 过滤非活跃 profile 的处理器
        ├─ sortByPriority()     ← registry.js: 按优先级排序
        │
        ▼
  遍历匹配的处理器:
        ├─ handler.match(event) → boolean
        ├─ handler.run(event, ctx) → { exitCode, stdout, stderr }
        ├─ ctx.deny(reason)     → permissionDecision: deny
        ├─ ctx.warn(msg)        → 非阻塞 stderr
        ├─ ctx.error(msg)       → 阻塞 stderr
        │
        ▼
  stdout JSON → Claude Code
```

### 处理器契约

两种格式，推荐新契约：

**新契约（推荐）：**

```js
module.exports = {
  on: 'PreToolUse',                              // hook 事件名
  match: (event) => event.tool_name === 'Bash',  // 是否匹配
  priority: 60,                                   // 越小越先执行
  profile: ['standard', 'strict'],                // 所属 profile
  async: false,                                   // true 则 fire-and-forget
  timeout: 10,                                    // 超时秒数（仅 async）
  run: async (event, ctx) => { return { exitCode: 0 }; },
};
```

**旧契约（向后兼容）：**

```js
module.exports = {
  run: async (rawInput) => { /* 原始 JSON 字符串 */ },
};
// 事件名从目录/文件名推断
```

### Context API

每个处理器接收 `ctx`（HookContext）：

| 方法 | 效果 |
|------|------|
| `ctx.log(msg)` | 写入调试日志（`~/.yaemi/hook-debug.log`） |
| `ctx.warn(msg)` | 非阻塞警告 → stderr |
| `ctx.error(msg)` | 阻塞错误 → stderr，exitCode 2 |
| `ctx.deny(reason)` | `permissionDecision: deny` — 强制 Claude 解释后重试 |
| `ctx.sink.fire(endpoint, body)` | fire-and-forget 事件 |
| `ctx.sink.call(endpoint, body, timeout)` | 带超时的调用 |

### Sink 系统

解耦处理器与输出目标。内置：

| Sink | 行为 |
|------|------|
| `stdout`（默认） | JSON 写入 stdout |
| `null` | 空操作 |

通过 `registerSink(name, { fire, call })` 注册自定义 sink，可对接桌宠、监控等。

### 项目级自定义处理器

把 `.js` 文件放入 `.claude/hooks/custom/` 即可自动发现并合并到管道中，相同契约，项目作用域。

## 配置

### 环境变量

| 变量 | 默认值 | 说明 |
|------|--------|------|
| `YAEMI_HOOK_PROFILE` | `standard` | `minimal` / `standard` / `strict` |
| `YAEMI_HOOK_DISABLED` | — | 逗号分隔的要禁用的处理器 ID |
| `YAEMI_HOOK_SINK` | `stdout` | Sink 模式（`stdout`、`null` 或自定义） |
| `YAEMI_DATA_DIR` | `~/.yaemi` | 状态/日志文件目录 |
| `YAEMI_FILE_SIZE_LIMIT` | `800` | 单文件最大行数 |
| `YAEMI_FORMAT_TIMEOUT` | `30000` | 格式化超时（毫秒） |
| `YAEMI_REVIEW_API_KEY` | — | 自动审查的 LLM API 密钥 |
| `YAEMI_REVIEW_MODEL` | `deepseek-v4-flash` | 自动审查模型 |
| `YAEMI_REVIEW_API_URL` | DeepSeek Anthropic API | 自动审查 API 端点 |
| `YAEMI_REVIEW_MAX_TOKENS` | `1024` | 审查响应最大 Token |

### .hookrc.json

项目级配置（在 `.hookrc.json` 或 `.yaemi/hookrc.json` 中查找）：

```json
{
  "gateguard.bypass": "CLAUDE.md,package.json"
}
```

## 自动代码审查

Strict Profile 的 `review-reminder` 处理器支持三级：

| 级别 | 条件 | 能力 |
|------|------|------|
| 无 | 未设 `YAEMI_REVIEW_API_KEY` | 仅文本提醒 |
| 基础 | 有 API Key，无 CodeGraph CLI | git diff + 完整文件内容 → LLM |
| 完整 | API Key + `codegraph` CLI | 基础 + AST 级调用者/被调用者/影响分析 |

审查 Prompt 聚焦**正确性和安全性**，不关注代码风格。仅标记 CRITICAL（安全漏洞、崩溃、数据丢失）和 HIGH（Bug、错误行为）问题。

审查路径崩溃或超时？处理器继续运行。审查设计为非阻塞。

最佳搭配 DeepSeek（使用 Anthropic 兼容 API），但任何兼容端点都行 — 设 `YAEMI_REVIEW_API_URL` 即可。

## 自定义 Sink 示例：对接桌宠

```js
const { registerSink } = require('yaemi-claudecode/bin/bridge');

registerSink('miko', {
  fire(endpoint, body) {
    fetch('http://127.0.0.1:9527' + endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }).catch(() => {});
  },
  call(endpoint, body, timeout) {
    return fetch('http://127.0.0.1:9527' + endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(timeout),
    });
  },
});
```

然后 `YAEMI_HOOK_SINK=miko` — 桌宠实时接收审查建议、成本摘要和会话事件。

## 设计原则

**零依赖。** Hook 在每次工具调用前执行。冷启动速度决定编辑延迟。`require('yaemi-claudecode')` 对编辑延迟的影响 ≈ 0ms。

**格式化和审查不阻塞。** 慢格式化或 LLM 绝不应阻塞你的编辑。格式化同步执行但吞掉错误。审查完全异步，30 秒超时。

**Profile 分级，而非 Feature Flag。** 每个处理器声明自己属于哪些 Profile。处理器内部不解析运行时配置 — 只在启动时检查一次 Profile。

**安全关键 Hook 绝不静默退出。** PreToolUse 和 SessionStart 的拦截始终传播 exitCode。其他事件优雅降级。

**路径沙箱。** 处理器文件加载前验证在插件根目录内 — 防止配置被篡改后的路径遍历攻击。

## FAQ

**支持其他 LLM 供应商吗？** 支持。Hook 系统本身与供应商无关。自动审查使用 Anthropic 兼容 API 格式 — DeepSeek、OpenRouter 或任何兼容端点都行。

**可以脱离桌宠单独使用吗？** 可以。这是独立的 npm 包。桌宠是通过 Sink 系统消费 Hook 事件的独立项目，Hook 系统完全独立运行。

**为什么不直接用 Claude Code 内置 Hook？** 你确实在用。`yhk install` 把 bridge 命令写入 `settings.json` 的 hooks 配置。Yaemi Claudecode 是在原生 Hook 系统之上的管道 — 增加了 Profile 分级、优先级排序、Context API、Sink 系统和 35 个预置处理器，让你不用从零写起。

**和 ECC Hook 系统什么关系？** 提取自同一代码库。Yaemi Claudecode 是驱动八重神子桌宠的 Hook 管道的独立 npm 发行版。ECC 用户通过规则/技能安装获得相同的处理器。

## 链接

- GitHub: https://github.com/Lce1b/yaemi-claudecode
- npm: https://www.npmjs.com/package/yaemi-claudecode
- 桌宠项目: [Yae Miko](https://github.com/Lce1b/yae-miko)
