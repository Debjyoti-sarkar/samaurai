"""
SMS Fraud Detection Model
Uses NLP and pattern matching to detect fraudulent SMS messages
"""

import re
import json
import os
from datetime import datetime
from typing import Dict, List, Tuple, Optional
import numpy as np

# Optional ML imports
try:
    from sklearn.feature_extraction.text import TfidfVectorizer
    from sklearn.naive_bayes import MultinomialNB
    from sklearn.ensemble import RandomForestClassifier
    from sklearn.model_selection import train_test_split
    from sklearn.metrics import classification_report
    import joblib
    HAS_SKLEARN = True
except ImportError:
    HAS_SKLEARN = False
    print("scikit-learn not available. Using rule-based detection only.")


class SMSFraudDetector:
    """
    Hybrid SMS fraud detection using:
    1. Pattern matching (regex-based)
    2. Keyword analysis
    3. URL analysis
    4. ML classification (if sklearn available)
    """

    def __init__(self, model_dir='./models'):
        self.model_dir = model_dir
        os.makedirs(model_dir, exist_ok=True)

        # ML components
        self.vectorizer = None
        self.classifier = None
        self.is_trained = False

        # Fraud patterns (regex)
        self.fraud_patterns = self._load_fraud_patterns()

        # Suspicious keywords by category
        self.suspicious_keywords = self._load_suspicious_keywords()

        # Trusted sender patterns
        self.trusted_senders = self._load_trusted_senders()

        # Load trained model if exists
        self._load_model()

    def _load_fraud_patterns(self) -> Dict[str, List[Dict]]:
        """Load regex patterns for fraud detection"""
        return {
            'urgency': [
                {'pattern': r'\b(urgent|immediately|right now|asap|expires? today|last chance|act now|hurry)\b', 'weight': 0.3},
                {'pattern': r'\b(within \d+ (hours?|minutes?|days?))\b', 'weight': 0.2},
                {'pattern': r'\b(limited time|offer ends|deadline)\b', 'weight': 0.25},
            ],
            'account_threat': [
                {'pattern': r'\b(account.*(blocked|suspended|locked|closed|deactivated|compromised))\b', 'weight': 0.5},
                {'pattern': r'\b(verify your (account|identity|details))\b', 'weight': 0.4},
                {'pattern': r'\b(unauthorized (access|transaction|activity))\b', 'weight': 0.5},
                {'pattern': r'\b(security (alert|warning|notice))\b', 'weight': 0.3},
            ],
            'otp_phishing': [
                {'pattern': r'\b(share|send|tell|give).{0,20}(otp|pin|password|cvv)\b', 'weight': 0.8},
                {'pattern': r'\b(otp|pin).{0,20}(share|send|tell|give)\b', 'weight': 0.8},
                {'pattern': r'\b(do not share|never share).{0,30}(otp|pin)\b', 'weight': -0.3},  # Legitimate warning
            ],
            'money_request': [
                {'pattern': r'\b(send|transfer|pay).{0,30}(money|amount|rs\.?|inr|₹)\b', 'weight': 0.3},
                {'pattern': r'\b(won|winner|lottery|prize|reward|cashback|refund)\b', 'weight': 0.5},
                {'pattern': r'\b(claim your|collect your|receive your).{0,20}(prize|reward|money|cashback)\b', 'weight': 0.6},
            ],
            'kyc_fraud': [
                {'pattern': r'\b(kyc|pan|aadhaar|aadhar).{0,30}(update|verify|expire|suspend|link)\b', 'weight': 0.5},
                {'pattern': r'\b(update.{0,20}kyc|kyc.{0,20}update)\b', 'weight': 0.5},
                {'pattern': r'\b(pan.{0,10}link|link.{0,10}pan)\b', 'weight': 0.4},
            ],
            'impersonation': [
                {'pattern': r'\b(rbi|reserve bank|income tax|it department|govt|government)\b', 'weight': 0.3},
                {'pattern': r'\b(sbi|hdfc|icici|axis|kotak|paytm|phonepe|gpay).{0,30}(customer care|support|helpline)\b', 'weight': 0.4},
                {'pattern': r'\b(call|contact).{0,20}(customer care|helpline|support)\b', 'weight': 0.2},
            ],
            'suspicious_links': [
                {'pattern': r'(bit\.ly|tinyurl|goo\.gl|t\.co|shorturl|cutt\.ly)', 'weight': 0.4},
                {'pattern': r'(click here|click below|click now|tap here|open link)', 'weight': 0.3},
                {'pattern': r'https?://[^\s]+\.(xyz|tk|ml|ga|cf|pw|top|club|online|site|website)', 'weight': 0.5},
            ],
            'job_scam': [
                {'pattern': r'\b(work from home|wfh|part.?time job|earn.{0,20}daily|earn.{0,20}weekly)\b', 'weight': 0.4},
                {'pattern': r'\b(earn.{0,10}(₹|rs\.?|inr).{0,10}\d+.{0,10}(daily|weekly|monthly))\b', 'weight': 0.5},
                {'pattern': r'\b(no investment|zero investment|free registration)\b', 'weight': 0.3},
            ],
            'loan_fraud': [
                {'pattern': r'\b(instant loan|easy loan|quick loan|personal loan approved)\b', 'weight': 0.4},
                {'pattern': r'\b(loan.{0,20}(approved|sanctioned|disbursed))\b', 'weight': 0.3},
                {'pattern': r'\b(low interest|0%.{0,10}interest|no.{0,10}interest)\b', 'weight': 0.3},
            ],
        }

    def _load_suspicious_keywords(self) -> Dict[str, List[Tuple[str, float]]]:
        """Load suspicious keywords with weights"""
        return {
            'high_risk': [
                ('otp', 0.3), ('pin', 0.3), ('cvv', 0.5), ('password', 0.4),
                ('blocked', 0.4), ('suspended', 0.4), ('expired', 0.3),
                ('urgent', 0.3), ('immediately', 0.3), ('verify', 0.2),
                ('lottery', 0.6), ('winner', 0.5), ('prize', 0.4),
                ('cashback', 0.2), ('refund', 0.2),
            ],
            'medium_risk': [
                ('click', 0.15), ('link', 0.1), ('update', 0.15),
                ('confirm', 0.1), ('account', 0.1), ('bank', 0.1),
                ('credit', 0.1), ('debit', 0.1), ('transfer', 0.1),
                ('payment', 0.1), ('transaction', 0.1),
            ],
            'low_risk': [
                ('free', 0.05), ('offer', 0.05), ('discount', 0.05),
                ('deal', 0.05), ('sale', 0.05), ('limited', 0.05),
            ],
            'negative_indicators': [
                ('do not share', -0.3), ('never share', -0.3),
                ('bank never asks', -0.4), ('official', -0.1),
                ('genuine', -0.1), ('verified', -0.05),
            ],
        }

    def _load_trusted_senders(self) -> List[str]:
        """Load list of trusted sender IDs"""
        return [
            'SBIINB', 'SBIPSG', 'HDFCBK', 'ICICIB', 'AXISBK', 'KOTAKB',
            'PAYTMB', 'PHONPE', 'GPAYIN', 'AMAZIN', 'FLIPKT', 'ZOMATO',
            'SWIGGY', 'OLACAB', 'UBERIN', 'AIRTEL', 'ABORIG', 'JIOMNY',
            'IRCTCW', 'GOVTIN', 'UIDAIH',
        ]

    def analyze_sms(self, message: str, sender: Optional[str] = None) -> Dict:
        """
        Analyze SMS message for fraud indicators

        Returns:
            Dict with fraud analysis results
        """
        message_lower = message.lower()
        results = {
            'is_fraud': False,
            'fraud_score': 0.0,
            'risk_level': 'safe',
            'categories': [],
            'risk_factors': [],
            'urls_found': [],
            'phone_numbers_found': [],
            'otp_detected': False,
            'amount_mentioned': None,
            'sender_trusted': False,
            'ml_score': None,
            'recommendation': '',
            'timestamp': datetime.now().isoformat()
        }

        # Check trusted sender
        if sender:
            sender_upper = sender.upper()
            results['sender_trusted'] = any(
                trusted in sender_upper for trusted in self.trusted_senders
            )

        # Extract URLs
        urls = re.findall(r'https?://[^\s]+', message)
        results['urls_found'] = urls

        # Extract phone numbers
        phone_numbers = re.findall(r'[\+]?[(]?[0-9]{1,3}[)]?[-\s\.]?[(]?[0-9]{1,4}[)]?[-\s\.]?[0-9]{1,4}[-\s\.]?[0-9]{1,9}', message)
        results['phone_numbers_found'] = [p for p in phone_numbers if len(re.sub(r'\D', '', p)) >= 10]

        # Detect OTP in message
        otp_match = re.search(r'\b(\d{4,8})\b.{0,30}(otp|code|pin)|otp.{0,10}(\d{4,8})', message_lower)
        results['otp_detected'] = otp_match is not None

        # Extract amount mentioned
        amount_match = re.search(r'(?:rs\.?|₹|inr)\s*(\d+(?:,\d+)*(?:\.\d{2})?)', message_lower)
        if amount_match:
            results['amount_mentioned'] = amount_match.group(1).replace(',', '')

        # Pattern-based analysis
        total_pattern_score = 0.0
        for category, patterns in self.fraud_patterns.items():
            category_score = 0.0
            for pattern_info in patterns:
                matches = re.findall(pattern_info['pattern'], message_lower, re.IGNORECASE)
                if matches:
                    weight = pattern_info['weight']
                    category_score += weight * len(matches)
                    if weight > 0:
                        results['risk_factors'].append({
                            'category': category,
                            'pattern': pattern_info['pattern'],
                            'matches': matches,
                            'weight': weight
                        })

            if category_score > 0:
                results['categories'].append({
                    'name': category,
                    'score': min(category_score, 1.0)
                })
                total_pattern_score += category_score

        # Keyword-based analysis
        keyword_score = 0.0
        for risk_level, keywords in self.suspicious_keywords.items():
            for keyword, weight in keywords:
                if keyword in message_lower:
                    keyword_score += weight
                    if weight > 0.1:
                        results['risk_factors'].append({
                            'category': 'keyword',
                            'keyword': keyword,
                            'risk_level': risk_level,
                            'weight': weight
                        })

        # URL risk analysis
        url_score = 0.0
        for url in urls:
            url_risk = self._analyze_url(url)
            url_score += url_risk['score']
            if url_risk['score'] > 0.2:
                results['risk_factors'].append({
                    'category': 'suspicious_url',
                    'url': url,
                    'reasons': url_risk['reasons'],
                    'weight': url_risk['score']
                })

        # ML-based analysis (if available)
        if self.is_trained and HAS_SKLEARN:
            ml_result = self._ml_predict(message)
            results['ml_score'] = ml_result['probability']
            if ml_result['is_fraud']:
                total_pattern_score += ml_result['probability'] * 0.5

        # Calculate final fraud score
        base_score = total_pattern_score + keyword_score + url_score

        # Adjust for trusted sender
        if results['sender_trusted']:
            base_score *= 0.5

        # Adjust for OTP presence with sharing request
        if results['otp_detected']:
            sharing_patterns = re.findall(r'(share|send|tell|give|forward)', message_lower)
            if sharing_patterns:
                base_score += 0.5

        # Normalize score to 0-100
        results['fraud_score'] = min(100, max(0, base_score * 50))

        # Determine risk level
        if results['fraud_score'] >= 70:
            results['risk_level'] = 'critical'
            results['is_fraud'] = True
        elif results['fraud_score'] >= 50:
            results['risk_level'] = 'high'
            results['is_fraud'] = True
        elif results['fraud_score'] >= 30:
            results['risk_level'] = 'medium'
        elif results['fraud_score'] >= 15:
            results['risk_level'] = 'low'
        else:
            results['risk_level'] = 'safe'

        # Generate recommendation
        results['recommendation'] = self._get_recommendation(results)

        return results

    def _analyze_url(self, url: str) -> Dict:
        """Analyze URL for suspicious patterns"""
        reasons = []
        score = 0.0

        url_lower = url.lower()

        # Check for URL shorteners
        shorteners = ['bit.ly', 'tinyurl', 'goo.gl', 't.co', 'cutt.ly', 'shorturl', 'rb.gy']
        if any(s in url_lower for s in shorteners):
            reasons.append('URL shortener detected')
            score += 0.3

        # Check for suspicious TLDs
        suspicious_tlds = ['.xyz', '.tk', '.ml', '.ga', '.cf', '.pw', '.top', '.club', '.online', '.site', '.work', '.click']
        if any(url_lower.endswith(tld) or f'{tld}/' in url_lower for tld in suspicious_tlds):
            reasons.append('Suspicious domain extension')
            score += 0.4

        # Check for IP address instead of domain
        if re.search(r'https?://\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}', url):
            reasons.append('IP address instead of domain')
            score += 0.5

        # Check for lookalike domains
        bank_names = ['sbi', 'hdfc', 'icici', 'axis', 'kotak', 'paytm', 'phonepe', 'gpay']
        for bank in bank_names:
            if bank in url_lower and not any(legitimate in url_lower for legitimate in [f'{bank}.co.in', f'{bank}bank.com', f'{bank}.com']):
                if re.search(rf'{bank}[^a-z]|[^a-z]{bank}', url_lower):
                    reasons.append(f'Possible {bank.upper()} lookalike domain')
                    score += 0.4

        # Check for excessive subdomains
        subdomain_count = url_lower.replace('https://', '').replace('http://', '').split('/')[0].count('.')
        if subdomain_count > 3:
            reasons.append('Excessive subdomains')
            score += 0.2

        # Check for suspicious paths
        suspicious_paths = ['/verify', '/update', '/secure', '/login', '/account', '/kyc', '/confirm']
        if any(path in url_lower for path in suspicious_paths):
            reasons.append('Suspicious URL path')
            score += 0.15

        return {'score': score, 'reasons': reasons}

    def _get_recommendation(self, results: Dict) -> str:
        """Generate user-friendly recommendation"""
        if results['risk_level'] == 'critical':
            return "DANGER: This message appears to be a scam. Do NOT click any links, share OTP, or call any numbers. Delete this message immediately."
        elif results['risk_level'] == 'high':
            return "WARNING: This message shows multiple fraud indicators. Do not share any personal information. Verify directly with your bank if needed."
        elif results['risk_level'] == 'medium':
            return "CAUTION: This message contains some suspicious elements. Be careful and verify the sender before taking any action."
        elif results['risk_level'] == 'low':
            return "This message has minor suspicious elements. Exercise normal caution."
        else:
            return "This message appears to be safe, but always verify before sharing sensitive information."

    def _ml_predict(self, message: str) -> Dict:
        """Make ML prediction"""
        if not self.is_trained or not HAS_SKLEARN:
            return {'is_fraud': False, 'probability': 0.0}

        try:
            features = self.vectorizer.transform([message.lower()])
            prediction = self.classifier.predict(features)[0]
            probability = self.classifier.predict_proba(features)[0]

            return {
                'is_fraud': bool(prediction),
                'probability': float(max(probability))
            }
        except Exception as e:
            print(f"ML prediction error: {e}")
            return {'is_fraud': False, 'probability': 0.0}

    def train(self, messages: List[str], labels: List[int], test_size: float = 0.2):
        """
        Train ML model on labeled SMS data

        Args:
            messages: List of SMS messages
            labels: List of labels (1 = fraud, 0 = legitimate)
            test_size: Fraction for test split
        """
        if not HAS_SKLEARN:
            print("scikit-learn not available for training")
            return

        print(f"Training on {len(messages)} messages...")

        # Preprocess messages
        processed_messages = [self._preprocess(m) for m in messages]

        # Split data
        X_train, X_test, y_train, y_test = train_test_split(
            processed_messages, labels, test_size=test_size, random_state=42
        )

        # Vectorize
        self.vectorizer = TfidfVectorizer(
            max_features=5000,
            ngram_range=(1, 3),
            stop_words='english',
            min_df=2
        )
        X_train_vec = self.vectorizer.fit_transform(X_train)
        X_test_vec = self.vectorizer.transform(X_test)

        # Train classifier
        self.classifier = RandomForestClassifier(
            n_estimators=100,
            max_depth=20,
            random_state=42,
            n_jobs=-1
        )
        self.classifier.fit(X_train_vec, y_train)

        # Evaluate
        y_pred = self.classifier.predict(X_test_vec)
        print("\nClassification Report:")
        print(classification_report(y_test, y_pred, target_names=['Legitimate', 'Fraud']))

        # Save model
        self._save_model()
        self.is_trained = True

    def _preprocess(self, text: str) -> str:
        """Preprocess text for ML"""
        text = text.lower()
        text = re.sub(r'https?://\S+', ' URL ', text)
        text = re.sub(r'\d{4,}', ' NUMBER ', text)
        text = re.sub(r'[^\w\s]', ' ', text)
        text = re.sub(r'\s+', ' ', text)
        return text.strip()

    def _save_model(self):
        """Save trained model"""
        if not HAS_SKLEARN or not self.is_trained:
            return

        joblib.dump(self.vectorizer, os.path.join(self.model_dir, 'sms_vectorizer.joblib'))
        joblib.dump(self.classifier, os.path.join(self.model_dir, 'sms_classifier.joblib'))
        print(f"Model saved to {self.model_dir}")

    def _load_model(self):
        """Load trained model"""
        if not HAS_SKLEARN:
            return

        try:
            vec_path = os.path.join(self.model_dir, 'sms_vectorizer.joblib')
            clf_path = os.path.join(self.model_dir, 'sms_classifier.joblib')

            if os.path.exists(vec_path) and os.path.exists(clf_path):
                self.vectorizer = joblib.load(vec_path)
                self.classifier = joblib.load(clf_path)
                self.is_trained = True
                print("SMS fraud model loaded successfully")
        except Exception as e:
            print(f"Error loading model: {e}")


