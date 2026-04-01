CREATE DATABASE IF NOT EXISTS kavach_sentinel;
USE kavach_sentinel;

CREATE TABLE IF NOT EXISTS soldiers (
    id VARCHAR(50) PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    rank_title VARCHAR(50) NOT NULL,
    salary DECIMAL(10, 2) NOT NULL,
    unit VARCHAR(100) NOT NULL,
    location VARCHAR(100) NOT NULL,
    is_honeypot BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS transactions (
    id INT AUTO_INCREMENT PRIMARY KEY,
    soldier_id VARCHAR(50) NOT NULL,
    amount DECIMAL(10, 2) NOT NULL,
    transaction_type ENUM('CREDIT', 'DEBIT') NOT NULL,
    description VARCHAR(255),
    transaction_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (soldier_id) REFERENCES soldiers(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS intrusions (
    id INT AUTO_INCREMENT PRIMARY KEY,
    honeypot_id VARCHAR(50) NOT NULL,
    ip_address VARCHAR(45),
    user_agent TEXT,
    access_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    risk_level ENUM('LOW', 'MEDIUM', 'HIGH', 'CRITICAL') DEFAULT 'HIGH',
    behavior_pattern JSON,
    FOREIGN KEY (honeypot_id) REFERENCES soldiers(id) ON DELETE CASCADE
);
