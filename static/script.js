
"use strict";

/* =========================================================
   IA TODO — CONFIGURACIÓN
   Puedes cambiar el código de creador aquí.
   ========================================================= */

const CODIGO_CREADOR = "creador_joao_777";
const NOMBRE_CREADOR = "João";
const CLAVE_HISTORIAL = "iatodo_chats_v2";
const MAX_IMAGEN_MB = 5;
const MAX_ARCHIVO_MB = 1;

/* =========================================================
   ELEMENTOS DE LA INTERFAZ
   ========================================================= */

const $ = (id) => document.getElementById(id);

const elementos = {
    sidebar: $("sidebar"),
    nuevoChat: $("nuevoChat"),
    listaChats: $("listaChats"),
    menuBtn: $("menuBtn"),
    estado: $("estado"),
    mensajes: $("mensajes"),
    mensaje: $("mensaje"),
    archivoNombre: $("archivoNombre"),
    fotoBtn: $("fotoBtn"),
    archivoBtn: $("archivoBtn"),
    dictarBtn: $("dictarBtn"),
    leerBtn: $("leerBtn"),
    compartirBtn: $("compartirBtn"),
    borrarAdjuntoBtn: $("borrarAdjuntoBtn"),
    enviarBtn: $("enviarBtn"),
    imagenInput: $("imagenInput"),
    archivoInput: $("archivoInput")
};

let chats = [];
let chatActualId = null;
let imagenAdjunta = null;
let textoArchivoAdjunto = "";
let nombreArchivoAdjunto = "";
let enviando = false;
let ultimoTextoAsistente = "";
let reconocimientoVoz = null;

/* =========================================================
   UTILIDADES
   ========================================================= */

function crearId() {
    if (window.crypto && typeof window.crypto.randomUUID === "function") {
        return window.crypto.randomUUID();
    }

    return Date.now().toString(36) +
        Math.random().toString(36).slice(2);
}

function obtenerChatActual() {
    return chats.find(chat => chat.id === chatActualId) || null;
}

function guardarChats() {
    try {
        localStorage.setItem(CLAVE_HISTORIAL, JSON.stringify(chats));
    } catch (error) {
        console.error("No se pudo guardar el historial:", error);
        mostrarEstado("No se pudo guardar el historial en este navegador.");
    }
}

function cargarChats() {
    try {
        const guardado = localStorage.getItem(CLAVE_HISTORIAL);
        const datos = guardado ? JSON.parse(guardado) : [];

        if (!Array.isArray(datos)) {
            chats = [];
            return;
        }

        chats = datos
            .filter(chat => chat && typeof chat === "object")
            .map(chat => ({
                id: String(chat.id || crearId()),
                titulo: String(chat.titulo || "Nueva conversación"),
                mensajes: Array.isArray(chat.mensajes)
                    ? chat.mensajes.filter(m =>
                        m &&
                        (m.rol === "user" || m.rol === "assistant") &&
                        typeof m.texto === "string"
                    )
                    : [],
                fecha: Number(chat.fecha) || Date.now(),
                actualizado: Number(chat.actualizado) || Date.now()
            }));
    } catch (error) {
        console.error("Error leyendo el historial:", error);
        chats = [];
    }
}

function mostrarEstado(texto) {
    if (elementos.estado) {
        elementos.estado.textContent = texto;
    }
}

function escaparHTML(texto) {
    return String(texto)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}

function limitarTitulo(texto) {
    const limpio = String(texto || "")
        .replace(/\s+/g, " ")
        .trim();

    if (!limpio) return "Nueva conversación";

    return limpio.length > 42
        ? limpio.slice(0, 42) + "…"
        : limpio;
}

function desplazarAbajo() {
    if (elementos.mensajes) {
        elementos.mensajes.scrollTop = elementos.mensajes.scrollHeight;
    }
}

/* =========================================================
   PANTALLA DE BIENVENIDA
   Aparece al iniciar y cada vez que se crea un chat nuevo.
   ========================================================= */

