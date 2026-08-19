import os
from flask import Flask, render_template, request, jsonify
# Asegúrate de importar la función que tienes en tu archivo ai.brain.py
from ai.brain import preguntar 

# Configuramos la app para que reconozca la carpeta 'interface' y 'static'
app = Flask(__name__, template_folder='interface', static_folder='static')

@app.route("/")
def home():
    return render_template("index.html")

@app.route("/chat", methods=["POST"])
def chat():
    # Recibimos el mensaje de texto
    mensaje = request.form.get("mensaje", "")
    
    # Recibimos el archivo (imagen o PDF) si el usuario lo envió
    archivo = request.files.get("archivo")
    
    ruta_archivo = None
    if archivo:
        # Guardamos el archivo en una carpeta llamada 'uploads'
        if not os.path.exists("uploads"):
            os.makedirs("uploads")
        ruta_archivo = os.path.join("uploads", archivo.filename)
        archivo.save(ruta_archivo)

    # Procesamos la respuesta usando tu función de IA
    # Nota: Asegúrate de que tu función en ai.brain.py acepte el argumento de archivo
    respuesta = preguntar(mensaje) # Aquí puedes ajustar si necesitas pasar la ruta_archivo
    
    return jsonify({"respuesta": respuesta})

if __name__ == "__main__":
    app.run(debug=True)
