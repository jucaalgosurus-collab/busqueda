#!/usr/bin/env python3
# lib/telegram/bot_send.py — Sprint QW-1: Subprocess target para lib/telegram/notify.ts.
#
# Wrapper mínimo alrededor de la API sendMessage de Telegram. No usa bot.py
# existente para evitar acoplamiento con la lógica de handlers (voice/photo/...).
# Lee credenciales de process env directamente.
#
# Uso:
#   python3 bot_send.py --chat-id 123 --text "hola" --parse-mode HTML
#   python3 bot_send.py --chat-id 123 --text "hola"  (parse_mode por defecto HTML)
#
# Env:
#   TELEGRAM_BOT_TOKEN  — token del bot (obligatorio)
#   TELEGRAM_API_BASE   — base URL de la API (opcional, default https://api.telegram.org)
#
# Exit codes:
#   0 = enviado
#   2 = falta TELEGRAM_BOT_TOKEN
#   3 = error de API (cuerpo en stderr)
#   4 = argumentos inválidos

import argparse
import json
import os
import sys
import urllib.error
import urllib.parse
import urllib.request


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--chat-id", required=True)
    parser.add_argument("--text", required=True)
    parser.add_argument("--parse-mode", default="HTML", choices=["HTML", "MarkdownV2", "Markdown"])
    parser.add_argument("--disable-web-page-preview", action="store_true")
    args = parser.parse_args()

    token = os.environ.get("TELEGRAM_BOT_TOKEN", "").strip()
    if not token:
        print("[bot_send] TELEGRAM_BOT_TOKEN no definido en env", file=sys.stderr)
        return 2

    base = os.environ.get("TELEGRAM_API_BASE", "https://api.telegram.org").rstrip("/")
    url = f"{base}/bot{token}/sendMessage"

    payload = {
        "chat_id": args.chat_id,
        "text": args.text,
        "parse_mode": args.parse_mode,
        "disable_web_page_preview": args.disable_web_page_preview,
    }
    data = urllib.parse.urlencode(payload).encode("utf-8")
    req = urllib.request.Request(url, data=data, method="POST")

    try:
        with urllib.request.urlopen(req, timeout=5) as resp:
            body = resp.read().decode("utf-8", errors="replace")
            try:
                j = json.loads(body)
                if j.get("ok"):
                    return 0
                print(f"[bot_send] API returned not-ok: {body[:400]}", file=sys.stderr)
                return 3
            except json.JSONDecodeError:
                print(f"[bot_send] API returned non-JSON: {body[:400]}", file=sys.stderr)
                return 3
    except urllib.error.HTTPError as e:
        body = e.read().decode("utf-8", errors="replace") if e.fp else ""
        print(f"[bot_send] HTTP {e.code}: {body[:400]}", file=sys.stderr)
        return 3
    except urllib.error.URLError as e:
        print(f"[bot_send] URL error: {e}", file=sys.stderr)
        return 3
    except Exception as e:  # noqa: BLE001
        print(f"[bot_send] unexpected error: {e}", file=sys.stderr)
        return 3


if __name__ == "__main__":
    sys.exit(main())
