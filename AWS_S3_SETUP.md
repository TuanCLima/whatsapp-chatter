# AWS S3 Setup Guide

This guide will walk you through setting up AWS S3 for storing tool images in your application.

## Prerequisites

- AWS Account (Free tier available)
- AWS CLI (optional, but recommended)

## Step 1: Create an S3 Bucket

1. **Log in to AWS Console**: https://console.aws.amazon.com/
2. **Navigate to S3**: Search for "S3" in the services menu
3. **Create Bucket**:
   - Click "Create bucket"
   - **Bucket name**: Choose a unique name (e.g., `your-app-tool-images`)
   - **Region**: Choose the closest region to your users (e.g., `us-east-1`, `sa-east-1` for Brazil)
   - **Block Public Access settings**: 
     - ⚠️ **Uncheck** "Block all public access" if you want images to be publicly accessible
     - Or keep it checked if you want to use signed URLs (more secure, but requires code changes)
   - **Bucket Versioning**: Optional (Disable to save costs)
   - **Tags**: Optional
   - **Default encryption**: Enable (SSE-S3 is free)
   - Click "Create bucket"

## Step 2: Configure CORS (Important!)

Your frontend needs to access images from S3. Configure CORS:

1. Go to your bucket
2. Click the "Permissions" tab
3. Scroll to "Cross-origin resource sharing (CORS)"
4. Click "Edit" and paste:

```json
[
    {
        "AllowedHeaders": ["*"],
        "AllowedMethods": ["GET", "HEAD"],
        "AllowedOrigins": ["*"],
        "ExposeHeaders": ["ETag"],
        "MaxAgeSeconds": 3000
    }
]
```

5. Click "Save changes"

## Step 3: Create IAM User with S3 Access

1. **Navigate to IAM**: Search for "IAM" in the services menu
2. **Create User**:
   - Click "Users" → "Create user"
   - **User name**: `s3-tool-images-uploader` (or any name)
   - **Access type**: Check "Access key - Programmatic access"
   - Click "Next"

3. **Set Permissions**:
   - Select "Attach policies directly"
   - Search for "S3" in the filter
   - Select **`AmazonS3FullAccess`** (for simplicity) or create a custom policy (recommended for production)
   - Click "Next" → "Create user"

4. **Save Credentials**:
   - ⚠️ **IMPORTANT**: Copy the **Access key ID** and **Secret access key**
   - You won't be able to see the secret key again!

### Alternative: Custom IAM Policy (More Secure)

Instead of `AmazonS3FullAccess`, create a custom policy:

```json
{
    "Version": "2012-10-17",
    "Statement": [
        {
            "Effect": "Allow",
            "Action": [
                "s3:PutObject",
                "s3:GetObject",
                "s3:DeleteObject",
                "s3:ListBucket"
            ],
            "Resource": [
                "arn:aws:s3:::your-bucket-name/*",
                "arn:aws:s3:::your-bucket-name"
            ]
        }
    ]
}
```

Replace `your-bucket-name` with your actual bucket name.

## Step 4: Add Environment Variables

Add these variables to your `.env` file:

```env
# AWS S3 Configuration
AWS_REGION=us-east-1
AWS_S3_BUCKET=your-bucket-name
AWS_ACCESS_KEY_ID=AKIA...
AWS_SECRET_ACCESS_KEY=your-secret-key
```

**On Render.com** (or your deployment platform):
1. Go to your service settings
2. Navigate to "Environment" → "Environment Variables"
3. Add each variable above
4. Redeploy your service

## Step 5: Make Bucket Public (Optional)

If you want images to be directly accessible via URL:

1. Go to your bucket → "Permissions" tab
2. Scroll to "Bucket policy"
3. Click "Edit" and paste:

```json
{
    "Version": "2012-10-17",
    "Statement": [
        {
            "Sid": "PublicReadGetObject",
            "Effect": "Allow",
            "Principal": "*",
            "Action": "s3:GetObject",
            "Resource": "arn:aws:s3:::your-bucket-name/*"
        }
    ]
}
```

Replace `your-bucket-name` with your actual bucket name.

## Cost Estimation (Free Tier)

AWS S3 Free Tier (first 12 months):
- **5 GB** of standard storage
- **20,000 GET** requests per month
- **2,000 PUT** requests per month

After free tier:
- **Storage**: ~$0.023 per GB/month (us-east-1)
- **PUT requests**: $0.005 per 1,000 requests
- **GET requests**: $0.0004 per 1,000 requests

**Example**: Storing 100 images (~500MB total) with 10,000 views/month:
- Storage: $0.023 × 0.5 = **$0.01/month**
- Requests: Negligible
- **Total**: ~**$0.01 - $0.05/month** 💰

## Testing

After setup, restart your application and try uploading an image tool. The image should now be stored in S3!

You can verify by:
1. Going to your S3 bucket in AWS Console
2. Checking the `tool-images/` folder
3. Clicking on an image to see its URL

## Troubleshooting

### "Access Denied" Error
- Check that your IAM user has the correct permissions
- Verify that `AWS_ACCESS_KEY_ID` and `AWS_SECRET_ACCESS_KEY` are correct
- Ensure your bucket policy allows public access (if needed)

### "Bucket not found" Error
- Verify `AWS_S3_BUCKET` environment variable matches your bucket name exactly
- Ensure `AWS_REGION` is correct

### Images not loading in browser
- Check CORS configuration
- Verify bucket is public (or bucket policy allows public read)
- Check browser console for CORS errors

## Security Best Practices

1. **Never commit AWS credentials** to git
2. Use IAM policies with minimal required permissions
3. Enable bucket versioning for important data
4. Consider using CloudFront CDN for better performance
5. Regularly rotate IAM access keys
6. Enable MFA for AWS account

## Need Help?

- AWS S3 Documentation: https://docs.aws.amazon.com/s3/
- AWS Free Tier: https://aws.amazon.com/free/
