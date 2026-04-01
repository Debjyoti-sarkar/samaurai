"""
Synthetic Data Generator for Training Behavior Analysis Models
Generates realistic transaction and behavior data with labeled anomalies
"""

import numpy as np
import pandas as pd
from datetime import datetime, timedelta
import random
import json
import os
import uuid

class SyntheticDataGenerator:
    """
    Generate synthetic transaction and behavior data for model training
    """

    def __init__(self, seed=42):
        np.random.seed(seed)
        random.seed(seed)

        # Common UPI IDs for recipients
        self.common_recipients = [
            'rahul.sharma@paytm', 'priya.patel@gpay', 'amit.kumar@phonepe',
            'neha.singh@upi', 'vijay.mehta@icici', 'sunita.verma@hdfc',
            'rajesh.gupta@sbi', 'anita.das@axis', 'sanjay.joshi@kotak',
            'meera.nair@ybl', 'arun.reddy@okhdfcbank', 'kavita.iyer@okicici'
        ]

        # Device models
        self.device_models = [
            'Samsung Galaxy S21', 'iPhone 13', 'OnePlus 9', 'Xiaomi 11',
            'Samsung Galaxy A52', 'iPhone 12', 'Realme 8', 'Vivo V21',
            'OPPO F19', 'Samsung Galaxy M32', 'iPhone SE', 'Poco X3'
        ]

        # Cities with coordinates
        self.locations = [
            {'city': 'Mumbai', 'lat': 19.0760, 'lon': 72.8777},
            {'city': 'Delhi', 'lat': 28.7041, 'lon': 77.1025},
            {'city': 'Bangalore', 'lat': 12.9716, 'lon': 77.5946},
            {'city': 'Chennai', 'lat': 13.0827, 'lon': 80.2707},
            {'city': 'Hyderabad', 'lat': 17.3850, 'lon': 78.4867},
            {'city': 'Pune', 'lat': 18.5204, 'lon': 73.8567},
            {'city': 'Kolkata', 'lat': 22.5726, 'lon': 88.3639},
            {'city': 'Ahmedabad', 'lat': 23.0225, 'lon': 72.5714}
        ]

    def generate_user_profile(self, user_id):
        """
        Generate a realistic user profile with behavioral patterns
        """
        # Base characteristics
        avg_amount = np.random.lognormal(mean=6, sigma=1)  # Average around 400-500
        std_amount = avg_amount * np.random.uniform(0.3, 0.7)

        # Preferred hours (work hours + some variation)
        preferred_hours = random.sample(range(9, 22), k=random.randint(4, 8))

        # Frequent recipients (3-8 people)
        num_frequent = random.randint(3, 8)
        frequent_recipients = random.sample(self.common_recipients, num_frequent)

        # Primary device and location
        primary_device = random.choice(self.device_models)
        primary_location = random.choice(self.locations)

        return {
            'user_id': user_id,
            'avg_amount': avg_amount,
            'std_amount': std_amount,
            'preferred_hours': preferred_hours,
            'frequent_recipients': frequent_recipients,
            'primary_device': primary_device,
            'secondary_device': random.choice([d for d in self.device_models if d != primary_device]),
            'primary_location': primary_location,
            'transactions_per_day': np.random.poisson(3) + 1,
            'weekend_activity': random.uniform(0.3, 1.0)  # Reduced weekend activity
        }

    def generate_normal_transaction(self, user_profile, base_time):
        """
        Generate a normal transaction following user's behavioral pattern
        """
        # Amount (follows user's normal pattern)
        amount = max(10, np.random.normal(
            user_profile['avg_amount'],
            user_profile['std_amount']
        ))

        # Time (within preferred hours with some noise)
        hour = random.choice(user_profile['preferred_hours'])
        minute = random.randint(0, 59)
        timestamp = base_time.replace(hour=hour, minute=minute)

        # Weekend adjustment
        if timestamp.weekday() >= 5:  # Weekend
            if random.random() > user_profile['weekend_activity']:
                return None  # Skip weekend transaction

        # Recipient (80% from frequent, 20% new)
        if random.random() < 0.8:
            recipient = random.choice(user_profile['frequent_recipients'])
            is_new_recipient = False
            recipient_trust = random.uniform(50, 100)
        else:
            recipient = f"new.user{random.randint(1000, 9999)}@upi"
            is_new_recipient = True
            recipient_trust = random.uniform(0, 30)

        # Device (90% primary, 10% secondary)
        if random.random() < 0.9:
            device = user_profile['primary_device']
            device_trust = random.uniform(80, 100)
        else:
            device = user_profile['secondary_device']
            device_trust = random.uniform(50, 80)

        # Location (95% primary, 5% nearby)
        loc = user_profile['primary_location']
        lat = loc['lat'] + np.random.normal(0, 0.01)  # Small variation
        lon = loc['lon'] + np.random.normal(0, 0.01)
        location_trust = random.uniform(70, 100)

        return {
            'transaction_id': str(uuid.uuid4()),
            'user_id': user_profile['user_id'],
            'amount': round(amount, 2),
            'amount_zscore': (amount - user_profile['avg_amount']) / max(user_profile['std_amount'], 1),
            'hour_of_day': hour,
            'day_of_week': timestamp.weekday(),
            'is_weekend': 1 if timestamp.weekday() >= 5 else 0,
            'timestamp': timestamp.isoformat(),
            'recipient_upi': recipient,
            'is_new_recipient': 1 if is_new_recipient else 0,
            'recipient_trust_score': recipient_trust,
            'device_model': device,
            'device_trust_score': device_trust,
            'location_city': loc['city'],
            'latitude': lat,
            'longitude': lon,
            'location_trust_score': location_trust,
            'is_unusual_time': 0,
            'is_unusual_location': 0,
            'is_unusual_device': 0,
            'transaction_velocity_1h': random.randint(0, 2),
            'transaction_velocity_24h': random.randint(1, 5),
            'amount_velocity_24h': round(amount * random.randint(1, 5), 2),
            'session_duration': random.randint(30, 300),
            'actions_before_transaction': random.randint(3, 15),
            'time_since_last_transaction': random.randint(3600, 86400),
            'failed_auth_count_24h': 0,
            'device_age_days': random.randint(30, 365),
            'is_anomaly': 0,
            'anomaly_type': None
        }

    def generate_anomalous_transaction(self, user_profile, base_time, anomaly_type=None):
        """
        Generate an anomalous transaction
        """
        # Start with normal transaction
        tx = self.generate_normal_transaction(user_profile, base_time)
        if tx is None:
            tx = self.generate_normal_transaction(user_profile, base_time.replace(weekday=2))

        if anomaly_type is None:
            anomaly_type = random.choice([
                'unusual_amount',
                'unusual_time',
                'unusual_location',
                'unusual_device',
                'high_velocity',
                'new_recipient_high_amount',
                'multiple_auth_failures',
                'bot_behavior'
            ])

        tx['is_anomaly'] = 1
        tx['anomaly_type'] = anomaly_type

        if anomaly_type == 'unusual_amount':
            # Very high amount (5-10x normal)
            multiplier = random.uniform(5, 10)
            tx['amount'] = round(user_profile['avg_amount'] * multiplier, 2)
            tx['amount_zscore'] = (tx['amount'] - user_profile['avg_amount']) / max(user_profile['std_amount'], 1)

        elif anomaly_type == 'unusual_time':
            # Transaction at unusual hour (2-5 AM)
            tx['hour_of_day'] = random.randint(2, 5)
            tx['is_unusual_time'] = 1

        elif anomaly_type == 'unusual_location':
            # Different city
            other_locs = [l for l in self.locations if l['city'] != user_profile['primary_location']['city']]
            new_loc = random.choice(other_locs)
            tx['location_city'] = new_loc['city']
            tx['latitude'] = new_loc['lat']
            tx['longitude'] = new_loc['lon']
            tx['location_trust_score'] = random.uniform(0, 20)
            tx['is_unusual_location'] = 1

        elif anomaly_type == 'unusual_device':
            # Completely new device
            tx['device_model'] = f"Unknown Device {random.randint(100, 999)}"
            tx['device_trust_score'] = 0
            tx['device_age_days'] = 0
            tx['is_unusual_device'] = 1

        elif anomaly_type == 'high_velocity':
            # Many transactions in short time
            tx['transaction_velocity_1h'] = random.randint(8, 15)
            tx['transaction_velocity_24h'] = random.randint(20, 50)
            tx['time_since_last_transaction'] = random.randint(60, 600)

        elif anomaly_type == 'new_recipient_high_amount':
            # New recipient with unusually high amount
            tx['recipient_upi'] = f"unknown.user{random.randint(10000, 99999)}@suspicious"
            tx['is_new_recipient'] = 1
            tx['recipient_trust_score'] = 0
            tx['amount'] = round(user_profile['avg_amount'] * random.uniform(3, 7), 2)
            tx['amount_zscore'] = (tx['amount'] - user_profile['avg_amount']) / max(user_profile['std_amount'], 1)

        elif anomaly_type == 'multiple_auth_failures':
            # Multiple failed authentication attempts
            tx['failed_auth_count_24h'] = random.randint(5, 10)

        elif anomaly_type == 'bot_behavior':
            # Very short session, rapid actions
            tx['session_duration'] = random.randint(1, 10)
            tx['actions_before_transaction'] = random.randint(1, 3)
            tx['time_since_last_transaction'] = random.randint(1, 60)

        return tx

    def generate_dataset(self, num_users=100, days=30, anomaly_rate=0.05):
        """
        Generate a complete dataset with normal and anomalous transactions
        """
        transactions = []
        user_profiles = {}

        print(f"Generating data for {num_users} users over {days} days...")
        print(f"Target anomaly rate: {anomaly_rate * 100}%")

        for i in range(num_users):
            user_id = f"USER_{i:05d}"
            profile = self.generate_user_profile(user_id)
            user_profiles[user_id] = profile

            # Generate transactions for each day
            base_date = datetime.now() - timedelta(days=days)

            for day in range(days):
                current_date = base_date + timedelta(days=day)

                # Number of transactions for this day
                num_tx = np.random.poisson(profile['transactions_per_day'])

                for _ in range(num_tx):
                    # Decide if this should be anomalous
                    if random.random() < anomaly_rate:
                        tx = self.generate_anomalous_transaction(profile, current_date)
                    else:
                        tx = self.generate_normal_transaction(profile, current_date)

                    if tx:
                        transactions.append(tx)

            if (i + 1) % 20 == 0:
                print(f"  Generated {i + 1}/{num_users} users...")

        df = pd.DataFrame(transactions)

        # Shuffle
        df = df.sample(frac=1).reset_index(drop=True)

        # Statistics
        total = len(df)
        anomalies = df['is_anomaly'].sum()
        print(f"\nGenerated {total} transactions")
        print(f"Normal: {total - anomalies} ({(total - anomalies) / total * 100:.1f}%)")
        print(f"Anomalous: {anomalies} ({anomalies / total * 100:.1f}%)")

        # Anomaly type distribution
        print("\nAnomaly types:")
        for atype in df[df['is_anomaly'] == 1]['anomaly_type'].value_counts().items():
            print(f"  {atype[0]}: {atype[1]}")

        return df, user_profiles

    def generate_behavior_events(self, user_profile, session_id, is_anomalous=False):
        """
        Generate a sequence of behavior events for a session
        """
        events = []
        base_time = datetime.now()

        # Normal session flow
        normal_flow = [
            ('app_open', 0),
            ('login_attempt', 2),
            ('login_success', 3),
            ('screen_view', 5),  # Dashboard
            ('screen_view', 15),  # Send Money
            ('recipient_select', 25),
            ('amount_enter', 35),
            ('payment_review', 45),
            ('transaction_confirm', 50),
            ('transaction_complete', 55)
        ]

        if is_anomalous:
            # Anomalous flow - rapid clicks, failed logins
            flow = [
                ('app_open', 0),
                ('login_attempt', 0.5),
                ('login_failure', 1),
                ('login_attempt', 1.5),
                ('login_failure', 2),
                ('login_attempt', 2.5),
                ('login_success', 3),
                ('screen_view', 3.5),
                ('screen_view', 4),
                ('recipient_select', 4.5),
                ('amount_enter', 5),
                ('transaction_confirm', 5.5),
                ('transaction_complete', 6)
            ]
        else:
            flow = normal_flow

        for event_type, offset_seconds in flow:
            event_time = base_time + timedelta(seconds=offset_seconds)

            event = {
                'event_id': str(uuid.uuid4()),
                'session_id': session_id,
                'user_id': user_profile['user_id'],
                'event_type': event_type,
                'timestamp': event_time.isoformat(),
                'device_model': user_profile['primary_device'],
                'is_anomalous_session': 1 if is_anomalous else 0
            }

            # Add timing metrics
            if len(events) > 0:
                last_time = datetime.fromisoformat(events[-1]['timestamp'])
                event['time_since_last_event'] = (event_time - last_time).total_seconds() * 1000

            events.append(event)

        return events


