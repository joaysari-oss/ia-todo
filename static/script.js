'use strict';
const $ = (selector) => document.querySelector(selector);
const chat = $('#chat');
const input = $('#input');
const sendBtn = $('#send');
const typing = $('#typing');
const historyKey = 'iatodo';
let history = [];
let busy = false;
let voiceEnabled = localStorage.getItem('iatodo_voz') === '1';

try {
  const saved = JSON.parse(localStorage.getItem(historyKey) || '[]');
  if (Array.isArray(saved)) history = saved;
} catch (_) {
  history = [];
}

const escapeHTML = (value) => String(value).replace(/[&<>"']/g, ch => ({
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;'
}[ch]));

function formatMessage(value) {
  let html = escapeHTML(value);

  // Solo muestra imágenes de los proveedores previstos.
  html = html.replace(
    /!\[([^\]]*)\]\((https:\/\/(?:image\.pollinations\.ai|gen\.pollinations\.ai)\/[^\s)]+)\)/g,
    (_all, alt, url) =>
      `<img class="generated-image" src="${url}" alt="${alt}" loading="lazy" referrerpolicy="no-referrer"><div class="image-loading" hidden>La imagen no se pudo cargar. Abre el enlace de abajo o inténtalo más tarde.</div>`
  );

  html = html.replace(
    /\[([^\]]+)\]\((https:\/\/[^\s)]+)\)/g,
    (_all, label, url) =>
      `<a href="${url}" target="_blank" rel="noopener noreferrer">${label}</a>`
  );

  html = html.replace(
    /```([a-zA-Z0-9_-]*)\n?([\s\S]*?)```/g,
    (_all, _lang, code) => `<pre><code>${code}</code></pre>`
  );

  html = html.replace(/`([^`\n]+)`/g, '<code>$1</code>');
  html = html.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
  html = html.replace(/(^|\n)\* (.+)/g, '$1• $2');

  return html.replace(/\n/g, '<br>');
}

function addMessage(text, role = 'bot', extra = {}) {
  const row = document.createElement('div');
  row.className = `msg ${role === 'user' ? 'user' : 'bot'}`;

  const avatar = document.createElement('div');
  avatar.className = 'avatar';
  avatar.textContent = role === 'user' ? '👤' : '∞';

  const bubble = document.createElement('div');
  bubble.className = 'bubble';

  if (role === 'user') {
    bubble.textContent = text || 'Adjunto enviado';
  } else {
    bubble.innerHTML = formatMessage(text || '');
  }

  if (extra.image) {
    const img = document.createElement('img');
    img.src = extra.image;
    img.className = 'media-preview';
    img.alt = 'Imagen adjunta';
    bubble.appendChild(img);
  }

  bubble.querySelectorAll('.generated-image').forEach(img => {
    img.addEventListener('error', () => {
      const notice = img.nextElementSibling;
      if (notice) notice.hidden = false;
    });
  });

  row.append(avatar, bubble);
  chat.appendChild(row);
  chat.scrollTop = chat.scrollHeight;
  return row;
}

function saveHistory() {
  try {
    localStorage.setItem(historyKey, JSON.stringify(history.slice(-60)));
  } catch (_) {}
}

function setStatus(ok, label) {
  $('#status').classList.toggle('off', !ok);
  $('#statusTxt').textContent = label || (ok ? 'IA activa' : 'Modo básico');
}

function sayAloud(text) {
  if (!voiceEnabled || !('speechSynthesis' in window)) return;

  speechSynthesis.cancel();

  const utterance = new SpeechSynthesisUtterance(
    String(text)
      .replace(/!\[[^\]]*\]\([^)]*\)/g, 'imagen generada')
      .replace(/https?:\/\/\S+/g, '')
      .replace(/[*`#]/g, '')
  );

  utterance.lang = 'es-CO';
  speechSynthesis.speak(utterance);
}

