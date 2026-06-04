#!/usr/bin/env python3
"""HERMES Dossier - Telegram Bot (long-running polling)."""
import os, sys, json, time, urllib.request, urllib.parse, subprocess, tempfile, traceback, shlex

ENV_FILE = "/opt/hermes-dossier/.env.telegram"
if not os.path.exists(ENV_FILE):
    print(f"FATAL: {ENV_FILE} missing", file=sys.stderr); sys.exit(1)
env = {}
for line in open(ENV_FILE):
    line = line.strip()
    if line and not line.startswith("#") and "=" in line:
        k, v = line.split("=", 1); env[k.strip()] = v.strip()
TOKEN = env.get("TELEGRAM_BOT_TOKEN", "")
CHAT = env.get("TELEGRAM_CHAT_ID", "")

def _get_key(path, var):
    try:
        for line in open(path):
            if line.startswith(var + "="):
                return line.split("=", 1)[1].strip()
    except Exception:
        pass
    return ""
DS_KEY = _get_key("/opt/hermes-v2/.env", "DEEPSEEK_API_KEY")
GEM_KEY = _get_key("/opt/hermes-dossier/.env", "GEMINI_API_KEY")
DB_PW = "Surus2024!"

if not TOKEN or not CHAT:
    print("FATAL: TELEGRAM_BOT_TOKEN/TELEGRAM_CHAT_ID missing", file=sys.stderr); sys.exit(1)
if not GEM_KEY:
    print("WARN: GEMINI_API_KEY missing - voice transcription will fail", file=sys.stderr)
if not DS_KEY:
    print("WARN: DEEPSEEK_API_KEY missing - text chat will fail", file=sys.stderr)

API = f"https://api.telegram.org/bot{TOKEN}"

HELP_TEXT = (
    "<b>HERMES Dossier — Tu asistente personal</b>\n"
    "Creado por Juan Carlos Alvarado para Surus Inversa.\n\n"
    "Soy tu asistente. Preguntame lo que quieras sobre HERMES: empresas, "
    "contactos, KPIs, sectores, planificacion, lo que sea.\n\n"
    "<b>Comandos rapidos</b>\n"
    "/stats  - KPIs en vivo\n"
    "/empresas  - Top empresas con movimiento\n"
    "/contactos  - Decisores clave con email\n"
    "/ultimo  - Ultimo scan ejecutado\n"
    "/scan  - Lanza scan manual (1-3 min)\n\n"
    "O escribe una pregunta libre. Tambien acepto <b>notas de voz</b> y <b>fotos</b>."
)


def log(msg):
    """Log to stdout (captured by systemd journal)."""
    print(f"[bot] {msg}", flush=True)


def log_err(msg, exc=None):
    """Log error with full traceback to journal."""
    print(f"[bot ERR] {msg}", flush=True)
    if exc is not None:
        traceback.print_exc(file=sys.stdout)
        sys.stdout.flush()


def send(chat_id, text, parse_mode="HTML"):
    if len(text) > 4000:
        text = text[:3997] + "..."
    data = urllib.parse.urlencode({
        "chat_id": chat_id, "text": text, "parse_mode": parse_mode
    }).encode()
    for attempt in range(3):
        try:
            urllib.request.urlopen(
                urllib.request.Request(f"{API}/sendMessage", data=data), timeout=10
            ).read()
            return
        except Exception as e:
            log_err(f"send attempt {attempt+1}", e)
            if attempt < 2:
                time.sleep(2)


def send_typing(chat_id):
    try:
        data = urllib.parse.urlencode({"chat_id": chat_id, "action": "typing"}).encode()
        urllib.request.urlopen(
            urllib.request.Request(f"{API}/sendChatAction", data=data), timeout=5
        ).read()
    except Exception:
        pass


def db_query(sql):
    try:
        out = subprocess.check_output(
            ["psql", "-h", "127.0.0.1", "-U", "surus", "-d", "hermes_dossier",
             "-t", "-A", "-F", "|", "-c", sql],
            env={**os.environ, "PGPASSWORD": DB_PW},
            timeout=15, stderr=subprocess.DEVNULL
        ).decode().strip()
        return out
    except Exception as e:
        return f"ERR:{e}"


