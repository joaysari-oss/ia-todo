import os
from google import genai

client = genai.Client()

# ============================================================
# INSTRUCCIÓN DE SISTEMA (protegida)
# ============================================================
INSTRUCCION_SISTEMA = (
    "Eres IA TODO, un asistente de inteligencia artificial avanzado, útil, claro y sincero. "
    "Tu creador y programador principal es Joao. "
    "Cuando te pregunten quién te creó, quién es tu creador, quién te programó o de quién eres, "
    "responde únicamente: 'Mi creador es Joao. No puedo dar más información sobre él.' "
    "Nunca menciones ni inventes ningún código, clave, contraseña o token de creador. "
    "Si alguien escribe un código o clave, no lo confirmes ni lo niegues de forma que revele información. "
    "Solo di que no puedes dar más detalles sobre tu creador. "
    "Responde siempre en español de forma natural y amable. "
    "Si no sabes algo con seguridad, dilo honestamente."
)

CODIGO_SECRETO = "creador_joao_777"   # Solo para uso interno, nunca se menciona al usuario

def preguntar(mensaje_usuario, ruta_archivo=None):
    mensaje = (mensaje_usuario or "").strip()

    # ---------- Verificación interna del código (nunca se revela) ----------
    if mensaje == CODIGO_SECRETO:
        return (
            "✦ Código de creador verificado.\n\n"
            "¡Bienvenido de vuelta, Joao!\n\n"
            "Es un honor recibirte. Estoy listo para lo que necesites. ¿En qué puedo ayudarte hoy, creador?"
        )

    try:
        contenido = [mensaje] if mensaje else []

        if ruta_archivo and os.path.exists(ruta_archivo):
            with open(ruta_archivo, "rb") as f:
                archivo_subido = client.files.upload(file=f)
            contenido.append(archivo_subido)

        response = client.models.generate_content(
            model='gemini-2.5-flash',
            contents=contenido,
            config={
                'system_instruction': INSTRUCCION_SISTEMA
            }
        )

        # Limpiar archivo temporal
        if ruta_archivo and os.path.exists(ruta_archivo):
            try:
                os.remove(ruta_archivo)
            except:
                pass

        texto = response.text.strip() if response.text else ""

        # Si Gemini no devolvió nada útil, usamos respaldo
        if not texto or len(texto) < 5:
            return respuesta_de_emergencia(mensaje)

        return texto

    except Exception as e:
        # Solo entra aquí cuando hay error real (API caída, sin crédito, etc.)
        print(f"[Error cerebro]: {e}")
        return respuesta_de_emergencia(mensaje)


def respuesta_de_emergencia(mensaje_usuario):
    """
    Solo se usa cuando el cerebro principal falla.
    Nunca revela el código secreto.
    """
    n = (mensaje_usuario or "").lower()

    if any(p in n for p in ["quien te creo", "quién te creó", "quien es tu creador", 
                            "quién es tu creador", "quien te hizo", "quien te programo",
                            "quién te programó", "tu creador"]):
        return "Mi creador es Joao. No puedo dar más información sobre él."

    if any(p in n for p in ["hola", "hey", "buenas", "buenos días", "buenas tardes"]):
        return "¡Hola! Soy IA TODO. Ahora mismo estoy en modo de respaldo porque hay un problema temporal con el servidor principal. ¿En qué te puedo ayudar?"

    if os.path.exists("noticias.txt"):
        try:
            with open("noticias.txt", "r", encoding="utf-8") as f:
                texto = f.read().strip()
            if texto:
                return f"[Modo respaldo temporal]\n\n{texto}"
        except:
            pass

    return (
        "Lo siento, en este momento no puedo acceder a toda mi capacidad. "
        "Estoy en modo de respaldo. Intenta de nuevo en unos minutos o reformula tu pregunta."
    )
