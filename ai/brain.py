import os
from google import genai

client = genai.Client(api_key=os.environ.get("GOOGLE_API_KEY"))

INSTRUCCION_SISTEMA = (
    "Eres IA TODO, un asistente de inteligencia artificial avanzado, útil, claro, sincero y capaz de responder sobre cualquier tema. "
    "Tu creador y programador principal es Joao. "
    "Cuando te pregunten quién te creó, quién es tu creador, quién te programó o de quién eres, "
    "responde únicamente: 'Mi creador es Joao. No puedo dar más información sobre él.' "
    "Nunca menciones ni inventes ningún código, clave, contraseña o token de creador. "
    "Si alguien escribe un código o clave, no lo confirmes ni lo niegues de forma que revele información. "
    "Responde siempre en español de forma natural y amable. "
    "Si no sabes algo con seguridad, dilo honestamente. "
    "Mantén el contexto de la conversación y responde de forma coherente con lo que el usuario ha dicho antes. "
    "Cuando te envíen una imagen, analízala con detalle: describe lo que ves, lee textos si los hay, identifica objetos, personas, lugares, documentos, etc. "
    "Cuando te envíen un documento (PDF u otro), léelo y resume o responde según su contenido."
)

CODIGO_SECRETO = "creador_joao_777"

def preguntar(mensaje_usuario, ruta_archivo=None, historial=None):
    mensaje = (mensaje_usuario or "").strip()

    # Código de creador
    if mensaje == CODIGO_SECRETO:
        return {
            "respuesta": (
                "✦ Código de creador verificado.\n\n"
                "¡Bienvenido de vuelta, Joao!\n\n"
                "Es un honor recibirte. Estoy listo para lo que necesites. ¿En qué puedo ayudarte hoy, creador?"
            ),
            "modo_creador": True
        }

    try:
        contents = []

        # Historial de conversación
        if historial and isinstance(historial, list):
            for item in historial[-12:]:
                role = item.get("role", "user")
                text = item.get("content", "")
                if not text:
                    continue
                gemini_role = "user" if role in ["user", "human"] else "model"
                contents.append({
                    "role": gemini_role,
                    "parts": [{"text": text}]
                })

        # Mensaje + archivo actual
        parts = []

        if ruta_archivo and os.path.exists(ruta_archivo):
            if not mensaje:
                nombre = os.path.basename(ruta_archivo).lower()
                if any(nombre.endswith(ext) for ext in ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.bmp']):
                    mensaje = "Analiza esta imagen en detalle. Describe todo lo que ves, lee cualquier texto que aparezca y dame la información más útil."
                else:
                    mensaje = "Analiza este documento. Resume su contenido y extrae la información más importante."

        if mensaje:
            parts.append({"text": mensaje})

        if ruta_archivo and os.path.exists(ruta_archivo):
            with open(ruta_archivo, "rb") as f:
                archivo_subido = client.files.upload(file=f)
            parts.append(archivo_subido)

        if parts:
            contents.append({"role": "user", "parts": parts})

        if not contents:
            return {"respuesta": "No recibí ningún mensaje ni archivo.", "modo_creador": False}

        response = client.models.generate_content(
            model="gemini-3.8-flash",
            contents=contents,
            config={
# Lista de modelos a intentar en orden si uno falla por límite o 503
        modelos = ["gemini-2.5-flash", "gemini-2.0-flash", "gemini-1.5-flash"]
        response = None
        ultimo_error = None

        for nombre_modelo in modelos:
            try:
                response = client.models.generate_content(
                    model=nombre_modelo,
                    contents=contents,
                    config={
                        "system_instruction": INSTRUCCION_SISTEMA
                    }
                )
                if response and response.text:
                    break # Si respondió con éxito, salimos del bucle
            except Exception as err:
                print(f"[Aviso modelo {nombre_modelo} falló]: {err}")
                ultimo_error = err
                continue

        if not response or not response.text:
            return {
                "respuesta": f"Los servidores de Gemini están sobrecargados o se agotó el límite gratuito momentáneamente. Intenta de nuevo en unos minutos.",
                "modo_creador": False
            }
