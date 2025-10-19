/**
 * Maxima API - Live Layer for MiniDev
 *
 * Handles real-time communication:
 * - Developer profiles (updates, bio changes)
 * - Dapp listings (new apps, updates)
 * - Reviews and ratings
 * - Download receipts
 * - Tipping receipts
 * - Developer messaging
 * - Live activity feeds
 */

class MaximaAPI {
    constructor() {
        this.isReady = false;
        this.contactAddress = null;
        this.messageHandlers = new Map();
        this.broadcastCache = new Map();
        this.cacheTimeout = 5 * 60 * 1000; // 5 minutes
    }

    async init() {
        try {
            console.log('🔄 Initializing Maxima API...');

            // Wait for MDS to be available
            if (!window.MDS) {
                console.log('Waiting for MDS...');
                for (let i = 0; i < 50; i++) {
                    await new Promise(resolve => setTimeout(resolve, 100));
                    if (window.MDS) break;
                }
            }

            if (!window.MDS) {
                throw new Error('MDS not available');
            }

            // Get our Maxima contact address
            const contactResult = await this._mdsCommand('maxima');
            if (contactResult.response && contactResult.response.contact) {
                this.contactAddress = contactResult.response.contact;
                console.log('✅ Maxima contact:', this.contactAddress);
            }

            this.isReady = true;
            console.log('🎉 Maxima API initialized');

            return true;
        } catch (error) {
            console.error('❌ Maxima API init failed:', error);
            return false;
        }
    }

    async _mdsCommand(command) {
        return new Promise((resolve, reject) => {
            window.MDS.cmd(command, (response) => {
                if (response.error) {
                    reject(new Error(response.error));
                } else {
                    resolve(response);
                }
            });
        });
    }

    // Broadcast developer profile update
    async broadcastProfileUpdate(profile) {
        try {
            if (!this.isReady) await this.init();

            const message = {
                type: 'minidev_profile_update',
                profile: {
                    address: profile.address,
                    username: profile.username,
                    bio: profile.bio || '',
                    gitUrl: profile.gitUrl,
                    twitterUrl: profile.twitterUrl
                },
                timestamp: Date.now()
            };

            // Convert to Base64 to avoid escaping issues
            const messageStr = JSON.stringify(message);
            const base64Message = btoa(messageStr);

            const result = await this._mdsCommand(`maxima action:send application:minimart data:${base64Message}`);
            console.log('📤 Profile update broadcasted:', result);

            return result;
        } catch (error) {
            console.error('❌ Profile broadcast failed:', error);
            throw error;
        }
    }

    // Broadcast new dapp
    async broadcastNewDapp(dapp) {
        try {
            if (!this.isReady) await this.init();

            const message = {
                type: 'minidev_new_dapp',
                dapp: {
                    uid: dapp.uid,
                    name: dapp.name,
                    version: dapp.version,
                    description: dapp.description,
                    category: dapp.category,
                    ipfs_hash: dapp.ipfs_hash,
                    developer_address: dapp.developer_address
                },
                timestamp: Date.now()
            };

            // Convert to Base64 to avoid escaping issues
            const messageStr = JSON.stringify(message);
            const base64Message = btoa(messageStr);

            const result = await this._mdsCommand(`maxima action:send application:minimart data:${base64Message}`);
            console.log('📤 New dapp broadcasted:', result);

            return result;
        } catch (error) {
            console.error('❌ Dapp broadcast failed:', error);
            throw error;
        }
    }

    // Broadcast review/rating
    async broadcastReview(dappUid, review, rating, reviewerAddress) {
        try {
            if (!this.isReady) await this.init();

            const message = {
                type: 'minidev_review',
                review: {
                    dapp_uid: dappUid,
                    review: review,
                    rating: rating,
                    reviewer_address: reviewerAddress
                },
                timestamp: Date.now()
            };

            const result = await this._mdsCommand(`maxima action:send application:minidev data:"${JSON.stringify(message).replace(/"/g, '\\"')}"`);
            console.log('📤 Review broadcasted:', result);

            return result;
        } catch (error) {
            console.error('❌ Review broadcast failed:', error);
            throw error;
        }
    }

