#!/bin/sh
# dsh-genui-charts 一键安装脚本（从 GitHub 源码安装，无需 npm 包）
#
# 用法:
#   ./scripts/install.sh            # 装进默认 web profile
#   ./scripts/install.sh tui        # 装进自定义 profile
#
# 做什么: 检查两个前置（dsh / pnpm）→ 从 GitHub 安装插件 →
# 提示重启验证。安装命令本身和 README 一致。
#
# 为什么写 github: 而不是 link: —— 本 fork 把构建产物 lib/ 提交进了仓库，
# git 安装会直接拿到可以加载的 bundle：不需要构建，也不需要 pnpm 的
# allowBuilds 授权（link: 安装不装依赖、也不构建，只适合本地开发迭代）。

set -eu

PROFILE="${1:-web}"

# ── profile 参数只允许安全字符（随后会被拼进路径与命令行）──
case "$PROFILE" in
  *[!a-zA-Z0-9_-]*|'') fail_early=1 ;;
  *) fail_early=0 ;;
esac
if [ "$fail_early" = 1 ]; then
  printf '\033[31m✗ 非法的 profile 名 "%s"（仅允许字母、数字、_、-）\033[0m\n' "$PROFILE"
  exit 1
fi

PACKAGE_SPEC="github:dofine/dsh-genui"
DSH_HOME="${DSH_HOME:-$HOME/.dsh}"
RED='\033[31m'; GREEN='\033[32m'; YELLOW='\033[33m'; BOLD='\033[1m'; NC='\033[0m'

fail() { printf "${RED}✗ %s${NC}\n" "$1"; exit 1; }
ok()   { printf "${GREEN}✓ %s${NC}\n" "$1"; }
warn() { printf "${YELLOW}! %s${NC}\n" "$1"; }

echo "${BOLD}== dsh-genui-charts 安装（profile: ${PROFILE}）==${NC}"

# ── 前置 1: dsh ────────────────────────────────────────────────────────────
if ! command -v dsh >/dev/null 2>&1; then
  fail "未找到 dsh 命令。请先安装 DeepSeek Harness（开源版），再跑本脚本。"
fi
ok "dsh: $(dsh --version 2>/dev/null || echo present)"

# ── 前置 2: pnpm（缺失时只给提示，绝不自动 corepack enable 改用户全局）──
if ! command -v pnpm >/dev/null 2>&1; then
  fail "未找到 pnpm。请手动执行: 'corepack enable'（或 'npm i -g pnpm'），新开终端确认 'pnpm -v' 有输出后重跑本脚本。"
fi
ok "pnpm: $(pnpm --version)"

# ── 已装检测（幂等）────────────────────────────────────────────────────────
PROFILE_PKG="$DSH_HOME/profiles/$PROFILE/package.json"
if [ -f "$PROFILE_PKG" ] && grep -q "dsh-genui-charts" "$PROFILE_PKG" 2>/dev/null; then
  warn "插件已在 profile '$PROFILE' 中。"
  printf "  更新到最新提交: dsh plugin --profile %s update dsh-genui-charts\n" "$PROFILE"
  printf "  重装: dsh plugin --profile %s remove dsh-genui-charts，再跑本脚本。\n" "$PROFILE"
  printf "  之后: 重启 dsh web + 硬刷新 即可验证。\n"
  exit 0
fi

# ── 安装 ───────────────────────────────────────────────────────────────────
echo "安装中（从 GitHub 拉取源码，直接用仓库内的 lib/ 产物）..."
dsh plugin --profile "$PROFILE" add "$PACKAGE_SPEC"

echo
ok "安装完成！"
echo
echo "${BOLD}接下来:${NC}"
echo "  1. 重启 dsh web（退出后重新执行 dsh web）"
echo "  2. 浏览器硬刷新（Cmd+Shift+R）"
echo "  3. 新会话里说: 用 dsh-ui 画个统计看板"
echo
