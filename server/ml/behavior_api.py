"""
FastAPI Server for Real-time Behavior Analytics
Run with: python behavior_api.py
Or: uvicorn behavior_api:app --host 0.0.0.0 --port 5000 --reload
"""

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import List, Optional, Dict, Any
import json
from datetime import datetime
import time

# Import our behavior analytics engine
from behavior_analytics import BehaviorAnalyticsEngine, analyze_behavior, update_user_baseline

app = FastAPI(
    title="KAVACH Behavior Analytics API",
    description="Real-time behavioral biometric analysis for fraud detection",
    version="1.0.0"
)

# Enable CORS for web dashboard
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Initialize engine
engine = BehaviorAnalyticsEngine()
START_TIME = time.time()


# ============ Request/Response Models ============

class CursorPoint(BaseModel):
    x: float
    y: float
    timestamp: float
    pressure: Optional[float] = None
    size: Optional[float] = None


class KeystrokeEvent(BaseModel):
    key: str
    pressTime: float
    releaseTime: Optional[float] = None


class AnalyzeRequest(BaseModel):
    user_id: Optional[str] = "anonymous"
    cursor_points: List[CursorPoint] = []
    keystrokes: List[KeystrokeEvent] = []
    session_info: Optional[Dict[str, Any]] = {}


class UpdateBaselineRequest(BaseModel):
    user_id: str
    cursor_points: List[CursorPoint] = []
    keystrokes: List[KeystrokeEvent] = []


class HealthResponse(BaseModel):
    status: str
    timestamp: str
    uptime: float
    version: str


# ============ API Endpoints ============

@app.get("/", tags=["Root"])
async def root():
    return {
        "name": "KAVACH Behavior Analytics API",
        "version": "1.0.0",
        "endpoints": {
            "analyze": "POST /analyze - Analyze behavior data",
            "baseline": "POST /baseline - Update user baseline",
            "health": "GET /health - Health check"
        }
    }


@app.get("/health", response_model=HealthResponse, tags=["Health"])
async def health_check():
    """Health check endpoint"""
    return {
        "status": "ok",
        "timestamp": datetime.now().isoformat(),
        "uptime": time.time() - START_TIME,
        "version": "1.0.0"
    }


@app.post("/analyze", tags=["Analysis"])
async def analyze_behavior_endpoint(request: AnalyzeRequest):
    """
    Analyze user behavior data in real-time

    Returns BBA scores, anomalies, cognitive analysis, and risk assessment
    """
    try:
        # Convert Pydantic models to dicts
        cursor_data = [
            {
                'x': p.x,
                'y': p.y,
                'timestamp': p.timestamp,
                'pressure': p.pressure,
                'size': p.size
            }
            for p in request.cursor_points
        ]

        keystroke_data = [
            {
                'key': k.key,
                'pressTime': k.pressTime,
                'releaseTime': k.releaseTime or k.pressTime + 100
            }
            for k in request.keystrokes
        ]

        data = {
            'user_id': request.user_id,
            'cursor_points': cursor_data,
            'keystrokes': keystroke_data,
            'session_info': request.session_info or {}
        }

        # Run analysis
        result = engine.analyze(data)

        return {
            "success": True,
            "data": result
        }

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/baseline", tags=["Baseline"])
async def update_baseline_endpoint(request: UpdateBaselineRequest):
    """
    Update user's behavioral baseline profile

    Call this after successful transactions to improve user profile
    """
    try:
        cursor_data = [
            {'x': p.x, 'y': p.y, 'timestamp': p.timestamp}
            for p in request.cursor_points
        ]

        keystroke_data = [
            {
                'key': k.key,
                'pressTime': k.pressTime,
                'releaseTime': k.releaseTime or k.pressTime + 100
            }
            for k in request.keystrokes
        ]

        data = {
            'cursor_points': cursor_data,
            'keystrokes': keystroke_data
        }

        baseline = engine.update_baseline(request.user_id, data)

        return {
            "success": True,
            "message": f"Baseline updated for user {request.user_id}",
            "sample_count": baseline.get('sample_count', 1)
        }

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/baseline/{user_id}", tags=["Baseline"])
async def get_baseline(user_id: str):
    """Get user's behavioral baseline profile"""
    baseline = engine.user_baselines.get(user_id)

    if not baseline:
        return {
            "success": False,
            "message": f"No baseline found for user {user_id}",
            "data": None
        }

    return {
        "success": True,
        "data": {
            "user_id": user_id,
            "sample_count": baseline.get('sample_count', 0),
            "cursor_baseline": baseline.get('cursor', {}),
            "keystroke_baseline": baseline.get('keystroke', {})
        }
    }


@app.post("/analyze/cursor", tags=["Analysis"])
async def analyze_cursor_only(points: List[CursorPoint]):
    """Analyze cursor/touch data only (lightweight endpoint)"""
    try:
        cursor_data = [
            {'x': p.x, 'y': p.y, 'timestamp': p.timestamp}
            for p in points
        ]

        features = engine.cursor_analyzer.extract_features(cursor_data)
        anomalies = engine.cursor_analyzer.detect_anomalies(features)
        score = engine.cursor_analyzer.calculate_score(features)

        return {
            "success": True,
            "data": {
                "features": features,
                "anomalies": anomalies,
                "score": score
            }
        }

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/analyze/keystrokes", tags=["Analysis"])
async def analyze_keystrokes_only(keystrokes: List[KeystrokeEvent]):
    """Analyze keystroke data only (lightweight endpoint)"""
    try:
        keystroke_data = [
            {
                'key': k.key,
                'pressTime': k.pressTime,
                'releaseTime': k.releaseTime or k.pressTime + 100
            }
            for k in keystrokes
        ]

        features = engine.keystroke_analyzer.extract_features(keystroke_data)
        anomalies = engine.keystroke_analyzer.detect_anomalies(features)
        score = engine.keystroke_analyzer.calculate_score(features)

        return {
            "success": True,
            "data": {
                "features": features,
                "anomalies": anomalies,
                "score": score
            }
        }

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ============ WebSocket for Real-time Updates ============
# (Optional - for live dashboard updates)

from fastapi import WebSocket, WebSocketDisconnect
from typing import Set
import asyncio

connected_clients: Set[WebSocket] = set()


@app.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket):
    """WebSocket endpoint for real-time analytics streaming"""
    await websocket.accept()
    connected_clients.add(websocket)

    try:
        while True:
            # Receive data from client
            data = await websocket.receive_json()

            # Analyze behavior
            result = engine.analyze(data)

            # Send result back
            await websocket.send_json({
                "type": "analysis_result",
                "data": result
            })

    except WebSocketDisconnect:
        connected_clients.discard(websocket)
    except Exception as e:
        print(f"WebSocket error: {e}")
        connected_clients.discard(websocket)


# ============ Run Server ============

if __name__ == "__main__":
    import uvicorn
    print("=" * 50)
    print("KAVACH Behavior Analytics API")
    print("=" * 50)
    print("\nStarting server on http://localhost:5000")
    print("\nEndpoints:")
    print("  GET  /          - API info")
    print("  GET  /health    - Health check")
    print("  POST /analyze   - Full behavior analysis")
    print("  POST /baseline  - Update user baseline")
    print("  GET  /baseline/{user_id} - Get user baseline")
    print("  POST /analyze/cursor     - Cursor analysis only")
    print("  POST /analyze/keystrokes - Keystroke analysis only")
    print("  WS   /ws        - WebSocket for real-time")
    print("\nDocs: http://localhost:5000/docs")
    print("=" * 50)

    uvicorn.run(app, host="0.0.0.0", port=5000)
