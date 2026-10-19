
"use strict";

const $ = id => document.getElementById(id);
const STORAGE_KEY = "iatodo_chats_v2";

let chats = [];
let activeChatId = null;
let attachedImage = null;
let attachedText = "";
let lastAnswer = "";

try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
    if (Array.isArray(saved)) {
        chats = saved.filter(c => c && c.id && Array.isArray(c.messages));
    }
} catch (_) {
    chats = [];
}

function makeId() {
    return Date.now().toString(36) +
        Math.random().toString(36).slice(2, 8);
}

function saveChats() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(chats));
}

function currentChat() {
    return chats.find(c => c.id === activeChatId);
}

function createChat() {
    const chat = {
        id: makeId(),
        title: "Nueva conversación",
        messages: [],
        createdAt: Date.now()
    };

    chats.unshift(chat);
    activeChatId = chat.id;
    saveChats();
    renderAll();
    $("messageInput").focus();
}

function ensureChat() {
    if (!currentChat()) createChat();
    return currentChat();
}

function makeTitle(text) {
    const title = text.replace(/\s+/g, " ").trim();
    if (!title) return "Nueva conversación";
    return title.length > 38 ? title.slice(0, 38) + "…" : title;
}

function renderHistory() {
    const list = $("chatList");
    list.replaceChildren();

    chats.forEach(chat => {
        const row = document.createElement("div");
        row.className = "chat-row" +
            (chat.id === activeChatId ? " active" : "");

        const open = document.createElement("button");
        open.className = "chat-open";
        open.textContent = chat.title;
        open.title = chat.title;
        open.onclick = () => {
            activeChatId = chat.id;
            renderAll();
        };

        const share = document.createElement("button");
        share.className = "icon-btn";
        share.textContent = "↗";
        share.title = "Compartir conversación";
        share.onclick = () => shareChat(chat);

        const remove = document.createElement("button");
        remove.className = "icon-btn";
        remove.textContent = "🗑";
        remove.title = "Eliminar esta conversación";

        remove.onclick = () => {
            if (!confirm("¿Eliminar solamente esta conversación?")) return;

            chats = chats.filter(c => c.id !== chat.id);

            if (activeChatId === chat.id) {
                activeChatId = chats[0]?.id || null;
            }

            saveChats();
            renderAll();
        };

        row.append(open, share, remove);
        list.appendChild(row);
    });
}

function renderMessages() {
    const container = $("messages");
    container.replaceChildren();

    const chat = currentChat();
    $("currentTitle").textContent =
        chat?.title || "Nueva conversación";

    if (!chat || chat.messages.length === 0) {
        const welcome = document.createElement("div");
        welcome.className = "welcome";

        const title = document.createElement("h1");
        title.textContent = "¿En qué te ayudo hoy?";

        const description = document.createElement("p");
        description.textContent =
            "Pregunta, escribe o adjunta una imagen.";

        welcome.append(title, description);
        container.appendChild(welcome);
        return;
    }

    chat.messages.forEach(message => {
        const bubble = document.createElement("div");
        bubble.className = "bubble " +
            (message.rol === "user" ? "user" : "assistant");

        bubble.textContent = message.texto;
        container.appendChild(bubble);
    });

    container.scrollTop = container.scrollHeight;
}

function renderAll() {
    renderHistory();
    renderMessages();
}

function addMessage(rol, texto) {
    const chat = ensureChat();

    chat.messages.push({ rol, texto });

    if (rol === "user" && chat.title === "Nueva conversación") {
        chat.title = makeTitle(texto);
    }

    saveChats();
    renderAll();
}

function chatToText(chat) {
    return chat.title + "\n\n" + chat.messages.map(message => {
        const speaker = message.rol === "user" ? "Tú" : "IA TODO";
        return speaker + ":\n" + message.texto;
    }).join("\n\n");
}

async function shareChat(chat) {
    const text = chatToText(chat);

    if (navigator.share) {
        try {
            await navigator.share({
                title: chat.title,
                text: text
            });
            return;
        } catch (error) {
            if (error.name === "AbortError") return;
        }
    }

    try {
        await navigator.clipboard.writeText(text);
        alert("Conversación copiada. Ya puedes pegarla en Facebook u otra aplicación.");
    } catch (_) {
        const area = document.createElement("textarea");
        area.value = text;
        document.body.appendChild(area);
        area.select();

        const copied = document.execCommand("copy");
        area.remove();

        alert(copied
            ? "Conversación copiada."
            : "No se pudo copiar automáticamente. Selecciona y copia el texto.");
    }
}

