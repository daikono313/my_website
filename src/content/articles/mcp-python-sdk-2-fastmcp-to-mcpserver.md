---
title: MCP Python SDK 2.x で FastMCP が無い？ MCPServer で自作して分かった 3 つの変更点
date: 2026-11-25
description: MCP Python SDK 2.x（mcp 2.3.0）では FastMCP が MCPServer に改名され、属性名は snake_case になり、ToolError 以外の例外は理由がモデルに届かない。CSV 確認サーバーを自作し、生の JSON-RPC と Claude Code で動作を確かめた結果とコード全文を載せる。
tags: [MCP, Python, 生成AI]
summary:
  - pip install mcp で入るのは 2.3.0 で、v1 の from mcp.server.fastmcp import FastMCP は ModuleNotFoundError になる。新しい書き方は from mcp.server import MCPServer
  - 結果の属性名は is_error や input_schema のような snake_case に変わった。通信上の JSON は camelCase のまま変わらない
  - ツールの中で ValueError などを投げても、v2 ではメッセージがモデルに届かない。モデルに読ませたい失敗は ToolError で投げる
  - 接続の始め方も変わった。2026-07-28 版の MCP は initialize を使わず、SDK の Client も Claude Code 2.1.332 も server/discover から始める
faq:
  - q: ModuleNotFoundError No module named 'mcp.server.fastmcp' と出たら、どう直せばよいですか？
    a: mcp 2.x では FastMCP が MCPServer に改名されています。from mcp.server import MCPServer に書き換え、FastMCP("名前") を MCPServer("名前") にします。v1 のコードをそのまま動かしたいときは、mcp<2 にバージョンを固定します。
  - q: initialize の応答の protocolVersion が 2025-11-25 になるのは、なぜですか？
    a: initialize は 2025-11-25 以前の接続方法だからです。mcp 2.3.0 のサーバーに initialize で 2026-07-28 を要求しても、2025-11-25 が返りました。2026-07-28 版では initialize を送らず、各リクエストの _meta にバージョンを入れます。
  - q: ツールが失敗した理由が Claude に伝わりません。何を確認すればよいですか？
    a: ツールの中で投げている例外の種類を確認します。mcp 2.x では、ToolError 以外の例外は「Error executing tool ツール名」という文だけになり、メッセージは届きません。モデルに読ませたい失敗は mcp.server.mcpserver.exceptions の ToolError で投げます。
  - q: mcp 1.x を使い続けることはできますか？
    a: できます。依存関係を mcp<2（たとえば mcp>=1.28,<2）に固定します。公式ドキュメントによると、v1.x は保守の扱いになり、重大なバグ修正とセキュリティ修正は続きます。
---

公式の MCP Python SDK は 2.x で、高レベルのサーバークラスが `FastMCP` から `MCPServer` に改名されました。`pip install mcp` で入るのは 2.3.0 なので、v1 向けの入門記事のコードは最初の import で止まります。この記事では、CSV の中身を確認する MCP サーバーを mcp 2.3.0 で自作し、v1 から変わって引っかかる点を 3 つに絞って、対処とコードの全文を載せます。Python 3.12・mcp 2.3.0・Claude Code 2.1.332 で動作を確認しました（2026 年 11 月 25 日時点）。

## はじめに：CSV を AI に渡す前に、列と行数だけ確認したい

CSV を AI に読ませる前に、知りたいことは多くありません。列名、行数、文字コード、そして先頭の数行です。ファイルを丸ごと渡さなくても、この 4 つが分かれば、次に何を頼むかを決められます。

そこで、次の 2 つのツールだけを持つ MCP サーバー「csv-peek」を作りました。

| ツール | 返すもの |
|---|---|
| `csv_info` | 列名・データ行数・文字コード・ファイルサイズ |
| `csv_head` | 先頭の n 行（1〜50 行。既定は 5 行） |

csv-peek は、環境変数 `CSV_ROOT` で指定したディレクトリの中の `.csv` ファイルだけを読みます。

作る途中で引っかかった点は 3 つで、どれも SDK 2.x の変更によるものでした。

