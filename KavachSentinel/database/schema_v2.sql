USE kavach_sentinel;

-- 1. Counterintelligence: Canary Tokens
CREATE TABLE IF NOT EXISTS canary_tokens (
    id VARCHAR(100) PRIMARY KEY,
    document_name VARCHAR(255) NOT NULL,
    honeypot_id VARCHAR(50),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (honeypot_id) REFERENCES soldiers(id) ON DELETE CASCADE
);

-- Active hits on canary tokens
CREATE TABLE IF NOT EXISTS canary_hits (
    id INT AUTO_INCREMENT PRIMARY KEY,
    token_id VARCHAR(100) NOT NULL,
    ip_address VARCHAR(45),
    user_agent TEXT,
    accessed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (token_id) REFERENCES canary_tokens(id) ON DELETE CASCADE
);

-- 2. Steganography: Dead-Drop Messages
CREATE TABLE IF NOT EXISTS dead_drop_messages (
    id INT AUTO_INCREMENT PRIMARY KEY,
    sender_id VARCHAR(50) NOT NULL,
    encoded_transaction_id INT,
    hidden_message TEXT NOT NULL,
    extracted_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 3. Insider Threat: Rapid Access Monitoring
CREATE TABLE IF NOT EXISTS insider_logs (
    id INT AUTO_INCREMENT PRIMARY KEY,
    agency_role VARCHAR(50) NOT NULL,
    user_id VARCHAR(50) NOT NULL,
    records_accessed INT DEFAULT 1,
    access_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    threat_score INT DEFAULT 0
);

-- 4. Behavioral Biometrics: Baseline patterns
CREATE TABLE IF NOT EXISTS biometric_baselines (
    user_id VARCHAR(50) PRIMARY KEY,
    avg_typing_speed_wpm INT,
    mouse_erratic_score DECIMAL(5, 2),
    last_updated TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);
