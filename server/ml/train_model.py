"""
Model Training Script
Trains the anomaly detection models using synthetic or real data
"""

import os
import sys
import argparse
import pandas as pd
import numpy as np
from datetime import datetime

# Add parent directory to path
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from anomaly_detector import PaymentAnomalyDetector
from synthetic_data_generator import SyntheticDataGenerator


def train_with_synthetic_data(model_dir='./models', num_users=100, days=30, anomaly_rate=0.05):
    """
    Generate synthetic data and train models
    """
    print("=" * 60)
    print("BEHAVIOR ANALYSIS MODEL TRAINING")
    print("=" * 60)
    print(f"Model directory: {model_dir}")
    print(f"Users: {num_users}, Days: {days}, Anomaly rate: {anomaly_rate * 100}%")
    print("=" * 60)

    # Generate synthetic data
    print("\n[1/3] Generating synthetic training data...")
    generator = SyntheticDataGenerator()
    df, profiles = generator.generate_dataset(
        num_users=num_users,
        days=days,
        anomaly_rate=anomaly_rate
    )

    # Save data
    data_dir = os.path.join(os.path.dirname(model_dir), 'data')
    os.makedirs(data_dir, exist_ok=True)
    df.to_csv(os.path.join(data_dir, 'training_data.csv'), index=False)
    print(f"Training data saved to {data_dir}/training_data.csv")

    # Initialize detector
    print("\n[2/3] Initializing anomaly detector...")
    detector = PaymentAnomalyDetector(model_dir=model_dir)

    # Train models
    print("\n[3/3] Training models...")
    detector.train(df, contamination=anomaly_rate)

    print("\n" + "=" * 60)
    print("TRAINING COMPLETE")
    print("=" * 60)

    # Test prediction
    print("\n[TEST] Running sample predictions...")

    # Test normal transaction
    normal_tx = {
        'amount': 500,
        'amount_zscore': 0.1,
        'hour_of_day': 14,
        'day_of_week': 2,
        'is_weekend': 0,
        'is_new_recipient': 0,
        'recipient_trust_score': 80,
        'device_trust_score': 90,
        'location_trust_score': 85,
        'is_unusual_time': 0,
        'is_unusual_location': 0,
        'is_unusual_device': 0,
        'transaction_velocity_1h': 1,
        'transaction_velocity_24h': 3,
        'amount_velocity_24h': 1500,
        'session_duration': 120,
        'actions_before_transaction': 8,
        'time_since_last_transaction': 7200,
        'failed_auth_count_24h': 0,
        'device_age_days': 180
    }

    result = detector.predict(normal_tx)
    print(f"\nNormal transaction prediction:")
    print(f"  Risk Score: {result['risk_score']:.1f}")
    print(f"  Risk Level: {result['risk_level']}")
    print(f"  Is Anomaly: {result['is_anomaly']}")

    # Test anomalous transaction
    anomalous_tx = {
        'amount': 50000,  # Very high
        'amount_zscore': 8.5,
        'hour_of_day': 3,  # Unusual time
        'day_of_week': 1,
        'is_weekend': 0,
        'is_new_recipient': 1,  # New recipient
        'recipient_trust_score': 0,
        'device_trust_score': 10,  # New device
        'location_trust_score': 5,  # New location
        'is_unusual_time': 1,
        'is_unusual_location': 1,
        'is_unusual_device': 1,
        'transaction_velocity_1h': 8,  # High velocity
        'transaction_velocity_24h': 15,
        'amount_velocity_24h': 75000,
        'session_duration': 5,  # Very short session
        'actions_before_transaction': 2,
        'time_since_last_transaction': 300,
        'failed_auth_count_24h': 4,  # Failed auths
        'device_age_days': 0
    }

    result = detector.predict(anomalous_tx)
    print(f"\nAnomalous transaction prediction:")
    print(f"  Risk Score: {result['risk_score']:.1f}")
    print(f"  Risk Level: {result['risk_level']}")
    print(f"  Is Anomaly: {result['is_anomaly']}")
    print(f"  Risk Factors:")
    for factor in result['risk_factors'][:5]:
        print(f"    - {factor['factor']}: {factor['description']}")

    return detector


