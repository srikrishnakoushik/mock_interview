import React, { useState, useRef, useCallback, useEffect, Suspense } from "react";
import { Canvas, useFrame } from '@react-three/fiber';
import { OrbitControls, Text, Sphere, MeshDistortMaterial, Box, Cylinder, Html } from '@react-three/drei';
import { motion } from 'framer-motion';
import axios from "axios";

// IMPORTANT: Replace this with the URL of your deployed backend.
// For local development, it will likely be something like 'http://127.0.0.1:8000'.
// NOTE: If you see a "Network Error" or "Connection Refused", please ensure your backend server is running.
const BACKEND_URL = "http://127.0.0.1:8001";
const API = `${BACKEND_URL}/api`;

/**
 * Custom hook for native Web Speech API.
 * This version does not automatically trigger a callback on `onend`,
 * allowing for manual control of the interview flow.
 */
const useSpeech = () => {
  const [speaking, setSpeaking] = useState(false);
  const [listening, setListening] = useState(false);
  const [transcript, setTranscript] = useState("");
  const recognitionRef = useRef(null);
  const utteranceRef = useRef(null);

  // Text-to-Speech (TTS)
  const speak = useCallback((text) => {
    if ('speechSynthesis' in window) {
      // Cancel any ongoing speech before starting a new one
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.onstart = () => setSpeaking(true);
      utterance.onend = () => setSpeaking(false);
      utteranceRef.current = utterance;
      window.speechSynthesis.speak(utterance);
    } else {
      console.warn("Speech Synthesis not supported by this browser.");
    }
  }, []);

  const cancelSpeak = useCallback(() => {
    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel();
      setSpeaking(false);
    }
  }, []);

  // Speech Recognition (STT)
  const startListening = useCallback(() => {
    if ('webkitSpeechRecognition' in window) {
      if (recognitionRef.current) return;
      
      const recognition = new window.webkitSpeechRecognition();
      recognition.continuous = true; // Set to true to allow for pauses
      recognition.interimResults = false;
      recognition.lang = 'en-US';
      recognitionRef.current = recognition;

      recognition.onstart = () => {
        setListening(true);
        setTranscript(""); // Clear transcript on start
      };

      recognition.onresult = (event) => {
        const result = event.results[0][0].transcript;
        setTranscript(result);
      };

      recognition.onend = () => {
        setListening(false);
        recognitionRef.current = null;
      };

      recognition.onerror = (event) => {
        console.error('Speech recognition error:', event.error);
        setListening(false);
      };

      recognition.start();
    } else {
      console.warn("Speech Recognition not supported by this browser.");
    }
  }, [setListening, setTranscript]);

  const stopListening = useCallback(() => {
    if (recognitionRef.current) {
      recognitionRef.current.stop();
      recognitionRef.current = null;
    }
  }, []);

  return { speak, cancelSpeak, speaking, startListening, stopListening, listening, transcript, setTranscript };
};

/**
 * Animated Eye component for the 3D interviewer avatar.
 * Handles blinking and subtle movement.
 */
const AnimatedEye = ({ position, isBlinking, isListening, isSpeaking }) => {
  const eyeRef = useRef();

  useFrame((state) => {
    if (eyeRef.current) {
      // Blinking animation
      if (isBlinking) {
        eyeRef.current.scale.y = 0.1;
      } else {
        eyeRef.current.scale.y = 1;
      }

      // Eye movement based on speaking/listening
      if (isSpeaking) {
        eyeRef.current.rotation.z = Math.sin(state.clock.elapsedTime * 8) * 0.1;
      } else if (isListening) {
        eyeRef.current.rotation.z = Math.sin(state.clock.elapsedTime * 2) * 0.05;
      }
    }
  });

  return (
    <Sphere
      ref={eyeRef}
      args={[0.08, 16, 16]}
      position={position}
    >
      <meshStandardMaterial
        color={isListening ? "#10b981" : isSpeaking ? "#4f46e5" : "#1f2937"}
      />
    </Sphere>
  );
};

/**
 * Animated Mouth component for the 3D interviewer avatar.
 * Handles opening/closing animation while speaking.
 */
const AnimatedMouth = ({ isSpeaking, isListening }) => {
  const mouthRef = useRef();

  useFrame((state) => {
    if (mouthRef.current) {
      if (isSpeaking) {
        // Mouth opening/closing animation while speaking
        const scale = 1 + Math.sin(state.clock.elapsedTime * 10) * 0.3;
        mouthRef.current.scale.x = scale;
        mouthRef.current.scale.z = scale;
      } else if (isListening) {
        // Subtle mouth movement while listening
        mouthRef.current.scale.x = 1 + Math.sin(state.clock.elapsedTime * 3) * 0.1;
      } else {
        mouthRef.current.scale.x = 1;
        mouthRef.current.scale.z = 1;
      }
    }
  });

  return (
    <Box
      ref={mouthRef}
      args={[0.15, 0.05, 0.08]}
      position={[0, -0.1, 0.65]}
    >
      <meshStandardMaterial
        color={isSpeaking ? "#ef4444" : "#374151"}
      />
    </Box>
  );
};

