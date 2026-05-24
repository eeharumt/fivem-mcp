# mcp-fivem MCP Server

FiveM RCON Model Context Protocolサーバー

このTypeScriptベースのMCPサーバーは、FiveMプラグイン開発のデバッグとサーバー管理機能を提供します：

- RCON経由でのFiveMサーバー通信  
- プラグインの管理（ensure、stop、restart）
- サーバーログの監視とプラグインログの取得
- **FiveMクライアントログの取得**
- **スクリプト経由でのF8コンソールコマンド実行（ExecuteCommand）**
- **イベントシステムによるサーバー・クライアント間通信**
- **FiveMプラグイン（mcp-bridge）との連携**
- リソースの更新とサーバーステータスの確認
- 任意のRCONコマンドの実行

## MCP Tools (v0.4.0)

MCP server version: `0.4.0`  
mcp-bridge plugin version: `2.2.0`

公開ツールは **13 個** です（`fivem_*` プレフィックス）。

| Tool | Purpose |
|---|---|
| `fivem_plugin_manage` | ensure / stop / restart / refresh |
| `fivem_command_execute` | server/client command execution (`wait_for_result` for client) |
| `fivem_rcon_execute` | direct RCON commands |
| `fivem_event_trigger` | server/client events (`wait_for_ack` optional) |
| `fivem_player_get` | player list / info |
| `fivem_player_control` | dev QA: teleport, state, input, screenshot, health/armor/weapon/vehicle |
| `fivem_logs_get` | server/client/plugin logs |
| `fivem_system_manage` | plugin health / clear MCP internal logs |
| `fivem_server_info` | status / config / resources / performance |
| `fivem_resource_analyze` | lightweight resource analysis |
| `fivem_batch_execute` | sequential or parallel command batches |
| `fivem_logs_watch` | polling-based log watch |
| `fivem_command_validate` | pre-flight command validation |

検証手順: [docs/verification.md](docs/verification.md)

## Development Server Prerequisites

`dev-local.cfg` example:

```cfg
setr mcp_bridge_enabled 1
setr mcp_bridge_allow_player_control 1
setr mcp_bridge_dev_only 1
setr mcp_bridge_include_tokens 0
ensure mcp-bridge
ensure screencapture
```

Optional security convars:

- `mcp_bridge_command_allowlist`
- `mcp_bridge_command_denylist`
- `mcp_bridge_event_allowlist`
- `mcp_bridge_event_denylist`

## 🚀 Core Tools

#### 1. `fivem_plugin_manage` - プラグイン管理
プラグインの開始、停止、再起動、リソース更新を統合管理

**パラメータ:**
- `action` (必須): "ensure" | "stop" | "restart" | "refresh"
- `plugin_name` (ensure/stop/restart時必須): プラグイン名

**使用例:**
```bash
# プラグインの開始
fivem_plugin_manage --action ensure --plugin_name my-plugin

# プラグインの停止
fivem_plugin_manage --action stop --plugin_name my-plugin

# プラグインの再起動
fivem_plugin_manage --action restart --plugin_name my-plugin

# リソースの更新（fxmanifest変更後など）
fivem_plugin_manage --action refresh
```

#### 2. `fivem_command_execute` - コマンド実行
サーバーサイドとクライアントサイドでのコマンド実行を統合

**パラメータ:**
- `mode` (必須): "server" | "client"
- `command` (必須): 実行するコマンド
- `player_id` (オプション): クライアントモード時のターゲットプレイヤーID
- `wait_for_result` (オプション): クライアント実行結果を poll で待つ（デフォルト: `true`）

**使用例:**
```bash
# サーバー側でコマンド実行
fivem_command_execute --mode server --command "say Hello from Server!"

# 特定プレイヤーのクライアントでコマンド実行
fivem_command_execute --mode client --command "me waves hand" --player_id 1

# 全クライアントでコマンド実行
fivem_command_execute --mode client --command "engine"
```

#### 3. `fivem_rcon_execute` - 直接RCONコマンド実行
低レベルなサーバー管理のための直接RCONコマンド実行

**パラメータ:**
- `command` (必須): 実行するRCONコマンド

**使用例:**
```bash
# 直接RCONコマンド実行（サーバー管理用）
fivem_rcon_execute --command "status"

# リソース管理
fivem_rcon_execute --command "restart my-plugin"
```

#### 4. `fivem_event_trigger` - イベントトリガー
サーバー・クライアント間のイベントトリガーを統合

**パラメータ:**
- `type` (必須): "server" | "client"
- `event_name` (必須): イベント名
- `player_id` (client時必須): プレイヤーID
- `args` (オプション): JSONエンコードされた引数（配列またはオブジェクト）
- `wait_for_ack` (オプション): クライアントイベントの受信確認を poll で待つ

