import { Injectable, Logger } from '@nestjs/common';
import * as https from 'https';
import * as http from 'http';
// eslint-disable-next-line @typescript-eslint/no-var-requires
const PDFDocument = require('pdfkit');

export interface PdfOptions {
  format?: 'A4' | 'Letter';
  printBackground?: boolean;
  margin?: {
    top?: string;
    right?: string;
    bottom?: string;
    left?: string;
  };
}

export interface CertificateData {
  department: string;
  subDepartment: string;
  boxNo: string;
  regNo: string;
  ownerName: string;
  ownerAddress: string;
  propertyId: string;
  location: string;
  surveyNo: string;
  area: string;
  usage: string;
  tokensPurchased: string;
  totalTokens: string;
  ownershipPercentage: string;
  tokenPrice: string;
  totalAmount: string;
  averagePrice: string;
  expectedROI: string;
  authorityName: string;
  designation: string;
  serial: string;
  date: string;
  secpStampUrl?: string;
  sbpStampUrl?: string;
}

@Injectable()
export class PdfService {
  private readonly logger = new Logger(PdfService.name);

  /**
   * Generate PDF from HTML string
   * NOTE: This method is not implemented as we use PDFKit for certificate generation.
   * If HTML to PDF conversion is needed, consider using a different library or service.
   */
  async generateFromHtml(html: string, options: PdfOptions = {}): Promise<Buffer> {
    this.logger.warn('generateFromHtml is not implemented. Use generateCertificate for PDF generation.');
    throw new Error('HTML to PDF conversion is not available. Use generateCertificate method instead.');
  }

  /**
   * Download image from URL
   */
  private async downloadImage(url: string): Promise<Buffer | null> {
    return new Promise((resolve, reject) => {
      const protocol = url.startsWith('https') ? https : http;
      
      protocol.get(url, (response) => {
        if (response.statusCode !== 200) {
          reject(new Error(`Failed to download image: ${response.statusCode}`));
          return;
        }

        const chunks: Buffer[] = [];
        response.on('data', (chunk) => chunks.push(chunk));
        response.on('end', () => {
          resolve(Buffer.concat(chunks));
        });
        response.on('error', (error) => {
          reject(error);
        });
      }).on('error', (error) => {
        reject(error);
      });
    });
  }

