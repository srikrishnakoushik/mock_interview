# 🎯 Enhanced Mock Interview App

A professional AI-powered mock interview application with 3D avatar, voice assistance, and video recording capabilities.

## ✨ Features

### 🤖 Core AI Features
- **Gemini AI Question Generation** - Personalized interview questions based on job descriptions
- **Real-time Speech Recognition** - Converts audio to text for evaluation
- **AI Answer Evaluation** - Detailed feedback with scores, strengths, weaknesses, and suggestions
- **Voice Assistant** - Speaks questions aloud and provides audio feedback

### 🎬 Interactive Experience
- **3D AI Interviewer Avatar** - Animated character with facial expressions and emotions
- **Video Recording** - Full video capture with camera preview
- **Audio Recording** - High-quality audio capture and processing  
- **Progress Tracking** - Visual progress bar and question navigation
- **Session Management** - MongoDB-based interview session storage

### 🎨 Professional UI/UX
- **Responsive Design** - Works on desktop, tablet, and mobile
- **Motion Animations** - Smooth transitions and engaging interactions
- **Professional Styling** - Clean, modern interface using Tailwind CSS
- **Real-time Status** - Dynamic indicators for recording, processing, and speaking states

## 🛠 Technical Stack

### Frontend
- **React 18** - Modern React with hooks and suspense
- **Three.js + React Three Fiber** - 3D graphics and animations
- **Drei** - Three.js helpers and components
- **Framer Motion** - Advanced animations and transitions
- **Tailwind CSS** - Utility-first styling
- **Speech Synthesis** - Browser-based voice output
- **MediaRecorder API** - Video/audio recording

### Backend
- **FastAPI** - High-performance Python API framework
- **Gemini AI** - Google's advanced language model
- **emergentintegrations** - Custom LLM integration library
- **Speech Recognition** - Google Speech-to-Text
- **Google TTS** - Text-to-speech synthesis
- **MongoDB** - Document database for session storage
- **Python Multipart** - File upload handling

## 📋 Prerequisites for MacBook M1

### Required Software
1. **Node.js 18+** (ARM64 version for M1)
2. **Python 3.11+** (ARM64 version for M1)
3. **MongoDB Community Edition** (ARM64 version for M1)
4. **Git**

### Installation Commands

```bash
# Install Homebrew (if not installed)
/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"

# Install Node.js (ARM64 optimized)
brew install node@18

# Install Python (ARM64 optimized)
brew install python@3.11

# Install MongoDB (ARM64 optimized)
brew tap mongodb/brew
brew install mongodb-community

# Install Git (if not installed)
brew install git

# Install Yarn (recommended over npm)
npm install -g yarn

# Verify installations
node --version    # Should show v18.x.x
python3 --version # Should show Python 3.11.x
mongod --version  # Should show MongoDB version
```

## 🚀 Setup Instructions for MacBook M1

### 1. Clone and Setup Project

```bash
# Clone the repository
git clone <your-repo-url>
cd mock-interview-app

# Install backend dependencies
cd backend
pip3 install -r requirements.txt

# Install frontend dependencies
cd ../frontend
yarn install
```

### 2. Configure Environment Variables

**Backend Environment** (`backend/.env`):
```env
MONGO_URL="mongodb://localhost:27017"
DB_NAME="mock_interview_db"
GEMINI_API_KEY="your-gemini-api-key-here"
```

**Frontend Environment** (`frontend/.env`):
```env
REACT_APP_BACKEND_URL="http://localhost:8001"
WDS_SOCKET_PORT=3000
```

### 3. Get Gemini API Key

