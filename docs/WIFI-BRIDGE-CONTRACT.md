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
| 断开 / 忘记网络 | 系统桥 `WIFI\tdisconnect` / `WIFI\tforget` | **本轮新增** |
| PSK 不经过命令行参数 | 系统桥 | **本轮改造**（现在 `wpa_cli` argv 里有明文） |
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