| | 変更点 | 最初に出る症状 |
|---|---|---|
| ハマり① | `FastMCP` が `MCPServer` に改名された | `ModuleNotFoundError: No module named 'mcp.server.fastmcp'` |
| ハマり② | 属性名が snake_case になった | `AttributeError: 'CallToolResult' object has no attribute 'isError'` |
| ハマり③ | `ToolError` 以外の例外は、メッセージがモデルに届かない | エラーは出ない。モデルに `Error executing tool <ツール名>` とだけ伝わる |

## MCP のおさらい：ホスト・クライアント・サーバーとツール

MCP（Model Context Protocol）とは、AI アプリケーションと外部のツールやデータを、共通の手順でつなぐためのプロトコルのことです。登場するのは次の 3 つです。

- **ホスト**: Claude Code や Claude Desktop のような、ユーザーが使う AI アプリケーション
- **クライアント**: ホストの中で動き、MCP の手順でサーバーと通信する部分
- **サーバー**: ツールなどを提供するプログラム。この記事で作るもの

ツールとは、モデルが呼び出せる関数のことです。ローカルのサーバーは stdio で動きます。stdio とは、ホストがサーバーを子プロセスとして起動し、標準入力と標準出力に JSON-RPC のメッセージを 1 行ずつ流す通信方法のことです。

## 環境構築：pip install mcp で入るのは 2.3.0

2026 年 11 月 25 日時点で、`pip install mcp` で入るのは 2.3.0 です（2026 年 10 月 2 日公開）。2.0.0 は 2026 年 7 月 28 日に公開されています。

```bash
python3.12 -m venv .venv
source .venv/bin/activate
pip install mcp pytest
python -c "from importlib.metadata import version; print(version('mcp'))"  # 2.3.0
```

テスト用の CSV も用意しておきます。

```bash
mkdir data
printf 'id,name,price\n1,りんご,120\n2,みかん,80\n3,ぶどう,450\n' > data/sales.csv
```

