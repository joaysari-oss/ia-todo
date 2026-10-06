// IA TODO - Frontend con historial en sidebar + Galería de Imágenes + Gemini + Opción de Eliminar Chat + Botón Colapsar Sidebar

const chat = document.getElementById('chat');
const input = document.getElementById('input');
const sendBtn = document.getElementById('send');
const typing = document.getElementById('typing');
const btnMic = document.getElementById('btnMic');
const btnCamera = document.getElementById('btnCamera');
const btnGallery = document.getElementById('btnGallery');
const btnFile = document.getElementById('btnFile');
const btnNewChat = document.getElementById('btnNewChat');
const btnNewChatSidebar = document.getElementById('btnNewChatSidebar');
const creatorBadge = document.getElementById('creatorBadge');
const fileCamera = document.getElementById('fileCamera');
const fileGallery = document.getElementById('fileGallery');
const fileDoc = document.getElementById('fileDoc');

// Elementos del Historial / Sidebar
const sidebar = document.getElementById('sidebar');
const btnToggleSidebar = document.getElementById('btnToggleSidebar');
const btnCloseSidebar = document.getElementById('btnCloseSidebar');
const chatListContainer = document.getElementById('chatList');
const galeriaContainer = document.getElementById('galeria-imagenes');

let reconociendo = false;
let archivoSeleccionado = null;

// Estructura de chats cargada desde localStorage
let chats = JSON.parse(localStorage.getItem('ia_todo_chats') || '[]');
let currentChatId = null;

function saveChats() {
  localStorage.setItem('ia_todo_chats', JSON.stringify(chats));
}

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

// MENSAJE DE BIENVENIDA ACTUALIZADO CON "CREAR IMÁGENES"
function mensajeBienvenida() {
  addMessage('¡Hola! Soy IA TODO.\n\nPuedo ayudarte con cualquier tema, crear imágenes, recibir fotos, documentos y escucharte por micrófono.\n\n¿En qué te ayudo?', 'bot');
}

// --- FUNCIONES DE LA GALERÍA DE IMÁGENES GENERADAS ---
function guardarImagenGaleria(urlImagen) {
  let galeria = JSON.parse(localStorage.getItem('ia_todo_galeria') || '[]');
  if (!galeria.includes(urlImagen)) {
    galeria.unshift(urlImagen);
    localStorage.setItem('ia_todo_galeria', JSON.stringify(galeria));
    renderGaleria();
  }
}

function renderGaleria() {
  if (!galeriaContainer) return;
  let galeria = JSON.parse(localStorage.getItem('ia_todo_galeria') || '[]');
  
  if (galeria.length === 0) {
    galeriaContainer.innerHTML = '<p style="font-size: 0.8rem; color: #888; text-align: center;">Sin imágenes aún</p>';
    return;
  }

  galeriaContainer.innerHTML = '';
  galeria.forEach(url => {
    const imgCard = document.createElement('div');
    imgCard.className = 'galeria-item';
    imgCard.innerHTML = `
      <a href="${url}" target="_blank" title="Ver imagen">
        <img src="${url}" alt="Imagen generada" loading="lazy" style="width: 100%; height: 50px; object-fit: cover; border-radius: 6px;" />
      </a>
    `;
    galeriaContainer.appendChild(imgCard);
  });
}

// Inicializar un nuevo chat
function createNewChat() {
  currentChatId = Date.now().toString();
  chat.innerHTML = '';
  archivoSeleccionado = null;
  fileCamera.value = '';
  fileGallery.value = '';
  fileDoc.value = '';
  input.value = '';
  input.style.height = 'auto';
  mensajeBienvenida();
  renderSidebar();
  renderGaleria();
  input.focus();
}

// Renderizar la lista del historial en la barra lateral con botón para eliminar 🗑️
function renderSidebar() {
  if (!chatListContainer) return;
  chatListContainer.innerHTML = '';

  chats.forEach(c => {
    const item = document.createElement('div');
    item.className = `chat-item ${c.id === currentChatId ? 'active' : ''}`;
    
    const titleSpan = document.createElement('span');
    titleSpan.className = 'chat-title';
    titleSpan.textContent = c.title || 'Nuevo Chat';
    titleSpan.addEventListener('click', () => loadChat(c.id));

    // Botón para eliminar chat (caneca)
    const deleteBtn = document.createElement('button');
    deleteBtn.className = 'btn-delete-chat';
    deleteBtn.innerHTML = '🗑️';
    deleteBtn.title = 'Eliminar conversación';
    deleteBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      deleteChat(c.id);
    });

    item.appendChild(titleSpan);
    item.appendChild(deleteBtn);
    chatListContainer.appendChild(item);
  });
}

