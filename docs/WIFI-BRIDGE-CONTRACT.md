# Wi-Fi 连接：启动器 ↔ 系统 分工与接口契约

这份文档是给启动器（`pocketshell`）实现 Wi-Fi 页面用的。系统侧（`PJOS-LINUX`）负责
wpa_supplicant、DHCP、持久化和桥命令；启动器只负责界面、输入和状态机。

一句话原则：**启动器不执行任何系统命令、不读写配置文件、不保存密码。** 它只能调用
`host.__launcher(...)`，其余全部由 runtime 里的 Rust 桥完成。

---

## 1. 谁负责什么

| 职责 | 在哪 | 状态 |
|---|---|---|
| 列出可用网络（扫描 + 解析 SSID/信号/加密） | 系统桥 `wifi_scan()` | 已有 |
| 连接（WPA2-PSK / 开放网络）、DHCP | 系统桥 `wifi_connect()` | 已有 |
| 保存网络（`save_config`） | wpa_supplicant，`/storage/.config/wpa_supplicant.conf` | 已有 |
| 开机自动重连 | 系统 `rcS` 启动 supplicant | 已有 |
| 状态查询（STATE/SSID/IP） | 系统桥 `wifi_status()` | 已有 |
| 断开 / 忘记网络 | 系统桥 `WIFI\tdisconnect` / `WIFI\tforget` | 已实现 |
| PSK 不经过命令行参数 | 系统桥（`wpa_cli` 走 stdin） | 已实现 |
| Wi-Fi 列表页、密码输入、连接中/失败提示 | **启动器 `pages/wifi-page.tsx`** | 需要你做 |
| 软键盘输入（SELECT 唤起） | 启动器（PocketJS 输入模态） | 已有基础 |
| i18n 文案（ja/zh/en） | 启动器 | 需要你补 |

---

## 2. 桥命令契约（稳定，按此实现 UI）

调用方式：`const raw = host?.__launcher?.(cmd) ?? ""`，`cmd` 用 **TAB** 分隔字段。
返回一律是字符串（多行用 `\n`），失败以 `error:` 开头或返回下表中的状态词。

### 2.1 扫描

```
WIFI\tscan
```

返回每行一个网络，字段 TAB 分隔：

```
<ssid>\t<signal>\t<security>
```

- `signal`：`wpa_cli scan_results` 的 signal dBm（字符串，如 `-58`）
- `security`：`wpa` | `wep` | `open`
- 已隐藏/空 SSID 已被过滤；同名只保留第一条
- 失败：`error:supplicant`（supplicant 起不来）

> 扫描最多等 6 秒（内部 12 次 × 0.5 s 轮询），UI 侧请显示"扫描中…"，并且**允许重复按扫描**。

### 2.2 连接

```
WIFI\tconnect\t<ssid>            # 开放网络
WIFI\tconnect\t<ssid>\t<psk>     # WPA2-PSK
```

返回：

| 返回 | 含义 | UI 建议 |
|---|---|---|
| `connected:<ssid>` | 已连上并拿到 IP | 关闭密码框，回到列表并打勾 |
| `need-psk` | 该网络需要密码但没给 | 弹出密码输入 |
| `auth-failed` | 密码错误/四次握手失败 | 提示重试，保留输入框 |
| `not-found` | 扫描里没有这个 SSID（可能已离线） | 提示"网络不可用" |
| `timeout` | 10 秒内没到 `COMPLETED` | 提示超时，允许重试 |
| `error:<detail>` | 其他失败（supplicant 未起、接口忙等） | 原样显示 detail |

> 系统侧把等待上限固定在 10 秒（20 × 500 ms），UI 不要再加自己的短超时。

### 2.3 状态

```
WIFI\tstatus
```

返回三行：

```
state=<wpa_state>
ssid=<当前 SSID>
ip=<IP 或空>
```

`wpa_state` 常见值：`COMPLETED`（已连）、`SCANNING`、`ASSOCIATING`、`4WAY_HANDSHAKE`、
`DISCONNECTED`、`INACTIVE`。

