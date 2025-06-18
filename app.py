from flask import Flask, request, jsonify
from flask_cors import CORS
import google.generativeai as genai
import os
from dotenv import load_dotenv
from pymongo import MongoClient
import datetime
import fitz  # PyMuPDF
from collections import defaultdict
import json



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
chats_collection = db["chats"]
content_collection = db["structured_content"]


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

class PDFContentAnalyzer:
    def __init__(self):
        self.content_structure = {
            "main_topics": [],
            "subtopics": defaultdict(list),
            "key_concepts": defaultdict(list),
            "real_world_applications": defaultdict(list),
            "examples": defaultdict(list),
            "definitions": defaultdict(dict),
            "relationships": defaultdict(list)
        }

    def analyze_content(self, content):
        # Analyze main topics
        main_topics_prompt = f"""
        Analyze this content and identify the main topics:
        {content[:4000]}
        
        Return the main topics as a JSON array.
        """
        
        try:
            main_topics_response = gemini_model.generate_content(main_topics_prompt)
            self.content_structure["main_topics"] = json.loads(main_topics_response.text)
            
            # Analyze each main topic
            for topic in self.content_structure["main_topics"]:
                self._analyze_topic(topic, content)
                
            return self.content_structure
        except Exception as e:
            return {"error": str(e)}

    def _analyze_topic(self, topic, content):
        # Analyze subtopics
        subtopics_prompt = f"""
        For the topic "{topic}", identify:
        1. Subtopics
        2. Key concepts
        3. Real-world applications
        4. Examples
        5. Definitions
        6. Relationships with other topics
        
        Content: {content[:4000]}
        
        Return as JSON with these keys: subtopics, concepts, applications, examples, definitions, relationships
        """
        
        try:
            analysis_response = gemini_model.generate_content(subtopics_prompt)
            analysis = json.loads(analysis_response.text)
            
            self.content_structure["subtopics"][topic] = analysis.get("subtopics", [])
            self.content_structure["key_concepts"][topic] = analysis.get("concepts", [])
            self.content_structure["real_world_applications"][topic] = analysis.get("applications", [])
            self.content_structure["examples"][topic] = analysis.get("examples", [])
            self.content_structure["definitions"][topic] = analysis.get("definitions", {})
            self.content_structure["relationships"][topic] = analysis.get("relationships", [])
            
        except Exception as e:
            print(f"Error analyzing topic {topic}: {str(e)}")

def generate_real_world_suggestions(topic, content_structure):
    prompt = f"""
    Based on this topic: {topic}
    
    And its structured content:
    {json.dumps(content_structure, indent=2)}
    
    Generate:
    1. 3 real-world problems that can be solved using this knowledge
    2. 2 practical applications in industry
    3. 1 case study suggestion
    4. 2 hands-on project ideas
    
    Format the response as JSON with these keys: problems, applications, case_study, projects
    """
    
    try:
        response = gemini_model.generate_content(prompt)
        return json.loads(response.text)
    except Exception as e:
        return {"error": str(e)}

# Upload and analyze PDF
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

        # Analyze content using the new analyzer
        analyzer = PDFContentAnalyzer()
        structured_content = analyzer.analyze_content(full_text)
        
        main_topics = structured_content.get("main_topics", [])
        if not main_topics:
            main_topics = ["Uncategorized"]
            structured_content["main_topics"] = main_topics

        # Store in MongoDB
        pdf_doc = {
            "user_id": user_id,
            "content": full_text,
            "structured_content": structured_content,
            "timestamp": datetime.datetime.utcnow()
        }
        
        pdf_id = pdf_collection.insert_one(pdf_doc).inserted_id
        
        # Generate real-world suggestions for each main topic
        suggestions = {}
        for topic in structured_content["main_topics"]:
            suggestions[topic] = generate_real_world_suggestions(topic, structured_content)

        return jsonify({
            "pdf_id": str(pdf_id),
            "structured_content": structured_content,
            "real_world_suggestions": suggestions
        })

    except Exception as e:
        return jsonify({"error": str(e)}), 500

