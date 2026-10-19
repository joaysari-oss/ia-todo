
const $ = (id) => document.getElementById(id);

const mensajesEl = $("mensajes");
const bienvenidaEl = $("bienvenida");
const entrada = $("mensaje");
const enviarBtn = $("enviarBtn");
const estadoEl = $("estado");
const listaChats = $("listaChats");
const imagenInput = $("imagenInput");
const archivoInput = $("archivoInput");
const archivoNombre = $("archivoNombre");

let chats = [];
let chatActualId = null;
let imagenAdjunta = null;
let textoArchivo = "";
let ocupado = false;
let reconocimiento = null;

try {
  chats = JSON.parse(localStorage.getItem("iatodo_chats_v2") || "[]");
  if (!Array.isArray(chats)) chats = [];
} catch {
  chats = [];
}

function guardar() {
  try {
    localStorage.setItem("iatodo_chats_v2", JSON.stringify(chats));
  } catch (error) {
    console.error("No se pudo guardar el historial:", error);
  }
}

function crearChat() {
  const chat = {
    id: String(Date.now()) + Math.random().toString(36).slice(2, 7),
    titulo: "Nueva conversación",
    mensajes: []
  };

  chats.unshift(chat);
  chatActualId = chat.id;
  guardar();
  renderizarTodo();
  entrada.focus();
}

function chatActual() {
  return chats.find((chat) => chat.id === chatActualId);
}

function asegurarChat() {
  if (!chatActual()) crearChat();
  return chatActual();
}

function textoPlano(texto) {
  return String(texto ?? "");
}

function agregarMensaje(rol, texto, imagen = null) {
  const chat = asegurarChat();

  chat.mensajes.push({
    rol,
    texto: textoPlano(texto),
    imagen: imagen || null
  });

  if (
    chat.titulo === "Nueva conversación" &&
    rol === "user" &&
    texto.trim()
  ) {
    chat.titulo = texto.trim().slice(0, 42);
    if (texto.trim().length > 42) chat.titulo += "...";
  }

  guardar();
  renderizarMensajes();
  renderizarLista();
}

function renderizarMensajes() {
  mensajesEl.replaceChildren();
  const chat = chatActual();

  if (!chat || chat.mensajes.length === 0) {
    const bienvenida = document.createElement("div");
    bienvenida.className = "bienvenida";

    const titulo = document.createElement("h1");
    titulo.textContent = "¿En qué te puedo ayudar?";

    const descripcion = document.createElement("p");
    descripcion.textContent =
      "Pregunta, escribe, adjunta una imagen o dicta tu mensaje.";

    bienvenida.append(titulo, descripcion);
    mensajesEl.appendChild(bienvenida);
    return;
  }

  for (const item of chat.mensajes) {
    const fila = document.createElement("div");
    fila.className = "mensaje " +
      (item.rol === "user" ? "usuario" : "asistente");

    const avatar = document.createElement("div");
    avatar.className = "avatar";
    avatar.textContent = item.rol === "user" ? "Tú" : "IA";

    const contenido = document.createElement("div");
    contenido.className = "contenido";
    contenido.textContent = item.texto || "";

    if (item.imagen) {
      const imagen = document.createElement("img");
      imagen.src = item.imagen;
      imagen.alt = "Imagen adjunta";
      contenido.appendChild(imagen);
    }

    fila.append(avatar, contenido);
    mensajesEl.appendChild(fila);
  }

  mensajesEl.scrollTop = mensajesEl.scrollHeight;
}

function renderizarLista() {
  listaChats.replaceChildren();

  for (const chat of chats) {
    const fila = document.createElement("div");
    fila.className = "chat-item" +
      (chat.id === chatActualId ? " activo" : "");

    const abrir = document.createElement("button");
    abrir.className = "abrir-chat";
    abrir.textContent = chat.titulo || "Nueva conversación";
    abrir.title = abrir.textContent;
    abrir.addEventListener("click", () => {
      chatActualId = chat.id;
      guardar();
      renderizarTodo();
      $("sidebar").classList.remove("abierta");
    });

    const eliminar = document.createElement("button");
    eliminar.className = "eliminar";
    eliminar.textContent = "🗑";
    eliminar.title = "Eliminar esta conversación";
    eliminar.setAttribute("aria-label", "Eliminar conversación");

    eliminar.addEventListener("click", () => {
      if (!confirm("¿Quieres eliminar esta conversación?")) return;

      chats = chats.filter((c) => c.id !== chat.id);

      if (chatActualId === chat.id) {
        chatActualId = chats.length ? chats[0].id : null;
      }

      guardar();
      renderizarTodo();
    });

    fila.append(abrir, eliminar);
    listaChats.appendChild(fila);
  }
}