### 2.4 断开 / 忘记 / 已保存 / IP（本轮新增）

```
WIFI\tdisconnect
WIFI\tforget\t<ssid>
WIFI\tsaved                # 每行一个已保存 SSID
WIFI\tip                   # "wlan0|<addr>" 或 "--"
```

返回：`ok` / `ok:<detail>` / `error:<detail>`。

---

## 3. UI 状态机（启动器侧）

```
idle ──(打开 Wi-Fi 页)──> scanning ──> list
                          ↑             │
                          │        (选中网络)
                          │             ├─ security=open ──> connecting ──> connected
                          │             └─ security!=open ─> psk-input ──(确认)──> connecting
                          │                                              ↑
                          └────────────(重试 / 返回)──────────────────────┘
```

要求：

1. **进入页面即扫描一次**，之后提供手动"重新扫描"（建议绑 X/Square）。
2. `list` 每次刷新都重排：已连接置顶，其次按信号强度降序；同名去重。
3. `psk-input` 必须显示 SSID 和"输入 <SSID> 的密码"，密码掩码显示（`••••`）。
4. `connecting` 期间禁止重复确认，显示转圈（用 `onFrame` 帧计数，不要 `setTimeout`）。
5. 失败后停留在 `psk-input`（或 `list`），**不要**把用户踢回顶层。
6. 离开页面时若正在连接，允许后台完成；回到页面用 `WIFI\tstatus` 校正状态。

---

## 4. 输入与按键（PocketJS 约束）

- 文字输入走 `onTextEvent`（PocketJS 的 IME 通道），不要自己实现字符输入。
- **SELECT** = 唤起/切换输入焦点；**A/CIRCLE** = 确认；**B/CROSS** = 返回/取消；
  **X/SQUARE** = 重新扫描；**UP/DOWN** = 列表移动；**LEFT/RIGHT** = 密码框内移动光标（可选）。
- 密码长度：WPA2 是 **8–63 个 ASCII 字符**，少于 8 直接本地拒绝，不要发桥命令。
- SSID 最长 32 字节；超过的扫描结果直接丢弃。
- 密码**不要**写进任何持久化位置（包括 PocketJS 的 `fs` / `db`）——系统已经保存在
  wpa_supplicant 配置里，UI 只做一次性传递。

---

## 5. 版式（720×480 面板，360×240 逻辑，2×）

- 列表一屏放 **8 行**，行高 14 逻辑像素；行内：`[锁图标] SSID ………… -58dBm [已保存]`
- 锁图标用 Nerd Font：`\uf023`（lock）、`\uf09c`（unlock）、`\uf1eb`（Wi-Fi）
- 信号：≥ -60 强、-60..-75 中、< -75 弱（三档图标或颜色）
- 颜色沿用现有 `#00FF99`（正常）/`#FFB400`（警告）/`#3ECFFF`（信息）
- 不要用 `border-*`（PocketJS 不编译该工具类），用背景条分隔
- 所有 `class` 必须是字面量；颜色/状态变化走 `style={{ textColor, bgColor }}`（u32 ABGR）

---

## 6. 文案（i18n，三语都要）

| key | ja | zh | en |
|---|---|---|---|
| wifi.title | Wi-Fi | Wi-Fi | Wi-Fi |
| wifi.scanning | スキャン中… | 扫描中… | Scanning… |
| wifi.empty | ネットワークが見つかりません | 未发现网络 | No networks found |
| wifi.connect | 接続 | 连接 | Connect |
| wifi.connecting | 接続中… | 连接中… | Connecting… |
| wifi.password-for | %s のパスワード | 输入 %s 的密码 | Password for %s |
| wifi.auth-failed | パスワードが違います | 密码错误 | Wrong password |
| wifi.timeout | タイムアウトしました | 连接超时 | Timed out |
| wifi.not-found | ネットワークがありません | 网络不可用 | Network unavailable |
| wifi.disconnect | 切断 | 断开 | Disconnect |
| wifi.forget | 保存を削除 | 忘记网络 | Forget |
| wifi.saved | 保存済み | 已保存 | Saved |