function mostrarBienvenida() {
    if (!elementos.mensajes) return;

    elementos.mensajes.innerHTML = `
        <section class="bienvenida-ia">
            <div class="icono-bienvenida" aria-hidden="true">✦</div>

            <h1>Hola, bienvenido a IA TODO</h1>

            <p class="texto-bienvenida">
                Tu espacio para aprender, crear, investigar y resolver
                tus dudas. ¿Qué vamos a descubrir hoy?
            </p>

            <div class="tarjetas-bienvenida">
                <button type="button" class="tarjeta-bienvenida"
                    data-sugerencia="Explícame un tema paso a paso.">
                    <span class="emoji-tarjeta">📚</span>
                    <strong>Aprende algo nuevo</strong>
                    <span>Entiende cualquier tema paso a paso.</span>
                </button>

                <button type="button" class="tarjeta-bienvenida"
                    data-sugerencia="Dame ideas originales para mis proyectos.">
                    <span class="emoji-tarjeta">💡</span>
                    <strong>Inspírate y crea</strong>
                    <span>Encuentra ideas para tus proyectos.</span>
                </button>

                <button type="button" class="tarjeta-bienvenida"
                    data-sugerencia="Ayúdame a investigar un tema y encontrar información actual.">
                    <span class="emoji-tarjeta">🌐</span>
                    <strong>Explora información</strong>
                    <span>Investiga temas y actualidad.</span>
                </button>

                <button type="button" class="tarjeta-bienvenida"
                    data-sugerencia="Ayúdame a programar, diseñar o construir un proyecto.">
                    <span class="emoji-tarjeta">🚀</span>
                    <strong>Construye algo increíble</strong>
                    <span>Programa, diseña y experimenta.</span>
                </button>
            </div>
        </section>
    `;

    elementos.mensajes.querySelectorAll("[data-sugerencia]")
        .forEach(tarjeta => {
            tarjeta.addEventListener("click", () => {
                if (!elementos.mensaje) return;

                elementos.mensaje.value =
                    tarjeta.getAttribute("data-sugerencia") || "";

                elementos.mensaje.focus();
                ajustarAlturaTexto();
            });
        });
}

/* =========================================================
   MOSTRAR MENSAJES DE UNA CONVERSACIÓN
   ========================================================= */

function agregarMensajeVisual(rol, texto) {
    const contenedor = document.createElement("div");
    contenedor.className = "mensaje-chat " +
        (rol === "user" ? "mensaje-usuario" : "mensaje-asistente");

    const etiqueta = document.createElement("div");
    etiqueta.className = "etiqueta-mensaje";
    etiqueta.textContent = rol === "user" ? "Tú" : "IA TODO";

    const contenido = document.createElement("div");
    contenido.className = "contenido-mensaje";
    contenido.textContent = String(texto || "");

    contenedor.appendChild(etiqueta);
    contenedor.appendChild(contenido);
    elementos.mensajes.appendChild(contenedor);
}

function mostrarMensajesChat(chat) {
    if (!elementos.mensajes) return;

    if (!chat || !Array.isArray(chat.mensajes) ||
        chat.mensajes.length === 0) {
        mostrarBienvenida();
        return;
    }

    elementos.mensajes.innerHTML = "";

    chat.mensajes.forEach(mensaje => {
        agregarMensajeVisual(mensaje.rol, mensaje.texto);

        if (mensaje.rol === "assistant") {
            ultimoTextoAsistente = mensaje.texto;
        }
    });

    desplazarAbajo();
}

function actualizarInterfazHistorial() {
    if (!elementos.listaChats) return;

    elementos.listaChats.innerHTML = "";

    const ordenados = [...chats].sort(
        (a, b) => (b.actualizado || b.fecha) - (a.actualizado || a.fecha)
    );

    if (ordenados.length === 0) {
        const vacio = document.createElement("div");
        vacio.className = "historial-vacio";
        vacio.textContent = "Tus conversaciones aparecerán aquí.";
        elementos.listaChats.appendChild(vacio);
        return;
    }

    ordenados.forEach(chat => {
        const fila = document.createElement("div");
        fila.className = "fila-chat";

        if (chat.id === chatActualId) {
            fila.classList.add("chat-seleccionado");
        }

        const abrir = document.createElement("button");
        abrir.type = "button";
        abrir.className = "abrir-chat";
        abrir.textContent = chat.titulo;
        abrir.title = chat.titulo;
        abrir.addEventListener("click", () => abrirChat(chat.id));

        const borrar = document.createElement("button");
        borrar.type = "button";
        borrar.className = "borrar-chat";
        borrar.textContent = "×";
        borrar.title = "Eliminar esta conversación";
        borrar.setAttribute("aria-label", "Eliminar " + chat.titulo);

        borrar.addEventListener("click", event => {
            event.stopPropagation();
            eliminarChat(chat.id);
        });

        fila.appendChild(abrir);
        fila.appendChild(borrar);
        elementos.listaChats.appendChild(fila);
    });
}

