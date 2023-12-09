from flask import Flask, request, jsonify, send_from_directory
import os

app = Flask(__name__, static_folder='../frontend')

@app.route('/')
def index():
    return send_from_directory(app.static_folder, 'index.html')
    
@app.route('/<path:path>')
def static_files(path):
    return send_from_directory(app.static_folder, path)

@app.route('/process', methods=['POST'])
def process_input():
    data = request.json
    user_input = data['input']
    output = "Processed: " + user_input  # Replace with your processing logic
    return jsonify({'output': output})

if __name__ == '__main__':
    app.run(debug=True)