function renderizarTodo() {
  renderizarLista();
  renderizarMensajes();
}

function establecerEstado(texto, error = false) {
  estadoEl.textContent = texto;
  estadoEl.style.color = error ? "#ff9292" : "#a9e8bd";
}

async function enviarMensaje() {
  if (ocupado) return;

  const textoOriginal = entrada.value.trim();
  const texto = textoArchivo
    ? textoOriginal + "\n\nContenido del archivo adjunto:\n" + textoArchivo
    : textoOriginal;

  if (!texto && !imagenAdjunta) {
    establecerEstado("Escribe un mensaje o adjunta una imagen.", true);
    entrada.focus();
    return;
  }

  asegurarChat();

  const imagenParaEnviar = imagenAdjunta;

  agregarMensaje(
    "user",
    textoOriginal || (imagenParaEnviar ? "Analiza esta imagen." : ""),
    imagenParaEnviar
  );

  const historialChat = chatActual().mensajes
    .slice(0, -1)
    .filter((m) => m.rol === "user" || m.rol === "assistant")
    .map((m) => ({
      rol: m.rol,
      texto: m.texto
    }));

  entrada.value = "";
  imagenAdjunta = null;
  textoArchivo = "";
  imagenInput.value = "";
  archivoInput.value = "";
  archivoNombre.textContent = "";

  ocupado = true;
  enviarBtn.disabled = true;
  enviarBtn.textContent = "Pensando...";
  establecerEstado("● IA TODO está pensando...");

  try {
    const respuesta = await fetch("/api/chat", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        mensaje: texto,
        historial: historialChat,
        imagen: imagenParaEnviar
          ? {
              mime: imagenParaEnviar.mime,
              data: imagenParaEnviar.data
            }
          : null
      })
    });

    const datos = await respuesta.json().catch(() => ({}));

    if (!respuesta.ok) {
      throw new Error(
        datos.texto || "Error del servidor: " + respuesta.status
      );
    }

    if (typeof datos.texto !== "string") {
      throw new Error("El servidor no devolvió una respuesta válida.");
    }

    agregarMensaje("assistant", datos.texto);
    establecerEstado("● Lista para ayudarte");
  } catch (error) {
    console.error("Error al enviar mensaje:", error);
    agregarMensaje(
      "assistant",
      "No pude enviar el mensaje: " +
      (error.message || "error de conexión") +
      "\n\nRevisa los registros de Render y vuelve a intentarlo."
    );
    establecerEstado("● Error de conexión", true);
  } finally {
    ocupado = false;
    enviarBtn.disabled = false;
    enviarBtn.textContent = "Enviar ↑";
    entrada.focus();
  }
}

enviarBtn.addEventListener("click", enviarMensaje);

entrada.addEventListener("keydown", (evento) => {
  if (evento.key === "Enter" && !evento.shiftKey) {
    evento.preventDefault();
    enviarMensaje();
  }
});

$("nuevoChat").addEventListener("click", crearChat);

$("fotoBtn").addEventListener("click", () => imagenInput.click());
$("archivoBtn").addEventListener("click", () => archivoInput.click());

imagenInput.addEventListener("change", () => {
  const archivo = imagenInput.files?.[0];
  if (!archivo) return;

  if (!archivo.type.startsWith("image/")) {
    establecerEstado("Selecciona un archivo de imagen.", true);
    imagenInput.value = "";
    return;
  }

  if (archivo.size > 5 * 1024 * 1024) {
    establecerEstado("La imagen debe pesar menos de 5 MB.", true);
    imagenInput.value = "";
    return;
  }

  const lector = new FileReader();

  lector.onload = () => {
    const resultado = String(lector.result || "");
    const partes = resultado.split(",");

    imagenAdjunta = {
      mime: archivo.type || "image/jpeg",
      data: partes.length > 1 ? partes[1] : ""
    };

    archivoNombre.textContent = "Imagen lista: " + archivo.name;
    establecerEstado("● Imagen adjunta");
  };

  lector.onerror = () => {
    establecerEstado("No se pudo leer la imagen.", true);
  };

  lector.readAsDataURL(archivo);
});