/* =========================================================
   CREAR, ABRIR Y ELIMINAR CONVERSACIONES
   ========================================================= */

function nuevaConversacion() {
    detenerLectura();

    chatActualId = null;
    ultimoTextoAsistente = "";
    imagenAdjunta = null;
    textoArchivoAdjunto = "";
    nombreArchivoAdjunto = "";

    limpiarAdjuntoVisual();
    if (elementos.mensaje) elementos.mensaje.value = "";

    mostrarBienvenida();
    actualizarInterfazHistorial();
    mostrarEstado("Nueva conversación");
    ajustarAlturaTexto();

    if (elementos.sidebar && window.innerWidth <= 800) {
        elementos.sidebar.classList.remove("abierto");
    }

    if (elementos.mensaje) elementos.mensaje.focus();
}

function abrirChat(id) {
    detenerLectura();

    const chat = chats.find(item => item.id === id);
    if (!chat) return;

    chatActualId = id;
    imagenAdjunta = null;
    textoArchivoAdjunto = "";
    nombreArchivoAdjunto = "";

    limpiarAdjuntoVisual();

    if (elementos.mensaje) elementos.mensaje.value = "";

    mostrarMensajesChat(chat);
    actualizarInterfazHistorial();
    mostrarEstado("Conversación abierta");
    ajustarAlturaTexto();

    if (elementos.sidebar && window.innerWidth <= 800) {
        elementos.sidebar.classList.remove("abierto");
    }
}

function eliminarChat(id) {
    const chat = chats.find(item => item.id === id);
    if (!chat) return;

    const confirmar = window.confirm(
        `¿Quieres eliminar la conversación "${chat.titulo}"?`
    );

    if (!confirmar) return;

    chats = chats.filter(item => item.id !== id);

    if (chatActualId === id) {
        chatActualId = null;
        ultimoTextoAsistente = "";
        mostrarBienvenida();
        mostrarEstado("Conversación eliminada");
    }

    guardarChats();
    actualizarInterfazHistorial();
}

function asegurarChat(textoInicial) {
    let chat = obtenerChatActual();

    if (!chat) {
        chat = {
            id: crearId(),
            titulo: limitarTitulo(textoInicial),
            mensajes: [],
            fecha: Date.now(),
            actualizado: Date.now()
        };

        chats.push(chat);
        chatActualId = chat.id;
    } else if (!chat.mensajes.length) {
        chat.titulo = limitarTitulo(textoInicial);
    }

    return chat;
}

/* =========================================================
   PREGUNTAS SOBRE EL CREADOR
   ========================================================= */

function esPreguntaSobreCreador(texto) {
    const t = String(texto || "")
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .toLowerCase();

    const preguntaCreador =
        /(quien|quienes|por quien|por quienes).{0,70}(creo|creado|creada|desarrollo|desarrollado|hizo|fabrico|programo|fund[oó]|es el creador|es su creador)/.test(t) ||
        /(quien te creo|quien te hizo|quien te desarrollo|quien creo ia todo|quien hizo ia todo|quien es tu creador|quien te programo|quien esta detras de ia todo|de quien es ia todo)/.test(t);

    return preguntaCreador;
}

function respuestaCreador() {
    return `IA TODO fue creado por ${NOMBRE_CREADOR}. No puedo dar más información sobre el creador.`;
}

/* =========================================================
   ADJUNTAR IMÁGENES Y ARCHIVOS
   ========================================================= */

