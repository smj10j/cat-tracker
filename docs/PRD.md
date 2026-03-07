# Cat Tracker — Product Requirements Document

## Overview

Cat Tracker is a lightweight web application for tracking health and physical measurements of cats over time. The initial version (MVP) focuses on simple data entry and time-series visualization of weight, with a design that allows future measurements to be added easily.

No authentication is required for the MVP — the app is single-tenant and trust-based.

## Goals

- Simple, mobile-friendly UI for quick data entry
- Track one or more cats with basic profile information
- Log measurements (weight first, extensible to others) with timestamps
- Visualize measurements over time with charts
- Free hosting via Cloudflare (Workers + Pages + D1)

## Non-Goals (MVP)

- User authentication / multi-user support
- Complex analytics or alerts
- External integrations (vet records, etc.)

---

## Features

### 1. Cat Management

**Add a Cat**
- Required: name, birthdate
- Optional: photo (upload), breed/type, coloring/coat, notes

**View Cats**
- List all cats with name, photo (if available), and age
- Click into a cat to see profile and measurement history

**Edit / Remove a Cat**
- Edit any cat profile field
- Delete a cat (and all associated measurements)

### 2. Measurement Tracking

**Add a Measurement**
- Select cat
- Select measurement type (initially: Weight)
- Enter value + unit (lbs or kg for weight)
- Date/time of measurement (defaults to now, editable)
- Optional notes

**View Measurement History**
- Table of all measurements for a cat, sorted by date
- Delete individual measurements

### 3. Charting / Visualization

**Weight Over Time Chart**
- Line chart of weight vs. date for a selected cat
- Date range selector (all time, last 30/90/365 days)
- Hover/tap to see exact value + date

### 4. Extensibility

The measurement system should be designed so that new measurement types (e.g., body length, food intake, vet visit notes) can be added without schema changes — using a flexible `measurement_type` field and a generic numeric `value` + `unit` approach.

---

## User Flows

### Add a new cat
1. Tap "+ Add Cat"
2. Fill in name (required), birthdate (required), optional fields
3. Save → redirected to cat profile

### Log a weight measurement
1. From cat profile or home screen, tap "+ Add Measurement"
2. Select cat (pre-selected if on cat profile)
3. Choose type = Weight, enter value + unit
4. Confirm date/time
5. Save → see updated chart

### View progress
1. Navigate to a cat's profile
2. See chart of weight over time
3. Adjust date range if needed

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React + TypeScript + Vite |
| Styling | Tailwind CSS |
| Charts | Recharts |
| Backend | Cloudflare Workers (Hono framework) |
| Database | Cloudflare D1 (SQLite) |
| File Storage | Cloudflare R2 (cat photos, optional) |
| Hosting | Cloudflare Pages (frontend) + Workers (API) |

---

## Success Criteria (MVP)

- Can add at least 2 cats with profile info
- Can log weight measurements for each cat
- Chart renders correctly with multiple data points
- Deployable to Cloudflare free tier
- Works on mobile (iOS Safari) and desktop Chrome
