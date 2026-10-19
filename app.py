
import os
import secrets

from flask import Flask, render_template, request, jsonify, session
from ai.brain import preguntar

app = Flask(
    __name__,
    template_folder="interface",
    static_folder="static"
)

app.secret_key = os.getenv("FLASK_SECRET_KEY") or secrets.token_hex(32)


@app.route("/")
def home():
    return render_template("index.html")


@app.route("/health")
def health():
    return jsonify({"ok": True})


def limpiar_historial(historial):
    if not isinstance(historial, list):
        return []

    limpio = []

    for mensaje in historial[-20:]:
        if not isinstance(mensaje, dict):
            continue

        rol = mensaje.get("rol")
        texto = mensaje.get("texto", "")

        if rol in ("user", "assistant") and isinstance(texto, str):
            limpio.append({
                "rol": rol,
                "texto": texto[:10000]
            })

    return limpio


@app.route("/api/chat", methods=["POST"])
def api_chat():
    datos = request.get_json(silent=True) or {}

    mensaje = str(datos.get("mensaje", "")).strip()
    historial = limpiar_historial(datos.get("historial", []))
    imagen = datos.get("imagen")

    codigo_creador = os.getenv(
        "CREATOR_CODE",
        "creador_joao_777"
    )

    # El código se verifica en el servidor.
    if mensaje == codigo_creador:
        session["modo_creador"] = True

        return jsonify({
            "texto": "⭐ ¡Modo creador activado!",
            "modo_creador": True
        })

    if mensaje.lower() in (
        "salir del modo creador",
        "/salir_creador"
    ):
        session["modo_creador"] = False

        return jsonify({
            "texto": "Modo creador desactivado.",
            "modo_creador": False
        })

    if not mensaje and not imagen:
        return jsonify({
            "texto": "Escribe un mensaje o adjunta una imagen."
        }), 400

    try:
        respuesta = preguntar(
            mensaje_usuario=mensaje,
            historial=historial,
            imagen=imagen
        )

        return jsonify({
            "texto": str(respuesta),
            "modo_creador": bool(
                session.get("modo_creador", False)
            )
        })

    except Exception:
        app.logger.exception("Error en /api/chat")

        return jsonify({
            "texto": (
                "Ocurrió un error al responder. "
                "Revisa los registros de Render."
            )
        }), 500


if __name__ == "__main__":
    app.run(
        host="0.0.0.0",
        port=int(os.getenv("PORT", "5000")),
        debug=False
    )
