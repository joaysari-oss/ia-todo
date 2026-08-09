import os
import google.generativeai as genai

api_key = os.getenv("GOOGLE_API_KEY")
genai.configure(api_key=api_key)

# Usamos genai.GenerativeModel pero con el nombre exacto que reconoce la versión actual de la librería
model = genai.GenerativeModel('gemini-1.5-flash-latest')

def generate_response(prompt):
    response = model.generate_content(prompt)
    return response.text
