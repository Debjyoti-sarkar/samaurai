"""
Anomaly Detection Model for Payment Behavior Analysis
Uses Isolation Forest and Autoencoder for detecting unusual payment patterns
"""

import numpy as np
import pandas as pd
from sklearn.ensemble import IsolationForest
from sklearn.preprocessing import StandardScaler, MinMaxScaler
from sklearn.model_selection import train_test_split
import joblib
import json
import os
from datetime import datetime
import warnings
warnings.filterwarnings('ignore')

# Optional: TensorFlow for Autoencoder (if available)
try:
    import tensorflow as tf
    from tensorflow import keras
    from tensorflow.keras import layers
    HAS_TENSORFLOW = True
except ImportError:
    HAS_TENSORFLOW = False
    print("TensorFlow not available. Using Isolation Forest only.")


class PaymentAnomalyDetector:
    """
    Hybrid anomaly detection using:
    1. Isolation Forest - for general anomaly detection
    2. Autoencoder (if TF available) - for learning normal patterns
    3. Statistical rules - for known fraud patterns
    """

    def __init__(self, model_dir='./models'):
        self.model_dir = model_dir
        os.makedirs(model_dir, exist_ok=True)

        # Feature names for transaction analysis
        self.feature_names = [
            'amount',
            'amount_zscore',
            'hour_of_day',
            'day_of_week',
            'is_weekend',
            'is_new_recipient',
            'recipient_trust_score',
            'device_trust_score',
            'location_trust_score',
            'is_unusual_time',
            'is_unusual_location',
            'is_unusual_device',
            'transaction_velocity_1h',
            'transaction_velocity_24h',
            'amount_velocity_24h',
            'session_duration',
            'actions_before_transaction',
            'time_since_last_transaction',
            'failed_auth_count_24h',
            'device_age_days'
        ]

        # Initialize models
        self.isolation_forest = None
        self.autoencoder = None
        self.scaler = StandardScaler()
        self.threshold = 0.5  # Anomaly threshold

        # Model version
        self.version = '1.0.0'

    def preprocess_features(self, data, fit=False):
        """
        Preprocess features for model input
        """
        if isinstance(data, dict):
            # Convert single transaction to DataFrame
            df = pd.DataFrame([data])
        else:
            df = data.copy()

        # Ensure all features exist
        for feature in self.feature_names:
            if feature not in df.columns:
                df[feature] = 0

        # Select only required features
        X = df[self.feature_names].values

        # Handle missing values
        X = np.nan_to_num(X, nan=0.0)

        # Scale features
        if fit:
            X_scaled = self.scaler.fit_transform(X)
        else:
            X_scaled = self.scaler.transform(X)

        return X_scaled

    def train_isolation_forest(self, X_train, contamination=0.05):
        """
        Train Isolation Forest model
        """
        print("Training Isolation Forest...")
        self.isolation_forest = IsolationForest(
            n_estimators=200,
            max_samples='auto',
            contamination=contamination,
            max_features=1.0,
            bootstrap=False,
            n_jobs=-1,
            random_state=42,
            verbose=0
        )
        self.isolation_forest.fit(X_train)
        print("Isolation Forest training complete.")
        return self.isolation_forest

    def build_autoencoder(self, input_dim):
        """
        Build Autoencoder model for anomaly detection
        """
        if not HAS_TENSORFLOW:
            return None

        print("Building Autoencoder...")
        # Encoder
        encoder_input = keras.Input(shape=(input_dim,), name='encoder_input')
        x = layers.Dense(64, activation='relu')(encoder_input)
        x = layers.BatchNormalization()(x)
        x = layers.Dropout(0.2)(x)
        x = layers.Dense(32, activation='relu')(x)
        x = layers.BatchNormalization()(x)
        x = layers.Dropout(0.2)(x)
        encoded = layers.Dense(16, activation='relu', name='encoded')(x)

        # Decoder
        x = layers.Dense(32, activation='relu')(encoded)
        x = layers.BatchNormalization()(x)
        x = layers.Dropout(0.2)(x)
        x = layers.Dense(64, activation='relu')(x)
        x = layers.BatchNormalization()(x)
        decoder_output = layers.Dense(input_dim, activation='linear', name='decoder_output')(x)

        # Full model
        self.autoencoder = keras.Model(encoder_input, decoder_output, name='autoencoder')
        self.autoencoder.compile(
            optimizer=keras.optimizers.Adam(learning_rate=0.001),
            loss='mse'
        )

        print("Autoencoder built successfully.")
        return self.autoencoder

    def train_autoencoder(self, X_train, epochs=100, batch_size=32, validation_split=0.2):
        """
        Train Autoencoder on normal transactions
        """
        if not HAS_TENSORFLOW or self.autoencoder is None:
            return None

        print("Training Autoencoder...")

        # Early stopping
        early_stop = keras.callbacks.EarlyStopping(
            monitor='val_loss',
            patience=10,
            restore_best_weights=True
        )

        # Learning rate reduction
        lr_scheduler = keras.callbacks.ReduceLROnPlateau(
            monitor='val_loss',
            factor=0.5,
            patience=5,
            min_lr=0.0001
        )

        history = self.autoencoder.fit(
            X_train, X_train,
            epochs=epochs,
            batch_size=batch_size,
            validation_split=validation_split,
            callbacks=[early_stop, lr_scheduler],
            verbose=1
        )

        print("Autoencoder training complete.")
        return history

    def train(self, transactions_df, contamination=0.05):
        """
        Train all models on transaction data
        """
        print(f"Training on {len(transactions_df)} transactions...")

        # Preprocess
        X = self.preprocess_features(transactions_df, fit=True)

        # Split data
        X_train, X_test = train_test_split(X, test_size=0.2, random_state=42)

        # Train Isolation Forest
        self.train_isolation_forest(X_train, contamination)

        # Train Autoencoder (if available)
        if HAS_TENSORFLOW:
            self.build_autoencoder(X_train.shape[1])
            self.train_autoencoder(X_train)
            # Calculate reconstruction threshold
            train_reconstructions = self.autoencoder.predict(X_train)
            train_mse = np.mean(np.square(X_train - train_reconstructions), axis=1)
            self.ae_threshold = np.percentile(train_mse, 95)

        # Save models
        self.save_models()

        # Evaluate
        self.evaluate(X_test)

        return self

    def predict(self, transaction_features):
        """
        Predict anomaly score for a transaction
        Returns: (is_anomaly, risk_score, risk_factors)
        """
        # Preprocess
        X = self.preprocess_features(transaction_features)

        risk_factors = []
        scores = []

        # Isolation Forest prediction
        if self.isolation_forest is not None:
            if_score = self.isolation_forest.decision_function(X)[0]
            if_prediction = self.isolation_forest.predict(X)[0]

            # Convert to 0-100 score (lower decision_function = more anomalous)
            if_risk_score = max(0, min(100, 50 - if_score * 50))
            scores.append(if_risk_score)

            if if_prediction == -1:
                risk_factors.append({
                    'factor': 'isolation_forest_anomaly',
                    'score': if_risk_score,
                    'description': 'Transaction pattern differs from normal behavior'
                })

        # Autoencoder prediction
        if HAS_TENSORFLOW and self.autoencoder is not None:
            reconstruction = self.autoencoder.predict(X, verbose=0)
            mse = np.mean(np.square(X - reconstruction))

            # Convert MSE to risk score
            ae_risk_score = min(100, (mse / self.ae_threshold) * 50)
            scores.append(ae_risk_score)

            if mse > self.ae_threshold:
                risk_factors.append({
                    'factor': 'autoencoder_anomaly',
                    'score': ae_risk_score,
                    'description': 'Transaction deviates from learned patterns'
                })

        # Rule-based checks
        rule_factors = self.apply_rules(transaction_features)
        risk_factors.extend(rule_factors)

        # Calculate rule-based score
        if rule_factors:
            rule_score = np.mean([f['score'] for f in rule_factors])
            scores.append(rule_score)

        # Combined risk score
        risk_score = np.mean(scores) if scores else 0

        # Determine if anomaly
        is_anomaly = risk_score >= self.threshold * 100

        return {
            'is_anomaly': bool(is_anomaly),
            'risk_score': float(risk_score),
            'risk_level': self.get_risk_level(risk_score),
            'risk_factors': risk_factors,
            'model_version': self.version,
            'timestamp': datetime.now().isoformat()
        }

    def apply_rules(self, features):
        """
        Apply rule-based fraud detection
        """
        risk_factors = []

        if isinstance(features, dict):
            data = features
        else:
            data = features.iloc[0].to_dict() if hasattr(features, 'iloc') else {}

        # Rule 1: Large amount deviation
        amount_zscore = data.get('amount_zscore', 0)
        if abs(amount_zscore) > 3:
            risk_factors.append({
                'factor': 'amount_deviation',
                'score': min(100, abs(amount_zscore) * 15),
                'description': f'Amount is {abs(amount_zscore):.1f} std deviations from average'
            })

        # Rule 2: New recipient with high amount
        if data.get('is_new_recipient', False) and data.get('amount', 0) > 5000:
            risk_factors.append({
                'factor': 'new_recipient_high_amount',
                'score': 60,
                'description': 'High amount transaction to new recipient'
            })

        # Rule 3: Unusual time
        hour = data.get('hour_of_day', 12)
        if hour < 6 or hour > 23:
            risk_factors.append({
                'factor': 'unusual_time',
                'score': 40,
                'description': f'Transaction at unusual hour ({hour}:00)'
            })

        # Rule 4: High velocity
        velocity_1h = data.get('transaction_velocity_1h', 0)
        if velocity_1h > 5:
            risk_factors.append({
                'factor': 'high_velocity',
                'score': min(100, velocity_1h * 15),
                'description': f'{velocity_1h} transactions in last hour'
            })

        # Rule 5: Multiple failed auth attempts
        failed_auth = data.get('failed_auth_count_24h', 0)
        if failed_auth >= 3:
            risk_factors.append({
                'factor': 'auth_failures',
                'score': min(100, failed_auth * 20),
                'description': f'{failed_auth} failed auth attempts in 24h'
            })

        # Rule 6: Untrusted device
        device_trust = data.get('device_trust_score', 100)
        if device_trust < 30:
            risk_factors.append({
                'factor': 'untrusted_device',
                'score': 60,
                'description': 'Transaction from untrusted device'
            })

        # Rule 7: Untrusted location
        location_trust = data.get('location_trust_score', 100)
        if location_trust < 30:
            risk_factors.append({
                'factor': 'untrusted_location',
                'score': 50,
                'description': 'Transaction from untrusted location'
            })

        # Rule 8: Very short session
        session_duration = data.get('session_duration', 60)
        if session_duration < 10:
            risk_factors.append({
                'factor': 'short_session',
                'score': 45,
                'description': 'Very short session before transaction'
            })

        # Rule 9: First transaction from new device + new location
        if data.get('is_unusual_device', False) and data.get('is_unusual_location', False):
            risk_factors.append({
                'factor': 'new_device_new_location',
                'score': 70,
                'description': 'First transaction from new device and location'
            })

        return risk_factors

    def get_risk_level(self, score):
        """
        Convert risk score to risk level
        """
        if score < 25:
            return 'low'
        elif score < 50:
            return 'medium'
        elif score < 75:
            return 'high'
        else:
            return 'critical'

    def evaluate(self, X_test):
        """
        Evaluate model performance
        """
        print("\n=== Model Evaluation ===")

        # Isolation Forest
        if self.isolation_forest:
            if_predictions = self.isolation_forest.predict(X_test)
            anomalies = np.sum(if_predictions == -1)
            print(f"Isolation Forest detected {anomalies}/{len(X_test)} anomalies ({anomalies/len(X_test)*100:.1f}%)")

        # Autoencoder
        if HAS_TENSORFLOW and self.autoencoder:
            reconstructions = self.autoencoder.predict(X_test, verbose=0)
            mse = np.mean(np.square(X_test - reconstructions), axis=1)
            ae_anomalies = np.sum(mse > self.ae_threshold)
            print(f"Autoencoder detected {ae_anomalies}/{len(X_test)} anomalies ({ae_anomalies/len(X_test)*100:.1f}%)")
            print(f"Reconstruction threshold: {self.ae_threshold:.4f}")

    def save_models(self):
        """
        Save trained models to disk
        """
        timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')

        # Save Isolation Forest
        if self.isolation_forest:
            if_path = os.path.join(self.model_dir, f'isolation_forest_{timestamp}.joblib')
            joblib.dump(self.isolation_forest, if_path)
            joblib.dump(self.isolation_forest, os.path.join(self.model_dir, 'isolation_forest_latest.joblib'))
            print(f"Saved Isolation Forest to {if_path}")

        # Save Autoencoder
        if HAS_TENSORFLOW and self.autoencoder:
            ae_path = os.path.join(self.model_dir, f'autoencoder_{timestamp}.keras')
            self.autoencoder.save(ae_path)
            self.autoencoder.save(os.path.join(self.model_dir, 'autoencoder_latest.keras'))
            print(f"Saved Autoencoder to {ae_path}")

        # Save scaler
        scaler_path = os.path.join(self.model_dir, 'scaler_latest.joblib')
        joblib.dump(self.scaler, scaler_path)

        # Save metadata
        metadata = {
            'version': self.version,
            'trained_at': timestamp,
            'feature_names': self.feature_names,
            'threshold': self.threshold,
            'ae_threshold': getattr(self, 'ae_threshold', None),
            'has_autoencoder': HAS_TENSORFLOW and self.autoencoder is not None
        }
        metadata_path = os.path.join(self.model_dir, 'model_metadata.json')
        with open(metadata_path, 'w') as f:
            json.dump(metadata, f, indent=2)

        print(f"Model metadata saved to {metadata_path}")

    def load_models(self):
        """
        Load trained models from disk
        """
        try:
            # Load Isolation Forest
            if_path = os.path.join(self.model_dir, 'isolation_forest_latest.joblib')
            if os.path.exists(if_path):
                self.isolation_forest = joblib.load(if_path)
                print("Loaded Isolation Forest model")

            # Load Autoencoder
            if HAS_TENSORFLOW:
                ae_path = os.path.join(self.model_dir, 'autoencoder_latest.keras')
                if os.path.exists(ae_path):
                    self.autoencoder = keras.models.load_model(ae_path)
                    print("Loaded Autoencoder model")

            # Load scaler
            scaler_path = os.path.join(self.model_dir, 'scaler_latest.joblib')
            if os.path.exists(scaler_path):
                self.scaler = joblib.load(scaler_path)
                print("Loaded scaler")

            # Load metadata
            metadata_path = os.path.join(self.model_dir, 'model_metadata.json')
            if os.path.exists(metadata_path):
                with open(metadata_path, 'r') as f:
                    metadata = json.load(f)
                    self.version = metadata.get('version', '1.0.0')
                    self.threshold = metadata.get('threshold', 0.5)
                    self.ae_threshold = metadata.get('ae_threshold', 0.1)
                    print(f"Loaded model version {self.version}")

            return True
        except Exception as e:
            print(f"Error loading models: {e}")
            return False


