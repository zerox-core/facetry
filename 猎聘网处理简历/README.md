# 猎聘简历初筛工具

把猎聘企业端收到的简历，按你们 5 个岗位的 JD **自动** 做"合适 / 待定 / 不合适 / 信息不足"判定，
把结果汇总到固定窗口里，并能直接对猎聘页面执行通过/不合适。

## ✨ 功能一览

- **6 张统计卡**：累计扫描 / 今日扫描 / 合适 / 待定 / 不合适 / 信息不足
- **可按** 判定 / 岗位 / 日期 筛选历史结果
- **基于大模型或本地规则** 做语义匹配（开启大模型更准，规则版免费可解释）
- **通过 CDP 连接你电脑上的 Chrome**，模拟人点击猎聘页"通过筛选/不合适"按钮
- **SSE 实时日志**，扫描过程随时可见
- **数据落地 SQLite**，关机不丢

## 🚀 启动步骤（必读）

### 第一步：启动 Chrome（必须用调试模式）

⚠️ **新版 Chrome 强制要求 `--remote-allow-origins=*`**，否则外部程序连不上 websocket。

1. **完全关闭** 当前所有 Chrome 窗口（任务管理器里也别留）
2. 在 cmd / PowerShell 里执行：

```bash
chrome.exe --remote-debugging-port=9222 --remote-allow-origins=*
```

3. 在弹出的 Chrome 里打开 https://lpt.liepin.com → 进入 **"人才管理 → 求职者投递 → 未处理"** 列表页
4. 确认你已登录（猎聘会保持你的登录态）

### 第二步：启动工具

双击 `启动.bat`，浏览器自动打开 http://127.0.0.1:7788

工具启动后会立刻：
- 检测你的 Chrome 是否在线
- 读所有候选人列表
- 对每份简历自动：抓详情 → 与 JD 匹配 → 写入数据库 → 推到窗口
- 点击窗口的"扫描新简历"即可开扫；点击"停止扫描"立即终止

## 📁 目录结构

```
猎聘网处理简历/
├── app/
│   ├── main.py               # Flask 入口（7788端口）
│   ├── core/
│   │   ├── config.py         # 配置加载
│   │   ├── db.py             # SQLite 读写
│   │   ├── jd_loader.py      # 读 JD 汇总.xlsx
│   │   ├── jd_matcher.py     # 规则 / LLM 匹配
│   │   ├── cdp_client.py     # Chrome 调试协议
│   │   ├── resume_parser.py  # 简历 DOM 解析
│   │   ├── scanner.py        # 扫描编排（线程/SSE）
│   │   └── diagnose.py       # 抓 DOM 用，单次运行
│   ├── data/schema.sql       # 数据库表结构
│   └── templates/index.html  # 单文件 UI
├── data/recruit.db           # SQLite 数据库（首次启动自动创建）
├── logs/                     # diagnose 输出的 DOM 快照
├── config.json               # 配置（API Key、端口等）
├── requirements.txt
├── 启动.bat                  # 双击启动
└── README.md
```

## ⚙️ 配置（config.json）

```json
{
  "chrome": { "host": "127.0.0.1", "port": 9222 },
  "scanner": {
    "batch_size": 10,
    "delay_between_resumes_ms": 1500,
    "auto_operate": false        // true = 自动点猎聘"通过/不合适"
  },
  "llm": {
    "enabled": false,           // 改 true 并填 key 即开启大模型判定
    "base_url": "https://api.deepseek.com/v1",
    "api_key": "sk-...",
    "model": "deepseek-chat"
  },
  "platforms": [
    { "name": "猎聘网", "code": "liepin", "url_match": "liepin.com/ihome", "enabled": true }
  ]
}
```

要接入大模型：填 `api_key` 后把 `enabled` 改为 `true`。
支持所有 OpenAI 兼容协议：DeepSeek / Kimi / 智谱 / Qwen / OpenAI 本身。

## 🧰 工具命令

```bash
# 主程序（窗口）
启动.bat

# 抓猎聘当前页 DOM 到 logs/ —— 调整 selector 用
D:\Python312\python.exe -m app.core.diagnose

# Mock 模式（无 Chrome 也能演示）
curl -X POST http://127.0.0.1:7788/api/scan/start -H "Content-Type: application/json" -d "{\"mock\":true}"
```

## 🛠 调试 / 自适配

如果猎聘改版导致抓不到字段：
1. 启动 Chrome 并打开猎聘投递列表页
2. 程序启动后打开 /api/chrome/status 确认 Chrome 在线、Tab 已识别
3. 运行 `python -m app.core.diagnose` 把页面 DOM 写到 `logs/`
4. 根据 DOM 调整 `app/core/resume_parser.py` 里的选择器

## 📌 注意事项

1. 第一次用 Mock 模式跑一遍，确认 UI 和判定逻辑符合预期
2. 实扫前先把 `scanner.auto_operate` 设成 `false`，人工核对判定后再改为 `true`
3. 大模型 API 调用按 token 计费，建议先用规则模式，规则跑通后再开 LLM
4. 本工具只在你本机运行，不上传简历到任何外网（除非你配置了 LLM，会把简历发给对应厂商）

## ❓ 常见问题

**Q: 启动后页面说"Chrome 未连接"？**
A: 99% 是你启动 Chrome 时没加 `--remote-allow-origins=*`。完全关闭 Chrome 后重启。

**Q: 启动后说"未识别到猎聘页面"？**
A: 请在 Chrome 里手动打开 https://lpt.liepin.com/resume/apply，再点窗口里的"重新检测"。

**Q: 大模型判定不准确？**
A: 调整 `app/core/jd_matcher.py` 的 `match_by_rules` 硬规则，或为大模型加上 few-shot。
