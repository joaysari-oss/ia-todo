
import json
import logging
import os
import re
from pathlib import Path

from flask import (
    Flask,
    jsonify,
    render_template,
    request,
    send_from_directory,
    Response,
)
from werkzeug.utils import secure_filename

from ai.brain import preguntar


# ==========================================
# CONFIGURACIÓN DE IA TODO
# ==========================================

BASE_DIR = Path(__file__).resolve().parent
INTERFACE_DIR = BASE_DIR / "interface"
STATIC_DIR = BASE_DIR / "static"

MAX_CONTENT_LENGTH = 8 * 1024 * 1024

ALLOWED_EXTENSIONS = {
    "txt", "md", "csv", "json", "py",
    "html", "css", "js", "xml", "yaml",
    "yml", "log"
}

app = Flask(
    __name__,
    template_folder=str(INTERFACE_DIR),
    static_folder=str(STATIC_DIR),
)

app.config["MAX_CONTENT_LENGTH"] = MAX_CONTENT_LENGTH

logging.basicConfig(
    level=os.getenv("LOG_LEVEL", "INFO")
)


# ==========================================
# LIMPIAR EL HISTORIAL DEL CHAT
# ==========================================

def normalize_history(raw):
    if not isinstance(raw, list):
        return []

    cleaned = []

    for item in raw[-14:]:
        if not isinstance(item, dict):
            continue

        role = item.get("rol", item.get("role", "user"))
        content = item.get("texto", item.get("content", ""))

        if not isinstance(content, str):
            continue

        content = content.strip()[:8000]

        if not content:
            continue

        if role in ("assistant", "bot"):
            role = "assistant"
        else:
            role = "user"

        cleaned.append({
            "role": role,
            "content": content,
        })

    return cleaned


# ==========================================
# PÁGINA PRINCIPAL
# ==========================================

@app.route("/", methods=["GET"])
def home():
    return render_template("index.html")


# ==========================================
# COMPROBAR SI EL SERVIDOR ESTÁ FUNCIONANDO
# ==========================================

@app.route("/health", methods=["GET"])
def health():
    return jsonify({
        "ok": True,
        "servicio": "IA TODO",
    }), 200


# ==========================================
# MANIFEST PARA LA APLICACIÓN WEB
# ==========================================

@app.route("/manifest.json", methods=["GET"])
def manifest():
    manifest_path = INTERFACE_DIR / "manifest.json"

    if manifest_path.is_file():
        return send_from_directory(
            str(INTERFACE_DIR),
            "manifest.json",
        )

    return jsonify({
        "name": "IA TODO",
        "short_name": "IA TODO",
        "start_url": "/",
        "display": "standalone",
        "background_color": "#0a0a12",
        "theme_color": "#7c5cff",
    })


# ==========================================
# SERVICE WORKER
# ==========================================

@app.route("/sw.js", methods=["GET"])
def service_worker():
    sw_path = BASE_DIR / "sw.js"

    if sw_path.is_file():
        return send_from_directory(
            str(BASE_DIR),
            "sw.js",
            mimetype="application/javascript",
        )

    return Response(
        "self.addEventListener('fetch', () => {});",
        mimetype="application/javascript",
    )


# ==========================================
# PROCESAR MENSAJES CON LA INTELIGENCIA ARTIFICIAL
# ==========================================

def process_chat(message, history=None, image=None):
    message = str(message or "").strip()

    if not message and not image:
        return jsonify({
            "error": "Escribe una pregunta o adjunta una imagen."
        }), 400

    try:
        result = preguntar(
            message,
            historial=normalize_history(history),
            imagen=image,
        )

        if isinstance(result, dict):
            answer = str(
                result.get("respuesta", "") or ""
            ).strip()

            creator_mode = bool(
                result.get("modo_creador", False)
            )
        else:
            answer = str(result or "").strip()
            creator_mode = False

        if not answer:
            return jsonify({
                "error": "La IA no devolvió una respuesta."
            }), 502

        return jsonify({
            "texto": answer,
            "respuesta": answer,
            "modo_creador": creator_mode,
        }), 200

    except Exception:
        app.logger.exception(
            "Error procesando una solicitud del chat"
        )

        return jsonify({
            "error": (
                "No se pudo procesar tu pregunta. "
                "Comprueba la configuración de la IA "
                "y los registros del servidor."
            )
        }), 502


