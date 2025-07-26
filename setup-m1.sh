#!/bin/bash

# 🎯 Enhanced Mock Interview App - MacBook M1 Setup Script
# This script automates the setup process for MacBook M1

echo "🎯 Enhanced Mock Interview App - MacBook M1 Setup"
echo "================================================="

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to print colored output
print_status() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

print_step() {
    echo -e "\n${BLUE}[STEP]${NC} $1"
}

# Check if running on macOS
if [[ "$OSTYPE" != "darwin"* ]]; then
    print_error "This script is designed for macOS. Please follow manual installation instructions."
    exit 1
fi

# Check if running on Apple Silicon
ARCH=$(uname -m)
if [[ "$ARCH" != "arm64" ]]; then
    print_warning "You are not running on Apple Silicon (M1/M2). Some optimizations may not apply."
fi

print_step "1. Checking prerequisites..."

# Check for Homebrew
if ! command -v brew &> /dev/null; then
    print_status "Installing Homebrew..."
    /bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
    
    # Add Homebrew to PATH
    echo 'eval "$(/opt/homebrew/bin/brew shellenv)"' >> ~/.zprofile
    eval "$(/opt/homebrew/bin/brew shellenv)"
else
    print_status "Homebrew already installed ✓"
fi

print_step "2. Installing Node.js..."
if ! command -v node &> /dev/null; then
    brew install node@18
    print_status "Node.js installed successfully"
else
    NODE_VERSION=$(node --version)
    print_status "Node.js already installed: $NODE_VERSION ✓"
fi

print_step "3. Installing Python..."
if ! command -v python3 &> /dev/null; then
    brew install python@3.11
    print_status "Python installed successfully"
else
    PYTHON_VERSION=$(python3 --version)
    print_status "Python already installed: $PYTHON_VERSION ✓"
fi

print_step "4. Installing MongoDB..."
if ! command -v mongod &> /dev/null; then
    brew tap mongodb/brew
    brew install mongodb-community
    print_status "MongoDB installed successfully"
else
    print_status "MongoDB already installed ✓"
fi

print_step "5. Installing Yarn..."
if ! command -v yarn &> /dev/null; then
    npm install -g yarn
    print_status "Yarn installed successfully"
else
    YARN_VERSION=$(yarn --version)
    print_status "Yarn already installed: $YARN_VERSION ✓"
fi

print_step "6. Setting up project dependencies..."

# Install backend dependencies
if [ -d "backend" ]; then
    cd backend
    print_status "Installing Python dependencies..."
    pip3 install -r requirements.txt
    cd ..
else
    print_error "Backend directory not found. Make sure you're in the project root."
    exit 1
fi

# Install frontend dependencies  
if [ -d "frontend" ]; then
    cd frontend
    print_status "Installing Node.js dependencies..."
    yarn install
    cd ..
else
    print_error "Frontend directory not found. Make sure you're in the project root."
    exit 1
fi

print_step "7. Setting up environment files..."

# Create backend .env if it doesn't exist
if [ ! -f "backend/.env" ]; then
    cat > backend/.env << EOF
MONGO_URL="mongodb://localhost:27017"
DB_NAME="mock_interview_db"
GEMINI_API_KEY="your-gemini-api-key-here"
EOF
    print_status "Created backend/.env file"
    print_warning "Please update backend/.env with your Gemini API key!"
else
    print_status "Backend .env file already exists ✓"
fi

# Create frontend .env if it doesn't exist
if [ ! -f "frontend/.env" ]; then
    cat > frontend/.env << EOF
REACT_APP_BACKEND_URL="http://localhost:8001"
WDS_SOCKET_PORT=3000
EOF
    print_status "Created frontend/.env file"
else
    print_status "Frontend .env file already exists ✓"
fi

print_step "8. Additional setup for M1 optimization..."

# Install additional audio dependencies for M1
if [[ "$ARCH" == "arm64" ]]; then
    print_status "Installing audio dependencies for Apple Silicon..."
    brew install portaudio
    pip3 install pyaudio
fi

print_step "9. Starting MongoDB service..."
brew services start mongodb-community
print_status "MongoDB service started"

echo
echo "🎉 Setup completed successfully!"
echo "================================="
echo
echo "Next steps:"
echo "1. Get your Gemini API key from: https://aistudio.google.com/"
echo "2. Update backend/.env with your API key"
echo "3. Run the application with:"
echo
echo "   Terminal 1 (Backend):"
echo "   cd backend && python3 -m uvicorn server:app --host 0.0.0.0 --port 8001 --reload"
echo
echo "   Terminal 2 (Frontend):"
echo "   cd frontend && yarn start"
echo
echo "4. Open http://localhost:3000 in your browser"
echo
echo "For detailed instructions, see README.md"
echo
print_status "Happy interviewing! 🎯"