**使用例:**
```bash
# サーバーイベントのトリガー
fivem_event_trigger --type server --event_name playerJoined --args '["player123", "NewPlayer"]'

# クライアントイベントのトリガー
fivem_event_trigger --type client --event_name showNotification --player_id 1 --args '["Hello Client!"]'
```

#### 5. `fivem_player_get` - プレイヤー情報取得
プレイヤー一覧取得と詳細情報取得を統合

**パラメータ:**
- `action` (必須): "list" | "info"
- `player_id` (info時必須): プレイヤーID

**使用例:**
```bash
# プレイヤー一覧取得
fivem_player_get --action list

# 特定プレイヤーの詳細情報取得
fivem_player_get --action info --player_id 1
```

#### 6. `fivem_player_control` - プレイヤー操作（開発・QA向け）
テレポート、座標取得、キー入力パルス、スクリーンショットを統合

**前提:** 開発サーバーで `dev-local.cfg` により `mcp-bridge` / `screencapture` が起動していること

**パラメータ:**
- `action` (必須): `get_state` | `teleport` | `freeze` | `unfreeze` | `input_pulse` | `input_sequence` | `input_tap` | `screenshot` | `set_health` | `set_armor` | `give_weapon` | `set_heading` | `spawn_vehicle` | `enter_vehicle` | `repair_vehicle` | `look_at`
- `player_id` (必須): プレイヤーID
- `coords` (teleport時): `{ x, y, z, heading? }`
- `input` (input_pulse/input_tap時): `{ keys: ["W","E"], duration_ms?: number }`
- `sequence` (input_sequence時): `[{ keys, duration_ms, delay_ms? }]`
- `screenshot` (screenshot時): `{ quality?: 0.1-1.0 }`

**使用例:**
```bash
fivem_player_control --action get_state --player_id 1
fivem_player_control --action teleport --player_id 1 --coords '{"x":100,"y":200,"z":30,"heading":90}'
fivem_player_control --action input_pulse --player_id 1 --input '{"keys":["W"],"duration_ms":2000}'
fivem_player_control --action screenshot --player_id 1 --screenshot '{"quality":0.6}'
```

#### 7. `fivem_logs_get` - ログ取得
サーバー・クライアント・プラグインログ取得を統合

**パラメータ:**
- `source` (必須): "server" | "server_plugin" | "client" | "client_plugin"
- `lines` (オプション): 取得行数（デフォルト値はソースによって異なる）
- `plugin_name` (オプション): プラグイン名（*_plugin時のみ）

**使用例:**
```bash
# サーバーログ取得
fivem_logs_get --source server --lines 100

# 特定プラグインのサーバーログ取得
fivem_logs_get --source server_plugin --plugin_name my-plugin --lines 50

# クライアントログ取得
fivem_logs_get --source client --lines 100

# 特定プラグインのクライアントログ取得
fivem_logs_get --source client_plugin --plugin_name my-plugin --lines 50
```

#### 7. `fivem_system_manage` - システム管理
システムヘルスチェック、ログクリアを統合

**パラメータ:**
- `action` (必須): "health" | "clear"

**使用例:**
```bash
# プラグインのヘルスチェック
fivem_system_manage --action health

# ログのクリア
fivem_system_manage --action clear
```

## FiveMプラグイン連携

MCPサーバーは専用のFiveMプラグイン（`mcp-bridge`）と連携することで、RCONでは実現できない高度な機能を提供します：

### 🔗 連携アーキテクチャ
```
MCP Server ←→ RCON Protocol ←→ FiveM Server ←→ mcp-bridge Plugin
```

**新方式の特徴:**
- ✅ HTTPサーバー不要
- ✅ 既存のRCON接続を活用
- ✅ シンプルな実装
- ✅ リアルタイム通信
- ✅ 軽量で高速

### 🚀 プラグイン経由で利用可能な機能
- **サーバーサイドコマンド実行**: RCONカスタムコマンド経由でExecuteCommandを使用
- **クライアントサイドコマンド実行**: 特定プレイヤーまたは全プレイヤーでのコマンド実行
- **リアルタイムイベント**: TriggerEvent/TriggerClientEventの直接実行
- **プレイヤー管理**: オンラインプレイヤーの詳細情報取得
- **ヘルスチェック**: プラグインの状態監視