function readFile(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.onerror = reject;
        reader.readAsDataURL(file);
    });
}

async function sendMessage() {
    const input = $("messageInput");
    let mensaje = input.value.trim();

    if (attachedText) {
        mensaje += (mensaje ? "\n\n" : "") +
            "Contenido del archivo:\n" + attachedText;
    }

    if (!mensaje && !attachedImage) return;

    ensureChat();

    // Solo enviamos al servidor los mensajes anteriores a este turno.
    const historial = currentChat().messages.slice();

    addMessage("user", mensaje || "Analiza la imagen adjunta.");

    input.value = "";
    $("sendBtn").disabled = true;
    $("statusText").textContent = "● Pensando…";

    try {
        const response = await fetch("/api/chat", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                mensaje: mensaje,
                historial: historial,
                imagen: attachedImage
            })
        });

        const data = await response.json();

        if (!response.ok && !data.texto) {
            throw new Error("Error del servidor");
        }

        const answer = data.texto || data.respuesta ||
            "No recibí una respuesta.";

        lastAnswer = answer;
        addMessage("assistant", answer);

        if (data.modo_creador === true) {
            $("statusText").textContent = "★ Modo creador activo";
        } else {
            $("statusText").textContent = "● En línea";
        }
    } catch (_) {
        addMessage(
            "assistant",
            "No pude conectarme con el servidor. Revisa los registros de Render."
        );
        $("statusText").textContent = "● Error de conexión";
    } finally {
        attachedImage = null;
        attachedText = "";
        $("attachmentNote").textContent = "";
        $("sendBtn").disabled = false;
    }
}

$("newChatBtn").addEventListener("click", createChat);
$("sendBtn").addEventListener("click", sendMessage);

$("messageInput").addEventListener("keydown", event => {
    if (event.key === "Enter" && !event.shiftKey) {
        event.preventDefault();
        sendMessage();
    }
});

$("creatorBtn").addEventListener("click", () => {
    $("messageInput").value = "creador_joao_777";
    sendMessage();
});

$("imageBtn").addEventListener("click", () => {
    $("imageInput").click();
});

$("fileBtn").addEventListener("click", () => {
    $("fileInput").click();
});

$("imageInput").addEventListener("change", async event => {
    const file = event.target.files?.[0];
    if (!file) return;

    try {
        const dataUrl = await readFile(file);

        attachedImage = {
            mime: file.type || "image/jpeg",
            data: dataUrl.split(",")[1]
        };

        $("attachmentNote").textContent =
            "Imagen adjunta: " + file.name;
    } catch (_) {
        alert("No pude leer la imagen.");
    }

    event.target.value = "";
});

$("fileInput").addEventListener("change", async event => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (file.size > 1000000) {
        alert("Este ejemplo admite archivos de texto de hasta 1 MB.");
        event.target.value = "";
        return;
    }

    try {
        attachedText = await file.text();
        $("attachmentNote").textContent =
            "Archivo adjunto: " + file.name;
    } catch (_) {
        alert("No pude leer el archivo.");
    }

    event.target.value = "";
});

$("speakBtn").addEventListener("click", () => {
    if (!lastAnswer) {
        alert("Primero debes recibir una respuesta.");
        return;
    }

    if (!("speechSynthesis" in window)) {
        alert("Tu navegador no admite lectura en voz alta.");
        return;
    }

    speechSynthesis.cancel();

    const utterance = new SpeechSynthesisUtterance(lastAnswer);
    utterance.lang = "es-CO";
    speechSynthesis.speak(utterance);
});

const SpeechRecognition =
    window.SpeechRecognition || window.webkitSpeechRecognition;

$("micBtn").addEventListener("click", () => {
    if (!SpeechRecognition) {
        alert("El dictado por voz no está disponible en este navegador.");
        return;
    }

    const recognition = new SpeechRecognition();
    recognition.lang = "es-CO";
    recognition.interimResults = false;

    recognition.onresult = event => {
        const text = event.results[0][0].transcript;
        const input = $("messageInput");

        input.value += (input.value ? " " : "") + text;
        input.focus();
    };

    recognition.onerror = () => {
        alert("No pude reconocer la voz. Comprueba el permiso del micrófono.");
    };

    recognition.start();
});

if (!currentChat() && chats.length > 0) {
    activeChatId = chats[0].id;
}

if (!currentChat()) {
    createChat();
} else {
    renderAll();
}
