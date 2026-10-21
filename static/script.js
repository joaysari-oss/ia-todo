
"use strict";

/* =========================================
   CONFIGURACIÓN DE IA TODO
========================================= */

const CODIGO_CREADOR = "creador_joao_777";
const NOMBRE_CREADOR = "João";
const CLAVE_HISTORIAL = "iatodo_chats_v2";

const elementos = {
    sidebar: document.getElementById("sidebar"),
    menuBtn: document.getElementById("menuBtn"),
    listaChats: document.getElementById("listaChats"),
    mensajes: document.getElementById("mensajes"),
    mensaje: document.getElementById("mensaje"),
    enviarBtn: document.getElementById("enviarBtn"),
    nuevoChatBtn: document.getElementById("nuevoChatBtn"),
    archivoInput: document.getElementById("archivoInput"),
    fotoBtn: document.getElementById("fotoBtn"),
    archivoBtn: document.getElementById("archivoBtn"),
    dictadoBtn: document.getElementById("dictadoBtn"),
    leerBtn: document.getElementById("leerBtn"),
    compartirBtn: document.getElementById("compartirBtn"),
    quitarArchivoBtn: document.getElementById("quitarArchivoBtn"),
    nombreArchivo: document.getElementById("nombreArchivo")
};

let chats = [];
let chatActualId = null;
let imagenAdjunta = null;
let archivoAdjunto = null;
let esperandoRespuesta = false;
let reconocimientoVoz = null;
let leyendoRespuesta = false;

/* =========================================
   UTILIDADES
========================================= */

function generarId() {
    return (
        Date.now().toString(36) +
        Math.random().toString(36).substring(2, 9)
    );
}

function obtenerChatActual() {
    return chats.find(chat => chat.id === chatActualId) || null;
}

function guardarChats() {
    try {
        localStorage.setItem(CLAVE_HISTORIAL, JSON.stringify(chats));
    } catch (error) {
        console.error("No se pudo guardar el historial:", error);
    }
}

function cargarChats() {
    try {
        const guardados = localStorage.getItem(CLAVE_HISTORIAL);
        const datos = guardados ? JSON.parse(guardados) : [];

        chats = Array.isArray(datos)
            ? datos.filter(chat =>
                chat &&
                typeof chat.id === "string" &&
                Array.isArray(chat.mensajes)
            )
            : [];
    } catch (error) {
        console.error("No se pudo cargar el historial:", error);
        chats = [];
    }

    if (chats.length > 0) {
        chatActualId = chats[0].id;
    } else {
        crearChatInterno();
    }
}

function crearChatInterno() {
    const nuevoChat = {
        id: generarId(),
        titulo: "Nueva conversación",
        mensajes: [],
        fecha: Date.now()
    };

    chats.unshift(nuevoChat);
    chatActualId = nuevoChat.id;
    guardarChats();

    return nuevoChat;
}

