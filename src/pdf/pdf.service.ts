import { Injectable, Logger } from '@nestjs/common';
import PDFDocument from 'pdfkit';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import * as https from 'https';
import * as http from 'http';
import { Readable } from 'stream';

export interface PdfOptions {
  format?: 'A4' | 'Letter';
  margin?: {
    top?: number;
    right?: number;
    bottom?: number;
    left?: number;
  };
}

export interface CertificateData {
  certificateId: string;
  transactionDisplayCode: string;
  transactionDate: string;
  transactionStatus: string;
  transactionType: string;
  investorName: string;
  userId: string | null | undefined;
  propertyName: string;
  propertyDisplayCode: string;
  tokensPurchased: string;
  tokenPrice: string;
  totalAmount: string;
  blockchainHash?: string | null;
  blockchainNetwork?: string | null;
  secpStampUrl?: string;
  sbpStampUrl?: string;
  generatedAt: string;
  documentHash: string;
}

export interface PortfolioData {
  certificateId: string;
  investorName: string;
  userId: string;
  propertyName: string;
  propertyDisplayCode: string;
  propertyLocation: string;
  expectedROI: string;
  totalTokens: string;
  totalInvested: string;
  averagePrice: string;
  ownershipPercentage: string;
  transactions: Array<{
    date: string;
    displayCode: string;
    tokens: string;
    amount: string;
    status: string;
  }>;
  secpStampUrl?: string;
  sbpStampUrl?: string;
  generatedAt: string;
}

@Injectable()
export class PdfService {
  private readonly logger = new Logger(PdfService.name);

  /**
   * Download file from URL to buffer
   */
  private async downloadFile(url: string): Promise<Buffer> {
    return new Promise((resolve, reject) => {
      const protocol = url.startsWith('https:') ? https : http;
      
      protocol.get(url, (response) => {
        if (response.statusCode === 301 || response.statusCode === 302) {
          // Handle redirects
          return this.downloadFile(response.headers.location || url)
            .then(resolve)
            .catch(reject);
        }
        
        if (response.statusCode !== 200) {
          reject(new Error(`Failed to download file: ${response.statusCode}`));
          return;
        }
        
        const chunks: Buffer[] = [];
        response.on('data', (chunk) => chunks.push(chunk));
        response.on('end', () => resolve(Buffer.concat(chunks)));
        response.on('error', reject);
      }).on('error', reject);
    });
  }

