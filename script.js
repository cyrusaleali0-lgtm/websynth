// script.js

// Web Audio API context
let audioContext;
let activeOscillators = {}; // Store active oscillators by note
let activeGains = {}; // Store active gain nodes by note
let gainNode = null;

// Effect nodes
let reverbEffect = null;
let echoEffect = null;
let reverbGain = null;
let echoGain = null;
let echoDelay = null;
let echoFeedback = null;

// Current settings
let currentWaveform = 'sine';
let currentVolume = 0.5;
let currentOctave = 4;

// Effect settings
let reverbEnabled = false;
let reverbLevel = 0.5;
let reverbTime = 1.5;
let echoEnabled = false;
let echoLevel = 0.3;
let echoTime = 0.25;
let echoFeedbackLevel = 0.4;

// Envelope settings
const ATTACK_TIME = 0.01; // 10ms attack
const RELEASE_TIME = 0.1; // 100ms release

// Base note frequencies (for octave 4)
const baseFrequencies = {
    'C': 261.63,
    'C#': 277.18,
    'D': 293.66,
    'D#': 311.13,
    'E': 329.63,
    'F': 349.23,
    'F#': 369.99,
    'G': 392.00,
    'G#': 415.30,
    'A': 440.00,
    'A#': 466.16,
    'B': 493.88,
    'C5': 523.25,
    'C#5': 554.37,
    'D5': 587.33,
    'D#5': 622.25,
    'E5': 659.25
};

// Key mappings for computer keyboard (single octave)
const keyMap = {
    'A': 'C',
    'W': 'C#',
    'S': 'D',
    'E': 'D#',
    'D': 'E',
    'F': 'F',
    'T': 'F#',
    'G': 'G',
    'Y': 'G#',
    'H': 'A',
    'U': 'A#',
    'J': 'B',
    'K': 'C5',
    'O': 'C#5',
    'L': 'D5',
    'P': 'D#5',
    ';': 'E5'
};

// Initialize audio context on first user interaction
function initAudio() {
    // Check if we already have an audio context
    if (!audioContext) {
        try {
            audioContext = new (window.AudioContext || window.webkitAudioContext)();
            gainNode = audioContext.createGain();
            
            // Create effect nodes
            createReverbEffect();
            createEchoEffect();
            
            // Connect nodes: gain -> effects -> destination
            gainNode.connect(audioContext.destination);
        } catch (e) {
            console.error('Web Audio API is not supported in this browser', e);
            return false;
        }
    }
    
    // Resume audio context if it's suspended (needed for some browsers)
    if (audioContext.state === 'suspended') {
        audioContext.resume();
    }
    
    return true;
}

// Create reverb effect using convolution
function createReverbEffect() {
    reverbEffect = audioContext.createConvolver();
    reverbGain = audioContext.createGain();
    
    // Create a simple reverb impulse response
    const length = audioContext.sampleRate * reverbTime;
    const impulse = audioContext.createBuffer(2, length, audioContext.sampleRate);
    
    for (let channel = 0; channel < 2; channel++) {
        const channelData = impulse.getChannelData(channel);
        for (let i = 0; i < length; i++) {
            channelData[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / length, 2);
        }
    }
    
    reverbEffect.buffer = impulse;
    reverbGain.gain.value = reverbLevel;
    
    // Connect reverb: gain -> reverb -> reverbGain -> destination
    gainNode.connect(reverbEffect);
    reverbEffect.connect(reverbGain);
    reverbGain.connect(audioContext.destination);
}

// Create echo/delay effect
function createEchoEffect() {
    echoEffect = audioContext.createGain(); // Main echo path
    echoDelay = audioContext.createDelay(5.0); // Max delay of 5 seconds
    echoFeedback = audioContext.createGain();
    echoGain = audioContext.createGain();
    
    // Set initial values
    echoDelay.delayTime.value = echoTime;
    echoFeedback.gain.value = echoFeedbackLevel;
    echoGain.gain.value = echoLevel;
    
    // Connect echo: gain -> delay -> feedback -> delay (feedback loop)
    gainNode.connect(echoDelay);
    echoDelay.connect(echoFeedback);
    echoFeedback.connect(echoDelay);
    echoDelay.connect(echoGain);
    echoGain.connect(audioContext.destination);
}

// Update reverb settings
function updateReverbSettings() {
    if (reverbGain) {
        reverbGain.gain.value = reverbEnabled ? reverbLevel : 0;
    }
    
    // Recreate reverb impulse response when time changes
    if (reverbEffect) {
        const length = audioContext.sampleRate * reverbTime;
        const impulse = audioContext.createBuffer(2, length, audioContext.sampleRate);
        
        for (let channel = 0; channel < 2; channel++) {
            const channelData = impulse.getChannelData(channel);
            for (let i = 0; i < length; i++) {
                channelData[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / length, 2);
            }
        }
        
        reverbEffect.buffer = impulse;
    }
}

