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
    prompt = re.sub(
        r"^(por favor[, ]*)?(genera|generar|crea|crear|dibuja|dibújame|dibujame|hazme|haz)\s+"
        r"(una\s+)?(imagen|foto|ilustración|ilustracion|dibujo)?\s*(de|sobre)?\s*",
        "",
        prompt,
        flags=re.I
    )
    return prompt.strip(" .,:;!?¡¿") or message.strip()


def _make_image_url(prompt: str) -> str:
    # This provider may change access rules or availability; URL creation does not guarantee rendering.
    encoded = urllib.parse.quote(prompt[:1800], safe="")
    return (
        f"https://image.pollinations.ai/prompt/{encoded}"
        "?width=1024&height=1024&nologo=true"
    )


def _search_web(query: str, limit: int = 5) -> list:
    """Try DuckDuckGo HTML search without an API key; return an empty list if blocked."""
    query = query.strip()[:250]
    if not query:
        return []

    headers = {
        "User-Agent": "Mozilla/5.0 (compatible; IATODO/1.0; +https://github.com/joaysari-oss/ia-todo)"
    }

    try:
        response = requests.get(
            "https://html.duckduckgo.com/html/",
            params={"q": query},
            headers=headers,
            timeout=8
        )
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

            results.append({
                "title": title_node.get_text(" ", strip=True),
                "url": link_node.get("href", ""),
                "snippet": snippet_node.get_text(" ", strip=True) if snippet_node else ""
            })

        return results

    except Exception:
        return []


def _extract_web_query(message: str) -> Optional[str]:
    text = message.strip()
    patterns = (
        r"^(?:busca|búscame|buscame|investiga|consulta|averigua)\s+(?:en internet\s+)?(.+)$",
        r"^(?:qué hay de nuevo sobre|que hay de nuevo sobre|noticias sobre|información actual sobre|informacion actual sobre)\s+(.+)$",
    )

    for pattern in patterns:
        match = re.match(pattern, text, flags=re.I)
        if match:
            return match.group(1).strip()

    return None


def _call_model(messages, models, image=None):
    if client is None:
        raise RuntimeError(
            "Falta configurar GROQ_API_KEY en las variables de entorno del servidor."
        )

    last_error = None

    for model in models:
        try:
            model_messages = list(messages)

            if image:
                model_messages[-1] = {
                    "role": "user",
                    "content": [
                        {"type": "text", "text": model_messages[-1]["content"]},
                        {
                            "type": "image_url",
                            "image_url": {"url": image}
                        }
                    ]
                }

            response = client.chat.completions.create(
                model=model,
                messages=model_messages,
                temperature=0.6,
                max_tokens=2048
            )
            return response.choices[0].message.content or ""

        except Exception as error:
            last_error = error
            error_text = str(error).lower()

            # Try the next configured model if this model is unavailable.
            if any(term in error_text for term in (
                "model_decommissioned", "model_not_found", "unsupported",
                "does not support", "invalid_request_error", "404"
            )):
                continue

            # Don't keep retrying on quota, authentication or network failures.
            raise

    raise RuntimeError(f"No se pudo usar ningún modelo configurado: {last_error}")


def preguntar(mensaje, historial=None, imagen=None):
    mensaje = str(mensaje or "").strip()
    historial = historial if isinstance(historial, list) else []

    # Image generation is returned as Markdown so the frontend can display it in chat.
    if _is_image_request(mensaje):
        prompt = _image_prompt(mensaje)
        image_url = _make_image_url(prompt)
        return {
            "respuesta": (
                f"¡Aquí tienes la imagen que pediste!\n\n"
                f"![Imagen generada: {prompt}]({image_url})"
            ),
            "modo_creador": True
        }

    messages = [{"role": "system", "content": INSTRUCCION_SISTEMA}]

    for item in historial[-12:]:
        if not isinstance(item, dict):
            continue
        role = item.get("role", "user")
        content = item.get("content", "")
        if role not in ("user", "assistant") or not isinstance(content, str) or not content.strip():
            continue
        messages.append({"role": role, "content": content[:6000]})

    web_query = _extract_web_query(mensaje)
    if web_query:
        results = _search_web(web_query)
        if results:
            formatted = "\n".join(
                f"- {item['title']}\n  {item['url']}\n  {item['snippet']}"
                for item in results
            )
            messages.append({
                "role": "system",
                "content": "Resultados de búsqueda web. Resume con cuidado y cita los enlaces útiles:\n" + formatted
            })
        else:
            messages.append({
                "role": "system",
                "content": "La búsqueda web no devolvió resultados. No afirmes que has consultado internet."
            })

    messages.append({
        "role": "user",
        "content": mensaje or "Analiza la imagen adjunta y describe lo que observas."
    })

    if imagen:
        answer = _call_model(messages, VISION_MODELS, image=imagen)
    else:
        answer = _call_model(messages, TEXT_MODELS)

    return {"respuesta": answer, "modo_creador": False}
