const QRCode = require("qrcode");

/**
 * QR Code Service
 * Generates and validates UPI QR codes
 */

async function generateUPIQRCode(upiData) {
  try {
    const { upiId, name, amount, transactionNote } = upiData;
    
    // UPI URI format
    let upiString = `upi://pay?pa=${upiId}&pn=${encodeURIComponent(name)}`;
    
    if (amount) {
      upiString += `&am=${amount}`;
    }
    
    if (transactionNote) {
      upiString += `&tn=${encodeURIComponent(transactionNote)}`;
    }
    
    upiString += `&cu=INR`;
    
    // Generate QR code as base64
    const qrCodeDataURL = await QRCode.toDataURL(upiString, {
      errorCorrectionLevel: "H",
      type: "image/png",
      width: 300,
      margin: 1,
    });
    
    return {
      success: true,
      qrCode: qrCodeDataURL,
      upiString: upiString,
    };
  } catch (error) {
    console.error("QR Code Generation Error:", error);
    return {
      success: false,
      error: error.message,
    };
  }
}

async function generatePaymentQRCode(paymentData) {
  try {
    const { recipientUPI, recipientName, amount, note, merchantId } = paymentData;
    
    let qrData = {
      type: "UPI_PAYMENT",
      upiId: recipientUPI,
      name: recipientName,
      amount: amount,
      note: note,
      timestamp: new Date().toISOString(),
    };
    
    if (merchantId) {
      qrData.merchantId = merchantId;
    }
    
    const qrCodeDataURL = await QRCode.toDataURL(JSON.stringify(qrData), {
      errorCorrectionLevel: "H",
      type: "image/png",
      width: 350,
      margin: 2,
    });
    
    return {
      success: true,
      qrCode: qrCodeDataURL,
      qrData: qrData,
    };
  } catch (error) {
    console.error("Payment QR Generation Error:", error);
    return {
      success: false,
      error: error.message,
    };
  }
}

function parseUPIString(upiString) {
  try {
    const url = new URL(upiString);
    
    if (!url.protocol.startsWith("upi")) {
      return { success: false, error: "Invalid UPI string" };
    }
    
    const params = new URLSearchParams(url.search);
    
    return {
      success: true,
      data: {
        upiId: params.get("pa"),
        name: params.get("pn"),
        amount: params.get("am"),
        transactionNote: params.get("tn"),
        currency: params.get("cu") || "INR",
      },
    };
  } catch (error) {
    return {
      success: false,
      error: "Failed to parse UPI string",
    };
  }
}

function validateUPIId(upiId) {
  // UPI ID format: username@bankcode
  const upiRegex = /^[\w.-]+@[\w.-]+$/;
  return upiRegex.test(upiId);
}

module.exports = {
  generateUPIQRCode,
  generatePaymentQRCode,
  parseUPIString,
  validateUPIId,
};
