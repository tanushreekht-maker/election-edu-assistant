# Chunav Mitra — Election Education Assistant

An AI-powered web app to educate Indian citizens about the election process, built for PromptWars Virtual Challenge 2 (Google for Developers x Hack2Skill).

## Live Demo
https://election-edu-app-336388849285.us-central1.run.app

## Features
- Chat: Ask any question about Indian elections powered by Gemini AI
- Timeline: Visual history of Indian general elections
- Quiz: AI-generated MCQs to test your knowledge
- Glossary: Key election terms explained simply

## Tech Stack
- Python + Flask backend
- Google Gemini API (gemini-1.5-flash)
- Google Antigravity IDE
- Docker + Google Cloud Run

## Prompt Strategy
Each feature uses intent-driven prompting. Chat uses a bounded system prompt keeping Gemini on-topic. Quiz generates structured MCQs with difficulty levels. Glossary uses concise definition prompts with Indian context.

## Run Locally
1. Clone the repo
2. Create .env file with GEMINI_API_KEY=your_key
3. pip install -r requirements.txt
4. python app.py
