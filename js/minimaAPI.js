/**
 * Minima API Wrapper Module
 * Clean wrapper around Minima MDS API for blockchain interactions in MiniDapps
 */

console.log('MiniDev: minimaAPI.js loading started');

try {
class MinimaAPI {
  constructor() {
    this.currentAddress = null;
    this.balance = null;
    this.isReady = false;
  }

  /**
   * Initialize MDS connection
   * @returns {Promise<void>}
   */
  async init() {
    return new Promise((resolve) => {
      console.log('MiniDev: Initializing MDS connection...');

      // Check if we're potentially in a Minima MiniDapp environment
      const isMinimaEnvironment = window.location.protocol === 'https:' &&
                                  (window.location.hostname === '127.0.0.1' || window.location.hostname === 'localhost');

      console.log('MiniDev: Environment check:', {
        timestamp: new Date().toISOString(),
        protocol: window.location.protocol,
        hostname: window.location.hostname,
        port: window.location.port,
        pathname: window.location.pathname,
        fullURL: window.location.href,
        isMinimaEnvironment,
        mdsExists: typeof MDS !== 'undefined',
        hasMDSInit: typeof MDS !== 'undefined' && typeof MDS.init === 'function',
        hasMDSCmd: typeof MDS !== 'undefined' && typeof MDS.cmd === 'function',
        scripts: Array.from(document.scripts || []).map(s => s.src).filter(src => src && (src.includes('mds') || src.includes('minima'))),
        readyState: document.readyState
      });

      // Check if MDS is available
      if (typeof MDS === 'undefined') {
        console.warn('MiniDev: MDS not available - checking environment...');

        if (isMinimaEnvironment) {
          console.log('MiniDev: Waiting for MDS to load (could be slow script load)...');
          console.log('MiniDev: Will check every 200ms for up to 10 seconds...');
          // Wait for MDS script to load
          let attempts = 0;
          const waitForMDS = () => {
            attempts++;
            if (typeof MDS !== 'undefined' && typeof MDS.init === 'function') {
              console.log('MiniDev: ✓ MDS loaded after waiting, initializing...');
              this.initializeMDS(resolve);
            } else if (attempts < 50) { // Wait up to 10 seconds (50 * 200ms)
              if (attempts % 5 === 0) {
                console.log(`MiniDev: Still waiting for MDS... (attempt ${attempts}/50)`);
              }
              setTimeout(waitForMDS, 200);
            } else {
              console.error('MiniDev: ❌ MDS not available after 10 seconds - entering development mode');
              console.error('');
              console.error('═══════════════════════════════════════════════════════════════');
              console.error('  MDS NOT DETECTED - TROUBLESHOOTING GUIDE');
              console.error('═══════════════════════════════════════════════════════════════');
              console.error('');
              console.error('You are accessing this MiniDapp via the correct URL, but the MDS');
              console.error('object is not available. This usually means MDS commands need');
              console.error('to be confirmed or MDS is not fully enabled.');
              console.error('');
              console.error('STEP 1: Check if you have pending confirmations');
              console.error('  In your Minima CLI, run:');
              console.error('    pending action:list');
              console.error('');
              console.error('  If you see pending MDS commands, confirm them:');
              console.error('    pending action:confirm uid:0xYOUR_UID_HERE');
              console.error('');
              console.error('STEP 2: Enable MDS (if not already enabled)');
              console.error('  Run this in your Minima CLI:');
              console.error('    mds action:enable');
              console.error('');
              console.error('  Then confirm the pending command:');
              console.error('    pending action:list');
              console.error('    pending action:confirm uid:0xYOUR_UID_HERE');
              console.error('');
              console.error('STEP 3: Check MDS password is set');
              console.error('  Run: mds');
              console.error('  You should see a password value (not null)');
              console.error('');
              console.error('STEP 4: Reload this page after completing the above steps');
              console.error('');
              console.error('For more help, see: https://docs.minima.global/docs/runanode/mds_commands');
              console.error('═══════════════════════════════════════════════════════════════');
              console.error('');
              this.isReady = true;
              this.developmentMode = true;

              // Store the error state so we can show it in UI
              this.mdsError = 'MDS_NOT_AVAILABLE';
              resolve();
            }
          };
          waitForMDS();
        } else {
          // Not in Minima environment - development mode
          console.warn('MiniDev: Not in Minima environment (expected https://127.0.0.1:9003 or https://localhost:9003)');
          console.warn('MiniDev: Running in development mode');
          this.isReady = true;
          this.developmentMode = true;
          resolve();
        }
        return;
      }

      // MDS is available - check if it has the required methods
      if (typeof MDS.init !== 'function') {
        console.error('MiniDev: MDS object exists but MDS.init is not a function');
        this.isReady = true;
        this.developmentMode = true;
        resolve();
        return;
      }

      // MDS is fully available - initialize it
      console.log('MiniDev: MDS detected, calling MDS.init()...');
      this.initializeMDS(resolve);
    });
  }

  /**
   * Initialize MDS once it's available
   * @private
   */
  initializeMDS(resolve) {
    console.log('MiniDev: Calling MDS.init() with callback...');

    try {
      MDS.init((msg) => {
        console.log('MiniDev: MDS message received:', msg);

        if (msg.event === 'inited') {
          this.isReady = true;
          this.developmentMode = false;
          console.log('MiniDev: ✓ MDS initialized successfully - Production mode active');
          console.log('MiniDev: You are connected to your Minima node!');
          resolve();
        } else if (msg.event === 'MDS_PENDING') {
          console.log('MiniDev: MDS initialization pending...');
        } else if (msg.event === 'MDS_SHUTDOWN') {
          console.warn('MiniDev: MDS shutdown detected');
          this.isReady = false;
        } else if (msg.event === 'MINIMA_LOG') {
          // Minima log messages - can be useful for debugging
          console.log('MiniDev: Minima log:', msg.info);
        } else {
          // Other events - log for debugging
          console.log('MiniDev: MDS event:', msg.event, msg);
        }
      });
    } catch (error) {
      console.error('MiniDev: Error calling MDS.init():', error);
      console.error('MiniDev: Stack trace:', error.stack);
      this.isReady = true;
      this.developmentMode = true;
      resolve(); // Don't reject, just fall back to dev mode
    }
  }

  /**
   * Get user's current Minima address
   * @returns {Promise<string>} User's Minima address
   */
  async getCurrentAddress() {
    try {
      if (!this.isReady) {
        await this.init();
      }

      if (this.developmentMode) {
        // In development mode, try to get from localStorage first
        const storedAddress = localStorage.getItem('minidev_address');
        if (storedAddress) {
          this.currentAddress = storedAddress;
          return storedAddress;
        }

        // Generate a mock address for development
        this.currentAddress = 'MxDEV1234567890ABCDEFGH1234567890ABCDEFGH';
        // Store it for consistency across sessions
        localStorage.setItem('minidev_address', this.currentAddress);
        return this.currentAddress;
      }

      // For real Minima node, get current address
      const result = await this._mdsCommand('getaddress');
      if (result.response && result.response.address) {
        this.currentAddress = result.response.address;

        // Check if we have a stored persistent ID, if not create one
        let persistentId = localStorage.getItem('minidev_persistent_id');
        if (!persistentId) {
          // Use the first address we get as the persistent identifier
          persistentId = result.response.address;
          localStorage.setItem('minidev_persistent_id', persistentId);
          console.log('Created persistent ID for profile storage:', persistentId);
        }

        return result.response.address;
      }
      throw new Error('Failed to get address from Minima node');
    } catch (error) {
      console.error('Error getting address:', error);
      throw new Error(`Failed to get Minima address: ${error.message}`);
    }
  }

  /**
   * Get persistent user ID for profile storage (doesn't change with address)
   */
  getPersistentUserId() {
    // Try to get stored persistent ID first
    const storedId = localStorage.getItem('minidev_persistent_id');
    if (storedId) {
      return storedId;
    }

    // Fallback to current address if no persistent ID
    return this.currentAddress;
  }

  /**
   * Send custom transaction with state data
   * @param {Object} transactionData - Transaction parameters
   * @returns {Promise<string>} Transaction ID
   */
  async sendCustomTransaction(transactionData) {
    try {
      if (!this.isReady) {
        await this.init();
      }

      console.log('📤 Sending custom transaction:', transactionData);

      // Build the MDS command for custom transaction
      let command = 'send ';

      if (transactionData.amount) {
        command += `amount:${transactionData.amount} `;
      }

      if (transactionData.address) {
        command += `address:${transactionData.address} `;
      }

      if (transactionData.state) {
        // Convert state object to Minima's expected format
        // Minima expects state as {"port": "data"} where port is a string number like "0", "1", etc.
        const stateObj = {
          "0": JSON.stringify(transactionData.state)
        };
        command += ` state:${JSON.stringify(stateObj)}`;
      }

      console.log('🔧 MDS command:', command);

      const result = await this._mdsCommand(command);
      console.log('✅ Transaction sent:', result);

      if (result.response && result.response.txpowid) {
        return result.response.txpowid;
      }

      throw new Error('Transaction failed - no txpowid returned');
    } catch (error) {
      console.error('❌ Custom transaction failed:', error);
      throw new Error(`Transaction failed: ${error.message}`);
    }
  }

  /**
   * Get user's MINIMA balance
   * @returns {Promise<number>} Balance in MINIMA
   */
  async getBalance() {
    try {
      if (!this.isReady) {
        await this.init();
      }

      if (this.developmentMode) {
        // For development, try to get from localStorage first
        const storedBalance = localStorage.getItem('minidev_balance');
        if (storedBalance) {
          this.balance = parseFloat(storedBalance);
          return this.balance;
        }

        // Mock balance for development
        this.balance = 100.5;
        return this.balance;
      }

      const result = await this._mdsCommand('balance');

      // The real Minima API returns an array of token balances
      if (result.response && Array.isArray(result.response)) {
        // Find the Minima token in the response array
        const minimaToken = result.response.find(token =>
          token.token === 'Minima' || token.tokenid === '0x00'
        );

        if (minimaToken && minimaToken.confirmed) {
          this.balance = parseFloat(minimaToken.confirmed);
          console.log('MiniDev: Balance retrieved:', this.balance, 'MINIMA');
          return this.balance;
        }
      }

      // Fallback for old mock response format
      if (result.response && result.response.balance) {
        this.balance = parseFloat(result.response.balance);
        return this.balance;
      }

      throw new Error('Failed to get balance from Minima node');
    } catch (error) {
      console.error('Error getting balance:', error);
      throw new Error(`Failed to get balance: ${error.message}`);
    }
  }

  /**
   * Set user's address manually (for development/testing)
   * @param {string} address - Minima address to set
   */
  setManualAddress(address) {
    if (address && address.startsWith('Mx') && address.length >= 30) {
      this.currentAddress = address;
      localStorage.setItem('minidev_address', address);
      console.log('Manual address set:', address);
      return true;
    }
    return false;
  }

  /**
   * Set user's balance manually (for development/testing)
   * @param {number} balance - Balance to set
   */
  setManualBalance(balance) {
    if (typeof balance === 'number' && balance >= 0) {
      this.balance = balance;
      localStorage.setItem('minidev_balance', balance.toString());
      console.log('Manual balance set:', balance);
      return true;
    }
    return false;
  }

  /**
   * Send transaction with custom state
   * @param {number} amount - Amount in MINIMA
   * @param {string} toAddress - Recipient address
   * @param {Object} customState - Custom JSON state for transaction
   * @returns {Promise<string>} Transaction ID
   */
  async sendTransaction(amount, toAddress, customState = {}) {
    try {
      if (!this.isReady) {
        await this.init();
      }

      // Validate inputs
      if (!amount || amount <= 0) {
        throw new Error('Invalid amount: must be greater than 0');
      }
      if (!toAddress || !toAddress.startsWith('Mx')) {
        throw new Error('Invalid recipient address');
      }

      // Check balance first
      const balance = await this.getBalance();
      if (balance < amount) {
        throw new Error(`Insufficient balance. Have: ${balance} MINIMA, Need: ${amount} MINIMA`);
      }

      if (this.developmentMode) {
        // Mock successful transaction for development
        const mockTxId = '0x' + Math.random().toString(16).substr(2, 64);
        console.log('Mock transaction sent:', mockTxId, customState);
        return mockTxId;
      }

      // Create transaction command
      let command = `send amount:${amount} address:${toAddress}`;

      // Add custom state if provided
      if (Object.keys(customState).length > 0) {
        const stateStr = JSON.stringify(customState);
        command += ` state:${stateStr}`;
      }

      const result = await this._mdsCommand(command);

      if (result.response && result.response.txpowid) {
        console.log('Transaction sent:', result.response.txpowid, customState);
        return result.response.txpowid;
      }

      throw new Error(result.error || result.message || 'Transaction failed');
    } catch (error) {
      console.error('Error sending transaction:', error);
      throw new Error(`Transaction failed: ${error.message}`);
    }
  }

  /**
   * Send transaction to treasury with action metadata
   * @param {number} amount - Amount in MINIMA
   * @param {string} action - Action description (e.g., "profile_creation", "post_creation")
   * @returns {Promise<string>} Transaction ID
   */
  async sendToTreasury(amount, action) {
    try {
      // Check balance first
      const balance = await this.getBalance();
      if (balance < amount) {
        throw new Error(`Insufficient balance for treasury payment. Have: ${balance} MINIMA, Need: ${amount} MINIMA`);
      }

      const customState = {
        app: CONFIG.APP_NAME,
        action: action,
        amount: amount,
        timestamp: Date.now()
      };

      return await this.sendTransaction(amount, CONFIG.TREASURY_ADDRESS, customState);
    } catch (error) {
      console.error('Error sending to treasury:', error);
      throw error;
    }
  }

  /**
   * Scan blockchain for MiniDev transactions
   * @param {Object} filter - Optional filter object
   * @returns {Promise<Array>} Array of transactions with custom state
   */
  async scanChain(filter = {}) {
    try {
      if (!this.isReady) {
        await this.init();
      }

      if (this.developmentMode) {
        // Mock transactions for development
        return [
          {
            txpowid: '0x1234567890abcdef',
            address: 'MxTEST1234567890ABCDEFGH1234567890ABCDEFGH',
            state: JSON.stringify({
              app: 'minidev',
              type: 'profile',
              nickname: 'TestDev',
              bio: 'Test developer profile',
              avatar_ipfs: null,
              created_at: Date.now() - 86400000
            })
          },
          {
            txpowid: '0xabcdef1234567890',
            address: 'MxTEST1234567890ABCDEFGH1234567890ABCDEFGH',
            state: JSON.stringify({
              app: 'minidev',
              type: 'post',
              title: 'Welcome to MiniDev!',
              content_ipfs: 'QmTestContent123',
              media_type: 'none',
              timestamp: Date.now() - 3600000
            })
          }
        ];
      }

      // Use history command to find recent transactions
      // We'll filter them client-side for MiniDev state
      const searchCommand = 'history max:100';
      const result = await this._mdsCommand(searchCommand);

      if (result.response && Array.isArray(result.response)) {
        // Filter TxPoW objects that have MiniDev state in their outputs
        const minidevTxs = [];

        result.response.forEach(txpow => {
          try {
            if (txpow.body && txpow.body.txn && txpow.body.txn.outputs) {
              // Check each output for MiniDev state
              txpow.body.txn.outputs.forEach((output, index) => {
                if (output.state && Array.isArray(output.state)) {
                  output.state.forEach(stateVar => {
                    try {
                      if (stateVar.value && stateVar.value !== '0x') {
                        const stateValue = JSON.parse(stateVar.value);
                        if (stateValue.app === CONFIG.APP_NAME) {
                          // Found a MiniDev transaction
                          minidevTxs.push({
                            txpowid: txpow.txpowid,
                            address: output.address,
                            state: stateVar.value,
                            outputIndex: index,
                            block: txpow.body.block,
                            timestamp: txpow.body.header.dates.millisecond
                          });
                        }
                      }
                    } catch (e) {
                      // Not valid JSON, skip
                    }
                  });
                }
              });
            }
          } catch (e) {
            // Skip malformed transactions
          }
        });

        return minidevTxs;
      }

      return [];
    } catch (error) {
      console.error('Error scanning chain:', error);
      return [];
    }
  }

  /**
   * Get node status and health check
   * @returns {Promise<Object>} Node status information
   */
  async getNodeStatus() {
    try {
      if (!this.isReady) {
        await this.init();
      }

      if (this.developmentMode) {
        // Mock node status for development
        return {
          version: '1.0.45.15 (Development)',
          uptime: 'Development Mode',
          locked: false,
          chain: { block: 999999 }
        };
      }

      const result = await this._mdsCommand('status');
      if (result.response) {
        return result.response;
      }
      throw new Error('Failed to get node status');
    } catch (error) {
      console.error('Error getting node status:', error);
      throw new Error(`Node status check failed: ${error.message}`);
    }
  }

  /**
   * Send Maxima message to another user
   * @param {string} publicKey - Recipient's Maxima public key
   * @param {string} message - Message content
   * @returns {Promise<Object>} Maxima message result
   */
  async sendMaximaMessage(publicKey, message) {
    try {
      if (!this.isReady) {
        await this.init();
      }


      const command = `maxima action:send to:${publicKey} message:"${message.replace(/"/g, '\\"')}"`;
      const result = await this._mdsCommand(command);

      if (result.status) {
        console.log('Maxima message sent:', result.response);
        return result;
      }

      throw new Error(result.error || 'Failed to send Maxima message');
    } catch (error) {
      console.error('Error sending Maxima message:', error);
      throw new Error(`Failed to send message: ${error.message}`);
    }
  }

  /**
   * Get Maxima contact list
   * @returns {Promise<Array>} Array of Maxima contacts
   */
  async getMaximaContacts() {
    try {
      if (!this.isReady) {
        await this.init();
      }


      const result = await this._mdsCommand('maxima action:contacts');
      if (result.status && result.response) {
        return result.response.contacts || [];
      }

      return [];
    } catch (error) {
      console.error('Error getting Maxima contacts:', error);
      return [];
    }
  }

  /**
   * Get Maxima messages
   * @param {string} [publicKey] - Optional filter by specific contact
   * @param {number} [limit] - Maximum number of messages to return
   * @returns {Promise<Array>} Array of Maxima messages
   */
  async getMaximaMessages(publicKey = null, limit = 50) {
    try {
      if (!this.isReady) {
        await this.init();
      }


      let command = 'maxima action:messages';
      if (publicKey) {
        command += ` publickey:${publicKey}`;
      }
      command += ` limit:${limit}`;

      const result = await this._mdsCommand(command);
      if (result.status && result.response) {
        return result.response.messages || [];
      }

      return [];
    } catch (error) {
      console.error('Error getting Maxima messages:', error);
      return [];
    }
  }

  /**
   * Get Maxima info (public key, etc.)
   * @returns {Promise<Object>} Maxima information
   */
  async getMaximaInfo() {
    try {
      if (!this.isReady) {
        await this.init();
      }


      const result = await this._mdsCommand('maxima action:info');
      if (result.status && result.response) {
        return result.response;
      }

      throw new Error('Failed to get Maxima info');
    } catch (error) {
      console.error('Error getting Maxima info:', error);
      throw new Error(`Failed to get Maxima info: ${error.message}`);
    }
  }

  /**
   * Set Maxima name
   * @param {string} name - Name to set
   * @returns {Promise<Object>} Result
   */
  async setMaximaName(name) {
    try {
      if (!this.isReady) {
        await this.init();
      }


      const command = `maxima action:name name:"${name.replace(/"/g, '\\"')}"`;
      const result = await this._mdsCommand(command);

      if (result.status) {
        return result;
      }

      throw new Error(result.error || 'Failed to set Maxima name');
    } catch (error) {
      console.error('Error setting Maxima name:', error);
      throw new Error(`Failed to set name: ${error.message}`);
    }
  }

  /**
   * Execute MDS command
   * @param {string} command - MDS command to execute
   * @returns {Promise<Object>} MDS response
   */
  async cmd(command) {
    return this._mdsCommand(command);
  }

  /**
   * Send Minima to an address
   * @param {string} amount - Amount to send (e.g., "0.01")
   * @param {string} address - Recipient address
   * @param {string} tokenid - Token ID (default: "0x00" for Minima)
   * @returns {Promise<Object>} Transaction result
   */
  async send(amount, address, tokenid = "0x00") {
    const command = `send amount:${amount} address:${address} tokenid:${tokenid}`;
    return this.cmd(command);
  }

  /**
   * Internal method to execute MDS commands
   * @private
   * @param {string} command - MDS command to execute
   * @returns {Promise<Object>} MDS response
   */
  _mdsCommand(command) {
    return new Promise((resolve, reject) => {
      if (!this.isReady) {
        reject(new Error('API not initialized'));
        return;
      }

      if (this.developmentMode) {
        // Development mode - mock responses based on command
        setTimeout(() => {
          this._mockCommandResponse(command, resolve, reject);
        }, 100);
        return;
      }

      try {
        // Try MDS first, then Minima
        if (typeof MDS !== 'undefined' && MDS.cmd) {
          MDS.cmd(command, (response) => {
            if (response.status) {
              resolve(response);
            } else {
              reject(new Error(response.error || 'MDS command failed'));
            }
          });
        } else if (typeof Minima !== 'undefined' && Minima.cmd) {
          Minima.cmd(command, (response) => {
            if (response.status) {
              resolve(response);
            } else {
              reject(new Error(response.error || 'Minima command failed'));
            }
          });
        } else {
          reject(new Error('No API available for command execution'));
        }
      } catch (error) {
        reject(new Error(`API command execution failed: ${error.message}`));
      }
    });
  }

  /**
   * Mock command responses for development mode
   * @private
   */
  _mockCommandResponse(command, resolve, reject) {
    try {
      if (command.includes('getaddress')) {
        // Use the user's real address for testing
        resolve({
          response: {
            script: "RETURN SIGNEDBY(0x30819F300D06092A864886F70D010101050003818D00308189028181008BF0A5906D2D41EB1006BE29310BD51706AE957B38894EF2BDDE2392ED780F66BC0A14E2F2C7F4FB966EBE553E8F0A624BAE9A3C65ADFDB91D196E433B586DE2F019383B78E089FE76AF4C0CF46E1FC13DCA740251DD8F9736E2A9932D30A1B4715F9C27D4C13B0FFE167CABEAC4317C08C6471C476271766E97CB401C5E45A90203010001)",
            address: "MxG080EFPWA5187VNP2E3H63G70MZVRHWE9SYNSGMUCV77DN5699E1GY6N38575",
            miniaddress: "MxG080EFPWA5187VNP2E3H63G70MZVRHWE9SYNSGMUCV77DN5699E1GY6N38575",
            simple: true,
            default: true,
            publickey: "0x30819F300D06092A864886F70D010101050003818D00308189028181008BF0A5906D2D41EB1006BE29310BD51706AE957B38894EF2BDDE2392ED780F66BC0A14E2F2C7F4FB966EBE553E8F0A624BAE9A3C65ADFDB91D196E433B586DE2F019383B78E089FE76AF4C0CF46E1FC13DCA740251DD8F9736E2A9932D30A1B4715F9C27D4C13B0FFE167CABEAC4317C08C6471C476271766E97CB401C5E45A90203010001",
            track: true
          }
        });
      } else if (command.includes('balance')) {
        resolve({
          response: {
            balance: "11585.69"
          }
        });
      } else {
        resolve({ response: { mock: true, command } });
      }
    } catch (error) {
      reject(error);
    }
  }

  // Profile management methods - localStorage + blockchain + maxima
  async saveProfile(profileData) {
    try {
      if (!profileData) {
        throw new Error('Profile data is required');
      }

      // Get persistent user ID for consistent storage
      const userId = this.getPersistentUserId();
      if (!userId) {
        throw new Error('Unable to get persistent user ID');
      }

      // Store in localStorage for immediate access
      const storageKey = `minidev_profile_${userId}`;
      localStorage.setItem(storageKey, JSON.stringify({
        ...profileData,
        lastUpdated: Date.now(),
        storedLocally: true
      }));

      console.log('MiniDev: Profile saved to localStorage:', storageKey);

      // Broadcast via Maxima for live updates (if available)
      try {
        if (window.maximaAPI && window.maximaAPI.broadcastProfileUpdate) {
          await window.maximaAPI.broadcastProfileUpdate(profileData);
          console.log('MiniDev: Profile broadcast via Maxima');
        }
      } catch (maximaError) {
        console.warn('MiniDev: Maxima broadcast failed, but local storage succeeded:', maximaError);
        // Don't fail the entire operation if Maxima fails
      }

      return true;
    } catch (error) {
      console.error('MiniDev: Profile save failed:', error);
      throw new Error(`Failed to save profile: ${error.message}`);
    }
  }

  async loadProfile(address) {
    try {
      if (!address) {
        // If no address provided, try to use current user's persistent ID
        address = this.getPersistentUserId();
      }

      if (!address) {
        console.log('MiniDev: No address provided and no persistent ID available');
        return null;
      }

      // Try localStorage first for immediate access
      const storageKey = `minidev_profile_${address}`;
      const storedProfile = localStorage.getItem(storageKey);

      if (storedProfile) {
        try {
          const profileData = JSON.parse(storedProfile);
          console.log('MiniDev: Profile loaded from localStorage:', address);
          return profileData;
        } catch (parseError) {
          console.warn('MiniDev: Invalid profile data in localStorage, removing:', parseError);
          localStorage.removeItem(storageKey);
        }
      }

      // Fall back to blockchain query if available
      try {
        if (window.blockchainAPI && window.blockchainAPI.queryProfiles) {
          const blockchainProfiles = await window.blockchainAPI.queryProfiles(address);
          if (blockchainProfiles.length > 0) {
            // Use the most recent blockchain profile
            const blockchainProfile = blockchainProfiles.sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0))[0];
            console.log('MiniDev: Profile loaded from blockchain:', address);

            // Cache it locally for future use
            localStorage.setItem(storageKey, JSON.stringify({
              ...blockchainProfile,
              loadedFromBlockchain: true,
              cachedLocally: true
            }));

            return blockchainProfile;
          }
        }
      } catch (blockchainError) {
        console.warn('MiniDev: Blockchain profile query failed:', blockchainError);
        // Continue without blockchain data
      }

      console.log('MiniDev: No profile found for:', address);
      return null;
    } catch (error) {
      console.error('MiniDev: Profile load failed:', error);
      return null; // Return null instead of throwing to prevent UI crashes
    }
  }
}

// Export singleton instance
console.log('MiniDev: Creating minimaAPI instance');
const minimaAPI = new MinimaAPI();
console.log('MiniDev: minimaAPI instance created:', typeof minimaAPI);
window.minimaAPI = minimaAPI; // Make sure it's globally available
console.log('MiniDev: minimaAPI.js loading completed, window.minimaAPI:', typeof window.minimaAPI);

} catch (error) {
  console.error('MiniDev: Fatal error in minimaAPI.js:', error);
  console.error('MiniDev: Error stack:', error.stack);
}
