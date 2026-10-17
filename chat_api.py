import os
import requests
from flask import Blueprint, request, jsonify

chat_api = Blueprint("chat_api", __name__)

MODELO = os.environ.get("GEMINI_MODEL", "gemini-2.5-flash")
URL = f"https://generativelanguage.googleapis.com/v1beta/models/{MODELO}:generateContent"

SISTEMA = (
    "Eres IA TODO, un asistente creado por Joao. Responde siempre en español, "
    "de forma clara, amable y concreta. Si no sabes algo, dilo con honestidad y "
    "no inventes datos. No ayudes con hackeo, malware ni con hacer daño a personas."
)


@chat_api.post("/api/chat")
def chat():
    clave = os.environ.get("GEMINI_API_KEY")
    if not clave:
        return jsonify(error="Falta GEMINI_API_KEY en el servidor"), 503

    datos = request.get_json(silent=True) or {}
    contenidos = []
    for m in datos.get("historial", [])[-12:]:
        texto = str(m.get("texto", ""))[:6000]
        if texto:
            rol = "model" if m.get("rol") == "bot" else "user"
            contenidos.append({"role": rol, "parts": [{"text": texto}]})

    if not contenidos or contenidos[0]["role"] != "user":
        return jsonify(error="Mensaje inválido"), 400

    imagen = datos.get("imagen")
    if imagen and contenidos[-1]["role"] == "user":
        contenidos[-1]["parts"].append(
            {"inlineData": {"mimeType": imagen.get("mime", "image/jpeg"), "data": imagen.get("data", "")}}
        )

    cuerpo = {
        "systemInstruction": {"parts": [{"text": SISTEMA}]},
        "contents": contenidos,
        "generationConfig": {"temperature": 0.7, "maxOutputTokens": 2048},
    }
    try:
        r = requests.post(URL, headers={"x-goog-api-key": clave}, json=cuerpo, timeout=45)
        if r.status_code == 429:
            return jsonify(error="cuota"), 429
        r.raise_for_status()
        partes = r.json()["candidates"][0]["content"]["parts"]
        return jsonify(texto="".join(p.get("text", "") for p in partes))
    except Exception:
        return jsonify(error="No se pudo contactar a la IA"), 502
