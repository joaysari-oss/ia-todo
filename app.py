
import os
import logging
from flask import Flask, render_template, request, jsonify
from ai.brain import preguntar

logging.basicConfig(level=logging.INFO)
app = Flask(
    __name__,
    template_folder="interface",
    static_folder="static"
)

app.config["MAX_CONTENT_LENGTH"] = 10 * 1024 * 1024


@app.route("/")
def home():
    return render_template("index.html")


@app.route("/health")
def health():
    return jsonify({"status": "ok"})


@app.route("/api/chat", methods=["POST"])
def api_chat():
    try:
        datos = request.get_json(silent=True) or {}

        mensaje = str(datos.get("mensaje", "") or "").strip()
        historial = datos.get("historial", [])
        imagen = datos.get("imagen")

        if not isinstance(historial, list):
            historial = []

        if not mensaje and not imagen:
            return jsonify({
                "texto": "Escribe un mensaje o adjunta una imagen."
            }), 400

        respuesta = preguntar(
            mensaje_usuario=mensaje,
            historial=historial,
            imagen=imagen
        )

        return jsonify({"texto": respuesta})

    except Exception:
        app.logger.exception("Error en /api/chat")
        return jsonify({
            "texto": "Ocurrió un error en el servidor. Revisa los registros de Render."
        }), 500


@app.route("/chat", methods=["POST"])
def chat():
    return api_chat()


@app.route("/generar_titulo", methods=["POST"])
def generar_titulo():
    try:
        datos = request.get_json(silent=True) or {}
        mensaje = str(datos.get("mensaje", "") or "").strip()

        if not mensaje:
            return jsonify({"titulo": "Nueva conversación"})

        titulo = mensaje[:45]
        if len(mensaje) > 45:
            titulo += "..."

        return jsonify({"titulo": titulo})

    except Exception:
        app.logger.exception("Error al generar título")
        return jsonify({"titulo": "Nueva conversación"})


if __name__ == "__main__":
    app.run(
        host="0.0.0.0",
        port=int(os.environ.get("PORT", 5000))
    )