  /**
   * Generate transaction certificate PDF using PDFKit
   */
  async generateTransactionCertificate(data: CertificateData): Promise<Buffer> {
    return new Promise(async (resolve, reject) => {
      try {
        this.logger.log('Generating transaction certificate PDF with PDFKit...');

        // Create PDF document
        const doc = new PDFDocument({
          size: 'A4',
          margins: {
            top: 72,    // 1 inch = 72 points
            bottom: 72,
            left: 54,   // 0.75 inch
            right: 54,
          },
        });

        const chunks: Buffer[] = [];
        doc.on('data', (chunk) => chunks.push(chunk));
        doc.on('end', () => resolve(Buffer.concat(chunks)));
        doc.on('error', reject);

        // Colors
        const primaryColor = '#16a34a';
        const textColor = '#333333';
        const lightGray = '#666666';
        const lightGreen = '#f0fdf4';
        const lightGrayBg = '#f9fafb';
        const warningYellow = '#fef3c7';
        const warningBorder = '#f59e0b';

        // Header
        doc
          .fontSize(32)
          .fillColor(primaryColor)
          .font('Helvetica-Bold')
          .text('TRANSACTION CERTIFICATE', { align: 'center' })
          .moveDown(0.3);

        doc
          .fontSize(14)
          .fillColor(lightGray)
          .font('Helvetica')
          .text('Official Proof of Token Purchase', { align: 'center' })
          .moveDown(0.5);

        // Draw line
        doc
          .moveTo(doc.page.margins.left, doc.y)
          .lineTo(doc.page.width - doc.page.margins.right, doc.y)
          .lineWidth(3)
          .strokeColor(primaryColor)
          .stroke();

        doc.moveDown(1);

        // Transaction Information Section
        doc
          .fontSize(18)
          .fillColor(primaryColor)
          .font('Helvetica-Bold')
          .text('Transaction Information')
          .moveDown(0.3);

        // Transaction info grid
        const infoStartY = doc.y;
        const infoBoxHeight = 80;
        const infoBoxWidth = (doc.page.width - doc.page.margins.left - doc.page.margins.right - 20) / 2;

        // Transaction ID
        this.drawInfoBox(doc, doc.page.margins.left, infoStartY, infoBoxWidth, infoBoxHeight, 'TRANSACTION ID', data.transactionDisplayCode, lightGrayBg);
        
        // Date & Time
        this.drawInfoBox(doc, doc.page.margins.left + infoBoxWidth + 20, infoStartY, infoBoxWidth, infoBoxHeight, 'DATE & TIME', data.transactionDate, lightGrayBg);

        // Status
        this.drawInfoBox(doc, doc.page.margins.left, infoStartY + infoBoxHeight + 15, infoBoxWidth, infoBoxHeight, 'STATUS', data.transactionStatus, lightGrayBg, primaryColor);
        
        // Type
        this.drawInfoBox(doc, doc.page.margins.left + infoBoxWidth + 20, infoStartY + infoBoxHeight + 15, infoBoxWidth, infoBoxHeight, 'TYPE', data.transactionType, lightGrayBg);

        doc.y = infoStartY + (infoBoxHeight * 2) + 30;

        // Investor Information Section
        doc
          .fontSize(18)
          .fillColor(primaryColor)
          .font('Helvetica-Bold')
          .text('Investor Information')
          .moveDown(0.3);

        const investorStartY = doc.y;
        
        // Investor Name
        this.drawInfoBox(doc, doc.page.margins.left, investorStartY, infoBoxWidth, infoBoxHeight, 'INVESTOR NAME', data.investorName, lightGrayBg);
        
        // User ID
        this.drawInfoBox(doc, doc.page.margins.left + infoBoxWidth + 20, investorStartY, infoBoxWidth, infoBoxHeight, 'USER ID', data.userId || 'N/A', lightGrayBg);

        doc.y = investorStartY + infoBoxHeight + 20;

        // Investment Details Box
        const investmentBoxY = doc.y;
        const investmentBoxWidth = doc.page.width - doc.page.margins.left - doc.page.margins.right;
        const investmentBoxHeight = 180;

        // Draw box with border
        doc
          .rect(doc.page.margins.left, investmentBoxY, investmentBoxWidth, investmentBoxHeight)
          .fillColor(lightGreen)
          .fill()
          .strokeColor(primaryColor)
          .lineWidth(2)
          .stroke();

        doc.y = investmentBoxY + 15;
        doc.x = doc.page.margins.left + 15;

        doc
          .fontSize(20)
          .fillColor(primaryColor)
          .font('Helvetica-Bold')
          .text('Investment Details')
          .moveDown(0.3);

        const investmentStartY = doc.y;
        const investmentItemWidth = (investmentBoxWidth - 40) / 2;

        // Property
        this.drawInfoBox(doc, doc.page.margins.left + 15, investmentStartY, investmentItemWidth, 50, 'PROPERTY', data.propertyName, 'transparent');
        
        // Property Code
        this.drawInfoBox(doc, doc.page.margins.left + 15 + investmentItemWidth + 10, investmentStartY, investmentItemWidth, 50, 'PROPERTY CODE', data.propertyDisplayCode, 'transparent');

        // Tokens Purchased
        this.drawInfoBox(doc, doc.page.margins.left + 15, investmentStartY + 60, investmentItemWidth, 50, 'TOKENS PURCHASED', data.tokensPurchased, 'transparent');
        
        // Token Price
        this.drawInfoBox(doc, doc.page.margins.left + 15 + investmentItemWidth + 10, investmentStartY + 60, investmentItemWidth, 50, 'TOKEN PRICE', `$${data.tokenPrice} USDT`, 'transparent');

        // Total Investment Amount (full width)
        doc.y = investmentStartY + 120;
        doc.x = doc.page.margins.left + 15;
        doc
          .fontSize(12)
          .fillColor(lightGray)
          .font('Helvetica')
          .text('TOTAL INVESTMENT AMOUNT', { continued: false });
        
        doc
          .fontSize(24)
          .fillColor(primaryColor)
          .font('Helvetica-Bold')
          .text(`$${data.totalAmount} USDT`, { align: 'left' });

        doc.y = investmentBoxY + investmentBoxHeight + 20;

        // Blockchain Verification (if available)
        if (data.blockchainHash) {
          const verificationBoxY = doc.y;
          const verificationBoxWidth = doc.page.width - doc.page.margins.left - doc.page.margins.right;
          const verificationBoxHeight = 100;

          // Draw warning box
          doc
            .rect(doc.page.margins.left, verificationBoxY, verificationBoxWidth, verificationBoxHeight)
            .fillColor(warningYellow)
            .fill()
            .lineWidth(4)
            .strokeColor(warningBorder)
            .moveTo(doc.page.margins.left, verificationBoxY)
            .lineTo(doc.page.margins.left, verificationBoxY + verificationBoxHeight)
            .stroke();

          doc.y = verificationBoxY + 15;
          doc.x = doc.page.margins.left + 15;

          doc
            .fontSize(14)
            .fillColor('#92400e')
            .font('Helvetica-Bold')
            .text('Blockchain Verification:')
            .moveDown(0.2);

          doc
            .fontSize(12)
            .fillColor('#92400e')
            .font('Helvetica')
            .text(`Transaction Hash: ${data.blockchainHash}`, { continued: false });

          if (data.blockchainNetwork) {
            doc.text(`Network: ${data.blockchainNetwork}`, { continued: false });
          }

          doc.moveDown(0.2);
          doc.text('This transaction has been recorded on the blockchain for permanent verification.');

          doc.y = verificationBoxY + verificationBoxHeight + 20;
        }

        // New page for stamps
        doc.addPage();

        // Stamps Section
        doc.y = doc.page.height / 2 - 100;
        
        let stampX = doc.page.width / 2 - 120;
        const stampSize = 120;

        // Download and add SECP stamp
        if (data.secpStampUrl) {
          try {
            const secpImage = await this.downloadFile(data.secpStampUrl);
            doc.image(secpImage, stampX, doc.y, { width: stampSize, height: stampSize });
            stampX += stampSize + 40;
          } catch (error) {
            this.logger.warn('Failed to load SECP stamp:', error);
          }
        }

        // Download and add SBP stamp
        if (data.sbpStampUrl) {
          try {
            const sbpImage = await this.downloadFile(data.sbpStampUrl);
            doc.image(sbpImage, stampX, doc.y, { width: stampSize, height: stampSize });
          } catch (error) {
            this.logger.warn('Failed to load SBP stamp:', error);
          }
        }

        // Footer
        doc.y = doc.page.height - 150;
        doc.x = doc.page.margins.left;

        doc
          .fontSize(11)
          .fillColor(lightGray)
          .font('Helvetica')
          .text('This is an official certificate issued by Blocks Platform', { align: 'center' })
          .moveDown(0.5);

        // Footer info grid
        const footerY = doc.y;
        const footerWidth = (doc.page.width - doc.page.margins.left - doc.page.margins.right) / 2;

        doc
          .fontSize(11)
          .fillColor(lightGray)
          .font('Helvetica')
          .text(`Certificate ID: ${data.certificateId}`, { continued: false })
          .text(`Generated: ${data.generatedAt}`, { continued: false });

        doc.x = doc.page.margins.left + footerWidth;
        doc.y = footerY;

        doc
          .text(`Document Hash: ${data.documentHash ? data.documentHash.substring(0, 16) + '...' : 'N/A'}`, { align: 'right', continued: false })
          .text('Verification: Valid', { align: 'right', continued: false });

        // Finalize PDF
        doc.end();

        this.logger.log('Transaction certificate PDF generated successfully');
      } catch (error) {
        this.logger.error('Error generating PDF:', error);
        reject(error);
      }
    });
  }