// Función para borrar conversación
function deleteChat(id) {
  if (!confirm('¿Deseas eliminar este chat del historial?')) return;

  chats = chats.filter(c => c.id !== id);
  saveChats();

  if (currentChatId === id) {
    if (chats.length > 0) {
      loadChat(chats[0].id);
    } else {
      createNewChat();
    }
  } else {
    renderSidebar();
  }
}

function loadChat(id) {
  const target = chats.find(c => c.id === id);
  if (!target) return;

  currentChatId = target.id;
  chat.innerHTML = '';

  if (target.messages.length === 0) {
    mensajeBienvenida();
  } else {
    target.messages.forEach(m => addMessage(m.content, m.role));
  }

  renderSidebar();
  renderGaleria();
}

btnNewChat.addEventListener('click', createNewChat);
if (btnNewChatSidebar) btnNewChatSidebar.addEventListener('click', createNewChat);

// Eventos para ocultar/mostrar la barra lateral
if (btnCloseSidebar && sidebar) {
  btnCloseSidebar.addEventListener('click', () => {
    sidebar.classList.add('collapsed');
    sidebar.classList.remove('open');
  });
}

if (btnToggleSidebar && sidebar) {
  btnToggleSidebar.addEventListener('click', () => {
    if (sidebar.classList.contains('collapsed')) {
      sidebar.classList.remove('collapsed');
    } else {
      sidebar.classList.toggle('open');
    }
  });
}

async function enviarMensaje(texto, historialActual) {
  const formData = new FormData();
  formData.append('mensaje', texto || '');
  formData.append('historial', JSON.stringify(historialActual));

  if (archivoSeleccionado) {
    formData.append('archivo', archivoSeleccionado);
  }

  try {
    const res = await fetch('/chat', { method: 'POST', body: formData });
    if (!res.ok) throw new Error('Error servidor');
    return await res.json();
  } catch (err) {
    console.error(err);
    return { respuesta: 'Hubo un problema al conectar con el cerebro. Intenta de nuevo.', modo_creador: false };
  }
}

async function generarTituloServer(primerMensaje) {
  try {
    const res = await fetch('/generar_titulo', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ mensaje: primerMensaje })
    });
    const data = await res.json();
    return data.titulo || primerMensaje.substring(0, 20);
  } catch {
    return primerMensaje.substring(0, 20);
  }
}

async function enviar() {
  const texto = input.value.trim();
  if (!texto && !archivoSeleccionado) return;

  if (!currentChatId) createNewChat();

  let activeChat = chats.find(c => c.id === currentChatId);
  if (!activeChat) {
    activeChat = { id: currentChatId, title: 'Nuevo Chat', messages: [] };
    chats.unshift(activeChat);
  }

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

  const esPrimerMensaje = activeChat.messages.length === 0;
  if (texto) {
    activeChat.messages.push({ role: 'user', content: texto });
  }

  input.value = '';
  input.style.height = 'auto';
  sendBtn.disabled = true;
  showTyping(true);

  // Generar título automático si es la primera pregunta
  if (esPrimerMensaje && texto) {
    generarTituloServer(texto).then(nuevoTitulo => {
      activeChat.title = nuevoTitulo;
      saveChats();
      renderSidebar();
    });
  }

  const data = await enviarMensaje(texto, activeChat.messages);
  const respuesta = data.respuesta || 'Sin respuesta';
  const modoCreador = data.modo_creador === true;

  showTyping(false);

  // Si la respuesta incluye una URL de imagen de Pollinations, la guardamos en la Galería
  if (respuesta.includes('pollinations.ai/prompt/')) {
    const match = respuesta.match(/https:\/\/image\.pollinations\.ai\/prompt\/[^\s\)]+/);
    if (match) {
      guardarImagenGaleria(match[0]);
    }
  }

  if (modoCreador) {
    creatorBadge.classList.add('show');
    addMessage(respuesta, 'system');
  } else {
    addMessage(respuesta, 'bot');
  }

  activeChat.messages.push({ role: 'bot', content: respuesta });
  saveChats();

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

// Cargar al inicio
if (chats.length === 0) {
  createNewChat();
} else {
  loadChat(chats[0].id);
}
