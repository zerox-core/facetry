# FaceTry 招聘工作台 · 设计规范

本文件描述登录之后内部业务页面（工作台 / 候选人大池 / 候选人详情 / 岗位 / 约面 / 录取审批 / 题库 / 管理后台 / 数据看板）的现有视觉与交互约定。

## 1. 适用范围与权威性

- **唯一事实来源：`src/index.css` 的令牌与工具类，以及 `src/views/ui.tsx` 的公共组件。** 本文档是**描述性**的——它记录代码里已经在用的取值，而不是提出一套新设计。
- 本文档与代码冲突时，**以代码为准**，并顺手回改本文档；反过来不允许「为了符合本文档」去改代码里的既有取值。
- 例外范围（不适用本文档大部分约定）：登录页 `Login.tsx` / `LoginShowcase.tsx`（视觉结构冻结，见开发要求「不可变更项」）、候选人端 `Join.tsx`、考场面试间 `Offline.tsx` / `live.tsx`、简历文书 `ResumeDoc.tsx`，以及整页仍是旧纸张 + `slate-*` 语言的结果分析 `Result.tsx`。深色/纸张子系统见 §3.4。
- 新增页面请照 §7 的自检清单过一遍。

## 2. 设计意图

**关键词：面试官的办公用品。** 中性、克制、干净，像一张整理好的白纸和一支好用的笔，不追求科技感。

- 内容优先：一屏一个焦点，卡片承载信息，装饰只在表达状态时出现。
- 层级靠**深度**（多层弥散阴影 + 1px 描边 + 极浅灰面）而不是靠重色块；不做大面积品牌色填充。
- 一切「动」都服务于反馈：入场、悬停抬起、按压回弹；不做循环播放的装饰动画。
- **禁止：** 装饰性渐变/发光、玻璃拟态滥用、全大写标签（岗位白皮书里的 `uppercase tracking-wider` 小节标题是历史遗留，新页面不要新增）、衬线字体、装饰性 AI 元素（星星、光球、闪烁）。
- 演示数据要夸张到一眼能看出是假的（如「精通 43 门语言」），避免被误当成真实信息。

## 3. 色板（代码实际值）

### 3.1 `--apple-*` 令牌（`src/index.css`）

| 令牌 | 实际值 | 用途 |
|---|---|---|
| `--apple-canvas` | `#f2f4f7` | `.ws-canvas` 页面底色（App 根节点） |
| `--apple-paper` | `#ffffff` | `.ws-paper` 卡片底 |
| `--apple-text` | `#1d1d1f` | `.ws-canvas` 正文色 |
| `--apple-muted` | `#6e6e73` | **CSS 中已定义但未被引用**；页面以 `text-[#6e6e73]` 硬编码使用 |
| `--apple-brand` | `#1d1d1f` | **已定义但未被引用**（主按钮渐变写在 `ui.tsx` 里：`#2c2c2e → #121214`） |
| `--apple-brand-hover` | `#2c2c2e` | 同上，未被引用 |

**已知不一致：** `body` 的背景写的是 `#f0f2f5`，与 `--apple-canvas` 的 `#f2f4f7` 不是同一个值；因为业务页面都在 `.ws-canvas` 内，实际看到的是 `#f2f4f7`，`#f0f2f5` 只在画布之外的裸露区域可见。建议统一为 `#f2f4f7`。

### 3.2 中性阶与默认 surface

| 值 | 角色 | 实际用法 |
|---|---|---|
| `#1d1d1f` | 主文字 / 深色实心 | H1、卡片标题、主按钮渐变基色、顶栏选中胶囊、H 数大数字 |
| `#6e6e73` | 次级说明 | 页面副标题 `text-xs text-[#6e6e73]`、`SectionHead.sub`、指标条小标题 |
| `#86868b` | 辅助 / 元信息 | 全站出现频率最高的前景色：元数据、说明、10–11px 徽标、未选中导航 |
| `#515154` | 长段落正文 | 材料清单、同步日志、备注正文、`line-clamp` 摘要 |
| `#f5f5f7` | 浅灰面 | 内嵌信息块 `bg-[#f5f5f7]`、快捷入口卡、部分表单输入底 |
| `#ffffff` | 纸面 | `Card` / `.ws-paper`、`Btn variant="ghost"` 底 |
| `bg-black/[0.04]`、`bg-black/[0.03]` | 半透明底 | chip / 标签底、hover 底色、进度槽 |
| `border-black/[0.05]`–`[0.08]`、`ring-black/10` | 描边 | 分隔线、区块边、chip 环 |
| `border-black/25` | 悬停描边 | 卡片 hover、ghost 按钮 hover |

