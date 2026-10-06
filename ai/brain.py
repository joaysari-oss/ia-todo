import os
import time
import random
import urllib.parse
from groq import Groq

client = Groq(api_key=os.environ.get("GROQ_API_KEY"))

INSTRUCCION_SISTEMA = (
    "Eres IA TODO, un asistente de inteligencia artificial avanzado, útil, claro, sincero y capaz de responder sobre cualquier tema "
    "y crear imágenes de alta resolución. "
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

def optimizar_prompt_ingles(descripcion_usuario):
    """
    Traduce y optimiza la solicitud del usuario al inglés 
    para obtener la mejor calidad en la generación de imágenes.
    """
    try:
        prompt_system = (
            "You are an expert AI image prompt generator. Convert the user's request "
            "into a detailed visual prompt in English for image generation models. "
            "Return ONLY the English prompt, nothing else."
        )

        completion = client.chat.completions.create(
            messages=[
                {"role": "system", "content": prompt_system},
                {"role": "user", "content": descripcion_usuario}
            ],
            model="llama-3.3-70b-versatile",
            temperature=0.7,
        )
        if completion and completion.choices:
            return completion.choices[0].message.content.strip()
    except Exception as e:
        print(f"[Error optimizando prompt de imagen]: {e}")
    return descripcion_usuario

def preguntar(mensaje_usuario, ruta_archivo=None, historial=None):
    mensaje = (mensaje_usuario or "").strip()

    # Verificación de código de creador
    if mensaje == CODIGO_SECRETO:
        return {
            "respuesta": (
                "✦ Código de creador verificado.\n\n"
                "¡Bienvenido de vuelta, Joao!\n\n"
                "Es un honor recibirte. Estoy listo para responder preguntas y generar imágenes de alta definición. "¿En qué puedo ayudarte hoy, creador?"
            ),
            "modo_creador": True
        }

    mensaje_lower = mensaje.lower()

    # 1. DETECCIÓN DE GENERACIÓN DE IMÁGENES
    palabras_clave_imagen = [
        "genera una imagen", "generar una imagen", "crea una imagen", "crear una imagen",
        "dibuja", "haz una imagen", "haz un dibujo", "dibuja un", "dibuja una",
        "imagen de", "foto de", "hazme un dibujo", "muéstrame una imagen de"
    ]
    if any(p in mensaje_lower for p in palabras_clave_imagen):
        prompt_imagen = optimizar_prompt_ingles(mensaje)
        prompt_encoded = urllib.parse.quote(prompt_imagen)
        url_imagen = f"https://image.pollinations.ai/prompt/{prompt_encoded}?width=1024&height=1024&model=flux&nologo=true"

        respuesta_markdown = (
            f"¡Claro! He creado esta imagen para ti:\n\n"
            f"![Imagen Generada por IA]({url_imagen})\n\n"
            f"---  \n"
            f"[📥 Descargar Imagen en alta resolución]({url_imagen})"
        )
        return {"respuesta": respuesta_markdown, "modo_creador": False}

    # 2. PROCESO NORMAL DE TEXTO CON GROQ
    try:
        messages = [{"role": "system", "content": INSTRUCCION_SISTEMA}]

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

        modelos_texto = [
            "llama-3.3-70b-versatile",
            "openai/gpt-oss-120b",
            "openai/gpt-oss-20b"
        ]
        
        response_text = None
        for nombre_modelo in modelos_texto:
            for intento in range(2):
                try:
                    chat_completion = client.chat.completions.create(
                        messages=messages,
                        model=nombre_modelo,
                        temperature=0.7,
                    )
                    if chat_completion and chat_completion.choices:
                        response_text = chat_completion.choices[0].message.content
                        break
                except Exception as err:
                    print(f"[Error en {nombre_modelo}]: {err}")
                    time.sleep(0.5)

            if response_text:
                break

        if response_text:
            return {"respuesta": response_text, "modo_creador": False}

        return {
            "respuesta": "El servicio de IA no respondió en este momento.",
            "modo_creador": False
        }

    except Exception as e:
        print(f"[Error general]: {e}")
        return {
            "respuesta": "Ocurrió un problema temporal al procesar la solicitud.",
            "modo_creador": False
        }
