# 🛡️ Guardian Alert

> *Because everyone deserves to hear the alarm.*

[![Live App](https://img.shields.io/badge/🌐_Live_Demo-APP-0066FF?style=for-the-badge)](https://guardiansalert.lovable.app)
[![Pitch Video](https://img.shields.io/badge/▶️_Watch_Pitch-YouTube-FF0000?style=for-the-badge)](https://www.youtube.com/playlist?list=PLRjIbTD2eeN5t_PZH_3GQrsMUdV6jLJw4)

---

## The Problem

When a fire alarm sounds in a building, most people hear it immediately and evacuate. But for **37 million deaf Americans**, that alarm is silent. For **29 million people with visual impairments**, evacuation signs and flashing lights go unnoticed.

The numbers tell the story:
- People with disabilities are **4x more likely to die** in natural disasters
- During the 2011 Japan earthquake, the fatality rate for people with disabilities was **double** that of the general population
- In the 2025 LA fires, at least **8 of the 20+ deaths** were disabled or elderly individuals who couldn't respond to warnings in time

Traditional emergency systems—fire alarms, evacuation notices, weather alerts—are designed for people without disabilities. They assume everyone can hear, see, and process complex information under stress. **This assumption kills people.**

---

## Our Solution

Guardian Alert is an AI-powered monitoring system that runs 24/7 on your phone, listening for emergency sounds and transforming them into personalized alerts that match your specific needs.

### How It Works

**1. Always Listening**  
Using advanced audio analysis, Guardian Alert continuously monitors your environment for fire alarms and emergency sounds. It identifies the unique frequency signature of fire alarms (3600-3800 Hz) and distinguishes them from voices, music, or background noise.

**2. Instant Personalized Alerts**  
The moment danger is detected, the app delivers an alert tailored to your disability:

- **Deaf/Hard of Hearing:** Your entire screen flashes red and yellow in an impossible-to-miss pattern, while your phone vibrates at maximum intensity.
- **Blind/Low Vision:** A loud siren plays, followed by clear voice guidance: *"Emergency. Fire detected. Evacuate immediately."*
- **Speech Disabilities:** Visual and audio alerts activate, plus AI automatically calls 911 on your behalf, communicating your location and situation.
- **Cognitive Disabilities:** Simplified language and calm, slower voice guidance reduce panic and confusion.

**3. Automatic Emergency Response**  
Your emergency contacts receive an SMS with your exact GPS location the instant an alert triggers. No manual action required. No fumbling with your phone in a crisis.

**4. Background Protection**  
Guardian Alert works even when your phone is in your pocket or you're browsing another app. Using Screen Wake Lock and Web Workers, the AI continues monitoring without draining your battery or requiring the app to stay open.

---

## The Technology

We built Guardian Alert with production-grade tools and accessibility-first design:

**Audio Intelligence**
- Real-time frequency analysis using Fast Fourier Transform (FFT)
- Pattern recognition trained on fire alarm acoustics
- Sub-second detection latency (<1 second from sound to alert)

**Personalization Engine**
- Disability-aware onboarding captures user needs
- Dynamic alert routing based on user profile
- Multi-sensory output (visual, audio, haptic) orchestrated in real-time

**Communication Layer**
- Twilio API for automated SMS and voice calls
- Geolocation services for precise emergency contact updates
- Offline-capable notification system

**Frontend & UX**
- React + Vite for fast, responsive performance
- Tailwind CSS with WCAG AAA accessibility standards
- Mobile-first design optimized for one-handed emergency use

---

## What Makes It Different

**Most accessibility apps are reactive.** They help you navigate a website or read a document *after* you've already encountered a barrier.

**Guardian Alert is proactive.** It doesn't wait for you to ask for help. It doesn't require you to remember to check an app. It monitors your environment constantly and acts the instant danger appears—before you even know there's a problem.

**It's not a screen reader. It's not a form filler. It's a guardian.**

---

## Try It Yourself

**[→ Launch Guardian Alert](https://guardiansalert.lovable.app)**

1. Complete the 60-second onboarding (select your accessibility needs)
2. Grant microphone and notification permissions
3. Play a fire alarm sound from YouTube on another device
4. Watch Guardian Alert detect it and trigger your personalized alert in under 1 second

**[→ Watch Our Pitch](https://www.youtube.com/playlist?list=PLRjIbTD2eeN5t_PZH_3GQrsMUdV6jLJw4)**

---

## What's Next

This is just the beginning. Our roadmap includes:

- **Multi-Hazard Detection:** Earthquakes (accelerometer), floods (weather API integration), carbon monoxide alarms
- **Government Alert Integration:** Direct feeds from FEMA, National Weather Service, and local emergency systems
- **Wearable Support:** Haptic alerts for Apple Watch, Fitbit, and specialized accessibility devices
- **Offline AI:** Edge-based machine learning models for detection without internet connectivity
- **Community Network:** Opt-in location sharing so nearby Guardian Alert users can help each other in emergencies

---

## Built For INTUition 2026

Guardian Alert was created during the INTUition 2026 hackathon with a single mission: **ensure that in a crisis, no one is left behind.**

We believe technology should serve everyone, not just those who fit the "default" user profile. Accessibility isn't a feature—it's a fundamental human right.

---

**[Live Demo](https://guardiansalert.lovable.app)** • **[Pitch Video](https://www.youtube.com/playlist?list=PLRjIbTD2eeN5t_PZH_3GQrsMUdV6jLJw4)** • **[GitHub](https://github.com/Yash-PoPularPlusPlus/guardiansalert)**

---

*Guardian Alert: Because when every second counts, everyone deserves a fighting chance.*
