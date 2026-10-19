
import os
import logging
import requests
from bs4 import BeautifulSoup
from groq import Groq

# --------------------------------------------------
# CONFIGURACIÓN
# --------------------------------------------------

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("ia_todo")

GROQ_API_KEY = os.getenv("GROQ_API_KEY", "").strip()

TEXT_MODEL = os.getenv(
    "GROQ_TEXT_MODEL",
    "openai/gpt-oss-20b"
)

VISION_MODEL = os.getenv(
    "GROQ_VISION_MODEL",
    "meta-llama/llama-4-scout-17b-16e-instruct"
)

client = Groq(api_key=GROQ_API_KEY) if GROQ_API_KEY else None


# --------------------------------------------------
# BÚSQUEDA WEB GRATUITA
# --------------------------------------------------

PALABRAS_ACTUALIDAD = [
    "noticias", "noticia", "hoy", "actualidad",
    "último", "última", "últimos", "últimas",
    "reciente", "recientes", "ahora",
    "buscar en internet", "busca en internet",
    "en internet", "en la web", "precio actual",
    "resultado de hoy", "quién ganó", "quien ganó",
    "última hora", "últimas noticias"
]


def necesita_busqueda(mensaje):
    texto = (mensaje or "").lower()
    return any(p in texto for p in PALABRAS_ACTUALIDAD)


def buscar_web(consulta, max_resultados=5):
    url = "https://html.duckduckgo.com/html/"

    headers = {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/130 Safari/537.36"
    }

    try:
        respuesta = requests.post(
            url,
            data={"q": consulta},
            headers=headers,
            timeout=12
        )
        respuesta.raise_for_status()

        soup = BeautifulSoup(respuesta.text, "html.parser")
        resultados = []

        for item in soup.select(".result"):
            titulo_elemento = item.select_one(".result__title")
            resumen_elemento = item.select_one(".result__snippet")
            enlace_elemento = item.select_one(".result__title a")

            if not titulo_elemento:
                continue

            titulo = titulo_elemento.get_text(" ", strip=True)
            resumen = (
                resumen_elemento.get_text(" ", strip=True)
                if resumen_elemento else ""
            )
            enlace = (
                enlace_elemento.get("href", "")
                if enlace_elemento else ""
            )

            if titulo:
                resultados.append({
                    "titulo": titulo,
                    "resumen": resumen,
                    "enlace": enlace
                })

            if len(resultados) >= max_resultados:
                break

        return resultados

    except Exception as error:
        logger.warning("La búsqueda web falló: %s", error)
        return []


def preparar_resultados(resultados):
    if not resultados:
        return (
            "No se pudieron obtener resultados web. "
            "No inventes datos ni afirmes que consultaste internet. "
            "Aclara que no fue posible verificar la información reciente."
        )

    texto = (
        "RESULTADOS DE BÚSQUEDA WEB:\n"
        "Utiliza estos resultados como referencias. "
        "No inventes datos y aclara si falta información.\n\n"
    )

    for numero, resultado in enumerate(resultados, start=1):
        texto += (
            f"{numero}. {resultado['titulo']}\n"
            f"Resumen: {resultado['resumen']}\n"
            f"Enlace: {resultado['enlace']}\n\n"
        )

    return texto


# --------------------------------------------------
# PROCESAMIENTO DE IMÁGENES
# --------------------------------------------------

def preparar_imagen(imagen):
    if not imagen:
        return None

    if isinstance(imagen, dict):
        datos = imagen.get("data") or imagen.get("base64")
        tipo = (
            imagen.get("mime")
            or imagen.get("mime_type")
            or "image/jpeg"
        )

        if not isinstance(datos, str) or not datos.strip():
            return None

        if datos.startswith("data:"):
            url_imagen = datos
        else:
            url_imagen = f"data:{tipo};base64,{datos}"

        return {
            "type": "image_url",
            "image_url": {"url": url_imagen}
        }

    if isinstance(imagen, str) and imagen.startswith("data:image/"):
        return {
            "type": "image_url",
            "image_url": {"url": imagen}
        }

    return None


