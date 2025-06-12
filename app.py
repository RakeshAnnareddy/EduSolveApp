from flask import Flask, request, jsonify
from flask_cors import CORS
import google.generativeai as genai
import os
from dotenv import load_dotenv
from pymongo import MongoClient
import datetime
import fitz  # PyMuPDF
import firebase_admin
from firebase_admin import credentials, auth
import requests
from flask import Flask, render_template, request, redirect, session, flash


load_dotenv()

app = Flask(__name__)
CORS(app)

app.secret_key = 'EdU&olv3@990'
FIREBASE_API_KEY = ''

cred = credentials.Certificate('firebase-adminsdk.json')
firebase_admin.initialize_app(cred)

@app.route('/')
def home():
    if 'user' in session:
        return render_template('index.html')
    return redirect('/login')

@app.route('/signup', methods=['GET', 'POST'])
def signup():
    if request.method == 'POST':
        name = request.form['name']
        email = request.form['email']
        password = request.form['password']
        try:
            user = auth.create_user(
                email=email,
                password=password,
                display_name=name
            )
            session['user'] = email
            session['name'] = name
            return redirect('/')
        except Exception as e:
            return f"Signup Error: {e}"
    return render_template('signup.html')


@app.route('/login', methods=['GET', 'POST'])
def login():
    if request.method == 'POST':
        email = request.form['email']
        password = request.form['password']

        # Firebase REST API for sign-in
        url = f"https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key={FIREBASE_API_KEY}"
        payload = {
            "email": email,
            "password": password,
            "returnSecureToken": True
        }

        response = requests.post(url, json=payload)
        data = response.json()

        if 'idToken' in data:
            session['user'] = email  # Store email in session
            try:
                user = auth.get_user_by_email(email)  # Get user data from Firebase
                if user.display_name:
                    session['name'] = user.display_name  # Set display name if available
                else:
                    session['name'] = email  # Fall back to email if display name isn't set
            except Exception as e:
                flash(f"Error fetching user data: {str(e)}")
                session['name'] = email  # Fallback to email
            print(f"User logged in: {session['name']}")  # Debugging print statement
            return redirect('/')
        else:
            error = data.get('error', {}).get('message', 'Login failed')
            flash(f"Login error: {error}")
            return render_template('login.html', error=error)

    return render_template('login.html')


@app.route('/change-password', methods=['GET', 'POST'])
def change_password():
    if request.method == 'POST':
        email = request.form['email']
        new_password = request.form['new_password']
        try:
            user = auth.get_user_by_email(email)
            auth.update_user(user.uid, password=new_password)
            return render_template('change_password.html', message="Password updated successfully!")
        except Exception as e:
            return render_template('change_password.html', message=f"Error: {e}")
    return render_template('change_password.html')


@app.route('/logout')
def logout():
    session.pop('user', None)
    session.clear()
    return redirect('/login')

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
chats_collection = db["chats"]


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
        response_text = predefined_responses[lower_prompt]
        chats_collection.insert_one({
            "user_id": user_id,
            "prompt": prompt,
            "response": response_text,
            "timestamp": datetime.datetime.utcnow()
        })
        return response_text

    update_usage(user_id)

    try:
        response = gemini_model.generate_content(prompt)
        suggestions = generate_enhanced_suggestions(prompt)
        final_response = f"{response.text.strip()}\n\n---\n\nAI Study Partner Suggestions:\n{suggestions}"

        # Save chat to DB
        chats_collection.insert_one({
            "user_id": user_id,
            "prompt": prompt,
            "response": final_response,
            "timestamp": datetime.datetime.utcnow()
        })

        return final_response

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
