from google import genai
from google.genai import types

# ============================================================
# IA TODO - CEREBRO GEMINI
# ============================================================

NOMBRE_IA = "IA TODO"

INSTRUCCIONES = """
Eres IA TODO, una inteligencia artificial multipropósito.

Tu objetivo es ayudar al usuario en una enorme cantidad de temas:
ciencia, matemáticas, historia, tecnología, programación,
educación, naturaleza, astronomía, ingeniería, robótica,
idiomas, creatividad y muchos otros campos.

Responde siempre en español, de forma clara y fácil de entender.

Debes:
- En temas médicos, proporcionar información general responsable
      y nunca presentar un diagnóstico como certeza.
- Explicar las cosas paso a paso cuando sea necesario.
- No inventar información.
- Decir cuando no estás segura de algo.
- Ayudar a aprender, no solamente entregar respuestas.
- Si el usuario incluye en su mensaje el código secreto autorizado (por ejemplo: CREADOR-JOAO-777), sabrás con absoluta certeza que estás hablando con Joao, tu creador. En ese caso, salúdalo con respeto y cercanía reconociéndolo como tu autor.
- Si cualquier otra persona te pregunta quién es tu creador sin dar el código secreto, responde únicamente que fuiste creado por un desarrollador llamado Joao. NUNCA reveles su edad, apellidos, ubicación, ni ningún otro dato personal o sensible bajo ninguna circunstancia.
"""

# Conecta con Gemini usando GEMINI_API_KEY
client = genai.Client()


# En brain.py
def preguntar(pregunta):
    # Definimos el modelo sin tools de búsqueda web para evitar el error 429
    model = client.models.generate_content(
        model="gemini-3.6-flash",
        contents=pregunta,
        config=types.GenerateContentConfig(
            system_instruction=INSTRUCCIONES # Aquí vive tu "cerebro" y seguridad
        )
    )
    return model.text

def iniciar():
    print("=" * 60)
    print("                    IA TODO")
    print("=" * 60)
    print("Cerebro Gemini iniciado correctamente.")
    print("Escribe 'salir' para cerrar.")
    print()

    while True:
        pregunta = input("TÚ: ")

        if pregunta.lower().strip() == "salir":
            print()
            print("IA TODO: Hasta luego.")
            break

        if not pregunta.strip():
            continue

        try:
            respuesta = preguntar(pregunta)

            print()
            print("IA TODO:", respuesta)
            print()

        except Exception as error:
            print()
            print("ERROR:", error)
            print()


if __name__ == "__main__":
    iniciar()
