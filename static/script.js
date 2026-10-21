
"use strict";

/* =====================================================
   IA TODO — CONFIGURACIÓN PRINCIPAL
===================================================== */

const CONFIG = Object.freeze({
    codigoCreador: "creador_joao_777",
    nombreCreador: "João",
    claveHistorial: "iatodo_chats_v2",
    idioma: "es-CO",
    maxMensajesContexto: 20,
    maxCaracteresArchivo: 100000,
    maxAlturaTexto: 180,
    maxTituloChat: 35,
    endpointChat: "/api/chat"
});

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
let lecturaActual = null;
let solicitudActual = 0;

/* =====================================================
   UTILIDADES
===================================================== */

function generarId() {
    return (
        Date.now().toString(36) +
        Math.random().toString(36).slice(2, 10)
    );
}

function obtenerChatActual() {
    return chats.find(chat => chat.id === chatActualId) || null;
}

function guardarChats() {
    try {
        localStorage.setItem(
            CONFIG.claveHistorial,
            JSON.stringify(chats)
        );
    } catch (error) {
        console.error("Error al guardar las conversaciones:", error);
    }
}

function cargarChats() {
    try {
        const guardados = localStorage.getItem(CONFIG.claveHistorial);
        const datos = guardados ? JSON.parse(guardados) : [];

        chats = Array.isArray(datos)
            ? datos.filter(chat =>
                chat &&
                typeof chat.id === "string" &&
                Array.isArray(chat.mensajes)
            )
            : [];
    } catch (error) {
        console.error("Error al cargar las conversaciones:", error);
        chats = [];
    }

    if (chats.length > 0) {
        chatActualId = chats[0].id;
    } else {
        crearChatInterno();
    }
}

function crearChatInterno() {
    const chat = {
        id: generarId(),
        titulo: "Nueva conversación",
        mensajes: [],
        fecha: Date.now()
    };

    chats.unshift(chat);
    chatActualId = chat.id;
    guardarChats();

    return chat;
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
    if (!elementos.sidebar) return;

    elementos.sidebar.classList.remove("abierta");
    elementos.sidebar.classList.remove("abierto");
}

function desplazarAlFinal() {
    if (!elementos.mensajes) return;

    elementos.mensajes.scrollTop =
        elementos.mensajes.scrollHeight;
}

function obtenerUltimaRespuesta(chat = obtenerChatActual()) {
    if (!chat || !Array.isArray(chat.mensajes)) return null;

    return [...chat.mensajes]
        .reverse()
        .find(mensaje =>
            mensaje &&
            mensaje.rol === "asistente" &&
            typeof mensaje.texto === "string" &&
            mensaje.texto.trim()
        ) || null;
}

/* =====================================================
   BIENVENIDA
===================================================== */

function mostrarBienvenida() {
    if (!elementos.mensajes) return;

    detenerLectura();

    elementos.mensajes.replaceChildren();

    const bienvenida = document.createElement("div");
    bienvenida.className = "bienvenida";

    const icono = document.createElement("div");
    icono.className = "bienvenida-icono";
    icono.textContent = "✦";

    const titulo = document.createElement("h2");
    titulo.textContent = "¡Hola! Soy IA TODO";

    const descripcion = document.createElement("p");
    descripcion.textContent =
        "Tu inteligencia artificial multipropósito. Pregúntame lo que quieras.";

    const sugerencias = document.createElement("div");
    sugerencias.className = "sugerencias";

    const opciones = [
        {
            icono: "📚",
            titulo: "Aprender algo",
            descripcion: "Explicaciones fáciles",
            pregunta: "Explícame un tema difícil paso a paso"
        },
        {
            icono: "🎮",
            titulo: "Crear un videojuego",
            descripcion: "Ideas y programación",
            pregunta: "Ayúdame a crear un videojuego"
        },
        {
            icono: "💡",
            titulo: "Crear una idea",
            descripcion: "Proyectos y negocios",
            pregunta: "Dame una idea de negocio original"
        },
        {
            icono: "🧠",
            titulo: "Resolver un problema",
            descripcion: "Razonamiento paso a paso",
            pregunta: "Ayúdame a resolver un problema paso a paso"
        }
    ];

    opciones.forEach(opcion => {
        const tarjeta = document.createElement("button");
        tarjeta.type = "button";
        tarjeta.className = "sugerencia";
        tarjeta.dataset.pregunta = opcion.pregunta;

        const iconoTarjeta = document.createElement("span");
        iconoTarjeta.textContent = opcion.icono;

        const tituloTarjeta = document.createElement("strong");
        tituloTarjeta.textContent = opcion.titulo;

        const descripcionTarjeta = document.createElement("small");
        descripcionTarjeta.textContent = opcion.descripcion;

        tarjeta.append(
            iconoTarjeta,
            tituloTarjeta,
            descripcionTarjeta
        );

        sugerencias.appendChild(tarjeta);
    });

    bienvenida.append(
        icono,
        titulo,
        descripcion,
        sugerencias
    );

    elementos.mensajes.appendChild(bienvenida);
}