---

## 7. 验收用例（真机，RG34XX + PJOS Linux）

| # | 步骤 | 期望 |
|---|---|---|
| 1 | 进 Wi-Fi 页 | 6 秒内出列表，至少 1 个网络 |
| 2 | 选一个开放网络 | 直接 `connected:<ssid>`，顶部状态图标变绿 |
| 3 | 选 WPA2 网络，输错密码 | `auth-failed`，提示错误，输入框仍在 |
| 4 | 输对密码 | `connected:<ssid>`，能 `ping` 通外网 |
| 5 | 退出页面再进 | 状态保持已连接，SSID 高亮 |
| 6 | 重启设备 | 自动重连（rcS 起 supplicant），进页面显示已连接 |
| 7 | 断开 / 忘记 | 图标变灰；`WIFI\tsaved` 不再包含该 SSID |
| 8 | 关掉 Wi-Fi（若 UI 提供） | `WIFI\tstatus` 为 `INACTIVE` |

日志位置（排障用）：`/tmp/pocketjs-frontend.log`（桥的 stderr）、
`/storage/.config/wpa_supplicant.conf`（已保存网络）。

---

## 8. 系统侧本轮要补的（我这边做）

1. `WIFI\tdisconnect` / `WIFI\tforget\t<ssid>` / `WIFI\tsaved` / `WIFI\tip` 四个命令
2. PSK 不再作为 `wpa_cli` argv（改成 stdin/控制接口），避免 `ps` 泄露
3. 连接结果细化：区分 `need-psk` / `auth-failed` / `not-found` / `timeout`
4. `rcS` 开机启动 supplicant（已加）
5. `/etc/baseos-release` 增加 `PJOS_SDK_VERSION`、`POCKETJS_ABI`，SYSTEM 页显示具体版本（已加）

接口形态**不会**再变；如果实现中发现字段不够用，先在这份文档里加一节再改代码。

---

## 9. 附：安装好的程序怎么启动（同一个桥）

卡片上已经有 10 个移植好的 PocketJS 程序，位置固定：

```
/storage/apps/<app>.pocket      # app = files, galaxy, gamehub, music, reader,
                                #       settings, terminal, video, web, youtube-video
```

启动一条命令即可：

```
LAUNCH	<app>
```

返回 `launching:<app>`；如果包不存在返回 `error:missing:<app>`。机制是：桥把 `<app>` 写进
`System/pocketjs/active`，然后让出画面；`launch_frontend.sh`（supervisor）重启时读到这个标记，
直接运行该包，退出后清标记并回到启动器。**启动器不需要自己 fork 任何东西。**

所以 APPS 列表建议这么做：

1. 静态表里为每个 app 写 `id`、标题、分类、`kind: "pocket"`；
2. 只有在 `/storage/apps/<id>.pocket` 存在时才显示（避免空壳卡片）——桥可以加
   `APPS\tlist` 返回已安装列表，需要的话告诉我，我加；
3. A 键 → `LAUNCH\t<id>`；返回 `error:missing` 时就地提示"未安装"。

---

## 10. 启动器侧实现情况（本仓库，2026-10-31）

Wi-Fi 页面已按 §2/§3 实现完毕，纯协议解析在 `app/wifi-model.ts`（有
`app/verify-wifi-model.mjs` 做逐条断言），页面是 `app/pages/wifi-page.tsx`，
状态机在 `app/main.tsx` 的「Wi-Fi picker」段。

### 10.1 已按契约实现