    // Broadcast download receipt
    async broadcastDownload(dappUid, downloaderAddress) {
        try {
            if (!this.isReady) await this.init();

            const message = {
                type: 'minidev_download',
                download: {
                    dapp_uid: dappUid,
                    downloader_address: downloaderAddress
                },
                timestamp: Date.now()
            };

            // Convert to Base64 to avoid escaping issues
            const messageStr = JSON.stringify(message);
            const base64Message = btoa(messageStr);

            const result = await this._mdsCommand(`maxima action:send application:minimart data:${base64Message}`);
            console.log('📤 Download broadcasted:', result);

            return result;
        } catch (error) {
            console.error('❌ Download broadcast failed:', error);
            throw error;
        }
    }

    // Broadcast tip receipt
    async broadcastTip(amount, recipientAddress, senderAddress, message = '') {
        try {
            if (!this.isReady) await this.init();

            const tipMessage = {
                type: 'minidev_tip',
                tip: {
                    amount: amount,
                    recipient_address: recipientAddress,
                    sender_address: senderAddress,
                    message: message
                },
                timestamp: Date.now()
            };

            const result = await this._mdsCommand(`maxima action:send application:minidev data:"${JSON.stringify(tipMessage).replace(/"/g, '\\"')}"`);
            console.log('📤 Tip broadcasted:', result);

            return result;
        } catch (error) {
            console.error('❌ Tip broadcast failed:', error);
            throw error;
        }
    }

    // Send direct message to developer
    async sendDirectMessage(recipientContact, message) {
        try {
            if (!this.isReady) await this.init();

            const result = await this._mdsCommand(`maxima action:send to:${recipientContact} application:minidev data:"${JSON.stringify(message).replace(/"/g, '\\"')}"`);
            console.log('📤 Direct message sent:', result);

            return result;
        } catch (error) {
            console.error('❌ Direct message failed:', error);
            throw error;
        }
    }

    // Listen for Maxima messages
    async listenForMessages(handler) {
        try {
            if (!this.isReady) await this.init();

            // Set up Maxima message listener
            window.MDS.cmd('maxima action:listen application:minidev', (response) => {
                if (response.response && response.response.message) {
                    const message = JSON.parse(response.response.message);
                    handler(message);
                }
            });

            console.log('👂 Listening for Maxima messages');
        } catch (error) {
            console.error('❌ Message listener setup failed:', error);
        }
    }

    // Get cached broadcasts (fallback if blockchain is slow)
    getCachedBroadcasts(type, maxAge = this.cacheTimeout) {
        const cacheKey = `broadcasts_${type}`;
        const cached = this.broadcastCache.get(cacheKey);

        if (cached && (Date.now() - cached.timestamp) < maxAge) {
            return cached.data;
        }

        return null;
    }

    // Cache broadcasts
    cacheBroadcasts(type, data) {
        this.broadcastCache.set(`broadcasts_${type}`, {
            data: data,
            timestamp: Date.now()
        });
    }

    // Get developer contact from address (simplified - in real impl would use a lookup)
    async getDeveloperContact(address) {
        // This would need a proper lookup mechanism
        // For now, return null - direct messaging would need contact addresses
        console.log('🔍 Looking up contact for:', address);
        return null;
    }

    async getMaximaAddress() {
        try {
            const result = await this._mdsCommand('maxima');
            return result.response?.address || result.response?.contact || null;
        } catch (error) {
            console.error('Failed to get Maxima address:', error);
            return null;
        }
    }

    async addContact(address) {
        try {
            await this._mdsCommand(`maxima action:addcontact contact:${address}`);
            console.log('✅ Added contact:', address);
            return true;
        } catch (error) {
            console.error('Failed to add contact:', error);
            return false;
        }
    }

    addMessageHandler(type, handler) {
        this.messageHandlers.set(type, handler);
    }

    removeMessageHandler(type) {
        this.messageHandlers.delete(type);
    }

    async sendMessage(recipient, message) {
        try {
            await this._mdsCommand(`maxima action:send to:${recipient} application:minimart message:${JSON.stringify(message)}`);
            console.log('📤 Sent message to:', recipient);
            return true;
        } catch (error) {
            console.error('Failed to send message:', error);
            return false;
        }
    }
}

// Initialize global instance
window.maximaAPI = new MaximaAPI();