// Update echo settings
function updateEchoSettings() {
    if (echoGain) {
        echoGain.gain.value = echoEnabled ? echoLevel : 0;
    }
    
    if (echoDelay) {
        echoDelay.delayTime.value = echoTime;
    }
    
    if (echoFeedback) {
        echoFeedback.gain.value = echoFeedbackLevel;
    }
}

// Calculate frequency based on note and current octave
function getFrequency(note) {
    // Get base frequency for the note in octave 4
    const baseFreq = baseFrequencies[note];
    
    // Calculate frequency for the current octave
    // Each octave is 2x the frequency of the previous one
    const frequency = baseFreq * Math.pow(2, currentOctave - 4);
    
    return frequency;
}

// Play a note
function playNote(note) {
    // If this note is already playing, stop it first
    if (activeOscillators[note]) {
        stopNote(note);
    }
    
    // Create new oscillator
    const oscillator = audioContext.createOscillator();
    oscillator.type = currentWaveform;
    oscillator.frequency.value = getFrequency(note);
    
    // Create a gain node for this note (envelope)
    const noteGain = audioContext.createGain();
    noteGain.gain.value = 0; // Start at 0
    
    // Connect oscillator -> note gain -> main gain
    oscillator.connect(noteGain);
    noteGain.connect(gainNode);
    
    // Start the oscillator
    oscillator.start();
    
    // Apply attack envelope
    noteGain.gain.cancelScheduledValues(audioContext.currentTime);
    noteGain.gain.setValueAtTime(0, audioContext.currentTime);
    noteGain.gain.linearRampToValueAtTime(1, audioContext.currentTime + ATTACK_TIME);
    
    // Store the oscillator and gain node
    activeOscillators[note] = oscillator;
    activeGains[note] = noteGain;
}

// Stop playing a specific note
function stopNote(note) {
    if (activeOscillators[note] && activeGains[note]) {
        // Apply release envelope
        const noteGain = activeGains[note];
        noteGain.gain.cancelScheduledValues(audioContext.currentTime);
        noteGain.gain.setValueAtTime(noteGain.gain.value, audioContext.currentTime);
        noteGain.gain.linearRampToValueAtTime(0, audioContext.currentTime + RELEASE_TIME);
        
        // Stop and disconnect the oscillator after the release time
        setTimeout(() => {
            if (activeOscillators[note]) {
                activeOscillators[note].stop();
                activeOscillators[note].disconnect();
                delete activeOscillators[note];
            }
            if (activeGains[note]) {
                activeGains[note].disconnect();
                delete activeGains[note];
            }
        }, RELEASE_TIME * 1000);
    }
}

// Stop all playing notes
function stopAllNotes() {
    Object.keys(activeOscillators).forEach(note => {
        stopNote(note);
    });
}

// Update volume
function updateVolume(volume) {
    currentVolume = volume;
    if (gainNode) {
        gainNode.gain.value = volume;
    }
}

// Update waveform
function updateWaveform(waveform) {
    currentWaveform = waveform;
    // Update all active oscillators with new waveform
    Object.keys(activeOscillators).forEach(note => {
        // Create new oscillator with new waveform
        const newOscillator = audioContext.createOscillator();
        newOscillator.type = currentWaveform;
        newOscillator.frequency.value = activeOscillators[note].frequency.value;
        
        // Connect to existing note gain
        newOscillator.connect(activeGains[note]);
        newOscillator.start();
        
        // Stop the old oscillator
        activeOscillators[note].stop();
        activeOscillators[note].disconnect();
        
        // Replace with new oscillator
        activeOscillators[note] = newOscillator;
    });
}

// Update octave
function updateOctave(octave) {
    currentOctave = octave;
    document.getElementById('octave-display').textContent = octave;
    document.getElementById('current-octave').textContent = octave;
    
    // Update frequencies of all playing notes
    Object.keys(activeOscillators).forEach(note => {
        // Update frequency value directly for smooth transition
        activeOscillators[note].frequency.value = getFrequency(note);
    });
}

// Handle keydown events
function handleKeyDown(event) {
    const key = event.key.toUpperCase();
    const note = keyMap[key];
    
    // Only play if we have a valid note mapping
    if (note && !event.repeat) {
        initAudio();
        playNote(note);
        highlightKey(key);
    }
}

// Handle keyup events
function handleKeyUp(event) {
    const key = event.key.toUpperCase();
    const note = keyMap[key];
    
    // Only stop if we have a valid note mapping
    if (note) {
        stopNote(note);
        removeHighlight(key);
    }
}

// Highlight pressed key
function highlightKey(key) {
    const keyElement = document.querySelector(`.key[data-key="${key}"]`);
    if (keyElement) {
        keyElement.classList.add('active');
    }
}

