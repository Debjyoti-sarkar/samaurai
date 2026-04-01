// services/FraudDetectionService.ts
import AsyncStorage from '@react-native-async-storage/async-storage';
import { BASE_URL } from './api';

// Forward declaration for the service instance
let fraudDetectionServiceInstance: FraudDetectionService;

// ============================================================
// 🔥 GEMINI-POWERED FRAUD DETECTION (API)
// ============================================================
export async function analyzeFraud(message: string) {
  try {
    const response = await fetch(`${BASE_URL}/api/fraud/analyze`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message }),
    });

    if (!response.ok) {
      throw new Error("Fraud check failed");
    }

    return await response.json();
  } catch (error) {
    console.log("API fraud check failed, using offline detection:", error);
    // Fallback to offline detection
    const offlineResult = await fraudDetectionServiceInstance.analyzeSMS(message, "unknown");
    return {
      scam: offlineResult.isFraud,
      scam_type: offlineResult.category,
      risk_score: offlineResult.confidence,
      explanation: offlineResult.reasons.join(". "),
    };
  }
}

// ============================================================
// 🔒 OFFLINE FRAUD DETECTION (FALLBACK)
// ============================================================

interface FraudPattern {
  keywords: string[];
  urgencyWords: string[];
  suspiciousPatterns: RegExp[];
  legitimateIndicators: string[];
}

interface ScanResult {
  isFraud: boolean;
  confidence: number;
  reasons: string[];
  category: 'safe' | 'suspicious' | 'fraud';
  recommendations: string[];
}

class FraudDetectionService {
  private fraudPatterns: FraudPattern = {
    keywords: [
      // CRITICAL KEYWORDS (instant fraud)
      'share otp', 'send otp', 'provide otp', 'enter otp', 'give otp',
      'share pin', 'send pin', 'provide pin', 'enter pin',
      'share password', 'send password', 'cvv', 'card details',
      'share cvv', 'enter cvv',
      
      // High risk keywords
      'urgent', 'immediately', 'suspended', 'blocked', 'expire',
      'verify immediately', 'click here', 'confirm now', 'update required',
      'verify account', 'account suspended', 'account blocked',
      
      // Prize/lottery scams
      'congratulations', 'won', 'lottery', 'prize', 'reward', 'claim now',
      'selected winner', 'lucky draw', 'lucky winner', 'claim prize',
      
      // Impersonation
      'income tax', 'tax refund', 'government', 'police', 'court', 'arrest',
      'legal action', 'warrant', 'rbi', 'sebi', 'customs',
      
      // Threats
      'deactivate', 'terminate', 'penalty', 'fine', 'legal notice',
      'criminal case', 'cyber cell', 'fir', 'complaint',
      
      // KYC scams
      'kyc pending', 'kyc expired', 'update kyc', 'reverify kyc',
      'complete kyc', 'kyc verification required', 'kyc failed',
      
      // Shortened URLs (always suspicious)
      'bit.ly', 'tinyurl', 'short.link', 'cutt.ly', 'goo.gl',
      'ow.ly', 't.co'
    ],
    
    urgencyWords: [
      'immediately', 'urgent', 'within 24 hours', 'within 2 hours',
      'today only', 'last chance', 'expiring soon', 'act now', 
      'limited time', 'hurry', 'quick', 'asap', 'right now',
      'instant', 'fast'
    ],
    
    suspiciousPatterns: [
      /\+?\d{10,}/g, // Phone numbers
      /(https?:\/\/[^\s]+)/gi, // URLs
      /₹\s*\d{4,}/g, // Large amounts
      /\b\d{9,18}\b/g, // Account numbers
      /[🔒🎉🎁⚠️🚨💰]/g // Suspicious emojis
    ],
    
    legitimateIndicators: [
      'hdfc', 'icici', 'sbi', 'axis', 'paytm', 'phonepe', 'gpay', 'bhim',
      'debited', 'credited', 'balance', 'available balance',
      'transaction', 'payment received', 'payment successful',
      'npci', 'upi', 'imps', 'neft', 'rtgs'
    ]
  };

