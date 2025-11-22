## Student TODO App

A clean, modern, and dynamic Flutter TODO application designed for busy students to manage daily activities such as assignments, study hours, and personal goals.

This repository demonstrates:
Local state management with setState()
Dynamic task rendering using ListView.builder
Real-time UI updates (immediate visual changes when tasks are added/removed)
Task categorization (Assignment / Study / Personal)
Smooth add / delete interactions with swipe-to-delete and delete icon

---

## Features

Add Tasks — Quickly add assignments, study sessions, or personal goals.
Category Selection — Choose from: Assignment, Study, Personal.
Remove Tasks — Swipe left (or tap delete) to remove tasks instantly.
Real-time UI — Uses setState() for immediate updates.
Modern UI — Material 3 look, rounded cards, soft shadows, and color-coded categories.
Lightweight — No external state-management packages; easy to understand and extend.

---

## Tech Stack

Flutter — App development
Dart — Programming language
Material 3 — UI styling
setState() — Local state management
ListView.builder — Efficient list rendering

---

## Project Structure
student-todo-app/
├── android/
├── ios/
├── lib/
│   └── main.dart         # Main app UI, state & logic
├── test/
├── pubspec.yaml
└── README.md


The lib/main.dart file contains the entire app logic in a single file for simplicity. You can split into smaller widgets/files as you extend the app.

---

## Installation

# Clone the repository:

git clone https://github.com/your-username/student-todo-app.git

---

# Enter the project directory:

cd student-todo-app

---

# Install dependencies:

flutter pub get

---

# Run the app :

flutter run

---
