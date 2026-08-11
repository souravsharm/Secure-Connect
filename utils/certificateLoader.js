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
  const passphrase = process.env.CERT_PASSPHRASE;

  // Client certificate is optional: only load one if CLIENT_CERT_PATH is set and
  // the file exists. Gallagher CC can be configured to accept REST clients with
  // no certificate ("enable clients with no certificate"), in which case we just
  // rely on the GGL-API-KEY header for authentication.
  let pfx;
  if (process.env.CLIENT_CERT_PATH) {
    const certPath = path.resolve(__dirname, process.env.CLIENT_CERT_PATH);
    if (fs.existsSync(certPath)) {
      pfx = fs.readFileSync(certPath);
    } else {
      console.warn(`⚠️  CLIENT_CERT_PATH is set but no file was found at ${certPath}; continuing without a client certificate`);
    }
  }

  console.log('   Loading Gallagher API Configuration:');
  console.log('   API URL:', apiUrl);
  console.log('   API Key:', apiKey ? `${apiKey.substring(0, 8)}...` : 'NOT FOUND');
  console.log('   Client certificate:', pfx ? 'loaded' : 'none (relying on API key only)');

  if (!apiKey) {
    console.error('❌ GALLAGHER_API_KEY not found in environment variables');
    throw new Error('GALLAGHER_API_KEY is required');
  }

  if (!apiUrl) {
    console.error('❌ GALLAGHER_API_URL not found in environment variables');
    throw new Error('GALLAGHER_API_URL is required');
  }

  // Create HTTPS agent with proper SSL configuration. pfx/passphrase are
  // omitted entirely when no client certificate is configured.
  const httpsAgent = new https.Agent({
    ...(pfx ? { pfx, passphrase } : {}),
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

