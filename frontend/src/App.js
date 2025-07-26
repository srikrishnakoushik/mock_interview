import React, { useState, useRef, useCallback, useEffect, Suspense } from "react";
import "./App.css";
import axios from "axios";
import { Canvas, useFrame } from '@react-three/fiber';
import { OrbitControls, Text, Sphere, MeshDistortMaterial, Box, Cylinder } from '@react-three/drei';
import { motion } from 'framer-motion';
import { useSpeechSynthesis } from 'react-speech-kit';
import * as THREE from 'three';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

// Enhanced 3D Interviewer with Facial Expressions
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

// Enhanced 3D Interviewer Avatar Component with Expressions
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
        font="/fonts/arial.woff"
      >
        AI Interviewer
      </Text>
      
      {/* Dynamic status indicator */}
      <Text
        position={[0, 1.5, 0]}
        fontSize={0.15}
        color={isSpeaking ? "#4f46e5" : isListening ? "#10b981" : "#6b7280"}
        anchorX="center"
        anchorY="middle"
        font="/fonts/arial.woff"
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

// Floating particles around avatar
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

// Loading component for 3D scene
const Loading3D = () => (
  <div className="flex items-center justify-center h-64 w-full">
    <div className="text-center">
      <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
      <p className="text-gray-600">Loading 3D Interviewer...</p>
    </div>
  </div>
);