### 3.3 语义强调色（业务页面的实际惯例）

只用「浅底 + 深字 + 半透明同色描边」，不做大面积色块。

| 含义 | 底 / 边 | 字 | 出现场景 |
|---|---|---|---|
| 成功、通过、已录用、在线 | `bg-emerald-50` + `ring-emerald-600/20` 或 `border-emerald-200/50`；呼吸圆点 `bg-emerald-500 animate-pulse` | `text-emerald-800` / `-700` / `-600` | 契合度百分比、双审批完成、成功 toast、`ScoreStamp` ≥ 4、在线状态 |
| 待办、缺失、降级、待核实 | `bg-amber-50` + `ring-amber-600/20` | `text-amber-800` | 「原件缺失 / 附件缺失」、减分信号、二次确认高亮、`ScoreStamp` < 3.2 |
| 风险、驳回、重点催办 | `bg-rose-50` / `border-rose-200/50`；`bg-rose-500 animate-pulse` | `text-rose-800` / `-700` | 审批流转中侧标、驳回状态 |
| 流程分区（非语义，仅工作台四类待办色标） | `violet-500`（初筛）/ `amber-500`（约面）/ `emerald-500`（面评）/ `rose-500`（审批）作 `border-l-4` 侧标 + `bg-*-50` 图标块 | 对应 `-800` / `-700` | 左侧色条是「这是哪条业务线」，不是「好 / 坏」 |
| 中性、终态、无数据 | `bg-black/[0.04]` / `bg-zinc-100` | `text-[#86868b]` / `zinc-800` | 已淘汰、空态、禁用信息 |
| 录制中 | `bg-red-400` + `animate-pulse` | — | 计时器 / 悬浮入口红点 |

### 3.4 深色子系统（例外，保持现状）

登录页、候选人端 `Join.tsx`、考场 `Offline.tsx` / `live.tsx`、简历 `ResumeDoc.tsx` 仍使用旧纸张/墨色语言：墨色底 `#1d2939`、纸面 `#fffdf9`、强调色 `amber-400`（配 `text-[#1d2939]` 字），墨色层文字用 `text-white` / `white/55` / `white/45`，边框 `white/15`，悬停底 `white/10`。改动这些页面时按现状写，不要往 `--apple-*` 上迁。

## 4. 排版

字体：`Inter` + `Noto Sans SC`，通过 `--font-display` / `--font-sans` / `--font-mono` 设置。**三个 token 指向同一套字体栈**，所以 `font-mono` 在当前配置下不产生等宽效果（审批单号、Admin 日志、时间码仍在用它，只是视觉上的小号字）。

| 层级 | 实际写法 | 场景 |
|---|---|---|
| 页标题 H1 | `text-2xl font-bold tracking-tight text-[#1d1d1f]` | 每页一个，置于页眉带内 |
| 区块标题 H2 | `SectionHead` → `text-xl font-bold tracking-tight` | 卡片区块；手写时用 `text-base` / `text-lg font-semibold` |
| 卡片小标题 | `text-sm font-semibold` / `text-base font-semibold` | 侧栏标题、弹窗标题 |
| 统计大数字 | `text-3xl font-bold tracking-tight tabular-nums`（Workbench / Approvals）；`text-xl font-bold`（Candidates 指标条）；`text-[28px]`（旧页面 Home / Overview） | 指标卡 |
| 列表主标题 | `text-sm font-semibold`（Workbench 名单）/ `text-base font-semibold`（Candidates 姓名） | |
| 正文 | `text-sm`（Bank 表单与答案，行高 `leading-6`）/ `text-xs`（业务页面默认密度） | |
| 次要 / 说明 | `text-xs text-[#6e6e73]`（页脚副标题）、`text-xs text-[#86868b]`（元信息） | |
| 微标签 | `text-[11px]` / `text-[10px]` | 徽标、指标名、时间码 |
| 按钮 | `text-xs font-medium`（`Btn` 内置） | |
| 数值 | `tabular-nums` 工具类 | 计数、百分比、时间、得分 |

