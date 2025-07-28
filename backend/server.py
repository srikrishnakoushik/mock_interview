from fastapi import FastAPI, APIRouter, File, UploadFile, HTTPException
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
from pathlib import Path
from pydantic import BaseModel, Field
from typing import List, Optional
import uuid
from datetime import datetime
import json
import asyncio
import tempfile
import speech_recognition as sr
from gtts import gTTS
import base64
from io import BytesIO

# NEW IMPORTS for Google Generative AI and pydub for audio processing
import google.generativeai as genai
from pydub import AudioSegment # For audio extraction from video files

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# MongoDB connection
mongo_url = os.environ.get('MONGO_URL')
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ.get('DB_NAME')]

# Create the main app without a prefix
app = FastAPI()

# Create a router with the /api prefix
api_router = APIRouter(prefix="/api")

# --- MODIFIED: API Key setup for Google Gemini ---
GEMINI_API_KEY = os.environ.get('GEMINI_API_KEY')
# Configure genai with your API key
genai.configure(api_key=GEMINI_API_KEY)

GEMINI_MODEL_CHAT = os.environ.get('GEMINI_MODEL_CHAT', "gemini-1.5-flash")
GEMINI_MODEL_EVAL = os.environ.get('GEMINI_MODEL_EVAL', "gemini-1.5-flash")
# --- END MODIFIED ---

