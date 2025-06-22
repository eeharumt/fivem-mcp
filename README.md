# mcp-fivem MCP Server

FiveM RCON Model Context Protocolサーバー

このTypeScriptベースのMCPサーバーは、FiveMプラグイン開発のデバッグとサーバー管理機能を提供します：

- RCON経由でのFiveMサーバー通信  
- プラグインの管理（ensure、stop、restart）
- サーバーログの監視とプラグインログの取得
- リソースの更新とサーバーステータスの確認
- 任意のRCONコマンドの実行

## 機能詳細

### リソース
- `fivem://logs/recent` - 最新のサーバー操作ログ
- `fivem://console/info` - サーバーコンソール情報（ログファイル経由）

### ツール
- `connect_server` - RCON経由でFiveMサーバーに接続
  - パラメータ: host (オプション、デフォルト: localhost), port (オプション、デフォルト: 30120), password (必須), logs_dir (オプション)
- `ensure_plugin` - FiveMプラグインを開始/確保
  - パラメータ: plugin_name (必須)
- `stop_plugin` - FiveMプラグインを停止
  - パラメータ: plugin_name (必須)
- `restart_plugin` - FiveMプラグインを再起動
  - パラメータ: plugin_name (必須)
- `execute_command` - 任意のRCONコマンドを実行
  - パラメータ: command (必須)
- `refresh_resources` - FiveMサーバーのリソースリストを更新
- `get_server_logs` - FiveMサーバーのコンソールログを取得
  - パラメータ: lines (オプション、デフォルト: 100)
- `get_plugin_logs` - FiveMプラグイン/スクリプトログを取得
  - パラメータ: lines (オプション、デフォルト: 50), plugin_name (オプション)
- `clear_logs` - ローカル操作ログをクリア

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
- `FIVEM_LOGS_DIR`: ログファイルが格納されているディレクトリのパス（**ログ機能使用時は必須**）

すべての環境変数が設定されている場合、MCPサーバー起動時に自動的に接続を試行します。

**ログ機能について:**
`get_server_logs`および`get_plugin_logs`ツールを使用するには、`FIVEM_LOGS_DIR`の設定が必須です。

### ログディレクトリパスの設定

`FIVEM_LOGS_DIR`には、ログファイル（`fxserver.log`、`server.log`等）が**直接格納されているディレクトリ**を指定してください。

**設定例:**
```bash
export RCON_ADDRESS="localhost"
export RCON_PORT="30120"
export RCON_PASSWORD="your_rcon_password"
export FIVEM_LOGS_DIR="/path/to/server/txData/default/logs"
```

**ディレクトリ構造例:**
```
/path/to/server/txData/default/logs/    ← FIVEM_LOGS_DIRで直接指定
├── fxserver.log                        ← メインログファイル
├── server.log                          ← サーバーログファイル
└── fxserver_20240101.log               ← 日付付きバックアップ
```

```bash
npm run inspector
```

InspectorはブラウザでデバッグツールにアクセスするためのURLを提供します。