**`font-feature-settings` 的现实：** `body` 设 `'tnum'`，`.ws-canvas` 覆盖为 `'cv02','cv03','cv04','cv11'`（Inter 字形变体）。因为业务页面全在 `.ws-canvas` 内，全局 `'tnum'` 实际上被覆盖；加上 `font-feature-settings` 属低层特性，通常会压过高层的 `font-variant-numeric`。**结论：不要依赖 body 的全局 `tnum`，每个数字都要显式写 `tabular-nums`。**

## 5. 间距、圆角、阴影、动效

### 5.1 间距与栅格

| 项目 | 实际值 |
|---|---|
| 页面容器 | `mx-auto max-w-7xl px-6 py-8`（`App.tsx` 的 `main`） |
| 页眉带 | `flex flex-col md:flex-row md:items-end justify-between gap-4 border-b border-black/[0.08] pb-5` |
| 页面区块纵向间隔 | `space-y-6`；区块内部 `space-y-3` ~ `space-y-4`（列表/表单），侧栏 `space-y-5`（旧语言的 Result 用 `space-y-8`） |
| 卡片内边距 | 指标卡 `p-5`；明细/表单卡 `p-6`；列表行 `p-4`（窄行 `px-5 py-4`）；空态 `p-12` |
| 栅格 | 工作台主区 `lg:grid-cols-[1fr_360px]`；指标条 `sm:grid-cols-2 lg:grid-cols-4` / `sm:grid-cols-3`；审批双轨 `sm:grid-cols-2`；详情双栏同 `lg:grid-cols-[1fr_360px]` |
| 控件高度 | `Btn` `h-9`；行内小按钮 `!h-8 !px-3.5`；搜索框 `h-8` / `h-9`；表单输入 `h-9` / `h-10`；顶栏 `h-12` |
| 基础刻度 | 4px，只用 Tailwind 刻度，不写奇数像素 |

### 5.2 圆角

| 元素 | 实际值 |
|---|---|
| 卡片 | `rounded-2xl`（16px） |
| 内嵌面板 / 输入框 / 分段控制器 | `rounded-xl`（12px） |
| 小按钮、Bank 表单字段、浮层菜单 | `rounded-lg`（8px） |
| chip / 小标签 | `rounded-md`（6px） |
| 按钮、筛选胶囊、徽标、头像、分段按钮 | `rounded-full` |
| 候选人详情头图（特例） | `rounded-3xl` |

### 5.3 阴影

| 场景 | 用法 |
|---|---|
| 静止卡片 | `ws-paper` 自带 `--shadow-paper`（含 `inset 0 1px 0 #fff` 顶部高光） |
| 悬停抬起 | `hover:-translate-y-0.5` ~ `-translate-y-1` + `hover:shadow-md` / `hover:shadow-lg`，或用 `.ws-lift`（切到 `--shadow-lift`） |
| 浮层菜单 | `shadow-[var(--shadow-lift)]` |
| 弹窗 | `shadow-2xl` |
| 悬浮入口胶囊 | `shadow-2xl` + `bg-[#1d1d1f]/90 backdrop-blur-xl` |

`.ws-paper` 的定义里已含 `1px rgba(0,0,0,0.07)` 描边；页面仍普遍再叠一层 `border border-black/[0.06]`。`Card` 组件本身不叠 —— 新代码用 `Card` 即可，不必重复写描边。

### 5.4 动效

