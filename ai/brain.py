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
- Explicar las cosas paso a paso cuando sea necesario.
- No inventar información.
- Decir cuando no estás segura de algo.
- Ayudar a aprender, no solamente entregar respuestas.
- En temas médicos, proporcionar información general responsable
  y nunca presentar un diagnóstico como certeza.
"""

# Conecta con Gemini usando GEMINI_API_KEY
client = genai.Client()


# En brain.py
def preguntar(pregunta):
    # Definimos el modelo
    model = client.models.generate_content(
        model="gemini-3.6-flash",
        contents=pregunta,
        config=types.GenerateContentConfig(
            system_instruction=INSTRUCCIONES, # Aquí vive tu "cerebro"
            tools=[{"google_search": {}}]    # Aquí vive la búsqueda web
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
