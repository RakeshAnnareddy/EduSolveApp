import os
from dotenv import load_dotenv
import google.generativeai as genai

# Load environment variables from .env file
load_dotenv()

# Get the API key
GEMINI_API_KEY = os.getenv("GOOGLE_API_KEY")

# Check if API key is set
if not GEMINI_API_KEY:
    raise ValueError("❌ GOOGLE_API_KEY not found in environment variables!")

# Configure the Gemini client
genai.configure(api_key=GEMINI_API_KEY)

# Initialize the Gemini model
gemini_model = genai.GenerativeModel("gemini-2.0-flash")

# Function to test Gemini response
def test_gemini():
    try:
        prompt = "What are ACID properties in databases?"
        response = gemini_model.generate_content(prompt)
        print("✅ Gemini Response:\n")
        print(response.text)
    except Exception as e:
        print(f"❌ Error while generating content: {e}")

# Main entry
if __name__ == "__main__":
    test_gemini()