### 🆕 v0.3.0の新機能
- **クライアント・サーバー分離**: `fivem_command_execute`でサーバーとクライアント側を明確に分離
- **直接RCON実行**: `fivem_rcon_execute`で低レベルなサーバー管理コマンドを実行
- **エラー処理改善**: ResponseParserの最適化により、プラグインからのレスポンスを正確に解析
- **新RCONコマンド**: `mcp_client_command`、`mcp_client_command_all`をプラグインに追加

### 🔧 FiveMプラグインのインストール

1. `fivem-plugin/mcp-bridge` フォルダを FiveM サーバーの `resources` ディレクトリにコピー
2. `server.cfg` に以下を追加:
```
ensure mcp-bridge
```
3. FiveMサーバーを再起動

### 🎯 使用例

```bash
# サーバー側でメッセージ送信
fivem_command_execute --mode server --command "say Hello from MCP Bridge!"

# クライアント側でコマンド実行
fivem_command_execute --mode client --command "me waves" --player_id 1

# サーバーイベントのトリガー
fivem_event_trigger --type server --event_name playerJoined --args '["player123", "NewPlayer"]'

# プレイヤー情報の取得
fivem_player_get --action info --player_id 1

# プラグインの健康状態チェック
fivem_system_manage --action health

# 直接RCONコマンド実行
fivem_rcon_execute --command "status"
```

## 機能詳細

### リソース
- `fivem://logs/recent` - 最新のサーバー操作ログ
- `fivem://console/info` - サーバーコンソール情報（ログファイル経由）

### ツール

#### サーバー管理
- `fivem_plugin_manage` - プラグイン管理（ensure/stop/restart/refresh）
- `fivem_command_execute` - コマンド実行（Server/Client）
- `fivem_rcon_execute` - 直接RCONコマンド実行
- `fivem_event_trigger` - イベントトリガー（Server/Client）
- `fivem_player_get` - プレイヤー情報取得（List/Info）
- `fivem_logs_get` - ログ取得（Server/Client/Plugin）
- `fivem_system_manage` - システム管理（Health/Clear）

## 開発

依存関係のインストール:
```bash
npm install
```

サーバーのビルド:
```bash
npm run build
```

開発時の自動リビルド:
```bash
npm run watch
```

## インストール

### Cursor IDE
Cursor IDEで使用するには、設定を追加します：

1. Cursor IDE設定を開く（Cmd/Ctrl + ,）
2. "MCP"で検索
3. 以下の設定を追加：

```json
{
  "mcp.servers": {
    "mcp-fivem": {
      "command": "/path/to/mcp-fivem/build/index.js",
      "env": {
        "RCON_ADDRESS": "localhost",
        "RCON_PORT": "30120",
        "RCON_PASSWORD": "your_rcon_password",
        "FIVEM_LOGS_DIR": "/path/to/your/fivem/txData/default/logs"
      }
    }
  }
}
```

または、Cursor設定ファイル（`settings.json`）に直接追加することもできます。

## 環境変数設定

以下の環境変数を設定することで、自動接続やデフォルト値を利用できます：

- `RCON_ADDRESS`: FiveMサーバーのホスト（必須）  
- `RCON_PORT`: RCONポート（必須）
- `RCON_PASSWORD`: RCONパスワード（必須）
- `FIVEM_LOGS_DIR`: サーバーログファイルが格納されているディレクトリのパス（**サーバーログ機能使用時は必須**）
- `FIVEM_CLIENT_LOGS_DIR`: クライアントログファイルが格納されているディレクトリのパス（**クライアントログ機能使用時は必須**）
- `FIVEM_SCREENSHOTS_DIR`: mcp-bridge の screenshot 読み取り先（省略時は `FIVEM_MCP_BRIDGE_PATH/screenshots`）
- `FIVEM_MCP_SYNC_TARGET`: `npm run sync` のデプロイ先
- `FIVEM_MCP_BRIDGE_PATH`: mcp-bridge リソースのベースパス

すべての環境変数が設定されている場合、MCPサーバー起動時に自動的に接続を試行します。

**ログ機能について:**
- `fivem_logs_get --source server`および`fivem_logs_get --source server_plugin`ツールを使用するには、`FIVEM_LOGS_DIR`の設定が必須です。
- `fivem_logs_get --source client`および`fivem_logs_get --source client_plugin`ツールを使用するには、`FIVEM_CLIENT_LOGS_DIR`の設定が必須です。

### ログディレクトリパスの設定

#### サーバーログ（FIVEM_LOGS_DIR）
`FIVEM_LOGS_DIR`には、サーバーログファイル（`fxserver.log`、`server.log`等）が**直接格納されているディレクトリ**を指定してください。

**設定例:**
```bash
export FIVEM_LOGS_DIR="/path/to/server/txData/default/logs"
```

