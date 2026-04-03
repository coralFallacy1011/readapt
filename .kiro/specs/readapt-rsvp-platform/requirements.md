# Requirements Document

## Introduction

Readapt is an AI-powered reading platform that converts uploaded PDF documents into a high-speed reading experience using Rapid Serial Visual Presentation (RSVP) with Optimal Recognition Point (ORP) highlighting. The platform enables users to register, upload documents, read them at adjustable speeds with one word displayed at a time, and track their reading progress over time.

## Glossary

- **System**: The Readapt web application (client + server combined)
- **Auth_Service**: The authentication subsystem handling registration, login, and JWT token management
- **PDF_Processor**: The backend component responsible for extracting and cleaning text from uploaded PDF files
- **RSVP_Engine**: The frontend component that displays words one at a time at a configurable speed
- **ORP_Calculator**: The logic module that determines which letter index to highlight in each word
- **Session_Manager**: The backend component that persists and retrieves reading progress
- **Dashboard**: The frontend view showing user analytics and reading history
- **User**: A registered account holder of the Readapt platform
- **Book**: A processed PDF document stored in the system with extracted word content
- **ReadingSession**: A record of a user's reading progress for a specific book
- **WPM**: Words Per Minute — the reading speed setting
- **ORP**: Optimal Recognition Point — the specific letter in a word that the eye naturally focuses on
- **JWT**: JSON Web Token used for stateless authentication

---

## Requirements

### Requirement 1: User Registration

**User Story:** As a new visitor, I want to create an account, so that I can access the platform and save my reading progress.

#### Acceptance Criteria

1. WHEN a user submits a registration form with a valid name, email, and password, THE Auth_Service SHALL create a new user account and return a JWT token
2. WHEN a user submits a registration form with an email that already exists, THE Auth_Service SHALL return a 409 error with a descriptive message
3. WHEN a user submits a registration form with a missing required field, THE Auth_Service SHALL return a 400 error identifying the missing field
4. THE Auth_Service SHALL hash all passwords using bcrypt before storing them in the database
5. THE Auth_Service SHALL never store or return plaintext passwords

---

### Requirement 2: User Login

**User Story:** As a registered user, I want to log in with my credentials, so that I can access my books and reading sessions.

#### Acceptance Criteria

1. WHEN a user submits valid login credentials, THE Auth_Service SHALL return a signed JWT token valid for at least 24 hours
2. WHEN a user submits an unrecognized email, THE Auth_Service SHALL return a 401 error
3. WHEN a user submits a correct email but incorrect password, THE Auth_Service SHALL return a 401 error
4. THE Auth_Service SHALL validate the JWT token on every protected API request
5. WHEN a request is made with an expired or invalid JWT token, THE Auth_Service SHALL return a 401 error

---

### Requirement 3: PDF Upload and Processing

**User Story:** As a logged-in user, I want to upload a PDF file, so that I can read its content using the RSVP engine.

#### Acceptance Criteria

1. WHEN a user uploads a valid PDF file, THE PDF_Processor SHALL extract all readable text from the document
2. WHEN text is extracted, THE PDF_Processor SHALL split the text into an ordered array of individual words, removing punctuation-only tokens and empty strings
3. WHEN a PDF is processed, THE System SHALL store the book metadata (title, userId, totalWords) and the full word array in the database
4. WHEN a user uploads a file that is not a PDF, THE System SHALL return a 400 error with a descriptive message
5. WHEN a PDF file cannot be parsed, THE PDF_Processor SHALL return a 422 error with a descriptive message
6. THE System SHALL associate every uploaded book with the authenticated user's ID

---

### Requirement 4: Book Library

**User Story:** As a logged-in user, I want to view all my uploaded books, so that I can select one to read.

#### Acceptance Criteria

1. WHEN a user requests their book list, THE System SHALL return only books belonging to that user
2. WHEN a user requests a specific book by ID, THE System SHALL return the book's metadata and word array if it belongs to that user
3. WHEN a user requests a book that does not belong to them, THE System SHALL return a 403 error
4. WHEN a user requests a book ID that does not exist, THE System SHALL return a 404 error

---

