import os
import random
from faker import Faker
import pymysql
from decimal import Decimal

# Initialize Faker
fake = Faker()

# Database configuration
DB_HOST = os.environ.get("DB_HOST", "localhost")
DB_USER = os.environ.get("DB_USER", "root")
DB_PASSWORD = os.environ.get("DB_PASSWORD", "")
DB_NAME = os.environ.get("DB_NAME", "kavach_sentinel")

# Military specifics
RANKS = ["Private", "Corporal", "Sergeant", "Lieutenant", "Captain", "Major", "Colonel"]
UNITS = ["1st Infantry Battalion", "Signal Corps", "Cyber Warfare Division", "Special Forces Group", "Logistics Command"]
HONEYPOT_UNITS = ["Finance Division Alpha", "Special Operations Intel", "Cyber Warfare Division"]
LOCATIONS = ["Base Alpha", "Camp Bravo", "Outpost Charlie", "HQ Delta", "Sector Echo"]

def get_db_connection():
    try:
        connection = pymysql.connect(
            host=DB_HOST,
            user=DB_USER,
            password=DB_PASSWORD,
            database=DB_NAME,
            cursorclass=pymysql.cursors.DictCursor
        )
        return connection
    except Exception as e:
        print(f"Error connecting to database: {e}")
        return None

def generate_soldiers(num_real=50, num_honeypots=5):
    connection = get_db_connection()
    if not connection:
        return []
    
    try:
        with connection.cursor() as cursor:
            soldiers_data = []
            
            # Generate real soldiers
            for _ in range(num_real):
                soldiers_data.append((
                    f"MIL-{fake.random_int(min=10000, max=99999)}",
                    fake.name(),
                    random.choice(RANKS),
                    Decimal(random.uniform(3000.0, 12000.0)).quantize(Decimal('0.00')),
                    random.choice(UNITS),
                    random.choice(LOCATIONS),
                    False
                ))
                
            # Generate honeypots
            for _ in range(num_honeypots):
                soldiers_data.append((
                    f"MIL-{fake.random_int(min=50000, max=99999)}",
                    fake.name(),
                    random.choice(RANKS[3:]), # Higher ranks for honeypots to look attractive
                    Decimal(random.uniform(8000.0, 15000.0)).quantize(Decimal('0.00')),
                    random.choice(HONEYPOT_UNITS),
                    random.choice(LOCATIONS),
                    True
                ))
            
            # Shuffle so honeypots are mixed
            random.shuffle(soldiers_data)
            
            sql = "INSERT INTO soldiers (id, name, rank_title, salary, unit, location, is_honeypot) VALUES (%s, %s, %s, %s, %s, %s, %s)"
            cursor.executemany(sql, soldiers_data)
            
            connection.commit()
            print(f"Successfully inserted {num_real} real soldiers and {num_honeypots} honeypots.")
            
            # Return IDs for transaction generation
            return [s[0] for s in soldiers_data]
            
    finally:
        connection.close()

def generate_transactions(soldier_ids, num_transactions=200):
    connection = get_db_connection()
    if not connection:
        return
        
    try:
        with connection.cursor() as cursor:
            transactions_data = []
            
            for _ in range(num_transactions):
                sid = random.choice(soldier_ids)
                amount = Decimal(random.uniform(10.0, 5000.0)).quantize(Decimal('0.00'))
                t_type = random.choice(['CREDIT', 'DEBIT'])
                desc = fake.sentence(nb_words=4)
                t_date = fake.date_time_between(start_date='-1y', end_date='now')
                
                transactions_data.append((sid, amount, t_type, desc, t_date))
                
            sql = "INSERT INTO transactions (soldier_id, amount, transaction_type, description, transaction_date) VALUES (%s, %s, %s, %s, %s)"
            cursor.executemany(sql, transactions_data)
            connection.commit()
            print(f"Successfully inserted {num_transactions} transactions.")
            
    finally:
        connection.close()

if __name__ == "__main__":
    print("Starting KAVACH SENTINEL Data Generation...")
    print("Ensure you have run the schema.sql in your MySQL database first.")
    soldier_ids = generate_soldiers(num_real=100, num_honeypots=10)
    if soldier_ids:
        generate_transactions(soldier_ids, num_transactions=500)
    print("Generation complete.")
