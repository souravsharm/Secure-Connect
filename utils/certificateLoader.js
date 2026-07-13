import axios from 'axios';
import https from 'https';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename); // / Get the directory name of the current module i.e. path till /utils

// Load environment variables with correct path
dotenv.config({ path: path.join(__dirname, '..', 'config', 'secrets.env') });



/**
 * Create axios instance with Gallagher API authentication for .NET environment
 * @param {Object} baseConfig - Base axios configuration
 * @returns {Object} Configured axios instance
*/
export function createGallagherAxiosInstance(baseConfig = {}) {
  const apiKey = process.env.GALLAGHER_API_KEY;
  const apiUrl = process.env.GALLAGHER_API_URL;
  const certPath = path.resolve(__dirname, process.env.CLIENT_CERT_PATH);
  const pfx = fs.readFileSync(certPath);
  const passphrase = process.env.CERT_PASSPHRASE;
  
  
  console.log('   Loading Gallagher API Configuration:');
  console.log('   API URL:', apiUrl);
  console.log('   API Key:', apiKey ? `${apiKey.substring(0, 8)}...` : 'NOT FOUND');

  
  if (!apiKey) {
    console.error('❌ GALLAGHER_API_KEY not found in environment variables');
    throw new Error('GALLAGHER_API_KEY is required');
  }
  
  if (!pfx) {
    console.error('❌ CERTIFICATE_PATH not found in environment variables');
    throw new Error('CERTIFICATE_PATH is required');
  }

  if (!apiUrl) {
    console.error('❌ GALLAGHER_API_URL not found in environment variables');
    throw new Error('GALLAGHER_API_URL is required');
  }

  // Create HTTPS agent for .NET server with proper SSL configuration
  const httpsAgent = new https.Agent({
    pfx: pfx,
    passphrase: passphrase,
    rejectUnauthorized: process.env.SSL_REJECT_UNAUTHORIZED === 'true'
  });

  const instance = axios.create({
    baseURL: apiUrl,
    httpsAgent: httpsAgent,
    timeout: 30000, // 30 second timeout
    headers: {
      'Authorization': `GGL-API-KEY ${apiKey}`,
      'Content-Type': 'application/json'
    },
    ...baseConfig
  });


  return instance;
}

/**
 * Get Gallagher API configuration object
 * @returns {Object} Gallagher API configuration
 */
export function getGallagherConfig() {
  return {
    baseURL: process.env.GALLAGHER_API_URL,
    apiKey: process.env.GALLAGHER_API_KEY,
  };
}

/**
 * Create headers for Gallagher API requests (consistent format)
 * @param {Object} additionalHeaders - Additional headers to include
 * @returns {Object} Headers object
 */
export function createGallagherHeaders(additionalHeaders = {}) {
  return {
    'Authorization': `GGL-API-KEY ${process.env.GALLAGHER_API_KEY}`,
    'Content-Type': 'application/json',
    ...additionalHeaders
  };
}

