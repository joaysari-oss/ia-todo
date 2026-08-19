import os
from flask import Flask, render_template, request, jsonify
from ai.brain import preguntar

# Así debería quedar la configuración en tu app.py
app = Flask(__name__, template_folder='interface', static_folder='static')

@app.route("/")
def home():
    return render_template("index.html")

@app.route("/chat", methods=["POST"])
def chat():
    data = request.get_json()
    mensaje = data.get("mensaje", "")
    try:
        respuesta = preguntar(mensaje)
    except Exception as e:
        print(f"Error de servidor: {e}")
        respuesta = "Lo siento, los servidores están muy ocupados en este momento. Intenta de nuevo en unos segundos."
    
    return jsonify({"respuesta": respuesta})

if __name__ == "__main__":
    port = int(os.environ.get("PORT", 5000))
    app.run(host="0.0.0.0", port=port)
