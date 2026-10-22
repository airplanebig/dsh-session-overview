# AGENTS.md — 给后续修改这个插件的会话看

这份文件是**交接口**，不是给终端用户看的。目标：任何一个新的 AI 会话读完它就能改代码，不必重新逆推 DSH 的内部契约。

先读 [README.md](README.md) 了解功能，再回来读这份。

## 五分钟上手

```bash
node test/selftest.cjs     # 51 项离线校验，不依赖 DSH / 浏览器
```

改完代码后：插件在 profile 里是 `link:` 依赖，**重启 DSH 即可**，不需要重装、不需要 pnpm install。

装在哪里：`~/.dsh/profiles/desktop/package.json` 的 `dependencies` 与 `dsh.profile.bundles`，`node_modules/dsh-session-overview` 是指向本目录的 junction。

## 结构

```
package.json        两个 inject 列表（node 侧 dsh.client.inject 与 lib/client.js 里的 inject）必须一致
cordis.patch.yml    bundle 挂载声明，只 insert 自己这一个 id
lib/index.js        Host 半身：空 apply()，本插件不碰服务端
lib/client.js       浏览器半身：__ModuleLoader__.load({ id, factory })，全部逻辑在这里
test/selftest.cjs   离线校验（假 loader + 假 React + 假会话 API）
```

## 运行时契约（均从 DSH 安装包的 `app.asar` 读出来，不是猜测）

### 插件加载

`package.json` 的 `dsh.client` 声明浏览器半身需要的服务与平台；`dsh.bundle.patch` 指向 profile patch。
浏览器半身通过 `window.__ModuleLoader__.load({ id, factory })` 注册，`factory(require)` 里返回 `{ apply, inject }`。

### 插槽（slots）

```js
ctx.slots.inject("<slot>", () => ctx.slots.register(definition, Component));
```

本插件只用两个：

| 插槽 | 注册形状 | 说明 |
|---|---|---|
| `main` | `{ name: "main", key: PANEL_ID }` | 主区域整页；`ctx.layout.selectPanel(id)` 切到它 |
| `sidebar.panellist` | `{ name, id: PANEL_ID, order: 20, locale, label: () => t("panel") }` | 侧边栏入口行；官方「插件」= order 0、「自动化任务」= 10 |

入口行由侧边栏自己渲染成按钮：点击 → `ctx.layout.selectPanel(id)`。图标组件收到 `{ size, active }`。

其他可用插槽（未使用，改 UI 时可参考）：`shell.overlay`、`sidebar.right.pane.tab`、`conversation.composer`、`sidebar.footer.action` 等，共 70+ 个。

### 会话 API

```js
ctx.sessions.list                      // uSES store: getSnapshot().byId + subscribe
ctx.sessions.search(query, signal)     // { ok, value: { items, hasMore } }；items[].id
ctx.sessions.using(id, { source }, fn) // 持有引用执行；fn 收到 reference
reference.binding.session.prompt([{ type: "text", text }], "queue")  // { ok, error }
```

- `source` 是引用计数归属标签（自由字符串），不影响语义。
- `mode` 可选 `"queue" | "steer"`；本插件固定 `queue`，避免抢占正在跑的回合。
- `prompt` 会自动恢复冷会话；失败返回 `{ ok: false, error }`，不抛异常。
- 会话持久化有**每会话单写者内核锁**，所以外部进程（例如 headless CLI）无法往 GUI 正在用的会话里写——这就是本插件必须做在 host 内部而不是旁路程序里的原因。

### 导航与布局

```js
ctx.uiWorkspace.openSession(id)   // 打开会话（内部 reveal）
ctx.layout.selectPanel(null)      // 回到会话视图
```

### 本地化

```js
ctx.locale.register(NS, { zh: {...}, en: {...} })   // 在 ctx.effect 里注册
const t = ctx.locale.bind(NS)
```

`side.panellist` 的 `label` 必须用 `locale` + `t(...)`，否则不会被侧边栏的 label 解析逻辑处理。

### 主题令牌

不要写死颜色。已用的：

```
label-primary / -secondary / -tertiary / -primary-foreground
border-l1 / l2
bg-layer-1 / 2
interactive-bg-active / -hover
button-primary-fill          ← 必须与 label-primary-foreground 成对
brand-primary
menu-surface-fill（写作 --dsw-menu-surface-fill）
elevation-panel
radius-md / lg
state-warn-primary / state-error-primary
```

**主按钮范例**（照抄，不要改成 `#fff`）：

```js
{ background: "var(--dsw-alias-button-primary-fill, #4d6bfe)",
  color: "var(--dsw-alias-label-primary-foreground, #fff)" }
```

深色主题下 `button-primary-fill` 偏亮，`label-primary-foreground` 会变成深色文字；写死白色会在深色下看不清——这个 bug 已经出现过一次。

## 代码地图（lib/client.js）

| 区块 | 职责 |
|---|---|
| `PANEL_ID` / `NS` / `LAYOUT_KEY` / `ASK_KEY` | 常量；改 id 要同步 package.json 与 cordis.patch.yml |
| `T` | 设计令牌表（含 fallback） |
| `DICT` | 中英文字典 |
| `useStore` | uSES 订阅 |
| `baseName` / `ago` / `clampInt` | 小工具 |
| `normalize` / `bigrams` / `overlapScore` | 中文友好的二元组匹配 |
| `rankCandidates` / `pickBest` | 打分与阈值（0.35 / 0.05） |
| `reasonText` | 把 reason 翻成人话 |
| `readLayout` / `saveLayout` / `readAsk` / `saveAsk` | 偏好持久化 |
| `OverviewIcon` | 侧边栏图标（两个实心方块，18px 可读） |
| `Segmented` | 自绘分段控件（替代原生 select） |
| `WorkspaceCard` | 工作区面板 + 会话格子 |
| `SessionOverviewPage` | 页面：状态、匹配 effect、发送/确认、布局 |
| `apply` | 注册 main + sidebar.panellist |