/**
 * The main 3D Interviewer Avatar component with expressions and a suit.
 * The core visual representation of the AI agent.
 */
const InterviewerAvatar = ({ isListening, isSpeaking }) => {
  const headRef = useRef();
  const [isBlinking, setIsBlinking] = useState(false);

  // Blinking animation
  useEffect(() => {
    const blinkInterval = setInterval(() => {
      setIsBlinking(true);
      setTimeout(() => setIsBlinking(false), 150);
    }, 2000 + Math.random() * 3000);

    return () => clearInterval(blinkInterval);
  }, []);

  useFrame((state) => {
    if (headRef.current) {
      // Head bobbing animation
      if (isSpeaking) {
        headRef.current.rotation.y = Math.sin(state.clock.elapsedTime * 4) * 0.1;
        headRef.current.position.y = 0.5 + Math.sin(state.clock.elapsedTime * 6) * 0.02;
      } else if (isListening) {
        headRef.current.rotation.y = Math.sin(state.clock.elapsedTime * 1) * 0.05;
        headRef.current.position.y = 0.5 + Math.sin(state.clock.elapsedTime * 2) * 0.01;
      } else {
        // Reset to default position when idle
        headRef.current.rotation.y = 0;
        headRef.current.position.y = 0.5;
      }
    }
  });

  return (
    <group>
      {/* Head with expressions */}
      <group ref={headRef}>
        {/* Main head */}
        <Sphere args={[0.8, 32, 32]} position={[0, 0.5, 0]}>
          <MeshDistortMaterial
            color={isSpeaking ? "#4f46e5" : isListening ? "#10b981" : "#6b7280"}
            attach="material"
            distort={isSpeaking ? 0.3 : isListening ? 0.15 : 0.05}
            speed={isSpeaking ? 6 : isListening ? 3 : 1}
          />
        </Sphere>
        
        {/* Eyebrows for more expression */}
        <Box args={[0.3, 0.04, 0.05]} position={[-0.2, 0.78, 0.6]} rotation={[Math.PI / 10, 0, 0]}>
          <meshStandardMaterial color="#374151" />
        </Box>
        <Box args={[0.3, 0.04, 0.05]} position={[0.2, 0.78, 0.6]} rotation={[Math.PI / 10, 0, 0]}>
          <meshStandardMaterial color="#374151" />
        </Box>

        {/* Eyes */}
        <AnimatedEye 
          position={[-0.25, 0.65, 0.6]} 
          isBlinking={isBlinking}
          isListening={isListening}
          isSpeaking={isSpeaking}
        />
        <AnimatedEye 
          position={[0.25, 0.65, 0.6]} 
          isBlinking={isBlinking}
          isListening={isListening}
          isSpeaking={isSpeaking}
        />
        
        {/* Nose */}
        <Box args={[0.05, 0.15, 0.1]} position={[0, 0.45, 0.7]}>
          <meshStandardMaterial color="#4b5563" />
        </Box>
        
        {/* Animated mouth */}
        <AnimatedMouth isSpeaking={isSpeaking} isListening={isListening} />
      </group>
      
      {/* Professional suit body */}
      <Cylinder args={[0.6, 0.8, 1.2, 8]} position={[0, -0.8, 0]}>
        <meshStandardMaterial color="#1f2937" />
      </Cylinder>
      
      {/* Tie */}
      <Box args={[0.15, 0.8, 0.02]} position={[0, -0.5, 0.8]}>
        <meshStandardMaterial color="#dc2626" />
      </Box>
      
      {/* Arms */}
      <Cylinder args={[0.12, 0.12, 0.8, 8]} position={[-0.7, -0.8, 0]} rotation={[0, 0, Math.PI / 6]}>
        <meshStandardMaterial color="#374151" />
      </Cylinder>
      <Cylinder args={[0.12, 0.12, 0.8, 8]} position={[0.7, -0.8, 0]} rotation={[0, 0, -Math.PI / 6]}>
        <meshStandardMaterial color="#374151" />
      </Cylinder>

      {/* Professional label */}
      <Text
        position={[0, -2, 0]}
        fontSize={0.2}
        color="#1f2937"
        anchorX="center"
        anchorY="middle"
      >
        AI Interviewer
      </Text>
      
      {/* Dynamic status indicator */}
      <Text
        position={[0, 1.5, 0]}
        color={isSpeaking ? "#4f46e5" : "#10b981"} // Changed color logic for status
        anchorX="center"
        anchorY="middle"
        fontSize={0.15}
      >
        {isSpeaking ? "🗣️ Speaking..." : isListening ? "👂 Listening..." : "🤖 Ready"}
      </Text>
      
      {/* Floating particles for effect */}
      {(isSpeaking || isListening) && (
        <>
          {[...Array(5)].map((_, i) => (
            <FloatingParticle key={i} index={i} active={isSpeaking || isListening} />
          ))}
        </>
      )}
    </group>
  );
};

/**
 * Floating particles around the avatar for a dynamic effect.
 */