function limpiarAdjuntoVisual() {
    if (elementos.archivoNombre) {
        elementos.archivoNombre.textContent = "";
        elementos.archivoNombre.style.display = "none";
    }

    if (elementos.borrarAdjuntoBtn) {
        elementos.borrarAdjuntoBtn.style.display = "none";
    }

    if (elementos.imagenInput) elementos.imagenInput.value = "";
    if (elementos.archivoInput) elementos.archivoInput.value = "";
}

function actualizarAdjuntoVisual(nombre) {
    if (elementos.archivoNombre) {
        elementos.archivoNombre.textContent = "Adjunto: " + nombre;
        elementos.archivoNombre.style.display = "inline-block";
    }

    if (elementos.borrarAdjuntoBtn) {
        elementos.borrarAdjuntoBtn.style.display = "inline-flex";
    }
}

function quitarAdjunto() {
    imagenAdjunta = null;
    textoArchivoAdjunto = "";
    nombreArchivoAdjunto = "";
    limpiarAdjuntoVisual();
    mostrarEstado("Archivo adjunto eliminado");
}

function leerArchivoComoDataURL(archivo) {
    return new Promise((resolve, reject) => {
        const lector = new FileReader();

        lector.onload = () => resolve(lector.result);
        lector.onerror = () => reject(new Error("No se pudo leer la imagen."));
        lector.readAsDataURL(archivo);
    });
}

async function seleccionarImagen(event) {
    const archivo = event.target.files && event.target.files[0];
    if (!archivo) return;

    const limite = MAX_IMAGEN_MB * 1024 * 1024;

    if (!archivo.type.startsWith("image/")) {
        mostrarEstado("Selecciona un archivo de imagen.");
        event.target.value = "";
        return;
    }

    if (archivo.size > limite) {
        mostrarEstado(`La imagen debe pesar menos de ${MAX_IMAGEN_MB} MB.`);
        event.target.value = "";
        return;
    }

    try {
        const dataURL = await leerArchivoComoDataURL(archivo);

        imagenAdjunta = {
            mime: archivo.type || "image/jpeg",
            data: String(dataURL).split(",")[1]
        };

        textoArchivoAdjunto = "";
        nombreArchivoAdjunto = archivo.name;

        actualizarAdjuntoVisual(archivo.name);
        mostrarEstado("Imagen adjunta");
    } catch (error) {
        console.error(error);
        mostrarEstado("No se pudo leer la imagen.");
    }
}

async function seleccionarArchivo(event) {
    const archivo = event.target.files && event.target.files[0];
    if (!archivo) return;

    const limite = MAX_ARCHIVO_MB * 1024 * 1024;

    if (archivo.size > limite) {
        mostrarEstado(`El archivo debe pesar menos de ${MAX_ARCHIVO_MB} MB.`);
        event.target.value = "";
        return;
    }

    const tiposPermitidos = [
        ".txt", ".md", ".csv", ".json", ".js", ".py",
        ".html", ".css", ".xml", ".log"
    ];

    const nombre = archivo.name.toLowerCase();
    const permitido = tiposPermitidos.some(ext => nombre.endsWith(ext));

    if (!permitido && !archivo.type.startsWith("text/")) {
        mostrarEstado(
            "Este lector admite archivos de texto, código, CSV y JSON. " +
            "PDF y Word requieren extracción de texto adicional."
        );
        event.target.value = "";
        return;
    }

    try {
        textoArchivoAdjunto = await archivo.text();
        nombreArchivoAdjunto = archivo.name;
        imagenAdjunta = null;

        actualizarAdjuntoVisual(archivo.name);
        mostrarEstado("Archivo de texto adjunto");
    } catch (error) {
        console.error(error);
        mostrarEstado("No se pudo leer el archivo.");
    }
}

/* =========================================================
   ENVÍO DE MENSAJES
   ========================================================= */