function escaparHTML(texto) {
    return String(texto ?? "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}

function cerrarSidebarEnMovil() {
    if (elementos.sidebar) {
        elementos.sidebar.classList.remove("abierta");
        elementos.sidebar.classList.remove("abierto");
    }
}

/* =========================================
   BIENVENIDA Y TARJETAS
========================================= */

function mostrarBienvenida() {
    if (!elementos.mensajes) return;

    elementos.mensajes.innerHTML = `
        <div class="bienvenida">
            <div class="bienvenida-icono">✦</div>

            <h2>¡Hola! Soy IA TODO</h2>

            <p>
                Tu inteligencia artificial multipropósito.
                Pregúntame lo que quieras.
            </p>

            <div class="sugerencias">
                <button class="sugerencia" type="button"
                    data-pregunta="Explícame un tema difícil paso a paso">
                    <span>📚</span>
                    <strong>Aprender algo</strong>
                    <small>Explicaciones fáciles</small>
                </button>

                <button class="sugerencia" type="button"
                    data-pregunta="Ayúdame a crear un videojuego">
                    <span>🎮</span>
                    <strong>Crear un videojuego</strong>
                    <small>Ideas y programación</small>
                </button>

                <button class="sugerencia" type="button"
                    data-pregunta="Dame una idea de negocio original">
                    <span>💡</span>
                    <strong>Crear una idea</strong>
                    <small>Proyectos y negocios</small>
                </button>

                <button class="sugerencia" type="button"
                    data-pregunta="Ayúdame a resolver un problema paso a paso">
                    <span>🧠</span>
                    <strong>Resolver un problema</strong>
                    <small>Razonamiento paso a paso</small>
                </button>
            </div>
        </div>
    `;
}

function agregarMensajeVisual(rol, texto, opciones = {}) {
    if (!elementos.mensajes) return null;

    const esUsuario = rol === "usuario";
    const contenedor = document.createElement("div");

    contenedor.className = esUsuario
        ? "mensaje-chat mensaje-usuario"
        : "mensaje-chat mensaje-asistente";

    const etiqueta = document.createElement("div");
    etiqueta.className = "etiqueta-mensaje";
    etiqueta.textContent = esUsuario ? "Tú" : "IA TODO";

    const contenido = document.createElement("div");
    contenido.className = "contenido-mensaje";
    contenido.textContent = String(texto ?? "");

    contenedor.appendChild(etiqueta);
    contenedor.appendChild(contenido);

    if (opciones.imagen) {
        const imagen = document.createElement("img");
        imagen.src = opciones.imagen;
        imagen.alt = "Imagen adjunta";
        imagen.className = "imagen-mensaje";
        imagen.style.maxWidth = "100%";
        imagen.style.maxHeight = "300px";
        imagen.style.objectFit = "contain";
        imagen.style.borderRadius = "12px";
        imagen.style.marginTop = "10px";
        contenido.appendChild(document.createElement("br"));
        contenido.appendChild(imagen);
    }

    elementos.mensajes.appendChild(contenedor);
    elementos.mensajes.scrollTop = elementos.mensajes.scrollHeight;

    return contenedor;
}

function mostrarIndicadorEspera() {
    quitarIndicadorEspera();

    const indicador = document.createElement("div");
    indicador.className = "indicador-espera";
    indicador.id = "indicadorEspera";
    indicador.textContent = "IA TODO está pensando…";

    elementos.mensajes.appendChild(indicador);
    elementos.mensajes.scrollTop = elementos.mensajes.scrollHeight;
}

function quitarIndicadorEspera() {
    const indicador = document.getElementById("indicadorEspera");

    if (indicador) {
        indicador.remove();
    }
}

/* =========================================
   HISTORIAL DE CONVERSACIONES
========================================= */

function actualizarInterfazHistorial() {
    if (!elementos.listaChats) return;

    elementos.listaChats.innerHTML = "";

    if (chats.length === 0) {
        const vacio = document.createElement("div");
        vacio.className = "historial-vacio";
        vacio.textContent = "Todavía no tienes conversaciones.";
        elementos.listaChats.appendChild(vacio);
        return;
    }

    chats.forEach(chat => {
        const fila = document.createElement("div");

        // Clases compatibles con el CSS del HTML.
        fila.className = "chat-item";

        if (chat.id === chatActualId) {
            fila.classList.add("activo");
        }

        const abrir = document.createElement("button");
        abrir.type = "button";
        abrir.className = "abrir-chat";
        abrir.textContent = chat.titulo || "Nueva conversación";
        abrir.title = chat.titulo || "Nueva conversación";

        abrir.addEventListener("click", () => {
            abrirChat(chat.id);
        });

        const borrar = document.createElement("button");
        borrar.type = "button";
        borrar.className = "eliminar";
        borrar.textContent = "×";
        borrar.title = "Eliminar conversación";
        borrar.setAttribute("aria-label", "Eliminar conversación");

        borrar.addEventListener("click", evento => {
            evento.stopPropagation();
            eliminarChat(chat.id);
        });

        fila.appendChild(abrir);
        fila.appendChild(borrar);
        elementos.listaChats.appendChild(fila);
    });
}

function actualizarTituloChat(chat) {
    if (!chat) return;

    const primerMensaje = chat.mensajes.find(
        mensaje => mensaje.rol === "usuario"
    );

    if (primerMensaje && primerMensaje.texto) {
        const titulo = primerMensaje.texto.trim();

        chat.titulo = titulo.length > 35
            ? titulo.substring(0, 35) + "…"
            : titulo;
    } else {
        chat.titulo = "Nueva conversación";
    }
}

function nuevaConversacion() {
    detenerLectura();

    crearChatInterno();
    actualizarInterfazHistorial();
    mostrarBienvenida();
    limpiarAdjunto();
    cerrarSidebarEnMovil();

    if (elementos.mensaje) {
        elementos.mensaje.value = "";
        elementos.mensaje.focus();
    }
}

function abrirChat(id) {
    const chat = chats.find(item => item.id === id);

    if (!chat) return;

    detenerLectura();

    chatActualId = id;
    actualizarInterfazHistorial();
    renderizarChat(chat);
    cerrarSidebarEnMovil();
}

function renderizarChat(chat) {
    if (!elementos.mensajes) return;

    elementos.mensajes.innerHTML = "";

    if (!chat || !Array.isArray(chat.mensajes) || chat.mensajes.length === 0) {
        mostrarBienvenida();
        return;
    }

    chat.mensajes.forEach(mensaje => {
        agregarMensajeVisual(
            mensaje.rol,
            mensaje.texto,
            { imagen: mensaje.imagen || null }
        );
    });

    elementos.mensajes.scrollTop = elementos.mensajes.scrollHeight;
}

function eliminarChat(id) {
    const confirmar = window.confirm(
        "¿Seguro que quieres eliminar esta conversación?"
    );

    if (!confirmar) return;

    chats = chats.filter(chat => chat.id !== id);

    if (chatActualId === id) {
        if (chats.length > 0) {
            chatActualId = chats[0].id;
        } else {
            crearChatInterno();
        }

        renderizarChat(obtenerChatActual());
    }

    guardarChats();
    actualizarInterfazHistorial();
}

/* =========================================
   RESPUESTA SOBRE EL CREADOR
========================================= */

function esPreguntaSobreCreador(texto) {
    const pregunta = texto.toLowerCase();

    return (
        pregunta.includes("quién te creó") ||
        pregunta.includes("quien te creo") ||
        pregunta.includes("quién te creo") ||
        pregunta.includes("quien te creó") ||
        pregunta.includes("quién es tu creador") ||
        pregunta.includes("quien es tu creador") ||
        pregunta.includes("quién te hizo") ||
        pregunta.includes("quien te hizo") ||
        pregunta.includes("quién te programó") ||
        pregunta.includes("quien te programo") ||
        pregunta.includes("quién te desarrolló") ||
        pregunta.includes("quien te desarrollo")
    );
}

function respuestaCreador() {
    return `Fui creado por ${NOMBRE_CREADOR}. No puedo dar más información.`;
}

/* =========================================
   ENVIAR MENSAJES A LA IA
========================================= */

async function enviarMensaje() {
    if (esperandoRespuesta) return;

    if (!elementos.mensaje) return;

    const texto = elementos.mensaje.value.trim();

    if (!texto && !imagenAdjunta && !archivoAdjunto) return;

    const chat = obtenerChatActual();

    if (!chat) return;

    const imagenParaEnviar = imagenAdjunta;
    const archivoParaEnviar = archivoAdjunto;

    const textoVisible = texto ||
        (imagenParaEnviar ? "Analiza esta imagen." : "Analiza este archivo.");

    if (chat.mensajes.length === 0 && chat.titulo === "Nueva conversación") {
        chat.titulo = textoVisible.length > 35
            ? textoVisible.substring(0, 35) + "…"
            : textoVisible;
    }

    const mensajeUsuario = {
        rol: "usuario",
        texto: textoVisible,
        fecha: Date.now(),
        imagen: imagenParaEnviar || null
    };

    chat.mensajes.push(mensajeUsuario);

    agregarMensajeVisual("usuario", textoVisible, {
        imagen: imagenParaEnviar || null
    });

    elementos.mensaje.value = "";
    ajustarAlturaTexto();
    limpiarAdjunto();

    guardarChats();
    actualizarInterfazHistorial();

    esperandoRespuesta = true;

    if (elementos.enviarBtn) {
        elementos.enviarBtn.disabled = true;
    }

    mostrarIndicadorEspera();

    try {
        let respuesta;

        if (esPreguntaSobreCreador(texto)) {
            respuesta = respuestaCreador();
        } else {
            const historial = chat.mensajes
                .slice(-20)
                .map(mensaje => ({
                    rol: mensaje.rol,
                    texto: mensaje.texto
                }));

            const cuerpo = {
                mensaje: texto,
                historial: historial,
                imagen: imagenParaEnviar || null
            };

            if (archivoParaEnviar) {
                cuerpo.archivo = archivoParaEnviar;
            }

            const resultado = await fetch("/api/chat", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json"
                },
                body: JSON.stringify(cuerpo)
            });

            let datos;

            try {
                datos = await resultado.json();
            } catch {
                throw new Error("El servidor devolvió una respuesta que no es JSON.");
            }

            if (!resultado.ok) {
                throw new Error(
                    datos.error ||
                    datos.mensaje ||
                    `Error del servidor: ${resultado.status}`
                );
            }

            respuesta = datos.texto ??
                datos.respuesta ??
                datos.message ??
                datos.mensaje;

            if (typeof respuesta !== "string" || !respuesta.trim()) {
                throw new Error("El servidor no devolvió una respuesta válida.");
            }
        }

        quitarIndicadorEspera();

        chat.mensajes.push({
            rol: "asistente",
            texto: respuesta,
            fecha: Date.now()
        });

        agregarMensajeVisual("asistente", respuesta);

        actualizarTituloChat(chat);
        guardarChats();
        actualizarInterfazHistorial();

    } catch (error) {
        console.error("Error al consultar la IA:", error);

        quitarIndicadorEspera();

        const mensajeError =
            "No pude obtener una respuesta. Revisa tu conexión e inténtalo de nuevo.";

        agregarMensajeVisual("asistente", mensajeError);

    } finally {
        esperandoRespuesta = false;

        if (elementos.enviarBtn) {
            elementos.enviarBtn.disabled = false;
        }

        if (elementos.mensaje) {
            elementos.mensaje.focus();
        }
    }
}

