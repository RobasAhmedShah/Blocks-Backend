# KYC File Upload Implementation

## Overview

This document describes the KYC file upload integration with Supabase Storage. Users can now upload KYC documents (CNIC front/back, passport, license, selfie) directly to Supabase Storage instead of providing external URLs.

## Implementation Summary

### ✅ Completed Features

1. **Enhanced Supabase Service** (`src/supabase/supabase.service.ts`)
   - Added `uploadKycDocument()` method for uploading KYC documents
   - Added `getKycDocumentSignedUrl()` for generating signed URLs
   - Added `deleteKycDocument()` for document deletion
   - Supports private bucket with signed URLs

2. **New DTOs** (`src/kyc/dto/upload-kyc-document.dto.ts`)
   - `UploadKycDocumentDto` for file upload requests

3. **Enhanced KYC Controller** (`src/kyc/kyc.controller.ts`)
   - `POST /kyc/upload-document` - Upload document (front/back/selfie)
   - `GET /kyc/documents/:path/signed-url` - Get signed URL for viewing

4. **Mobile KYC Module** (`src/mobile-kyc/`)
   - `GET /api/mobile/kyc/status` - Get KYC status
   - `POST /api/mobile/kyc/upload-document` - Upload document (JWT protected)
   - `POST /api/mobile/kyc/submit` - Submit KYC verification
   - `GET /api/mobile/kyc` - Get KYC details

## Setup Instructions

### 1. Environment Variables

Add to your `.env` file:

```env
# Supabase KYC Documents Bucket
SUPABASE_KYC_DOCUMENTS_BUCKET=kyc-documents
```

### 2. Create Supabase Bucket

1. Go to Supabase Dashboard → Storage → Buckets
2. Click "New bucket"
3. Configure:
   - **Name:** `kyc-documents`
   - **Public:** ❌ **NO** (Private bucket for security)
   - **File size limit:** 5 MB
   - **Allowed MIME types:** `image/jpeg, image/jpg, image/png`

### 3. Storage Policies (Optional)

If you want to add RLS policies, create a policy that allows:
- Service role: Full access (for backend uploads)
- Users: Can only access their own documents (via signed URLs)

## API Endpoints

### Main KYC Endpoints

#### POST /kyc/upload-document

Upload a KYC document (front, back, or selfie).

**Request:**
- Content-Type: `multipart/form-data`
- Form fields:
  - `file`: The image file (JPEG/PNG, max 5MB)
  - `documentType`: `front` | `back` | `selfie`
  - `userId`: User UUID or displayCode

**Response:**
```json
{
  "success": true,
  "message": "Document uploaded successfully",
  "documentType": "front",
  "url": "https://supabase.co/storage/v1/object/public/kyc-documents/user-id/front-1234567890-abc123.jpg",
  "path": "user-id/front-1234567890-abc123.jpg"
}
```

#### GET /kyc/documents/:path/signed-url

Get a signed URL for viewing a KYC document (for private buckets).

**Request:**
- Path parameter: `path` (URL-encoded file path)

**Response:**
```json
{
  "signedUrl": "https://supabase.co/storage/v1/object/sign/kyc-documents/user-id/front-1234567890-abc123.jpg?token=..."
}
```

### Mobile KYC Endpoints

All mobile endpoints require JWT authentication:
```
Authorization: Bearer <jwt_token>
```

#### GET /api/mobile/kyc/status

Get current user's KYC status.

**Response:**
```json
{
  "id": "uuid",
  "type": "cnic",
  "status": "pending",
  "submittedAt": "2025-01-12T10:00:00.000Z",
  "reviewedAt": null,
  "rejectionReason": null,
  "hasDocuments": {
    "front": true,
    "back": true,
    "selfie": true
  }
}
```

#### POST /api/mobile/kyc/upload-document

Upload a KYC document for the authenticated user.

**Request:**
- Content-Type: `multipart/form-data`
- Form fields:
  - `file`: The image file (JPEG/PNG, max 5MB)
  - `documentType`: `front` | `back` | `selfie`

**Response:**
```json
{
  "success": true,
  "documentType": "front",
  "url": "https://supabase.co/storage/v1/object/public/kyc-documents/user-id/front-1234567890-abc123.jpg",
  "path": "user-id/front-1234567890-abc123.jpg"
}
```

#### POST /api/mobile/kyc/submit

Submit KYC verification with uploaded document URLs.