class BehaviorSequenceAnalyzer:
    """
    Analyzes sequences of user behavior for anomaly detection
    Uses LSTM if TensorFlow is available, otherwise statistical analysis
    """

    def __init__(self, sequence_length=20):
        self.sequence_length = sequence_length
        self.model = None
        self.scaler = MinMaxScaler()

    def create_sequences(self, events, feature_columns):
        """
        Create sequences from event data for LSTM
        """
        X = events[feature_columns].values
        X_scaled = self.scaler.fit_transform(X)

        sequences = []
        for i in range(len(X_scaled) - self.sequence_length):
            sequences.append(X_scaled[i:i + self.sequence_length])

        return np.array(sequences)

    def build_lstm_model(self, input_shape):
        """
        Build LSTM model for sequence anomaly detection
        """
        if not HAS_TENSORFLOW:
            return None

        model = keras.Sequential([
            layers.LSTM(64, return_sequences=True, input_shape=input_shape),
            layers.Dropout(0.2),
            layers.LSTM(32, return_sequences=False),
            layers.Dropout(0.2),
            layers.Dense(16, activation='relu'),
            layers.Dense(input_shape[1], activation='linear')
        ])

        model.compile(optimizer='adam', loss='mse')
        self.model = model
        return model

    def detect_sequence_anomaly(self, sequence):
        """
        Detect if a sequence of events is anomalous
        """
        if not HAS_TENSORFLOW or self.model is None:
            return self.statistical_sequence_analysis(sequence)

        # Predict next event
        sequence_scaled = self.scaler.transform(sequence[-self.sequence_length:])
        sequence_reshaped = sequence_scaled.reshape(1, self.sequence_length, -1)

        prediction = self.model.predict(sequence_reshaped, verbose=0)
        actual = sequence_scaled[-1]

        mse = np.mean(np.square(prediction - actual))

        return {
            'is_anomaly': mse > 0.1,
            'score': float(min(100, mse * 500)),
            'method': 'lstm'
        }

    def statistical_sequence_analysis(self, sequence):
        """
        Fallback statistical analysis for sequence anomalies
        """
        if len(sequence) < 3:
            return {'is_anomaly': False, 'score': 0, 'method': 'statistical'}

        # Analyze time intervals
        if 'timestamp' in sequence.columns:
            timestamps = pd.to_datetime(sequence['timestamp'])
            intervals = timestamps.diff().dt.total_seconds().dropna()

            if len(intervals) > 0:
                mean_interval = intervals.mean()
                std_interval = intervals.std()

                # Check for unusually fast sequences
                min_interval = intervals.min()
                if min_interval < 0.5:  # Less than 500ms between events
                    return {
                        'is_anomaly': True,
                        'score': 70,
                        'method': 'statistical',
                        'reason': 'Bot-like rapid event sequence'
                    }

                # Check for unusual patterns
                if std_interval > 0 and (intervals.iloc[-1] < mean_interval - 2 * std_interval):
                    return {
                        'is_anomaly': True,
                        'score': 50,
                        'method': 'statistical',
                        'reason': 'Unusual event timing pattern'
                    }

        return {'is_anomaly': False, 'score': 0, 'method': 'statistical'}


# CLI interface for testing
if __name__ == '__main__':
    import argparse

    parser = argparse.ArgumentParser(description='Payment Anomaly Detection')
    parser.add_argument('--train', action='store_true', help='Train models')
    parser.add_argument('--predict', type=str, help='Predict on JSON file')
    parser.add_argument('--data', type=str, help='Training data CSV')
    parser.add_argument('--model-dir', type=str, default='./models', help='Model directory')

    args = parser.parse_args()

    detector = PaymentAnomalyDetector(model_dir=args.model_dir)

    if args.train and args.data:
        print(f"Loading training data from {args.data}")
        df = pd.read_csv(args.data)
        detector.train(df)
    elif args.predict:
        detector.load_models()
        with open(args.predict, 'r') as f:
            transaction = json.load(f)
        result = detector.predict(transaction)
        print(json.dumps(result, indent=2))
    else:
        print("Use --train --data <csv> to train or --predict <json> to predict")
