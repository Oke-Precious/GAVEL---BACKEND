const QRCode = require('qrcode');
const env = require('../config/env');

class QRService {
  /**
   * Generates a base64 encoded QR Code image representing the case slip.
   * @param {Object} caseData - The case document
   * @returns {Promise<string>} Base64 data URI
   */
  async generateCaseQRSlip(caseData) {
    // The data embedded in the QR Code. Typically a URL to view the case
    // or stringified core details.
    const url = `${env.CLIENT_URL}/cases/verify/${caseData.hashId}`;
    
    const qrData = JSON.stringify({
      hashId: caseData.hashId,
      caseNumber: caseData.caseNumber,
      title: caseData.title,
      url
    });

    try {
      // Generate Data URI
      const dataUrl = await QRCode.toDataURL(qrData, {
        errorCorrectionLevel: 'H',
        margin: 2,
        width: 300,
        color: {
          dark: '#000000',
          light: '#ffffff'
        }
      });
      
      return dataUrl;
    } catch (error) {
      console.error('QR Generation failed:', error);
      throw new Error('Could not generate QR Code');
    }
  }
}

module.exports = new QRService();
