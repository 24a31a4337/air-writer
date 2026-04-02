# ✍️ Air Writer — Draw in the Air

A real-time air writing application that lets you draw on screen using hand gestures tracked by your webcam. Powered by **MediaPipe Hands** for ML-based hand landmark detection.

![HTML5](https://img.shields.io/badge/HTML5-E34F26?style=flat&logo=html5&logoColor=white)
![CSS3](https://img.shields.io/badge/CSS3-1572B6?style=flat&logo=css3&logoColor=white)
![JavaScript](https://img.shields.io/badge/JavaScript-F7DF1E?style=flat&logo=javascript&logoColor=black)
![MediaPipe](https://img.shields.io/badge/MediaPipe-4285F4?style=flat&logo=google&logoColor=white)

---

## ✨ Features

- **Real-time Hand Tracking** — Uses MediaPipe Hands ML model to detect 21 hand landmarks via webcam
- **Gesture-based Controls** — Draw, erase, and clear the canvas using intuitive hand gestures
- **Customizable Brush** — Adjust color, thickness, smoothing, and neon glow effects
- **Stroke History & Undo** — Full undo support with `Ctrl+Z` (keyboard) or the toolbar button
- **Save as Image** — Export your air-drawn artwork as a PNG with a dark background
- **Responsive UI** — Works on desktop and adapts to mobile with a collapsible toolbar
- **Premium Dark Theme** — Glassmorphism design with neon accents and smooth micro-animations

---

## 🖐️ Gesture Controls

| Gesture | Action |
|---------|--------|
| ☝️ **Index finger up** | Draw on screen |
| ✊ **Fist / fingers down** | Stop drawing (pen up) |
| ✌️ **Two fingers up** (index + middle) | Eraser mode |
| 🖐️ **Open palm** (hold 1s) | Clear entire canvas |

---

## 🚀 Getting Started

### Prerequisites

- A modern browser with **WebRTC** support (Chrome, Edge, Firefox)
- A **webcam**
- **Camera permission** must be granted

### Run Locally

No build step required — this is a vanilla HTML/CSS/JS project.

```bash
# Clone the repository
git clone <repo-url>
cd air_writer

# Serve with any static file server, for example:
npx serve .
# or
python3 -m http.server 8080
```

Then open `http://localhost:8080` in your browser.

> **Note:** The app must be served over `http://localhost` or `https://` for webcam access to work. Opening the HTML file directly (`file://`) will not grant camera permissions.

---

## 🛠️ Tech Stack

| Technology | Purpose |
|------------|---------|
| **HTML5 Canvas** | Drawing surface and landmark overlay |
| **Vanilla CSS** | Premium dark UI with glassmorphism, gradients, and animations |
| **Vanilla JS** | Application logic, gesture detection, stroke management |
| **MediaPipe Hands** | Real-time hand landmark detection (21 keypoints) |
| **MediaPipe Camera Utils** | Webcam frame capture loop |
| **MediaPipe Drawing Utils** | Hand skeleton visualization |

All ML dependencies are loaded via CDN — no `npm install` needed.

---

## 📁 Project Structure

```
air_writer/
├── index.html    # App shell, onboarding UI, toolbar controls
├── style.css     # Full design system — dark theme, glassmorphism, responsive
├── app.js        # Core logic — MediaPipe init, gesture detection, drawing engine
└── README.md
```

---

## ⚙️ Toolbar Options

- **Color** — Pick from preset swatches (Cyan, Pink, Green, Yellow, Purple, White) or use the color picker
- **Thickness** — Brush size from 1–20px
- **Smoothing** — Adjustable exponential smoothing to reduce hand jitter
- **Glow Effect** — Toggle neon glow on brush strokes
- **Undo** — Remove last stroke (`Ctrl+Z`)
- **Clear** — Wipe the canvas (`Delete` or `Ctrl+X`)
- **Save** — Download canvas as PNG

---

## ⌨️ Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| `Ctrl + Z` | Undo last stroke |
| `Delete` / `Ctrl + X` | Clear canvas |

---

## 🧠 How It Works

1. **Webcam Feed** — The browser captures video from the user's camera
2. **MediaPipe Hands** — Each frame is sent to the ML model, which returns 21 hand landmarks in normalized coordinates
3. **Gesture Detection** — Finger tip vs. PIP joint positions determine which fingers are extended, mapping to draw/erase/clear/idle gestures
4. **Smoothing** — An exponential moving average filter smooths the index fingertip position to reduce jitter
5. **Canvas Rendering** — Strokes are drawn in real-time using quadratic Bézier curves for smooth lines, with optional neon glow via `shadowBlur`

---

## 📄 License

This project is open source. Feel free to use and modify it.