  async analyzeSMS(message: string, sender: string): Promise<ScanResult> {
    const normalizedMsg = message.toLowerCase();
    const normalizedSender = sender.toLowerCase();
    
    let fraudScore = 0;
    const reasons: string[] = [];
    const recommendations: string[] = [];

    // CRITICAL CHECK: OTP/PIN/PASSWORD requests (instant fraud)
    if (this.requestsCredentials(normalizedMsg)) {
      fraudScore += 80; // MASSIVE penalty
      reasons.push('🚨 CRITICAL: Asks for OTP/PIN/Password - NEVER share these!');
      recommendations.push('Banks NEVER ask for OTP, PIN, CVV, or passwords via SMS');
      recommendations.push('This is 100% a scam - DO NOT respond');
    }

    // Check sender legitimacy
    if (this.isSuspiciousSender(normalizedSender)) {
      fraudScore += 25;
      reasons.push('Suspicious sender ID detected');
    }

    // Keyword analysis (MORE SENSITIVE)
    const keywordMatches = this.fraudPatterns.keywords.filter(keyword => 
      normalizedMsg.includes(keyword.toLowerCase())
    );
    
    if (keywordMatches.length > 0) {
      fraudScore += keywordMatches.length * 20; // Increased from 15 to 20
      reasons.push(`Contains ${keywordMatches.length} fraud-related keywords: ${keywordMatches.slice(0, 3).join(', ')}`);
    }

    // Urgency check (MORE SENSITIVE)
    const urgencyMatches = this.fraudPatterns.urgencyWords.filter(word =>
      normalizedMsg.includes(word.toLowerCase())
    );
    
    if (urgencyMatches.length > 0) {
      fraudScore += urgencyMatches.length * 15; // Increased from 10 to 15
      reasons.push('Uses urgency tactics to pressure action');
    }

    // Pattern matching (MORE SENSITIVE)
    let patternCount = 0;
    for (const pattern of this.fraudPatterns.suspiciousPatterns) {
      const matches = message.match(pattern);
      if (matches) {
        patternCount += matches.length;
      }
    }
    
    if (patternCount > 2) {
      fraudScore += 25; // Increased from 20
      reasons.push(`Contains ${patternCount} suspicious patterns (links/numbers/emojis)`);
    }

    // Link analysis (MORE SENSITIVE)
    const linkCount = (message.match(/https?:\/\//gi) || []).length;
    if (linkCount > 0) {
      fraudScore += linkCount * 20; // Increased from 15
      reasons.push(`Contains ${linkCount} link(s) - verify before clicking`);
      recommendations.push('Never click links in unexpected SMS messages');
    }

    // Check for legitimate indicators (REDUCE SCORE)
    const legitMatches = this.fraudPatterns.legitimateIndicators.filter(indicator =>
      normalizedMsg.includes(indicator.toLowerCase())
    );
    
    if (legitMatches.length > 0) {
      // Only reduce if it's actually a transaction notification
      if (this.isTransactionNotification(normalizedMsg)) {
        fraudScore -= 30; // Reduce more for genuine transactions
        reasons.push('Contains transaction notification keywords');
      } else {
        fraudScore -= 10; // Small reduction for bank names only
      }
    }

    // Sender-message consistency
    if (this.hasInconsistentSender(normalizedSender, normalizedMsg)) {
      fraudScore += 30; // Increased from 25
      reasons.push('Sender name doesn\'t match message content (possible impersonation)');
    }

    // Normalize score
    fraudScore = Math.max(0, Math.min(100, fraudScore));

    // STRICTER CATEGORIZATION
    let category: 'safe' | 'suspicious' | 'fraud';
    let confidence: number;

    if (fraudScore >= 60) { // Lowered from 70
      category = 'fraud';
      confidence = Math.min(95, fraudScore + 10);
      recommendations.push('🚨 DO NOT respond or click any links');
      recommendations.push('Block this sender immediately');
      recommendations.push('Report to cybercrime.gov.in');
      recommendations.push('Delete this message');
    } else if (fraudScore >= 30) { // Lowered from 40
      category = 'suspicious';
      confidence = fraudScore;
      recommendations.push('⚠️ Exercise extreme caution with this message');
      recommendations.push('Verify with official bank channels before taking action');
      recommendations.push('Do not share any personal information');
      recommendations.push('If unsure, ignore and delete');
    } else {
      category = 'safe';
      confidence = 100 - fraudScore;
      if (linkCount > 0 || keywordMatches.length > 0) {
        recommendations.push('Message appears safe, but always verify links before clicking');
      }
    }

    // Store fraud messages
    if (category === 'fraud' || category === 'suspicious') {
      await this.storeFraudMessage(message, sender, fraudScore);
    }

    return {
      isFraud: category === 'fraud',
      confidence,
      reasons,
      category,
      recommendations
    };
  }

  private isSuspiciousSender(sender: string): boolean {
    const suspiciousPatterns = [
      /^[a-z]{2}-[a-z]{6,}$/i, // Random format
      /^\d{5,}$/, // Only numbers
      /^[A-Z]{2}\d{3,}$/, // 2 letters + numbers
      /^[a-z]{6,}$/i, // Random text only
    ];

    return suspiciousPatterns.some(pattern => pattern.test(sender));
  }

  private requestsCredentials(message: string): boolean {
    const credentialPatterns = [
      /share.*otp/i,
      /send.*otp/i,
      /enter.*otp/i,
      /provide.*otp/i,
      /give.*otp/i,
      /otp.*share/i,
      /otp.*send/i,
      /share.*pin/i,
      /enter.*pin/i,
      /send.*pin/i,
      /share.*password/i,
      /enter.*cvv/i,
      /share.*cvv/i,
      /provide.*card.*details/i,
      /card.*number/i,
      /expiry.*date/i
    ];

    return credentialPatterns.some(pattern => pattern.test(message));
  }

  private isTransactionNotification(message: string): boolean {
    const transactionPatterns = [
      /(debited|credited).*₹/i,
      /₹.*\d+.*(debited|credited)/i,
      /(debited|credited).*rs\.?\s*\d+/i,
      /rs\.?\s*\d+.*(debited|credited)/i,
      /balance.*₹/i,
      /avl.*bal/i,
      /payment.*successful/i,
      /transaction.*completed/i,
      /received.*from/i,
      /paid.*to/i
    ];

    return transactionPatterns.some(pattern => pattern.test(message));
  }

  private hasInconsistentSender(sender: string, message: string): boolean {
    const claimedBanks = ['hdfc', 'icici', 'sbi', 'axis', 'kotak', 'pnb', 'bob', 'union bank'];
    const messageClaimsBank = claimedBanks.some(bank => message.includes(bank));
    
    if (messageClaimsBank && !claimedBanks.some(bank => sender.includes(bank))) {
      return true;
    }

    return false;
  }

  private async storeFraudMessage(message: string, sender: string, score: number): Promise<void> {
    try {
      const stored = await AsyncStorage.getItem('fraud_messages');
      const fraudMessages = stored ? JSON.parse(stored) : [];
      
      fraudMessages.push({
        message: message.substring(0, 200),
        sender,
        score,
        timestamp: new Date().toISOString()
      });

      if (fraudMessages.length > 100) {
        fraudMessages.shift();
      }

      await AsyncStorage.setItem('fraud_messages', JSON.stringify(fraudMessages));
    } catch (error) {
      console.error('Error storing fraud message:', error);
    }
  }

  async getFraudStatistics(): Promise<{
    totalScanned: number;
    fraudDetected: number;
    suspiciousDetected: number;
    lastScan: string | null;
  }> {
    try {
      const stats = await AsyncStorage.getItem('fraud_stats');
      return stats ? JSON.parse(stats) : {
        totalScanned: 0,
        fraudDetected: 0,
        suspiciousDetected: 0,
        lastScan: null
      };
    } catch {
      return {
        totalScanned: 0,
        fraudDetected: 0,
        suspiciousDetected: 0,
        lastScan: null
      };
    }
  }

  async updateStatistics(category: 'safe' | 'suspicious' | 'fraud'): Promise<void> {
    try {
      const stats = await this.getFraudStatistics();
      stats.totalScanned += 1;
      
      if (category === 'fraud') stats.fraudDetected += 1;
      if (category === 'suspicious') stats.suspiciousDetected += 1;
      
      stats.lastScan = new Date().toISOString();
      
      await AsyncStorage.setItem('fraud_stats', JSON.stringify(stats));
    } catch (error) {
      console.error('Error updating statistics:', error);
    }
  }
}

// Create the singleton instance
const fraudDetectionService = new FraudDetectionService();

// Assign to the forward-declared variable for use in analyzeFraud
fraudDetectionServiceInstance = fraudDetectionService;

export default fraudDetectionService;
export type { ScanResult };