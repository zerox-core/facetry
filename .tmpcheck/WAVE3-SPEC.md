# WAVE 3 共享规范 · 全站深色主题收尾 + 动效/间距规范

> 地基已由 Lead 完成（`src/index.css` 令牌 + `src/App.tsx` 外壳），**不要改这两个文件**。
> 你只改自己名下的文件；改完回读确认没被别人覆盖。

## 0. 现状

- 全站现在是**单一深色主题**：黑曜石底 + 指挥舱四色。深浅切换的 `isDarkTheme` 已删除，**不要再写任何按页面判断主题的代码**。
- 上一波页面已经有语义色（Workbench/Candidates/Jobs/ScheduleManager/Approvals/Admin/Bank/Overview **零硬编码浅色**，只需做动效与间距收尾）。需要真扫一遍的是 Offline / live / Interviewer / Result / Join / CandidateDetail。
- 令牌（已生效，直接用语义类即可，**不要写死这些 hex**）：

| 语义 | 用途 | 值 |
|---|---|---|
| `base-100` | 卡面 | `#16171f` |
| `base-200` | 画布（页面底） | `#0c0d12` |
| `base-300` | 描边/分隔 | `#2b2c35` |
| `base-content` | 正文（`/60` `/50` 次要） | `#f2f2f5` |
| `primary` | 橙，**主行动**（一屏一处） | `#ff5a36` |
| `secondary` | 靛，次行动/数据 | `#6366f1` |
| `accent` | 天蓝，信息/焦点 | `#7cd7f3` |
| `success` / `warning` / `error` | 鼠尾草绿 / 琥珀 / 珊瑚红 | `#5fd39a` / `#fbbf24` / `#f87171` |

## 1. 颜色替换对照表（硬性）

| 旧写法 | 新写法 |
|---|---|
| `bg-white`（不透明） | `bg-base-100` |
| `bg-white/5`、`bg-white/10`（半透明提亮） | **可保留**（深色下就是提亮层） |
| `bg-black/[0.04]`、`bg-black/5`、`bg-black/10` | `bg-base-content/5`（或 `/10`）——黑叠黑等于看不见 |
| `border-black/[0.06~0.1]`、`border-slate-200` | `border-base-300`（更弱用 `border-base-content/10`） |
| `text-[#1d1d1f]`、`text-slate-700~900`、`text-gray-800` | `text-base-content` |
| `text-[#86868b]`、`text-slate-400~500` | `text-base-content/60`（最弱 `/50`） |
| `bg-slate-50/100/200`、`bg-gray-100` | `bg-base-100` 或 `bg-base-200` |
| `text-emerald-*` / `bg-emerald-*` | `text-success` / `bg-success`（或 `badge badge-soft badge-success`） |
| `text-amber-*` / `bg-amber-*` | `text-warning` / `bg-warning` |
| `text-rose-*` / `text-red-*` | `text-error` |
| `text-indigo-*` / `bg-indigo-*` | `text-secondary` / `bg-secondary` |
| `text-sky-*` / `text-cyan-*` | `text-accent` / `text-info` |
| `shadow-2xs`（深色下几乎不可见） | 删掉，或改用 `shadow-lg` / `shadow-[var(--shadow-paper)]` |
| 彩色块上的文字 | 用对应 `-content` 令牌（如 `text-primary-content`）；**浅色块（天蓝/鼠尾草绿）必须用深色文字**（`text-accent-content`） |

**彩色底不做大面积铺陈**：一屏只允许一处主行动橙；数据用靛；正向用绿；告警用琥珀；危险用红。禁止再出现 `emerald/rose/amber/purple` 的 Tailwind 调色板类名。

## 2. 间距：只调“组件之间”，不动组件内部

- `gap-*`、`space-y-*`、`space-x-*`：**各自 +1 档**（`gap-3`→`gap-4`、`gap-4`→`gap-5`、`space-y-5`→`space-y-6`、`space-y-6`→`space-y-7`）。
- **不要动**：`p-*`（卡片内边距）、`h-*` / `min-h-*`（控件高度）、`text-*`（字号）、图标尺寸。密度已经很高，再放大内边距会显得松垮。
- 页面主容器左右留白可到 `px-6 lg:px-8`；页面纵向 `py-8`。

## 3. 动效规范（`src/index.css` 已备好工具类）

可用的工具类：
- `.motion-pop`：交互元素统一过渡（transform/opacity/border-color/background-color，160ms），hover 上浮 2px、active 轻微下压。**所有可点卡片、列表行、按钮容器都加它**。
- `.motion-meter`：数据条/进度/图表过渡（宽高 transform，600ms）。**所有进度条、柱状、环图都加它**。
- `.stagger`：容器加它，子元素用 `style={{ '--i': i }}` 依次错位入场（45ms/个，最多前 8 项）。
- `.ws-rise`：单个区块入场。
- 全局已加 `:focus-visible` 焦点环与 `prefers-reduced-motion` 兜底（会把所有动画/过渡降到 0.01ms），**不要用 `outline-none` 把它抹掉**。

硬性要求：
1. 过渡时长只用 `--dur-fast 160ms` / `--dur-base 280ms` / `--dur-slow 600ms` 三档（对应 `duration-150/200`、`duration-300`、`duration-500/700`）。出现 `duration-[437ms]`、`transition: all 1s` 这类随手值一律改回三档。
2. 每个可交互元素必须有可见的 **hover** 与 **active** 反馈；仅图标按钮必须有 `aria-label`。
3. **不要新增无限循环动画**。已有的 `animate-ping` / `animate-pulse` / `animate-shimmer` / `animate-float`：只允许出现在"状态指示"上（在线点、加载中），且不得承载唯一信息（旁边要有文字）。
4. 图表/数字：进场从 0 过渡到目标值（用 `useEffect` + `requestAnimationFrame` 或 CSS 过渡），不要硬跳；数字容器加 `tabular-nums`；**不要只靠 hover 才显示数值**。
5. 列表入场错位只做前 8 项，避免长列表延迟感。

## 4. 自检（只做这两件）

```powershell
node .\node_modules\typescript\bin\tsc -p tsconfig.json --noEmit
```
只看**你自己文件**的报错并清零（别人文件可能正在改，忽略）。

**禁止**：`pnpm build`（构建由 Lead 统一跑，避免多人同时写 dist）、`oxfmt` 或任何格式化器、`git` 写操作、修改 `src/index.css` / `src/App.tsx` / `Login.tsx` / `LoginShowcase.tsx` / `Home.tsx` / `src/data.ts` / `src/store.ts`。

报告 ≤25 行：改了哪些文件、硬编码清了哪些、动效/间距具体怎么统一、tsc 结果、未决。
