# 🎵 A Musical Interface for Reddit

A Reddit application built with the Devvit framework to let people play and share music!

![Musical Interface](https://img.shields.io/badge/MIDI%20Silly%20Fantasy-blue?style=for-the-badge&logo=reddit)
![Devvit](https://img.shields.io/badge/Built%20with-Devvit-orange?style=for-the-badge)
![TypeScript](https://img.shields.io/badge/TypeScript-007ACC?style=for-the-badge&logo=typescript&logoColor=white)

![Built with Bolt](https://img.shields.io/badge/Built%20with-Bolt.new-000000?style=for-the-badge&logo=bolt&logoColor=white)

## 🎮 Overview

This Reddit application brings the joy of collaborative music creation to Reddit communities. Users can play musical notes and chords using circular interfaces, record their compositions, and share them with the community.

### ✨ Key Features

- 🎹 **Dual Circular Instruments**: Left controller for chords, right for individual notes
- 🎵 **Real-time Audio Synthesis**: Pure Web Audio API implementation
- 📹 **Recording & Playback**: Capture and replay musical performances
- 💬 **Reddit Integration**: Share compositions directly to comments as encoded strings
- 📱 **Cross-platform Support**: Works on desktop, mobile, and Reddit mobile app
- ⚡ **Built with Bolt.new**: Rapidly developed using AI-powered development

## 📁 Project Structure

## 🎯 Usage Guide

### For Moderators

1. **Install the app** in your subreddit through Reddit's developer dashboard
2. **Create a musical post** using the "Create Musical Post" menu action

### For Users

1. **Open a musical interface post** in your subreddit
2. **Click "Start Playing!"** to initialize audio
3. **Use the circular instruments**:
   - **Left circle**: Play chords by clicking/touching different areas
   - **Right circle**: Play individual notes
6. **Record your performance** using the record button
7. **Share your creation** to comments or collaborate with others

### Controls

#### Mouse/Touch Controls
- **Click/tap instruments**: Play notes at different positions around the circle
- **Recording**: Red button to start/stop recording

#### Gamepad Support
- **Left stick**: Control left instrument (chords)
- **Right stick**: Control right instrument (notes)

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

### Audio Synthesis
- **Oscillator types**: Square, sawtooth, sine waves
- **Envelope**: ADSR (Attack, Decay, Sustain, Release)
- **Filtering**: Low-pass and high-pass filters for tone shaping
- **Effects**: Reverb and delay for spatial depth

## 🤝 Collaboration Features

### Sharing System
- **Encoded compositions**: Musical data compressed to base64 strings
- **Comment integration**: Share directly to Reddit comments
- **Playback**: Load and play shared compositions
- **Import/Export**: Transfer compositions between sessions

### Browser Compatibility
- **Chrome**: Full support (recommended)
- **Firefox**: Full support
- **Safari**: Limited Web Audio API features
- **Edge**: Full support
- **Mobile browsers**: Basic functionality

## 🙏 Acknowledgments

- **Reddit**: For the Devvit platform and development tools
- **Web Audio API**: For making browser-based audio synthesis possible
- **Community**: All the musicians and developers who contribute
- **Bolt.new**: For enabling rapid AI-powered development of this musical experience!

## 🔗 Links
- **Bolt.new**: https://bolt.new/
- **Reddit Devvit Docs**: https://developers.reddit.com/docs
- **Web Audio API**: https://developer.mozilla.org/en-US/docs/Web/API/Web_Audio_API