#### クライアントログ（FIVEM_CLIENT_LOGS_DIR）
`FIVEM_CLIENT_LOGS_DIR`には、FiveMクライアントログファイル（`CitizenFX.log`等）が**直接格納されているディレクトリ**を指定してください。

**設定例:**
```bash
# Windows
export FIVEM_CLIENT_LOGS_DIR="C:\Users\username\AppData\Local\FiveM\FiveM.app\logs"

# Linux/WSL2
export FIVEM_CLIENT_LOGS_DIR="/home/username/.local/share/CitizenFX"
```

**完全な環境変数設定例:**
```bash
export RCON_ADDRESS="localhost"
export RCON_PORT="30120"
export RCON_PASSWORD="your_rcon_password"
export FIVEM_LOGS_DIR="/path/to/server/txData/default/logs"
export FIVEM_CLIENT_LOGS_DIR="/home/username/.local/share/CitizenFX"
```

**ディレクトリ構造例:**
```
# サーバーログ
/path/to/server/txData/default/logs/    ← FIVEM_LOGS_DIRで直接指定
├── fxserver.log                        ← メインログファイル
├── server.log                          ← サーバーログファイル
└── fxserver_20240101.log               ← 日付付きバックアップ

# クライアントログ
/home/username/.local/share/CitizenFX/  ← FIVEM_CLIENT_LOGS_DIRで直接指定
├── CitizenFX.log                       ← メインクライアントログ
├── CitizenFX_log.txt                   ← 追加ログファイル
└── launcher.log                        ← ランチャーログ
```

## 🚀 移行について

### 旧ツールからの移行

既存のツールは後方互換性のため保持されていますが、新しい統合ツールの使用を推奨します：

| 旧ツール | 新ツール | 変更点 |
|--------|--------|--------|
| `ensure_plugin` | `fivem_plugin_manage` | `action: "ensure"` |
| `stop_plugin` | `fivem_plugin_manage` | `action: "stop"` |
| `restart_plugin` | `fivem_plugin_manage` | `action: "restart"` |
| `execute_command` | `fivem_rcon_execute` | 直接RCONコマンド実行 |
| `execute_plugin_command` | `fivem_command_execute` | `mode: "server"` |
| `trigger_server_event_plugin` | `fivem_event_trigger` | `type: "server"` |
| `trigger_client_event_plugin` | `fivem_event_trigger` | `type: "client"` |
| `get_players_plugin` | `fivem_player_get` | `action: "list"` |
| `get_player_info_plugin` | `fivem_player_get` | `action: "info"` |
| `get_fivem_server_logs` | `fivem_logs_get` | `source: "server"` |
| `get_fivem_server_plugin_logs` | `fivem_logs_get` | `source: "server_plugin"` |
| `get_fivem_client_logs` | `fivem_logs_get` | `source: "client"` |
| `get_fivem_client_plugin_logs` | `fivem_logs_get` | `source: "client_plugin"` |

| `check_plugin_health` | `fivem_system_manage` | `action: "health"` |
| `refresh_resources` | `fivem_plugin_manage` | `action: "refresh"` |
| `clear_logs` | `fivem_system_manage` | `action: "clear"` |

```bash
npm run inspector
```

InspectorはブラウザでデバッグツールにアクセスするためのURLを提供します。

## 📝 変更履歴

### v0.4.0
- Client command execution now supports async result polling (`wait_for_result`)
- Client event delivery ack (`wait_for_ack`) via `mcp_event_client_ack` / `mcp_async_poll`
- Extended player control actions (health/armor/weapon/vehicle/look_at)
- Security gates, audit logging, optional token redaction
- Documentation/version alignment and verification guide

### v0.3.0 (2025-07-06)
- **🆕 新機能**: サーバー・クライアント間でのコマンド実行機能追加
- **🆕 新ツール**: `fivem_rcon_execute` - 直接RCONコマンド実行
- **🔧 改善**: `fivem_command_execute`を`mode: "server"/"client"`に変更
- **🔧 改善**: ResponseParserの最適化でエラー処理を改善
- **🔧 改善**: FiveMプラグインに`mcp_client_command`、`mcp_client_command_all`コマンド追加
- **📖 更新**: ドキュメントとREADMEの全面的な更新

### v0.2.0
- **🆕 新機能**: 17個のツールを6個に統合
- **🆕 新機能**: 統一された命名規則（fivem_* プレフィックス）
- **🔧 改善**: 機能的グループ化で直感的な操作
- **🔧 改善**: 冗長性の排除で保守性向上

### v0.1.0
- **🎉 初回リリース**: 基本的なFiveM RCON機能
- **🆕 新機能**: プラグイン管理、ログ取得、イベントシステム