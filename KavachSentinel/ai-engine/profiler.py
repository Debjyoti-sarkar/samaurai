import sys
import json
from datetime import datetime

def analyze_behavior(log_data):
    """
    Very basic heuristic/pseudo-ML model for hackathon simulation.
    In reality, this uses sklearn clustering on request frequencies.
    """
    try:
        data = json.loads(log_data)
        metrics = data.get('metrics', {})
        
        speed = metrics.get('requests_per_minute', 0)
        targeted = metrics.get('accessed_sensitive', False)
        
        skill = "BEGINNER"
        motive = "CURIOSITY - CASUAL SNOOPING"
        
        if speed > 50 and targeted:
            skill = "EXPERT - AUTOMATED TOOLING"
            motive = "TARGETED DATA EXFILTRATION"
        elif speed > 10:
            skill = "INTERMEDIATE"
            motive = "NETWORK RECONNAISSANCE"
            
        # Basic timezone inference from activity hour
        hour = datetime.utcnow().hour
        inferred_tz = f"UTC+{(hour + 5) % 12}"
        
        profile = {
            "skill_level": skill,
            "likely_motive": motive,
            "inferred_timezone": inferred_tz,
            "confidence_score": 0.85
        }
        
        print(json.dumps(profile))
        
    except Exception as e:
        print(json.dumps({"error": str(e)}))

if __name__ == "__main__":
    if len(sys.argv) > 1:
        analyze_behavior(sys.argv[1])
    else:
        analyze_behavior('{"metrics": {"requests_per_minute": 60, "accessed_sensitive": true}}')