1. Go to [Google AI Studio](https://aistudio.google.com/)
2. Sign in with your Google account
3. Click "Get API key"
4. Create a new API key
5. Copy the API key to your `backend/.env` file

### 4. Start Services

**Terminal 1 - MongoDB:**
```bash
# Start MongoDB
brew services start mongodb-community
# or manually:
mongod --config /opt/homebrew/etc/mongod.conf
```

**Terminal 2 - Backend:**
```bash
cd backend
python3 -m uvicorn server:app --host 0.0.0.0 --port 8001 --reload
```

**Terminal 3 - Frontend:**
```bash
cd frontend
yarn start
```

### 5. Access the Application

- **Frontend:** http://localhost:3000
- **Backend API:** http://localhost:8001
- **API Documentation:** http://localhost:8001/docs

## 🎮 How to Use

### 1. Job Description Input
- Paste your target job description in the textarea
- The 3D AI interviewer will introduce itself
- Click "Generate Interview Questions"
- Voice assistant will confirm question generation

### 2. Review Questions
- Review the 8-10 personalized questions
- 3D avatar shows "Ready" state
- Click "Start Interview" when ready

### 3. Video Interview
- Grant camera and microphone permissions
- 3D avatar changes to "Listening" state during recording
- See your video feed in real-time
- Click "Start Recording" for each question
- Avatar provides voice feedback after each answer

### 4. Feedback Report
- View comprehensive performance analytics
- See scores, strengths, weaknesses, and suggestions
- 3D avatar celebrates completion
- Option to start a new interview

## 🔧 Development

### Running in Development Mode

```bash
# Backend with hot reload
cd backend
python3 -m uvicorn server:app --host 0.0.0.0 --port 8001 --reload

# Frontend with hot reload
cd frontend
yarn start
```

### Building for Production

```bash
# Build frontend
cd frontend
yarn build

# The build folder will contain optimized production files
```

### API Endpoints

- `POST /api/questions` - Generate interview questions
- `POST /api/transcribe` - Transcribe audio files
- `POST /api/evaluate` - Evaluate interview answers
- `POST /api/voice-synthesis` - Generate voice audio
- `GET /api/sessions/{id}` - Get session details
- `POST /api/sessions/{id}/complete` - Mark session complete

## 🐛 Troubleshooting

### Common Issues on MacBook M1

**1. Node.js Architecture Issues:**
```bash
# Ensure you're using ARM64 version
node -p "process.arch"  # Should show 'arm64'
```

**2. Python Dependencies:**
```bash
# If speech recognition fails, install additional dependencies
brew install portaudio
pip3 install pyaudio
```

**3. MongoDB Connection:**
```bash
# Check MongoDB status
brew services list | grep mongodb
# Restart if needed
brew services restart mongodb-community
```

**4. Camera/Microphone Permissions:**
- Grant permissions in System Preferences > Security & Privacy
- Restart browser after granting permissions

**5. 3D Avatar Loading Issues:**
```bash
# Clear npm/yarn cache
yarn cache clean
# Reinstall dependencies
rm -rf node_modules
yarn install
```

## 📱 Browser Compatibility

### Recommended Browsers
- **Chrome 90+** (Best performance)
- **Safari 15+** (M1 optimized)
- **Firefox 88+**
- **Edge 90+**

### Required Browser Features
- WebGL 2.0 (for 3D graphics)
- MediaRecorder API (for video recording)
- Speech Recognition API (for transcription)
- Camera/Microphone access

## 🔒 Security & Privacy

- All video/audio processing happens locally
- No data sent to third parties except:
  - Gemini AI for question generation and evaluation
  - Google Speech-to-Text for transcription
- Interview sessions stored locally in MongoDB
- API keys stored securely in environment files

## 📊 Performance Optimization

### For MacBook M1
- Uses native ARM64 builds for all dependencies
- Optimized 3D rendering with efficient shaders
- Chunked file uploads for large video files
- Efficient memory management for long interviews

### Recommended Specs
- Minimum: 8GB RAM, M1 chip
- Optimal: 16GB RAM, M1 Pro/Max chip
- Storage: 2GB free space for video recordings

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test on MacBook M1
5. Submit a pull request

## 📄 License

This project is licensed under the MIT License.

## 🆘 Support

For issues and support:
1. Check this README for common solutions
2. Search existing GitHub issues
3. Create a new issue with:
   - MacBook M1 specifications
   - Error messages
   - Steps to reproduce
   - Browser console logs

---

**Made with ❤️ for MacBook M1 and Apple Silicon**