# ==========================================
# RUTA PRINCIPAL DEL CHAT
# IMPORTANTE: ESTA RUTA SOLUCIONA EL 404 DE /api/chat
# ==========================================

@app.route("/api/chat", methods=["POST"])
def api_chat():
    data = request.get_json(silent=True)

    if not isinstance(data, dict):
        return jsonify({
            "error": "La solicitud debe contener datos JSON válidos."
        }), 400

    message = data.get("mensaje", "")
    history = data.get("historial", [])
    image = data.get("imagen")

    if not isinstance(message, str):
        message = ""

    if not isinstance(history, list):
        history = []

    return process_chat(
        message=message,
        history=history,
        image=image,
    )


# ==========================================
# RUTA ANTIGUA PARA COMPATIBILIDAD
# ==========================================

@app.route("/chat", methods=["POST"])
def chat_legacy():
    message = request.form.get("mensaje", "").strip()
    history_text = request.form.get("historial", "[]")

    try:
        history = json.loads(history_text)
    except (json.JSONDecodeError, TypeError):
        history = []

    uploaded = request.files.get("archivo")

    if uploaded and uploaded.filename:
        filename = secure_filename(uploaded.filename)

        if not filename or "." not in filename:
            return jsonify({
                "error": "El nombre del archivo no es válido."
            }), 415

        extension = filename.rsplit(".", 1)[-1].lower()

        if extension not in ALLOWED_EXTENSIONS:
            return jsonify({
                "error": (
                    "Formato no permitido. Usa TXT, MD, CSV, "
                    "JSON, PY, HTML, CSS, JS, XML, YAML o LOG."
                )
            }), 415

        try:
            content_bytes = uploaded.read(MAX_CONTENT_LENGTH + 1)

            if len(content_bytes) > MAX_CONTENT_LENGTH:
                return jsonify({
                    "error": "El archivo supera el límite de 8 MB."
                }), 413

            content = content_bytes.decode(
                "utf-8",
                errors="replace",
            )[:12000]

            message = (
                f"Contenido del archivo {filename}:\n\n"
                f"{content}\n\n"
                f"Pregunta del usuario: "
                f"{message or 'Resume y explica el documento.'}"
            )

        except Exception:
            app.logger.exception(
                "Error leyendo el archivo adjunto"
            )

            return jsonify({
                "error": "No se pudo leer el archivo adjunto."
            }), 400

    response, status = process_chat(
        message=message,
        history=history,
    )

    if status != 200:
        return response, status

    result = response.get_json() or {}

    return jsonify({
        "respuesta": result.get("texto", ""),
        "modo_creador": result.get("modo_creador", False),
    }), 200


# ==========================================
# GENERAR TÍTULO PARA UNA CONVERSACIÓN
# ==========================================

@app.route("/generar_titulo", methods=["POST"])
def generar_titulo():
    data = request.get_json(silent=True) or {}

    message = str(
        data.get("mensaje", "")
    ).strip()[:500]

    if not message:
        return jsonify({
            "titulo": "Nuevo chat"
        }), 200

    try:
        result = preguntar(
            "Crea un título descriptivo de máximo 5 palabras "
            "para esta conversación. Devuelve solo el título, "
            "sin comillas. Tema: " + message
        )

        if isinstance(result, dict):
            title = str(
                result.get("respuesta", "Nuevo chat")
            )
        else:
            title = str(result or "Nuevo chat")

        title = re.sub(
            r"[\r\n\"'`]+",
            "",
            title,
        ).strip()[:70]

        return jsonify({
            "titulo": title or "Nuevo chat"
        }), 200

    except Exception:
        app.logger.exception(
            "No se pudo generar el título"
        )

        fallback = " ".join(message.split()[:5])[:70]

        return jsonify({
            "titulo": fallback or "Nuevo chat"
        }), 200


# ==========================================
# ERRORES DEL SERVIDOR
# ==========================================

@app.errorhandler(413)
def file_too_large(_error):
    return jsonify({
        "error": "El archivo o la solicitud supera el límite de 8 MB."
    }), 413


@app.errorhandler(404)
def not_found(_error):
    return jsonify({
        "error": "La ruta solicitada no existe."
    }), 404


# ==========================================
# EJECUCIÓN LOCAL
# RENDER UTILIZA GUNICORN
# ==========================================

if __name__ == "__main__":
    app.run(
        host="0.0.0.0",
        port=int(os.getenv("PORT", "5000")),
        debug=os.getenv("FLASK_DEBUG") == "1",
    )