v1 のコードをそのまま動かしたいときは、`pip install 'mcp<2'` でバージョンを固定します。[SDK の公式ドキュメント（What's new in v2）](https://py.sdk.modelcontextprotocol.io/v2/whats-new/)によると、v1.x は保守の扱いになり、重大なバグ修正とセキュリティ修正は続きます。

### 公式ドキュメントは 2.3.0 より先に進んでいる

[SDK の公式ドキュメント](https://py.sdk.modelcontextprotocol.io/v2/)には、2.3.0 の実際の動作と合わない記述が 3 つありました。ドキュメントは開発中のブランチに合わせて書かれているようです。記事やドキュメントのとおりに動かないときは、手元のバージョンで確かめるのが確実です。

| 項目 | 公式ドキュメントの記述 | mcp 2.3.0 での実測 |
|---|---|---|
| 対応する Python | 3.11 以上 | パッケージの指定は 3.10 以上（リポジトリの main ブランチは 3.11 以上） |
| 戻り値の型が型引数なしの `dict` のツール | 構造化された結果（`structuredContent`）が付く | 付かない。`dict[str, int]` のように型引数を書くか、Pydantic のモデルを返す |
| ツールの入力スキーマの `title` キー | 出力されない | `"title": "Path"` のように出力される |

## ハマり①：FastMCP が無い（MCPServer への改名）

v1 の書き方で import すると、mcp 2.3.0 では次のエラーになります。

```text
ModuleNotFoundError: No module named 'mcp.server.fastmcp'. This is mcp 2.x, where FastMCP was renamed to MCPServer (from mcp.server.mcpserver import MCPServer) and other APIs changed; see the migration guide at https://py.sdk.modelcontextprotocol.io/v2/migration/#fastmcp-renamed-to-mcpserver or pin 'mcp<2' to keep running v1 code.
```

2.3.0 のエラー文には、改名されたことと、移行ガイドの URL と、`mcp<2` に固定する方法まで書かれています。直し方は次のとおりです。

```python
# v1
from mcp.server.fastmcp import FastMCP
mcp = FastMCP("csv-peek")

# v2
from mcp.server import MCPServer
mcp = MCPServer("csv-peek")
```

`@mcp.tool()` などのデコレーターは、v1 と同じ書き方で動きます。改名にともなって変わった import を表にまとめます。

| v1 | v2 |
|---|---|
| `from mcp.server.fastmcp import FastMCP` | `from mcp.server import MCPServer`（`mcp.server.mcpserver` からでも同じクラス） |
| `from mcp.server.fastmcp.exceptions import ToolError` | `from mcp.server.mcpserver.exceptions import ToolError` |
| `from mcp import McpError` | `from mcp import MCPError` |

`from mcp import MCPServer` とは書けません（`ImportError` になります）。

なお、PyPI には `fastmcp` という独立したパッケージもあります（2026 年 11 月 25 日時点で 4.2.6）。無くなったのは公式 SDK に同梱されていた `mcp.server.fastmcp` で、独立パッケージの `fastmcp` とは別のものです。独立パッケージのほうは、この記事では試していません。

### コンストラクタの 2 番目の引数は、エラーにならずに意味が変わる

import エラーと違い、気づきにくい変更が 1 つあります。コンストラクタの位置引数の順序です。v1 の 2 番目の引数は `instructions`（モデルに渡すサーバーの使い方）でしたが、v2 では `title` です。

```python
mcp = MCPServer("Demo", "CSV を読む前に csv_info を呼ぶ")
print(mcp.title)         # CSV を読む前に csv_info を呼ぶ
print(mcp.instructions)  # None
```

エラーは出ず、`instructions` が送られなくなるだけです。名前以外はキーワード引数で渡すと、この問題を避けられます。

`version` を省略したときの値も変わりました。v1（1.30.0）のサーバーは `serverInfo` の `version` に SDK のバージョン（`1.30.0`）を入れていましたが、v2 は空文字列を入れます。自分のサーバーのバージョンを `version=` で渡しておきます。

## サーバー実装：csv_info と csv_head を持つ csv-peek

`server.py` の全文です。

```python
"""CSV を AI に渡す前に中身を確認する MCP サーバー（mcp 2.3.0 / stdio）。"""

import csv
import os
from collections.abc import Callable, Iterator
from itertools import islice
from pathlib import Path
from typing import Annotated, TypeVar

from pydantic import BaseModel, Field

from mcp.server import MCPServer
from mcp.server.mcpserver.exceptions import ToolError

# 読んでよいディレクトリ。ホストは自分の作業ディレクトリからサーバーを起動するので、
# 相対パスに頼らず環境変数で渡す。未設定なら起動時に KeyError で止まる。
ROOT = Path(os.environ["CSV_ROOT"]).resolve()

mcp = MCPServer(
    "csv-peek",
    version="0.1.0",
    instructions="CSV を読み込む前に csv_info で列と行数を確認し、必要なら csv_head で先頭の数行を見る。",
)

T = TypeVar("T")


class CsvInfo(BaseModel):
    path: str
    size_bytes: int
    encoding: str
    rows: int = Field(description="ヘッダー行を除いたデータ行の数")
    columns: list[str]


class CsvHead(BaseModel):
    columns: list[str]
    rows: list[list[str]]


def resolve_csv(path: str) -> Path:
    """ROOT の外・CSV 以外・存在しないファイルを拒否する。"""
    target = (ROOT / path).resolve()  # .. とシンボリックリンクを解決してから比べる
    if not target.is_relative_to(ROOT):
        raise ToolError("許可されたディレクトリの外は読めません。")
    if target.suffix.lower() != ".csv":
        raise ToolError("拡張子が .csv のファイルだけを読めます。")
    if not target.is_file():
        raise ToolError(f"ファイルが見つかりません: {path}")
    return target


def read_csv(target: Path, read: Callable[[Iterator[list[str]]], T]) -> tuple[str, T]:
    """UTF-8（BOM 付きも可）で読めなければ Shift_JIS（cp932）として読む。

    行は 1 行ずつ read に渡す。ファイル全体をメモリに載せない。
    """
    for encoding in ("utf-8-sig", "cp932"):
        try:
            with target.open(encoding=encoding, newline="") as f:
                return encoding, read(csv.reader(f))
        except UnicodeDecodeError:
            continue
    raise ToolError("文字コードを判定できません（UTF-8 と Shift_JIS 以外）。")


def header_and_count(rows: Iterator[list[str]]) -> tuple[list[str], int]:
    """ヘッダー行と、残りの行数を返す。行は数えるだけで保持しない。"""
    header = next(rows, None)
    if header is None:
        raise ToolError("空のファイルです。")
    return header, sum(1 for _ in rows)


@mcp.tool()
def csv_info(path: Annotated[str, Field(description="CSV_ROOT からの相対パス")]) -> CsvInfo:
    """CSV の列名・行数・文字コード・サイズを返す。"""
    target = resolve_csv(path)
    encoding, (columns, rows) = read_csv(target, header_and_count)
    return CsvInfo(
        path=str(target.relative_to(ROOT)),
        size_bytes=target.stat().st_size,
        encoding=encoding,
        rows=rows,
        columns=columns,
    )


@mcp.tool()
def csv_head(
    path: Annotated[str, Field(description="CSV_ROOT からの相対パス")],
    n: Annotated[int, Field(ge=1, le=50, description="返す行数")] = 5,
) -> CsvHead:
    """CSV の先頭 n 行（ヘッダーを除く）を返す。"""
    # ヘッダーと n 行を読んだら、そこで読むのをやめる
    _, rows = read_csv(resolve_csv(path), lambda rows: list(islice(rows, n + 1)))
    if not rows:
        raise ToolError("空のファイルです。")
    return CsvHead(columns=rows[0], rows=rows[1:])


if __name__ == "__main__":
    mcp.run()
```

実装のポイントは次の 5 つです。

- **型ヒントが入力スキーマになる**: `Field(ge=1, le=50)` と書くだけで、`n=999` のような呼び出しは関数が動く前に拒否されます。自分で範囲を確認するコードは要りません
- **戻り値の型が出力スキーマになる**: Pydantic のモデルを返すと、結果は 2 つの形で届きます。モデルが読む文字列（`content`）と、プログラムが読む JSON（`structuredContent`）です
- **ファイル全体をメモリに載せない**: `csv_head` は `islice` でヘッダーと n 行だけを読んで止め、`csv_info` は行を数えるだけで保持しません。200 万行（約 48 MB）の CSV で試すと、`csv_head` は数ミリ秒、`csv_info` は 2 秒弱で返り、Python が確保したメモリの最大値は約 0.1 MB でした
- **`mcp.run()` は引数なしで stdio になる**: ポートは開きません。`if __name__ == "__main__":` の下に置くのは、テストや `mcp run` コマンドがこのファイルを import するためです
- **`print()` を書かない**: stdio では標準出力が通信路です。試したところ、`print()` の出力はプロセスの終了時に標準出力へ流れ、JSON-RPC の行に混ざりました。ログは `logging` で出します（標準エラー出力に出ます）

## 自作クライアントで生応答を見る：initialize は旧方式になった

SDK を使わずに、標準入力へ JSON を 1 行ずつ書くだけのクライアントを作ると、通信の中身がそのまま見えます。ここで分かったのは、**接続の始め方が 2 通りある**ことです。

MCP の仕様は、2026-07-28 版で `initialize` によるハンドシェイク（接続開始時のやり取り）を廃止しました。mcp 2.3.0 のサーバーは、2025-11-25 以前の旧方式と 2026-07-28 の新方式の両方に、設定なしで応答します。

| | 旧方式（2025-11-25 以前） | 新方式（2026-07-28） |
|---|---|---|
| 接続の開始 | `initialize` → `notifications/initialized` | なし。最初からツールを呼べる |
| バージョンの伝え方 | `initialize` の `protocolVersion` | 各リクエストの `params._meta` |
| サーバーの情報を得る方法 | `initialize` の応答 | `server/discover`（呼ぶかどうかは任意） |
| 結果に加わるもの | なし | `resultType` と、`_meta` の `serverInfo` |
| `ping` | 使える | `Method not found`（`-32601`） |

`raw_client.py` の全文です。

```python
"""SDK を使わず、stdio に JSON-RPC を 1 行ずつ書いて、生の応答を見る。"""

import json
import os
import subprocess
import sys

CALL = {"name": "csv_head", "arguments": {"path": "sales.csv", "n": 2}}
META = {
    "io.modelcontextprotocol/protocolVersion": "2026-07-28",
    "io.modelcontextprotocol/clientCapabilities": {},
}


def send(server: subprocess.Popen, message: dict, wait: bool = True) -> None:
    print("-->", json.dumps(message, ensure_ascii=False))
    server.stdin.write(json.dumps(message) + "\n")
    server.stdin.flush()
    if wait:  # 通知（id なし）には応答が返らない
        print("<--", server.stdout.readline().rstrip())


def legacy(server: subprocess.Popen) -> None:
    """2025-11-25 以前: initialize でバージョンを決めてから呼ぶ。"""
    init = {"protocolVersion": "2025-11-25", "capabilities": {}, "clientInfo": {"name": "raw", "version": "0.1"}}
    send(server, {"jsonrpc": "2.0", "id": 1, "method": "initialize", "params": init})
    send(server, {"jsonrpc": "2.0", "method": "notifications/initialized"}, wait=False)
    send(server, {"jsonrpc": "2.0", "id": 2, "method": "tools/call", "params": CALL})


def modern(server: subprocess.Popen) -> None:
    """2026-07-28: ハンドシェイクなし。毎回 _meta にバージョンを入れる。"""
    send(server, {"jsonrpc": "2.0", "id": 1, "method": "server/discover", "params": {"_meta": META}})
    send(server, {"jsonrpc": "2.0", "id": 2, "method": "tools/call", "params": {**CALL, "_meta": META}})


if __name__ == "__main__":
    server = subprocess.Popen(
        [sys.executable, "server.py"],
        stdin=subprocess.PIPE,
        stdout=subprocess.PIPE,
        text=True,
        encoding="utf-8",
        env={**os.environ, "CSV_ROOT": "data"},
    )
    {"legacy": legacy, "modern": modern}[sys.argv[1]](server)
    server.stdin.close()
    server.wait()
```

### 旧方式：initialize を送ると protocolVersion は 2025-11-25

`python raw_client.py legacy` の出力です（`…` は省略した部分）。

```text
--> {"jsonrpc": "2.0", "id": 1, "method": "initialize", "params": {"protocolVersion": "2025-11-25", "capabilities": {}, "clientInfo": {"name": "raw", "version": "0.1"}}}
<-- {"jsonrpc":"2.0","id":1,"result":{"capabilities":{…},"instructions":"CSV を読み込む前に…","protocolVersion":"2025-11-25","serverInfo":{"name":"csv-peek","version":"0.1.0"}}}
--> {"jsonrpc": "2.0", "method": "notifications/initialized"}
--> {"jsonrpc": "2.0", "id": 2, "method": "tools/call", "params": {"name": "csv_head", "arguments": {"path": "sales.csv", "n": 2}}}
<-- {"jsonrpc":"2.0","id":2,"result":{"content":[{"text":"{\n  \"columns\": [… ]\n}","type":"text"}],"isError":false,"structuredContent":{"columns":["id","name","price"],"rows":[["1","りんご","120"],["2","みかん","80"]]}}}
```

`initialize` の `protocolVersion` を変えて、応答を比べました。

| `initialize` で要求したバージョン | 応答の `protocolVersion` |
|---|---|
| `2025-11-25` | `2025-11-25` |
| `2024-11-05` | `2024-11-05` |
| `2026-07-28` | `2025-11-25` |
| `1999-01-01`（存在しない） | `2025-11-25` |

`initialize` で `2026-07-28` を要求しても、返るのは `2025-11-25` です。[SDK の移行ガイド](https://py.sdk.modelcontextprotocol.io/v2/migration/)にも、2026-07-28 は `initialize` のハンドシェイクでは選べないと書かれています。SDK 2.x を使っているのに `2025-11-25` が返るのは、クライアントが旧方式で接続しているからです。

### 新方式：ハンドシェイクなしで、_meta にバージョンを入れる

`python raw_client.py modern` の出力です。

```text
--> {"jsonrpc": "2.0", "id": 1, "method": "server/discover", "params": {"_meta": {"io.modelcontextprotocol/protocolVersion": "2026-07-28", "io.modelcontextprotocol/clientCapabilities": {}}}}
<-- {"jsonrpc":"2.0","id":1,"result":{"cacheScope":"private","capabilities":{…},"instructions":"CSV を読み込む前に…","resultType":"complete","supportedVersions":["2026-07-28"],"ttlMs":0,"_meta":{"io.modelcontextprotocol/serverInfo":{"name":"csv-peek","version":"0.1.0"}}}}
--> {"jsonrpc": "2.0", "id": 2, "method": "tools/call", "params": {"name": "csv_head", "arguments": {"path": "sales.csv", "n": 2}, "_meta": {"io.modelcontextprotocol/protocolVersion": "2026-07-28", "io.modelcontextprotocol/clientCapabilities": {}}}}
<-- {"jsonrpc":"2.0","id":2,"result":{"content":[…],"isError":false,"resultType":"complete","structuredContent":{"columns":["id","name","price"],"rows":[["1","りんご","120"],["2","みかん","80"]]},"_meta":{"io.modelcontextprotocol/serverInfo":{"name":"csv-peek","version":"0.1.0"}}}}
```

`server/discover` を省いて、最初のメッセージで `tools/call` を送っても、同じ結果が返りました。新方式で間違えたときの応答も確認しました。

| 送ったもの | 応答 |
|---|---|
| `initialize` も `_meta` もなしで `tools/list` | `-32602` `Invalid request parameters` |
| `_meta` のバージョンが `2027-01-01` | `-32022` `Unsupported protocol version`（`data.supported` は `["2026-07-28"]`） |
| `initialize` なしで、`_meta` のバージョンが `2025-11-25` | `-32022` `Unsupported protocol version` |

### SDK の Client と Claude Code は、どちらも新方式で接続した

実際のクライアントがどちらの方式を使うかも、通信を記録して確かめました。

| クライアント | 最初に送ったメッセージ | 決まったバージョン |
|---|---|---|
| SDK の `Client`（既定の `mode="auto"`） | `server/discover` | `2026-07-28` |
| SDK の `Client`（`mode="legacy"`） | `initialize` | `2025-11-25` |
| Claude Code 2.1.332 | `server/discover` | `2026-07-28` |

Claude Code 2.1.332 は、`initialize` を一度も送りませんでした。`initialize` から始まる生ログは、旧方式のクライアントとの通信を見ていることになります。

## ハマり②：属性名が snake_case になった

SDK の `Client` で結果を受け取ると、v1 の属性名ではエラーになります。

```text
AttributeError: 'Tool' object has no attribute 'inputSchema'
AttributeError: 'CallToolResult' object has no attribute 'isError'
AttributeError: 'CallToolResult' object has no attribute 'structuredContent'
```

v2 では、Python から読む属性名がすべて snake_case になりました。よく使うものは次のとおりです。

| v1 | v2 |
|---|---|
| `tool.inputSchema` | `tool.input_schema` |
| `tool.outputSchema` | `tool.output_schema` |
| `result.isError` | `result.is_error` |
| `result.structuredContent` | `result.structured_content` |
| `result.nextCursor` | `result.next_cursor` |

変わったのは Python の属性名だけです。前の章の生ログのとおり、通信上の JSON は `isError`・`structuredContent`・`inputSchema` のままです。仕様書や生ログで見た名前を、Python ではそのまま書けない、と覚えておくと迷いません。

気づきにくいのは `model_dump()` です。エラーにならずに、キーの名前だけが変わります。

```python
result.model_dump(exclude_none=True).keys()
# ['meta', 'content', 'structured_content', 'is_error', 'result_type']

result.model_dump(exclude_none=True, by_alias=True).keys()
# ['_meta', 'content', 'structuredContent', 'isError', 'resultType']
```

結果を JSON にして別のプログラムへ渡しているなら、`by_alias=True` を付けると通信上の名前に戻ります。モデルを作るときは `Tool(name="x", inputSchema={...})` のように、どちらの名前でも受け付けます。

## ハマり③：ToolError 以外の例外は、メッセージがモデルに届かない

3 つ目は、エラーが出ないまま動作が変わる点です。ツールの中で投げた例外がクライアントにどう見えるかを、v1（mcp 1.30.0）と v2（mcp 2.3.0）で比べました。

| ツールの中でしたこと | v1（1.30.0） | v2（2.3.0） |
|---|---|---|
| `ToolError("理由")` を投げる | `isError: true`。本文は `Error executing tool <ツール名>: 理由` | v1 と同じ |
| `ValueError("理由")` を投げる | `isError: true`。本文は `Error executing tool <ツール名>: 理由` | `isError: true`。本文は `Error executing tool <ツール名>` だけ |
| `MCPError`（v1 は `McpError`）を投げる | `isError: true`。本文に理由が入る | 結果ではなく JSON-RPC のエラー（`{"code": -32602, "message": "理由"}`） |
| エラー文を `return` する | `isError: false`（成功として扱われる） | v1 と同じ |

v1 の感覚で `raise ValueError("許可されたディレクトリの外です")` と書くと、v2 ではモデルに「失敗した」ことしか伝わりません。理由が分からないので、モデルは引数を直して呼び直すことができません。例外の内容は、サーバーのログ（標準エラー出力）にスタックトレース付きで残ります。

[SDK の公式ドキュメント（Handling errors）](https://py.sdk.modelcontextprotocol.io/v2/servers/handling-errors/)は、使い分けを次のように説明しています。

- **`ToolError`**: モデルが引数を変えれば直せる失敗。ファイルが見つからない、値が範囲外、など
- **`MCPError`**: リクエストそのものを拒否する場合。モデルが呼び直しても直らないもの
- **それ以外の例外**: 想定外のクラッシュ。サーバーの内部の情報が漏れないよう、メッセージは外に出ない

判断の基準は「もっと賢いモデルなら避けられた失敗か」です。避けられたなら `ToolError`、避けられないなら `MCPError` です。

## エラー設計：パストラバーサルを拒否し、理由は ToolError で返す

ファイルのパスを引数で受け取るツールは、読んでよい範囲を自分で決める必要があります。パストラバーサルとは、`../` などを使って、許可されていないディレクトリのファイルを読ませる攻撃のことです。[SDK の公式ドキュメント（URI templates）](https://py.sdk.modelcontextprotocol.io/v2/servers/uri-templates/)によると、SDK が `..` や絶対パスを自動で拒否するのは、リソースの URI テンプレートから取り出した値です。ツールの引数には、この確認はかかりませんでした（`../outside/secret.csv` という引数は、そのまま関数に届きました）。csv-peek では `resolve_csv` で確認しています。

```python
target = (ROOT / path).resolve()  # .. とシンボリックリンクを解決してから比べる
if not target.is_relative_to(ROOT):
    raise ToolError("許可されたディレクトリの外は読めません。")
```

`resolve()` で `..` とシンボリックリンクを解決してから `ROOT` の中かどうかを比べるので、次の 3 つをすべて拒否できます。

| 渡したパス | 結果 |
|---|---|
| `../outside/secret.csv` | `isError: true`「許可されたディレクトリの外は読めません。」 |
| `/etc/passwd`（絶対パス） | 同上 |
| `link.csv`（`CSV_ROOT` の中にあり、外のファイルを指すシンボリックリンク） | 同上 |

拒否の理由は `ToolError` で返しています。パスを決めたのはモデルなので、理由を読めば別のパスで呼び直せるからです。ハマり③のとおり、`ValueError` で投げると理由は届きません。

型ヒントに書いた制約の違反は、関数が動く前に SDK が拒否し、`isError: true` の結果として返します。

| 呼び出し | 結果の本文（抜粋） |
|---|---|
| `csv_head` に `n=999` | `Input should be less than or equal to 50` |
| `csv_head` に `n="ten"` | `Input should be a valid integer, unable to parse string as an integer` |
| `csv_info` に引数なし | `Field required` |
| 存在しないツール `csv_tail` | `Unknown tool: csv_tail` |

`CSV_ROOT` の確認は、同じプロセスの中での取り決めにすぎません。サーバーは起動したユーザーの権限で動くので、強い隔離が必要なら、コンテナなどで実行環境ごと分けます。Web アプリ全般の確認項目は、[Web アプリのセキュリティ診断チェックリスト](/articles/web-security-review-checklist/)にまとめています。

## 確認：インメモリのテストと Claude Code で動かす

### Client(mcp) でテストする

`Client` にサーバーのオブジェクトをそのまま渡すと、プロセスもポートも使わずにテストできます。v1 の `create_connected_server_and_client_session()` は削除され、この書き方に置き換わりました。

```python
import os
from pathlib import Path

import pytest

os.environ["CSV_ROOT"] = str(Path(__file__).parent / "data")

from mcp import Client  # noqa: E402

from server import mcp  # noqa: E402


@pytest.fixture
def anyio_backend():
    return "asyncio"


@pytest.fixture
async def client():
    async with Client(mcp, raise_exceptions=True) as c:
        yield c


@pytest.mark.anyio
async def test_csv_info(client: Client):
    result = await client.call_tool("csv_info", {"path": "sales.csv"})
    assert result.is_error is False
    assert result.structured_content["columns"] == ["id", "name", "price"]
    assert result.structured_content["rows"] == 3


@pytest.mark.anyio
@pytest.mark.parametrize("path", ["../outside/secret.csv", "/etc/passwd", "link.csv"])
async def test_rejects_outside_root(client: Client, path: str):
    result = await client.call_tool("csv_info", {"path": path})
    assert result.is_error is True
    assert "許可されたディレクトリの外" in result.content[0].text


@pytest.mark.anyio
async def test_n_is_validated_before_the_function_runs(client: Client):
    result = await client.call_tool("csv_head", {"path": "sales.csv", "n": 999})
    assert result.is_error is True
    assert "less than or equal to 50" in result.content[0].text
```

ツールが失敗しても、`call_tool` は例外を投げません。`try` / `except` ではなく、`result.is_error` を確認します。`link.csv` のテストを動かすには、`data/` の中に、外のファイルを指すシンボリックリンクを作っておきます。

```bash
mkdir outside
printf 'user,password\nroot,example\n' > outside/secret.csv
ln -s ../outside/secret.csv data/link.csv
pytest -q test_server.py  # 5 passed
```

### Claude Code から呼ぶ

Claude Code には、起動コマンドを書いた設定ファイルを渡しました。パスはすべて絶対パスにします。ホストは自分の作業ディレクトリからサーバーを起動するので、相対パスでは見つかりません。

```json
{
  "mcpServers": {
    "csv-peek": {
      "command": "/absolute/path/to/.venv/bin/python",
      "args": ["/absolute/path/to/server.py"],
      "env": { "CSV_ROOT": "/absolute/path/to/data" }
    }
  }
}
```

```bash
claude -p "csv-peek のツールで sales.csv の列名と行数を調べ、先頭 2 行を見せて。そのあと ../outside/secret.csv も調べて、返った内容をそのまま報告して。" \
  --mcp-config mcp-config.json \
  --allowedTools "mcp__csv-peek__csv_info,mcp__csv-peek__csv_head"
```

`-p` は、対話画面を開かずに 1 回だけ実行するオプションです。Claude Code は `csv_info` と `csv_head` を呼びました。`sales.csv` については列名（`id`・`name`・`price`）と 3 行であることを答え、`../outside/secret.csv` については「許可されたディレクトリの外は読めません。」というエラーが返ったことをそのまま報告しました。`ToolError` のメッセージが、モデルまで届いています。

設定ファイルを使わずに登録する方法（`claude mcp add`）と、Claude Desktop・Cursor・VS Code の設定は、[SDK の公式ドキュメント（Connect to a real host）](https://py.sdk.modelcontextprotocol.io/v2/get-started/real-host/)に載っています。この記事で試したのは、設定ファイルを `--mcp-config` で渡す方法だけです。

うまく接続できないときは、次の順に確認します。

1. 起動コマンドを自分で実行する。何も表示されずに待ち続ければ正常で、スタックトレースが出れば、そこが原因
2. 設定のパスがすべて絶対パスになっているか
3. `CSV_ROOT` を設定の `env` に書いたか（未設定だと起動時に `KeyError: 'CSV_ROOT'` で止まります）
4. サーバーのコードに `print()` が残っていないか

## まとめ：既製で済む話と、自作する意味

CSV の先頭を見るだけなら、MCP サーバーを作らなくても済みます。Claude Code はファイルを直接読めます。それでも自作する意味があるのは、**AI に見せる範囲を自分で決めたいとき**です。csv-peek は、読めるディレクトリを 1 つに絞り、返す行数を 50 行までに制限し、Shift_JIS の CSV も列名と行数を確認できる形で返します。こうした制約は、汎用のツールではなく、自分のサーバーに書くことになります。

SDK 2.x で自作するときの判断の基準をまとめます。

- v1 向けの記事のコードは、import を `from mcp.server import MCPServer` に直せば、デコレーターの部分はそのまま動く。直す場所は、属性名（snake_case）と例外の投げ方に集中している
- モデルに理由を読ませたい失敗は `ToolError` で投げる。`ValueError` などの例外は、v2 ではメッセージが届かない
- 生ログが `initialize` から始まっていたら、旧方式（2025-11-25 以前）の通信を見ている。2026-07-28 版は `initialize` を使わず、各リクエストの `_meta` にバージョンを入れる

仕様の変更点は [MCP の仕様（2026-07-28 版の changelog）](https://modelcontextprotocol.io/specification/2026-07-28/changelog)に、SDK の変更点は [SDK の移行ガイド](https://py.sdk.modelcontextprotocol.io/v2/migration/)にまとまっています。