# --------------------------------------------------
# ASISTENTE PRINCIPAL
# --------------------------------------------------

def preguntar(
    mensaje_usuario,
    ruta_archivo=None,
    historial=None,
    imagen=None
):
    if client is None:
        return (
            "Falta configurar GROQ_API_KEY en las variables "
            "de entorno de Render. No publiques tu clave."
        )

    mensaje_usuario = str(mensaje_usuario or "").strip()

    if not isinstance(historial, list):
        historial = []

    mensajes = [
        {
            "role": "system",
            "content": (
                "Eres IA TODO, un asistente inteligente, útil y claro. "
                "Responde en español por defecto, salvo que el usuario "
                "pida otro idioma. Explica paso a paso cuando sea útil. "
                "No inventes datos, fuentes ni enlaces. "
                "Usa los resultados web proporcionados cuando existan. "
                "Si no pudiste verificar información actual, dilo claramente. "
                "Respeta el contexto de la conversación."
            )
        }
    ]

    # Agregar historial de manera segura.
    for elemento in historial[-20:]:
        if not isinstance(elemento, dict):
            continue

        rol = elemento.get("rol")
        texto = elemento.get("texto", "")

        if (
            rol in ("user", "assistant")
            and isinstance(texto, str)
            and texto.strip()
        ):
            mensajes.append({
                "role": rol,
                "content": texto[:10000]
            })

    # Buscar información reciente cuando sea necesario.
    if necesita_busqueda(mensaje_usuario):
        resultados = buscar_web(mensaje_usuario)
        mensajes.append({
            "role": "system",
            "content": preparar_resultados(resultados)
        })

    # Preparar el mensaje actual.
    contenido = []

    if mensaje_usuario:
        contenido.append({
            "type": "text",
            "text": mensaje_usuario
        })

    imagen_preparada = preparar_imagen(imagen)

    if imagen_preparada:
        contenido.append(imagen_preparada)

    if not contenido:
        contenido.append({
            "type": "text",
            "text": "Ayuda al usuario con su solicitud."
        })

    mensajes.append({
        "role": "user",
        "content": contenido
    })

    tiene_imagen = imagen_preparada is not None
    modelo = VISION_MODEL if tiene_imagen else TEXT_MODEL

    # Consultar Groq y mostrar errores comprensibles.
    try:
        respuesta = client.chat.completions.create(
            model=modelo,
            messages=mensajes,
            temperature=0.6,
            max_tokens=1800
        )

        texto = respuesta.choices[0].message.content

        if isinstance(texto, str) and texto.strip():
            return texto.strip()

        return "Groq respondió, pero no devolvió texto."

    except Exception as error:
        codigo = getattr(error, "status_code", None)
        logger.exception("Error al consultar Groq")

        if codigo == 401:
            return (
                "Error 401: Groq rechazó la clave API. "
                "Revisa GROQ_API_KEY en las variables de Render."
            )

        if codigo == 403:
            return (
                "Error 403: tu cuenta no tiene permiso para esta solicitud. "
                "Revisa las restricciones de Groq."
            )

        if codigo == 404:
            return (
                f"Error 404: el modelo '{modelo}' no está disponible "
                "o no tienes acceso a él. Revisa los modelos de Groq."
            )

        if codigo == 429:
            return (
                "Error 429: se alcanzó un límite de uso de Groq. "
                "Espera a que se restablezca o revisa la cuota de tu cuenta."
            )

        if codigo == 400:
            return (
                "Error 400: Groq rechazó el formato de la solicitud. "
                "Si enviaste una imagen, comprueba que el modelo de visión "
                "la admita."
            )

        if codigo and codigo >= 500:
            return (
                f"Error {codigo}: Groq tiene un problema temporal. "
                "Inténtalo de nuevo más tarde."
            )

        return (
            "No se pudo conectar con Groq. "
            "Revisa los registros de Render para conocer el error exacto."
        )