| 契约条款 | 实现 |
|---|---|
| `WIFI\tscan` / `connected:` / `need-psk` / `auth-failed` / `not-found` / `timeout` / `error:` | 逐项分支，`error:` 只显示 detail，不吞也不编造分类 |
| `WIFI\tdisconnect` / `forget` / `saved` / `ip` | 断开、忘记已实现；`saved` 用于行内「已保存」标记；`ip` 暂未使用（状态栏仍读 `LEVEL ip`） |
| §3.1 进页面即扫描、可重复扫描 | 进入即扫；`□` 再扫，页脚也有 Rescan |
| §3.2 已连接置顶、按信号降序、同名去重 | 在 `parseScan` 里做，重复 SSID 取最强样本 |
| §3.3 显示 SSID、密码掩码 | 输入框只画 `•`，真实文本只在内存 |
| §3.4 connecting 期间禁止重复确认、用帧计数 | 用 `onFrame` 驱动扫描/连接动画，无 `setTimeout` |
| §3.5 失败后留在密码框、不踢回顶层 | `auth-failed` / `timeout` / `error` 都停在 `psk` 且保留已输入文本 |
| §4 密码 8–63、SSID ≤32 字节 | 本地校验后才发桥；超长 SSID 在扫描结果里丢弃 |
| §6 i18n 三语 | `wifi.*` 键已补齐，含 `auth-failed`/`timeout`/`not-found`/`forget` 等 |

### 10.2 与契约不一致、按实现调整的地方

1. **密码输入改用「掩码字段 + 系统键盘」而不是 `TextField`。** `TextField` 会把它编辑的
   值原样画在面板上，密码会明文可见；现在输入框只画 `•`，`createOsk` 在
   `main.tsx` 里持有真实文本，键盘渲染在页面根节点（不是带内边距的内容列，否则会被裁切）。
   键盘的 `×`/B 关闭即取消，START 提交，`□` 退格。
2. **`□` 同时被绑定为「重新扫描」，`△` 才是页脚的「断开/忘记」。** §3.1 建议 `□` 扫描，
   但页脚的触控按钮在没有触摸屏的机型上按不到，所以给了 `△` 一条手柄路径。如果系统侧
   后续加了触摸，这两条可以保留，互不冲突。
3. **连接动作延后一帧执行。** `__launcher` 是同步调用，`WIFI connect` 最长 10 秒、
   `WIFI scan` 最长 6 秒，都会占住渲染线程。现在两者都在 `onFrame` 里、等「扫描中/连接中」
   那一帧画完再发，否则用户看到的是冻结的画面。**这不改变契约，但契约 §3.4 要求的
   「connecting 期间显示转圈」在系统侧改成异步之前，最多只能保证「先画出这一帧再卡住」。**

### 10.3 系统侧仍需修的问题（实测，非推测）

以下都在 `origin/main` 的 `src/apply-pocketjs-bridge.py` 和已经刷进设备的运行时上验证过，
启动器这边无法绕过：

1. **`udhcpc` 被 2 秒超时杀掉，连接永远拿不到 IP。** 桥里所有外部命令都走
   `run()`，它固定 `timeout 2`（`work/bridge-scripts/pocketshell-launcher.rs:7-19`）。
   设备上实测：`udhcpc -i wlan0 -b -q -n -t 5 -T 3` 需要 **15.6 s** 才失败，2 s 时收到
   SIGTERM。于是 `wifi_connect_app()` 在 `wpa_state=COMPLETED` 后调用的那条 `udhcpc`
   一定被掐断，返回的仍是 `connected:<ssid>`——**界面显示已连接，实际没有 IP**。
   契约 §2.2 说「已连上并拿到 IP」，这一条目前不成立。
   建议：给 `udhcpc` 单独的超时（≥20 s），或改成后台起 `udhcpc -b` 并在 `WIFI status`
   里回报 `ip=`。
2. **连接后拿不到 IP 的同一件事还有后半段。** DHCP 即使成功，`WIFI status` 的 `ip=` 也来自
   `wpa_cli status` 的 `ip_address=`，而 supplicant 不负责 DHCP，这个字段不会自己更新；
   `LEVEL ip` 则依赖 `ip -o -4 addr`。建议连接结果在 DHCP 落定后从 `ip` 命令回填，
   或者直接让启动器读 `LEVEL ip`（现在它已经这么做了，只是地址还不存在）。