function welcome() {
  addMessage(
    '¡Hola! Soy IA TODO.\n\nPuedo conversar, ayudarte a investigar, crear imágenes (si el servicio externo está disponible), analizar fotos con un modelo compatible y leer documentos de texto.\n\n¿En qué te ayudo?'
  );

  const suggestions = document.createElement('div');
  suggestions.className = 'suggestions';

  [
    'Explícame la inteligencia artificial',
    'Busca en internet noticias sobre tecnología',
    'Crea una imagen de un dragón azul',
    'Resume este tema paso a paso'
  ].forEach(label => {
    const button = document.createElement('button');
    button.className = 'chip';
    button.textContent = label;
    button.addEventListener('click', () => {
      suggestions.remove();
      sendMessage(label);
    });
    suggestions.appendChild(button);
  });

  chat.appendChild(suggestions);
}

function renderHistory() {
  chat.innerHTML = '';

  if (!history.length) {
    welcome();
    return;
  }

  history.forEach(item => {
    addMessage(
      item.texto || item.content || '',
      (item.rol === 'user' || item.role === 'user') ? 'user' : 'bot',
      item.img ? {image: item.img} : {}
    );
  });
}

async function sendToServer(message, imageData) {
  const payload = {
    mensaje: message,
    historial: history.slice(-14).map(item => ({
      rol: item.rol,
      texto: item.texto
    })),
    imagen: imageData || null
  };

  const response = await fetch('/api/chat', {
    method: 'POST',
    headers: {'Content-Type': 'application/json'},
    body: JSON.stringify(payload)
  });

  let data = {};
  try {
    data = await response.json();
  } catch (_) {}

  if (!response.ok) {
    throw new Error(data.error || `Error del servidor (${response.status})`);
  }

  return data;
}

async function sendMessage(text = input.value, options = {}) {
  text = String(text || '').trim();

  if ((!text && !options.imageData && !options.fileText) || busy) return;

  if (options.fileText) {
    text = `${text || 'Resume y explica este documento.'}\n\nContenido del archivo «${options.fileName || 'documento'}»:\n${options.fileText.slice(0, 12000)}`;
  }

  busy = true;
  sendBtn.disabled = true;
  input.value = '';
  input.style.height = 'auto';

  const visible = options.visibleText || text || 'Describe esta imagen.';

  history.push({
    rol: 'user',
    texto: visible,
    img: options.previewImage || undefined
  });

  addMessage(
    visible,
    'user',
    options.previewImage ? {image: options.previewImage} : {}
  );

  typing.classList.add('show');
  chat.scrollTop = chat.scrollHeight;

  try {
    const data = await sendToServer(
      text || 'Describe esta imagen.',
      options.imageData || null
    );

    const answer = data.texto || data.respuesta || 'No recibí una respuesta.';

    setStatus(true, data.modo_creador ? 'Modo creador' : 'IA activa');
    history.push({rol: 'bot', texto: answer});
    addMessage(answer, 'bot');
    sayAloud(answer);
    saveHistory();

  } catch (error) {
    setStatus(false, 'Error de conexión');

    const errorMessage =
      `No pude conectar con el servidor: ${error.message}\n\n` +
      'Comprueba que el alojamiento esté activo y que GROQ_API_KEY esté configurada en sus variables de entorno.';

    history.push({rol: 'bot', texto: errorMessage});
    addMessage(errorMessage, 'bot');
    saveHistory();

  } finally {
    typing.classList.remove('show');
    busy = false;
    sendBtn.disabled = false;
    input.focus();
  }
}

sendBtn.addEventListener('click', () => sendMessage());

input.addEventListener('keydown', event => {
  if (event.key === 'Enter' && !event.shiftKey) {
    event.preventDefault();
    sendMessage();
  }
});

input.addEventListener('input', () => {
  input.style.height = 'auto';
  input.style.height = Math.min(input.scrollHeight, 130) + 'px';
});

$('#btnNuevo').addEventListener('click', () => {
  if (busy) return;
  history = [];
  saveHistory();
  chat.innerHTML = '';
  welcome();
  input.focus();
});

$('#btnVoz').classList.toggle('on', voiceEnabled);

