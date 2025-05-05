from flask import Flask, request, jsonify
from flask_cors import CORS
from huggingface_hub import InferenceClient
import os
from dotenv import load_dotenv
from docx import Document


load_dotenv()  # Load environment variables from .env

app = Flask(__name__)
CORS(app)  # Allows frontend (HTML/JS) to access API

# Use your Hugging Face API Token
HF_API_TOKEN = os.getenv("HFE_API_TOKEN")  # Securely fetch token

# Load the Hugging Face LLM with authentication
client = InferenceClient("HuggingFaceH4/zephyr-7b-beta", token=HF_API_TOKEN)

def generate_response(prompt):
    # Predefined responses for common inputs
    predefined_responses = {
        "hi": "Hello! How can I assist you today?",
        "hello": "Hi there! What do you need help with?",
        "how are you": "I'm an AI assistant, but I'm here to help!",
        "what is your name": "I'm your AI assistant, here to help you with anything!",
        "i love you":"That's great but i didn't have any fellings!",
        "bye": "Goodbye! Have a great day!",
    }

    # Convert input to lowercase for matching
    lower_prompt = prompt.lower().strip()

    # Check if the user input matches any predefined response
    if lower_prompt in predefined_responses:
        return predefined_responses[lower_prompt]

    # If no predefined response, use Hugging Face model
    messages = [{"role": "user", "content": prompt}]
    response = ""

    try:
        # Streaming response
        for message in client.chat_completion(
            messages, max_tokens=999, temperature=0.7, top_p=0.9, stream=True
        ):
            token = message.choices[0].delta.content
            response += token
    except Exception as e:
        return f"Error: {str(e)}"  # Return error message if API call fails

    return response


@app.route("/generate", methods=["POST"])
def chat():
    data = request.get_json()
    prompt = data.get("prompt")
    if not prompt:
        return jsonify({"error": "Prompt is required"}), 400

    response = generate_response(prompt)
    return jsonify({"response": response})


@app.route("/analyze-selection", methods=["POST"])
def analyze_selection():
    try:
        data = request.get_json(force=True)
        selected_text = data.get("selected_text", "").strip()
        user_query = data.get("query", "").strip().lower()

        if not selected_text:
            return jsonify({"error": "Selected text is required"}), 400

        if not user_query:
            return jsonify({"error": "User query is required"}), 400

        # Log the inputs for debugging
        print("Selected Text:", selected_text)
        print("User Query:", user_query)

        # Customize prompt based on query intent
        if "summarize" in user_query:
            prompt = f"Summarize this text:\n\n{selected_text}"
        elif "explain" in user_query:
            prompt = f"Explain this in simple terms suitable for a 10th-grade student in just 10 lines:\n\n{selected_text}"
        else:
            prompt = f"{user_query}\n\nContext:\n{selected_text}"

        # Generate the response using the LLM
        response = generate_response(prompt)

        return jsonify({"response": response})

    except Exception as e:
        print("Error in /analyze-selection:", str(e))
        return jsonify({"error": "Internal Server Error", "details": str(e)}), 500


@app.route('/upload-docx', methods=['POST'])
def upload_docx():
    if 'file' not in request.files:
        return jsonify({'error': 'No file part'}), 400

    file = request.files['file']
    
    if file.filename == '':
        return jsonify({'error': 'No selected file'}), 400

    if not file.filename.endswith('.docx'):
        return jsonify({'error': 'Only .docx files are allowed'}), 400

    try:
        doc = Document(file)
        full_text = '\n'.join([para.text for para in doc.paragraphs])
        return jsonify({'content': full_text})
    except Exception as e:
        return jsonify({'error': str(e)}), 500

if __name__ == "__main__":
    app.run()