3. **`auth-failed` 的判定时机太晚。** 桥把「该网络在 `list_networks` 里处于 DISABLED 状态」
   当作密码错误的判据；实测错误 PSK 时 supplicant 的状态序列是
   `SCANNING → 4WAY_HANDSHAKE →（约 26 s）SCANNING + TEMP-DISABLED`。桥的等待窗口只有
   10 s，**在 `TEMP-DISABLED` 出现之前就已经返回 `timeout`**，所以 `auth-failed` 实际上
   不会出现。两条路都行：把窗口拉到 ≥30 s（用户要多等），或改用
   `wpa_cli status` 的 `key_mgmt`/失败计数，或直接按「已 `COMPLETED` 则成功，超时则让用户
   重试」。注意判据要匹配子串 `DISABLED`，`TEMP-DISABLED` 也包含它。
4. **一次失败的连接最坏要 16 s。** `wifi_connect_app()` 先调 `wifi_scan()`（最多 6 s）判断
   是否需要密码，再等最多 10 s，所以单次「密码错误」的最坏耗时是 16 s，而这段时间整个面板
   是冻结的。启动器已经本地拦掉 8–63 之外的密码，但**「已保存网络重连」仍走这条慢路径**；
   建议系统侧先查 `list_networks`，命中就直接 `select_network`，跳过扫描。
5. **`STATE wifi` 返回 `on:<ssid>`，不是 `on`。** 启动器已兼容（按 `:` 前缀切分，见
   `app/setting-bridge.ts` 的 wifi 行），但契约 §1 写的是「状态查询 STATE/SSID/IP 已有」，
   没有写明这个格式，其他前端会误判成 `unknown`。建议在 §2.3 里补一行。
6. **`rcS` 里的 supplicant 自启只在 `origin/main`，卡上跑的系统还没有。** 设备
   `/etc/init.d/rcS` 里 `wpa_supplicant` 出现 0 次，`wifi-slow-radio` 之外没有任何自启；
   重启后 `WIFI scan` 只能靠桥里按需 `wifi_ensure()` 拉起。契约 §7 用例 6「重启设备自动
   重连」要等新镜像才能验收。另外 `rcS` 只起 supplicant，**没有开机 `udhcpc`**，
   所以即使有新镜像，重启后也是「已关联、无 IP」，直到用户再次进 Wi-Fi 页。
7. **`WIFI\tsaved` 在新运行时之前的实现返回空串而不是 `unknown`。** 启动器已按
   「空 = 支持但没保存」处理（`parseSaved`）。如果系统侧想让「不支持」可区分，
   请继续用 `Unknown launcher action`。

### 10.4 契约 §5/§6 里需要更正的表述

- **§5「不要用 `border-*`（PocketJS 不编译该工具类）」不成立。** SDK 的
  `framework/compiler/tailwind.ts` 明确编译 `border`（`:314`）和 `border-[#...]`（`:448`），
  设备上的包里也有 `borderWidth`，现有设置页就在用。这句会让 UI 白白放弃一个可用特性，
  建议删掉。
- §5 的「一屏 8 行、行高 14」与现有版式不符：198 高的页面里是 5 行 × 19px（加上标题和页脚）。
  若系统侧希望改成 8 行，需要同步调整整个设置区的高度预算，属于另一轮改动。

### 10.5 端口/路径提醒

`build-pocketjs-runtime-musl.sh` 默认的 `BRIDGE_SCRIPTS` 指向
`~/development/rocknix/projects/ROCKNIX/packages/apps/pocketjs-runtime/scripts`，那里是
91 行的旧版；`src/apply-pocketjs-bridge.py` 在新版上第一个锚点就报
`anchor for settings directory creation appears 0 times` 并 exit 1。重编 runtime 前要把它
指到带 `run()` 的那份（285 行，`build.ROCKNIX-H700.aarch64/build/pocketjs-runtime-*/scripts/`），
否则构建直接失败。
