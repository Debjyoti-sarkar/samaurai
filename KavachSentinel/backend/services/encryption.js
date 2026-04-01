const aesjs = require('aes-js');

// 256-bit key from environment or default (32 bytes)
// In production, this must be securely managed!
const keyStr = process.env.AES_KEY || '0123456789abcdef0123456789abcdef';
const key = aesjs.utils.utf8.toBytes(keyStr);

function encryptPayload(dataObj) {
    const text = JSON.stringify(dataObj);
    const textBytes = aesjs.utils.utf8.toBytes(text);

    // Using CTR mode
    const aesCtr = new aesjs.ModeOfOperation.ctr(key, new aesjs.Counter(5));
    const encryptedBytes = aesCtr.encrypt(textBytes);

    // To hex string for easy transport
    return aesjs.utils.hex.fromBytes(encryptedBytes);
}

function decryptPayload(hexStr) {
    try {
        const encryptedBytes = aesjs.utils.hex.toBytes(hexStr);

        // Using CTR mode
        const aesCtr = new aesjs.ModeOfOperation.ctr(key, new aesjs.Counter(5));
        const decryptedBytes = aesCtr.decrypt(encryptedBytes);

        const decryptedText = aesjs.utils.utf8.fromBytes(decryptedBytes);
        return JSON.parse(decryptedText);
    } catch (error) {
        console.error("Decryption failed:", error);
        return null;
    }
}

module.exports = {
    encryptPayload,
    decryptPayload
};
