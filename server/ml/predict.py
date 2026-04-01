"""
Prediction Script for Real-time Anomaly Detection
Called by Node.js RiskScorer service
"""

import sys
import json
import os

# Add parent directory
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from anomaly_detector import PaymentAnomalyDetector

def predict(features_json):
    """
    Make a prediction on transaction features
    """
    try:
        features = json.loads(features_json)

        # Initialize detector
        model_dir = os.path.join(os.path.dirname(__file__), 'models')
        detector = PaymentAnomalyDetector(model_dir=model_dir)

        # Try to load trained models
        if detector.load_models():
            result = detector.predict(features)
        else:
            # Fallback to rule-based only
            result = {
                'is_anomaly': False,
                'risk_score': 0,
                'risk_level': 'low',
                'risk_factors': detector.apply_rules(features),
                'model_version': 'rules_only'
            }

            # Calculate score from rules
            if result['risk_factors']:
                result['risk_score'] = min(100, sum(f['score'] for f in result['risk_factors']) / len(result['risk_factors']))
                result['risk_level'] = detector.get_risk_level(result['risk_score'])
                result['is_anomaly'] = result['risk_score'] >= 50

        print(json.dumps(result))

    except Exception as e:
        # Return error as JSON
        error_result = {
            'error': str(e),
            'is_anomaly': False,
            'risk_score': 0,
            'risk_level': 'low',
            'risk_factors': []
        }
        print(json.dumps(error_result))

if __name__ == '__main__':
    if len(sys.argv) > 1:
        predict(sys.argv[1])
    else:
        # Test with sample data
        test_features = {
            'amount': 5000,
            'amount_zscore': 2.5,
            'hour_of_day': 3,
            'day_of_week': 1,
            'is_weekend': 0,
            'is_new_recipient': 1,
            'recipient_trust_score': 10,
            'device_trust_score': 20,
            'location_trust_score': 15,
            'is_unusual_time': 1,
            'is_unusual_location': 1,
            'is_unusual_device': 1,
            'transaction_velocity_1h': 5,
            'transaction_velocity_24h': 10,
            'amount_velocity_24h': 25000,
            'session_duration': 8,
            'actions_before_transaction': 2,
            'time_since_last_transaction': 600,
            'failed_auth_count_24h': 3,
            'device_age_days': 0
        }
        predict(json.dumps(test_features))
