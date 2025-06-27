import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { APIGatewayProxyEvent, APIGatewayProxyResult } from "aws-lambda";

// Initialize the S3 client
const s3Client = new S3Client({ region: process.env.AWS_REGION });
const URL_EXPIRATION = 300; // URL expires in 5 minutes (300 seconds)

const APP_BUCKETS: Record<string, string> = {
  'question': process.env.QUESTION_BUCKET || '',
  'exam': process.env.EXAM_BUCKET || '',
  'books': process.env.BOOKS_BUCKET || ''
};

// Define types for our request body
interface UploadUrlRequest {
  fileName: string;
  fileType: string;
  appName: string; // New field to specify which app
  folder?: string; // Optional subfolder within the app bucket
}

// Define types for our response
interface UploadUrlResponse {
  uploadURL: string;
  fileKey: string;
  bucketName: string;
  fileURL: string;
  appName: string;
}

interface ErrorResponse {
  error: string;
}

export const handler = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
  try {
    // Parse request body
    const body = event.body ? JSON.parse(event.body) as UploadUrlRequest : {} as UploadUrlRequest;
    const { fileName, fileType, appName, folder } = body;

    // Validate required fields
    if (!fileName || !fileType || !appName) {
      return formatResponse<ErrorResponse>(400, {
        error: "fileName, fileType, and appName are required"
      });
    }
    
    // Validate app name
    if (!APP_BUCKETS[appName]) {
      return formatResponse<ErrorResponse>(400, {
        error: `Invalid appName. Allowed values: ${Object.keys(APP_BUCKETS).join(', ')}`
      });
    }

    const bucketName = APP_BUCKETS[appName];
    
    if (!bucketName) {
      return formatResponse<ErrorResponse>(500, {
        error: `Bucket not configured for app: ${appName}`
      });
    }
    
    // Create a unique key for the file with optional folder structure
    const timestamp = Date.now();
    const sanitizedFileName = fileName.replace(/[^a-zA-Z0-9.-]/g, '_');
    const basePath = folder ? `${folder}/${timestamp}-${sanitizedFileName}` : `uploads/${timestamp}-${sanitizedFileName}`;
    const fileKey = `${appName}/${basePath}`;
    
    // Create parameters for presigned URL
    const params = {
      Bucket: bucketName,
      Key: fileKey,
      ContentType: fileType
    };
    
    // Create the command
    const command = new PutObjectCommand(params);
    
    // Generate the presigned URL
    const uploadURL = await getSignedUrl(s3Client, command, { 
      expiresIn: URL_EXPIRATION 
    });
    
    // Return the presigned URL and the file location info
    return formatResponse<UploadUrlResponse>(200, {
      uploadURL,
      fileKey,
      bucketName,
      fileURL: `https://${bucketName}.s3.amazonaws.com/${fileKey}`,
      appName
    });
    
  } catch (error) {
    console.error("Error generating presigned URL:", error);
    
    return formatResponse<ErrorResponse>(500, {
      error: "Error generating upload URL"
    });
  }
};

// Helper function to format responses
export function formatResponse<T>(statusCode: number, body: T): APIGatewayProxyResult {
  return {
    statusCode,
    headers: {
      "Content-Type": "application/json",
      "Access-Control-Allow-Origin": "*"
    },
    body: JSON.stringify(body)
  };
}