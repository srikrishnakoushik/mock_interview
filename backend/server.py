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
from emergentintegrations.llm.chat import LlmChat, UserMessage

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# MongoDB connection
mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

# Create the main app without a prefix
app = FastAPI()

# Create a router with the /api prefix
api_router = APIRouter(prefix="/api")

# Gemini API setup
GEMINI_API_KEY = os.environ.get('GEMINI_API_KEY')

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
    job_description: str

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

# Routes
@api_router.get("/")
async def root():
    return {"message": "Mock Interview API Ready"}

@api_router.post("/questions", response_model=QuestionResponse)
async def generate_questions(request: QuestionRequest):
    """Generate interview questions based on job description using Gemini"""
    try:
        # Create LLM chat instance
        chat = LlmChat(
            api_key=GEMINI_API_KEY,
            session_id=f"questions_{uuid.uuid4()}",
            system_message="You are an expert HR interviewer. Generate thoughtful, relevant interview questions based on the job description provided."
        ).with_model("gemini", "gemini-1.5-flash")

        # Create prompt for question generation
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

        Return only the questions as a JSON array of strings, no additional text or formatting.
        """

        user_message = UserMessage(text=prompt)
        response = await chat.send_message(user_message)
        
        # Parse the response to extract questions
        try:
            # Try to parse as JSON first
            questions = json.loads(response)
            if not isinstance(questions, list):
                raise ValueError("Response is not a list")
        except (json.JSONDecodeError, ValueError):
            # Fallback: split by lines and clean up
            lines = response.strip().split('\n')
            questions = []
            for line in lines:
                line = line.strip()
                if line and not line.startswith('#') and not line.startswith('```'):
                    # Remove numbering and clean up
                    if '. ' in line:
                        line = line.split('. ', 1)[1]
                    questions.append(line.strip('"'))
            
            # Ensure we have 8-10 questions
            if len(questions) < 8:
                questions.extend([
                    "Tell me about a challenging project you've worked on recently.",
                    "How do you handle working under pressure and tight deadlines?"
                ])

        # Create interview session
        session = InterviewSession(
            job_description=request.job_description,
            questions=questions[:10]  # Limit to 10 questions
        )
        
        # Save to database
        await db.interview_sessions.insert_one(session.dict())
        
        return QuestionResponse(questions=session.questions, session_id=session.id)
        
    except Exception as e:
        logging.error(f"Error generating questions: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to generate questions: {str(e)}")

@api_router.post("/transcribe")
async def transcribe_audio(file: UploadFile = File(...), session_id: str = None, question_index: int = None):
    """Transcribe uploaded audio/video file"""
    try:
        if not file.filename.lower().endswith(('.wav', '.mp3', '.m4a', '.ogg', '.webm', '.mp4')):
            raise HTTPException(status_code=400, detail="Unsupported file format")
        
        # Save uploaded file temporarily
        with tempfile.NamedTemporaryFile(delete=False, suffix=Path(file.filename).suffix) as temp_file:
            content = await file.read()
            temp_file.write(content)
            temp_file_path = temp_file.name

        try:
            # Use speech recognition
            r = sr.Recognizer()
            
            # For audio files
            if file.filename.lower().endswith(('.wav', '.mp3', '.m4a', '.ogg')):
                with sr.AudioFile(temp_file_path) as source:
                    audio = r.record(source)
                    transcript = r.recognize_google(audio)
            else:
                # For video files, we'll need to extract audio first
                # For now, return a placeholder
                transcript = "Transcription not available for video files yet. Please use audio files (.wav, .mp3, .m4a, .ogg)."
            
        except sr.UnknownValueError:
            transcript = "Could not understand the audio. Please speak clearly and try again."
        except sr.RequestError as e:
            transcript = f"Could not request results from speech recognition service: {str(e)}"
        finally:
            # Clean up temp file
            os.unlink(temp_file_path)
            
        return {"transcript": transcript}
        
    except Exception as e:
        logging.error(f"Error transcribing audio: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to transcribe audio: {str(e)}")

@api_router.post("/evaluate", response_model=EvaluationResponse)
async def evaluate_answer(request: EvaluationRequest):
    """Evaluate interview answer using Gemini"""
    try:
        # Create LLM chat instance
        chat = LlmChat(
            api_key=GEMINI_API_KEY,
            session_id=f"evaluation_{uuid.uuid4()}",
            system_message="You are an expert HR interviewer and career coach. Provide constructive evaluation of interview responses."
        ).with_model("gemini", "gemini-1.5-flash")

        prompt = f"""
        Evaluate this interview answer for the given question and job context:

        Job Description Context:
        {request.job_description}

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
        """

        user_message = UserMessage(text=prompt)
        response = await chat.send_message(user_message)
        
        try:
            # Parse JSON response
            evaluation = json.loads(response)
            
            return EvaluationResponse(
                score=evaluation.get("score", 5),
                strengths=evaluation.get("strengths", ["Response provided"]),
                weaknesses=evaluation.get("weaknesses", ["Could be more detailed"]),
                suggestions=evaluation.get("suggestions", ["Provide more specific examples"])
            )
            
        except json.JSONDecodeError:
            # Fallback evaluation
            return EvaluationResponse(
                score=6,
                strengths=["Response provided", "Addressed the question"],
                weaknesses=["Could be more structured", "Needs more detail"],
                suggestions=["Use the STAR method", "Provide specific examples", "Be more concise"]
            )
            
    except Exception as e:
        logging.error(f"Error evaluating answer: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to evaluate answer: {str(e)}")

@api_router.get("/sessions/{session_id}")
async def get_session(session_id: str):
    """Get interview session details"""
    try:
        session = await db.interview_sessions.find_one({"id": session_id})
        if not session:
            raise HTTPException(status_code=404, detail="Session not found")
        return session
    except Exception as e:
        logging.error(f"Error fetching session: {str(e)}")
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
        logging.error(f"Error completing session: {str(e)}")
        raise HTTPException(status_code=500, detail="Failed to complete session")

# Include the router in the main app
app.include_router(api_router)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=["*"],
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