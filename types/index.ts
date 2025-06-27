// Request types
export interface UploadUrlRequest {
    fileName: string;
    fileType: string;
  }
  
  // Response types
  export interface UploadUrlResponse {
    uploadURL: string;
    fileKey: string;
    bucketName: string;
    fileURL: string;
  }
  
  export interface ErrorResponse {
    error: string;
  }