/* =========================================
   ARCHIVOS E IMÁGENES
========================================= */

function procesarArchivo(archivo) {
    if (!archivo) return;

    const esImagen = archivo.type.startsWith("image/");

    if (esImagen) {
        const lector = new FileReader();

        lector.onload = evento => {
            imagenAdjunta = evento.target.result;
            archivoAdjunto = null;
            mostrarNombreAdjunto(archivo.name);
        };

        lector.onerror = () => {
            alert("No se pudo leer la imagen.");
        };

        lector.readAsDataURL(archivo);
        return;
    }

    const lector = new FileReader();

    lector.onload = evento => {
        archivoAdjunto = {
            nombre: archivo.name,
            tipo: archivo.type || "application/octet-stream",
            contenido: String(evento.target.result || "").substring(0, 100000)
        };

        imagenAdjunta = null;
        mostrarNombreAdjunto(archivo.name);
    };

    lector.onerror = () => {
        alert("No se pudo leer el archivo.");
    };

    lector.readAsText(archivo);
}

function mostrarNombreAdjunto(nombre) {
    if (elementos.nombreArchivo) {
        elementos.nombreArchivo.textContent = nombre;
        elementos.nombreArchivo.hidden = false;
    }

    if (elementos.quitarArchivoBtn) {
        elementos.quitarArchivoBtn.hidden = false;
    }
}