async function enviarMensaje() {
    if (enviando) return;

    const textoOriginal = elementos.mensaje
        ? elementos.mensaje.value.trim()
        : "";

    if (!textoOriginal && !imagenAdjunta && !textoArchivoAdjunto) {
        mostrarEstado("Escribe un mensaje o adjunta un archivo.");
        return;
    }

    let textoParaEnviar = textoOriginal;

    if (textoArchivoAdjunto) {
        textoParaEnviar +=
            `\n\nContenido del archivo "${nombreArchivoAdjunto}":\n` +
            textoArchivoAdjunto.slice(0, 30000);
    }

    const textoVisible = textoOriginal ||
        (imagenAdjunta ? "Analiza esta imagen, por favor." : "Analiza este archivo, por favor.");

    const chat = asegurarChat(textoVisible);

    chat.mensajes.push({
        rol: "user",
        texto: textoVisible
    });

    chat.actualizado = Date.now();

    if (elementos.mensajes) {
        if (!elementos.mensajes.querySelector(".mensaje-chat")) {
            elementos.mensajes.innerHTML = "";
        }

        agregarMensajeVisual("user", textoVisible);

        if (imagenAdjunta) {
            const nota = document.createElement("div");
            nota.className = "nota-adjunto";
            nota.textContent = "Imagen adjunta: " + nombreArchivoAdjunto;
            elementos.mensajes.appendChild(nota);
        }

        if (textoArchivoAdjunto) {
            const nota = document.createElement("div");
            nota.className = "nota-adjunto";
            nota.textContent = "Archivo adjunto: " + nombreArchivoAdjunto;
            elementos.mensajes.appendChild(nota);
        }
    }

    if (elementos.mensaje) elementos.mensaje.value = "";

    const imagenParaEnviar = imagenAdjunta
        ? { ...imagenAdjunta }
        : null;

    imagenAdjunta = null;
    textoArchivoAdjunto = "";
    nombreArchivoAdjunto = "";
    limpiarAdjuntoVisual();

    guardarChats();
    actualizarInterfazHistorial();
    ajustarAlturaTexto();
    desplazarAbajo();

    /* Respuesta controlada para la pregunta sobre el creador. */
    if (esPreguntaSobreCreador(textoOriginal)) {
        const respuesta = respuestaCreador();

        chat.mensajes.push({
            rol: "assistant",
            texto: respuesta
        });

        chat.actualizado = Date.now();
        ultimoTextoAsistente = respuesta;

        agregarMensajeVisual("assistant", respuesta);
        guardarChats();
        actualizarInterfazHistorial();
        desplazarAbajo();
        mostrarEstado("Listo para ayudarte");
        return;
    }

    const historial = chat.mensajes
        .slice(0, -1)
        .slice(-20)
        .map(m => ({
            rol: m.rol,
            texto: m.texto
        }));

    enviando = true;

    if (elementos.enviarBtn) {
        elementos.enviarBtn.disabled = true;
        elementos.enviarBtn.textContent = "Enviando…";
    }

    mostrarEstado("IA TODO está pensando…");

    const indicador = document.createElement("div");
    indicador.className = "mensaje-chat mensaje-asistente indicador-espera";
    indicador.textContent = "IA TODO está preparando tu respuesta…";

    if (elementos.mensajes) {
        elementos.mensajes.appendChild(indicador);
        desplazarAbajo();
    }

    try {
        const respuestaHTTP = await fetch("/api/chat", {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                mensaje: textoParaEnviar,
                historial: historial,
                imagen: imagenParaEnviar
            })
        });

        let datos = {};

        try {
            datos = await respuestaHTTP.json();
        } catch {
            throw new Error("El servidor devolvió una respuesta no válida.");
        }

        if (!respuestaHTTP.ok) {
            throw new Error(
                datos.texto || `Error del servidor (${respuestaHTTP.status}).`
            );
        }

        const respuesta = String(
            datos.texto || "No recibí una respuesta de la IA."
        );

        if (indicador.parentNode) indicador.remove();

        chat.mensajes.push({
            rol: "assistant",
            texto: respuesta
        });

        chat.actualizado = Date.now();
        ultimoTextoAsistente = respuesta;

        agregarMensajeVisual("assistant", respuesta);

        guardarChats();
        actualizarInterfazHistorial();
        mostrarEstado("Lista para ayudarte");
        desplazarAbajo();
    } catch (error) {
        console.error("Error enviando el mensaje:", error);

        if (indicador.parentNode) indicador.remove();

        const aviso = "No se pudo obtener una respuesta. " +
            (error && error.message
                ? error.message
                : "Comprueba tu conexión e inténtalo de nuevo.");

        agregarMensajeVisual("assistant", aviso);
        mostrarEstado("No se pudo completar la solicitud");
    } finally {
        enviando = false;

        if (elementos.enviarBtn) {
            elementos.enviarBtn.disabled = false;
            elementos.enviarBtn.textContent = "Enviar ↑";
        }

        if (elementos.mensaje) elementos.mensaje.focus();
    }
}