def marcela_chat(question):
    """Delega la pregunta a Marcela (hermes-agent gateway) — la asistente personal de Juan Carlos.
    Usa el modo no-interactivo `hermes chat -q --yolo -Q` que devuelve la respuesta final por stdout.
    """
    if not question or not question.strip():
        return "(pregunta vacia)"
    try:
        cmd = [
            "sudo", "-u", "root",
            "bash", "-c",
            f"cd /usr/local/lib/hermes-agent && source venv/bin/activate && timeout 120 python -m hermes_cli.main chat -q {shlex.quote(question)} --yolo -Q 2>/dev/null | tail -50"
        ]
        log(f"marcela_chat invoking hermes agent...")
        result = subprocess.run(cmd, capture_output=True, text=True, timeout=150)
        out = (result.stdout or "").strip()
        # Si la salida trae "session_id: ..." al inicio, limpiarlo
        lines = [l for l in out.split("\n") if l.strip() and not l.strip().startswith("session_id:")]
        answer = "\n".join(lines).strip()
        if not answer:
            answer = f"[Marcela no respondio. stderr: {(result.stderr or '')[:200]}]"
        log(f"marcela_chat len={len(answer)} preview={answer[:120]}")
        return answer[:3500]
    except subprocess.TimeoutExpired:
        log_err("marcela_chat timeout 150s")
        return "[Marcela timeout — la peticion tardo mas de 150s]"
    except Exception as e:
        log_err("marcela_chat", e)
        return f"[Marcela error: {e}]"


# Mantener deepseek_chat como fallback si Marcela falla
def deepseek_chat(question):
    """DeepSeek con contexto en vivo de la base. FALLBACK — Marcela es la principal."""
    if not DS_KEY:
        return "[DeepSeek no configurado]"
    stats = db_query('SELECT COUNT(*) FROM "Source";')
    in_scope = db_query('SELECT COUNT(*) FROM "Source" WHERE "deimplantationSignal"=true;')
    empresas = db_query('SELECT COUNT(*) FROM "Company";')
    context = (
        f"Base HERMES Dossier (A&B OSINT Espana):\n"
        f"- Sources totales: {stats}\n- In-scope: {in_scope}\n- Empresas: {empresas}\n\n"
    )
    payload = json.dumps({
        "model": "deepseek-chat",
        "messages": [
            {"role": "system", "content": (
                "Eres HERMES, asistente de Surus. Respondes en espanol, conciso, con datos concretos. "
                "Si no sabes, dilo. No inventes."
            )},
            {"role": "user", "content": context + "Pregunta: " + question}
        ],
        "max_tokens": 800,
        "temperature": 0.3,
    }).encode()
    req = urllib.request.Request(
        "https://api.deepseek.com/v1/chat/completions",
        data=payload,
        headers={"Authorization": f"Bearer {DS_KEY}", "Content-Type": "application/json"},
        method="POST",
    )
    try:
        r = json.loads(urllib.request.urlopen(req, timeout=60).read())
        return r["choices"][0]["message"]["content"]
    except Exception as e:
        log_err("deepseek_chat", e)
        return f"[DeepSeek error: {e}]"


def smart_chat(question):
    """Marcela primero, DeepSeek como fallback si Marcela falla/timeout."""
    ans = marcela_chat(question)
    if ans and not ans.startswith("[Marcela"):
        return f"💜 {ans}"
    log(f"smart_chat: Marcela fallo, intentando DeepSeek")
    fb = deepseek_chat(question)
    if fb and not fb.startswith("[DeepSeek"):
        return f"💜 {fb}"
    return (
        f"💜 Soy tu asistente HERMES. Marcela y DeepSeek no estan disponibles ahora mismo.\n"
        f"Pregunta registrada: <i>{question[:200]}</i>\n"
        f"Intenta reformular o usar /stats, /empresas, /contactos, /ultimo, /scan."
    )