function limpiarAdjunto() {
    imagenAdjunta = null;
    archivoAdjunto = null;

    if (elementos.archivoInput) {
        elementos.archivoInput.value = "";
    }

    if (elementos.nombreArchivo) {
        elementos.nombreArchivo.textContent = "";
        elementos.nombreArchivo.hidden = true;
    }

    if (elementos.quitarArchivoBtn) {
        elementos.quitarArchivoBtn.hidden = true;
    }
}

/* =========================================
   DICTADO POR VOZ
========================================= */

function iniciarDictado() {
    const Reconocimiento =
        window.SpeechRecognition || window.webkitSpeechRecognition;

    if (!Reconocimiento) {
        alert("Tu navegador no admite dictado por voz. Prueba con Google Chrome.");
        return;
    }

    if (reconocimientoVoz) {
        reconocimientoVoz.stop();
        reconocimientoVoz = null;
        return;
    }

    reconocimientoVoz = new Reconocimiento();
    reconocimientoVoz.lang = "es-CO";
    reconocimientoVoz.continuous = false;
    reconocimientoVoz.interimResults = false;

    reconocimientoVoz.onresult = evento => {
        const resultado = evento.results[0][0].transcript;

        if (elementos.mensaje) {
            elementos.mensaje.value =
                (elementos.mensaje.value + " " + resultado).trim();

            ajustarAlturaTexto();
        }
    };

    reconocimientoVoz.onerror = evento => {
        console.error("Error de dictado:", evento.error);
    };

    reconocimientoVoz.onend = () => {
        reconocimientoVoz = null;
    };

    reconocimientoVoz.start();
}

