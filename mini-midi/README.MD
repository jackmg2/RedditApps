# 🎵 FF7 Musical Interface for Reddit

A Reddit application built with the Devvit framework that recreates the magical musical interface from Final Fantasy VII Rebirth. Create, share, and collaborate on musical compositions directly within Reddit!

![FF7 Musical Interface](https://img.shields.io/badge/FF7-Musical%20Interface-blue?style=for-the-badge&logo=reddit)
![Devvit](https://img.shields.io/badge/Built%20with-Devvit-orange?style=for-the-badge)
![TypeScript](https://img.shields.io/badge/TypeScript-007ACC?style=for-the-badge&logo=typescript&logoColor=white)

## 🎮 Overview

Inspired by the innovative musical system in Final Fantasy VII Rebirth, this Reddit application brings the joy of collaborative music creation to Reddit communities. Users can play musical notes and chords using circular interfaces, record their compositions, and share them with the community.

### ✨ Key Features

- 🎹 **Dual Circular Instruments**: Left controller for chords, right for individual notes
- 🎵 **Real-time Audio Synthesis**: Pure Web Audio API implementation with FF7-style sounds
- 📹 **Recording & Playback**: Capture and replay musical performances
- 🤝 **Collaborative Sessions**: Multiple users can play music together in real-time
- 💬 **Reddit Integration**: Share compositions directly to comments as encoded strings
- 📱 **Cross-platform Support**: Works on desktop, mobile, and Reddit mobile app
- 🎨 **Beautiful UI**: FF7-inspired design with smooth animations
- 🌐 **No External Dependencies**: Fully self-contained, CORS-compliant implementation

## 🏗️ Technical Architecture

### Backend (Devvit)
- **Framework**: Devvit (Reddit's app platform)
- **Language**: TypeScript
- **Storage**: Redis for composition persistence
- **API**: Reddit API for posts and comments

### Frontend (Webview)
- **Audio**: Web Audio API with custom synthesizers
- **UI**: Pure CSS with modern design principles
- **Input**: Mouse, touch, and gamepad support
- **Architecture**: Modular ES6 classes

## 📁 Project Structure


## 🚀 Getting Started

### Prerequisites

- [Node.js](https://nodejs.org/) (v16 or higher)
- [Devvit CLI](https://developers.reddit.com/docs/quickstart)
- Reddit account with developer access

### Installation

1. **Install Devvit CLI**
   ```bash
   npm install -g devvit
   ```

2. **Clone the repository**
   ```bash
   git clone https://github.com/yourusername/ff7-musical-reddit.git
   cd ff7-musical-reddit
   ```

3. **Install dependencies**
   ```bash
   npm install
   ```

4. **Login to Devvit**
   ```bash
   devvit login
   ```

### Development

1. **Start development server**
   ```bash
   npm run dev
   ```

2. **Build the application**
   ```bash
   npm run build
   ```

3. **Upload to Reddit**
   ```bash
   npm run upload
   ```

## 🎯 Usage Guide

### For Moderators

1. **Install the app** in your subreddit through Reddit's developer dashboard
2. **Create a musical post** using the "Create Musical Post" menu action
3. **Configure settings** in the app settings (collaboration limits, recording length, etc.)

### For Users

1. **Open a musical interface post** in your subreddit
2. **Click "Start Playing!"** to initialize audio
3. **Use the circular instruments**:
   - **Left circle**: Play chords by clicking/touching different areas
   - **Right circle**: Play individual notes
4. **Modify sounds** with tone buttons (major, minor, semitones)
5. **Adjust octaves and chords** with the bottom controls
6. **Record your performance** using the record button
7. **Share your creation** to comments or collaborate with others

### Controls

#### Mouse/Touch Controls
- **Click/tap instruments**: Play notes at different positions around the circle
- **Tone buttons**: Switch between major, minor, and semitone modes
- **Octave controls**: Use +/- buttons or click reset
- **Recording**: Red button to start/stop recording

#### Gamepad Support
- **Left stick**: Control left instrument (chords)
- **Right stick**: Control right instrument (notes)
- **Shoulder buttons**: Tone modifications
- **Face buttons**: Octave and chord controls

## 🎵 Musical System

### Note Layout
The circular interface divides into 8 segments representing musical notes:
- **Top**: C (Do)
- **Top-right**: D (Re)
- **Right**: E (Mi)
- **Bottom-right**: F (Fa)
- **Bottom**: G (Sol)
- **Bottom-left**: A (La)
- **Left**: B (Si)
- **Top-left**: C' (Do')

### Chord System
The left instrument plays chords based on:
- **Root note**: Selected position on the circle
- **Chord type**: Major (default), Minor (with minor button)
- **Octave**: Current chord octave setting (1-9)

### Audio Synthesis
- **Oscillator types**: Square, sawtooth, sine waves
- **Envelope**: ADSR (Attack, Decay, Sustain, Release)
- **Filtering**: Low-pass and high-pass filters for tone shaping
- **Effects**: Reverb and delay for spatial depth

## 🤝 Collaboration Features

### Real-time Sessions
- **Join sessions**: Click "Collaborate" to start or join a session
- **Visual indicators**: See other users' cursor positions
- **Synchronized playback**: All users hear each other's music
- **Session management**: Automatic cleanup of inactive users

### Sharing System
- **Encoded compositions**: Musical data compressed to base64 strings
- **Comment integration**: Share directly to Reddit comments
- **Playback**: Load and play shared compositions
- **Import/Export**: Transfer compositions between sessions

## ⚙️ Configuration

### App Settings (Moderators)
```yaml
# devvit.yaml settings
enableCollaboration: true      # Allow real-time collaboration
maxRecordingLength: 300        # Maximum recording time (seconds)
allowGuestUsers: true          # Allow non-logged-in users
maxCollaborators: 4            # Max users per session
enableVolumeControl: true      # Show volume controls
defaultInstrument: "chaos"     # Default sound type
```

### Audio Settings
- **Master Volume**: 0.0 - 1.0 (default: 0.3)
- **Note Duration**: Configurable sustain time
- **Synthesis Type**: Square wave (FF7-style) or others
- **Sample Rate**: Browser default (usually 44.1kHz)

## 🛠️ Development

### Architecture Decisions

1. **No External Dependencies**: To comply with Reddit's strict CORS policy
2. **Modular Design**: Separate classes for audio, notes, recording
3. **Event-driven Communication**: Between webview and Devvit backend
4. **Responsive Design**: Mobile-first approach with touch optimization

### Key Components

#### SimpleAudio Class
```javascript
// Web Audio API wrapper
- playNote(frequency, duration, type)
- playChord(frequencies, duration)
- getFrequency(noteIndex, octave)
- createEffects() // reverb, delay, filtering
```

#### SimpleNotes Class
```javascript
// Musical logic
- handleInstrumentTouch(x, y, side)
- angleToNoteIndex(angle)
- getCurrentScale()
- getChordFrequencies(root, type)
```

#### SimpleRecorder Class
```javascript
// Recording system
- startRecording() / stopRecording()
- recordFrame(data)
- playRecording() / stopPlayback()
- exportRecording() / importRecording()
```

### Testing

1. **Local testing**: Use `npm run dev` for local development
2. **Reddit integration**: Test with `devvit upload` to staging
3. **Cross-platform**: Test on desktop, mobile, and Reddit app
4. **Audio compatibility**: Verify across different browsers

## 🎨 Design Philosophy

### Visual Design
- **FF7 Aesthetic**: Dark backgrounds with blue/cyan accents
- **Glassmorphism**: Translucent elements with backdrop blur
- **Smooth Animations**: CSS transitions for fluid interactions
- **Accessibility**: High contrast options and keyboard navigation

### User Experience
- **Intuitive Controls**: Circular layout mimics traditional instruments
- **Immediate Feedback**: Visual and audio response to all interactions
- **Progressive Enhancement**: Works without JavaScript (basic functionality)
- **Mobile Optimization**: Touch-friendly with haptic feedback

## 🐛 Troubleshooting

### Common Issues

#### Audio Not Working
- **Solution**: Click "Start Playing!" to initialize audio context
- **Cause**: Browser autoplay policies require user interaction

#### Recording Not Saving
- **Solution**: Check if recording has content before saving
- **Cause**: Empty recordings cannot be saved

#### Collaboration Issues
- **Solution**: Refresh page and rejoin session
- **Cause**: Network connectivity or session timeout

#### Mobile Performance
- **Solution**: Close other apps, ensure good network connection
- **Cause**: Limited mobile browser resources

### Browser Compatibility
- **Chrome**: Full support (recommended)
- **Firefox**: Full support
- **Safari**: Limited Web Audio API features
- **Edge**: Full support
- **Mobile browsers**: Basic functionality

## 🤝 Contributing

We welcome contributions! Please see our contributing guidelines:

1. **Fork the repository**
2. **Create a feature branch**: `git checkout -b feature/amazing-feature`
3. **Make your changes** with proper documentation
4. **Add tests** for new functionality
5. **Submit a pull request** with detailed description

### Development Setup
```bash
# Install dependencies
npm install

# Start development
npm run dev

# Run tests
npm test

# Build for production
npm run build
```

### Code Style
- **TypeScript**: Strict mode enabled
- **ESLint**: Follow project configuration
- **Prettier**: Auto-formatting on save
- **Comments**: Document complex musical algorithms

## 🙏 Acknowledgments

- **Square Enix**: For the inspiration from Final Fantasy VII Rebirth
- **Reddit**: For the Devvit platform and development tools
- **Web Audio API**: For making browser-based audio synthesis possible
- **Community**: All the musicians and developers who contribute

## 🔗 Links

- **Reddit Devvit Docs**: https://developers.reddit.com/docs
- **Web Audio API**: https://developer.mozilla.org/en-US/docs/Web/API/Web_Audio_API
- **Final Fantasy VII**: https://www.finalfantasyvii.com/

*Bringing the magic of Final Fantasy music to Reddit communities worldwide!* 🎵✨