### Requirement 5: RSVP Reading Engine

**User Story:** As a reader, I want to see one word at a time displayed at my chosen speed, so that I can read faster than traditional reading.

#### Acceptance Criteria

1. WHEN the RSVP_Engine is started, THE RSVP_Engine SHALL display words sequentially, one at a time, at the configured WPM rate
2. WHEN the RSVP_Engine is paused, THE RSVP_Engine SHALL stop advancing to the next word and hold the current word on screen
3. WHEN the RSVP_Engine is resumed after a pause, THE RSVP_Engine SHALL continue from the word where it was paused
4. WHEN the RSVP_Engine is reset, THE RSVP_Engine SHALL return to the first word of the document
5. WHEN the last word of the document is displayed, THE RSVP_Engine SHALL stop automatically and indicate completion
6. THE RSVP_Engine SHALL support WPM values between 100 and 1000

---

### Requirement 6: ORP Highlighting

**User Story:** As a reader, I want a specific letter in each word to be highlighted, so that my eye has a consistent focal point that speeds up recognition.

#### Acceptance Criteria

1. WHEN a word of length 1 to 3 is displayed, THE ORP_Calculator SHALL highlight the middle letter (index = floor(length / 2))
2. WHEN a word of length 4 to 7 is displayed, THE ORP_Calculator SHALL highlight the letter at index floor(length / 4)
3. WHEN a word of length 8 or more is displayed, THE ORP_Calculator SHALL highlight the letter at index floor(length / 3) - 1
4. THE RSVP_Engine SHALL visually align the ORP letter at a fixed horizontal position on screen for every word, using padding or spacing so the highlighted letter does not shift between words
5. THE RSVP_Engine SHALL render the ORP letter in a visually distinct color (red or orange) that contrasts with the surrounding letters

---

### Requirement 7: Reading Progress Tracking

**User Story:** As a reader, I want my reading position to be saved automatically, so that I can resume where I left off in a later session.

#### Acceptance Criteria

1. WHEN a user's reading position changes, THE Session_Manager SHALL accept a progress update containing userId, bookId, lastWordIndex, currentWPM, and timeSpent
2. WHEN a progress update is received for an existing session, THE Session_Manager SHALL update the existing record rather than create a duplicate
3. WHEN a user opens a book they have previously read, THE System SHALL return the last saved word index so the RSVP_Engine can resume from that position
4. THE Session_Manager SHALL record the date of the most recent update for each session

---

### Requirement 8: User Dashboard and Analytics

**User Story:** As a user, I want to see a summary of my reading activity, so that I can track my progress and habits.

#### Acceptance Criteria

1. WHEN a user requests their analytics, THE Dashboard SHALL return the total number of words read across all sessions
2. WHEN a user requests their analytics, THE Dashboard SHALL return the total number of books uploaded by that user
3. WHEN a user requests their analytics, THE Dashboard SHALL return the date and WPM of the most recent reading session
4. THE System SHALL compute analytics only from data belonging to the authenticated user

---

### Requirement 9: Security and Authorization

**User Story:** As a platform operator, I want all user data to be protected, so that users cannot access each other's books or sessions.

#### Acceptance Criteria

1. THE System SHALL require a valid JWT token for all endpoints except registration and login
2. WHEN an unauthenticated request is made to a protected endpoint, THE Auth_Service SHALL return a 401 error
3. THE System SHALL ensure that a user can only read, update, or delete their own books and sessions
4. THE Auth_Service SHALL use an environment variable for the JWT signing secret and SHALL NOT hardcode it

---

### Requirement 10: Frontend UI and User Experience

**User Story:** As a user, I want a clean, dark-themed interface, so that reading is comfortable and the RSVP display is easy to focus on.

#### Acceptance Criteria

1. THE System SHALL present a dark-themed UI with high-contrast text suitable for extended reading sessions
2. THE RSVP_Engine SHALL center the word display area horizontally and vertically on the screen
3. WHEN the application loads, THE System SHALL display a responsive layout that works on both desktop and mobile screen sizes
4. THE System SHALL use reusable React components for shared UI elements such as buttons, cards, and input fields
