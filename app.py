# EduSolve Flask Backend with Zephyr LLM, Plan Management, Token Control, and Topic Analysis

from flask import Flask, request, jsonify
from flask_cors import CORS
from huggingface_hub import InferenceClient
import os
from dotenv import load_dotenv
from pymongo import MongoClient
import datetime
import fitz  # PyMuPDF

load_dotenv()

app = Flask(__name__)
CORS(app)

# Hugging Face Token & Clients
HF_API_TOKEN = os.getenv("HFE_API_TOKEN")
client_zephyr = InferenceClient("HuggingFaceH4/zephyr-7b-beta", token=HF_API_TOKEN)

# MongoDB Setup
mongo_uri = os.getenv("MONGODB_URI")
mongo_client = MongoClient(mongo_uri)
db = mongo_client["edusolve"]
users_collection = db["users"]
pdf_collection = db["pdfs"]

# Plan Config
PLANS = {
    149: {"max_requests": 30},
    199: {"max_requests": 50},
    299: {"max_requests": 75},
}

# Update usage
def update_usage(user_id):
    users_collection.update_one(
        {"user_id": user_id},
        {"$inc": {"usage": 1}, "$set": {"last_used": datetime.datetime.utcnow()}},
        upsert=True
    )

# Generate suggestions and topic analysis
def generate_enhanced_suggestions(prompt, zephyr_client):
    suggestion_prompt = f"""
    You are an AI assistant learning along with a student. Analyze this topic:
    \"{prompt}\"

    1. Provide a concise summary.
    2. Suggest 2-3 AI prompts students can try related to this topic.
    3. Compare this topic with a real-world application or use case.
    4. Mention if this is a very important concept and why.
    """

    messages = [{"role": "user", "content": suggestion_prompt}]
    response = ""
    for message in zephyr_client.chat_completion(
        messages, max_tokens=900, temperature=0.7, top_p=0.9, stream=True
    ):
        token = message.choices[0].delta.content
        response += token
    return response

# PDF Analysis Logic
def analyze_pdf_content(content):
    summary_request = f"""
    You are a smart AI reading this PDF with a student. Here is the content:
    \""" + content[:4000] + "\""  # Limit input to ~4000 characters

    Please do the following:
    1. Summarize the content.
    2. Highlight key topics and concepts.
    3. Suggest real-world applications.
    4. Provide 2-3 learning prompts for this PDF.
    """

    messages = [{"role": "user", "content": summary_request}]
    response = ""
    for message in client_zephyr.chat_completion(
        messages, max_tokens=950, temperature=0.7, top_p=0.9, stream=True
    ):
        token = message.choices[0].delta.content
        response += token
    return response

# Upload and Analyze PDF Route
@app.route("/upload-pdf", methods=["POST"])
def upload_pdf():
    if "pdf" not in request.files or "user_id" not in request.form:
        return jsonify({"error": "PDF file and user_id are required"}), 400

    file = request.files["pdf"]
    user_id = request.form["user_id"]

    try:
        # Read PDF content
        doc = fitz.open(stream=file.read(), filetype="pdf")
        full_text = "\n".join([page.get_text() for page in doc])

        # Analyze
        ai_analysis = analyze_pdf_content(full_text)

        # Store in DB
        pdf_collection.insert_one({
            "user_id": user_id,
            "content": full_text,
            "analysis": ai_analysis,
            "timestamp": datetime.datetime.utcnow()
        })

        return jsonify({"analysis": ai_analysis})
    except Exception as e:
        return jsonify({"error": str(e)}), 500

# Main Response Function
def generate_response(prompt, user_id):
    lower_prompt = prompt.lower().strip()
    predefined_responses = {
        "hi": "Hello! How can I assist you today?",
        "hello": "Hi there! What do you need help with?",
        "how are you": "I'm an AI assistant, but I'm here to help!",
        "what is your name": "I'm your AI assistant, here to help you with anything!",
        "i love you": "That's great but I don't have feelings!",
        "bye": "Goodbye! Have a great day!",
    }

    if lower_prompt in predefined_responses:
        return predefined_responses[lower_prompt]

    update_usage(user_id)

    try:
        # Use Zephyr for everything (can add GPT-4o later)
        response = ""
        messages = [{"role": "user", "content": prompt}]
        for message in client_zephyr.chat_completion(
            messages, max_tokens=700, temperature=0.7, top_p=0.9, stream=True
        ):
            token = message.choices[0].delta.content
            response += token

        suggestions = generate_enhanced_suggestions(prompt, client_zephyr)

        return f"{response}\n\n---\n\nAI Study Partner Suggestions:\n{suggestions}"

    except Exception as e:
        return f"Error: {str(e)}"

@app.route("/generate", methods=["POST"])
def chat():
    data = request.get_json()
    prompt = data.get("prompt")
    user_id = data.get("user_id")

    if not prompt or not user_id:
        return jsonify({"error": "Prompt and user_id are required"}), 400

    response = generate_response(prompt, user_id)
    return jsonify({"response": response})

if __name__ == "__main__":
    app.run(debug=True)