页面状态（hook 顺序即持久化键，改动时小心）：

```
layout, draft, pinnedId, auto, pickerOpen, busy, status, ask, pending
```

## 不变量（改动时必须保持）

1. **只注册，不篡改**：不要 disable 或覆盖其他插件注册的 slot 条目。
2. **投递只走 `sessions.using(...).binding.session.prompt(...)`**，不要直接改会话日志或模拟 UI 点击。
3. **`queue` 模式**：不要擅自换成 `steer`，那会抢占用户正在进行的回合。
4. **锁定优先**：`pinnedId` 存在时，任何自动匹配都不得改变目标。
5. **确认条语义**：`pending` 存在时，`Esc` 只取消确认，不能顺带 `selectPanel(null)`。
6. **匹配宁缺勿滥**：阈值与领先幅度不可为了“看起来聪明”而下调；错误路由比不路由更糟。
7. **不用原生 `<select>`**：系统绘制的下拉在深色主题下不可控。
8. **不写死颜色**，一律走令牌。
9. **确认前重新检索**：不要复用 250ms 防抖的旧结果。
10. **两个 inject 列表同步**：`package.json` 的 `dsh.client.inject` 与 `lib/client.js` 的 `inject`。

## 改功能的检查清单

- 加 UI 元素：用 `styles.*` 与令牌；新增文案同时加 `zh`/`en`。
- 改匹配：只改 `rankCandidates` / `pickBest`，并在 `test/selftest.cjs` 的纯函数区加断言。
- 改发送：保持 `deliver()` 的单一路径，确认流程不要绕过它。
- 加持久化：新 key 用 `dsh-session-overview:<name>`，读取要有 try/catch 与默认值。
- 改注册形状：同步 `package.json` / `cordis.patch.yml` / 测试断言。
- 改完必须跑 `node test/selftest.cjs`，全部 PASS 再交付。

## 离线测试怎么工作

`test/selftest.cjs` 用 `vm` 造一个沙箱：

- `window.__ModuleLoader__.load` 捕获 `factory`；
- 假 `React`：`useState` 有持久状态、`useEffect` 延迟到渲染后执行并保存 cleanup（这样防抖与 keydown 行为可测）；
- `expand()` 把函数组件展开成纯元素树；
- `render()` 负责 cleanup → 重置 hook index → 渲染 → 跑 effects；
- 假 `sessions`：`list`（uSES）、`search`（固定返回）、`using`（记录调用并回调 `prompt`）；
- 假 `ctx`：`slots.register` 记录注册项，`layout.selectPanel` / `uiWorkspace.openSession` 记录调用。

注意 `send()` 是 async：点击后要 `await wait(0)` 再 `render()`。防抖 250ms 的用例要 `await wait(350)`。

## 常见坑

| 现象 | 原因 / 处理 |
|---|---|
| 改完没反应 | 插件只在启动时加载，必须重启 DSH |
| 侧边栏没有入口 | `order` 冲突或 `label`/`locale` 写法不对；确认 `sidebar.panellist` 注册成功 |
| 深色下文字看不清 | 用了写死颜色或 `button-primary-fill` 配了 `#fff` |
| 图标看不清 | 18px 下细线条会糊成一团，用粗实心形状；先按 18px 渲染预览再定 |
| 内容匹配总是退化成标题匹配 | 宿主没开 `sessionQuery`，或 `sessions.search` 返回空 |
| PowerShell 里自测输出乱码 | 先 `chcp 65001`，并设 `PYTHONIOENCODING=utf-8`（Python 脚本） |
| 直接改 `app.asar` 里的源码 | 不行，它是只读归档；只能用插件机制 |

## 调试

- 客户端异常：DSH 窗口的开发者工具（Console）里能看到 `apply` 抛错。
- 插件是否被加载：`~/.dsh` 下的日志，或把 `console.log` 放在 `apply` 开头看是否打印。
- 想快速验证 API 猜测：优先在 `test/selftest.cjs` 里用假对象跑一遍，再装进真实环境。

## 发布

- 版本号在 `package.json`；`files` 已包含 `lib`、patch、README、AGENTS、LICENSE。
- 面向 GitHub：`git tag vX.Y.Z && git push --tags`。
- 面向 npm：需要改成可发布名称并在 `~/.npmrc` 配置 registry/scope。

## 设计取舍（为什么是这样）

- **主面板而非浮层**：浮层会挡 UI，且“点外面关闭”要靠事件劫持；主面板天然只有一个，切走即关闭。
- **自绘控件而非原生**：原生 `<select>` 的弹出层由系统绘制，深色主题无法适配。
- **锁定与自动两态**：自动匹配总有猜错的时候，所以保留一个“用户说了算”的出口，并且状态要可见。
- **确认可选**：默认开启是因为误投代价高；但锁定后不再确认，避免每次都要两次回车。
- **匹配只用检索+标题+目录**：不引入本地模型做裁判——成本高、延迟大，收益在“两个候选分不清”时才出现。
