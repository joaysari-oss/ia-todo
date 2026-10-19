
import os
import requests
from bs4 import BeautifulSoup
from groq import Groq

# ==================================================
# CONFIGURACIÓN DE GROQ
# ==================================================

GROQ_API_KEY = os.getenv("GROQ_API_KEY")

client = Groq(api_key=GROQ_API_KEY) if GROQ_API_KEY else None

TEXT_MODEL = os.getenv(
    "GROQ_TEXT_MODEL",
    "llama-3.3-70b-versatile"
)

VISION_MODEL = os.getenv(
    "GROQ_VISION_MODEL",
    "meta-llama/llama-4-scout-17b-16e-instruct"
)


# ==================================================
# BÚSQUEDA WEB GRATUITA CON DUCKDUCKGO
# ==================================================

PALABRAS_ACTUALIDAD = [
    "noticias",
    "noticia",
    "hoy",
    "actualidad",
    "actual",
    "último",
    "última",
    "últimos",
    "últimas",
    "reciente",
    "recientes",
    "ahora",
    "buscar en internet",
    "busca en internet",
    "en internet",
    "en la web",
    "precio actual",
    "resultado de hoy",
    "quién ganó",
    "quien ganó"
]


def necesita_busqueda(mensaje):
    mensaje = (mensaje or "").lower()

    return any(
        palabra in mensaje
        for palabra in PALABRAS_ACTUALIDAD
    )


def buscar_web(consulta, max_resultados=5):
    """
    Busca resultados mediante la página HTML de DuckDuckGo.
    No necesita una clave de API adicional, pero puede tener límites.
    """

    url = "https://html.duckduckgo.com/html/"

    encabezados = {
        "User-Agent": (
            "Mozilla/5.0 "
            "(Windows NT 10.0; Win64; x64) "
            "AppleWebKit/537.36 Chrome/120 Safari/537.36"
        )
    }

    try:
        respuesta = requests.post(
            url,
            data={"q": consulta},
            headers=encabezados,
            timeout=12
        )

        respuesta.raise_for_status()

        soup = BeautifulSoup(
            respuesta.text,
            "html.parser"
        )

        resultados = []

        for resultado in soup.select(".result"):
            titulo_elemento = resultado.select_one(
                ".result__title"
            )

            resumen_elemento = resultado.select_one(
                ".result__snippet"
            )

            enlace_elemento = resultado.select_one(
                ".result__title a"
            )

            if not titulo_elemento:
                continue

            titulo = titulo_elemento.get_text(
                " ",
                strip=True
            )

            resumen = ""

            if resumen_elemento:
                resumen = resumen_elemento.get_text(
                    " ",
                    strip=True
                )

            enlace = ""

            if enlace_elemento:
                enlace = enlace_elemento.get("href", "")

            if titulo:
                resultados.append({
                    "titulo": titulo,
                    "resumen": resumen,
                    "enlace": enlace
                })

            if len(resultados) >= max_resultados:
                break

        return resultados

    except requests.RequestException:
        return []

    except Exception:
        return []


def preparar_resultados(resultados):
    if not resultados:
        return (
            "No se pudieron obtener resultados web. "
            "No inventes información ni afirmes haber "
            "consultado fuentes. Si la pregunta requiere "
            "datos recientes, explica que no fue posible "
            "verificarlos en internet."
        )

    texto = (
        "RESULTADOS DE BÚSQUEDA WEB:\n"
        "Utiliza estos datos como referencias, "
        "comprueba las fechas y no inventes información.\n\n"
    )

    for numero, resultado in enumerate(
        resultados,
        start=1
    ):
        texto += (
            f"{numero}. {resultado['titulo']}\n"
            f"Resumen: {resultado['resumen']}\n"
            f"Enlace: {resultado['enlace']}\n\n"
        )

    return texto


# ==================================================
# CEREBRO PRINCIPAL DE IA TODO
# ==================================================

def preguntar(
    mensaje_usuario,
    ruta_archivo=None,
    historial=None,
    imagen=None
):
    """
    Compatible con app.py:
    preguntar(mensaje_usuario, historial=..., imagen=...)
    """

    if client is None:
        return (
            "No encuentro la clave de Groq. "
            "Configura GROQ_API_KEY en las variables "
            "de entorno de Render."
        )

    mensaje_usuario = mensaje_usuario or ""

    if not isinstance(historial, list):
        historial = []

    mensajes = [
        {
            "role": "system",
            "content": (
                "Eres IA TODO, un asistente inteligente, "
                "útil y claro. Responde en español por "
                "defecto, salvo que te pidan otro idioma. "
                "Explica las cosas paso a paso cuando "
                "sea necesario. No inventes datos, "
                "enlaces ni fuentes. Cuando recibas "
                "resultados web, utiliza la información "
                "relevante y muestra los enlaces útiles. "
                "Si no hay resultados web, reconoce "
                "que no pudiste verificar la actualidad."
            )
        }
    ]

    # Añadir los mensajes anteriores de la conversación.
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

    # Consultar internet cuando la pregunta parece requerir
    # información reciente.
    if necesita_busqueda(mensaje_usuario):
        resultados = buscar_web(mensaje_usuario)

        mensajes.append({
            "role": "system",
            "content": preparar_resultados(resultados)
        })

    # Preparar el mensaje, con imagen opcional.
    contenido = []

    if mensaje_usuario.strip():
        contenido.append({
            "type": "text",
            "text": mensaje_usuario
        })

    imagen_data = imagen

    if isinstance(imagen_data, dict):
        datos_imagen = (
            imagen_data.get("data")
            or imagen_data.get("base64")
        )

        tipo_imagen = (
            imagen_data.get("mime")
            or imagen_data.get("mime_type")
            or "image/jpeg"
        )

        if isinstance(datos_imagen, str) and datos_imagen:
            if datos_imagen.startswith("data:"):
                if "," in datos_imagen:
                    datos_imagen = datos_imagen.split(
                        ",",
                        1
                    )[1]

            contenido.append({
                "type": "image_url",
                "image_url": {
                    "url": (
                        f"data:{tipo_imagen};base64,"
                        f"{datos_imagen}"
                    )
                }
            })

    elif (
        isinstance(imagen_data, str)
        and imagen_data.startswith("data:image/")
    ):
        contenido.append({
            "type": "image_url",
            "image_url": {
                "url": imagen_data
            }
        })

    if not contenido:
        contenido.append({
            "type": "text",
            "text": (
                "Ayuda al usuario con la información "
                "que haya proporcionado."
            )
        })

    mensajes.append({
        "role": "user",
        "content": contenido
    })

    # Seleccionar un modelo según el contenido.
    tiene_imagen = any(
        elemento.get("type") == "image_url"
        for elemento in contenido
    )

    modelo = VISION_MODEL if tiene_imagen else TEXT_MODEL

    try:
        respuesta = client.chat.completions.create(
            model=modelo,
            messages=mensajes,
            temperature=0.6,
            max_tokens=1800
        )

        texto_respuesta = (
            respuesta.choices[0].message.content
        )

        return texto_respuesta or (
            "No pude generar una respuesta."
        )

    except Exception:
        return (
            "No pude obtener una respuesta de Groq. "
            "Comprueba la clave GROQ_API_KEY, los límites "
            "de uso y que el modelo configurado siga "
            "disponible en tu cuenta."
        )
