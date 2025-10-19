/**
 * Blockchain API - Permanent Layer for MiniDev
 *
 * Handles permanent on-chain records:
 * - Dapp registration (IPFS hash, name, developer address)
 * - Developer identity verification (optional)
 *
 * Cost: 0.01 Minima per dapp registration (~$0.0001)
 * Purpose: Permanent catalog that survives if Maxima network issues occur
 */

class BlockchainAPI {
    constructor() {
        this.isReady = false;
        this.minimaAPI = null;
    }

    async init(minimaAPI) {
        try {
            console.log('🔄 Initializing Blockchain API...');
            this.minimaAPI = minimaAPI;

            // Wait for Minima to be ready
            if (!minimaAPI || !minimaAPI.isReady) {
                console.log('Waiting for Minima API...');
                for (let i = 0; i < 50; i++) {
                    await new Promise(resolve => setTimeout(resolve, 100));
                    if (minimaAPI && minimaAPI.isReady) break;
                }
            }

            this.isReady = true;
            console.log('🎉 Blockchain API initialized');

            return true;
        } catch (error) {
            console.error('❌ Blockchain API init failed:', error);
            return false;
        }
    }

    /**
     * Register a user profile permanently on the blockchain
     * @param {Object} profile - Profile data
     * @returns {Promise<string>} Transaction ID
     */
    async registerProfile(profile) {
        try {
            if (!this.isReady) {
                throw new Error('Blockchain API not ready');
            }

            console.log('👤 Registering profile on blockchain:', profile.username);

            // Create transaction with profile data in state
            const transactionData = {
                amount: '0.01', // Small registration fee
                address: 'MxG086AUGQMWM6S47P6GWR2U1AV3391EPR5Q53N7DN9MGNMMN6BMH270SV8QRSC', // MiniMart Treasury
                state: {
                    type: 'minidev_profile_registration',
                    username: profile.username,
                    bio: profile.bio || '',
                    gitUrl: profile.gitUrl || null,
                    twitterUrl: profile.twitterUrl || null,
                    address: profile.address,
                    timestamp: profile.timestamp,
                    registration_fee: '0.01'
                }
            };

            console.log('🔐 Sending profile registration transaction...');
            const txId = await this.minimaAPI.sendCustomTransaction(transactionData);

            console.log('✅ Profile registered on blockchain with TX:', txId);
            return txId;

        } catch (error) {
            console.error('❌ Profile registration failed:', error);
            throw error;
        }
    }

    /**
     * Query blockchain for registered profiles
     * @param {string} address - Specific address to query (optional)
     * @returns {Promise<Array>} Array of registered profiles
     */
    async queryProfiles(address = null) {
        try {
            if (!this.isReady) {
                throw new Error('Blockchain API not ready');
            }

            console.log('🔍 Querying blockchain for profiles...');

            // Get all coins (this is a simplified approach - in production you'd filter)
            const result = await this.minimaAPI.cmd('coins relevant:false');

            if (!result.response || !result.response.coins) {
                console.log('ℹ️ No coins found');
                return [];
            }

            const profiles = [];

            for (const coin of result.response.coins) {
                // Check if this coin has profile state
                if (coin.state && Array.isArray(coin.state)) {
                    const profileState = coin.state.find(s => s.port === '0'); // Use port 0 for profile data
                    if (profileState) {
                        try {
                            const profileData = JSON.parse(profileState.data);

                            // Filter by address if specified
                            if (!address || profileData.address === address) {
                                profiles.push({
                                    ...profileData,
                                    txId: coin.coinid || coin.txpowid,
                                    block: coin.created || 'unknown'
                                });
                            }
                        } catch (e) {
                            console.warn('⚠️ Invalid profile data in coin:', coin.coinid, e);
                        }
                    }
                }
            }

            console.log(`✅ Found ${profiles.length} profiles on blockchain`);
            return profiles;

        } catch (error) {
            console.error('❌ Profile query failed:', error);
            return [];
        }
    }

    /**
     * Register a dapp permanently on the blockchain
     * @param {Object} dapp - Dapp metadata
     * @param {string} developerAddress - Developer address
     * @returns {Promise<string>} Transaction ID
     */
    async registerDapp(dapp, developerAddress) {
        try {
            if (!this.isReady) {
                throw new Error('Blockchain API not ready');
            }

            console.log('📝 Registering dapp on blockchain:', dapp.name);

            // Create transaction with dapp data in state
            const transactionData = {
                amount: '0.01', // Small registration fee
                address: 'MxG086AUGQMWM6S47P6GWR2U1AV3391EPR5Q53N7DN9MGNMMN6BMH270SV8QRSC', // MiniMart Treasury (your address)
                state: {
                    type: 'minidev_dapp_registration',
                    dapp_uid: dapp.uid,
                    name: dapp.name,
                    version: dapp.version,
                    description: dapp.description,
                    category: dapp.category,
                    ipfs_hash: dapp.ipfs_hash,
                    developer_address: developerAddress,
                    timestamp: Date.now(),
                    registration_fee: '0.01'
                }
            };

            console.log('🔐 Sending dapp registration transaction...');
            const txId = await this.minimaAPI.sendCustomTransaction(transactionData);

            console.log('✅ Dapp registered on blockchain with TX:', txId);
            return txId;

        } catch (error) {
            console.error('❌ Dapp registration failed:', error);
            throw error;
        }
    }

