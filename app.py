import os
from flask import Flask, render_template
import google.generativeai as genai

app = Flask(__name__, template_folder='interface')

# Configura tu API Key (Render la tomará del entorno)
genai.configure(api_key=os.environ.get("GOOGLE_API_KEY"))

@app.route('/')
def index():
    return render_template('index.html')

if __name__ == '__main__':
    app.run(debug=True)
