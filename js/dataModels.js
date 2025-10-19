/**
 * Data Models & Chain Scanner Module
 * TypeScript-style interfaces and blockchain data management
 */

/**
 * @typedef {Object} Profile
 * @property {string} address - User's Minima address
 * @property {string} nickname - Display name (3-20 chars)
 * @property {string} bio - User bio (max 280 chars)
 * @property {string} avatar_ipfs - IPFS hash of avatar image
 * @property {string|null} github_url - GitHub profile URL
 * @property {string|null} twitter_handle - Twitter/X handle or URL
 * @property {string|null} website_url - Personal website URL
 * @property {number} created_at - Unix timestamp
 * @property {string} tx_id - Transaction ID that created this profile
 */

/**
 * @typedef {Object} Post
 * @property {string} tx_id - Transaction ID
 * @property {string} author_address - Author's Minima address
 * @property {string} title - Post title
 * @property {string} content_ipfs - IPFS hash of content JSON
 * @property {string} media_type - 'image', 'video', or 'none'
 * @property {string} [media_ipfs] - IPFS hash of media file (if exists)
 * @property {number} timestamp - Unix timestamp
 * @property {number} tip_count - Number of tips received
 * @property {number} comment_count - Number of comments
 */

/**
 * @typedef {Object} Tip
 * @property {string} from_address - Sender's address
 * @property {string} to_address - Recipient's address
 * @property {number} amount - Amount in MINIMA
 * @property {string} post_tx_id - Post being tipped
 * @property {number} timestamp - Unix timestamp
 * @property {string} tx_id - Transaction ID
 */

/**
 * @typedef {Object} Comment
 * @property {string} tx_id - Transaction ID
 * @property {string} author_address - Comment author's address
 * @property {string} parent_tx_id - Post or comment being replied to
 * @property {string} content_ipfs - IPFS hash of comment content
 * @property {number} timestamp - Unix timestamp
 */

/**
 * Chain Scanner Class
 * Handles blockchain scanning and data caching
 */
class ChainScanner {
  constructor() {
    this.cache = new Map();
    this.cacheTTL = 5 * 60 * 1000; // 5 minutes in milliseconds
  }

  /**
   * Scan for all user profiles
   * @returns {Promise<Array<Profile>>} Array of profile objects
   */
  async scanProfiles() {
    const cacheKey = 'profiles';
    const cached = this._getCached(cacheKey);
    if (cached) return cached;

    try {
      const transactions = await minimaAPI.scanChain();

      const profiles = transactions
        .filter(tx => {
          try {
            const state = JSON.parse(tx.state || '{}');
            return state.app === CONFIG.APP_NAME && state.type === 'profile';
          } catch (e) {
            return false;
          }
        })
        .map(tx => {
          const state = JSON.parse(tx.state);
          return {
            address: tx.address || state.address,
            nickname: state.nickname,
            bio: state.bio || '',
            avatar_ipfs: state.avatar_ipfs,
            github_url: state.github_url || null,
            twitter_handle: state.twitter_handle || null,
            website_url: state.website_url || null,
            created_at: state.created_at,
            tx_id: tx.txpowid || tx.id
          };
        })
        .filter(profile => profile.nickname); // Filter out invalid profiles

      this._setCached(cacheKey, profiles);
      return profiles;
    } catch (error) {
      console.error('Error scanning profiles:', error);
      return [];
    }
  }

  /**
   * Scan for posts with pagination
   * @param {number} limit - Number of posts to fetch
   * @param {number} offset - Pagination offset
   * @returns {Promise<Array<Post>>} Array of post objects
   */
  async scanPosts(limit = 50, offset = 0) {
    const cacheKey = `posts_${limit}_${offset}`;
    const cached = this._getCached(cacheKey);
    if (cached) return cached;

    try {
      const transactions = await minimaAPI.scanChain();

      const posts = transactions
        .filter(tx => {
          try {
            const state = JSON.parse(tx.state || '{}');
            return state.app === CONFIG.APP_NAME && state.type === 'post';
          } catch (e) {
            return false;
          }
        })
        .map(tx => {
          const state = JSON.parse(tx.state);
        return {
          tx_id: tx.txpowid || tx.id,
          author_address: tx.address || state.address,
          title: state.title,
          content_ipfs: state.content_ipfs,
          media_type: state.media_type || 'none',
          media_ipfs: state.media_ipfs,
          timestamp: state.timestamp,
          tip_count: Math.floor(Math.random() * 10), // Mock tip count
          comment_count: Math.floor(Math.random() * 5) // Mock comment count
        };
        })
        .filter(post => post.title && post.content_ipfs) // Filter out invalid posts
        .sort((a, b) => b.timestamp - a.timestamp) // Sort by newest first
        .slice(offset, offset + limit);

      // Enrich posts with tip and comment counts
      const enrichedPosts = await Promise.all(
        posts.map(async (post) => {
          const tips = await this.scanTips(post.tx_id);
          const comments = await this.scanComments(post.tx_id);

          return {
            ...post,
            tip_count: tips.length,
            comment_count: comments.length
          };
        })
      );

      this._setCached(cacheKey, enrichedPosts);
      return enrichedPosts;
    } catch (error) {
      console.error('Error scanning posts:', error);
      return [];
    }
  }

