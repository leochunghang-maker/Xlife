# Xlife

Xlife is an AI-ready lifestyle management app built for mobile-first daily tracking. It combines health, meals, snaps, fitness, entertainment, spending, memories, and couple connection into one personal lifestyle hub.

## Overview

Xlife is designed as a full-stack wellness and relationship companion. The current version is a React + Vite + Tailwind prototype wrapped with Capacitor for iOS deployment. It supports local device storage now and is structured for future Supabase cloud sync, Apple Health integration, and real OpenAI-powered intelligence.

## Core Features

### Camera-First Snaps
- Snapchat-style camera-first launch experience
- Capture or upload photos
- Route each snap into one of three flows:
  - Save Memory
  - Mark Food
  - Track Spending
- Food snaps connect to meal tracking
- Spending snaps connect to personal expense logs

### Meals & Restaurant Catalog
- Daily meal logging by breakfast, lunch, dinner, and snack
- AI-ready food photo calorie estimation flow
- Restaurant catalog with cuisine categories
- Nearby restaurant suggestion architecture
- Personal restaurant notes, ratings, takeaway number, and menu/photo storage

### Health & Cycle Tracking
- Apple Health-style cycle tracking interface
- Period marking by selected date
- Symptoms, spotting, factors, and notes
- Wellness insights structure for phase-based mood and symptom analysis
- Future-ready Apple HealthKit sleep sync architecture

### GYM Tracker
- Workout split selection:
  - Chest
  - Back
  - Shoulder/Arm
  - Chest/Back
  - Leg
  - Rest
- Exercise checklist with weight and reps
- Workout completion summary
- Encouraging completion feedback
- Local workout history persistence

### Fun / Us / Entertainment
- Shared couple space concept: Us
- Partner invite and pairing mock flow
- Partner updates feed architecture
- Collaborative plan builder
- Memories section for shared moments
- Entertainment discovery section with category tabs for movies, shows, and music

### Daily Dashboard
- Today summary
- Calories and nutrition overview
- Wake/sleep tracking architecture
- Mood and notes
- Snaps preview
- Interactive Day Calendar for selected-date log review

## Tech Stack

- Frontend: React, Vite
- Styling: Tailwind CSS
- Mobile Wrapper: Capacitor iOS
- Animations: Framer Motion
- Icons: Lucide React
- Storage: localStorage now; Supabase-ready architecture
- Future AI: OpenAI Vision / GPT through backend or Supabase Edge Functions
- Future Health Integration: Apple HealthKit

## Why This Project Matters

Xlife demonstrates product thinking, mobile-first UI design, React state management, native iOS deployment through Capacitor, and AI-ready feature architecture. It is built as a realistic consumer lifestyle app rather than a simple demo.

## Planned Improvements

- Supabase Auth and cloud database
- Real partner account pairing and shared data sync
- OpenAI Vision food estimation through secure backend
- Apple HealthKit sleep and wellness data sync
- Real restaurant search using Google Places or Yelp API
- Push notifications
- TestFlight distribution
- App Store release

## Local Development

bash npm install npm run dev 

## Build for iOS with Capacitor

bash npm run build npx cap sync ios npx cap open ios 

Then open the project in Xcode and run it on an iPhone.

## Portfolio Summary

Xlife is an AI-ready mobile lifestyle OS for daily wellness, food, fitness, memories, spending, entertainment, and couple connection. The app combines personal tracking and social relationship features into a single mobile-first React + Capacitor product.
