# 📖 Adaptive AI Reading Platform

An AI-powered reading performance platform that transforms documents into a high-speed, focus-optimized reading experience using RSVP (Rapid Serial Visual Presentation) and Optimal Recognition Point (ORP) alignment.

---

## 🚀 Vision

This project aims to solve the problem of slow reading, lack of focus, and low reading consistency by:

- Converting books into a word-by-word high-speed reading stream
- Eliminating unnecessary eye movement
- Tracking user progress
- Personalizing reading behavior
- Gamifying consistency

The long-term goal is to build a full-scale AI-powered reading operating system.

---

## 🧠 Core Features

### 📚 Document Upload
- PDF and EPUB support
- Text extraction and structuring
- Resume where you left off

### ⚡ RSVP Reading Engine
- One word at a time
- ORP (Optimal Recognition Point) highlighting
- Adjustable Words Per Minute (WPM)
- Punctuation-aware timing

### 👤 User System
- Secure authentication (JWT)
- Personalized reading profile
- Reading history tracking

### 📊 Analytics Dashboard
- Total words read
- Books completed
- Daily reading streak
- Speed progression

### 🎯 Future AI Features
- Adaptive speed controller
- Personalized ORP optimization
- Behavior-based recommendations
- Reading DNA profiling

---

## 🏗 Tech Stack

### Frontend
- React
- TypeScript
- Tailwind CSS

### Backend
- Node.js
- Express
- JWT Authentication
- Multer (file upload)

### Database
- MongoDB
- Mongoose

---

## 📁 Project Structure

/client → Frontend (React + TS)
/server → Backend (Node + Express)

---

## 🔌 API Overview

### Auth
- POST /api/auth/register
- POST /api/auth/login

### Books
- POST /api/books/upload
- GET /api/books
- GET /api/books/:id

### Reading Session
- POST /api/session/update

### Analytics
- GET /api/analytics

---

## 🎯 Development Roadmap

### Phase 1
- Build RSVP reader UI
- Implement ORP logic
- Add WPM controls

### Phase 2
- Add authentication
- Implement document upload
- Extract and store book content

### Phase 3
- Store reading sessions
- Build analytics dashboard
- Implement streak logic

### Phase 4
- Add adaptive AI speed model
- Add recommendation system
- Deploy to production

---

## 🌍 Future Vision

This platform aims to become a personalized reading operating system that adapts to each user’s cognitive pattern and builds sustainable reading habits.

---

## 👨‍💻 Author

Built as a full-stack AI product integrating frontend engineering, backend APIs, database architecture, and applied machine learning.
