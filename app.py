import streamlit as st
import os
import google.generativeai as genai

# Configuración de página
st.set_page_config(page_title="IA Todo", page_icon="🤖")

st.title("🤖 IA Todo")

# Configurar API Key
api_key = st.secrets.get("GOOGLE_API_KEY") or os.getenv("GOOGLE_API_KEY")

if not api_key:
    st.error("⚠️ Configura la GOOGLE_API_KEY en los secretos de Streamlit.")
else:
    genai.configure(api_key=api_key)
    
    # Modelo configurado directamente
    model = genai.GenerativeModel('gemini-1.5-flash')

    # Historial de chat
    if "messages" not in st.session_state:
        st.session_state.messages = []

    # Mostrar historial
    for message in st.session_state.messages:
        with st.chat_message(message["role"]):
            st.markdown(message["content"])

    # Input de chat
    if prompt := st.chat_input("Escribe tu mensaje..."):
        st.session_state.messages.append({"role": "user", "content": prompt})
        with st.chat_message("user"):
            st.markdown(prompt)

        with st.chat_message("assistant"):
            with st.spinner("Pensando..."):
                try:
                    # Chat continuo
                    chat = model.start_chat(history=[
                        {"role": m["role"], "parts": [m["content"]]} 
                        for m in st.session_state.messages[:-1]
                    ])
                    response = chat.send_message(prompt)
                    respuesta_texto = response.text
                    
                    st.markdown(respuesta_texto)
                    st.session_state.messages.append({"role": "assistant", "content": respuesta_texto})
                    
                    # Lectura en voz alta
                    texto_limpio = respuesta_texto.replace('\n', ' ').replace('"', "'")
                    st.markdown(f"""
                        <script>
                        let utterance = new SpeechSynthesisUtterance("{texto_limpio}");
                        utterance.lang = 'es-ES';
                        window.speechSynthesis.speak(utterance);
                        </script>
                    """, unsafe_allow_html=True)

                except Exception as e:
                    st.error(f"Error: {e}")