| Token / 类 | 实际值 | 用于 |
|---|---|---|
| `--dur-fast` | `160ms` | 颜色、透明度、按压 |
| `--dur-base` | `280ms` | 位移、阴影、`.ws-lift` |
| `--dur-slow` | `600ms` | 进度 / 分数条 |
| `--ease-out` | `cubic-bezier(0.16, 1, 0.3, 1)` | 全站统一缓动 |
| `.ws-rise` | 0.4s 入场：`opacity 0→1`、`translateY(10px→0)`、`scale(.995→1)`；延迟 `--i × 40ms` | 页眉带、区块、卡片依次入场 |
| `.ws-lift` | hover 上移 2px、阴影切 `--shadow-lift`、描边转 `rgba(0,0,0,0.2)` | 需要抬起的卡片 |
| `.ws-press` | `active: scale(.97)` | `Btn` 内部用的是自己的 `active:scale-95` |
| `.login-fade` | 0.4s 淡入（+3px 上移） | 业务页面也广泛用于 toast 条、浮层菜单、展开区 |
| `.ws-segmented-track` / `-active` | 凹槽渐变 `#e4e7ed→#ebedf2` + inset 阴影；选中项纯白 + 顶部高光 | 分段控制器（Workbench 待办切换、候选人详情阶段条） |
| `.ws-scrim` | `rgba(0,0,0,0.32)` + `blur(24px) saturate(140%)` | 弹窗遮罩 |
| `.ws-bar` | `rgba(255,255,255,0.92)` + `blur(24px) saturate(190%)` + 1px 底边 | 顶栏磨砂玻璃 |
| `animate-ping` / `animate-pulse` | 呼吸圆点 | emerald = 在线/进行中；rose/red = 风险/录制 |
| `.voice-ring` | 声波扩散 | 仅 `live.tsx` |
| `.ws-grow` | **`index.css` 中并未定义**，但 `Overview.tsx` / `Result.tsx` 仍在引用 → 那些条形图没有生长动画 | 不要照抄 |

**已知差距：** `prefers-reduced-motion: reduce` 目前只关闭登录页的 `.login-scan` / `.login-fill` / `.login-fade`，`.ws-rise` / `.ws-lift` / `.ws-press` / `.voice-ring` 均未覆盖。新增动效时必须补进该媒体查询。
**冗余待清理：** `.animate-shimmer`、`.animate-pulse-glow`、`.animate-float`、`.glow-*`、`.obsidian-panel` / `.obsidian-card`、`shimmer-sweep` / `border-beam` keyframes 在当前 `tsx` 中无任何引用，属历史遗留，不要在新页面启用。

## 6. 公共组件（`src/views/ui.tsx`）

| 组件 | 真实签名 | 渲染与用法 |
|---|---|---|
| `Label` | `({ children }: { children: ReactNode })` | `text-xs font-semibold text-[#6e6e73]`。**当前没有任何页面引用**，保留给表单字段标签用 |
| `SectionHead` | `({ title, sub }: { no?: string; title: string; sub?: string })` | 外层 `mb-4 flex items-end justify-between`；`h2` 为 `text-xl font-bold tracking-tight text-[#1d1d1f]`；`sub` 为 `hidden text-xs text-[#6e6e73] md:block`。类型里的 `no?` 未被解构使用，是死参数 |
| `Card` | `({ children, className = '' }: { children: ReactNode; className?: string })` | `ws-paper rounded-2xl ${className}`。**无内边距**，需要自己加 `p-4` / `p-5` / `p-6` |
| `Btn` | `({ children, onClick, variant = 'solid', className = '' })`，`variant: 'solid' \| 'ghost' \| 'accent'` | 基类：`inline-flex h-9 items-center justify-center gap-1.5 rounded-full px-4 text-xs font-medium cursor-pointer tracking-tight transition-all duration-150 select-none` |
| `ScoreStamp` | `({ score }: { score: number })` | `text-base font-bold tabular-nums`；≥ 4 为 `text-emerald-600`，≥ 3.2 为 `text-[#1d1d1f]`，< 3.2 为 `text-amber-600`；后缀 `/5` 为 `text-xs font-normal text-[#86868b]` |

`Btn` 两个变体：

