from flask import Flask, request, jsonify
from flask_cors import CORS
import google.generativeai as genai
import os
from dotenv import load_dotenv
from pymongo import MongoClient
import datetime
import fitz  # PyMuPDF

load_dotenv()

app = Flask(__name__)
CORS(app)

# Gemini API Configuration
GEMINI_API_KEY = os.getenv("GOOGLE_API_KEY")
genai.configure(api_key=GEMINI_API_KEY)
gemini_model = genai.GenerativeModel("gemini-2.0-flash")

# MongoDB Setup
mongo_uri = os.getenv("MONGODB_URI")
mongo_client = MongoClient(mongo_uri)
db = mongo_client["EduSolve"]
users_collection = db["users"]
pdf_collection = db["pdfs"]

# Track user usage
def update_usage(user_id):
    users_collection.update_one(
        {"user_id": user_id},
        {"$inc": {"usage": 1}, "$set": {"last_used": datetime.datetime.utcnow()}},
        upsert=True
    )

# Generate suggestions
def generate_enhanced_suggestions(prompt):
    suggestion_prompt = f"""
    You are an AI assistant learning along with a student. Analyze this topic:
    \"{prompt}\"

    1. Provide a concise summary.
    2. Suggest 2-3 AI prompts students can try related to this topic.
    3. Compare this topic with a real-world application or use case.
    4. Mention if this is a very important concept and why.
    5. Prioritize the topic's importance compared to others in the document.
    """

    try:
        response = gemini_model.generate_content(suggestion_prompt)
        return response.text.strip()
    except Exception as e:
        return f"[Error during suggestion generation: {str(e)}]"

# Analyze PDF content
def analyze_pdf_content(content):
    prompt = f"""
    You are a smart AI reading this PDF with a student. Here is the content:
    \"\"\"{content[:4000]}\"\"\"

    Please do the following:
    1. Summarize the content.
    2. Highlight key topics and concepts.
    3. Suggest real-world applications.
    4. Provide 2-3 learning prompts for this PDF.
    5. Prioritize the key topics by real-world practicality.
    """

    try:
        response = gemini_model.generate_content(prompt)
        return response.text.strip()
    except Exception as e:
        return f"[Error during PDF analysis: {str(e)}]"

# Upload and analyze PDF
@app.route("/upload-pdf", methods=["POST"])
def upload_pdf():
    if "pdf" not in request.files or "user_id" not in request.form:
        return jsonify({"error": "PDF file and user_id are required"}), 400

    file = request.files["pdf"]
    user_id = request.form["user_id"]

    try:
        doc = fitz.open(stream=file.read(), filetype="pdf")
        full_text = "\n".join([page.get_text() for page in doc])

        ai_analysis = analyze_pdf_content(full_text)

        pdf_collection.insert_one({
            "user_id": user_id,
            "content": full_text,
            "analysis": ai_analysis,
            "timestamp": datetime.datetime.utcnow()
        })

        return jsonify({"analysis": ai_analysis})
    except Exception as e:
        return jsonify({"error": str(e)}), 500

# Chat + suggestion generator
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
        response = gemini_model.generate_content(prompt)
        suggestions = generate_enhanced_suggestions(prompt)
        return f"{response.text.strip()}\n\n---\n\nAI Study Partner Suggestions:\n{suggestions}"
    except Exception as e:
        return f"[Error during chat generation: {str(e)}]"

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
