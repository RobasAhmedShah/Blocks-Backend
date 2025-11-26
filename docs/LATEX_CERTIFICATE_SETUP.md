# LaTeX Certificate Generation Setup

## Overview

The certificate generation system now supports LaTeX templates for creating professional property ownership-style documents. The system will attempt to use LaTeX first, and fall back to HTML if LaTeX compilation fails.

## Requirements

### For LaTeX PDF Generation

To use LaTeX templates, you need to install a LaTeX distribution:

**Windows:**
- Install [MiKTeX](https://miktex.org/) or [TeX Live](https://www.tug.org/texlive/)
- Ensure `pdflatex.exe` is in your system PATH

**Linux (Ubuntu/Debian):**
```bash
sudo apt-get update
sudo apt-get install texlive-latex-base texlive-latex-extra texlive-fonts-recommended
```

**Mac:**
```bash
brew install --cask mactex
# Or install BasicTeX for smaller installation
brew install --cask basictex
```

**Verify Installation:**
```bash
pdflatex --version
```

## How It Works

1. **LaTeX Template**: `src/certificates/templates/transaction-certificate.tex`
   - Uses EJS templating to inject transaction data
   - Styled like a professional property ownership certificate
   - Includes soft background tint, official formatting

2. **PDF Service**: `src/pdf/pdf.service.ts`
   - `generateFromLatex()` method compiles LaTeX to PDF
   - Uses `pdflatex` command-line tool
   - Automatically cleans up temporary files

3. **Certificates Service**: `src/certificates/certificates.service.ts`
   - Attempts LaTeX generation first
   - Falls back to HTML/EJS template if LaTeX fails
   - Automatically escapes LaTeX special characters

## Template Structure

The LaTeX template follows this structure:
- **Header**: Blocks Platform branding and certificate title
- **Transaction Details Box**: Transaction ID, Certificate ID, Date, Status, Type
- **Main Body**: 
  - Registered Owner information
  - Property Investment details
  - Token Ownership Details
  - Blockchain Verification
  - Document Verification
- **Signature Block**: Official stamp and registrar signature
- **QR Code Area**: Certificate ID and QR code placeholder

## LaTeX Special Characters

The system automatically escapes LaTeX special characters:
- `\`, `{`, `}`, `$`, `&`, `%`, `#`, `^`, `_`, `~`

These are escaped in all transaction data before being inserted into the LaTeX template.

## Fallback Behavior

If LaTeX compilation fails (e.g., `pdflatex` not installed), the system will:
1. Log a warning
2. Automatically fall back to HTML/EJS template
3. Continue with normal PDF generation using Puppeteer

This ensures the system always works, even without LaTeX installed.

## Testing

### Test LaTeX Compilation

1. Make a test transaction through your API
2. Check backend logs for:
   ```
   [CertificatesService] 🎨 Rendering LaTeX template...
   [CertificatesService] 📄 Generating PDF from LaTeX...
   [PdfService] PDF generated successfully from LaTeX (... bytes)
   ```

### Test Fallback

If `pdflatex` is not installed, you should see:
```
[CertificatesService] ⚠️ LaTeX compilation failed: pdflatex is not installed...
[CertificatesService] 🔄 Falling back to HTML template...
[CertificatesService] 📄 Generating PDF from HTML...
```

## Customizing the Template

Edit `src/certificates/templates/transaction-certificate.tex` to customize:
- Colors and styling
- Layout and spacing
- Additional sections
- Fonts and formatting

The template uses standard LaTeX packages:
- `geometry` - Page margins
- `graphicx` - Image support
- `tikz` - Drawing and boxes
- `setspace` - Line spacing
- `helvet` - Helvetica font family
- `booktabs` - Professional tables

## Production Deployment

### Vercel/Serverless

For serverless deployments (Vercel, AWS Lambda, etc.):
- LaTeX compilation requires system dependencies
- Consider using a LaTeX compilation service API
- Or use the HTML fallback (which works in serverless)

### Docker

If using Docker, add to your Dockerfile:
```dockerfile
RUN apt-get update && \
    apt-get install -y texlive-latex-base texlive-latex-extra && \
    rm -rf /var/lib/apt/lists/*
```

## Troubleshooting

### "pdflatex is not installed" Error

**Solution**: Install a LaTeX distribution (see Requirements above)

### LaTeX Compilation Errors

**Common Issues:**
1. Missing LaTeX packages - Install required packages
2. Image files not found - Images need to be local files (not URLs)
3. Special characters - Already handled by automatic escaping

**Check Logs**: Look for LaTeX compilation error messages in the backend logs

### PDF Not Generated

1. Check if `pdflatex` is in PATH: `which pdflatex` (Linux/Mac) or `where pdflatex` (Windows)
2. Verify LaTeX installation: `pdflatex --version`
3. Check backend logs for specific error messages

## Next Steps

1. Install LaTeX distribution on your development machine
2. Test certificate generation with a real transaction
3. Customize the LaTeX template to match your branding
4. For production, decide on LaTeX compilation strategy (local vs. service API)