  /**
   * Generate portfolio summary PDF using PDFKit
   */
  async generatePortfolioSummary(data: PortfolioData): Promise<Buffer> {
    return new Promise(async (resolve, reject) => {
      try {
        this.logger.log('Generating portfolio summary PDF with PDFKit...');

        const doc = new PDFDocument({
          size: 'A4',
          margins: {
            top: 72,
            bottom: 72,
            left: 54,
            right: 54,
          },
        });

        const chunks: Buffer[] = [];
        doc.on('data', (chunk) => chunks.push(chunk));
        doc.on('end', () => resolve(Buffer.concat(chunks)));
        doc.on('error', reject);

        // Colors
        const primaryColor = '#16a34a';
        const textColor = '#333333';
        const lightGray = '#666666';
        const lightGreen = '#f0fdf4';
        const lightGrayBg = '#f9fafb';

        // Header
        doc
          .fontSize(32)
          .fillColor(primaryColor)
          .font('Helvetica-Bold')
          .text('PORTFOLIO SUMMARY CERTIFICATE', { align: 'center' })
          .moveDown(0.3);

        doc
          .fontSize(14)
          .fillColor(lightGray)
          .font('Helvetica')
          .text('Complete Investment Portfolio for Property', { align: 'center' })
          .moveDown(0.5);

        // Draw line
        doc
          .moveTo(doc.page.margins.left, doc.y)
          .lineTo(doc.page.width - doc.page.margins.right, doc.y)
          .lineWidth(3)
          .strokeColor(primaryColor)
          .stroke();

        doc.moveDown(1);

        // Investor Information
        doc
          .fontSize(18)
          .fillColor(primaryColor)
          .font('Helvetica-Bold')
          .text('Investor Information')
          .moveDown(0.3);

        const investorStartY = doc.y;
        const infoBoxWidth = (doc.page.width - doc.page.margins.left - doc.page.margins.right - 20) / 2;
        const infoBoxHeight = 50;

        this.drawInfoBox(doc, doc.page.margins.left, investorStartY, infoBoxWidth, infoBoxHeight, 'INVESTOR NAME', data.investorName, lightGrayBg);
        this.drawInfoBox(doc, doc.page.margins.left + infoBoxWidth + 20, investorStartY, infoBoxWidth, infoBoxHeight, 'USER ID', data.userId, lightGrayBg);

        doc.y = investorStartY + infoBoxHeight + 20;

        // Property Information
        doc
          .fontSize(18)
          .fillColor(primaryColor)
          .font('Helvetica-Bold')
          .text('Property Information')
          .moveDown(0.3);

        const propertyStartY = doc.y;
        this.drawInfoBox(doc, doc.page.margins.left, propertyStartY, infoBoxWidth, infoBoxHeight, 'PROPERTY NAME', data.propertyName, lightGrayBg);
        this.drawInfoBox(doc, doc.page.margins.left + infoBoxWidth + 20, propertyStartY, infoBoxWidth, infoBoxHeight, 'PROPERTY CODE', data.propertyDisplayCode, lightGrayBg);
        this.drawInfoBox(doc, doc.page.margins.left, propertyStartY + infoBoxHeight + 15, infoBoxWidth, infoBoxHeight, 'LOCATION', data.propertyLocation, lightGrayBg);
        this.drawInfoBox(doc, doc.page.margins.left + infoBoxWidth + 20, propertyStartY + infoBoxHeight + 15, infoBoxWidth, infoBoxHeight, 'EXPECTED ROI', `${data.expectedROI}%`, lightGrayBg);

        doc.y = propertyStartY + (infoBoxHeight * 2) + 30;

        // Portfolio Summary Box
        const summaryBoxY = doc.y;
        const summaryBoxWidth = doc.page.width - doc.page.margins.left - doc.page.margins.right;
        const summaryBoxHeight = 200;

        doc
          .rect(doc.page.margins.left, summaryBoxY, summaryBoxWidth, summaryBoxHeight)
          .fillColor(lightGreen)
          .fill()
          .strokeColor(primaryColor)
          .lineWidth(2)
          .stroke();

        doc.y = summaryBoxY + 15;
        doc.x = doc.page.margins.left + 15;

        doc
          .fontSize(20)
          .fillColor(primaryColor)
          .font('Helvetica-Bold')
          .text('Portfolio Summary')
          .moveDown(0.5);

        const summaryStartY = doc.y;
        const summaryItemWidth = (summaryBoxWidth - 40) / 2;

        // Summary items
        this.drawSummaryItem(doc, doc.page.margins.left + 15, summaryStartY, summaryItemWidth, 'TOTAL TOKENS OWNED', data.totalTokens, primaryColor);
        this.drawSummaryItem(doc, doc.page.margins.left + 15 + summaryItemWidth + 10, summaryStartY, summaryItemWidth, 'TOTAL INVESTED', `$${data.totalInvested} USDT`, primaryColor);
        this.drawSummaryItem(doc, doc.page.margins.left + 15, summaryStartY + 80, summaryItemWidth, 'AVERAGE PRICE', `$${data.averagePrice} USDT`, primaryColor);
        this.drawSummaryItem(doc, doc.page.margins.left + 15 + summaryItemWidth + 10, summaryStartY + 80, summaryItemWidth, 'OWNERSHIP %', `${data.ownershipPercentage}%`, primaryColor);

        doc.y = summaryBoxY + summaryBoxHeight + 20;

        // Transaction History Table
        if (data.transactions && data.transactions.length > 0) {
          doc
            .fontSize(18)
            .fillColor(primaryColor)
            .font('Helvetica-Bold')
            .text('Transaction History')
            .moveDown(0.3);

          const tableStartY = doc.y;
          const tableWidth = doc.page.width - doc.page.margins.left - doc.page.margins.right;
          const colWidths = [80, 120, 80, 100, 80];
          const rowHeight = 30;

          // Table header
          doc
            .fontSize(12)
            .fillColor('#ffffff')
            .font('Helvetica-Bold')
            .rect(doc.page.margins.left, tableStartY, tableWidth, rowHeight)
            .fillColor(primaryColor)
            .fill();

          let x = doc.page.margins.left + 10;
          doc.y = tableStartY + 8;
          doc.x = x;
          doc.fillColor('#ffffff').text('Date', { width: colWidths[0] });
          doc.x += colWidths[0];
          doc.text('Transaction ID', { width: colWidths[1] });
          doc.x += colWidths[1];
          doc.text('Tokens', { width: colWidths[2] });
          doc.x += colWidths[2];
          doc.text('Amount', { width: colWidths[3] });
          doc.x += colWidths[3];
          doc.text('Status', { width: colWidths[4] });

          // Table rows
          doc.font('Helvetica').fillColor(textColor);
          data.transactions.forEach((txn, index) => {
            const rowY = tableStartY + rowHeight + (index * rowHeight);
            doc.y = rowY + 8;
            doc.x = doc.page.margins.left + 10;

            // Draw row background
            if (index % 2 === 0) {
              doc
                .rect(doc.page.margins.left, rowY, tableWidth, rowHeight)
                .fillColor('#f9fafb')
                .fill();
            }

            doc.fillColor(textColor).text(txn.date, { width: colWidths[0] });
            doc.x += colWidths[0];
            doc.text(txn.displayCode, { width: colWidths[1] });
            doc.x += colWidths[1];
            doc.text(txn.tokens, { width: colWidths[2] });
            doc.x += colWidths[2];
            doc.text(`$${txn.amount} USDT`, { width: colWidths[3] });
            doc.x += colWidths[3];
            doc.fillColor(primaryColor).text(txn.status, { width: colWidths[4] });
          });

          doc.y = tableStartY + rowHeight + (data.transactions.length * rowHeight) + 20;
        }

        // New page for stamps
        doc.addPage();

        // Stamps Section
        doc.y = doc.page.height / 2 - 100;
        
        let stampX = doc.page.width / 2 - 120;
        const stampSize = 120;

        if (data.secpStampUrl) {
          try {
            const secpImage = await this.downloadFile(data.secpStampUrl);
            doc.image(secpImage, stampX, doc.y, { width: stampSize, height: stampSize });
            stampX += stampSize + 40;
          } catch (error) {
            this.logger.warn('Failed to load SECP stamp:', error);
          }
        }

        if (data.sbpStampUrl) {
          try {
            const sbpImage = await this.downloadFile(data.sbpStampUrl);
            doc.image(sbpImage, stampX, doc.y, { width: stampSize, height: stampSize });
          } catch (error) {
            this.logger.warn('Failed to load SBP stamp:', error);
          }
        }

        // Footer
        doc.y = doc.page.height - 150;
        doc.x = doc.page.margins.left;

        doc
          .fontSize(11)
          .fillColor(lightGray)
          .font('Helvetica')
          .text('This is an official portfolio summary certificate issued by Blocks Platform', { align: 'center' })
          .moveDown(0.5);

        const footerY = doc.y;
        const footerWidth = (doc.page.width - doc.page.margins.left - doc.page.margins.right) / 2;

        doc
          .fontSize(11)
          .fillColor(lightGray)
          .font('Helvetica')
          .text(`Certificate ID: ${data.certificateId}`, { continued: false })
          .text(`Generated: ${data.generatedAt}`, { continued: false });

        doc.x = doc.page.margins.left + footerWidth;
        doc.y = footerY;

        doc
          .text(`Property: ${data.propertyDisplayCode}`, { align: 'right', continued: false })
          .text('Verification: Valid', { align: 'right', continued: false });

        doc.end();

        this.logger.log('Portfolio summary PDF generated successfully');
      } catch (error) {
        this.logger.error('Error generating portfolio PDF:', error);
        reject(error);
      }
    });
  }