/* =========================================
   LEER RESPUESTAS EN VOZ ALTA
========================================= */

function leerUltimaRespuesta() {
    if (!("speechSynthesis" in window)) {
        alert("Tu navegador no admite lectura en voz alta.");
        return;
    }

    const chat = obtenerChatActual();

    if (!chat) return;

    const ultimaRespuesta = [...chat.mensajes]
        .reverse()
        .find(mensaje => mensaje.rol === "asistente");

    if (!ultimaRespuesta) {
        alert("Todavía no hay una respuesta para leer.");
        return;
    }

    detenerLectura();

    const voz = new SpeechSynthesisUtterance(ultimaRespuesta.texto);
    voz.lang = "es-CO";
    voz.rate = 1;
    voz.pitch = 1;

    voz.onstart = () => {
        leyendoRespuesta = true;
    };

    voz.onend = () => {
        leyendoRespuesta = false;
    };

    voz.onerror = () => {
        leyendoRespuesta = false;
    };

    window.speechSynthesis.speak(voz);
}

function detenerLectura() {
    if ("speechSynthesis" in window) {
        window.speechSynthesis.cancel();
    }

    leyendoRespuesta = false;
}

/* =========================================
   COMPARTIR CONVERSACIÓN
========================================= */

async function compartirConversacion() {
    const chat = obtenerChatActual();

    if (!chat || chat.mensajes.length === 0) {
        alert("No hay una conversación para compartir.");
        return;
    }

    const contenido = chat.mensajes
        .map(mensaje => {
            const autor = mensaje.rol === "usuario" ? "Tú" : "IA TODO";
            return `${autor}:\n${mensaje.texto}`;
        })
        .join("\n\n");

    const datosCompartir = {
        title: chat.titulo || "Conversación con IA TODO",
        text: contenido
    };

    try {
        if (navigator.share) {
            await navigator.share(datosCompartir);
        } else if (navigator.clipboard && window.isSecureContext) {
            await navigator.clipboard.writeText(contenido);
            alert("La conversación se copió al portapapeles.");
        } else {
            const area = document.createElement("textarea");
            area.value = contenido;
            document.body.appendChild(area);
            area.select();

            const copiado = document.execCommand("copy");
            area.remove();

            alert(copiado
                ? "La conversación se copió al portapapeles."
                : "No se pudo copiar la conversación.");
        }
    } catch (error) {
        if (error.name !== "AbortError") {
            console.error("Error al compartir:", error);
            alert("No se pudo compartir la conversación.");
        }
    }
}

