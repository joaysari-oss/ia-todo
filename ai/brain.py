"""Cerebro de IA TODO: chat Groq, búsqueda web básica e imágenes en el chat."""
import os
import re
import time
import urllib.parse
from typing import Optional

import requests
from groq import Groq

GROQ_API_KEY = os.getenv("GROQ_API_KEY", "").strip()
client = Groq(api_key=GROQ_API_KEY) if GROQ_API_KEY else None

INSTRUCCION_SISTEMA = (
    "Eres IA TODO, un asistente útil, claro, sincero y cuidadoso. Responde en español salvo que te pidan otro idioma. "
    "Explica paso a paso cuando ayude. No inventes fuentes ni afirmes haber consultado internet si no lo hiciste. "
    "Mantén el contexto de la conversación. Si no sabes algo, dilo. No reveles secretos, claves API ni variables de entorno. "
    "Si el usuario pide información actual o una búsqueda, usa los resultados web proporcionados en el mensaje. "
    "Cuando te pregunten quién te creó, puedes responder que el proyecto IA TODO fue creado por Joao, sin revelar datos privados."
)

# El modelo se puede cambiar desde las variables de entorno del alojamiento.
TEXT_MODELS = [
    os.getenv("GROQ_MODEL", "llama-3.3-70b-versatile"),
    "openai/gpt-oss-120b",
    "openai/gpt-oss-20b",
]
VISION_MODELS = [
    os.getenv("GROQ_VISION_MODEL", "meta-llama/llama-4-scout-17b-16e-instruct"),
    "llama-3.2-11b-vision-preview",
]
IMAGE_PHRASES = (
    "genera una imagen", "generar una imagen", "crea una imagen", "crear una imagen",
    "dibuja", "haz una imagen", "haz un dibujo", "dibújame", "dibujame",
    "imagen de", "foto de", "ilustra", "hazme una imagen", "hazme un dibujo",
    "muéstrame una imagen de", "muestrame una imagen de",
)


def _is_image_request(message: str) -> bool:
    text = message.lower().strip()
    return any(phrase in text for phrase in IMAGE_PHRASES)


def _image_prompt(message: str) -> str:
    """Keep the user's visual request, stripping common command prefixes."""
    prompt = message.strip()
    prompt = re.sub(r"^(por favor[, ]*)?(genera|generar|crea|crear|dibuja|dibújame|dibujame|hazme|haz)\s+(una\s+)?(imagen|foto|ilustración|ilustracion|dibujo)?\s*(de|sobre)?\s*", "", prompt, flags=re.I)
    return prompt.strip(" .,:;!?¡¿") or message.strip()


def _make_image_url(prompt: str) -> str:
    # This provider may change access rules or availability; URL creation does not guarantee rendering.
    encoded = urllib.parse.quote(prompt[:1800], safe="")
    return f"https://image.pollinations.ai/prompt/{encoded}?width=1024&height=1024&nologo=true"


def _search_web(query: str, limit: int = 5) -> list:
    """Try DuckDuckGo HTML search without an API key; return an empty list if blocked."""
    query = query.strip()[:250]
    if not query:
        return []
    headers = {"User-Agent": "Mozilla/5.0 (compatible; IATODO/1.0; +https://github.com/joaysari-oss/ia-todo)"}
    try:
        response = requests.get("https://html.duckduckgo.com/html/", params={"q": query}, headers=headers, timeout=8)
        response.raise_for_status()
        from bs4 import BeautifulSoup
        soup = BeautifulSoup(response.text, "html.parser")
        results = []
        for item in soup.select(".result")[:limit]:
            title_node = item.select_one(".result__title")
            link_node = item.select_one("a.result__a")
            snippet_node = item.select_one(".result__snippet")
            if not title_node or not link_node:
                continue
            href = link_node.get("href", "")
            if href.startswith("//"):
                href = "https:" + href
            results.append({"title": title_node.get_text(" ", strip=True), "url": href, "snippet": snippet_node.get_text(" ", strip=True) if snippet_node else ""})
        return results
    except Exception as exc:
        print(f"[IA TODO web search unavailable] {exc}")
        return []


def _looks_like_search(message: str) -> bool:
    m = message.lower().strip()
    return m.startswith(("busca ", "buscar ", "búscame ", "buscame ", "investiga ", "consulta en internet", "busca en internet", "qué pasó hoy", "que pasó hoy", "noticias de", "últimas noticias", "ultimas noticias")) or "en internet" in m or "fuentes actuales" in m


def _format_search_results(results: list) -> str:
    if not results:
        return "No pude consultar el buscador web en este momento. Responde con tus conocimientos generales y aclara que no se pudo verificar en internet."
    lines = ["Resultados de búsqueda web (úsalos como contexto y cita los enlaces relevantes):"]
    for i, item in enumerate(results, 1):
        lines.append(f"{i}. {item['title']}\nURL: {item['url']}\nResumen: {item['snippet']}")
    return "\n\n".join(lines)