class SMSTrainingDataGenerator:
    """Generate synthetic SMS training data"""

    def __init__(self):
        self.fraud_templates = self._load_fraud_templates()
        self.legitimate_templates = self._load_legitimate_templates()

    def _load_fraud_templates(self) -> List[str]:
        """Fraud SMS templates"""
        return [
            "URGENT: Your {bank} account has been blocked. Click {url} to verify immediately or account will be closed.",
            "Congratulations! You've won ₹{amount} in {lottery}. Click {url} to claim your prize. Share OTP {otp} to verify.",
            "Dear Customer, Your KYC is expired. Update now at {url} or your account will be suspended within 24 hours.",
            "ALERT: Unauthorized transaction of ₹{amount} from your account. If not you, call {phone} immediately with OTP {otp}.",
            "Your {bank} credit card is blocked. Call customer care {phone} and share OTP {otp} to unblock.",
            "{bank} Notice: Your PAN card is not linked. Link now at {url} to avoid account freeze.",
            "Earn ₹{amount} daily from home! No investment required. Join now: {url}",
            "Instant personal loan approved for ₹{amount}! 0% interest for 3 months. Apply: {url}",
            "Your {bank} account credited with cashback of ₹{amount}. Claim now: {url} using OTP {otp}",
            "IRCTC Refund: ₹{amount} pending. Click {url} and enter OTP to receive refund.",
            "RBI Alert: Your bank account will be frozen. Update Aadhaar at {url} within 2 hours.",
            "Dear {bank} user, suspicious login detected. Verify at {url} or account will be deactivated.",
            "You have received ₹{amount} on {upi}. Share your PIN to complete transaction.",
            "Income Tax Refund of ₹{amount} approved! Enter bank details at {url} to receive.",
            "Your {card} card has won ₹{amount}! Call {phone} now to claim. Share last 4 digits and CVV.",
        ]

    def _load_legitimate_templates(self) -> List[str]:
        """Legitimate SMS templates"""
        return [
            "Your {bank} A/c XX{digits} debited for Rs.{amount} on {date}. Avl Bal: Rs.{balance}. Not you? Call 1800XXXXXX",
            "OTP for {bank} transaction is {otp}. Valid for 10 mins. Do NOT share with anyone. Bank never asks for OTP.",
            "{bank}: UPI txn of Rs.{amount} successful. Ref: {ref}. Available balance: Rs.{balance}",
            "Your {service} order #{order} has been shipped. Track at {url}",
            "Dear Customer, your {bank} statement for {month} is ready. View in app or visit branch.",
            "EMI of Rs.{amount} debited from A/c XX{digits} for {loan}. Balance EMIs: {count}",
            "{bank} Alert: Credit card payment of Rs.{amount} received. Thank you!",
            "Your {bank} Fixed Deposit of Rs.{amount} has matured. Visit branch to renew.",
            "Reminder: {bank} credit card bill of Rs.{amount} is due on {date}. Pay to avoid late fee.",
            "{cab}: Your ride is arriving in {mins} mins. {driver} - {vehicle}",
            "{food}: Order confirmed! {restaurant} is preparing your food. Track in app.",
            "Welcome to {bank}! Your savings account XX{digits} is now active.",
            "{bank}: Your ATM card ending {digits} has been dispatched. Delivery in 7 days.",
            "Transaction Alert: Rs.{amount} credited to your {bank} account. Ref: {ref}",
            "Your {bank} account balance as on {date}: Rs.{balance}. Thank you for banking with us.",
        ]

    def generate_dataset(self, num_samples: int = 2000) -> Tuple[List[str], List[int]]:
        """Generate balanced dataset"""
        import random

        messages = []
        labels = []

        # Generate fraud messages
        fraud_count = num_samples // 2
        for _ in range(fraud_count):
            template = random.choice(self.fraud_templates)
            message = self._fill_template(template, is_fraud=True)
            messages.append(message)
            labels.append(1)

        # Generate legitimate messages
        legit_count = num_samples - fraud_count
        for _ in range(legit_count):
            template = random.choice(self.legitimate_templates)
            message = self._fill_template(template, is_fraud=False)
            messages.append(message)
            labels.append(0)

        # Shuffle
        combined = list(zip(messages, labels))
        random.shuffle(combined)
        messages, labels = zip(*combined)

        return list(messages), list(labels)

    def _fill_template(self, template: str, is_fraud: bool) -> str:
        """Fill template with random values"""
        import random

        banks = ['SBI', 'HDFC', 'ICICI', 'Axis', 'Kotak', 'PNB', 'BOB', 'Canara']
        services = ['Amazon', 'Flipkart', 'Myntra', 'Swiggy', 'Zomato']
        cards = ['VISA', 'MasterCard', 'RuPay', 'AMEX']
        lotteries = ['Amazon Lucky Draw', 'Flipkart Spin & Win', 'Diwali Bumper', 'New Year Jackpot']
        cabs = ['Ola', 'Uber', 'Rapido']
        food = ['Swiggy', 'Zomato']
        restaurants = ['Dominos', 'Pizza Hut', 'McDonalds', 'KFC']
        months = ['January', 'February', 'March', 'April', 'May', 'June']
        loans = ['Home Loan', 'Car Loan', 'Personal Loan', 'Education Loan']
        upis = ['PhonePe', 'GPay', 'Paytm', 'BHIM']

        replacements = {
            '{bank}': random.choice(banks),
            '{amount}': str(random.randint(100, 500000)),
            '{otp}': str(random.randint(1000, 9999)),
            '{url}': f"{'http' if is_fraud else 'https'}://{'bit.ly/' + ''.join(random.choices('abcdefghijklmnopqrstuvwxyz', k=6)) if is_fraud else random.choice(banks).lower() + '.co.in/statement'}",
            '{phone}': f"+91{''.join([str(random.randint(0, 9)) for _ in range(10)])}",
            '{digits}': str(random.randint(1000, 9999)),
            '{date}': f"{random.randint(1, 28)}/{random.randint(1, 12)}/2024",
            '{balance}': str(random.randint(1000, 1000000)),
            '{ref}': ''.join(random.choices('ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789', k=12)),
            '{service}': random.choice(services),
            '{order}': ''.join(random.choices('0123456789', k=10)),
            '{month}': random.choice(months),
            '{count}': str(random.randint(1, 60)),
            '{card}': random.choice(cards),
            '{lottery}': random.choice(lotteries),
            '{loan}': random.choice(loans),
            '{cab}': random.choice(cabs),
            '{food}': random.choice(food),
            '{restaurant}': random.choice(restaurants),
            '{mins}': str(random.randint(2, 15)),
            '{driver}': random.choice(['Raju', 'Kumar', 'Singh', 'Sharma', 'Patel']),
            '{vehicle}': f"DL{random.randint(1, 9)}C{random.randint(1000, 9999)}",
            '{upi}': random.choice(upis),
        }

        result = template
        for placeholder, value in replacements.items():
            result = result.replace(placeholder, value)

        return result