def train_with_real_data(data_path, model_dir='./models'):
    """
    Train models with real transaction data
    """
    print("=" * 60)
    print("TRAINING WITH REAL DATA")
    print("=" * 60)

    if not os.path.exists(data_path):
        print(f"Error: Data file not found at {data_path}")
        return None

    print(f"Loading data from {data_path}...")
    df = pd.read_csv(data_path)
    print(f"Loaded {len(df)} records")

    # Initialize and train
    detector = PaymentAnomalyDetector(model_dir=model_dir)
    detector.train(df)

    return detector


def evaluate_model(model_dir='./models', test_data_path=None):
    """
    Evaluate trained model performance
    """
    print("=" * 60)
    print("MODEL EVALUATION")
    print("=" * 60)

    detector = PaymentAnomalyDetector(model_dir=model_dir)
    if not detector.load_models():
        print("Error: Could not load models")
        return

    if test_data_path and os.path.exists(test_data_path):
        df = pd.read_csv(test_data_path)
    else:
        # Generate test data
        generator = SyntheticDataGenerator(seed=123)  # Different seed
        df, _ = generator.generate_dataset(num_users=20, days=7, anomaly_rate=0.1)

    print(f"Evaluating on {len(df)} transactions...")

    # Predictions
    results = []
    for _, row in df.iterrows():
        pred = detector.predict(row.to_dict())
        results.append({
            'actual': row.get('is_anomaly', 0),
            'predicted': 1 if pred['is_anomaly'] else 0,
            'score': pred['risk_score']
        })

    results_df = pd.DataFrame(results)

    # Metrics
    true_positives = ((results_df['actual'] == 1) & (results_df['predicted'] == 1)).sum()
    true_negatives = ((results_df['actual'] == 0) & (results_df['predicted'] == 0)).sum()
    false_positives = ((results_df['actual'] == 0) & (results_df['predicted'] == 1)).sum()
    false_negatives = ((results_df['actual'] == 1) & (results_df['predicted'] == 0)).sum()

    accuracy = (true_positives + true_negatives) / len(results_df)
    precision = true_positives / (true_positives + false_positives) if (true_positives + false_positives) > 0 else 0
    recall = true_positives / (true_positives + false_negatives) if (true_positives + false_negatives) > 0 else 0
    f1 = 2 * (precision * recall) / (precision + recall) if (precision + recall) > 0 else 0

    print(f"\nResults:")
    print(f"  Accuracy:  {accuracy:.2%}")
    print(f"  Precision: {precision:.2%}")
    print(f"  Recall:    {recall:.2%}")
    print(f"  F1 Score:  {f1:.2%}")
    print(f"\nConfusion Matrix:")
    print(f"  True Positives:  {true_positives}")
    print(f"  True Negatives:  {true_negatives}")
    print(f"  False Positives: {false_positives}")
    print(f"  False Negatives: {false_negatives}")

    return {
        'accuracy': accuracy,
        'precision': precision,
        'recall': recall,
        'f1': f1
    }


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description='Train Behavior Analysis Models')
    parser.add_argument('--mode', type=str, default='synthetic',
                        choices=['synthetic', 'real', 'evaluate'],
                        help='Training mode')
    parser.add_argument('--data', type=str, help='Path to training data CSV')
    parser.add_argument('--model-dir', type=str, default='./models',
                        help='Directory to save models')
    parser.add_argument('--users', type=int, default=100,
                        help='Number of synthetic users')
    parser.add_argument('--days', type=int, default=30,
                        help='Number of days of data')
    parser.add_argument('--anomaly-rate', type=float, default=0.05,
                        help='Anomaly rate for synthetic data')

    args = parser.parse_args()

    if args.mode == 'synthetic':
        train_with_synthetic_data(
            model_dir=args.model_dir,
            num_users=args.users,
            days=args.days,
            anomaly_rate=args.anomaly_rate
        )
    elif args.mode == 'real':
        if not args.data:
            print("Error: --data required for real mode")
            sys.exit(1)
        train_with_real_data(args.data, args.model_dir)
    elif args.mode == 'evaluate':
        evaluate_model(args.model_dir, args.data)