/* =========================================
   ALTURA DEL CUADRO DE TEXTO
========================================= */

function ajustarAlturaTexto() {
    if (!elementos.mensaje) return;

    elementos.mensaje.style.height = "auto";
    elementos.mensaje.style.height =
        Math.min(elementos.mensaje.scrollHeight, 180) + "px";
}

/* =========================================
   EVENTOS DE LA INTERFAZ
========================================= */

function conectarEventos() {
    if (elementos.enviarBtn) {
        elementos.enviarBtn.addEventListener("click", enviarMensaje);
    }

    if (elementos.mensaje) {
        elementos.mensaje.addEventListener("keydown", evento => {
            if (
                evento.key === "Enter" &&
                !evento.shiftKey &&
                !evento.isComposing
            ) {
                evento.preventDefault();
                enviarMensaje();
            }
        });

        elementos.mensaje.addEventListener("input", ajustarAlturaTexto);
    }

    if (elementos.nuevoChatBtn) {
        elementos.nuevoChatBtn.addEventListener("click", nuevaConversacion);
    }

    if (elementos.fotoBtn && elementos.archivoInput) {
        elementos.fotoBtn.addEventListener("click", () => {
            elementos.archivoInput.accept = "image/*";
            elementos.archivoInput.click();
        });
    }

    if (elementos.archivoBtn && elementos.archivoInput) {
        elementos.archivoBtn.addEventListener("click", () => {
            elementos.archivoInput.accept = "*/*";
            elementos.archivoInput.click();
        });
    }

    if (elementos.archivoInput) {
        elementos.archivoInput.addEventListener("change", evento => {
            const archivo = evento.target.files?.[0];

            if (archivo) {
                procesarArchivo(archivo);
            }
        });
    }

    if (elementos.quitarArchivoBtn) {
        elementos.quitarArchivoBtn.addEventListener("click", limpiarAdjunto);
    }

    if (elementos.dictadoBtn) {
        elementos.dictadoBtn.addEventListener("click", iniciarDictado);
    }

    if (elementos.leerBtn) {
        elementos.leerBtn.addEventListener("click", leerUltimaRespuesta);
    }

    if (elementos.compartirBtn) {
        elementos.compartirBtn.addEventListener("click", compartirConversacion);
    }

    // Las tarjetas usan las clases y el atributo data-pregunta del HTML.
    if (elementos.mensajes) {
        elementos.mensajes.addEventListener("click", evento => {
            const tarjeta = evento.target.closest("[data-pregunta]");

            if (!tarjeta) return;

            const pregunta = tarjeta.getAttribute("data-pregunta");

            if (pregunta && elementos.mensaje) {
                elementos.mensaje.value = pregunta;
                ajustarAlturaTexto();
                elementos.mensaje.focus();
            }
        });
    }

    // Importante: el botón del menú lo controla el script inline del HTML.
    // No se agrega otro listener para evitar que la barra se abra y se cierre sola.

    document.addEventListener("keydown", evento => {
        if (evento.key === "Escape") {
            cerrarSidebarEnMovil();
        }
    });

    window.addEventListener("resize", () => {
        if (window.innerWidth > 760) {
            cerrarSidebarEnMovil();
        }
    });
}

/* =========================================
   INICIO DE IA TODO
========================================= */

function iniciarIA() {
    cargarChats();
    conectarEventos();
    actualizarInterfazHistorial();

    const chat = obtenerChatActual();

    if (chat && chat.mensajes.length > 0) {
        renderizarChat(chat);
    } else {
        mostrarBienvenida();
    }

    ajustarAlturaTexto();
}

if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", iniciarIA);
} else {
    iniciarIA();
}