/* =========================================================
   DICTADO POR VOZ
   ========================================================= */

function iniciarDictado() {
    const SpeechRecognition =
        window.SpeechRecognition || window.webkitSpeechRecognition;

    if (!SpeechRecognition) {
        mostrarEstado(
            "Tu navegador no admite dictado por voz. Prueba con Chrome."
        );
        return;
    }

    if (reconocimientoVoz) {
        reconocimientoVoz.stop();
        reconocimientoVoz = null;
        mostrarEstado("Dictado detenido");
        return;
    }

    reconocimientoVoz = new SpeechRecognition();
    reconocimientoVoz.lang = "es-CO";
    reconocimientoVoz.continuous = false;
    reconocimientoVoz.interimResults = false;

    reconocimientoVoz.onstart = () => {
        mostrarEstado("Escuchando… habla ahora");
        if (elementos.dictarBtn) {
            elementos.dictarBtn.textContent = "Detener dictado";
        }
    };

    reconocimientoVoz.onresult = event => {
        const resultado = event.results[0][0].transcript;

        if (elementos.mensaje) {
            const actual = elementos.mensaje.value.trim();
            elementos.mensaje.value =
                actual ? actual + " " + resultado : resultado;

            elementos.mensaje.focus();
            ajustarAlturaTexto();
        }
    };

    reconocimientoVoz.onerror = event => {
        console.error("Error de dictado:", event.error);
        mostrarEstado("No se pudo reconocer la voz. Revisa el permiso del micrófono.");
    };

    reconocimientoVoz.onend = () => {
        reconocimientoVoz = null;

        if (elementos.dictarBtn) {
            elementos.dictarBtn.textContent = "Dictar";
        }
    };

    reconocimientoVoz.start();
}

/* =========================================================
   LECTURA EN VOZ ALTA
   ========================================================= */

function detenerLectura() {
    if ("speechSynthesis" in window) {
        window.speechSynthesis.cancel();
    }
}

function leerRespuesta() {
    if (!("speechSynthesis" in window)) {
        mostrarEstado("Tu navegador no admite lectura en voz alta.");
        return;
    }

    detenerLectura();

    if (!ultimoTextoAsistente) {
        const chat = obtenerChatActual();

        if (chat) {
            const mensajes = chat.mensajes.filter(m => m.rol === "assistant");
            if (mensajes.length) {
                ultimoTextoAsistente = mensajes[mensajes.length - 1].texto;
            }
        }
    }

    if (!ultimoTextoAsistente) {
        mostrarEstado("Todavía no hay una respuesta para leer.");
        return;
    }

    const voz = new SpeechSynthesisUtterance(ultimoTextoAsistente);
    voz.lang = "es-CO";
    voz.rate = 1;
    voz.pitch = 1;

    voz.onstart = () => mostrarEstado("Leyendo respuesta…");
    voz.onend = () => mostrarEstado("Lista para ayudarte");
    voz.onerror = () => mostrarEstado("No se pudo reproducir la lectura.");

    window.speechSynthesis.speak(voz);
}

/* =========================================================
   COMPARTIR CONVERSACIÓN
   ========================================================= */

