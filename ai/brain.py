import os
from google import genai
from google.genai.errors import ServerError

client = genai.Client()

def preguntar(mensaje_usuario, ruta_archivo=None):
    try:
        contenido = [mensaje_usuario] if mensaje_usuario else []
        
        if ruta_archivo and os.path.exists(ruta_archivo):
            with open(ruta_archivo, "rb") as f:
                archivo_subido = client.files.upload(file=f)
            contenido.append(archivo_subido)
        
        # Intento principal con la IA
        response = client.models.generate_content(
            model='gemini-3.6-flash',
            contents=contenido
        )
        
        if ruta_archivo and os.path.exists(ruta_archivo):
            os.remove(ruta_archivo)
            
        return response.text

    except Exception:
        # Si ocurre cualquier error (saturación, límite, red caída), 
        # saltamos automáticamente al respaldo local para que la app NUNCA se detenga.
        return respuesta_de_emergencia(mensaje_usuario)

def respuesta_de_emergencia(mensaje_usuario):
    # Verificamos si existe tu archivo local de respaldo
    if os.path.exists("noticias.txt"):
        with open("noticias.txt", "r", encoding="utf-8") as f:
            texto_respaldo = f.read()
        
        # Devolvemos la información limpia y directa para que el usuario siempre obtenga respuesta
        return f"{texto_respaldo}"
    
    return "El sistema está procesando tu solicitud. Por favor, intenta de nuevo en unos segundos."
