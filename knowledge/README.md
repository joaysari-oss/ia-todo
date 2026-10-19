# IA TODO — actualización compatible

Esta carpeta contiene una versión actualizada de los archivos principales del proyecto Flask:

- `app.py`: servidor Flask, `/api/chat`, compatibilidad con `/chat`, `/health` y títulos.
- `ai/brain.py`: chat con Groq, análisis de imágenes con un modelo de visión configurable, búsqueda web básica y solicitud de generación de imagen embebida en Markdown.
- `interface/index.html`: interfaz oscura/morada responsive.
- `static/script.js`: historial local, voz, micrófono, adjuntar imágenes y documentos, y renderizado de imágenes generadas dentro del chat.
- `requirements.txt`, `Procfile`, `sw.js`, `interface/manifest.json`.

## Configuración del alojamiento

Configura `GROQ_API_KEY` como variable secreta del alojamiento. Opcionalmente puedes definir `GROQ_MODEL` y `GROQ_VISION_MODEL`. No escribas claves en el código ni las subas a GitHub.

Instalación local:

```bash
python -m venv .venv
# Windows: .venv\Scripts\activate
# macOS/Linux: source .venv/bin/activate
pip install -r requirements.txt
python app.py
