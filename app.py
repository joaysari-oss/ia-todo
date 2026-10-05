import os
import json
from flask import Flask, render_template, request, jsonify
from ai.brain import preguntar

app = Flask(__name__, template_folder='interface', static_folder='static')

@app.route("/")
def home():
    return render_template("index.html")

@app.route("/chat", methods=["POST"])
def chat():
    mensaje = request.form.get("mensaje", "")
    historial_raw = request.form.get("historial", "[]")

    try:
        historial = json.loads(historial_raw)
    except:
        historial = []

    archivo = request.files.get("archivo")
    ruta_archivo = None

    if archivo and archivo.filename:
        if not os.path.exists("uploads"):
            os.makedirs("uploads")
        ruta_archivo = os.path.join("uploads", archivo.filename)
        archivo.save(ruta_archivo)

    resultado = preguntar(mensaje, ruta_archivo=ruta_archivo, historial=historial)

    # Compatibilidad: si devuelve string (versión antigua) o dict (nueva)
    if isinstance(resultado, dict):
        return jsonify({
            "respuesta": resultado.get("respuesta", ""),
            "modo_creador": resultado.get("modo_creador", False)
        })
    else:
        return jsonify({
            "respuesta": resultado,
            "modo_creador": False
        })

if __name__ == "__main__":
    app.run(debug=True)
