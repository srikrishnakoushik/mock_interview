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

# NEW IMPORTS for httpx and pydub
import httpx # For asynchronous HTTP requests to OpenRouter
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

# --- MODIFIED: API Key setup for OpenRouter ---
# OpenRouter API Key
OPENROUTER_API_KEY = os.environ.get('OPENROUTER_API_KEY') # Get this from openrouter.ai/keys

# Define the models to use on OpenRouter (e.g., Google's Gemini models via OpenRouter)
# Browse models at https://openrouter.ai/models
OPENROUTER_MODEL_CHAT = os.environ.get('OPENROUTER_MODEL_CHAT', "google/gemini-flash-1.5")
OPENROUTER_MODEL_EVAL = os.environ.get('OPENROUTER_MODEL_EVAL', "google/gemini-flash-1.5")
# --- END MODIFIED ---

# Data Models (remain the same)
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

# Helper function to send messages to OpenRouter (replaces direct Gemini/emergentintegrations)
async def send_openrouter_message(system_message: str, user_message_text: str, model: str) -> str:
    if not OPENROUTER_API_KEY:
        logging.error("OPENROUTER_API_KEY environment variable is not set.")
        raise HTTPException(status_code=500, detail="OpenRouter API Key not configured.")

    headers = {
        "Authorization": f"Bearer {OPENROUTER_API_KEY}",
        "Content-Type": "application/json"
    }
    payload = {
        "model": model,
        "messages": [
            {"role": "system", "content": system_message},
            {"role": "user", "content": user_message_text}
        ]
    }

    async with httpx.AsyncClient() as client:
        try:
            response = await client.post("https://openrouter.ai/api/v1/chat/completions", headers=headers, json=payload, timeout=60.0) # Increased timeout
            response.raise_for_status() # Raise an exception for HTTP errors (4xx or 5xx)
            data = response.json()
            if data and "choices" in data and len(data["choices"]) > 0:
                return data["choices"][0]["message"]["content"]
            else:
                logging.error(f"OpenRouter response missing content or choices: {json.dumps(data, indent=2)}")
                raise HTTPException(status_code=500, detail="LLM response missing content.")
        except httpx.HTTPStatusError as e:
            logging.error(f"HTTP error with OpenRouter ({e.response.status_code}): {e.response.text}", exc_info=True)
            if e.response.status_code == 429: # Explicitly handle Too Many Requests
                raise HTTPException(status_code=429, detail=f"LLM API rate limit exceeded. Please try again in a moment. Details: {e.response.text}")
            raise HTTPException(status_code=e.response.status_code, detail=f"LLM API error: {e.response.text}")
        except httpx.RequestError as e:
            logging.error(f"Network error with OpenRouter: {e}", exc_info=True)
            raise HTTPException(status_code=500, detail=f"LLM API network error: {e}")
        except json.JSONDecodeError:
            logging.error(f"Failed to decode OpenRouter JSON response: {response.text}", exc_info=True)
            raise HTTPException(status_code=500, detail="LLM API returned invalid JSON.")
        except Exception as e:
            logging.error(f"Unexpected error in send_openrouter_message: {e}", exc_info=True)
            raise HTTPException(status_code=500, detail=f"Unexpected LLM API error: {e}")


# Routes
@api_router.get("/")
async def root():
    return {"message": "Enhanced Mock Interview API Ready"}

@api_router.post("/questions", response_model=QuestionResponse)
async def generate_questions(request: QuestionRequest):
    """Generate interview questions based on job description using OpenRouter"""
    try:
        system_message = "You are an expert HR interviewer. Generate thoughtful, relevant interview questions based on the job description provided. Ensure your response is ONLY a JSON array of strings, with no other text, markdown fences, or formatting outside the JSON array."
        prompt = f"""
        Based on the following job description, generate 3 diverse interview questions that would effectively assess a candidate's suitability for this role.

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
        response_content = await send_openrouter_message(system_message, prompt, OPENROUTER_MODEL_CHAT)

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

# --- FIX START: Reworked /transcribe endpoint for in-memory processing ---
@api_router.post("/transcribe")
async def transcribe_audio(file: UploadFile = File(...), session_id: str = None, question_index: int = None):
    """Transcribe uploaded audio/video file by converting to WAV in-memory"""
    uploaded_file_path = None
    try:
        # Save the uploaded file to a temporary location first, as pydub needs a path
        uploaded_file_path = tempfile.NamedTemporaryFile(delete=False, suffix=Path(file.filename).suffix).name
        with open(uploaded_file_path, "wb") as temp_file:
            temp_file.write(await file.read())

        # Use pydub to load and convert the audio to an in-memory buffer
        audio_segment = await asyncio.to_thread(AudioSegment.from_file, uploaded_file_path)
        
        wav_buffer = BytesIO()
        await asyncio.to_thread(audio_segment.export, wav_buffer, format="wav")
        wav_buffer.seek(0)

        # Now, use the speech_recognition library with the in-memory buffer
        r = sr.Recognizer()
        with sr.AudioFile(wav_buffer) as source:
            audio = r.record(source)
            transcript = await asyncio.to_thread(r.recognize_google, audio)

        return {"transcript": transcript}

    except AudioSegment.ffmpeg.FFmpegError as ffmpeg_e:
        logging.error(f"FFmpeg error during audio processing: {ffmpeg_e}", exc_info=True)
        raise HTTPException(
            status_code=500,
            detail=f"An internal error occurred during audio processing: Decoding failed. This might be due to a corrupted or unsupported file format."
        )
    except sr.UnknownValueError:
        transcript = "Could not understand the audio. Please speak clearly and try again."
        return {"transcript": transcript}
    except sr.RequestError as e:
        transcript = f"Could not request results from speech recognition service: {str(e)}"
        return {"transcript": transcript}
    except Exception as e:
        logging.error(f"Error during audio processing/transcription: {str(e)}", exc_info=True)
        raise HTTPException(
            status_code=500,
            detail=f"An internal error occurred during audio processing: {str(e)}. This might be due to a corrupted file or a misconfigured backend."
        )
    finally:
        # Ensure the original temporary file is always deleted
        if uploaded_file_path and os.path.exists(uploaded_file_path):
            os.unlink(uploaded_file_path)
# --- FIX END ---


@api_router.post("/evaluate", response_model=EvaluationResponse)
async def evaluate_answer(request: EvaluationRequest):
    """Evaluate interview answer using OpenRouter"""
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
        response_content = await send_openrouter_message(system_message, prompt, OPENROUTER_MODEL_EVAL)

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
        # If your frontend is also deployed to emergentagent.com, add its exact URL here.
        # Otherwise, remove this line as it's your backend's external URL, it doesn't belong here.
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
