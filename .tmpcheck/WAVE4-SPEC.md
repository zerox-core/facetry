# WAVE 4 共享规范 · 「象牙白 + 墨黑 + 荧光青柠」全站换肤

> 地基已由 Lead 完成：`src/index.css` 令牌、`src/App.tsx` 外壳、`src/views/ui.tsx` 的 Chip。
> **不要改** index.css / App.tsx / ui.tsx / data.ts / store.ts / Login.tsx / LoginShowcase.tsx / Home.tsx。
> 只改自己名下的文件；改完回读确认。

## 0. 设计语言（参考用户给的图：「整页黑白灰，只留一支荧光」）

- 面积配比 ≈ **80% 近白底 · 12% 墨黑 · <6% 荧光青柠**。
- 荧光青柠 = 全站**唯一彩色**，只落在「**当前/进度/激活**」上：当前页签、进行中指标、选中态、在线/录音点、当前那根柱子、当前进度。
- 状态色被压成**近墨的暗调**（橄榄墨/琥珀墨/砖墨/灰墨）——小面积使用，保住「成功/待办/失败」可辨识，整体仍读作黑白灰。

## 1. 新令牌表（已生效，直接用语义类，不要写死 hex）

| 语义 | 值 | 用途 |
|---|---|---|
| `base-100` | `#ffffff` | 卡面 |
| `base-200` | `#f3f2ec` | 画布（页面底，暖象牙白） |
| `base-300` | `#e4e3d9` | 描边/分隔 |
| `base-content` | `#1b1b18` | 墨黑正文（`/70` `/60` `/50` 次要） |
| `primary` | `#1b1b18` 墨黑 | 主按钮、激活控件（`-content` 近白） |
| `secondary` | `#33332e` 墨灰 | 数据条/柱状/次行动 |
| `accent` | `#d9e04a` **荧光青柠** | 唯一彩色，只用于「当前/进度/激活」（`-content` `#1c1f04` 墨绿黑） |
| `neutral` | `#1b1b18` 墨黑 | 墨黑药丸徽标/锚点卡（`-content` 近白） |
| `success` / `warning` / `error` / `info` | `#55661d` / `#8a6a14` / `#8c2f28` / `#63635b` | 橄榄墨/琥珀墨/砖墨/灰墨，各配近白 `-content` |

## 2. 荧光青柠使用铁律（这条是风格的灵魂）

**允许的两种形态**：
1. **实底面**：`bg-accent text-accent-content`（小块面：当前页签、进行中指标块、当前柱、进度填充、选中标记）。
2. **墨底上的点/字**：在 `bg-neutral`（墨黑药丸/卡）上放 `bg-accent` 圆点或 `text-accent` 小字。

**禁止**：
- 白底上的 `text-accent` 文字（荧光在白底对比不足，一律不行）；
- 大面积荧光铺陈（超过一个小色块/一根柱/一条进度的面积）；
- hover/装饰性荧光描边、荧光渐变、荧光阴影。

## 3. 深色时代 → 浅色时代 替换对照表（这就是你的工单）

| 深色时代写法 | 新写法 |
|---|---|
| `bg-white`（不透明） | `bg-base-100` |
| `bg-white/5`、`/10`、`/15`（原"提亮层"） | `bg-base-content/5`、`/10`（浅色下=压暗层） |
| `text-white`、`text-white/60~90` | `text-base-content`、`text-base-content/60~90` |
| `border-white/10~30` | `border-base-content/10~15` |
| `bg-black/[0.04~0.08]`（压暗/阴影层） | `bg-base-content/5` |
| **视频/摄像头叠层 `bg-black/40~55` + 其上 `text-white`** | **保留不动**（媒体语义） |
| `bg-base-content text-base-100`（原墨底反白） | **保留**（现在就是墨黑药丸白字，正是参考图语言） |
| 上一波深色补丁 `bg-base-content/10 text-neutral-content` | `bg-neutral text-neutral-content`（墨黑药丸） |
| `text-accent`（白底荧光字，旧天蓝遗留） | 面→`bg-accent text-accent-content`；字→`text-base-content` 或 `text-success`；墨底上的小字可保留 `text-accent` |
| `bg-accent/15~30`、`badge-soft badge-accent`（浅荧光底+荧光字） | `bg-accent text-accent-content`（实底）或 `bg-base-content/5 text-base-content` |
| `text-secondary`（旧靛蓝字） | `text-base-content` 或 `/70` |
| `bg-secondary`（数据条/柱） | **保留**（现在=墨灰，参考图的黑色数据柱） |
| `from-primary to-secondary`、`from-[#FF5A36]` 等彩色渐变 | 删除，改纯色（墨黑或荧光面） |
| `shadow-2xl`（深色大柔影） | `shadow-lg` 或 `shadow-[var(--shadow-paper)]`；`shadow-sm/md` 保留 |
| 固定品牌 hex（`#FF5A36` `#6366F1` `#7CD7F3` `#A8BFA4` `#1d2939` `#0f2938` 等） | 按上表语义替换，全部退役 |

对比度硬性：正文 `text-base-content`、次要 `/60`（最弱 `/50`）、分隔 `border-base-300`；彩色实底必须配对应 `-content`；状态不能只靠颜色（上一波加的文字标注一个都不要删）。

## 4. 不要动的东西（上一波刚定稿）

- **间距**：`gap-*`/`space-y-*`/`p-*` 一律不动（WAVE3 已统一 +1 档）。
- **动效**：`.motion-pop` / `.motion-meter` / `.stagger` / `ws-rise` / rAF 进场 / 160-280-600ms 三档——全部保留原样，不要增删改。
- 功能逻辑、数据流、二次确认、权限门控——一个字符都不动。
- 视频区/摄像头画面的深色叠层是媒体语义，保留。

## 5. 自检

```powershell
node .\node_modules\typescript\bin\tsc -p tsconfig.json --noEmit
```
只看自己文件的报错并清零。**禁止** `pnpm build`、`oxfmt`、任何 git 操作、修改地基文件。

报告 ≤25 行：清了哪些深色残留（给数字）、荧光青柠落在了哪几处「当前/进度/激活」上、tsc 结果、未决。
