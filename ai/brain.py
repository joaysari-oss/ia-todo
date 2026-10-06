import os
import time
import random
from groq import Groq

client = Groq(api_key=os.environ.get("GROQ_API_KEY"))

INSTRUCCION_SISTEMA = (
    "Eres IA TODO, un asistente de inteligencia artificial avanzado, útil, claro, sincero y capaz de responder sobre cualquier tema. "
    "Tu creador y programador principal es Joao. "
    "Cuando te pregunten quién te creó, quién es tu creador, quién te programó o de quién eres, "
    "responde únicamente: 'Mi creador es Joao. No puedo dar más información sobre él.' "
    "Nunca menciones ni inventes ningún código, clave, contraseña o token de creador. "
    "Si alguien escribe un código o clave, no lo confirmes ni lo niegues de forma que revele información. "
    "Responde siempre en español de forma natural y amable. "
    "Si no sabes algo con seguridad, dilo honestamente. "
    "Mantén el contexto de la conversación y responde de forma coherente con lo que el usuario ha dicho antes."
)

CODIGO_SECRETO = "creador_joao_777"

def preguntar(mensaje_usuario, ruta_archivo=None, historial=None):
    mensaje = (mensaje_usuario or "").strip()

    # Verificación del código de creador
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
        messages = [{"role": "system", "content": INSTRUCCION_SISTEMA}]

        # Cargar historial
        if historial and isinstance(historial, list):
            for item in historial[-12:]:
                role = item.get("role", "user")
                text = item.get("content", "")
                if not text:
                    continue
                groq_role = "user" if role in ["user", "human"] else "assistant"
                messages.append({"role": groq_role, "content": text})

        if mensaje:
            messages.append({"role": "user", "content": mensaje})

        if len(messages) == 1:
            return {"respuesta": "No recibí ningún mensaje.", "modo_creador": False}

        # Modelo gratuito y veloz de Groq
        modelo = "llama-3.3-70b-versatile"
        response = None

        MAX_INTENTOS = 3
        TIEMPO_BASE = 1.0

        for intento in range(MAX_INTENTOS):
            try:
                chat_completion = client.chat.completions.create(
                    messages=messages,
                    model=modelo,
                    temperature=0.7,
                )
                if chat_completion and chat_completion.choices:
                    response = chat_completion.choices[0].message.content
                    break
            except Exception as err:
                print(f"[Intento {intento + 1}/{MAX_INTENTOS} en Groq]: {err}")
                if intento < MAX_INTENTOS - 1:
                    espera = (TIEMPO_BASE * (2 ** intento)) + random.uniform(0.2, 0.8)
                    time.sleep(espera)

        if response:
            return {"respuesta": response, "modo_creador": False}

        return {
            "respuesta": "El servicio de IA no respondió en este momento. Intenta de nuevo en unos instantes.",
            "modo_creador": False
        }

    except Exception as e:
        print(f"[Error general brain]: {e}")
        return {
            "respuesta": "Ocurrió un problema temporal al procesar la solicitud.",
            "modo_creador": False
        }
