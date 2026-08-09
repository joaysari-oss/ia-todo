import os
import google.generativeai as genai

# Configuración de la API
api_key = os.getenv("GOOGLE_API_KEY")
genai.configure(api_key=api_key)

# Usar el cliente moderno o especificar la versión correcta
model = genai.GenerativeModel('gemini-1.5-flash')

def generate_response(prompt):
    response = model.generate_content(prompt)
    return response.text