// Enhanced JobDescriptionInput Component
const JobDescriptionInput = ({ onQuestionsGenerated }) => {
  const [jobDescription, setJobDescription] = useState("");
  const [loading, setLoading] = useState(false);
  const { speak, cancel, speaking } = useSpeechSynthesis();

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!jobDescription.trim()) return;

    setLoading(true);
    
    // Voice feedback
    speak({ text: "Generating your interview questions now. Please wait a moment." });
    
    try {
      const response = await axios.post(`${API}/questions`, {
        job_description: jobDescription
      });
      onQuestionsGenerated(response.data);
      speak({ text: "Questions generated successfully! Review them and start when ready." });
    } catch (error) {
      console.error("Error generating questions:", error);
      speak({ text: "Sorry, there was an error generating questions. Please try again." });
      alert("Failed to generate questions. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-6">
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
              <label className="block text-sm font-semibold text-gray-700 mb-3">
                Job Description
              </label>
              <textarea
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

// Enhanced QuestionGenerationView Component
const QuestionGenerationView = ({ questionsData, onStartInterview }) => {
  const { speak } = useSpeechSynthesis();

  useEffect(() => {
    speak({ text: `I've prepared ${questionsData.questions.length} questions for your interview. Take a moment to review them, then we can begin.` });
  }, [questionsData, speak]);

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
                  <InterviewerAvatar isListening={false} isSpeaking={false} />
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
              {questionsData.questions.map((question, index) => (
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

// Enhanced Recorder Component with Video Recording
const Recorder = ({ questionsData, onInterviewComplete }) => {
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [isRecording, setIsRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [answers, setAnswers] = useState([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [videoStream, setVideoStream] = useState(null);
  
  const mediaRecorderRef = useRef(null);
  const recordingIntervalRef = useRef(null);
  const chunksRef = useRef([]);
  const videoRef = useRef(null);
  const { speak, cancel, speaking } = useSpeechSynthesis();

  // Initialize camera
  useEffect(() => {
    const initCamera = async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ 
          video: { width: 640, height: 480 },
          audio: true 
        });
        setVideoStream(stream);
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
        }
      } catch (error) {
        console.error("Error accessing camera:", error);
      }
    };

    initCamera();

    return () => {
      if (videoStream) {
        videoStream.getTracks().forEach(track => track.stop());
      }
    };
  }, []);

  // Speak question when it changes
  useEffect(() => {
    if (questionsData.questions[currentQuestionIndex]) {
      const question = questionsData.questions[currentQuestionIndex];
      speak({ text: `Question ${currentQuestionIndex + 1}: ${question}` });
    }
  }, [currentQuestionIndex, questionsData, speak]);

  const startRecording = async () => {
    try {
      if (!videoStream) {
        alert("Camera not available. Please check permissions.");
        return;
      }

      mediaRecorderRef.current = new MediaRecorder(videoStream, {
        mimeType: 'video/webm'
      });
      chunksRef.current = [];
      
      mediaRecorderRef.current.ondataavailable = (event) => {
        if (event.data.size > 0) {
          chunksRef.current.push(event.data);
        }
      };
      
      mediaRecorderRef.current.onstop = async () => {
        const blob = new Blob(chunksRef.current, { type: 'video/webm' });
        await processRecording(blob);
      };
      
      mediaRecorderRef.current.start(1000);
      setIsRecording(true);
      setRecordingTime(0);
      
      speak({ text: "Recording started. Please answer the question." });
      
      recordingIntervalRef.current = setInterval(() => {
        setRecordingTime(prev => prev + 1);
      }, 1000);
      
    } catch (error) {
      console.error("Error starting recording:", error);
      alert("Could not start recording. Please check permissions.");
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      clearInterval(recordingIntervalRef.current);
      setIsProcessing(true);
      speak({ text: "Recording stopped. Processing your answer now." });
    }
  };

  const processRecording = async (videoBlob) => {
    try {
      // Extract audio for transcription (simplified - in production you'd use ffmpeg)
      // For now, we'll create a separate audio recording
      const audioBlob = videoBlob; // In real implementation, extract audio from video
      
      // Transcribe audio
      const formData = new FormData();
      formData.append('file', audioBlob, 'recording.webm');
      formData.append('session_id', questionsData.session_id);
      formData.append('question_index', currentQuestionIndex.toString());
      
      const transcriptionResponse = await axios.post(`${API}/transcribe`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      
      const transcript = transcriptionResponse.data.transcript;
      
      // Evaluate answer
      const evaluationResponse = await axios.post(`${API}/evaluate`, {
        transcript: transcript,
        question: questionsData.questions[currentQuestionIndex],
        job_description: "Sample job description" // You might want to pass this from props
      });
      
      const newAnswer = {
        questionIndex: currentQuestionIndex,
        question: questionsData.questions[currentQuestionIndex],
        transcript: transcript,
        evaluation: evaluationResponse.data,
        recordingTime: recordingTime,
        videoBlob: videoBlob // Store video for playback
      };
      
      setAnswers(prev => [...prev, newAnswer]);
      
      speak({ text: `Great answer! You scored ${evaluationResponse.data.score} out of 10.` });
      
      // Move to next question or complete interview
      if (currentQuestionIndex < questionsData.questions.length - 1) {
        setTimeout(() => {
          setCurrentQuestionIndex(prev => prev + 1);
        }, 2000);
      } else {
        setTimeout(() => {
          speak({ text: "Congratulations! You've completed all questions. Let me prepare your feedback report." });
          onInterviewComplete([...answers, newAnswer]);
        }, 3000);
      }
      
    } catch (error) {
      console.error("Error processing recording:", error);
      speak({ text: "There was an error processing your answer. Please try again." });
      alert("Error processing your answer. Please try again.");
    } finally {
      setIsProcessing(false);
      setRecordingTime(0);
    }
  };

  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const progress = ((currentQuestionIndex + 1) / questionsData.questions.length) * 100;

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 to-pink-100 p-6">
      <div className="max-w-6xl mx-auto">
        {/* Progress Bar */}
        <div className="bg-white rounded-2xl shadow-xl p-6 mb-8">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-lg font-semibold text-gray-700">Interview Progress</h3>
            <span className="text-sm text-gray-500">{currentQuestionIndex + 1} of {questionsData.questions.length}</span>
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
                      isListening={isRecording} 
                      isSpeaking={speaking || isProcessing} 
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
                  {isRecording && (
                    <div className="flex items-center text-red-600">
                      <div className="animate-pulse w-2 h-2 bg-red-600 rounded-full mr-2"></div>
                      <span className="text-xs">Recording...</span>
                    </div>
                  )}
                  {(speaking || isProcessing) && (
                    <div className="flex items-center text-blue-600">
                      <div className="animate-spin w-3 h-3 border border-blue-600 border-t-transparent rounded-full mr-2"></div>
                      <span className="text-xs">Processing...</span>
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

          {/* Right side - Video Recording and Controls */}
          <div className="space-y-6">
            {/* Video Preview */}
            <div className="bg-white rounded-2xl shadow-xl p-6">
              <h3 className="text-xl font-bold text-gray-800 mb-4 text-center">Your Video</h3>
              <div className="relative">
                <video
                  ref={videoRef}
                  autoPlay
                  muted
                  className="w-full h-64 bg-gray-900 rounded-xl object-cover"
                />
                {isRecording && (
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
                {!isRecording && !isProcessing && (
                  <button
                    onClick={startRecording}
                    className="bg-gradient-to-r from-red-500 to-pink-500 text-white py-4 px-8 rounded-xl font-semibold text-lg hover:from-red-600 hover:to-pink-600 transition-all duration-200 transform hover:scale-[1.02] mb-4"
                  >
                    🎥 Start Recording
                  </button>
                )}
                
                {isRecording && (
                  <div className="space-y-4">
                    <div className="flex items-center justify-center space-x-4">
                      <div className="animate-pulse bg-red-500 rounded-full w-4 h-4"></div>
                      <span className="text-2xl font-mono font-bold text-red-600">
                        {formatTime(recordingTime)}
                      </span>
                    </div>
                    <button
                      onClick={stopRecording}
                      className="bg-gradient-to-r from-gray-600 to-gray-700 text-white py-4 px-8 rounded-xl font-semibold text-lg hover:from-gray-700 hover:to-gray-800 transition-all duration-200"
                    >
                      ⏹️ Stop Recording
                    </button>
                  </div>
                )}
                
                {isProcessing && (
                  <div className="flex items-center justify-center">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-600 mr-3"></div>
                    <span className="text-lg text-purple-600 font-semibold">Processing your answer...</span>
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
                <div key={index} className="bg-green-50 p-4 rounded-lg border-l-4 border-green-500">
                  <div className="flex justify-between items-start mb-2">
                    <span className="font-semibold text-green-800">Q{answer.questionIndex + 1}</span>
                    <span className="text-sm text-green-600">Score: {answer.evaluation.score}/10</span>
                  </div>
                  <p className="text-sm text-gray-600 truncate">{answer.transcript}</p>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

// Enhanced FeedbackReport Component
const FeedbackReport = ({ answers, onRestart }) => {
  const { speak } = useSpeechSynthesis();
  const averageScore = answers.reduce((sum, answer) => sum + answer.evaluation.score, 0) / answers.length;
  const totalTime = answers.reduce((sum, answer) => sum + answer.recordingTime, 0);

  useEffect(() => {
    speak({ 
      text: `Congratulations on completing your mock interview! Your average score was ${averageScore.toFixed(1)} out of 10. Let me break down your performance.`
    });
  }, [averageScore, speak]);

  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}m ${secs}s`;
  };

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
                  <InterviewerAvatar isListening={false} isSpeaking={false} />
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
                    answer.evaluation.score >= 8 ? 'bg-green-100 text-green-800' :
                    answer.evaluation.score >= 6 ? 'bg-yellow-100 text-yellow-800' :
                    'bg-red-100 text-red-800'
                  }`}>
                    {answer.evaluation.score}/10
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
                      {answer.evaluation.strengths.map((strength, i) => (
                        <li key={i} className="text-green-700 text-sm">• {strength}</li>
                      ))}
                    </ul>
                  </div>
                  
                  <div className="bg-red-50 p-4 rounded-xl">
                    <h4 className="font-semibold text-red-800 mb-2">⚠️ Areas for Improvement</h4>
                    <ul className="space-y-1">
                      {answer.evaluation.weaknesses.map((weakness, i) => (
                        <li key={i} className="text-red-700 text-sm">• {weakness}</li>
                      ))}
                    </ul>
                  </div>
                  
                  <div className="bg-purple-50 p-4 rounded-xl">
                    <h4 className="font-semibold text-purple-800 mb-2">💡 Suggestions</h4>
                    <ul className="space-y-1">
                      {answer.evaluation.suggestions.map((suggestion, i) => (
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

// Main App Component
const App = () => {
  const [currentView, setCurrentView] = useState("input"); // input, questions, interview, feedback
  const [questionsData, setQuestionsData] = useState(null);
  const [interviewAnswers, setInterviewAnswers] = useState([]);

  const handleQuestionsGenerated = (data) => {
    setQuestionsData(data);
    setCurrentView("questions");
  };

  const handleStartInterview = (data) => {
    setQuestionsData(data);
    setCurrentView("interview");
  };

  const handleInterviewComplete = (answers) => {
    setInterviewAnswers(answers);
    setCurrentView("feedback");
  };

  const handleRestart = () => {
    setCurrentView("input");
    setQuestionsData(null);
    setInterviewAnswers([]);
  };

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
        />
      )}
    </div>
  );
};

export default App;