**Request:**
```json
{
  "type": "cnic",
  "documentFrontUrl": "https://supabase.co/.../front-1234567890-abc123.jpg",
  "documentBackUrl": "https://supabase.co/.../back-1234567890-abc123.jpg",
  "selfieUrl": "https://supabase.co/.../selfie-1234567890-abc123.jpg",
  "metadata": {
    "additionalInfo": "Optional metadata"
  }
}
```

**Response:**
```json
{
  "success": true,
  "message": "KYC submitted successfully",
  "kyc": {
    "id": "uuid",
    "type": "cnic",
    "status": "pending",
    "submittedAt": "2025-01-12T10:00:00.000Z"
  }
}
```

#### GET /api/mobile/kyc

Get full KYC verification details for the authenticated user.

**Response:**
```json
{
  "id": "uuid",
  "type": "cnic",
  "status": "pending",
  "documents": {
    "front": "https://supabase.co/.../front-1234567890-abc123.jpg",
    "back": "https://supabase.co/.../back-1234567890-abc123.jpg",
    "selfie": "https://supabase.co/.../selfie-1234567890-abc123.jpg"
  },
  "reviewer": null,
  "rejectionReason": null,
  "submittedAt": "2025-01-12T10:00:00.000Z",
  "reviewedAt": null,
  "createdAt": "2025-01-12T10:00:00.000Z",
  "updatedAt": "2025-01-12T10:00:00.000Z"
}
```

## Usage Flow

### Mobile App Flow

1. **User uploads documents:**
   ```bash
   # Upload front document
   POST /api/mobile/kyc/upload-document
   Form-data: file=<image>, documentType=front
   
   # Upload back document
   POST /api/mobile/kyc/upload-document
   Form-data: file=<image>, documentType=back
   
   # Upload selfie
   POST /api/mobile/kyc/upload-document
   Form-data: file=<image>, documentType=selfie
   ```

2. **User submits KYC:**
   ```bash
   POST /api/mobile/kyc/submit
   Body: {
     "type": "cnic",
     "documentFrontUrl": "<url-from-step-1>",
     "documentBackUrl": "<url-from-step-1>",
     "selfieUrl": "<url-from-step-1>"
   }
   ```

3. **User checks status:**
   ```bash
   GET /api/mobile/kyc/status
   ```

4. **Admin reviews:**
   ```bash
   PATCH /kyc/:id
   Body: {
     "status": "verified",
     "reviewer": "admin@example.com"
   }
   ```

## File Storage Structure

Documents are stored in Supabase Storage with the following structure:

```
kyc-documents/
  └── {userId}/
      ├── front-{timestamp}-{randomId}.jpg
      ├── back-{timestamp}-{randomId}.jpg
      └── selfie-{timestamp}-{randomId}.jpg
```

## Security Features

1. **Private Bucket:** Documents are stored in a private bucket
2. **Signed URLs:** Use signed URLs for temporary access (1 hour expiry)
3. **File Validation:** Only JPEG/PNG images, max 5MB
4. **JWT Authentication:** Mobile endpoints require authentication
5. **User Isolation:** Each user's documents are stored in their own folder

## Error Handling

Common errors:

- `400 Bad Request`: Invalid file type, file too large, missing fields
- `401 Unauthorized`: Missing or invalid JWT token (mobile endpoints)
- `404 Not Found`: User or KYC not found
- `500 Internal Server Error`: Supabase upload failure

## Testing

### Using cURL

```bash
# Upload document (mobile endpoint)
curl -X POST http://localhost:3000/api/mobile/kyc/upload-document \
  -H "Authorization: Bearer <jwt_token>" \
  -F "file=@/path/to/document.jpg" \
  -F "documentType=front"

# Submit KYC
curl -X POST http://localhost:3000/api/mobile/kyc/submit \
  -H "Authorization: Bearer <jwt_token>" \
  -H "Content-Type: application/json" \
  -d '{
    "type": "cnic",
    "documentFrontUrl": "<url-from-upload>",
    "documentBackUrl": "<url-from-upload>",
    "selfieUrl": "<url-from-upload>"
  }'
```

## Notes

- Documents are stored permanently in Supabase Storage
- Each upload creates a unique file (timestamp + random ID)
- Old documents are not automatically deleted (consider cleanup job)
- Signed URLs expire after 1 hour (configurable)
- File size limit: 5MB per document
- Supported formats: JPEG, JPG, PNG

## Future Enhancements

- [ ] Automatic document cleanup (delete old versions)
- [ ] Document compression before upload
- [ ] Image quality validation
- [ ] OCR extraction from documents
- [ ] Face matching (selfie vs document photo)
- [ ] Document authenticity verification