/* =====================================================
   MOSTRAR MENSAJES
===================================================== */

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

    contenedor.append(etiqueta, contenido);

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
    desplazarAlFinal();

    return contenedor;
}

function mostrarIndicadorEspera() {
    quitarIndicadorEspera();

    if (!elementos.mensajes) return;

    const indicador = document.createElement("div");

    indicador.className = "indicador-espera";
    indicador.id = "indicadorEspera";
    indicador.textContent = "IA TODO está pensando…";
    indicador.setAttribute("role", "status");
    indicador.setAttribute("aria-live", "polite");

    elementos.mensajes.appendChild(indicador);
    desplazarAlFinal();
}

function quitarIndicadorEspera() {
    document.getElementById("indicadorEspera")?.remove();
}

/* =====================================================
   HISTORIAL
===================================================== */

function actualizarInterfazHistorial() {
    if (!elementos.listaChats) return;

    elementos.listaChats.replaceChildren();

    if (chats.length === 0) {
        const vacio = document.createElement("div");
        vacio.className = "historial-vacio";
        vacio.textContent = "Todavía no tienes conversaciones.";

        elementos.listaChats.appendChild(vacio);
        return;
    }

    chats.forEach(chat => {
        const fila = document.createElement("div");
        fila.className = "chat-item";

        if (chat.id === chatActualId) {
            fila.classList.add("activo");
        }

        const abrir = document.createElement("button");
        abrir.type = "button";
        abrir.className = "abrir-chat";
        abrir.textContent = chat.titulo || "Nueva conversación";
        abrir.title = chat.titulo || "Nueva conversación";

        abrir.addEventListener("click", () => abrirChat(chat.id));

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

        fila.append(abrir, borrar);
        elementos.listaChats.appendChild(fila);
    });
}

function actualizarTituloChat(chat) {
    if (!chat) return;

    const primero = chat.mensajes.find(
        mensaje => mensaje.rol === "usuario"
    );

    if (!primero || !primero.texto) {
        chat.titulo = "Nueva conversación";
        return;
    }

    const titulo = primero.texto.trim();

    chat.titulo = titulo.length > CONFIG.maxTituloChat
        ? titulo.slice(0, CONFIG.maxTituloChat) + "…"
        : titulo;
}

function nuevaConversacion() {
    detenerLectura();
    detenerDictado();

    crearChatInterno();
    actualizarInterfazHistorial();
    mostrarBienvenida();
    limpiarAdjunto();
    cerrarSidebarEnMovil();

    if (elementos.mensaje) {
        elementos.mensaje.value = "";
        ajustarAlturaTexto();
        elementos.mensaje.focus();
    }
}

function abrirChat(id) {
    const chat = chats.find(item => item.id === id);

    if (!chat) return;

    detenerLectura();
    detenerDictado();

    chatActualId = id;

    actualizarInterfazHistorial();
    renderizarChat(chat);
    cerrarSidebarEnMovil();
}