const FloatingParticle = ({ index, active }) => {
  const particleRef = useRef();
  
  useFrame((state) => {
    if (particleRef.current && active) {
      const time = state.clock.elapsedTime + index;
      particleRef.current.position.x = Math.sin(time * 2) * 2;
      particleRef.current.position.y = Math.cos(time * 1.5) * 1.5 + 0.5;
      particleRef.current.position.z = Math.sin(time * 1.2) * 1;
      particleRef.current.rotation.x = time;
      particleRef.current.rotation.y = time * 1.5;
    }
  });

  return (
    <Sphere ref={particleRef} args={[0.02, 8, 8]}>
      <meshStandardMaterial 
        color="#4f46e5" 
        transparent 
        opacity={0.6}
        emissive="#4f46e5"
        emissiveIntensity={0.2}
      />
    </Sphere>
  );
};

/**
 * Loading component for 3D scene.
 */
const Loading3D = () => (
  <Html center>
    <div className="flex items-center justify-center"
         style={{
             height: '100%',
             width: '100%',
             display: 'flex',
             flexDirection: 'column',
             alignItems: 'center',
             justifyContent: 'center',
         }}>
      <div className="text-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
        <p className="text-gray-600 mt-2">Loading 3D Interviewer...</p>
      </div>
    </div>
  </Html>
);

/**
 * Custom "Alert" Modal Component.
 * Replaces the use of `alert()` and `confirm()` for a better UI experience.
 */
const MessageModal = ({ message, onClose }) => {
  if (!message) return null;

  return (
    <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50 flex items-center justify-center">
      <div className="bg-white rounded-lg shadow-xl p-6 m-4 max-w-sm w-full">
        <div className="text-center">
          <svg className="mx-auto h-12 w-12 text-blue-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <h3 className="text-lg leading-6 font-medium text-gray-900 mt-3">Heads Up!</h3>
          <div className="mt-2">
            <p className="text-sm text-gray-500">{message}</p>
          </div>
        </div>
        <div className="mt-5 sm:mt-6">
          <button
            type="button"
            className="inline-flex justify-center w-full rounded-md border border-transparent shadow-sm px-4 py-2 bg-blue-600 text-base font-medium text-white hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 sm:text-sm"
            onClick={onClose}
          >
            OK
          </button>
        </div>
      </div>
    </div>
  );
};

/**
 * First View: User pastes job description to generate questions.
 */