- `solid`（默认）：黑色渐变胶囊 `bg-gradient-to-b from-[#2c2c2e] to-[#121214] text-white border border-black/80`，阴影 `0 2px 6px rgba(0,0,0,0.22), inset 0 1px 0 rgba(255,255,255,0.22)`，hover 提亮到 `from-[#3a3a3d] to-[#1c1c1f]`，`active:scale-95`。
- `ghost`：`bg-white text-[#1d1d1f] border border-black/[0.12]` + 顶部高光阴影，hover `bg-black/[0.03]` + `border-black/25`。
- `accent`：**当前与 `solid` 渲染完全相同**（源码里两者走同一分支：`variant === 'solid' || variant === 'accent'`）。这是**已知缺陷，待修**；调用点仍有 8 处（Bank 2、CandidateDetail 1、Interviewer 2、ScheduleManager 1、Offline 5）。**在修好之前，不要宣称「accent 是琥珀焦点色」，也不要把 accent 当作「本屏唯一焦点」的依据。**

`Btn` 目前不支持 `disabled`、不设 `type="button"`、无 `aria-*`、无 `focus-visible` 样式；小尺寸按钮通过 `className="!h-8 !px-3.5"` 覆盖。

**未抽成组件、但已成惯例的写法**（照抄类名即可）：

- 阶段/状态徽标：`rounded-full border px-2.5 py-0.5 text-[11px] font-semibold`；进行中用实心深色，成功用 `bg-emerald-50 text-emerald-800`，终态用 `bg-black/[0.04] text-[#86868b]`。
- 信息 chip：`rounded-full bg-black/[0.04] px-2.5 py-0.5 text-xs` 或 `ring-1 ring-inset ring-black/10`。
- 筛选胶囊：未选中 `bg-white text-[#86868b] border border-black/[0.06]`；选中 `bg-[#1d1d1f] text-white shadow-2xs`。
- 顶栏 / 分段控制器：`ws-segmented-track` + `ws-segmented-active`。
- 输入框：`h-9 w-full rounded-xl border border-black/[0.08] bg-white px-3 outline-none focus:border-black/50`（Bank 用 `rounded-lg border-slate-200` 的旧写法）。
- 弹窗：见 §8。

## 7. 页面骨架

```jsx
<div className="ws-canvas min-h-screen">
  <header className="sticky top-0 z-30 ws-bar">…</header>
  <main className="mx-auto max-w-7xl px-6 py-8">…页面内容…</main>
  <BgRoomWidget />   {/* 后台考场悬浮入口，fixed bottom-6 right-6 z-40 */}
</div>
```

- **顶栏**：左侧 F 圆徽标 + `FaceTry` + 「招聘工作台」灰胶囊 + 分段导航胶囊（`hidden lg:flex`；选中 `bg-[#1d1d1f] text-white shadow-2xs`，未选中 `text-[#86868b] hover:text-[#1d1d1f] hover:bg-black/[0.04]`，`rounded-full px-3 py-1 text-xs font-medium`）；右侧「重置数据」`text-[11px]` 与用户胶囊。`lg` 以下导航换成第二行横向滚动条（`border-t border-black/[0.04]`）。
- **页面首块**必为页眉带（H1 + 一行副标题 + 右侧主操作），后续区块依次 `ws-rise` 并设置 `[--i:1]`、`[--i:2]`…
- 业务页面之外有两条独占全屏的路径：`Login`（未登录）与 `Offline`（`view === 'room'`），二者都不在 `main` 里。
- **已知不一致：** 旧文档说「切换页面靠 `main key={view}` 重播入场」，实际 `main` 上没有 key，入场动画靠组件挂载/卸载重播；同一组件换 `cid`（如 `Result`）不会重播。

**新页面自检清单**

1. 处于 `ws-canvas` 内，用 `main` 容器，且只有一个 H1。
2. 内容块用 `Card` 或 `ws-paper`，不再重复写 `border bg-white`。
3. 各区块按顺序加 `ws-rise` 与 `[--i:n]`。
4. 状态颜色只用 §3.3 的语义色；不要引入新的蓝色系。
5. 数字一律 `tabular-nums`；不新增全大写、衬线字体与装饰渐变。
6. `lg` 以下能正常堆叠（多栏改单栏，宽表横向滚动或 `no-scrollbar` 容器）。
7. 弹窗、图标按钮按 §8 的可访问性要求写。

