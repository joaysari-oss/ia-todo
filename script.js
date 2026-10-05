// ============================================================
// IA TODO - Frontend que se conecta al cerebro Gemini (Flask)
// ============================================================

const chat = document.getElementById('chat');
const input = document.getElementById('input');
const sendBtn = document.getElementById('send');
const typing = document.getElementById('typing');
const btnMic = document.getElementById('btnMic');
const btnFile = document.getElementById('btnFile');
const fileInput = document.getElementById('fileInput');

let reconociendo = false;
let archivoSeleccionado = null;

// ---------- Utilidades ----------
function scrollBottom() {
  chat.scrollTop = chat.scrollHeight;
}

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

  if (typeof text === 'string' && text) {
    bubble.textContent = text;
  }

  if (extra) {
    if (extra.image) {
      const img = document.createElement('img');
      img.src = extra.image;
      img.className = 'media-preview';
      img.alt = 'Imagen enviada';
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

// ---------- Enviar mensaje al backend (tu cerebro Gemini) ----------
async function enviarMensaje(texto) {
  const formData = new FormData();
  formData.append('mensaje', texto || '');

  if (archivoSeleccionado) {
    formData.append('archivo', archivoSeleccionado);
  }

  try {
    const res = await fetch('/chat', {
      method: 'POST',
      body: formData
    });

    if (!res.ok) throw new Error('Error en el servidor');

    const data = await res.json();
    return data.respuesta || 'No recibí respuesta del servidor.';
  } catch (err) {
    console.error(err);
    return 'Hubo un problema al conectar con el cerebro. Intenta de nuevo en unos segundos.';
  }
}

// ---------- Enviar ----------
async function enviar() {
  const texto = input.value.trim();
  if (!texto && !archivoSeleccionado) return;

  // Mostrar mensaje del usuario
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
      addMessage(texto || 'Documento enviado', 'user', {
        fileName: archivoSeleccionado.name
      });
    }
  } else {
    addMessage(texto, 'user');
  }

  input.value = '';
  input.style.height = 'auto';
  sendBtn.disabled = true;

  showTyping(true);

  const respuesta = await enviarMensaje(texto);

  showTyping(false);
  addMessage(respuesta, 'bot');

  // Limpiar archivo después de enviar
  archivoSeleccionado = null;
  fileInput.value = '';
  sendBtn.disabled = false;
  input.focus();
}

sendBtn.addEventListener('click', enviar);

input.addEventListener('keydown', (e) => {
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault();
    enviar();
  }
});

input.addEventListener('input', () => {
  input.style.height = 'auto';
  input.style.height = Math.min(input.scrollHeight, 120) + 'px';
});

// ---------- Micrófono (voz a texto) ----------
const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
let recognition = null;

if (SpeechRecognition) {
  recognition = new SpeechRecognition();
  recognition.lang = 'es-ES';
  recognition.continuous = false;
  recognition.interimResults = false;

  recognition.onstart = () => {
    reconociendo = true;
    btnMic.classList.add('recording');
    btnMic.title = 'Escuchando... (clic para detener)';
  };

  recognition.onresult = (event) => {
    const transcript = event.results[0][0].transcript;
    input.value = transcript;
    input.style.height = 'auto';
    input.style.height = Math.min(input.scrollHeight, 120) + 'px';
    enviar(); // Envía automáticamente lo que dijo
  };

  recognition.onerror = (event) => {
    if (event.error === 'not-allowed') {
      addMessage('No tengo permiso para usar el micrófono. Actívalo en la configuración del navegador (mejor en Chrome o Edge).', 'bot');
    }
    reconociendo = false;
    btnMic.classList.remove('recording');
    btnMic.title = 'Hablar (voz a texto) — Mejor en Chrome/Edge';
  };

  recognition.onend = () => {
    reconociendo = false;
    btnMic.classList.remove('recording');
    btnMic.title = 'Hablar (voz a texto) — Mejor en Chrome/Edge';
  };

  btnMic.addEventListener('click', () => {
    if (reconociendo) {
      recognition.stop();
    } else {
      try {
        recognition.start();
      } catch (e) {
        addMessage('No se pudo iniciar el micrófono. Prueba en Chrome o Edge.', 'bot');
      }
    }
  });
} else {
  btnMic.addEventListener('click', () => {
    addMessage('Tu navegador no soporta reconocimiento de voz. Prueba con Chrome o Edge.', 'bot');
  });
}

// ---------- Archivos / Fotos ----------
btnFile.addEventListener('click', () => fileInput.click());

fileInput.addEventListener('change', (e) => {
  const file = e.target.files[0];
  if (!file) return;
  archivoSeleccionado = file;

  // Feedback visual
  if (file.type.startsWith('image/')) {
    addMessage('📷 Foto lista para enviar. Escribe un mensaje o pulsa Enviar.', 'bot');
  } else {
    addMessage(`📄 Archivo "${file.name}" listo para enviar. Escribe un mensaje o pulsa Enviar.`, 'bot');
  }
});

// ---------- Mensaje de bienvenida ----------
addMessage(
  '¡Hola! Soy IA TODO.\n\nPuedo ayudarte con casi cualquier cosa, recibir fotos y documentos, y escucharte por micrófono.\n\n¿En qué te ayudo?',
  'bot'
);