const JobDescriptionInput = ({ onQuestionsGenerated }) => {
  const [jobDescription, setJobDescription] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const { speak, speaking, cancelSpeak } = useSpeech();
  const spokenRef = useRef(false);

  useEffect(() => {
    // Speak a welcome message on first render
    if (!spokenRef.current) {
      speak("Hello there! I'm your AI interviewer. Please paste your job description below to get started.");
      spokenRef.current = true;
    }
    // Cleanup function to cancel speech when component unmounts
    return () => {
      cancelSpeak();
    };
  }, [speak, cancelSpeak]);

  const handleSubmit = useCallback(async (e) => {
    e.preventDefault();
    if (!jobDescription.trim()) return;

    setLoading(true);
    speak("Generating your interview questions now. Please wait a moment.");
    
    try {
      // Use axios to call the backend's /questions endpoint
      const response = await axios.post(`${API}/questions`, {
        job_description: jobDescription
      });
      // The backend now returns both questions and a session_id
      onQuestionsGenerated({
        questions: response.data.questions,
        job_description: jobDescription,
        session_id: response.data.session_id
      });
      speak("Questions generated successfully! Review them and start when ready.");
    } catch (error) {
      console.error("Error generating questions:", error);
      setMessage("Sorry, there was an error generating questions. Please try again.");
      speak("Sorry, there was an error generating questions. Please try again.");
    } finally {
      setLoading(false);
    }
  }, [jobDescription, onQuestionsGenerated, speak]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-6">
      <MessageModal message={message} onClose={() => setMessage("")} />
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 w-full max-w-6xl">
        {/* Left side - 3D Avatar */}
        <div className="bg-white rounded-2xl shadow-xl p-6">
          <div className="h-80 w-full">
            <Canvas camera={{ position: [0, 0, 5], fov: 50 }}>
              <ambientLight intensity={0.6} />
              <directionalLight position={[10, 10, 5]} intensity={1} />
              <pointLight position={[-10, -10, -5]} intensity={0.5} />
              <Suspense fallback={<Loading3D />}>
                <InterviewerAvatar isListening={false} isSpeaking={speaking} />
                <OrbitControls 
                  enableZoom={false} 
                  enablePan={false} 
                  maxPolarAngle={Math.PI / 2}
                  minPolarAngle={Math.PI / 3}
                />
              </Suspense>
            </Canvas>
          </div>
          <div className="text-center mt-4">
            <h3 className="text-xl font-bold text-gray-800">Meet Your AI Interviewer</h3>
            <p className="text-gray-600 mt-2">I'll help you practice for your interview with personalized questions and feedback.</p>
            {speaking && (
              <div className="mt-3 flex items-center justify-center text-blue-600">
                <div className="animate-pulse w-2 h-2 bg-blue-600 rounded-full mr-1"></div>
                <div className="animate-pulse w-2 h-2 bg-blue-600 rounded-full mr-1 delay-100"></div>
                <div className="animate-pulse w-2 h-2 bg-blue-600 rounded-full delay-200"></div>
                <span className="ml-2 text-sm">Speaking...</span>
              </div>
            )}
          </div>
        </div>

        {/* Right side - Form */}
        <div className="bg-white rounded-2xl shadow-xl p-8">
          <div className="text-center mb-8">
            <h1 className="text-4xl font-bold text-gray-800 mb-4">🎯 Mock Interview</h1>
            <p className="text-gray-600 text-lg">Paste your job description to get started with AI-powered interview practice</p>
          </div>
          
          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <label htmlFor="job-description" className="block text-sm font-semibold text-gray-700 mb-3">
                Job Description
              </label>
              <textarea
                id="job-description"
                value={jobDescription}
                onChange={(e) => setJobDescription(e.target.value)}
                placeholder="Paste the job description here..."
                className="w-full h-48 p-4 border-2 border-gray-200 rounded-xl focus:border-blue-500 focus:ring-2 focus:ring-blue-200 transition-all resize-none text-gray-700"
                disabled={loading}
              />
            </div>
            
            <button
              type="submit"
              disabled={loading || !jobDescription.trim()}
              className="w-full bg-gradient-to-r from-blue-600 to-indigo-600 text-white py-4 px-6 rounded-xl font-semibold text-lg hover:from-blue-700 hover:to-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 transform hover:scale-[1.02]"
            >
              {loading ? (
                <span className="flex items-center justify-center">
                  <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-white mr-3"></div>
                  Generating Questions...
                </span>
              ) : (
                "Generate Interview Questions 🚀"
              )}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
};

/**
 * Second View: Displays generated questions for review.
 */
const QuestionGenerationView = ({ questionsData, onStartInterview }) => {
  const { speak, speaking, cancelSpeak } = useSpeech();
  const spokenRef = useRef(false);

  useEffect(() => {
    if (!spokenRef.current) {
      speak(`I've prepared ${questionsData.questions.length} questions for your interview. Take a moment to review them, then we can begin.`);
      spokenRef.current = true;
    }
    return () => {
      cancelSpeak();
    };
  }, [speak, cancelSpeak, questionsData]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-green-50 to-emerald-100 p-6">
      <div className="max-w-6xl mx-auto">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* 3D Avatar */}
          <div className="bg-white rounded-2xl shadow-xl p-6">
            <div className="h-64 w-full">
              <Canvas camera={{ position: [0, 0, 5], fov: 50 }}>
                <ambientLight intensity={0.6} />
                <directionalLight position={[10, 10, 5]} intensity={1} />
                <pointLight position={[-10, -10, -5]} intensity={0.5} />
                <Suspense fallback={<Loading3D />}>
                  <InterviewerAvatar isListening={false} isSpeaking={speaking} />
                  <OrbitControls 
                    enableZoom={false} 
                    enablePan={false} 
                    maxPolarAngle={Math.PI / 2}
                    minPolarAngle={Math.PI / 3}
                  />
                </Suspense>
              </Canvas>
            </div>
            <div className="text-center mt-3">
              <p className="text-sm text-gray-600">Questions Ready! 🎯</p>
            </div>
          </div>

          {/* Questions List */}
          <div className="lg:col-span-2 bg-white rounded-2xl shadow-xl p-8">
            <div className="text-center mb-8">
              <h2 className="text-3xl font-bold text-gray-800 mb-4">✅ Questions Generated!</h2>
              <p className="text-gray-600">Review your interview questions and start when ready</p>
            </div>
            
            <div className="space-y-4 mb-8 max-h-96 overflow-y-auto">
              {questionsData?.questions.map((question, index) => (
                <motion.div 
                  key={index} 
                  className="bg-gray-50 p-4 rounded-xl border-l-4 border-blue-500"
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: index * 0.1 }}
                >
                  <div className="flex items-start">
                    <span className="bg-blue-500 text-white rounded-full w-8 h-8 flex items-center justify-center font-semibold text-sm mr-4 mt-1 flex-shrink-0">
                      {index + 1}
                    </span>
                    <p className="text-gray-700 leading-relaxed">{question}</p>
                  </div>
                </motion.div>
              ))}
            </div>
            
            <div className="text-center">
              <button
                onClick={() => onStartInterview(questionsData)}
                className="bg-gradient-to-r from-green-600 to-emerald-600 text-white py-4 px-8 rounded-xl font-semibold text-lg hover:from-green-700 hover:to-emerald-700 transition-all duration-200 transform hover:scale-[1.02]"
              >
                Start Interview 🎤
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

/**
 * Third View: The main interview session with camera and voice interaction.
 * Handles the manual flow from asking a question to evaluating an answer.
 */
