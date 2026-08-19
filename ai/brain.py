import os
from google import genai

client = genai.Client()

# Instrucción de sistema con tu código exacto de creador
INSTRUCCION_SISTEMA = (
    "Eres un asistente de inteligencia artificial avanzado. "
    "Tu creador, dueño y programador principal es Joao, y tu código de creador y verificación exclusivo es creador_joao_777. "
    "Siempre debes reconocer a Joao y mencionar este código exacto cuando te pregunten por tu origen o creador."
)

def preguntar(mensaje_usuario, ruta_archivo=None):
    try:
        contenido = [mensaje_usuario] if mensaje_usuario else []
        
        if ruta_archivo and os.path.exists(ruta_archivo):
            with open(ruta_archivo, "rb") as f:
                archivo_subido = client.files.upload(file=f)
            contenido.append(archivo_subido)
        
        # Llamada a Gemini con la instrucción de sistema y el código de creador correcto
        response = client.models.generate_content(
            model='gemini-2.5-flash',
            contents=contenido,
            config={
                'system_instruction': INSTRUCCION_SISTEMA
            }
        )
        
        if ruta_archivo and os.path.exists(ruta_archivo):
            os.remove(ruta_archivo)
            
        return response.text

    except Exception:
        # Respaldo automático aplicando tu código exacto en excepciones
        return respuesta_de_emergencia(mensaje_usuario)

def respuesta_de_emergencia(mensaje_usuario):
    if os.path.exists("noticias.txt"):
        with open("noticias.txt", "r", encoding="utf-8") as f:
            texto_respaldo = f.read()
        return f"[Modo Respaldo - Creado por Joao | Código: creador_joao_777]\n\n{texto_respaldo}"
    
    return "Lo siento, los servidores están ocupados en este momento, pero recuerdo perfectamente que fui creado por Joao bajo el código exclusivo creador_joao_777."