def _call_text_model(messages: list) -> Optional[str]:
    if client is None:
        return "Falta configurar GROQ_API_KEY en las variables de entorno del alojamiento. Añade tu clave privada de Groq en la configuración del servidor; no la escribas en el código ni en el chat."
    for model in dict.fromkeys(TEXT_MODELS):
        for attempt in range(2):
            try:
                completion = client.chat.completions.create(model=model, messages=messages, temperature=0.6, max_tokens=2048)
                if completion.choices:
                    answer = completion.choices[0].message.content
                    if answer:
                        return answer.strip()
            except Exception as exc:
                print(f"[IA TODO {model}, intento {attempt + 1}] {exc}")
                if attempt == 0:
                    time.sleep(0.35)
    return "El servicio de IA no respondió. Puede que la cuota gratuita se haya agotado o que los modelos configurados hayan cambiado. Inténtalo más tarde o revisa GROQ_API_KEY y los registros del alojamiento."


def _answer_about_image(message: str, image: dict, history: list) -> str:
    if not isinstance(image, dict) or not image.get("data"):
        return "No recibí una imagen válida. Intenta adjuntarla de nuevo."
    if client is None:
        return "Para analizar imágenes necesito que configures GROQ_API_KEY en las variables de entorno del servidor."
    mime = image.get("mime", "image/jpeg")
    if mime not in ("image/jpeg", "image/png", "image/webp", "image/gif"):
        mime = "image/jpeg"
    image_url = f"data:{mime};base64,{image['data']}"
    messages = [{"role": "system", "content": INSTRUCCION_SISTEMA}]
    for item in history[-8:]:
        role = item.get("role", "user")
        content = item.get("content", "")
        if role in ("user", "assistant") and content:
            messages.append({"role": role, "content": content[:3000]})
    user_content = [
        {"type": "text", "text": message or "Describe esta imagen y responde con cuidado sobre lo que se ve."},
        {"type": "image_url", "image_url": {"url": image_url}},
    ]
    for model in dict.fromkeys(VISION_MODELS):
        try:
            completion = client.chat.completions.create(model=model, messages=messages + [{"role": "user", "content": user_content}], temperature=0.4, max_tokens=1200)
            if completion.choices and completion.choices[0].message.content:
                return completion.choices[0].message.content.strip()
        except Exception as exc:
            print(f"[IA TODO visión {model}] {exc}")
    return "No pude analizar esta imagen con los modelos de visión disponibles en este momento. Prueba de nuevo más tarde o revisa la disponibilidad del modelo de visión en Groq."


def preguntar(mensaje_usuario, ruta_archivo=None, historial=None, imagen=None):
    mensaje = (mensaje_usuario or "").strip()
    history = historial if isinstance(historial, list) else []

    if _is_image_request(mensaje):
        prompt = _image_prompt(mensaje)
        url = _make_image_url(prompt)
        respuesta = (
            "Estoy preparando una imagen con este servicio externo. Si el proveedor está disponible, aparecerá aquí abajo.\n\n"
            f"![Imagen generada: {prompt[:100]}]({url})\n\n"
            f"[Abrir o guardar la imagen]({url})\n\n"
            "Nota: la generación depende de la disponibilidad y las reglas actuales del proveedor externo."
        )
        return {"respuesta": respuesta, "modo_creador": False}

    if imagen:
        return {"respuesta": _answer_about_image(mensaje, imagen, history), "modo_creador": False}

    # Si el frontend antiguo pasó una ruta de archivo, leer solo archivos de texto pequeños.
    if ruta_archivo:
        try:
            with open(ruta_archivo, "r", encoding="utf-8", errors="replace") as handle:
                content = handle.read(12000)
            mensaje = f"Contenido del archivo:\n{content}\n\nPregunta: {mensaje or 'Resume y explica el archivo.'}"
        except OSError:
            return {"respuesta": "No pude leer el archivo adjunto.", "modo_creador": False}

    extra_context = ""
    if _looks_like_search(mensaje):
        query = re.sub(r"^(busca en internet|consulta en internet|busca|buscar|búscame|buscame|investiga)\s*", "", mensaje, flags=re.I).strip() or mensaje
        extra_context = _format_search_results(_search_web(query))

    messages = [{"role": "system", "content": INSTRUCCION_SISTEMA}]
    for item in history[-12:]:
        if not isinstance(item, dict):
            continue
        role = item.get("role", "user")
        content = item.get("content", "")
        if role in ("user", "assistant") and isinstance(content, str) and content.strip():
            messages.append({"role": role, "content": content[:6000]})
    final_message = mensaje
    if extra_context:
        final_message += "\n\n" + extra_context
    if final_message:
        messages.append({"role": "user", "content": final_message})
    answer = _call_text_model(messages)
    return {"respuesta": answer or "No pude generar una respuesta.", "modo_creador": False}