archivoInput.addEventListener("change", async () => {
  const archivo = archivoInput.files?.[0];
  if (!archivo) return;

  if (archivo.size > 1024 * 1024) {
    establecerEstado("El archivo debe pesar menos de 1 MB.", true);
    archivoInput.value = "";
    return;
  }

  try {
    textoArchivo = await archivo.text();
    archivoNombre.textContent = "Archivo listo: " + archivo.name;
    establecerEstado("● Archivo adjunto");
  } catch {
    textoArchivo = "";
    establecerEstado("No se pudo leer el archivo.", true);
  }
});

$("borrarAdjuntoBtn").addEventListener("click", () => {
  imagenAdjunta = null;
  textoArchivo = "";
  imagenInput.value = "";
  archivoInput.value = "";
  archivoNombre.textContent = "";
  establecerEstado("● Archivo eliminado");
});

$("compartirBtn").addEventListener("click", async () => {
  const chat = chatActual();

  if (!chat || chat.mensajes.length === 0) {
    establecerEstado("No hay mensajes para compartir.", true);
    return;
  }

  const contenido = chat.mensajes
    .map((m) => (m.rol === "user" ? "Tú: " : "IA TODO: ") + m.texto)
    .join("\n\n");

  try {
    if (navigator.share) {
      await navigator.share({
        title: chat.titulo || "Conversación con IA TODO",
        text: contenido
      });
    } else {
      await navigator.clipboard.writeText(contenido);
      establecerEstado("● Conversación copiada para compartir");
    }
  } catch (error) {
    if (error.name !== "AbortError") {
      establecerEstado("No se pudo compartir la conversación.", true);
    }
  }
});

$("leerBtn").addEventListener("click", () => {
  if (!("speechSynthesis" in window)) {
    establecerEstado("Tu navegador no admite lectura en voz alta.", true);
    return;
  }

  const chat = chatActual();
  const ultimo = chat?.mensajes
    .slice()
    .reverse()
    .find((m) => m.rol === "assistant" && m.texto);

  if (!ultimo) {
    establecerEstado("Todavía no hay una respuesta para leer.", true);
    return;
  }

  speechSynthesis.cancel();
  const voz = new SpeechSynthesisUtterance(ultimo.texto);
  voz.lang = "es-CO";
  speechSynthesis.speak(voz);
});

$("dictarBtn").addEventListener("click", () => {
  const SpeechRecognition =
    window.SpeechRecognition || window.webkitSpeechRecognition;

  if (!SpeechRecognition) {
    establecerEstado(
      "Tu navegador no admite dictado por voz. Prueba Chrome.",
      true
    );
    return;
  }

  if (reconocimiento) {
    reconocimiento.stop();
    reconocimiento = null;
    establecerEstado("● Dictado detenido");
    return;
  }

  reconocimiento = new SpeechRecognition();
  reconocimiento.lang = "es-CO";
  reconocimiento.interimResults = false;
  reconocimiento.continuous = false;

  reconocimiento.onresult = (evento) => {
    const resultado = evento.results[0][0].transcript;
    entrada.value = (entrada.value + " " + resultado).trim();
    entrada.focus();
  };

  reconocimiento.onerror = () => {
    establecerEstado("No se pudo reconocer la voz.", true);
  };

  reconocimiento.onend = () => {
    reconocimiento = null;
    if (!ocupado) establecerEstado("● Lista para ayudarte");
  };

  establecerEstado("● Escuchando...");
  reconocimiento.start();
});

$("menuBtn").addEventListener("click", () => {
  $("sidebar").classList.toggle("abierta");
});

if (chats.length) {
  chatActualId = chats[0].id;
} else {
  crearChat();
}

renderizarTodo();

