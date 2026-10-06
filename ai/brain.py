import os
import time
import random
from google import genai
from google.genai.errors import APIError

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

        # Historial (últimas 12 interacciones)
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

        parts = []

        # Archivos (foto / documento)
        if ruta_archivo and os.path.exists(ruta_archivo):
            if not mensaje:
                nombre = os.path.basename(ruta_archivo).lower()
                if any(nombre.endswith(ext) for ext in [".jpg", ".jpeg", ".png", ".gif", ".webp", ".bmp"]):
                    mensaje = (
                        "Analiza esta imagen en detalle. Describe todo lo que ves, "
                        "lee cualquier texto que aparezca y dame la información más útil."
                    )
                else:
                    mensaje = (
                        "Analiza este documento. Resume su contenido y extrae "
                        "la información más importante."
                    )

            with open(ruta_archivo, "rb") as f:
                archivo_subido = client.files.upload(file=f)
            parts.append(archivo_subido)

        if mensaje:
            parts.append({"text": mensaje})

        if parts:
            contents.append({"role": "user", "parts": parts})

        if not contents:
            return {"respuesta": "No recibí ningún mensaje ni archivo.", "modo_creador": False}

        # Solo el modelo que te funciona
        modelos = ["gemini-3.8-flash"]

        # Pocos reintentos para no gastar cuota del plan gratis
        MAX_INTENTOS = 2
        TIEMPO_BASE = 1.0

        response = None
        ultimo_error = None

        for nombre_modelo in modelos:
            for intento in range(MAX_INTENTOS):
                try:
                    response = client.models.generate_content(
                        model=nombre_modelo,
                        contents=contents,
                        config={"system_instruction": INSTRUCCION_SISTEMA},
                    )
                    if response and getattr(response, "text", None):
                        break

                except APIError as err:
                    ultimo_error = str(err)
                    print(f"[Intento {intento + 1}/{MAX_INTENTOS}] APIError: {err}")
                    # Si es cuota (429), no reintentar mucho
                    if "429" in str(err) or "RESOURCE_EXHAUSTED" in str(err).upper():
                        break
                    if intento < MAX_INTENTOS - 1:
                        espera = TIEMPO_BASE * (2 ** intento) + random.uniform(0.3, 0.8)
                        time.sleep(espera)

                except Exception as err:
                    ultimo_error = str(err)
                    print(f"[Intento {intento + 1}/{MAX_INTENTOS}] Error: {err}")
                    if intento < MAX_INTENTOS - 1:
                        time.sleep(TIEMPO_BASE)

            if response and getattr(response, "text", None):
                break

        # Limpiar archivo temporal
        if ruta_archivo and os.path.exists(ruta_archivo):
            try:
                os.remove(ruta_archivo)
            except Exception:
                pass

        if response and getattr(response, "text", None):
            return {"respuesta": response.text.strip(), "modo_creador": False}

        # Mensajes claros según el error
        err = (ultimo_error or "").lower()
        if "429" in err or "resource_exhausted" in err or "quota" in err:
            msg = (
                "He alcanzado el límite temporal del plan gratuito de Gemini. "
                "Espera 1 o 2 minutos y vuelve a intentarlo."
            )
        elif "503" in err or "unavailable" in err:
            msg = (
                "Gemini está saturado en este momento. "
                "Intenta de nuevo en unos minutos."
            )
        elif "404" in err or "not found" in err:
            msg = (
                "El modelo no está disponible con esta clave. "
                "Revisa el nombre del modelo en la configuración."
            )
        else:
            msg = (
                "No pude obtener respuesta de Gemini ahora mismo. "
                "Espera un momento e inténtalo de nuevo."
            )

        return {"respuesta": msg, "modo_creador": False}

    except Exception as e:
        print(f"[Error general brain]: {e}")
        return {
            "respuesta": "Ocurrió un problema temporal al procesar la solicitud. Intenta de nuevo.",
            "modo_creador": False,
        }