// Remove highlight from key
function removeHighlight(key) {
    const keyElement = document.querySelector(`.key[data-key="${key}"]`);
    if (keyElement) {
        keyElement.classList.remove('active');
    }
}

// Handle mouse clicks on keys
function handleKeyClick(event) {
    const keyElement = event.target.closest('.key');
    if (keyElement) {
        const key = keyElement.dataset.key;
        const note = keyElement.dataset.note;
        
        initAudio();
        playNote(note);
        highlightKey(key);
        
        // Stop note after a short time if not released by keyup
        // Clear any existing timeout for this note to prevent conflicts
        if (keyElement.timeoutId) {
            clearTimeout(keyElement.timeoutId);
        }
        
        keyElement.timeoutId = setTimeout(() => {
            stopNote(note);
            removeHighlight(key);
            delete keyElement.timeoutId;
        }, 1000);
    }
}

// Handle mouse up events to stop notes when mouse is released
function handleMouseUp(event) {
    const keyElement = event.target.closest('.key');
    if (keyElement) {
        const key = keyElement.dataset.key;
        const note = keyElement.dataset.note;
        
        // Clear any existing timeout
        if (keyElement.timeoutId) {
            clearTimeout(keyElement.timeoutId);
            delete keyElement.timeoutId;
        }
        
        stopNote(note);
        removeHighlight(key);
    }
}

// Initialize when page loads
document.addEventListener('DOMContentLoaded', () => {
    // Set up event listeners for controls
    document.getElementById('waveform').addEventListener('change', (event) => {
        updateWaveform(event.target.value);
    });
    
    document.getElementById('volume').addEventListener('input', (event) => {
        updateVolume(parseFloat(event.target.value));
    });
    
    document.getElementById('octave').addEventListener('input', (event) => {
        updateOctave(parseInt(event.target.value));
    });
    
    // Set up keyboard event listeners
    document.addEventListener('keydown', handleKeyDown);
    document.addEventListener('keyup', handleKeyUp);
    
    // Set up mouse event listeners for keys
    document.querySelectorAll('.key').forEach(key => {
        key.addEventListener('mousedown', handleKeyClick);
        key.addEventListener('mouseup', handleMouseUp);
        key.addEventListener('mouseleave', handleMouseUp);
    });
    
    // Set up event listeners for effects controls
    document.getElementById('reverb-enable').addEventListener('change', (event) => {
        reverbEnabled = event.target.checked;
        updateReverbSettings();
    });
    
    document.getElementById('reverb-level').addEventListener('input', (event) => {
        reverbLevel = parseFloat(event.target.value);
        document.getElementById('reverb-level-display').textContent = reverbLevel.toFixed(2);
        updateReverbSettings();
    });
    
    document.getElementById('reverb-time').addEventListener('input', (event) => {
        reverbTime = parseFloat(event.target.value);
        document.getElementById('reverb-time-display').textContent = reverbTime.toFixed(1) + 's';
        updateReverbSettings();
    });
    
    document.getElementById('echo-enable').addEventListener('change', (event) => {
        echoEnabled = event.target.checked;
        updateEchoSettings();
    });
    
    document.getElementById('echo-level').addEventListener('input', (event) => {
        echoLevel = parseFloat(event.target.value);
        document.getElementById('echo-level-display').textContent = echoLevel.toFixed(2);
        updateEchoSettings();
    });
    
    document.getElementById('echo-time').addEventListener('input', (event) => {
        echoTime = parseFloat(event.target.value);
        document.getElementById('echo-time-display').textContent = echoTime.toFixed(2) + 's';
        updateEchoSettings();
    });
    
    document.getElementById('echo-feedback').addEventListener('input', (event) => {
        echoFeedbackLevel = parseFloat(event.target.value);
        document.getElementById('echo-feedback-display').textContent = echoFeedbackLevel.toFixed(2);
        updateEchoSettings();
    });
    
    // Initialize control displays
    document.getElementById('volume').value = currentVolume;
    document.getElementById('octave').value = currentOctave;
    document.getElementById('octave-display').textContent = currentOctave;
    document.getElementById('current-octave').textContent = currentOctave;
    
    // Initialize effect controls
    document.getElementById('reverb-level').value = reverbLevel;
    document.getElementById('reverb-time').value = reverbTime;
    document.getElementById('reverb-level-display').textContent = reverbLevel.toFixed(2);
    document.getElementById('reverb-time-display').textContent = reverbTime.toFixed(1) + 's';
    
    document.getElementById('echo-level').value = echoLevel;
    document.getElementById('echo-time').value = echoTime;
    document.getElementById('echo-feedback').value = echoFeedbackLevel;
    document.getElementById('echo-level-display').textContent = echoLevel.toFixed(2);
    document.getElementById('echo-time-display').textContent = echoTime.toFixed(2) + 's';
    document.getElementById('echo-feedback-display').textContent = echoFeedbackLevel.toFixed(2);
});