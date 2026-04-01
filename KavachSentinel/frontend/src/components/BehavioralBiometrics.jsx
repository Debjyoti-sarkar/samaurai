import React, { useEffect, useState, useRef } from 'react';

// Invisible component that wraps the app or sits on it
export default function BehavioralBiometrics({ onAnomalyDetected }) {
    const [typingSpeeds, setTypingSpeeds] = useState([]);
    const [lastKeyPress, setLastKeyPress] = useState(Date.now());
    const typingThreshold = useRef(200); // Standard variance

    useEffect(() => {
        const handleKeyDown = (e) => {
            const now = Date.now();
            const delay = now - lastKeyPress;
            setLastKeyPress(now);

            // Collect last 10 typing gaps
            setTypingSpeeds(prev => {
                const updated = [...prev, delay].slice(-10);

                // If average gap is wildly erratic or too fast (bot), flag it.
                if (updated.length === 10) {
                    const avg = updated.reduce((a, b) => a + b) / 10;
                    if (avg < 30 || avg > 800) { // Super fast script OR strangely slow
                        onAnomalyDetected(`Biometric Anomaly: Erratic Operator Rhythm (Avg gap: ${Math.floor(avg)}ms)`);
                    }
                }
                return updated;
            });
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [lastKeyPress, onAnomalyDetected]);

    return null; // Invisible tracker
}
