// services/SMSReaderService.ts
import { Platform, PermissionsAndroid, Alert } from 'react-native';

export interface SMSMessage {
  id: string;
  address: string;
  body: string;
  date: number;
  read: number;
}

// FEATURE FLAG: Toggle between mock and real SMS
// Set to false for Expo Go (mock mode)
// Set to true for production build (real SMS)
const USE_REAL_SMS = false; // Change to true after production build

class SMSReaderService {
  private SmsAndroid: any = null;
  private useMockMode: boolean = !USE_REAL_SMS;

  constructor() {
    if (Platform.OS === 'android' && USE_REAL_SMS) {
      try {
        this.SmsAndroid = require('react-native-get-sms-android');
        console.log('✅ SMS module loaded - REAL mode');
        this.useMockMode = false;
      } catch (error) {
        console.warn('⚠️ SMS module failed, falling back to mock mode');
        this.useMockMode = true;
      }
    } else {
      console.log('📱 Using MOCK mode for development');
      this.useMockMode = true;
    }
  }

  async requestPermissions(): Promise<boolean> {
    if (this.useMockMode) {
      console.log('🔧 Mock mode: Auto-granting permissions');
      // Simulate permission request for UX
      await new Promise(resolve => setTimeout(resolve, 500));
      return true;
    }

    if (Platform.OS !== 'android') {
      return false;
    }

    try {
      console.log('📱 Requesting real SMS permissions...');
      
      const granted = await PermissionsAndroid.requestMultiple([
        PermissionsAndroid.PERMISSIONS.READ_SMS,
        PermissionsAndroid.PERMISSIONS.RECEIVE_SMS,
      ]);

      const readGranted = granted['android.permission.READ_SMS'] === PermissionsAndroid.RESULTS.GRANTED;
      const receiveGranted = granted['android.permission.RECEIVE_SMS'] === PermissionsAndroid.RESULTS.GRANTED;

      console.log('READ_SMS:', readGranted, 'RECEIVE_SMS:', receiveGranted);

      return readGranted && receiveGranted;
    } catch (err) {
      console.error('Permission request error:', err);
      return false;
    }
  }

  async getRecentSMS(count: number = 50): Promise<SMSMessage[]> {
    // MOCK MODE: Return sample messages
    if (this.useMockMode) {
      console.log('🎭 Returning mock SMS messages for demo');
      await new Promise(resolve => setTimeout(resolve, 1500)); // Simulate loading
      return this.getMockSMSMessages();
    }

    // REAL MODE: Read actual SMS
    if (!this.SmsAndroid) {
      Alert.alert('Error', 'SMS module not available. Please use a production build.');
      return [];
    }

    try {
      console.log('📱 Reading real SMS messages...');
      
      return new Promise((resolve, reject) => {
        const filter = {
          box: 'inbox',
          indexFrom: 0,
          maxCount: count,
        };

        this.SmsAndroid.list(
          JSON.stringify(filter),
          (fail: string) => {
            console.error('❌ Failed to read SMS:', fail);
            Alert.alert('Error', `Failed to read SMS: ${fail}`);
            reject(new Error(fail));
          },
          (count: number, smsList: string) => {
            try {
              console.log(`✅ Found ${count} SMS messages`);
              
              const messages: SMSMessage[] = JSON.parse(smsList);
              
              const relevantMessages = messages.filter(msg => 
                this.isBankingRelated(msg.body)
              );
              
              console.log(`📊 Filtered to ${relevantMessages.length} banking messages`);
              
              resolve(relevantMessages);
            } catch (error) {
              console.error('❌ Error parsing SMS:', error);
              reject(error);
            }
          }
        );
      });
    } catch (error) {
      console.error('❌ Error reading SMS:', error);
      Alert.alert('Error', 'Failed to read SMS messages');
      return [];
    }
  }

  // MOCK DATA - 8 realistic test messages
  private getMockSMSMessages(): SMSMessage[] {
    const now = Date.now();
    
    return [
      // FRAUD MESSAGE 1
      {
        id: '1',
        address: 'AD-SCAM',
        body: 'URGENT! Your HDFC Bank account will be blocked within 24 hours. Share OTP immediately: http://bit.ly/verify123 or face legal action.',
        date: now - 3600000, // 1 hour ago
        read: 0
      },
      
      // FRAUD MESSAGE 2
      {
        id: '2',
        address: 'LOTTERY',
        body: 'Dear customer, your KYC has expired. Update immediately at http://bit.ly/kyc-update or your account will be suspended. Share OTP: 456789',
        date: now - 7200000, // 2 hours ago
        read: 0
      },
      
      // FRAUD MESSAGE 3
      {
        id: '3',
        address: 'REWARD',
        body: 'You have won iPhone 15 Pro worth Rs 150000! Click here to claim: http://bit.ly/prize123. Enter your card details to verify.',
        date: now - 10800000, // 3 hours ago
        read: 0
      },
      
      // SUSPICIOUS MESSAGE 1
      {
        id: '4',
        address: '9876543210',
        body: 'Congratulations! You are selected as lucky winner of Rs. 100000 lottery. Call now to claim your prize. Limited time offer!',
        date: now - 14400000, // 4 hours ago
        read: 0
      },
      
      // SUSPICIOUS MESSAGE 2
      {
        id: '5',
        address: 'VK-OFFER',
        body: 'Your account has won cashback of Rs 5000. Click link to claim within 2 hours: http://short.link/claim',
        date: now - 18000000, // 5 hours ago
        read: 0
      },
      
      // SAFE MESSAGE 1
      {
        id: '6',
        address: 'VM-HDFC',
        body: 'Rs. 500.00 debited from A/c XX1234 on 03-Dec-24 via UPI/GooglePay. Avl Bal: Rs. 12500.00 -HDFC Bank',
        date: now - 21600000, // 6 hours ago
        read: 1
      },
      
      // SAFE MESSAGE 2
      {
        id: '7',
        address: 'AX-ICICI',
        body: 'Rs. 2500.00 credited to A/c XX5678 on 03-Dec-24. Transaction: NEFT from John Doe. Available Balance: Rs. 25000.00 -ICICI Bank',
        date: now - 25200000, // 7 hours ago
        read: 1
      },
      
      // SAFE MESSAGE 3
      {
        id: '8',
        address: 'VM-PAYTM',
        body: 'Payment of Rs. 350 to Swiggy successful via Paytm UPI. Paytm Wallet balance: Rs. 5000. Thank you!',
        date: now - 28800000, // 8 hours ago
        read: 1
      }
    ];
  }

  private isBankingRelated(messageBody: string): boolean {
    const bankingKeywords = [
      'bank', 'upi', 'payment', 'transaction', 'credited', 'debited',
      'account', 'balance', 'otp', 'verify', 'kyc', 'card', 'atm',
      'neft', 'imps', 'rtgs', 'paytm', 'phonepe', 'gpay', 'bhim',
      'wallet', 'transfer', '₹', 'rs.', 'rs', 'inr', 'rupees',
      'loan', 'emi', 'credit', 'debit'
    ];

    const lowerBody = messageBody.toLowerCase();
    return bankingKeywords.some(keyword => lowerBody.includes(keyword));
  }

  async scanSingleMessage(message: string, sender: string): Promise<SMSMessage> {
    return {
      id: Date.now().toString(),
      address: sender,
      body: message,
      date: Date.now(),
      read: 1
    };
  }
}

export default new SMSReaderService();