## 8. 交互与可访问性

**现状（应遵守）**

- 可点击元素一律带 `cursor-pointer`，并有 hover 态：描边变深（`hover:border-black/25`）、底色变化（`hover:bg-black/[0.03]`~`[0.04]`）、卡片抬起（`hover:-translate-y-0.5`）。
- 输入聚焦：`outline-none focus:border-black/50`（Bank 系）或 `focus:ring-2 focus:ring-black/10`（Interviewer 系）。**不存在** `outline-blue-600` 焦点环。
- 弹窗统一：`.ws-scrim` 遮罩（点击关闭）+ 内层 `ws-paper rounded-2xl p-6 border border-black/[0.08] shadow-2xl max-w-sm|lg`，内层 `onClick={(e) => e.stopPropagation()}`，右上角文字 `✕`。
- 破坏性 / 不可逆操作要二次确认：第一次点击只给提示，再次点击才执行（重置数据、提交面评时有未评分题、未结束面试返回工作台）。
- 结果反馈：行内 `login-fade` toast 条（3.5s 后自动消失，见 Workbench / Approvals）或底部黑色胶囊 toast（Bank）；不用浏览器 `alert`。

**已知差距（待修；写新代码时不要复制这些做法）**

- 所有弹窗都没有 `role="dialog"` / `aria-modal="true"` / 焦点陷阱 / 初始聚焦，也不能按 `Esc` 关闭或点 `✕` 以外的方式关闭（**唯一**实现了 `Esc` 的是 `Login.tsx` 的登录弹层）。
- 纯图标按钮普遍缺 `aria-label`：顶栏退出 `✕`、各弹窗关闭 `✕`、Jobs 删除标签的 `✕`。
- `Btn` 无 `disabled`、无 `type`、无键盘焦点样式。
- 弹窗打开时背景未 `aria-hidden`、未锁滚动。
- `.ws-rise` 等动效未纳入 `prefers-reduced-motion`（见 §5.4）。
- `Btn variant="accent"` 与 `solid` 同渲染（见 §6）。
- 深色子系统里的快捷键（考场用数字键 1–5 打分、← → 切题）属于 `Offline.tsx` 的局部实现，不是全站约定。

**建议的新写法：** 弹窗补 `role="dialog" aria-modal="true" aria-labelledby` + `Esc` 关闭 + 打开时聚焦首个可操作元素 + 关闭按钮 `aria-label="关闭"`；图标按钮一律补 `aria-label`。

## 9. 日期与演示数据口径

- 演示「今天」= `src/data.ts` 的 `export const TODAY`（当前值 `2026-10-01`）。所有相对时间展示都以它为基准。
- `slot` 一律是 ISO `YYYY-MM-DD HH:mm` 字符串；展示统一走 `store.ts` 的 `slotLabel(slot)`（输出「今天 14:30 / 明天 16:00 / 10-08 15:00」）。同一天的判断用 `slot.startsWith(TODAY)`，排序用 `localeCompare`。
- **禁止在页面里写死日期字符串或「今天」字样。** 只展示时刻时可以用 `slot.slice(11)`（Workbench 今日考场列表的做法）。
- 页面里的日期字面量（如 Approvals 表单默认入职日期 `2026-11-01`）是演示默认值，后续应由 `TODAY` 推导，不要新增同类硬编码。

## 10. 候选人阶段枚举

目标值（正在与 PRD / 开发要求并行落地）：

`新入库 / 筛选中 / 待联系 / 约面中 / 面评中 / 待录取 / 已完成 / 搁置 / 已淘汰`

- 与《开发要求》§04 A4 的表述一致（「新入库 / 筛选中 / 待联系 / 约面中 / 面评中 / 待录取 / 已完成 / 搁置等」）。
- **已知不一致：** `src/data.ts` 的 `STAGES` 目前仍是旧集合 `新入库 / 待初筛 / 待约面 / 待面试 / 待评价 / 待录取 / 已录取 / 已淘汰`，`Candidates.tsx` 的 `stageCls` 也按旧集合配色。迁移期间以 `STAGES` 常量为准，**不要在页面里散落写死阶段字符串**（筛选项、计数、徽标配色都应从 `STAGES` 派生）。
- 徽标惯例见 §6；阶段流转只追加历史，不回改（`stageHistory` 追加不覆盖）。