def main():
    """Test SMS fraud detection"""
    detector = SMSFraudDetector()

    # Test messages
    test_messages = [
        ("Your SBI account has been blocked. Click bit.ly/sbi-verify to unblock immediately.", "VK-SCAM"),
        ("Congratulations! You won ₹50,00,000 in Amazon Lucky Draw. Share OTP 1234 to claim.", "AMZNWD"),
        ("Your HDFC A/c XX1234 debited for Rs.5000 on 15/12/24. Avl Bal: Rs.25000. Not you? Call 18002026161", "HDFCBK"),
        ("OTP for ICICI transaction is 456789. Valid for 10 mins. Do NOT share with anyone.", "ICICIB"),
        ("URGENT: Your KYC expired. Update at http://192.168.1.1/kyc to avoid account suspension.", "KYCUPD"),
        ("Dear Customer, call 9876543210 and share OTP to unblock your credit card.", "UNKNOWN"),
        ("Earn ₹5000 daily working from home! No investment. Join: cutt.ly/earnmoney", "JOBSCM"),
    ]

    print("=" * 70)
    print("SMS FRAUD DETECTION TEST")
    print("=" * 70)

    for message, sender in test_messages:
        print(f"\nSender: {sender}")
        print(f"Message: {message[:80]}...")

        result = detector.analyze_sms(message, sender)

        print(f"\nFraud Score: {result['fraud_score']:.1f}/100")
        print(f"Risk Level: {result['risk_level'].upper()}")
        print(f"Is Fraud: {'YES' if result['is_fraud'] else 'NO'}")
        print(f"Sender Trusted: {'YES' if result['sender_trusted'] else 'NO'}")

        if result['risk_factors']:
            print(f"Risk Factors ({len(result['risk_factors'])}):")
            for factor in result['risk_factors'][:3]:
                print(f"  - {factor.get('category', 'unknown')}: {factor.get('keyword', factor.get('pattern', ''))[:40]}")

        print(f"Recommendation: {result['recommendation'][:80]}...")
        print("-" * 70)


if __name__ == '__main__':
    main()
