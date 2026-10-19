        else:
            role = "user"
        if isinstance(content, str) and content.strip():
            cleaned.append({"role": role, "content": content.strip()[:8000]})
    return cleaned


@app.get("/")
def home():
    return render_template("index.html")


@app.get("/health")
def health():
    return jsonify({"ok": True, "servicio": "IA TODO"})


@app.get("/manifest.json")
def manifest():
    path = BASE_DIR / "interface" / "manifest.json"
    if path.exists():
        return send_from_directory(path.parent, path.name)
    return jsonify({"name": "IA TODO", "short_name": "IA TODO", "start_url": "/", "display": "standalone", "background_color": "#0a0a12", "theme_color": "#7c5cff"})


@app.get("/sw.js")
def service_worker():
    path = BASE_DIR / "sw.js"
    if path.exists():
        return send_from_directory(path.parent, path.name, mimetype="application/javascript")
    return "self.addEventListener('fetch', () => {});", 200, {"Content-Type": "application/javascript"}


def process_chat(message, history=None, image=None):
    message = str(message or "").strip()
    if not message and not image:
        return jsonify({"error": "Escribe una pregunta o adjunta una imagen."}), 400
    try:
        result = preguntar(message, historial=normalize_history(history), imagen=image)
        if isinstance(result, dict):
            answer = str(result.get("respuesta", "") or "").strip()
            creator_mode = bool(result.get("modo_creador", False))
        else:
            answer = str(result or "").strip()
            creator_mode = False
        if not answer:
            return jsonify({"error": "La IA no devolvió una respuesta."}), 502
        return jsonify({"texto": answer, "respuesta": answer, "modo_creador": creator_mode}), 200
    except Exception:
        app.logger.exception("Error procesando /api/chat")
        return jsonify({"error": "No se pudo procesar la solicitud. Revisa la configuración de GROQ_API_KEY y los registros del servidor."}), 502


@app.post("/api/chat")
def api_chat():
    data = request.get_json(silent=True) or {}
    history = data.get("historial", [])
    image = data.get("imagen")
    message = data.get("mensaje", "")
    # The current UI sends the current user message as the last history item.
    if not message and isinstance(history, list) and history:
        last = history[-1]
        if isinstance(last, dict) and last.get("rol", last.get("role")) in ("user", "human"):
            message = last.get("texto", last.get("content", ""))
            history = history[:-1]
    return process_chat(message, history, image)


@app.post("/chat")
def chat_legacy():
    """Compatibility route for the older FormData-based frontend."""
    message = request.form.get("mensaje", "")
    try:
        history = json.loads(request.form.get("historial", "[]"))
    except (json.JSONDecodeError, TypeError):
        history = []
    uploaded = request.files.get("archivo")
    if uploaded and uploaded.filename:
        filename = secure_filename(uploaded.filename)
        extension = filename.rsplit(".", 1)[-1].lower() if "." in filename else ""
        if extension not in ALLOWED_EXTENSIONS:
            return jsonify({"error": "Formato no permitido. Usa un documento de texto como TXT, MD, CSV, JSON, PY, HTML, CSS o JS."}), 415
        path = UPLOAD_DIR / filename
        uploaded.save(path)
        try:
            content = path.read_text(encoding="utf-8", errors="replace")[:12000]
            message = f"Contenido del archivo {filename}:\n\n{content}\n\nPregunta del usuario: {message or 'Resume y explica el documento.'}"
        finally:
            try:
                path.unlink(missing_ok=True)
            except OSError:
                pass
    response, status = process_chat(message, history)
    if status != 200:
        return response, status
    data = response.get_json()
    return jsonify({"respuesta": data.get("texto", ""), "modo_creador": data.get("modo_creador", False)})


@app.post("/generar_titulo")
def generar_titulo():
    data = request.get_json(silent=True) or {}
    message = str(data.get("mensaje", "")).strip()[:500]
    if not message:
        return jsonify({"titulo": "Nuevo chat"})
    try:
        result = preguntar("Crea un título descriptivo de máximo 5 palabras para esta conversación. Devuelve solo el título, sin comillas. Tema: " + message)
        title = result.get("respuesta", "Nuevo chat") if isinstance(result, dict) else str(result or "Nuevo chat")
        title = re.sub(r"[\r\n\"'`]+", "", title).strip()[:70] or "Nuevo chat"
        return jsonify({"titulo": title})
    except Exception:
        return jsonify({"titulo": " ".join(message.split()[:5])[:70] or "Nuevo chat"})


@app.errorhandler(413)
def too_large(_error):
    return jsonify({"error": "El archivo o la solicitud supera el límite de 8 MB."}), 413


if __name__ == "__main__":
    app.run(host="0.0.0.0", port=int(os.getenv("PORT", "5000")), debug=os.getenv("FLASK_DEBUG") == "1")
