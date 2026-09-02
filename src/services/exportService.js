const { Parser } = require('json2csv');
const PDFDocument = require('pdfkit');

class ExportService {
  
  /**
   * Generates a CSV string from an array of cases
   * @param {Array} cases 
   * @returns {string} CSV data
   */
  exportToCSV(cases) {
    const fields = ['hashId', 'caseNumber', 'title', 'stage', 'status', 'filingDate', 'court'];
    const opts = { fields };

    try {
      const parser = new Parser(opts);
      const csv = parser.parse(cases);
      return csv;
    } catch (err) {
      console.error('CSV Export Error:', err);
      throw new Error('Failed to generate CSV');
    }
  }

  /**
   * Generates a PDF buffer for a specific case
   * @param {Object} caseData 
   * @returns {Promise<Buffer>}
   */
  exportToPDF(caseData) {
    return new Promise((resolve, reject) => {
      try {
        const doc = new PDFDocument({ margin: 50 });
        const buffers = [];

        doc.on('data', buffers.push.bind(buffers));
        doc.on('end', () => {
          const pdfData = Buffer.concat(buffers);
          resolve(pdfData);
        });

        // Header
        doc.fontSize(20).text('GAVEL - Case Report', { align: 'center' });
        doc.moveDown();
        
        doc.fontSize(12).text(`Hash ID: ${caseData.hashId}`, { align: 'right' });
        doc.moveDown();

        // Case Details
        doc.fontSize(14).text('Case Details', { underline: true });
        doc.moveDown(0.5);
        doc.fontSize(12).text(`Case Number: ${caseData.caseNumber}`);
        doc.text(`Title: ${caseData.title}`);
        doc.text(`Stage: ${caseData.stage}`);
        doc.text(`Status: ${caseData.status}`);
        doc.text(`Court: ${caseData.court || 'N/A'}`);
        doc.text(`Filing Date: ${new Date(caseData.filingDate).toLocaleDateString()}`);
        doc.moveDown();

        // Parties
        doc.fontSize(14).text('Parties', { underline: true });
        doc.moveDown(0.5);
        doc.fontSize(12).text(`Plaintiffs: ${caseData.plaintiffs.join(', ') || 'N/A'}`);
        doc.text(`Defendants: ${caseData.defendants.join(', ') || 'N/A'}`);
        doc.moveDown();

        // Description
        doc.fontSize(14).text('Description', { underline: true });
        doc.moveDown(0.5);
        doc.fontSize(12).text(caseData.description || 'No description provided.');
        
        doc.end();
      } catch (err) {
        console.error('PDF Export Error:', err);
        reject(new Error('Failed to generate PDF'));
      }
    });
  }
}

module.exports = new ExportService();