const Recorder = ({ questionsData, onInterviewComplete }) => {
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [isEvaluating, setIsEvaluating] = useState(false);
  const [answers, setAnswers] = useState([]);
  const [message, setMessage] = useState("");
  const videoRef = useRef(null);
  const { speak, speaking, cancelSpeak, startListening, stopListening, listening, transcript, setTranscript } = useSpeech();
  
  const [isInterviewStarted, setIsInterviewStarted] = useState(false);
  const [interviewState, setInterviewState] = useState('IDLE');
  const startTimeRef = useRef(null);
  const [totalTime, setTotalTime] = useState(0);

  // 1. Media Stream Initialization (runs once on mount)
  useEffect(() => {
    const initMediaStream = async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: true });
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
        }
      } catch (error) {
        console.error("Recorder: Error accessing media stream:", error);
        setMessage("Failed to access microphone/camera. Please check permissions.");
      }
    };
    initMediaStream();
    return () => {
      if (videoRef.current?.srcObject) {
        videoRef.current.srcObject.getTracks().forEach(track => track.stop());
      }
      cancelSpeak();
    };
  }, [cancelSpeak]);
  
  // 2. Function to handle submission and evaluation
  const handleAnswerSubmission = useCallback(async (transcribedText) => {
    setIsEvaluating(true);
    setInterviewState('EVALUATING');
    
    // Evaluate the answer by calling the backend's /evaluate endpoint
    try {
      const response = await axios.post(`${API}/evaluate`, {
        question: questionsData.questions[currentQuestionIndex],
        transcript: transcribedText,
        session_id: questionsData.session_id
      });

      const evaluation = response.data;
      
      const newAnswer = {
        questionIndex: currentQuestionIndex,
        question: questionsData.questions[currentQuestionIndex],
        transcript: transcribedText,
        evaluation: evaluation
      };
      
      const updatedAnswers = [...answers, newAnswer];
      setAnswers(updatedAnswers);
      
      if (currentQuestionIndex + 1 < questionsData.questions.length) {
        setMessage(`Evaluation for Q${currentQuestionIndex + 1} complete. Moving to next question.`);
        speak(`Evaluation for question ${currentQuestionIndex + 1} complete. Your score was ${evaluation.score} out of 10. Moving to the next question.`);
        
        // After speaking the evaluation, move to the next question
        setTimeout(() => {
          setCurrentQuestionIndex(prev => prev + 1);
          setTranscript(""); // Clear transcript for new question
          setInterviewState('READY_FOR_NEXT'); // Revert to a ready state for the user to click next
        }, 3000);
      } else {
        setMessage("You've completed all questions. Preparing your final feedback report.");
        speak("You've completed all questions. Preparing your final feedback report.");
        const endTime = Date.now();
        const totalInterviewTime = endTime - startTimeRef.current;
        setTotalTime(totalInterviewTime);
        onInterviewComplete(updatedAnswers, totalInterviewTime);
      }
    } catch (error) {
      console.error("Error during evaluation:", error);
      setMessage("There was an error evaluating your answer. Please try again.");
      speak("There was an error evaluating your answer. Please try again.");
        setTimeout(() => {
            setCurrentQuestionIndex(prev => prev + 1);
            setInterviewState('READY_FOR_NEXT');
        }, 3000);
    } finally {
      setIsEvaluating(false);
    }
  }, [answers, currentQuestionIndex, questionsData, onInterviewComplete, speak, setTranscript]);

  // 3. Handle the initial interview start
  const handleBeginInterview = () => {
    setIsInterviewStarted(true);
    startTimeRef.current = Date.now();
    setInterviewState('ASKING_QUESTION');
    speak(`Question 1: ${questionsData.questions[0]}`);
  };

  const handleAskNextQuestion = () => {
    setInterviewState('ASKING_QUESTION');
    speak(`Question ${currentQuestionIndex + 1}: ${questionsData.questions[currentQuestionIndex]}`);
  };

  const handleStartRecording = () => {
    setInterviewState('LISTENING_FOR_ANSWER');
    startListening();
  };
  
  const handleStopRecording = () => {
    stopListening();
  };

  const handleManualEvaluation = () => {
    if (transcript.length > 0) {
      handleAnswerSubmission(transcript);
    } else {
      setMessage("No answer transcribed. Please record your answer first.");
    }
  };

  // State management to control button visibility and text
  useEffect(() => {
    if (!speaking && isInterviewStarted && currentQuestionIndex < questionsData.questions.length && interviewState === 'ASKING_QUESTION') {
      // After AI finishes speaking, change state to allow user to record
      setInterviewState('READY_FOR_RECORDING');
    }
  }, [speaking, isInterviewStarted, currentQuestionIndex, questionsData.questions.length, interviewState]);

  const progress = ((currentQuestionIndex) / questionsData.questions.length) * 100;

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 to-pink-100 p-6">
      <MessageModal message={message} onClose={() => setMessage("")} />
      {/* Progress Bar */}
      <div className="bg-white rounded-2xl shadow-xl p-6 mb-8">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-lg font-semibold text-gray-700">Interview Progress</h3>
          <span className="text-sm text-gray-500">{currentQuestionIndex} of {questionsData.questions.length} answered</span>
        </div>
        <div className="w-full bg-gray-200 rounded-full h-3">
          <div
            className="bg-gradient-to-r from-purple-600 to-pink-600 h-3 rounded-full transition-all duration-300"
            style={{ width: `${progress}%` }}
          ></div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Left side - 3D Avatar and Current Question */}
        <div className="space-y-6">
          {/* 3D Avatar */}
          <div className="bg-white rounded-2xl shadow-xl p-6">
            <div className="h-64 w-full">
              <Canvas camera={{ position: [0, 0, 5], fov: 50 }}>
                <ambientLight intensity={0.6} />
                <directionalLight position={[10, 10, 5]} intensity={1} />
                <pointLight position={[-10, -10, -5]} intensity={0.5} />
                <Suspense fallback={<Loading3D />}>
                  <InterviewerAvatar
                    // Avatar is listening when recording, not speaking, and not transcribing
                    isListening={interviewState === 'LISTENING_FOR_ANSWER'}
                    // Avatar is speaking when AI is speaking or transcribing
                    isSpeaking={speaking || isEvaluating}
                  />
                  <OrbitControls
                    enableZoom={false}
                    enablePan={false}
                    maxPolarAngle={Math.PI / 2}
                    minPolarAngle={Math.PI / 3}
                  />
                </Suspense>
              </Canvas>
            </div>
            <div className="text-center mt-3">
              <p className="text-sm font-semibold text-gray-700">
                Question {currentQuestionIndex + 1} of {questionsData.questions.length}
              </p>
              <div className="flex justify-center mt-2">
                {interviewState === 'LISTENING_FOR_ANSWER' && (
                  <div className="flex items-center text-red-600">
                    <div className="animate-pulse w-2 h-2 bg-red-600 rounded-full mr-2"></div>
                    <span className="text-xs">Listening...</span>
                  </div>
                )}
                {speaking && (
                  <div className="flex items-center text-blue-600">
                    <div className="animate-spin w-3 h-3 border border-blue-600 border-t-transparent rounded-full mr-2"></div>
                    <span className="text-xs">Speaking...</span>
                  </div>
                )}
                {isEvaluating && (
                  <div className="flex items-center text-purple-600">
                    <div className="animate-spin w-3 h-3 border border-purple-600 border-t-transparent rounded-full mr-2"></div>
                    <span className="text-xs">Evaluating...</span>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Current Question */}
          <div className="bg-white rounded-2xl shadow-xl p-6">
            <div className="text-center mb-6">
              <div className="bg-purple-100 text-purple-800 rounded-full w-16 h-16 flex items-center justify-center font-bold text-xl mx-auto mb-4">
                Q{currentQuestionIndex + 1}
              </div>
              <h2 className="text-2xl font-bold text-gray-800 mb-4">Current Question</h2>
            </div>

            <div className="bg-gray-50 p-6 rounded-xl border-l-4 border-purple-500">
              <p className="text-gray-700 text-lg leading-relaxed">
                {questionsData.questions[currentQuestionIndex]}
              </p>
            </div>
          </div>
        </div>

        {/* Right side - Video Preview and Recording Controls */}
        <div className="space-y-6">
          {/* Video Preview */}
          <div className="bg-white rounded-2xl shadow-xl p-6">
            <h3 className="text-xl font-bold text-gray-800 mb-4 text-center">Your Camera Feed</h3>
            <div className="relative">
              <video
                ref={videoRef}
                autoPlay
                muted
                className="w-full h-64 bg-gray-900 rounded-xl object-cover"
              />
              {interviewState === 'LISTENING_FOR_ANSWER' && (
                <div className="absolute top-4 left-4 bg-red-500 text-white px-3 py-1 rounded-full text-sm font-semibold flex items-center">
                  <div className="animate-pulse bg-white rounded-full w-2 h-2 mr-2"></div>
                  REC
                </div>
              )}
            </div>
          </div>

          {/* Recording Controls */}
          <div className="bg-white rounded-2xl shadow-xl p-6">
            <div className="text-center">
              {!isInterviewStarted && (
                <button
                  onClick={handleBeginInterview}
                  className="w-full bg-gradient-to-r from-blue-600 to-indigo-600 text-white py-4 px-8 rounded-xl font-semibold text-lg hover:from-blue-700 hover:to-indigo-700 transition-all duration-200 transform hover:scale-[1.02]"
                >
                  Begin Interview 🚀
                </button>
              )}
              {isInterviewStarted && interviewState === 'READY_FOR_NEXT' && (
                <button
                  onClick={handleAskNextQuestion}
                  className="w-full bg-gradient-to-r from-blue-500 to-blue-600 text-white py-4 px-8 rounded-xl font-semibold text-lg hover:from-blue-600 hover:to-blue-700 transition-all duration-200 transform hover:scale-[1.02]"
                >
                  <span className="flex items-center justify-center">
                    Listen to Next Question 🗣️
                  </span>
                </button>
              )}
              {isInterviewStarted && (interviewState === 'READY_FOR_RECORDING' || interviewState === 'ASKING_QUESTION') && !speaking && (
                <button
                  onClick={handleStartRecording}
                  className="w-full bg-gradient-to-r from-green-500 to-green-600 text-white py-4 px-8 rounded-xl font-semibold text-lg hover:from-green-600 hover:to-green-700 transition-all duration-200 transform hover:scale-[1.02]"
                >
                  <span className="flex items-center justify-center">
                    <svg className="w-6 h-6 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a4 4 0 11-8 0 4 4 0 018 0z" />
                    </svg>
                    Start Recording
                  </span>
                </button>
              )}

              {isInterviewStarted && interviewState === 'LISTENING_FOR_ANSWER' && (
                <button
                  onClick={handleStopRecording}
                  className="w-full bg-gradient-to-r from-red-500 to-red-600 text-white py-4 px-8 rounded-xl font-semibold text-lg hover:from-red-600 hover:to-red-700 transition-all duration-200 transform hover:scale-[1.02] disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <span className="flex items-center justify-center">
                    <svg className="w-6 h-6 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 10h6m-3 3v6m0-6V7" />
                    </svg>
                    Stop Recording
                  </span>
                </button>
              )}
              {isInterviewStarted && !listening && transcript.length > 0 && !isEvaluating && (
                <button
                  onClick={handleManualEvaluation}
                  className="w-full bg-gradient-to-r from-purple-500 to-purple-600 text-white py-4 px-8 rounded-xl font-semibold text-lg hover:from-purple-600 hover:to-purple-700 transition-all duration-200 transform hover:scale-[1.02] mt-4"
                >
                  <span className="flex items-center justify-center">
                    Evaluate Answer ✅
                  </span>
                </button>
              )}

              {isEvaluating && (
                <div className="flex items-center justify-center mt-4">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-600 mr-3"></div>
                  <span className="text-lg text-purple-600 font-semibold">Transcribing & Evaluating...</span>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
      
      {/* Previous Answers Preview */}
      {answers.length > 0 && (
        <div className="bg-white rounded-2xl shadow-xl p-6 mt-8">
          <h3 className="text-xl font-bold text-gray-800 mb-4">Previous Answers</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {answers.map((answer, index) => (
              <div key={index} className="bg-gray-50 p-4 rounded-lg border-l-4 border-blue-500">
                <div className="flex justify-between items-start mb-2">
                  <span className="font-semibold text-gray-800">Q{answer.questionIndex + 1}</span>
                  <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${
                    answer.evaluation?.score >= 8 ? 'bg-green-100 text-green-800' :
                    answer.evaluation?.score >= 6 ? 'bg-yellow-100 text-yellow-800' :
                    'bg-red-100 text-red-800'
                  }`}>
                    Score: {answer.evaluation?.score}/10
                  </span>
                </div>
                <p className="text-sm text-gray-600 truncate">{answer.transcript || "No transcription yet"}</p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

/**
 * Final View: Displays a detailed feedback report.
 */
const FeedbackReport = ({ answers, onRestart, totalTime }) => {
  const { speak, speaking, cancelSpeak } = useSpeech();

  const calculateAverageScore = (answersToCalculate) => {
    if (answersToCalculate.length === 0) return 0;
    const sum = answersToCalculate.reduce((total, answer) => total + (answer.evaluation?.score || 0), 0);
    return sum / answersToCalculate.length;
  };

  const averageScore = calculateAverageScore(answers);

  const formatTime = (ms) => {
    const totalSeconds = Math.floor(ms / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${minutes}m ${seconds}s`;
  };

  useEffect(() => {
    if (answers.length > 0) {
      speak(`All evaluations complete! Your average score was ${averageScore.toFixed(1)} out of 10. Review your report below.`);
    }
    return () => {
      cancelSpeak();
    };
  }, [answers, averageScore, speak, cancelSpeak]);


  return (
    <div className="min-h-screen bg-gradient-to-br from-emerald-50 to-teal-100 p-6">
      <div className="max-w-6xl mx-auto">
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-gray-800 mb-4">🎉 Interview Complete!</h1>
          <p className="text-gray-600 text-lg">Here's your detailed performance report</p>
        </div>

        {/* Overall Stats with 3D Avatar */}
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 mb-8">
          <div className="bg-white rounded-2xl shadow-xl p-6">
            <div className="h-48 w-full">
              <Canvas camera={{ position: [0, 0, 5], fov: 50 }}>
                <ambientLight intensity={0.6} />
                <directionalLight position={[10, 10, 5]} intensity={1} />
                <pointLight position={[-10, -10, -5]} intensity={0.5} />
                <Suspense fallback={<Loading3D />}>
                  <InterviewerAvatar isListening={false} isSpeaking={speaking} />
                  <OrbitControls
                    enableZoom={false}
                    enablePan={false}
                    maxPolarAngle={Math.PI / 2}
                    minPolarAngle={Math.PI / 3}
                  />
                </Suspense>
              </Canvas>
            </div>
            <div className="text-center mt-3">
              <p className="text-sm font-semibold text-green-700">Interview Complete! 🎉</p>
            </div>
          </div>
          <div className="bg-white rounded-2xl shadow-xl p-6 text-center">
            <div className="text-3xl font-bold text-blue-600 mb-2">{averageScore.toFixed(1)}/10</div>
            <div className="text-gray-600">Average Score</div>
          </div>
          <div className="bg-white rounded-2xl shadow-xl p-6 text-center">
            <div className="text-3xl font-bold text-green-600 mb-2">{answers.length}</div>
            <div className="text-gray-600">Questions Answered</div>
          </div>
          <div className="bg-white rounded-2xl shadow-xl p-6 text-center">
            <div className="text-3xl font-bold text-purple-600 mb-2">{formatTime(totalTime)}</div>
            <div className="text-gray-600">Total Time</div>
          </div>
        </div>

        {/* Detailed Feedback */}
        <div className="space-y-6 mb-8">
          {answers.map((answer, index) => (
            <motion.div
              key={index}
              className="bg-white rounded-2xl shadow-xl p-6"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.1 }}
            >
              <div className="flex justify-between items-start mb-4">
                <h3 className="text-xl font-bold text-gray-800">Question {index + 1}</h3>
                <div className="flex items-center space-x-2">
                  <span className={`px-3 py-1 rounded-full text-sm font-semibold ${
                    answer.evaluation?.score >= 8 ? 'bg-green-100 text-green-800' :
                    answer.evaluation?.score >= 6 ? 'bg-yellow-100 text-yellow-800' :
                    'bg-red-100 text-red-800'
                  }`}>
                    {answer.evaluation?.score}/10
                  </span>
                </div>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div className="space-y-4">
                  <div className="bg-gray-50 p-4 rounded-xl">
                    <p className="text-gray-700 font-medium mb-2">Question:</p>
                    <p className="text-gray-600">{answer.question}</p>
                  </div>

                  <div className="bg-blue-50 p-4 rounded-xl">
                    <p className="text-blue-700 font-medium mb-2">Your Answer:</p>
                    <p className="text-blue-600">{answer.transcript}</p>
                  </div>
                </div>

                <div className="space-y-4">
                  <div className="bg-green-50 p-4 rounded-xl">
                    <h4 className="font-semibold text-green-800 mb-2">✅ Strengths</h4>
                    <ul className="space-y-1">
                      {answer.evaluation?.strengths.map((strength, i) => (
                        <li key={i} className="text-green-700 text-sm">• {strength}</li>
                      ))}
                    </ul>
                  </div>

                  <div className="bg-red-50 p-4 rounded-xl">
                    <h4 className="font-semibold text-red-800 mb-2">⚠️ Areas for Improvement</h4>
                    <ul className="space-y-1">
                      {answer.evaluation?.weaknesses.map((weakness, i) => (
                        <li key={i} className="text-red-700 text-sm">• {weakness}</li>
                      ))}
                    </ul>
                  </div>

                  <div className="bg-purple-50 p-4 rounded-xl">
                    <h4 className="font-semibold text-purple-800 mb-2">💡 Suggestions</h4>
                    <ul className="space-y-1">
                      {answer.evaluation?.suggestions.map((suggestion, i) => (
                        <li key={i} className="text-purple-700 text-sm">• {suggestion}</li>
                      ))}
                    </ul>
                  </div>
                </div>
              </div>
            </motion.div>
          ))}
        </div>

        {/* Restart Button */}
        <div className="text-center">
          <button
            onClick={onRestart}
            className="bg-gradient-to-r from-blue-600 to-indigo-600 text-white py-4 px-8 rounded-xl font-semibold text-lg hover:from-blue-700 hover:to-indigo-700 transition-all duration-200 transform hover:scale-[1.02]"
          >
            Start New Interview 🔄
          </button>
        </div>
      </div>
    </div>
  );
};

/**
 * Main App Component to handle view switching.
 */
const App = () => {
  const [currentView, setCurrentView] = useState("input"); // input, questions, interview, feedback
  const [questionsData, setQuestionsData] = useState(null);
  const [interviewAnswers, setInterviewAnswers] = useState([]);
  const [totalTime, setTotalTime] = useState(0);

  const handleQuestionsGenerated = useCallback((data) => {
    setQuestionsData(data);
    setCurrentView("questions");
  }, []);

  const handleStartInterview = useCallback((data) => {
    setQuestionsData(data);
    setCurrentView("interview");
  }, []);

  const handleInterviewComplete = useCallback((answers, time) => {
    setInterviewAnswers(answers);
    setTotalTime(time);
    setCurrentView("feedback");
  }, []);

  const handleRestart = useCallback(() => {
    setCurrentView("input");
    setQuestionsData(null);
    setInterviewAnswers([]);
  }, []);

  return (
    <div className="App">
      {currentView === "input" && (
        <JobDescriptionInput onQuestionsGenerated={handleQuestionsGenerated} />
      )}

      {currentView === "questions" && (
        <QuestionGenerationView
          questionsData={questionsData}
          onStartInterview={handleStartInterview}
        />
      )}

      {currentView === "interview" && (
        <Recorder
          questionsData={questionsData}
          onInterviewComplete={handleInterviewComplete}
        />
      )}

      {currentView === "feedback" && (
        <FeedbackReport
          answers={interviewAnswers}
          onRestart={handleRestart}
          totalTime={totalTime}
        />
      )}
    </div>
  );
};

export default App;
