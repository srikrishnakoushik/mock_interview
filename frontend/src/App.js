import React, { useState, useRef, useCallback } from "react";
import "./App.css";
import axios from "axios";

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

// JobDescriptionInput Component
const JobDescriptionInput = ({ onQuestionsGenerated }) => {
  const [jobDescription, setJobDescription] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!jobDescription.trim()) return;

    setLoading(true);
    try {
      const response = await axios.post(`${API}/questions`, {
        job_description: jobDescription
      });
      onQuestionsGenerated(response.data);
    } catch (error) {
      console.error("Error generating questions:", error);
      alert("Failed to generate questions. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-6">
      <div className="bg-white rounded-2xl shadow-xl p-8 w-full max-w-2xl">
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
              className="w-full h-64 p-4 border-2 border-gray-200 rounded-xl focus:border-blue-500 focus:ring-2 focus:ring-blue-200 transition-all resize-none text-gray-700"
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
  );
};

// QuestionGenerationView Component
const QuestionGenerationView = ({ questionsData, onStartInterview }) => {
  return (
    <div className="min-h-screen bg-gradient-to-br from-green-50 to-emerald-100 p-6">
      <div className="max-w-4xl mx-auto">
        <div className="bg-white rounded-2xl shadow-xl p-8 mb-8">
          <div className="text-center mb-8">
            <h2 className="text-3xl font-bold text-gray-800 mb-4">✅ Questions Generated!</h2>
            <p className="text-gray-600">Review your interview questions and start when ready</p>
          </div>
          
          <div className="space-y-4 mb-8">
            {questionsData.questions.map((question, index) => (
              <div key={index} className="bg-gray-50 p-4 rounded-xl border-l-4 border-blue-500">
                <div className="flex items-start">
                  <span className="bg-blue-500 text-white rounded-full w-8 h-8 flex items-center justify-center font-semibold text-sm mr-4 mt-1 flex-shrink-0">
                    {index + 1}
                  </span>
                  <p className="text-gray-700 leading-relaxed">{question}</p>
                </div>
              </div>
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
  );
};

// Recorder Component
const Recorder = ({ questionsData, onInterviewComplete }) => {
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [isRecording, setIsRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [answers, setAnswers] = useState([]);
  const [isProcessing, setIsProcessing] = useState(false);
  
  const mediaRecorderRef = useRef(null);
  const recordingIntervalRef = useRef(null);
  const chunksRef = useRef([]);

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ 
        audio: true,
        video: false 
      });
      
      mediaRecorderRef.current = new MediaRecorder(stream, {
        mimeType: 'audio/webm'
      });
      chunksRef.current = [];
      
      mediaRecorderRef.current.ondataavailable = (event) => {
        if (event.data.size > 0) {
          chunksRef.current.push(event.data);
        }
      };
      
      mediaRecorderRef.current.onstop = async () => {
        const blob = new Blob(chunksRef.current, { type: 'audio/webm' });
        await processRecording(blob);
        
        // Stop all tracks
        stream.getTracks().forEach(track => track.stop());
      };
      
      mediaRecorderRef.current.start(1000);
      setIsRecording(true);
      setRecordingTime(0);
      
      recordingIntervalRef.current = setInterval(() => {
        setRecordingTime(prev => prev + 1);
      }, 1000);
      
    } catch (error) {
      console.error("Error starting recording:", error);
      alert("Could not access microphone. Please check permissions.");
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      clearInterval(recordingIntervalRef.current);
      setIsProcessing(true);
    }
  };

  const processRecording = async (audioBlob) => {
    try {
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
        recordingTime: recordingTime
      };
      
      setAnswers(prev => [...prev, newAnswer]);
      
      // Move to next question or complete interview
      if (currentQuestionIndex < questionsData.questions.length - 1) {
        setCurrentQuestionIndex(prev => prev + 1);
      } else {
        // Interview complete
        onInterviewComplete([...answers, newAnswer]);
      }
      
    } catch (error) {
      console.error("Error processing recording:", error);
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
      <div className="max-w-4xl mx-auto">
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

        {/* Current Question */}
        <div className="bg-white rounded-2xl shadow-xl p-8 mb-8">
          <div className="text-center mb-8">
            <div className="bg-purple-100 text-purple-800 rounded-full w-16 h-16 flex items-center justify-center font-bold text-xl mx-auto mb-4">
              Q{currentQuestionIndex + 1}
            </div>
            <h2 className="text-2xl font-bold text-gray-800 mb-4">Current Question</h2>
          </div>
          
          <div className="bg-gray-50 p-6 rounded-xl border-l-4 border-purple-500 mb-8">
            <p className="text-gray-700 text-lg leading-relaxed">
              {questionsData.questions[currentQuestionIndex]}
            </p>
          </div>

          {/* Recording Controls */}
          <div className="text-center">
            {!isRecording && !isProcessing && (
              <button
                onClick={startRecording}
                className="bg-gradient-to-r from-red-500 to-pink-500 text-white py-4 px-8 rounded-xl font-semibold text-lg hover:from-red-600 hover:to-pink-600 transition-all duration-200 transform hover:scale-[1.02]"
              >
                🎤 Start Recording
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

        {/* Previous Answers Preview */}
        {answers.length > 0 && (
          <div className="bg-white rounded-2xl shadow-xl p-6">
            <h3 className="text-xl font-bold text-gray-800 mb-4">Previous Answers</h3>
            <div className="space-y-3">
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

// FeedbackReport Component
const FeedbackReport = ({ answers, onRestart }) => {
  const averageScore = answers.reduce((sum, answer) => sum + answer.evaluation.score, 0) / answers.length;
  const totalTime = answers.reduce((sum, answer) => sum + answer.recordingTime, 0);

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

        {/* Overall Stats */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
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
            <div key={index} className="bg-white rounded-2xl shadow-xl p-6">
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
              
              <div className="bg-gray-50 p-4 rounded-xl mb-4">
                <p className="text-gray-700 font-medium mb-2">Question:</p>
                <p className="text-gray-600">{answer.question}</p>
              </div>
              
              <div className="bg-blue-50 p-4 rounded-xl mb-4">
                <p className="text-blue-700 font-medium mb-2">Your Answer:</p>
                <p className="text-blue-600">{answer.transcript}</p>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
              </div>
              
              <div className="bg-purple-50 p-4 rounded-xl mt-4">
                <h4 className="font-semibold text-purple-800 mb-2">💡 Suggestions</h4>
                <ul className="space-y-1">
                  {answer.evaluation.suggestions.map((suggestion, i) => (
                    <li key={i} className="text-purple-700 text-sm">• {suggestion}</li>
                  ))}
                </ul>
              </div>
            </div>
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