# Get real-world suggestions for a specific topic
@app.route("/get-suggestions", methods=["POST"])
def get_suggestions():
    data = request.get_json()
    topic = data.get("topic")
    pdf_id = data.get("pdf_id")

    if not topic or not pdf_id:
        return jsonify({"error": "Topic and PDF ID are required"}), 400

    try:
        pdf_doc = pdf_collection.find_one({"_id": pdf_id})
        if not pdf_doc:
            return jsonify({"error": "PDF not found"}), 404

        structured_content = pdf_doc.get("structured_content", {})
        suggestions = generate_real_world_suggestions(topic, structured_content)
        
        return jsonify({"suggestions": suggestions})

    except Exception as e:
        return jsonify({"error": str(e)}), 500

def generate_focused_response(prompt, user_id, focused_response=True):
    try:
        # Check if it's a predefined response
        lower_prompt = prompt.lower().strip()
        predefined_responses = {
            "hi": "Hello! How can I assist you today?",
            "hello": "Hi there! What do you need help with?",
            "how are you": "I'm an AI assistant, but I'm here to help!",
            "what is your name": "I'm your AI assistant, here to help you with anything!",
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

        # Update usage
        users_collection.update_one(
            {"user_id": user_id},
            {"$inc": {"usage": 1}, "$set": {"last_used": datetime.datetime.utcnow()}},
            upsert=True
        )

        # Generate focused response
        response = gemini_model.generate_content(prompt)
        response_text = response.text.strip()

        # Save chat to DB
        chats_collection.insert_one({
            "user_id": user_id,
            "prompt": prompt,
            "response": response_text,
            "timestamp": datetime.datetime.utcnow()
        })

        return response_text

    except Exception as e:
        return f"[Error during response generation: {str(e)}]"

def generate_summary(pdf_id, focused_response=True):
    try:
        pdf_doc = pdf_collection.find_one({"_id": pdf_id})
        if not pdf_doc:
            return {"error": "PDF not found"}

        content = pdf_doc.get("content", "")
        summary_prompt = f"""
        Provide a concise summary of this content:
        {content[:4000]}
        
        Focus only on the main points and key information.
        """
        
        response = gemini_model.generate_content(summary_prompt)
        return {"summary": response.text.strip()}

    except Exception as e:
        return {"error": str(e)}

def generate_explanation(pdf_id, topic=None, level="high_school", focused_response=True):
    try:
        pdf_doc = pdf_collection.find_one({"_id": pdf_id})
        if not pdf_doc:
            return {"error": "PDF not found"}

        content = pdf_doc.get("content", "")
        structured_content = pdf_doc.get("structured_content", {})

        if topic:
            # Get specific topic content
            topic_content = structured_content.get("key_concepts", {}).get(topic, "")
            explanation_prompt = f"""
            Explain this topic in simple terms suitable for {level} students:
            {topic_content}
            
            Focus on clear, straightforward explanation without additional suggestions.
            """
        else:
            # General explanation of the content
            explanation_prompt = f"""
            Explain this content in simple terms suitable for {level} students:
            {content[:4000]}
            
            Focus on clear, straightforward explanation without additional suggestions.
            """

        response = gemini_model.generate_content(explanation_prompt)
        return {"explanation": response.text.strip()}

    except Exception as e:
        return {"error": str(e)}

@app.route("/generate", methods=["POST"])
def chat():
    data = request.get_json()
    prompt = data.get("prompt")
    user_id = data.get("user_id")
    focused_response = data.get("focused_response", True)

    if not prompt or not user_id:
        return jsonify({"error": "Prompt and user_id are required"}), 400

    response = generate_focused_response(prompt, user_id, focused_response)
    return jsonify({"response": response})

if __name__ == "__main__":
    app.run(debug=True)
