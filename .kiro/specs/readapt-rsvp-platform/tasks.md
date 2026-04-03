# Implementation Plan: Readapt RSVP Platform

## Overview

Incremental build starting with the server foundation, then auth, then books/sessions, then the React client, and finally wiring the full end-to-end flow together.

## Tasks

- [x] 1. Initialize project structure and tooling
  - Create `/server` with `package.json`, TypeScript config, and Express entry point (`src/index.ts`)
  - Create `/client` with Vite + React + TypeScript template and Tailwind CSS configured
  - Add `.env.example` files for both projects documenting required variables (`MONGO_URI`, `JWT_SECRET`, `PORT`)
  - Install server dependencies: `express`, `mongoose`, `bcryptjs`, `jsonwebtoken`, `multer`, `pdf-parse`, `cors`, `dotenv`
  - Install server dev dependencies: `typescript`, `ts-node-dev`, `jest`, `ts-jest`, `fast-check`, `@types/*`
  - Install client dependencies: `axios`, `react-router-dom`
  - Install client dev dependencies: `vitest`, `@testing-library/react`, `fast-check`
  - _Requirements: 9.4_

- [x] 2. Implement server data models
  - [x] 2.1 Create `User` Mongoose model (`src/models/User.ts`) with fields: name, email (unique), passwordHash, createdAt
    - _Requirements: 1.4, 1.5_
  - [x] 2.2 Create `Book` Mongoose model (`src/models/Book.ts`) with fields: userId (ref User), title, totalWords, words (string[]), createdAt
    - _Requirements: 3.3, 3.6_
  - [x] 2.3 Create `ReadingSession` Mongoose model (`src/models/ReadingSession.ts`) with fields: userId, bookId, lastWordIndex, currentWPM, timeSpent, date
    - _Requirements: 7.1, 7.4_

- [x] 3. Implement authentication
  - [x] 3.1 Create `src/middleware/auth.ts` — JWT verification middleware that populates `req.user`
    - _Requirements: 2.4, 2.5, 9.1, 9.2_
  - [x] 3.2 Create `src/controllers/authController.ts` with `register` (hash password, create user, return JWT) and `login` (verify password, return JWT)
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 2.1, 2.2, 2.3_
  - [x] 3.3 Create `src/routes/auth.ts` and wire `POST /api/auth/register` and `POST /api/auth/login`
    - _Requirements: 1.1, 2.1_
  - [x] 3.4 Write unit tests for auth controller (register happy path, duplicate email → 409, missing field → 400, login happy path, wrong password → 401)

    - _Requirements: 1.1, 1.2, 1.3, 2.1, 2.2, 2.3_
  - [x]* 3.5 Write property test for password hashing
    - **Property 4: Password is never stored in plaintext**
    - **Validates: Requirements 1.4, 1.5**