$('#btnVoz').addEventListener('click', () => {
  voiceEnabled = !voiceEnabled;
  localStorage.setItem('iatodo_voz', voiceEnabled ? '1' : '0');
  $('#btnVoz').classList.toggle('on', voiceEnabled);

  if (!voiceEnabled && 'speechSynthesis' in window) {
    speechSynthesis.cancel();
  }
});

// Micrófono del navegador.
const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;

if (SpeechRecognition) {
  const recognition = new SpeechRecognition();
  recognition.lang = 'es-CO';
  recognition.interimResults = false;
  recognition.continuous = false;

  recognition.onstart = () => $('#btnMic').classList.add('on');
  recognition.onend = () => $('#btnMic').classList.remove('on');

  recognition.onresult = event => {
    input.value = event.results[0][0].transcript;
    sendMessage();
  };

  recognition.onerror = event => {
    if (event.error === 'not-allowed') {
      addMessage('Permite el uso del micrófono en tu navegador para dictar preguntas.');
    }
  };

  $('#btnMic').addEventListener('click', () => {
    try {
      recognition.start();
    } catch (_) {}
  });

} else {
  $('#btnMic').addEventListener('click', () => {
    addMessage('Tu navegador no tiene reconocimiento de voz disponible. Prueba Chrome o Edge.');
  });
}

// Foto: reducir el tamaño para no enviar cargas enormes.
$('#btnCamera').addEventListener('click', () => $('#cameraInput').click());

$('#cameraInput').addEventListener('change', event => {
  const file = event.target.files && event.target.files[0];
  if (!file) return;

  const reader = new FileReader();

  reader.onload = e => {
    const image = new Image();

    image.onload = () => {
      const scale = Math.min(
        1,
        1024 / Math.max(image.width, image.height)
      );

      const canvas = document.createElement('canvas');
      canvas.width = Math.round(image.width * scale);
      canvas.height = Math.round(image.height * scale);

      canvas.getContext('2d').drawImage(
        image, 0, 0, canvas.width, canvas.height
      );

      const dataUrl = canvas.toDataURL('image/jpeg', .78);

      sendMessage(
        input.value.trim() || 'Describe esta imagen y dime qué observas.',
        {
          imageData: {
            mime: 'image/jpeg',
            data: dataUrl.split(',')[1]
          },
          previewImage: dataUrl,
          visibleText: input.value.trim() || '📷 Analiza esta foto'
        }
      );
    };

    image.onerror = () => {
      addMessage('No pude abrir esa imagen. Prueba con JPG, PNG o WEBP.');
    };

    image.src = e.target.result;
  };

  reader.readAsDataURL(file);
  event.target.value = '';
});

// Archivos de texto y código. PDF y DOCX no están habilitados aquí.
$('#btnFile').addEventListener('click', () => $('#fileInput').click());

$('#fileInput').addEventListener('change', event => {
  const file = event.target.files && event.target.files[0];
  if (!file) return;

  const allowed = /\.(txt|md|csv|json|py|html|css|js|xml|yaml|yml|log)$/i;

  if (!allowed.test(file.name)) {
    addMessage(
      'Este archivo no es compatible todavía. Usa TXT, MD, CSV, JSON, PY, HTML, CSS, JS, XML, YAML o LOG.'
    );
    event.target.value = '';
    return;
  }

  const reader = new FileReader();

  reader.onload = e => sendMessage(input.value.trim(), {
    fileText: String(e.target.result || ''),
    fileName: file.name,
    visibleText: `📄 ${file.name} — ${input.value.trim() || 'Resume y explica este documento.'}`
  });

  reader.onerror = () => addMessage('No pude leer ese archivo.');

  reader.readAsText(file);
  event.target.value = '';
});

renderHistory();

fetch('/health')
  .then(r => {
    if (!r.ok) throw new Error('offline');
    return r.json();
  })
  .then(() => setStatus(true, 'Servidor conectado'))
  .catch(() => setStatus(false, 'Servidor sin conexión'));

if ('serviceWorker' in navigator && location.protocol === 'https:') {
  navigator.serviceWorker.register('/sw.js').catch(() => {});
}