# Data Models
class InterviewSession(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    job_description: str
    questions: List[str]
    created_at: datetime = Field(default_factory=datetime.utcnow)
    completed: bool = False

class InterviewSessionCreate(BaseModel):
    job_description: str

class QuestionRequest(BaseModel):
    job_description: str

class QuestionResponse(BaseModel):
    questions: List[str]
    session_id: str

class TranscriptionRequest(BaseModel):
    session_id: str
    question_index: int

class EvaluationRequest(BaseModel):
    transcript: str
    question: str
    session_id: str # Added session_id to fetch job_description from DB

class EvaluationResponse(BaseModel):
    score: int
    strengths: List[str]
    weaknesses: List[str]
    suggestions: List[str]

class InterviewAnswer(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    session_id: str
    question_index: int
    question: str
    transcript: str
    evaluation: Optional[dict] = None
    timestamp: datetime = Field(default_factory=datetime.utcnow)

class VoiceRequest(BaseModel):
    text: str
    voice: str = "en"

# Helper function to send messages to Google Gemini API
async def send_gemini_message(system_message: str, user_message_text: str, model_name: str) -> str:
    if not GEMINI_API_KEY:
        logging.error("GEMINI_API_KEY environment variable is not set.")
        raise HTTPException(status_code=500, detail="Gemini API Key not configured.")

    try:
        model = genai.GenerativeModel(model_name=model_name)

        chat_session = model.start_chat(history=[
            {"role": "user", "parts": [system_message]},
            {"role": "model", "parts": ["Understood."]}
        ])

        # Use asyncio.to_thread for blocking API calls to prevent blocking the event loop
        response = await asyncio.to_thread(chat_session.send_message, user_message_text)

        if response.text:
            return response.text
        else:
            logging.error(f"Gemini API response missing text content. Response object: {response}")
            raise HTTPException(status_code=500, detail="LLM response missing content.")

    except Exception as e:
        logging.error(f"Error communicating with Gemini API: {e}", exc_info=True)
        if "API key not valid" in str(e):
             raise HTTPException(status_code=401, detail="Gemini API key is invalid or expired.")
        elif "quota" in str(e).lower() or "rate limit" in str(e).lower():
             raise HTTPException(status_code=429, detail="Gemini API rate limit exceeded or quota reached.")
        raise HTTPException(status_code=500, detail=f"Failed to get response from Gemini API: {str(e)}")


# Routes
@api_router.get("/")
async def root():
    return {"message": "Enhanced Mock Interview API Ready"}

@api_router.post("/questions", response_model=QuestionResponse)
async def generate_questions(request: QuestionRequest):
    """Generate interview questions based on job description using Gemini"""
    try:
        system_message = "You are an expert HR interviewer. Generate thoughtful, relevant interview questions based on the job description provided. Ensure your response is ONLY a JSON array of strings, with no other text, markdown fences, or formatting outside the JSON array."
        prompt = f"""
        Based on the following job description, generate 8-10 diverse interview questions that would effectively assess a candidate's suitability for this role.

        Job Description:
        {request.job_description}

        Please generate questions that cover:
        - Technical skills and experience
        - Behavioral and situational scenarios
        - Problem-solving abilities
        - Cultural fit and motivation
        - Role-specific competencies

        Return ONLY the questions as a JSON array of strings, without any extra text, introductions, conclusions, or markdown code blocks (e.g., no ```json ```).
        """
        response_content = await send_gemini_message(system_message, prompt, GEMINI_MODEL_CHAT)

        # Parse the response to extract questions (robust parsing)
        try:
            # Clean possible markdown code blocks from LLM response
            cleaned_response = response_content.strip()
            if cleaned_response.startswith('```json'):
                cleaned_response = cleaned_response.lstrip('```json').rstrip('```').strip()
            elif cleaned_response.startswith('```'): # Generic markdown fence
                cleaned_response = cleaned_response.lstrip('```').rstrip('```').strip()

            questions = json.loads(cleaned_response)

            if not isinstance(questions, list):
                raise ValueError("LLM response did not parse to a JSON list.")
            if not all(isinstance(q, str) for q in questions):
                raise ValueError("All elements in the LLM response list must be strings.")

        except (json.JSONDecodeError, ValueError) as e:
            logging.warning(f"LLM did not return strict JSON for questions ({e}). Attempting robust fallback parsing. Raw response: '{response_content[:500]}...'")
            lines = response_content.strip().split('\n')
            questions = []
            for line in lines:
                line = line.strip()
                line = line.lstrip('*- ').lstrip('0123456789. ').strip() # Remove common list indicators
                line = line.strip('"').strip("'") # Remove any leftover quotes
                
                if line and len(line) > 5: # Only add if a reasonable length
                    questions.append(line)
            
            if not questions or len(questions) < 3:
                logging.warning("Robust fallback parsing yielded too few or no valid questions. Using hardcoded default questions.")
                questions = [
                    "Tell me about a challenging project you've worked on recently.",
                    "How do you handle working under pressure and tight deadlines?",
                    "What are your long-term career goals?"
                ]
            
            questions = [str(q) for q in questions[:10]] # Ensure strings and limit to 10
            logging.info(f"Questions after fallback parsing: {questions}")

        session = InterviewSession(
            job_description=request.job_description,
            questions=questions[:10]
        )
        
        await db.interview_sessions.insert_one(session.dict())
        
        return QuestionResponse(questions=session.questions, session_id=session.id)
        
    except HTTPException:
        raise
    except Exception as e:
        logging.error(f"Error generating questions: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Failed to generate questions: {str(e)}")

@api_router.post("/transcribe")
async def transcribe_audio(file: UploadFile = File(...), session_id: str = None, question_index: int = None):
    """Transcribe uploaded audio/video file"""
    try:
        file_extension = Path(file.filename).suffix.lower()
        if file_extension not in ('.wav', '.mp3', '.m4a', '.ogg', '.webm', '.mp4'):
            raise HTTPException(status_code=400, detail="Unsupported file format")

        # Save uploaded file temporarily
        with tempfile.NamedTemporaryFile(delete=False, suffix=file_extension) as temp_file:
            content = await file.read()
            temp_file.write(content)
            temp_file_path = temp_file.name

        audio_file_path = temp_file_path # Assume it's audio initially
        cleanup_audio_file = False # Flag to delete temporary extracted audio

        try:
            # If it's a video file, extract audio using pydub
            if file_extension in ('.webm', '.mp4'):
                # pydub.AudioSegment.from_file is a blocking call, run in a separate thread
                audio_segment = await asyncio.to_thread(AudioSegment.from_file, temp_file_path)

                # Export to a WAV file for speech_recognition (also blocking)
                audio_file_path = tempfile.NamedTemporaryFile(delete=False, suffix=".wav").name
                await asyncio.to_thread(audio_segment.export, audio_file_path, format="wav")
                cleanup_audio_file = True # Mark for deletion

            r = sr.Recognizer()
            with sr.AudioFile(audio_file_path) as source:
                audio = r.record(source)
                # recognize_google is a blocking call, run in a separate thread
                transcript = await asyncio.to_thread(r.recognize_google, audio)

        except sr.UnknownValueError:
            transcript = "Could not understand the audio. Please speak clearly and try again."
        except sr.RequestError as e:
            transcript = f"Could not request results from speech recognition service: {str(e)}"
        except Exception as e: # Catch other errors like pydub/ffmpeg issues
            logging.error(f"Error during audio processing/transcription: {str(e)}", exc_info=True)
            transcript = f"An internal error occurred during audio processing: {str(e)}"
        finally:
            os.unlink(temp_file_path) # Original uploaded file
            if cleanup_audio_file and os.path.exists(audio_file_path):
                os.unlink(audio_file_path) # Extracted audio file
            
        return {"transcript": transcript}
        
    except Exception as e:
        logging.error(f"Error handling transcription request: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Failed to transcribe audio: {str(e)}")

@api_router.post("/evaluate", response_model=EvaluationResponse)
async def evaluate_answer(request: EvaluationRequest):
    """Evaluate interview answer using Gemini"""
    try:
        # NEW: Fetch job_description from the stored session
        session = await db.interview_sessions.find_one({"id": request.session_id})
        if not session:
            raise HTTPException(status_code=404, detail="Interview session not found.")
        job_description_from_session = session.get("job_description", "")
        if not job_description_from_session:
            raise HTTPException(status_code=400, detail="Job description not found in session for evaluation.")

        system_message = "You are an expert HR interviewer and career coach. Provide constructive evaluation of interview responses. Ensure your response is ONLY a JSON object as specified, with no other text, markdown fences, or formatting outside the JSON."
        prompt = f"""
        Evaluate this interview answer for the given question and job context:

        Job Description Context:
        {job_description_from_session}

        Question: {request.question}

        Candidate's Answer: {request.transcript}

        Please provide:
        1. A score from 1-10 (10 being excellent)
        2. 2-3 key strengths of the answer
        3. 2-3 areas for improvement
        4. 2-3 specific suggestions for better answers

        Return your evaluation as JSON in this exact format:
        {{
            "score": 7,
            "strengths": ["strength1", "strength2", "strength3"],
            "weaknesses": ["weakness1", "weakness2"],
            "suggestions": ["suggestion1", "suggestion2", "suggestion3"]
        }}
        No other text, introduction, conclusion, or markdown code blocks outside the JSON object.
        """
        response_content = await send_gemini_message(system_message, prompt, GEMINI_MODEL_EVAL)

        try:
            # Clean possible markdown code blocks from LLM response
            cleaned_response = response_content.strip()
            if cleaned_response.startswith('```json'):
                cleaned_response = cleaned_response.lstrip('```json').rstrip('```').strip()
            elif cleaned_response.startswith('```'):
                cleaned_response = cleaned_response.lstrip('```').rstrip('```').strip()

            evaluation = json.loads(cleaned_response)

            return EvaluationResponse(
                score=evaluation.get("score", 5),
                strengths=evaluation.get("strengths", ["Response provided"]),
                weaknesses=evaluation.get("weaknesses", ["Could be more detailed"]),
                suggestions=evaluation.get("suggestions", ["Provide more specific examples"])
            )

        except json.JSONDecodeError as e:
            logging.warning(f"LLM did not return valid JSON for evaluation ({e}). Attempting fallback evaluation. Response: '{response_content[:200]}...'")
            return EvaluationResponse(
                score=6,
                strengths=["Response provided", "Addressed the question"],
                weaknesses=["Could be more structured", "Needs more detail"],
                suggestions=["Use the STAR method", "Provide specific examples", "Be more concise"]
            )

    except HTTPException:
        raise
    except Exception as e:
        logging.error(f"Error evaluating answer: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Failed to evaluate answer: {str(e)}")

@api_router.post("/voice-synthesis")
async def synthesize_voice(request: VoiceRequest):
    """Generate voice audio from text using TTS"""
    try:
        # gTTS blocking call, use asyncio.to_thread
        tts_instance = await asyncio.to_thread(gTTS, text=request.text, lang=request.voice, slow=False)

        # Save to BytesIO buffer
        audio_buffer = BytesIO()
        await asyncio.to_thread(tts_instance.write_to_fp, audio_buffer)
        audio_buffer.seek(0)

        # Convert to base64 for frontend
        audio_base64 = base64.b64encode(audio_buffer.read()).decode('utf-8')

        return {
            "audio_data": audio_base64,
            "content_type": "audio/mpeg"
        }

    except Exception as e:
        logging.error(f"Error synthesizing voice: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Failed to synthesize voice: {str(e)}")

@api_router.get("/sessions/{session_id}")
async def get_session(session_id: str):
    """Get interview session details"""
    try:
        session = await db.interview_sessions.find_one({"id": session_id})
        if not session:
            raise HTTPException(status_code=404, detail="Session not found")

        # Remove MongoDB ObjectId to make it JSON serializable
        if "_id" in session:
            del session["_id"]

        return session
    except Exception as e:
        logging.error(f"Error fetching session: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail="Failed to fetch session")

@api_router.post("/sessions/{session_id}/complete")
async def complete_session(session_id: str):
    """Mark interview session as completed"""
    try:
        result = await db.interview_sessions.update_one(
            {"id": session_id},
            {"$set": {"completed": True}}
        )
        if result.modified_count == 0:
            raise HTTPException(status_code=404, detail="Session not found")
        return {"message": "Session completed successfully"}
    except Exception as e:
        logging.error(f"Error completing session: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail="Failed to complete session")

# Include the router in the main app
app.include_router(api_router)

# Corrected CORS Middleware Configuration
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",
        "http://localhost:3001",
        "http://127.0.0.1:3000",
        "http://127.0.0.1:3001",
        # If you deploy your frontend, add its production URL here.
        # Remove this line if it's your backend's external URL, it doesn't belong here.
        # "https://93641251-8069-4475-8351-bae4f17bad72.preview.emergentagent.com",
        "http://localhost",
        "https://localhost"
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()