async function compartirConversacion() {
    const chat = obtenerChatActual();

    if (!chat || chat.mensajes.length === 0) {
        mostrarEstado("Todavía no hay una conversación para compartir.");
        return;
    }

    const contenido = [
        "IA TODO — " + chat.titulo,
        "",
        ...chat.mensajes.map(m =>
            (m.rol === "user" ? "Tú: " : "IA TODO: ") + m.texto
        )
    ].join("\n\n");

    try {
        if (navigator.share) {
            await navigator.share({
                title: "Conversación de IA TODO",
                text: contenido
            });

            mostrarEstado("Conversación compartida");
        } else if (navigator.clipboard && window.isSecureContext) {
            await navigator.clipboard.writeText(contenido);
            mostrarEstado("Conversación copiada al portapapeles");
        } else {
            const area = document.createElement("textarea");
            area.value = contenido;
            area.style.position = "fixed";
            area.style.opacity = "0";
            document.body.appendChild(area);
            area.select();

            const copiado = document.execCommand("copy");
            area.remove();

            mostrarEstado(
                copiado
                    ? "Conversación copiada al portapapeles"
                    : "No se pudo copiar. Intenta seleccionar el texto manualmente."
            );
        }
    } catch (error) {
        if (error && error.name === "AbortError") return;

        console.error("Error compartiendo:", error);
        mostrarEstado("No se pudo compartir la conversación.");
    }
}

/* =========================================================
   AJUSTAR EL CAMPO DE TEXTO
   ========================================================= */

function ajustarAlturaTexto() {
    if (!elementos.mensaje) return;

    elementos.mensaje.style.height = "auto";
    elementos.mensaje.style.height =
        Math.min(elementos.mensaje.scrollHeight, 180) + "px";
}

/* =========================================================
   EVENTOS
   ========================================================= */

function conectarEventos() {
    if (elementos.nuevoChat) {
        elementos.nuevoChat.addEventListener("click", nuevaConversacion);
    }

    if (elementos.enviarBtn) {
        elementos.enviarBtn.addEventListener("click", enviarMensaje);
    }

    if (elementos.mensaje) {
        elementos.mensaje.addEventListener("keydown", event => {
            if (event.key === "Enter" && !event.shiftKey) {
                event.preventDefault();
                enviarMensaje();
            }
        });

        elementos.mensaje.addEventListener("input", ajustarAlturaTexto);
    }

    if (elementos.fotoBtn && elementos.imagenInput) {
        elementos.fotoBtn.addEventListener("click", () => {
            elementos.imagenInput.click();
        });
    }

    if (elementos.archivoBtn && elementos.archivoInput) {
        elementos.archivoBtn.addEventListener("click", () => {
            elementos.archivoInput.click();
        });
    }

    if (elementos.imagenInput) {
        elementos.imagenInput.addEventListener("change", seleccionarImagen);
    }

    if (elementos.archivoInput) {
        elementos.archivoInput.addEventListener("change", seleccionarArchivo);
    }

    if (elementos.borrarAdjuntoBtn) {
        elementos.borrarAdjuntoBtn.addEventListener("click", quitarAdjunto);
    }

    if (elementos.dictarBtn) {
        elementos.dictarBtn.addEventListener("click", iniciarDictado);
    }

    if (elementos.leerBtn) {
        elementos.leerBtn.addEventListener("click", leerRespuesta);
    }

    if (elementos.compartirBtn) {
        elementos.compartirBtn.addEventListener("click", compartirConversacion);
    }

    if (elementos.menuBtn && elementos.sidebar) {
        elementos.menuBtn.addEventListener("click", () => {
            elementos.sidebar.classList.toggle("abierto");
        });
    }
}

/* =========================================================
   INICIAR IA TODO
   ========================================================= */

function iniciarIATodo() {
    cargarChats();
    conectarEventos();
    actualizarInterfazHistorial();

    const ultimoChat = chats
        .filter(chat => chat.mensajes.length > 0)
        .sort((a, b) => (b.actualizado || b.fecha) - (a.actualizado || a.fecha))[0];

    /*
      Al entrar por primera vez se muestra la bienvenida.
      No se abre automáticamente un chat viejo.
      Los chats anteriores siguen disponibles en el historial.
    */
    chatActualId = null;
    ultimoTextoAsistente = "";

    mostrarBienvenida();
    mostrarEstado("Lista para ayudarte");
}

if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", iniciarIATodo);
} else {
    iniciarIATodo();
}
