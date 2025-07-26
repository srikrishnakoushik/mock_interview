#!/usr/bin/env python3
"""
Backend API Testing Suite for Mock Interview Application
Tests all backend endpoints according to test_result.md priorities
"""

import requests
import json
import time
import os
import tempfile
import wave
import struct
import math
from pathlib import Path

# Backend URL from frontend/.env
BACKEND_URL = "https://93641251-8069-4475-8351-bae4f17bad72.preview.emergentagent.com/api"

class MockInterviewAPITester:
    def __init__(self):
        self.session_id = None
        self.questions = []
        self.test_results = {
            "questions_endpoint": {"status": "PENDING", "details": []},
            "transcribe_endpoint": {"status": "PENDING", "details": []},
            "evaluate_endpoint": {"status": "PENDING", "details": []},
            "session_management": {"status": "PENDING", "details": []}
        }
        
    def log_result(self, test_name, success, message, details=None):
        """Log test results"""
        status = "PASS" if success else "FAIL"
        result = {
            "status": status,
            "message": message,
            "details": details or {}
        }
        
        if test_name in self.test_results:
            self.test_results[test_name]["details"].append(result)
            if not success:
                self.test_results[test_name]["status"] = "FAIL"
        
        print(f"[{status}] {test_name}: {message}")
        if details:
            print(f"    Details: {details}")
    
    def create_test_audio_file(self):
        """Create a simple test WAV audio file"""
        try:
            # Create a temporary WAV file with a simple tone
            temp_file = tempfile.NamedTemporaryFile(delete=False, suffix='.wav')
            
            # Audio parameters
            sample_rate = 44100
            duration = 2  # seconds
            frequency = 440  # Hz (A note)
            
            # Generate audio data
            frames = []
            for i in range(int(sample_rate * duration)):
                value = int(32767 * math.sin(2 * math.pi * frequency * i / sample_rate))
                frames.append(struct.pack('<h', value))
            
            # Write WAV file
            with wave.open(temp_file.name, 'wb') as wav_file:
                wav_file.setnchannels(1)  # mono
                wav_file.setsampwidth(2)  # 2 bytes per sample
                wav_file.setframerate(sample_rate)
                wav_file.writeframes(b''.join(frames))
            
            return temp_file.name
        except Exception as e:
            print(f"Error creating test audio file: {e}")
            return None
    
    def test_questions_endpoint(self):
        """Test POST /api/questions - Generate interview questions"""
        print("\n=== Testing Questions Generation Endpoint ===")
        
        try:
            # Test with realistic job description
            job_description = """
            We are seeking a Senior Software Engineer to join our dynamic development team. 
            The ideal candidate will have 5+ years of experience in full-stack development, 
            proficiency in Python, JavaScript, and React, experience with cloud platforms (AWS/GCP), 
            and strong problem-solving skills. You will be responsible for designing and implementing 
            scalable web applications, mentoring junior developers, and collaborating with 
            cross-functional teams to deliver high-quality software solutions.
            """
            
            payload = {"job_description": job_description.strip()}
            
            print(f"Making request to: {BACKEND_URL}/questions")
            response = requests.post(f"{BACKEND_URL}/questions", json=payload, timeout=30)
            
            if response.status_code == 200:
                data = response.json()
                
                # Validate response structure
                if "questions" in data and "session_id" in data:
                    self.questions = data["questions"]
                    self.session_id = data["session_id"]
                    
                    # Validate questions
                    if isinstance(self.questions, list) and len(self.questions) >= 8:
                        self.log_result("questions_endpoint", True, 
                                      f"Successfully generated {len(self.questions)} questions",
                                      {"session_id": self.session_id, "question_count": len(self.questions)})
                        
                        # Print first few questions for verification
                        print("Sample questions generated:")
                        for i, q in enumerate(self.questions[:3]):
                            print(f"  {i+1}. {q}")
                        
                        self.test_results["questions_endpoint"]["status"] = "PASS"
                    else:
                        self.log_result("questions_endpoint", False, 
                                      f"Invalid questions format or insufficient count: {len(self.questions) if isinstance(self.questions, list) else 'not a list'}")
                else:
                    self.log_result("questions_endpoint", False, 
                                  "Missing required fields in response", 
                                  {"response_keys": list(data.keys())})
            else:
                self.log_result("questions_endpoint", False, 
                              f"HTTP {response.status_code}: {response.text}")
                
        except requests.exceptions.RequestException as e:
            self.log_result("questions_endpoint", False, f"Request failed: {str(e)}")
        except Exception as e:
            self.log_result("questions_endpoint", False, f"Unexpected error: {str(e)}")
    
    def test_transcribe_endpoint(self):
        """Test POST /api/transcribe - Audio transcription"""
        print("\n=== Testing Audio Transcription Endpoint ===")
        
        try:
            # Create test audio file
            audio_file_path = self.create_test_audio_file()
            if not audio_file_path:
                self.log_result("transcribe_endpoint", False, "Failed to create test audio file")
                return
            
            try:
                # Test transcription
                with open(audio_file_path, 'rb') as audio_file:
                    files = {'file': ('test_audio.wav', audio_file, 'audio/wav')}
                    data = {
                        'session_id': self.session_id or 'test_session',
                        'question_index': 0
                    }
                    
                    print(f"Making request to: {BACKEND_URL}/transcribe")
                    response = requests.post(f"{BACKEND_URL}/transcribe", files=files, data=data, timeout=30)
                
                if response.status_code == 200:
                    result = response.json()
                    
                    if "transcript" in result:
                        transcript = result["transcript"]
                        self.log_result("transcribe_endpoint", True, 
                                      "Audio transcription successful",
                                      {"transcript_length": len(transcript), "transcript_preview": transcript[:100]})
                        self.test_results["transcribe_endpoint"]["status"] = "PASS"
                    else:
                        self.log_result("transcribe_endpoint", False, 
                                      "Missing transcript in response",
                                      {"response": result})
                else:
                    self.log_result("transcribe_endpoint", False, 
                                  f"HTTP {response.status_code}: {response.text}")
                    
            finally:
                # Clean up test file
                if os.path.exists(audio_file_path):
                    os.unlink(audio_file_path)
                    
        except Exception as e:
            self.log_result("transcribe_endpoint", False, f"Unexpected error: {str(e)}")
    
    def test_evaluate_endpoint(self):
        """Test POST /api/evaluate - Answer evaluation"""
        print("\n=== Testing Answer Evaluation Endpoint ===")
        
        try:
            if not self.questions:
                self.log_result("evaluate_endpoint", False, "No questions available for evaluation test")
                return
            
            # Test evaluation with realistic data
            test_question = self.questions[0] if self.questions else "Tell me about your experience with Python programming."
            test_transcript = """
            I have been working with Python for over 4 years now. I started using it for data analysis 
            and automation scripts, but over time I've expanded to web development using frameworks like 
            Django and Flask. I've built several REST APIs and have experience with libraries like 
            pandas, numpy, and requests. I'm comfortable with both Python 2 and 3, though I primarily 
            work with Python 3 now. I've also used Python for machine learning projects with scikit-learn 
            and have some experience with async programming using asyncio.
            """
            
            job_description = """
            Senior Software Engineer position requiring 5+ years of experience in full-stack development, 
            proficiency in Python, JavaScript, and React, experience with cloud platforms.
            """
            
            payload = {
                "transcript": test_transcript.strip(),
                "question": test_question,
                "job_description": job_description.strip()
            }
            
            print(f"Making request to: {BACKEND_URL}/evaluate")
            response = requests.post(f"{BACKEND_URL}/evaluate", json=payload, timeout=30)
            
            if response.status_code == 200:
                evaluation = response.json()
                
                # Validate evaluation structure
                required_fields = ["score", "strengths", "weaknesses", "suggestions"]
                if all(field in evaluation for field in required_fields):
                    score = evaluation["score"]
                    strengths = evaluation["strengths"]
                    weaknesses = evaluation["weaknesses"]
                    suggestions = evaluation["suggestions"]
                    
                    # Validate data types and ranges
                    if (isinstance(score, int) and 1 <= score <= 10 and
                        isinstance(strengths, list) and len(strengths) > 0 and
                        isinstance(weaknesses, list) and len(weaknesses) > 0 and
                        isinstance(suggestions, list) and len(suggestions) > 0):
                        
                        self.log_result("evaluate_endpoint", True, 
                                      f"Answer evaluation successful (Score: {score}/10)",
                                      {
                                          "score": score,
                                          "strengths_count": len(strengths),
                                          "weaknesses_count": len(weaknesses),
                                          "suggestions_count": len(suggestions)
                                      })
                        self.test_results["evaluate_endpoint"]["status"] = "PASS"
                        
                        # Print evaluation details
                        print(f"Evaluation Score: {score}/10")
                        print(f"Strengths: {strengths}")
                        print(f"Areas for improvement: {weaknesses}")
                        
                    else:
                        self.log_result("evaluate_endpoint", False, 
                                      "Invalid evaluation data format or values",
                                      {"evaluation": evaluation})
                else:
                    self.log_result("evaluate_endpoint", False, 
                                  "Missing required fields in evaluation response",
                                  {"missing_fields": [f for f in required_fields if f not in evaluation]})
            else:
                self.log_result("evaluate_endpoint", False, 
                              f"HTTP {response.status_code}: {response.text}")
                
        except Exception as e:
            self.log_result("evaluate_endpoint", False, f"Unexpected error: {str(e)}")
    
    def test_session_management(self):
        """Test session management endpoints"""
        print("\n=== Testing Session Management Endpoints ===")
        
        if not self.session_id:
            self.log_result("session_management", False, "No session ID available for testing")
            return
        
        try:
            # Test GET /api/sessions/{session_id}
            print(f"Testing GET /api/sessions/{self.session_id}")
            response = requests.get(f"{BACKEND_URL}/sessions/{self.session_id}", timeout=15)
            
            if response.status_code == 200:
                session_data = response.json()
                
                # Validate session data structure
                if "id" in session_data and "job_description" in session_data and "questions" in session_data:
                    self.log_result("session_management", True, 
                                  "Session retrieval successful",
                                  {"session_id": session_data["id"], "has_questions": len(session_data.get("questions", []))})
                else:
                    self.log_result("session_management", False, 
                                  "Invalid session data structure",
                                  {"session_keys": list(session_data.keys())})
                    return
            else:
                self.log_result("session_management", False, 
                              f"Session retrieval failed: HTTP {response.status_code}")
                return
            
            # Test POST /api/sessions/{session_id}/complete
            print(f"Testing POST /api/sessions/{self.session_id}/complete")
            response = requests.post(f"{BACKEND_URL}/sessions/{self.session_id}/complete", timeout=15)
            
            if response.status_code == 200:
                result = response.json()
                if "message" in result:
                    self.log_result("session_management", True, 
                                  "Session completion successful",
                                  {"message": result["message"]})
                    self.test_results["session_management"]["status"] = "PASS"
                else:
                    self.log_result("session_management", False, 
                                  "Invalid completion response format")
            else:
                self.log_result("session_management", False, 
                              f"Session completion failed: HTTP {response.status_code}")
                
        except Exception as e:
            self.log_result("session_management", False, f"Unexpected error: {str(e)}")
    
    def run_all_tests(self):
        """Run all backend tests in priority order"""
        print("Starting Mock Interview Backend API Tests")
        print(f"Backend URL: {BACKEND_URL}")
        print("=" * 60)
        
        # Test in priority order: HIGH priority first
        self.test_questions_endpoint()
        self.test_transcribe_endpoint()  
        self.test_evaluate_endpoint()
        self.test_session_management()  # MEDIUM priority
        
        # Print final summary
        self.print_test_summary()
    
    def print_test_summary(self):
        """Print comprehensive test summary"""
        print("\n" + "=" * 60)
        print("BACKEND API TEST SUMMARY")
        print("=" * 60)
        
        total_tests = 0
        passed_tests = 0
        
        for test_name, result in self.test_results.items():
            status = result["status"]
            total_tests += 1
            if status == "PASS":
                passed_tests += 1
            
            print(f"\n{test_name.upper().replace('_', ' ')}: {status}")
            
            for detail in result["details"]:
                print(f"  - {detail['status']}: {detail['message']}")
        
        print(f"\nOVERALL RESULT: {passed_tests}/{total_tests} tests passed")
        
        if passed_tests == total_tests:
            print("✅ All backend tests PASSED!")
        else:
            print("❌ Some backend tests FAILED!")
        
        return passed_tests == total_tests

if __name__ == "__main__":
    tester = MockInterviewAPITester()
    success = tester.run_all_tests()
    exit(0 if success else 1)