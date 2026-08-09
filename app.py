from flask import Flask, render_template, request
import brain

app = Flask(__name__)

@app.route('/')
def index():
    return render_template('index.html')

@app.route('/ask', methods=['POST'])
def ask():
    user_input = request.form['query']
    response = brain.generate_response(user_input)
    return response

if __name__ == '__main__':
    app.run()