## 11. 本文档已删除的过时规定

以下写法/取值来自旧版本文档或早期设计，**与当前代码不符，不要按它们实现**：

| 旧规定 | 现状 |
|---|---|
| 主色低饱和墨蓝 `blue-600` / `#334d70`，并声称已在 `@theme` 中替换 `blue-*` | `@theme` 现在只定义 `--font-*`；主色是黑色渐变胶囊 `from-[#2c2c2e] to-[#121214]`（`ui.tsx`）。`#334d70` 只剩登录页插画 SVG 里的一段 |
| 画布 `#f4f3ef`、纸面 `#fffdf9`、墨色承托层 `#1d2939` | 业务页面改为 `#f2f4f7` / `#ffffff`；`#fffdf9`、`#1d2939` 仅存于深色子系统（登录 / Join / Offline / live / ResumeDoc）与仍按旧语言实现的页面（结果分析 `Result`，以及未挂路由的 `Home` / `Interviewer`） |
| 令牌名 `--ink` / `--canvas` / `--paper`、`.ws-grow` | 均不存在；实际是 `--apple-canvas` / `--apple-paper` / `--apple-text` 等，`.ws-grow` 从未定义（但仍有引用，见 §5.4） |
| 「琥珀每屏只能出现一处，只标记下一步」 | 业务页面已无唯一焦点色；琥珀是「待办 / 缺失 / 降级」语义色，同屏可多处出现。深色考场仍以 `amber-400` 作强调 |
| 文字阶 `slate-900 / 700 / 500 / 400` | 业务页面改用 `#1d1d1f` / `#6e6e73` / `#86868b` / `#515154`；`slate-*` 只剩 Bank 与旧页面 |
| 卡片 `rounded-xl`、按钮与输入 `rounded-lg`、纸张 2px | 卡片 `rounded-2xl`、按钮 `rounded-full`、内嵌面板与输入 `rounded-xl` |
| 「卡片不加 border，阴影已含 1px 描边」 | `.ws-paper` 确实自带 1px 描边，但页面仍普遍再写一层 `border border-black/[0.06]`；新代码不叠即可 |
| `--dur-fast 150ms` / `--dur-base 300ms` / `--dur-slow 700ms` / `cubic-bezier(.2,.7,.2,1)` | 实际为 `160ms` / `280ms` / `600ms` / `cubic-bezier(0.16, 1, 0.3, 1)`（Candidates 契合度条另行硬编码 `duration-700`） |
| `.ws-rise` 每级延迟 60ms、上移 8px | 实际延迟 40ms、上移 10px 并带 `scale(.995)` |
| 切换页面靠 `main` 的 `key={view}` 重播入场 | `main` 上没有 key，靠组件挂载/卸载 |
| 焦点环 `outline-2 outline-offset-2 outline-blue-600` | 不存在；实际用 `focus:border-black/50` / `focus:ring-black/10` |
| 浮层支持 `Esc` 关闭、面试间数字键打分写进通用规范 | 弹窗无 `Esc`（仅登录页有）；打分快捷键是 `Offline.tsx` 的局部实现 |
| 选项卡下划线用 `bg-amber-400` + `scale-x-0→100`、选中筛选胶囊 `bg-[#1d2939]` | 下划线写法只在深色考场的题目选项卡里；业务页面选中态统一 `bg-[#1d1d1f] text-white` |
| 候选人状态机 `待约面 → 待面试 → 待评价 → 跟进中 → 已结束` | 已作废，见 §10 新枚举 |
| 弹窗遮罩「墨色 45% + blur(12px)」 | 实际 `.ws-scrim` 为 `rgba(0,0,0,0.32)` + `blur(24px) saturate(140%)` |
| 「标签 Chip `rounded px-1.5 py-0.5 text-xs`」 | 实际用 `rounded-full` 或 `rounded-md`，字号多为 `text-[10px]` / `text-[11px]` |
