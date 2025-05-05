from flask import Flask, request, jsonify
from flask_cors import CORS
from huggingface_hub import InferenceClient

app = Flask(__name__)
CORS(app)  # Allows frontend (HTML/JS) to access API

# Use your Hugging Face API Token
HF_API_TOKEN = "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"

# Load the Hugging Face LLM with authentication
client = InferenceClient("mistralai/Mistral-7B-Instruct-v0.3", token=HF_API_TOKEN)

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
    data = request.get_json()
    selected_text = data.get("selected_text", "").strip()
    user_query = data.get("query", "").strip().lower()

    if not selected_text:
        return jsonify({"error": "Selected text is required"}), 400

    if not user_query:
        return jsonify({"error": "User query is required"}), 400

    # Customize prompt based on query intent
    if "summarize" in user_query:
        prompt = f"Summarize this text:\n\n{selected_text}"
    elif "explain" in user_query:
        prompt = f"Explain this in simple terms suitable for a 10th-grade student:\n\n{selected_text}"
    else:
        prompt = f"{user_query}\n\nContext:\n{selected_text}"

    response = generate_response(prompt)
    return jsonify({"response": response})

if __name__ == "__main__":
    app.run()