  /**
   * Generate certificate PDF using PDFKit
   */
  async generateCertificate(data: CertificateData): Promise<Buffer> {
    // Download images first
    let secpImage: Buffer | null = null;
    let sbpImage: Buffer | null = null;

    if (data.secpStampUrl) {
      try {
        secpImage = await this.downloadImage(data.secpStampUrl);
      } catch (error) {
        this.logger.warn('Could not load SECP logo:', error);
      }
    }

    if (data.sbpStampUrl) {
      try {
        sbpImage = await this.downloadImage(data.sbpStampUrl);
      } catch (error) {
        this.logger.warn('Could not load SBP logo:', error);
      }
    }

    return new Promise((resolve, reject) => {
      try {
        const doc = new PDFDocument({
          size: 'A4',
          margins: { top: 50, bottom: 50, left: 50, right: 50 },
        });

        const chunks: Buffer[] = [];

        // Collect PDF chunks
        doc.on('data', (chunk) => chunks.push(chunk));
        doc.on('end', () => {
          const buffer = Buffer.concat(chunks);
          this.logger.log(`Certificate PDF generated (${buffer.length} bytes)`);
          resolve(buffer);
        });
        doc.on('error', (error) => {
          this.logger.error('Error generating certificate PDF:', error);
          reject(error);
        });

        // ===============================
        // BORDER
        // ===============================
        doc.rect(30, 30, doc.page.width - 60, doc.page.height - 60).stroke();

        // ===============================
        // HEADER
        // ===============================
        const headerY = 50;
        doc
          .font('Times-Bold')
          .fontSize(12)
          .text(data.department.toUpperCase(), 50, headerY, { align: 'center', width: doc.page.width - 100 });

        // ===============================
        // TITLE
        // ===============================
        doc
          .font('Times-Bold')
          .fontSize(16)
          .text('CERTIFICATE OF TOKENIZED PROPERTY', 50, headerY + 25, {
            align: 'center',
            width: doc.page.width - 100,
            underline: true,
          })
          .text('OWNERSHIP', 50, headerY + 45, {
            align: 'center',
            width: doc.page.width - 100,
            underline: true,
          });

        // ===============================
        // META BOXES
        // ===============================
        this.drawBox(doc, 50, headerY + 70, 'BOX NO.', data.boxNo);
        this.drawBox(doc, doc.page.width - 170, headerY + 70, 'REG. NO.', data.regNo);

        // ===============================
        // OWNER DECLARATION
        // ===============================
        doc
          .fontSize(9)
          .font('Times-Roman')
          .text(
            `This certifies that ${data.ownerName}, residing at ${data.ownerAddress}, is the lawful holder of fractional tokenized ownership in the property described below as recorded under digital title registration.`,
            50,
            headerY + 115,
            {
              align: 'justify',
              width: doc.page.width - 100,
              lineGap: 2,
            },
          );

        // ===============================
        // PROPERTY DETAILS
        // ===============================
        this.sectionTitle(doc, 'PROPERTY IDENTIFICATION');
        this.tableRow(doc, 'Property ID', data.propertyId);
        this.tableRow(doc, 'Location', data.location);
        this.tableRow(doc, 'Usage Type', data.usage);

        // ===============================
        // INVESTMENT DETAILS
        // ===============================
        this.sectionTitle(doc, 'TOKEN OWNERSHIP RECORD');
        this.tableRow(doc, 'Tokens Purchased', `${data.tokensPurchased}`);
        this.tableRow(doc, 'Total Tokens Issued', data.totalTokens);
        this.tableRow(doc, 'Ownership Percentage', `${data.ownershipPercentage}%`);
        this.tableRow(doc, 'Token Price (USDT)', `$${data.tokenPrice}`);
        this.tableRow(doc, 'Total Amount Paid', `$${data.totalAmount}`);
        this.tableRow(doc, 'Average Purchase Price', `$${data.averagePrice}`);
        this.tableRow(doc, 'Expected ROI', `${data.expectedROI}%`);

        // ===============================
        // LEFT SIDE - REGISTRAR INFO
        // ===============================
        const leftSignatureY = doc.page.height - 100;
        doc
          .font('Times-Roman')
          .fontSize(9)
          .text(data.authorityName, 70, leftSignatureY)
          .text(data.designation, 70, leftSignatureY + 12);

        // ===============================
        // RIGHT SIDE - LOGOS (Side by Side)
        // ===============================
        const logoSize = 60; // Slightly smaller to fit on one page
        const logosY = doc.page.height - 160;
        const logoSpacing = 15; // Closer spacing between logos
        // Calculate to position logos fully to the right
        const totalLogoWidth = (logoSize * 2) + logoSpacing;
        const logoStartX = doc.page.width - totalLogoWidth - 50; // Full right with margin
        
        // Embed SECP logo (left)
        if (secpImage) {
          try {
            doc.image(secpImage, logoStartX, logosY, { width: logoSize, height: logoSize });
          } catch (error) {
            this.logger.warn('Could not embed SECP logo:', error);
          }
        }
        
        // Embed SBP logo (right, side by side)
        if (sbpImage) {
          try {
            doc.image(sbpImage, logoStartX + logoSize + logoSpacing, logosY, { width: logoSize, height: logoSize });
          } catch (error) {
            this.logger.warn('Could not embed SBP logo:', error);
          }
        }

        // ===============================
        // FOOTER (Inside border)
        // ===============================
        const footerY = doc.page.height - 60;
        doc
          .fontSize(8)
          .fillColor('black')
          .text(`Serial No: ${data.serial}`, 50, footerY)
          .text(`Issued On: ${data.date}`, doc.page.width - 200, footerY);

        doc.end();
      } catch (error) {
        this.logger.error('Error in generateCertificate:', error);
        reject(error);
      }
    });
  }

  // =======================================
  // HELPERS
  // =======================================

  private sectionTitle(doc: any, title: string): void {
    doc.moveDown(0.3);
    doc.font('Times-Bold').fontSize(10).text(title);
    const currentY = doc.y;
    doc.moveTo(50, currentY + 2).lineTo(545, currentY + 2).stroke();
    doc.moveDown(0.2);
  }

  private tableRow(doc: any, label: string, value: string): void {
    const y = doc.y;
    doc.font('Times-Bold').fontSize(8).text(label, 60, y, { width: 160 });
    doc.font('Times-Roman').fontSize(8).text(value, 230, y, { width: 250 });
    doc.moveDown(0.3);
  }

  private drawBox(doc: any, x: number, y: number, title: string, value: string): void {
    doc.rect(x, y, 120, 40).stroke();
    doc.fontSize(8).text(title, x + 5, y + 5);
    doc.fontSize(10).font('Times-Bold').text(value, x + 5, y + 18);
  }
}

