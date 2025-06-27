import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { APIGatewayProxyEvent, APIGatewayProxyResult } from "aws-lambda";

// Initialize the S3 client
const s3Client = new S3Client({ region: process.env.AWS_REGION });
const BUCKET_NAME = process.env.BUCKET_NAME || '';
const URL_EXPIRATION = 300; // URL expires in 5 minutes (300 seconds)

// Define types for our request body
interface UploadUrlRequest {
  fileName: string;
  fileType: string;
}

// Define types for our response
interface UploadUrlResponse {
  uploadURL: string;
  fileKey: string;
  bucketName: string;
  fileURL: string;
}

interface ErrorResponse {
  error: string;
}

export const handler = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
  try {
    // Parse request body
    const body = event.body ? JSON.parse(event.body) as UploadUrlRequest : {} as UploadUrlRequest;
    const { fileName, fileType } = body;
    
    if (!fileName || !fileType) {
      return formatResponse<ErrorResponse>(400, {
        error: "fileName and fileType are required"
      });
    }
    
    // Create a unique key for the file
    const fileKey = `uploads/${Date.now()}-${fileName}`;
    
    // Create parameters for presigned URL
    const params = {
      Bucket: BUCKET_NAME,
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
      bucketName: BUCKET_NAME,
      fileURL: `https://${BUCKET_NAME}.s3.amazonaws.com/${fileKey}`
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