def main():
    """
    Generate and save synthetic datasets
    """
    generator = SyntheticDataGenerator(seed=42)

    # Generate transaction dataset
    output_dir = './data'
    os.makedirs(output_dir, exist_ok=True)

    print("=" * 50)
    print("Generating Transaction Dataset")
    print("=" * 50)

    df, profiles = generator.generate_dataset(
        num_users=100,
        days=30,
        anomaly_rate=0.05
    )

    # Save transaction data
    tx_path = os.path.join(output_dir, 'transactions_synthetic.csv')
    df.to_csv(tx_path, index=False)
    print(f"\nSaved transactions to {tx_path}")

    # Save feature columns for model training
    feature_cols = [
        'amount', 'amount_zscore', 'hour_of_day', 'day_of_week', 'is_weekend',
        'is_new_recipient', 'recipient_trust_score', 'device_trust_score',
        'location_trust_score', 'is_unusual_time', 'is_unusual_location',
        'is_unusual_device', 'transaction_velocity_1h', 'transaction_velocity_24h',
        'amount_velocity_24h', 'session_duration', 'actions_before_transaction',
        'time_since_last_transaction', 'failed_auth_count_24h', 'device_age_days'
    ]

    train_df = df[feature_cols + ['is_anomaly']]
    train_path = os.path.join(output_dir, 'training_data.csv')
    train_df.to_csv(train_path, index=False)
    print(f"Saved training data to {train_path}")

    # Generate behavior events
    print("\n" + "=" * 50)
    print("Generating Behavior Events Dataset")
    print("=" * 50)

    all_events = []
    for user_id, profile in list(profiles.items())[:20]:  # 20 users
        for session_num in range(10):  # 10 sessions each
            session_id = f"SESSION_{user_id}_{session_num}"
            is_anomalous = random.random() < 0.1  # 10% anomalous sessions
            events = generator.generate_behavior_events(profile, session_id, is_anomalous)
            all_events.extend(events)

    events_df = pd.DataFrame(all_events)
    events_path = os.path.join(output_dir, 'behavior_events_synthetic.csv')
    events_df.to_csv(events_path, index=False)
    print(f"Saved behavior events to {events_path}")

    # Save user profiles
    profiles_path = os.path.join(output_dir, 'user_profiles.json')
    # Convert to serializable format
    profiles_serializable = {}
    for k, v in profiles.items():
        profiles_serializable[k] = {
            key: val if not isinstance(val, (list, dict)) or isinstance(val, list) else dict(val)
            for key, val in v.items()
        }

    with open(profiles_path, 'w') as f:
        json.dump(profiles_serializable, f, indent=2)
    print(f"Saved user profiles to {profiles_path}")

    print("\n" + "=" * 50)
    print("Data Generation Complete!")
    print("=" * 50)


if __name__ == '__main__':
    main()