- [x] 4. Implement PDF upload and book management
  - [x] 4.1 Create `src/utils/pdfExtractor.ts` — uses `pdf-parse` to extract text from a buffer and returns a cleaned string
    - _Requirements: 3.1, 3.5_
  - [x] 4.2 Create `src/utils/textCleaner.ts` — splits text into words, removes empty strings and punctuation-only tokens
    - _Requirements: 3.2_
  - [x]* 4.3 Write property test for word splitting
    - **Property 3: Word splitting round-trip**
    - **Validates: Requirements 3.2**
  - [x] 4.4 Create `src/controllers/bookController.ts` with `upload` (multer, extract, clean, save Book), `getAll` (user's books only), `getById` (ownership check)
    - _Requirements: 3.3, 3.4, 3.6, 4.1, 4.2, 4.3, 4.4_
  - [x] 4.5 Create `src/routes/books.ts` and wire `POST /api/books/upload`, `GET /api/books`, `GET /api/books/:id` (all protected)
    - _Requirements: 3.1, 4.1, 4.2_
  - [x]* 4.6 Write unit tests for book controller (upload stores book with correct userId, getAll returns only user's books, getById returns 403 for wrong user, getById returns 404 for missing book)
    - _Requirements: 3.6, 4.1, 4.3, 4.4_
  - [x]* 4.7 Write property test for book ownership isolation
    - **Property 6: Book ownership isolation**
    - **Validates: Requirements 4.1, 9.3**

- [x] 5. Implement reading session and analytics
  - [x] 5.1 Create `src/controllers/sessionController.ts` with `update` — upserts a ReadingSession by (userId, bookId)
    - _Requirements: 7.1, 7.2, 7.3, 7.4_
  - [x] 5.2 Create `src/routes/session.ts` and wire `POST /api/session/update` (protected)
    - _Requirements: 7.1_
  - [x]* 5.3 Write property test for session upsert idempotence
    - **Property 5: Session upsert idempotence**
    - **Validates: Requirements 7.2**
  - [x] 5.4 Create `src/controllers/analyticsController.ts` with `get` — aggregates totalWordsRead (sum of lastWordIndex), booksUploaded (count), lastSession (most recent by date)
    - _Requirements: 8.1, 8.2, 8.3, 8.4_
  - [x] 5.5 Create `src/routes/analytics.ts` and wire `GET /api/analytics` (protected)
    - _Requirements: 8.1_
  - [x]* 5.6 Write property test for analytics consistency
    - **Property 7: Analytics totals are consistent with session data**
    - **Validates: Requirements 8.1, 8.4**

- [x] 6. Checkpoint — server complete
  - Ensure all server tests pass, ask the user if questions arise.

- [x] 7. Implement ORP utility (client)
  - [x] 7.1 Create `client/src/utils/orp.ts` with `getORPIndex(wordLength: number): number` implementing the three-bracket logic
    - _Requirements: 6.1, 6.2, 6.3_
  - [x]* 7.2 Write property tests for ORP index bounds
    - **Property 1: ORP index is always within word bounds**
    - **Validates: Requirements 6.1, 6.2, 6.3**
  - [x]* 7.3 Write property tests for ORP bracket rules
    - **Property 2: ORP index satisfies length-bracket rules**
    - **Validates: Requirements 6.1, 6.2, 6.3**

- [x] 8. Implement client auth and routing
  - [x] 8.1 Create `client/src/context/AuthContext.tsx` — stores JWT token and user info, exposes login/logout helpers
    - _Requirements: 2.1, 2.4_
  - [x] 8.2 Create `client/src/api/index.ts` — axios instance with base URL and Authorization header interceptor
    - _Requirements: 9.1_
  - [x] 8.3 Create `client/src/components/ProtectedRoute.tsx` — redirects to `/login` if no token
    - _Requirements: 9.1, 9.2_
  - [x] 8.4 Create `client/src/pages/Login.tsx` and `Register.tsx` with forms that call the auth API and store the token
    - _Requirements: 1.1, 2.1_
  - [x] 8.5 Wire React Router in `App.tsx` with routes: `/login`, `/register`, `/dashboard` (protected), `/library` (protected), `/reader/:bookId` (protected)
    - _Requirements: 10.1, 10.3_

- [x] 9. Implement reusable UI components
  - [x] 9.1 Create `Button`, `Input`, `Card`, and `Navbar` components in `client/src/components/` with dark-theme Tailwind styles
    - _Requirements: 10.1, 10.4_

- [x] 10. Implement book library page
  - [x] 10.1 Create `client/src/pages/Library.tsx` — fetches user's books, renders a `BookCard` per book with title, word count, and a "Read" link
    - _Requirements: 4.1, 4.2_
  - [x] 10.2 Add PDF upload form to Library page — file input + submit button that calls `POST /api/books/upload`
    - _Requirements: 3.1, 3.4_

- [x] 11. Implement RSVP reader
  - [x] 11.1 Create `client/src/components/WordDisplay.tsx` — renders a word split into before/ORP/after spans with fixed-width container for ORP alignment
    - _Requirements: 6.4, 6.5_
  - [x] 11.2 Create `client/src/hooks/useRSVP.ts` — manages word index, playing/paused state, WPM interval, and exposes start/pause/resume/reset
    - _Requirements: 5.1, 5.2, 5.3, 5.4, 5.5, 5.6_
  - [x] 11.3 Create `client/src/components/ReaderControls.tsx` — Start/Pause/Resume/Reset buttons and a WPM slider (100–1000)
    - _Requirements: 5.1, 5.6_
  - [x] 11.4 Create `client/src/pages/Reader.tsx` — fetches book by ID, loads last session index, renders `WordDisplay` + `ReaderControls`, auto-saves progress every 5 seconds via `POST /api/session/update`
    - _Requirements: 5.1, 7.1, 7.3_

- [x] 12. Implement dashboard page
  - [x] 12.1 Create `client/src/pages/Dashboard.tsx` — fetches `GET /api/analytics` and renders stat cards for total words read, books uploaded, and last session info
    - _Requirements: 8.1, 8.2, 8.3_

- [x] 13. Final checkpoint — full end-to-end flow
  - Ensure all client and server tests pass. Verify the complete flow: register → upload PDF → read with RSVP → progress saved → resume on reload. Ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for a faster MVP
- Each task references specific requirements for traceability
- Property tests use `fast-check` with minimum 100 iterations each
- Unit tests use Jest (server) and Vitest (client)