function renderizarChat(chat) {
    if (!elementos.mensajes) return;

    detenerLectura();
    elementos.mensajes.replaceChildren();

    if (!chat || !chat.mensajes.length) {
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

    desplazarAlFinal();
}

function eliminarChat(id) {
    if (!window.confirm("¿Seguro que quieres eliminar esta conversación?")) {
        return;
    }

    if (id === chatActualId) {
        detenerLectura();
    }

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

/* =====================================================
   IDENTIDAD DEL CREADOR
===================================================== */

function esPreguntaSobreCreador(texto) {
    const pregunta = String(texto || "")
        .toLocaleLowerCase("es-CO")
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "");

    const patrones = [
        /quien te creo/,
        /quien es tu creador/,
        /quien te hizo/,
        /quien te programo/,
        /quien te desarrollo/,
        /quien te construyo/,
        /quien creo ia todo/,
        /quien hizo ia todo/,
        /quien es el creador/
    ];

    return patrones.some(patron => patron.test(pregunta));
}

function respuestaCreador() {
    return `Fui creado por ${CONFIG.nombreCreador}. No puedo dar más información.`;
}

/* =====================================================
   CONEXIÓN CON EL SERVIDOR DE IA
===================================================== */

async function enviarMensaje() {
    if (esperandoRespuesta || !elementos.mensaje) return;

    const texto = elementos.mensaje.value.trim();

    if (!texto && !imagenAdjunta && !archivoAdjunto) return;

    const chat = obtenerChatActual();

    if (!chat) return;

    const solicitud = ++solicitudActual;
    const imagen = imagenAdjunta;
    const archivo = archivoAdjunto;

    const textoVisible = texto ||
        (imagen ? "Analiza esta imagen." : "Analiza este archivo.");

    chat.mensajes.push({
        rol: "usuario",
        texto: textoVisible,
        fecha: Date.now(),
        imagen: imagen || null
    });

    actualizarTituloChat(chat);

    agregarMensajeVisual("usuario", textoVisible, { imagen });

    elementos.mensaje.value = "";
    ajustarAlturaTexto();
    limpiarAdjunto();

    guardarChats();
    actualizarInterfazHistorial();

    esperandoRespuesta = true;
    cambiarEstadoEnviar(true);
    mostrarIndicadorEspera();

    try {
        let respuesta;

        if (esPreguntaSobreCreador(texto)) {
            respuesta = respuestaCreador();
        } else {
            const historial = chat.mensajes
                .slice(-CONFIG.maxMensajesContexto)
                .map(mensaje => ({
                    rol: mensaje.rol,
                    texto: mensaje.texto
                }));

            const cuerpo = {
                mensaje: texto,
                historial,
                imagen: imagen || null
            };

            if (archivo) {
                cuerpo.archivo = archivo;
            }

            const resultado = await fetch(CONFIG.endpointChat, {
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
                throw new Error(
                    "El servidor devolvió una respuesta que no es JSON."
                );
            }

            if (!resultado.ok) {
                throw new Error(
                    datos.error ||
                    datos.mensaje ||
                    `Error del servidor: ${resultado.status}`
                );
            }

            respuesta =
                datos.texto ??
                datos.respuesta ??
                datos.message ??
                datos.mensaje;

            if (typeof respuesta !== "string" || !respuesta.trim()) {
                throw new Error("El servidor no devolvió una respuesta válida.");
            }
        }

        if (solicitud !== solicitudActual) return;

        quitarIndicadorEspera();

        chat.mensajes.push({
            rol: "asistente",
            texto: respuesta,
            fecha: Date.now()
        });

        if (obtenerChatActual()?.id === chat.id) {
            agregarMensajeVisual("asistente", respuesta);
        }

        actualizarTituloChat(chat);
        guardarChats();
        actualizarInterfazHistorial();

    } catch (error) {
        console.error("Error al consultar IA TODO:", error);

        if (solicitud === solicitudActual) {
            quitarIndicadorEspera();

            agregarMensajeVisual(
                "asistente",
                "No pude obtener una respuesta. Revisa tu conexión e inténtalo de nuevo."
            );
        }
    } finally {
        if (solicitud === solicitudActual) {
            esperandoRespuesta = false;
            cambiarEstadoEnviar(false);
            elementos.mensaje?.focus();
        }
    }
}

function cambiarEstadoEnviar(ocupado) {
    if (!elementos.enviarBtn) return;

    elementos.enviarBtn.disabled = ocupado;
    elementos.enviarBtn.setAttribute(
        "aria-busy",
        ocupado ? "true" : "false"
    );
}

/* =====================================================
   ARCHIVOS E IMÁGENES
===================================================== */

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
            contenido: String(evento.target.result || "")
                .slice(0, CONFIG.maxCaracteresArchivo)
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

/* =====================================================
   DICTADO POR VOZ
===================================================== */

function iniciarDictado() {
    const Reconocimiento =
        window.SpeechRecognition ||
        window.webkitSpeechRecognition;

    if (!Reconocimiento) {
        alert(
            "Tu navegador no admite dictado por voz. Prueba con Google Chrome."
        );
        return;
    }

    if (reconocimientoVoz) {
        detenerDictado();
        return;
    }

    reconocimientoVoz = new Reconocimiento();
    reconocimientoVoz.lang = CONFIG.idioma;
    reconocimientoVoz.continuous = false;
    reconocimientoVoz.interimResults = false;

    if (elementos.dictadoBtn) {
        elementos.dictadoBtn.classList.add("escuchando");
        elementos.dictadoBtn.setAttribute("aria-pressed", "true");
        elementos.dictadoBtn.title = "Detener dictado";
    }

    reconocimientoVoz.onresult = evento => {
        const resultado = evento.results?.[0]?.[0]?.transcript;

        if (resultado && elementos.mensaje) {
            elementos.mensaje.value = (
                elementos.mensaje.value + " " + resultado
            ).trim();

            ajustarAlturaTexto();
        }
    };

    reconocimientoVoz.onerror = evento => {
        console.error("Error de dictado:", evento.error);
    };

    reconocimientoVoz.onend = () => {
        reconocimientoVoz = null;
        actualizarBotonDictado(false);
    };

    try {
        reconocimientoVoz.start();
    } catch (error) {
        console.error("No se pudo iniciar el dictado:", error);
        detenerDictado();
    }
}

function actualizarBotonDictado(activo) {
    if (!elementos.dictadoBtn) return;

    elementos.dictadoBtn.classList.toggle("escuchando", activo);
    elementos.dictadoBtn.setAttribute(
        "aria-pressed",
        activo ? "true" : "false"
    );
    elementos.dictadoBtn.title = activo
        ? "Detener dictado"
        : "Dictar por voz";
}

function detenerDictado() {
    const reconocimiento = reconocimientoVoz;
    reconocimientoVoz = null;

    if (reconocimiento) {
        try {
            reconocimiento.stop();
        } catch (error) {
            console.warn("No se pudo detener el dictado:", error);
        }
    }

    actualizarBotonDictado(false);
}

/* =====================================================
   LECTURA EN VOZ ALTA
   El botón funciona como interruptor: leer / detener.
===================================================== */

function actualizarBotonLectura(activo) {
    if (!elementos.leerBtn) return;

    elementos.leerBtn.classList.toggle("leyendo", activo);
    elementos.leerBtn.setAttribute(
        "aria-pressed",
        activo ? "true" : "false"
    );
    elementos.leerBtn.title = activo
        ? "Detener lectura"
        : "Leer respuesta";
}

function leerUltimaRespuesta() {
    if (!("speechSynthesis" in window)) {
        alert("Tu navegador no admite lectura en voz alta.");
        return;
    }

    // Si está leyendo, el mismo botón detiene la voz.
    if (
        leyendoRespuesta ||
        window.speechSynthesis.speaking ||
        window.speechSynthesis.pending
    ) {
        detenerLectura();
        return;
    }

    const ultimaRespuesta = obtenerUltimaRespuesta();

    if (!ultimaRespuesta) {
        alert("Todavía no hay una respuesta para leer.");
        return;
    }

    detenerLectura();

    const texto = ultimaRespuesta.texto.trim();

    if (!texto) {
        alert("La respuesta no contiene texto para leer.");
        return;
    }

    const voz = new SpeechSynthesisUtterance(texto);

    voz.lang = CONFIG.idioma;
    voz.rate = 1;
    voz.pitch = 1;
    voz.volume = 1;

    lecturaActual = voz;
    leyendoRespuesta = true;
    actualizarBotonLectura(true);

    voz.onstart = () => {
        leyendoRespuesta = true;
        actualizarBotonLectura(true);
    };

    voz.onend = () => {
        finalizarLectura(voz);
    };

    voz.onerror = evento => {
        // "canceled" y "interrupted" son normales al detener la voz.
        if (
            evento.error !== "canceled" &&
            evento.error !== "interrupted"
        ) {
            console.error("Error de lectura:", evento.error);
        }

        finalizarLectura(voz);
    };

    try {
        window.speechSynthesis.speak(voz);
    } catch (error) {
        console.error("No se pudo iniciar la lectura:", error);
        finalizarLectura(voz);
    }
}

function finalizarLectura(voz) {
    // Evita que una lectura antigua cambie el estado de una nueva.
    if (voz && lecturaActual !== voz) return;

    lecturaActual = null;
    leyendoRespuesta = false;
    actualizarBotonLectura(false);
}

function detenerLectura() {
    leyendoRespuesta = false;

    if ("speechSynthesis" in window) {
        window.speechSynthesis.cancel();
    }

    lecturaActual = null;
    actualizarBotonLectura(false);
}

/* =====================================================
   COMPARTIR CONVERSACIONES
===================================================== */

async function compartirConversacion() {
    const chat = obtenerChatActual();

    if (!chat || chat.mensajes.length === 0) {
        alert("No hay una conversación para compartir.");
        return;
    }

    const contenido = chat.mensajes
        .map(mensaje => {
            const autor = mensaje.rol === "usuario"
                ? "Tú"
                : "IA TODO";

            return `${autor}:\n${mensaje.texto}`;
        })
        .join("\n\n");

    try {
        if (navigator.share) {
            await navigator.share({
                title: chat.titulo || "Conversación con IA TODO",
                text: contenido
            });
            return;
        }

        if (navigator.clipboard && window.isSecureContext) {
            await navigator.clipboard.writeText(contenido);
            alert("La conversación se copió al portapapeles.");
            return;
        }

        const area = document.createElement("textarea");
        area.value = contenido;
        area.setAttribute("readonly", "");
        area.style.position = "fixed";
        area.style.opacity = "0";

        document.body.appendChild(area);
        area.select();

        const copiado = document.execCommand("copy");
        area.remove();

        alert(
            copiado
                ? "La conversación se copió al portapapeles."
                : "No se pudo copiar la conversación."
        );
    } catch (error) {
        if (error.name !== "AbortError") {
            console.error("Error al compartir:", error);
            alert("No se pudo compartir la conversación.");
        }
    }
}

/* =====================================================
   CUADRO DE TEXTO
===================================================== */

function ajustarAlturaTexto() {
    if (!elementos.mensaje) return;

    elementos.mensaje.style.height = "auto";

    elementos.mensaje.style.height =
        Math.min(
            elementos.mensaje.scrollHeight,
            CONFIG.maxAlturaTexto
        ) + "px";
}

/* =====================================================
   EVENTOS DE LA INTERFAZ
===================================================== */

function conectarEventos() {
    elementos.enviarBtn?.addEventListener(
        "click",
        enviarMensaje
    );

    elementos.mensaje?.addEventListener("keydown", evento => {
        if (
            evento.key === "Enter" &&
            !evento.shiftKey &&
            !evento.isComposing
        ) {
            evento.preventDefault();
            enviarMensaje();
        }
    });

    elementos.mensaje?.addEventListener(
        "input",
        ajustarAlturaTexto
    );

    elementos.nuevoChatBtn?.addEventListener(
        "click",
        nuevaConversacion
    );

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

    elementos.archivoInput?.addEventListener("change", evento => {
        const archivo = evento.target.files?.[0];

        if (archivo) {
            procesarArchivo(archivo);
        }
    });

    elementos.quitarArchivoBtn?.addEventListener(
        "click",
        limpiarAdjunto
    );

    elementos.dictadoBtn?.addEventListener(
        "click",
        iniciarDictado
    );

    elementos.leerBtn?.addEventListener(
        "click",
        leerUltimaRespuesta
    );

    elementos.compartirBtn?.addEventListener(
        "click",
        compartirConversacion
    );

    elementos.mensajes?.addEventListener("click", evento => {
        const tarjeta = evento.target.closest("[data-pregunta]");

        if (!tarjeta) return;

        const pregunta = tarjeta.getAttribute("data-pregunta");

        if (pregunta && elementos.mensaje) {
            elementos.mensaje.value = pregunta;
            ajustarAlturaTexto();
            elementos.mensaje.focus();
        }
    });

    // El HTML conserva el control principal del menú lateral.
    // Evita registrar un segundo evento que abra y cierre el menú.

    document.addEventListener("keydown", evento => {
        if (evento.key === "Escape") {
            cerrarSidebarEnMovil();
            detenerLectura();
        }
    });

    window.addEventListener("resize", () => {
        if (window.innerWidth > 760) {
            cerrarSidebarEnMovil();
        }
    });

    window.addEventListener("beforeunload", () => {
        detenerLectura();
        detenerDictado();
    });
}

/* =====================================================
   INICIALIZACIÓN
===================================================== */

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
    actualizarBotonLectura(false);
    actualizarBotonDictado(false);
}

if (document.readyState === "loading") {
    document.addEventListener(
        "DOMContentLoaded",
        iniciarIA,
        { once: true }
    );
} else {
    iniciarIA();
}
