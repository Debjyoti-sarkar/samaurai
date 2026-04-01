/**
 * Steganography - Dead Drop Module
 * Hiding communication in transaction decimals.
 * E.g. Amount: 105.071 = "07" "1" -> ASCII encoded partial message
 */

// Basic Hex encoder/decoder simulation
// In a real system, the decimals encode highly compressed AES strings

function encodeMessageToDecimals(message) {
    // Converts text roughly to pseudo-fractional amounts for DB storage
    let hexStr = Buffer.from(message, 'utf8').toString('hex');
    let encodedAmounts = [];

    // Chunk hex string into numbers
    for (let i = 0; i < hexStr.length; i += 2) {
        let chunk = hexStr.slice(i, i + 2);
        let baseAmount = Math.floor(Math.random() * 5000) + 10;
        let decimal = parseInt(chunk, 16) / 1000; // e.g., 0.255
        encodedAmounts.push((baseAmount + decimal).toFixed(3));
    }

    return encodedAmounts; // Array of amounts
}

function decodeMessageFromDecimals(amountsArray) {
    let hexStr = '';

    amountsArray.forEach(amt => {
        let fractionStr = Number(amt).toFixed(3).toString().split('.')[1];
        let hexChunk = parseInt(fractionStr, 10).toString(16);
        if (hexChunk.length < 2) hexChunk = '0' + hexChunk;
        hexStr += hexChunk;
    });

    return Buffer.from(hexStr, 'hex').toString('utf8');
}

module.exports = {
    encodeMessageToDecimals,
    decodeMessageFromDecimals
};