  /**
   * Helper: Draw an info box
   */
  private drawInfoBox(
    doc: PDFKit.PDFDocument,
    x: number,
    y: number,
    width: number,
    height: number,
    label: string,
    value: string,
    backgroundColor: string = '#f9fafb',
    valueColor?: string,
  ) {
    // Draw background
    if (backgroundColor !== 'transparent') {
      doc
        .rect(x, y, width, height)
        .fillColor(backgroundColor)
        .fill();
    }

    // Label
    doc
      .fontSize(12)
      .fillColor('#666666')
      .font('Helvetica')
      .text(label, x + 12, y + 12, { width: width - 24 });

    // Value
    doc
      .fontSize(16)
      .fillColor(valueColor || '#111111')
      .font('Helvetica')
      .text(value, x + 12, y + 35, { width: width - 24 });
  }

  /**
   * Helper: Draw a summary item
   */
  private drawSummaryItem(
    doc: PDFKit.PDFDocument,
    x: number,
    y: number,
    width: number,
    label: string,
    value: string,
    valueColor: string,
  ) {
    doc
      .fontSize(12)
      .fillColor('#666666')
      .font('Helvetica')
      .text(label, x, y, { width, align: 'center' });

    doc
      .fontSize(24)
      .fillColor(valueColor)
      .font('Helvetica-Bold')
      .text(value, x, y + 20, { width, align: 'center' });
  }
}