  /**
   * Scan for tips, optionally filtered by recipient
   * @param {string} [devAddress] - Optional filter by recipient address
   * @returns {Promise<Array<Tip>>} Array of tip objects
   */
  async scanTips(devAddress = null) {
    const cacheKey = devAddress ? `tips_${devAddress}` : 'tips_all';
    const cached = this._getCached(cacheKey);
    if (cached) return cached;

    try {
      const transactions = await minimaAPI.scanChain();

      const tips = transactions
        .filter(tx => {
          try {
            const state = JSON.parse(tx.state || '{}');
            return state.app === CONFIG.APP_NAME && state.type === 'tip';
          } catch (e) {
            return false;
          }
        })
        .map(tx => {
          const state = JSON.parse(tx.state);
          return {
            from_address: tx.address || state.from_address,
            to_address: state.to_address,
            amount: state.amount,
            post_tx_id: state.post_tx_id,
            timestamp: state.timestamp || Date.now(),
            tx_id: tx.txpowid || tx.id
          };
        })
        .filter(tip => tip.amount > 0 && tip.post_tx_id);

      const filteredTips = devAddress
        ? tips.filter(tip => tip.to_address === devAddress)
        : tips;

      this._setCached(cacheKey, filteredTips);
      return filteredTips;
    } catch (error) {
      console.error('Error scanning tips:', error);
      return [];
    }
  }

  /**
   * Scan for comments on a specific post
   * @param {string} postTxId - Post transaction ID
   * @returns {Promise<Array<Comment>>} Array of comment objects
   */
  async scanComments(postTxId) {
    const cacheKey = `comments_${postTxId}`;
    const cached = this._getCached(cacheKey);
    if (cached) return cached;

    try {
      const transactions = await minimaAPI.scanChain();

      const comments = transactions
        .filter(tx => {
          try {
            const state = JSON.parse(tx.state || '{}');
            return state.app === CONFIG.APP_NAME && state.type === 'comment' && state.parent_tx_id === postTxId;
          } catch (e) {
            return false;
          }
        })
        .map(tx => {
          const state = JSON.parse(tx.state);
          return {
            tx_id: tx.txpowid || tx.id,
            author_address: tx.address || state.author_address,
            parent_tx_id: state.parent_tx_id,
            content_ipfs: state.content_ipfs,
            timestamp: state.timestamp || Date.now()
          };
        })
        .filter(comment => comment.content_ipfs)
        .sort((a, b) => a.timestamp - b.timestamp); // Sort by oldest first

      this._setCached(cacheKey, comments);
      return comments;
    } catch (error) {
      console.error('Error scanning comments:', error);
      return [];
    }
  }

  /**
   * Calculate total tips for an address
   * @param {string} address - Address to calculate tips for
   * @param {number} [month] - Optional month filter (1-12)
   * @returns {Promise<number>} Total tips received
   */
  async calculateTipTotal(address, month = null) {
    try {
      const tips = await this.scanTips(address);

      let filteredTips = tips;
      if (month) {
        const currentYear = new Date().getFullYear();
        filteredTips = tips.filter(tip => {
          const tipDate = new Date(tip.timestamp);
          return tipDate.getFullYear() === currentYear && tipDate.getMonth() + 1 === month;
        });
      }

      return filteredTips.reduce((total, tip) => total + tip.amount, 0);
    } catch (error) {
      console.error('Error calculating tip total:', error);
      return 0;
    }
  }

  /**
   * Get cached data if still valid
   * @private
   * @param {string} key - Cache key
   * @returns {any|null} Cached data or null if expired/not found
   */
  _getCached(key) {
    const cached = this.cache.get(key);
    if (!cached) return null;

    const now = Date.now();
    if (now - cached.timestamp > this.cacheTTL) {
      this.cache.delete(key);
      return null;
    }

    return cached.data;
  }

  /**
   * Set cached data with timestamp
   * @private
   * @param {string} key - Cache key
   * @param {any} data - Data to cache
   */
  _setCached(key, data) {
    this.cache.set(key, {
      data: data,
      timestamp: Date.now()
    });
  }

  /**
   * Clear all cached data
   */
  clearCache() {
    this.cache.clear();
  }

  /**
   * Get cache statistics
   * @returns {Object} Cache stats
   */
  getCacheStats() {
    return {
      size: this.cache.size,
      keys: Array.from(this.cache.keys()),
      ttl: this.cacheTTL
    };
  }
}

// Test function for ChainScanner
async function testChainScanner() {
  try {
    const scanner = new ChainScanner();

    console.log('Testing ChainScanner...');

    // Test profile scanning
    console.log('Scanning profiles...');
    const profiles = await scanner.scanProfiles();
    console.log(`Found ${profiles.length} profiles`);

    // Test post scanning
    console.log('Scanning posts...');
    const posts = await scanner.scanPosts(10, 0);
    console.log(`Found ${posts.length} posts`);

    // Test tip scanning
    console.log('Scanning tips...');
    const tips = await scanner.scanTips();
    console.log(`Found ${tips.length} tips`);

    console.log('ChainScanner test completed successfully!');
    return true;
  } catch (error) {
    console.error('ChainScanner test failed:', error);
    return false;
  }
}

// Export singleton instance
const chainScanner = new ChainScanner();
window.chainScanner = chainScanner;
