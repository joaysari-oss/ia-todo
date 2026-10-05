// IA TODO - Frontend con historial + Modo Creador
const chat = document.getElementById('chat');
const input = document.getElementById('input');
const sendBtn = document.getElementById('send');
const typing = document.getElementById('typing');
const btnMic = document.getElementById('btnMic');
const btnCamera = document.getElementById('btnCamera');
const btnGallery = document.getElementById('btnGallery');
const btnFile = document.getElementById('btnFile');
const btnNewChat = document.getElementById('btnNewChat');
const creatorBadge = document.getElementById('creatorBadge');
const fileCamera = document.getElementById('fileCamera');
const fileGallery = document.getElementById('fileGallery');
const fileDoc = document.getElementById('fileDoc');

let reconociendo = false;
let archivoSeleccionado = null;
let historial = []; // Memoria de la conversación

function scrollBottom() { chat.scrollTop = chat.scrollHeight; }

function addMessage(text, type = 'bot', extra = null) {
  const div = document.createElement('div');
  div.className = `msg ${type}`;

  if (type !== 'system') {
    const avatar = document.createElement('div');
    avatar.className = 'avatar';
    avatar.textContent = type === 'user' ? '👤' : '∞';
    div.appendChild(avatar);
  }

  const bubble = document.createElement('div');
  bubble.className = 'bubble';
  if (typeof text === 'string' && text) bubble.textContent = text;

  if (extra) {
    if (extra.image) {
      const img = document.createElement('img');
      img.src = extra.image;
      img.className = 'media-preview';
      bubble.appendChild(img);
    }
    if (extra.fileName) {
      const chip = document.createElement('div');
      chip.className = 'file-chip';
      chip.textContent = '📄 ' + extra.fileName;
      bubble.appendChild(chip);
    }
  }

  div.appendChild(bubble);
  chat.appendChild(div);
  scrollBottom();
  return div;
}

function showTyping(show) {
  typing.classList.toggle('show', show);
  if (show) scrollBottom();
}

function mensajeBienvenida() {
  addMessage('¡Hola! Soy IA TODO.\n\nPuedo ayudarte con cualquier tema, recibir fotos, documentos y escucharte por micrófono.\n\n¿En qué te ayudo?', 'bot');
}

// Nuevo chat → limpia historial
btnNewChat.addEventListener('click', () => {
  chat.innerHTML = '';
  historial = [];
  archivoSeleccionado = null;
  fileCamera.value = '';
  fileGallery.value = '';
  fileDoc.value = '';
  input.value = '';
  input.style.height = 'auto';
  mensajeBienvenida();
  input.focus();
});

async function enviarMensaje(texto) {
  const formData = new FormData();
  formData.append('mensaje', texto || '');
  formData.append('historial', JSON.stringify(historial));

  if (archivoSeleccionado) {
    formData.append('archivo', archivoSeleccionado);
  }

  try {
    const res = await fetch('/chat', { method: 'POST', body: formData });
    if (!res.ok) throw new Error('Error servidor');
    const data = await res.json();
    return data;
  } catch (err) {
    console.error(err);
    return { respuesta: 'Hubo un problema al conectar con el cerebro. Intenta de nuevo.', modo_creador: false };
  }
}

async function enviar() {
  const texto = input.value.trim();
  if (!texto && !archivoSeleccionado) return;

  // Mostrar mensaje usuario
  if (archivoSeleccionado) {
    if (archivoSeleccionado.type.startsWith('image/')) {
      const reader = new FileReader();
      reader.onload = (e) => {
        addMessage(texto || '📷 Foto enviada', 'user', {
          image: e.target.result,
          fileName: archivoSeleccionado.name
        });
      };
      reader.readAsDataURL(archivoSeleccionado);
    } else {
      addMessage(texto || 'Documento enviado', 'user', { fileName: archivoSeleccionado.name });
    }
  } else {
    addMessage(texto, 'user');
  }

  // Guardar en historial (solo texto)
  if (texto) {
    historial.push({ role: 'user', content: texto });
  }

  input.value = '';
  input.style.height = 'auto';
  sendBtn.disabled = true;
  showTyping(true);

  const data = await enviarMensaje(texto);
  const respuesta = data.respuesta || 'Sin respuesta';
  const modoCreador = data.modo_creador === true;

  showTyping(false);

  if (modoCreador) {
    creatorBadge.classList.add('show');
    addMessage(respuesta, 'system');
  } else {
    addMessage(respuesta, 'bot');
  }

  // Guardar respuesta en historial
  historial.push({ role: 'assistant', content: respuesta });

  archivoSeleccionado = null;
  fileCamera.value = '';
  fileGallery.value = '';
  fileDoc.value = '';
  sendBtn.disabled = false;
  input.focus();
}

sendBtn.addEventListener('click', enviar);
input.addEventListener('keydown', e => {
  if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); enviar(); }
});
input.addEventListener('input', () => {
  input.style.height = 'auto';
  input.style.height = Math.min(input.scrollHeight, 120) + 'px';
});

// Micrófono
const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
let recognition = null;
if (SpeechRecognition) {
  recognition = new SpeechRecognition();
  recognition.lang = 'es-ES';
  recognition.continuous = false;
  recognition.interimResults = false;
  recognition.onstart = () => { reconociendo = true; btnMic.classList.add('recording'); };
  recognition.onresult = (e) => {
    input.value = e.results[0][0].transcript;
    input.style.height = 'auto';
    input.style.height = Math.min(input.scrollHeight, 120) + 'px';
    enviar();
  };
  recognition.onerror = (e) => {
    if (e.error === 'not-allowed') addMessage('Activa el permiso del micrófono (mejor en Chrome o Edge).', 'bot');
    reconociendo = false; btnMic.classList.remove('recording');
  };
  recognition.onend = () => { reconociendo = false; btnMic.classList.remove('recording'); };
  btnMic.addEventListener('click', () => {
    if (reconociendo) recognition.stop();
    else { try { recognition.start(); } catch (e) { addMessage('No se pudo iniciar el micrófono.', 'bot'); } }
  });
} else {
  btnMic.addEventListener('click', () => addMessage('Tu navegador no soporta voz. Usa Chrome o Edge.', 'bot'));
}

// Cámara
btnCamera.addEventListener('click', () => fileCamera.click());
fileCamera.addEventListener('change', e => {
  const f = e.target.files[0]; if (!f) return;
  archivoSeleccionado = f;
  addMessage('📷 Foto tomada. Escribe algo o pulsa Enviar.', 'bot');
});

// Galería
btnGallery.addEventListener('click', () => fileGallery.click());
fileGallery.addEventListener('change', e => {
  const f = e.target.files[0]; if (!f) return;
  archivoSeleccionado = f;
  addMessage('🖼️ Foto de galería lista. Escribe algo o pulsa Enviar.', 'bot');
});

// Documento
btnFile.addEventListener('click', () => fileDoc.click());
fileDoc.addEventListener('change', e => {
  const f = e.target.files[0]; if (!f) return;
  archivoSeleccionado = f;
  addMessage(`📄 Archivo "${f.name}" listo. Escribe algo o pulsa Enviar.`, 'bot');
});

mensajeBienvenida();