def transcribe_voice(file_path):
    """Transcribe audio con Gemini 2.5 Flash (multimodal)."""
    if not GEM_KEY:
        return "[Gemini no configurado]"
    import base64
    file_size = os.path.getsize(file_path)
    log(f"transcribe_voice: file={file_path} size={file_size}")
    with open(file_path, "rb") as f:
        audio_b64 = base64.b64encode(f.read()).decode()

    # Determinar mime type por extension
    mime = "audio/ogg"
    if file_path.endswith(".mp3"): mime = "audio/mpeg"
    elif file_path.endswith(".m4a"): mime = "audio/mp4"
    elif file_path.endswith(".wav"): mime = "audio/wav"

    payload = json.dumps({
        "contents": [{
            "parts": [
                {"text": "Transcribe este audio a texto en espanol, literalmente. Solo el texto transcrito, nada mas."},
                {"inline_data": {"mime_type": mime, "data": audio_b64}}
            ]
        }],
        "generationConfig": {"temperature": 0.1, "maxOutputTokens": 1024}
    }).encode()
    url = f"https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key={GEM_KEY}"
    req = urllib.request.Request(url, data=payload, headers={"Content-Type": "application/json"}, method="POST")
    try:
        resp = urllib.request.urlopen(req, timeout=60).read()
        r = json.loads(resp)
        log(f"gemini resp keys: {list(r.keys())}")
        if "candidates" in r and r["candidates"]:
            parts = r["candidates"][0].get("content", {}).get("parts", [])
            if parts:
                return parts[0].get("text", "").strip()
            return "[Gemini: sin texto en respuesta]"
        if "error" in r:
            return f"[Gemini error: {r['error'].get('message','?')}]"
        return f"[Gemini: respuesta vacia]"
    except urllib.error.HTTPError as e:
        body = e.read().decode("utf-8", errors="replace")[:300]
        log_err(f"gemini HTTP {e.code}: {body}")
        return f"[Gemini HTTP {e.code}: {body[:200]}]"
    except Exception as e:
        log_err("transcribe_voice", e)
        return f"[transcribe err: {e}]"


def download_telegram_file(file_id):
    """Descarga archivo de Telegram, devuelve path local o None."""
    try:
        r = json.loads(urllib.request.urlopen(
            urllib.request.Request(f"{API}/getFile?file_id={file_id}", timeout=15)
        ).read())
        log(f"getFile resp: ok={r.get('ok')} keys={list(r.keys())}")
        if not r.get("ok"):
            log_err(f"getFile not ok: {r}")
            return None
        result = r.get("result", {})
        file_path_remote = result.get("file_path")
        if not file_path_remote:
            log_err(f"getFile sin file_path: {r}")
            return None
        file_size = result.get("file_size", "?")
        log(f"downloading file_path={file_path_remote} size={file_size}")
        audio_url = f"https://api.telegram.org/file/bot{TOKEN}/{file_path_remote}"
        tmp = tempfile.NamedTemporaryFile(suffix=".ogg", delete=False)
        urllib.request.urlretrieve(audio_url, tmp.name)
        local_size = os.path.getsize(tmp.name)
        log(f"downloaded local_size={local_size}")
        if local_size < 100:
            log_err(f"downloaded file too small: {local_size} bytes")
            os.unlink(tmp.name)
            return None
        return tmp.name
    except urllib.error.HTTPError as e:
        body = e.read().decode("utf-8", errors="replace")[:300]
        log_err(f"getFile HTTP {e.code}: {body}")
        return None
    except Exception as e:
        log_err("download_telegram_file", e)
        return None