    /**
     * Query blockchain for registered dapps
     * @param {number} limit - Max results to return
     * @returns {Promise<Array>} Array of registered dapps
     */
    async queryRegisteredDapps(limit = 100) {
        try {
            if (!this.isReady) {
                throw new Error('Blockchain API not ready');
            }

            console.log('🔍 Querying blockchain for registered dapps...');

            // Get all coins that might contain dapp registrations
            const result = await this.minimaAPI.cmd('coins relevant:false');

            if (!result.response || !result.response.coins) {
                console.log('ℹ️ No coins found');
                return [];
            }

            const dapps = [];

            for (const coin of result.response.coins) {
                // Check if this coin has dapp state in port 0
                if (coin.state && Array.isArray(coin.state)) {
                    const dappState = coin.state.find(s => s.port === '0');
                    if (dappState && dappState.data) {
                        try {
                            const dappData = JSON.parse(dappState.data);

                            // Check if this is a dapp registration
                            if (dappData.type === 'minidev_dapp_registration') {
                                dapps.push({
                                    uid: dappData.dapp_uid,
                                    name: dappData.name,
                                    version: dappData.version,
                                    description: dappData.description,
                                    category: dappData.category,
                                    icon: dappData.icon || null,
                                    ipfs_hash: dappData.ipfs_hash,
                                    developer_address: dappData.developer_address,
                                    timestamp: dappData.timestamp,
                                    downloads: 0, // TODO: Track downloads
                                    tips: 0, // TODO: Track tips
                                    txId: coin.coinid || coin.txpowid
                                });
                            }
                        } catch (e) {
                            // Skip invalid JSON
                        }
                    }
                }

                if (dapps.length >= limit) break;
            }

            console.log(`✅ Found ${dapps.length} registered dapps`);
            return dapps;

        } catch (error) {
            console.error('❌ Dapp query failed:', error);
            return [];
        }
    }

    /**
     * Get dapp registration details by UID
     * @param {string} dappUid - Dapp unique identifier
     * @returns {Promise<Object|null>} Dapp registration data or null
     */
    async getDappRegistration(dappUid) {
        try {
            if (!this.isReady) {
                throw new Error('Blockchain API not ready');
            }

            console.log('🔍 Looking up dapp registration:', dappUid);

            // This would scan blockchain for transactions containing this dapp UID
            // For now, return null (would be populated by real blockchain scanning)

            console.log('ℹ️ Blockchain lookup not yet implemented');
            return null;

        } catch (error) {
            console.error('❌ Dapp registration lookup failed:', error);
            return null;
        }
    }

    /**
     * Verify dapp ownership on blockchain
     * @param {string} dappUid - Dapp unique identifier
     * @param {string} claimedOwner - Address claiming ownership
     * @returns {Promise<boolean>} True if ownership verified
     */
    async verifyDappOwnership(dappUid, claimedOwner) {
        try {
            const registration = await this.getDappRegistration(dappUid);

            if (!registration) {
                console.log('❌ Dapp not found on blockchain');
                return false;
            }

            const isOwner = registration.developer_address === claimedOwner;
            console.log('🔍 Dapp ownership verified:', isOwner);

            return isOwner;

        } catch (error) {
            console.error('❌ Ownership verification failed:', error);
            return false;
        }
    }

    /**
     * Optional: Register developer identity on blockchain
     * @param {string} developerAddress - Developer address
     * @param {string} identityHash - IPFS hash of identity verification
     * @returns {Promise<string>} Transaction ID
     */
    async registerDeveloperIdentity(developerAddress, identityHash) {
        try {
            if (!this.isReady) {
                throw new Error('Blockchain API not ready');
            }

            console.log('🆔 Registering developer identity on blockchain');

            const transactionData = {
                amount: '0.001', // Very small fee for identity
                address: 'MxG086AUGQMWM6S47P6GWR2U1AV3391EPR5Q53N7DN9MGNMMN6BMH270SV8QRSC', // MiniMart Treasury (your address)
                state: {
                    type: 'minidev_developer_identity',
                    developer_address: developerAddress,
                    identity_hash: identityHash,
                    timestamp: Date.now()
                }
            };

            const txId = await this.minimaAPI.sendCustomTransaction(transactionData);
            console.log('✅ Developer identity registered with TX:', txId);

            return txId;

        } catch (error) {
            console.error('❌ Developer identity registration failed:', error);
            throw error;
        }
    }
}

// Initialize global instance
window.blockchainAPI = new BlockchainAPI();
