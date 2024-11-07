from flask import Flask, request, jsonify
from flask_cors import CORS
import subprocess
import re

app = Flask(__name__)
CORS(app)

@app.route('/execute', methods=['POST'])
def execute_code():
    data = request.get_json()
    code = data['code']
    code = "import torch\n" + code
    code = "from torch.func import *\n" + code
    code = "import torch.nn as nn\n" + code
    
    print(code)

    try:
        result = subprocess.run(['python', '-c', code], capture_output=True, text=True)
        return jsonify({'output': result.stdout, 'error': result.stderr})
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/generate_exercise', methods=['POST'])
def generate_exercise():
    data = request.json
    code = data['code']

    exercises = create_fill_in_the_blank_exercise(code)

    return jsonify({
        'exercises': exercises
    })

def create_fill_in_the_blank_exercise(code):
    # Regular expression to match PyTorch API calls
    pytorch_api_pattern = r'(torch(?:\.\w+)+|nn(?:\.\w+)*)'  

    api_matches = re.findall(pytorch_api_pattern, code)

    unique_api_calls = list(dict.fromkeys(api_matches))

    # If there is only one unique API call, return a single exercise
    if len(unique_api_calls) == 1:
        api_group_1 = unique_api_calls
        api_group_2 = []
    else:
        # Split unique API calls into two groups
        split_index = len(unique_api_calls) // 2
        api_group_1 = unique_api_calls[:split_index]
        api_group_2 = unique_api_calls[split_index:]

    # Create lists for storing exercises
    exercises = []

    for group in [api_group_1, api_group_2]:
        if not group:
            continue  # Skip empty groups

        current_code = code
        current_blanks = []
        current_correct_answers = []
        current_hints = []

        for api in group:
            blank = f"__BLANK{len(current_blanks) + 1}__"
            # Replace the API call with the blank
            current_code = current_code.replace(api, blank, 1)  # Replace only the first occurrence
            current_correct_answers.append(api)
            current_blanks.append(blank)
            current_hints.append(f"Hint for blank {len(current_blanks)}: {api} function")

        exercises.append({
            'modifiedCode': current_code,
            'hints': current_hints,
            'correctAnswers': current_correct_answers
        })

    return exercises


if __name__ == '__main__':
    app.run(debug=True)