def handle(update):
    try:
        msg = update.get("message") or update.get("edited_message")
        if not msg:
            return
        chat_id = str(msg["chat"]["id"])
        if chat_id != CHAT:
            send(chat_id, "No autorizado.")
            return
        text = (msg.get("text") or "").strip()
        voice = msg.get("voice")
        photos = msg.get("photo") or []

        send_typing(chat_id)

        if text and text.startswith("/") and text.split()[0] in (
            "/start", "/help", "/stats", "/empresas", "/contactos", "/ultimo", "/scan"
        ):
            pass  # cae en los ifs de abajo
        elif text and text.startswith("/"):
            # Comando desconocido → tratar como pregunta al asistente
            log(f"unknown cmd treated as question: {text}")
            ans = smart_chat(text)
            send(chat_id, ans[:3500]); return

        if text in ("/start", "/help"):
            send(chat_id, HELP_TEXT); return
        if text == "/stats":
            s = db_query('SELECT COUNT(*) FROM "Source";')
            ins = db_query('SELECT COUNT(*) FROM "Source" WHERE "deimplantationSignal"=true;')
            emp = db_query('SELECT COUNT(*) FROM "Company";')
            ops = db_query('SELECT COUNT(*) FROM "Operation";')
            cts = db_query('SELECT COUNT(*) FROM "PlantContact" WHERE email IS NOT NULL AND email != \'\';')
            send(chat_id, (
                f"<b>KPIs en vivo</b>\n"
                f"Sources: {s}\nIn-scope: {ins}\nEmpresas: {emp}\n"
                f"Operaciones: {ops}\nContactos con email: {cts}"
            )); return
        if text == "/empresas":
            rows = db_query(
                'SELECT c.name || \' | ops=\' || (SELECT COUNT(*) FROM "Operation" o WHERE o."companyId"=c.id) '
                '|| \' | ccaa=\' || COALESCE(c."region", \'?\') '
                'FROM "Company" c ORDER BY 2 DESC LIMIT 10;'
            )
            send(chat_id, "<b>Top empresas</b>\n" + "\n".join("• " + r for r in rows.split("\n") if r)); return
        if text == "/contactos":
            rows = db_query(
                'SELECT pc."fullName" || \' - \' || pc."currentRole" || \' @ \' || c.name '
                'FROM "PlantContact" pc LEFT JOIN "Company" c ON c.id = pc."currentCompanyId" '
                'WHERE pc.email IS NOT NULL AND pc.email != \'\' ORDER BY pc."fullName" LIMIT 20;'
            )
            send(chat_id, "<b>Contactos clave</b>\n" + "\n".join("• " + r for r in rows.split("\n") if r)[:3500]); return
        if text == "/ultimo":
            rows = db_query(
                'SELECT "agentName" || \' | found=\' || "itemsFound" || \' | inScope=\' || "itemsInScope" || \' | \' || "finishedAt" '
                'FROM "SearchRun" ORDER BY "startedAt" DESC LIMIT 5;'
            )
            send(chat_id, "<b>Ultimos scans</b>\n" + "\n".join("• " + r for r in rows.split("\n") if r)); return
        if text == "/scan":
            send(chat_id, "Lanzando scan manual... (1-3 min)")
            r = subprocess.run(
                ["/bin/bash", "/opt/hermes-dossier/scripts/run-agents.sh"],
                timeout=600, capture_output=True
            )
            send(chat_id, f"Scan terminado. exit={r.returncode}"); return

        if voice:
            file_id = voice.get("file_id")
            if not file_id:
                send(chat_id, "[voice err: sin file_id]")
                return
            log(f"voice msg received file_id={file_id} duration={voice.get('duration')}")
            local_path = download_telegram_file(file_id)
            if not local_path:
                send(chat_id, "[voice err: no se pudo descargar de Telegram]")
                return
            try:
                send(chat_id, "Transcribiendo audio...")
                transcript = transcribe_voice(local_path)
                log(f"transcript: {transcript[:200]}")
                if not transcript or transcript.startswith("["):
                    send(chat_id, f"[voice err: {transcript}]")
                    return
                send(chat_id, f"Transcripcion: <i>{transcript[:1500]}</i>")
                send_typing(chat_id)
                ans = smart_chat(transcript)
                send(chat_id, ans[:3500])
            finally:
                try: os.unlink(local_path)
                except Exception: pass
            return

        if photos:
            # Telegram manda varias resoluciones; cogemos la mayor.
            top = max(photos, key=lambda p: p.get("file_size", 0))
            file_id = top.get("file_id")
            caption = (msg.get("caption") or "").strip()
            log(f"photo msg file_id={file_id} caption={caption[:80]!r}")
            question = caption if caption else "Acabo de mandarte una foto. ¿Qué ves en ella? Descríbemela y, si parece una placa de datos industrial, intenta extraer marca, modelo, año y país."
            ans = smart_chat(question)
            send(chat_id, "💜 Foto recibida. " + ans[:3300]); return

        if text and not text.startswith("/"):
            ans = smart_chat(text)
            send(chat_id, ans[:3500]); return
    except Exception as e:
        log_err(f"handle fatal", e)


def main():
    global offset
    offset = 0
    log(f"started chat={CHAT} pid={os.getpid()} gem={bool(GEM_KEY)} ds={bool(DS_KEY)}")
    while True:
        try:
            url = f"{API}/getUpdates?timeout=30&offset={offset}"
            r = json.loads(urllib.request.urlopen(url, timeout=45).read())
            for u in r.get("result", []):
                offset = u["update_id"] + 1
                handle(u)
        except urllib.error.URLError as e:
            log_err(f"poll URLError (reintento en 3s)", e)
            time.sleep(3)
        except json.JSONDecodeError as e:
            log_err(f"poll json decode", e)
            time.sleep(3)
        except Exception as e:
            log_err(f"poll fatal", e)
            time.sleep(3)


if __name__ == "__main__":
    main()
