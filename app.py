from flask import Flask, request, jsonify
from flask_cors import CORS
from huggingface_hub import InferenceClient
import os
from dotenv import load_dotenv
from pymongo import MongoClient
from datetime import datetime

load_dotenv()

app = Flask(__name__)
CORS(app)

# Hugging Face API Token
HF_API_TOKEN = os.getenv("HFE_API_TOKEN")
client = InferenceClient("HuggingFaceH4/zephyr-7b-beta", token=HF_API_TOKEN)

# MongoDB Configuration
MONGODB_URI = os.getenv("MONGODB_URI")  # e.g., "mongodb://username:password@host:port/database"
MONGODB_DATABASE = os.getenv("MONGODB_DATABASE") or "chat_history_db"  # Default DB name

# Initialize MongoDB client
mongo_client = MongoClient(MONGODB_URI)
db = mongo_client[MONGODB_DATABASE]
chat_sessions = db.chat_sessions  # Collection to store chat sessions


def generate_response(prompt):
    """
    Generates a response using the Hugging Face LLM.  Handles predefined responses
    and calls the Hugging Face API for dynamic responses.
    """
    predefined_responses = {
        "hi": "Hello! How can I assist you today?",
        "hello": "Hi there! What do you need help with?",
        "how are you": "I'm an AI assistant, but I'm here to help!",
        "what is your name": "I'm your AI assistant, here to help you with anything!",
        "i love you": "That's great but i didn't have any feelings!",
        "bye": "Goodbye! Have a great day!",
    }

    lower_prompt = prompt.lower().strip()

    if lower_prompt in predefined_responses:
        return predefined_responses[lower_prompt]

    messages = [{"role": "user", "content": prompt}]
    response = ""

    try:
        for message in client.chat_completion(
            messages, max_tokens=999, temperature=0.7, top_p=0.9, stream=True
        ):
            token = message.choices[0].delta.content
            response += token
    except Exception as e:
        return f"Error: {str(e)}"

    return response



@app.route("/generate", methods=["POST"])
def chat():
    """
    Endpoint for generating chat responses.  Stores the conversation in MongoDB.
    """
    data = request.get_json()
    prompt = data.get("prompt")
    session_id = data.get("session_id")  # Get session_id, may be null for new

    if not prompt:
        return jsonify({"error": "Prompt is required"}), 400

    response = generate_response(prompt)

    # Store the conversation in MongoDB
    timestamp = datetime.utcnow()
    chat_entry = {
        "user": prompt,
        "ai": response,
        "timestamp": timestamp,
    }

    if session_id:
        # Update existing session
        result = chat_sessions.update_one(
            {"session_id": session_id},
            {"$push": {"messages": chat_entry}, "$set": {"last_updated": timestamp}}, #update last_updated
        )
        if result.matched_count == 0:
            #handle the error
            new_session = {
                "session_id": str(uuid.uuid4()),  # Generate new session ID
                "messages": [chat_entry],
                "created_at": timestamp,
                "last_updated": timestamp,
            }
            chat_sessions.insert_one(new_session)
            session_id = new_session["session_id"]
    else:
        # Create a new session
        import uuid  # Import uuid
        new_session = {
            "session_id": str(uuid.uuid4()),  # Generate unique session ID
            "messages": [chat_entry],
            "created_at": timestamp,
            "last_updated": timestamp,
        }
        chat_sessions.insert_one(new_session)
        session_id = new_session["session_id"]  # Get the newly generated ID

    return jsonify({"response": response, "session_id": session_id})  # Return session ID



@app.route("/history/<session_id>", methods=["GET"])
def get_history(session_id):
    """
    Endpoint to retrieve the chat history for a given session ID.
    """
    session = chat_sessions.find_one({"session_id": session_id})
    if session:
        # Project the 'messages' array and exclude the '_id' field.  Important for not exposing internal mongo ids
        history = [{"user": m["user"], "ai": m["ai"], "timestamp": m["timestamp"]} for m in session["messages"]]
        return jsonify({"history": history})
    else:
        return jsonify({"error": "Session not found"}), 404
    
@app.route("/sessions", methods=["GET"])
def get_sessions():
    """
    Endpoint to get all session IDs.
    """
    sessions = chat_sessions.find({}, {"session_id": 1, "created_at": 1, "last_updated":1, "_id": 0}) #retreive session_id, created_at, last_updated
    session_list = list(sessions)
    return jsonify({"sessions": session_list}) #return the list


if __name__ == "__main__":
    app.run()
