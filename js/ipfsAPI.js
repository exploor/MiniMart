/**
 * IPFS API Module
 * Handles Pinata IPFS integration for file and JSON uploads
 */

class IPFSAPI {
  constructor() {
    // Pinata configuration - CHANGE THESE TO YOUR KEYS
    this.pinataJWT = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySW5mb3JtYXRpb24iOnsiaWQiOiIyOGNlYWNkZC01Yjc4LTQ4NjktYWVhNy0yOWIxZmRkNjcwYTAiLCJlbWFpbCI6InRyYWRlc3ByaW9yQGdtYWlsLmNvbSIsImVtYWlsX3ZlcmlmaWVkIjp0cnVlLCJwaW5fcG9saWN5Ijp7InJlZ2lvbnMiOlt7ImRlc2lyZWRSZXBsaWNhdGlvbkNvdW50IjoxLCJpZCI6IkZSQTEifSx7ImRlc2lyZWRSZXBsaWNhdGlvbkNvdW50IjoxLCJpZCI6Ik5ZQzEifV0sInZlcnNpb24iOjF9LCJtZmFfZW5hYmxlZCI6ZmFsc2UsInN0YXR1cyI6IkFDVElWRSJ9LCJhdXRoZW50aWNhdGlvblR5cGUiOiJzY29wZWRLZXkiLCJzY29wZWRLZXlLZXkiOiJiN2YzMjRiODYxZmFlZmY3YjZhYiIsInNjb3BlZEtleVNlY3JldCI6IjE0MTk0ZDVkNGQ0YjgzYmQwM2UzMDAxYWQwOTk3OTZjZGI3OTk3YmY2NTU1MzkzZmNjNWJmMDk5ZmZhMTYxMjciLCJleHAiOjE3OTIxNDk5NDV9.GTeZVQMu2c34ibj0Ym55hgJF5MrW3yKxnpqqUwdFz1Q';
    this.pinataEndpoint = 'https://api.pinata.cloud';
    this.pinataGateway = 'https://gateway.pinata.cloud/ipfs';

    // Fallback gateways
    this.gateways = [
        this.pinataGateway,
        'https://ipfs.io/ipfs',
        'https://cloudflare-ipfs.com/ipfs'
    ];

    this.retryAttempts = 3;
    this.retryDelay = 1000; // 1 second
  }

  /**
   * Upload file to IPFS via Pinata
   * @param {File|Blob} file - File to upload
   * @param {number} maxSizeMB - Maximum file size in MB
   * @returns {Promise<string>} IPFS hash (CID)
   */
  async uploadFile(file, maxSizeMB = CONFIG.MAX_ZIP_SIZE_MB) {
    try {
      if (!file) {
        throw new Error('No file provided');
      }

      // Validate file size
      const fileSizeMB = file.size / (1024 * 1024);
      if (fileSizeMB > maxSizeMB) {
        throw new Error(`File size ${fileSizeMB.toFixed(2)}MB exceeds maximum ${maxSizeMB}MB`);
      }

      console.log('📤 Uploading to Pinata:', file.name, `${fileSizeMB.toFixed(2)}MB`);

      const formData = new FormData();
      formData.append('file', file);

      // Add metadata
      const metadata = {
        name: file.name || 'minidev-upload',
        keyvalues: {
          app: CONFIG.APP_NAME,
          uploaded_at: Date.now().toString()
        }
      };
      formData.append('pinataMetadata', JSON.stringify(metadata));

      const response = await this._makeRequest('/pinning/pinFileToIPFS', formData);

      if (response.IpfsHash) {
        console.log('✅ Uploaded to IPFS:', response.IpfsHash);
        return response.IpfsHash;
      }

      throw new Error('Failed to upload file to IPFS');
    } catch (error) {
      console.error('❌ IPFS upload failed:', error);
      throw new Error(`File upload failed: ${error.message}`);
    }
  }

  /**
   * Make HTTP request to Pinata API with retry logic
   * @private
   * @param {string} endpoint - API endpoint
   * @param {Object} formData - FormData object
   * @returns {Promise<Object>} API response
   */
  async _makeRequest(endpoint, formData) {
    try {
        const url = `${this.pinataEndpoint}${endpoint}`;

        const response = await fetch(url, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${this.pinataJWT}`
            },
            body: formData
        });

        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`Pinata API error: ${errorText}`);
        }

        return await response.json();
    } catch (error) {
        console.error('Pinata upload failed:', error);
        throw error;
    }
  }
}

// Export singleton instance
const ipfsAPI = new IPFSAPI();
window.ipfsAPI = ipfsAPI;
console.log('IPFS API loaded and ready');

