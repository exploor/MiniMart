/**
 * Store Aggregator Module
 * Fetches and aggregates MiniDapp stores from multiple users (P2P)
 * Compatible with standard Minima store format (dapps.json)
 */

console.log('StoreAggregator: Module loading...');

class StoreAggregator {
  constructor() {
    this.cachedStores = new Map(); // Cache fetched stores
    this.lastFetchTime = new Map(); // Track when we last fetched each store
    this.cacheDuration = 5 * 60 * 1000; // 5 minutes cache
  }

  /**
   * Fetch all stores from user profiles and aggregate dapps
   * @param {Array} profiles - Array of user profiles with store_url
   * @returns {Promise<Array>} Aggregated dapps from all stores
   */
  async fetchAllStores(profiles) {
    console.log('='.repeat(80));
    console.log('🏪 StoreAggregator: Fetching all stores...');
    console.log('📋 Total profiles:', profiles.length);

    const profilesWithStores = profiles.filter(p => p.store_url && p.store_url.trim());
    console.log('🔗 Profiles with store URLs:', profilesWithStores.length);

    if (profilesWithStores.length === 0) {
      console.warn('⚠️ No stores found! Users need to add store URLs to profiles.');
      return [];
    }

    // Fetch all stores in parallel
    const storePromises = profilesWithStores.map(profile =>
      this.fetchStore(profile.store_url, profile)
    );

    const storeResults = await Promise.allSettled(storePromises);

    // Process results
    const allDapps = [];
    let successCount = 0;
    let failCount = 0;

    storeResults.forEach((result, index) => {
      if (result.status === 'fulfilled' && result.value) {
        const dapps = result.value;
        allDapps.push(...dapps);
        successCount++;
        console.log(`✅ Store ${index + 1}: Loaded ${dapps.length} dapps`);
      } else {
        failCount++;
        console.warn(`❌ Store ${index + 1}: Failed -`, result.reason?.message || 'Unknown error');
      }
    });

    console.log('='.repeat(80));
    console.log('📊 Aggregation Summary:');
    console.log(`   ✅ Successful: ${successCount} stores`);
    console.log(`   ❌ Failed: ${failCount} stores`);
    console.log(`   📦 Total dapps: ${allDapps.length}`);
    console.log('='.repeat(80));

    return allDapps;
  }

  /**
   * Fetch a single store from URL
   * @param {string} storeUrl - URL to store's dapps.json
   * @param {Object} profile - User profile who owns this store
   * @returns {Promise<Array>} Array of dapps from this store
   */
  async fetchStore(storeUrl, profile) {
    console.log('');
    console.log('🔄 Fetching store:', storeUrl);
    console.log('👤 Owner:', profile.username, `(${profile.address})`);

    // Check cache first
    const now = Date.now();
    const lastFetch = this.lastFetchTime.get(storeUrl);
    if (lastFetch && (now - lastFetch) < this.cacheDuration) {
      const cached = this.cachedStores.get(storeUrl);
      if (cached) {
        console.log('💾 Using cached data (age:', Math.round((now - lastFetch) / 1000), 'seconds)');
        return cached;
      }
    }

    try {
      // Fetch store JSON
      const startTime = Date.now();
      const response = await fetch(storeUrl, {
        method: 'GET',
        headers: {
          'Accept': 'application/json'
        },
        signal: AbortSignal.timeout(10000) // 10 second timeout
      });

      const fetchTime = Date.now() - startTime;
      console.log(`📡 Fetch completed in ${fetchTime}ms`);

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const storeData = await response.json();
      console.log('✅ Store JSON parsed successfully');
      console.log('📦 Store data keys:', Object.keys(storeData));

      // Convert store format to MiniMart format
      const dapps = this.parseStoreData(storeData, storeUrl, profile);
      console.log(`✅ Parsed ${dapps.length} dapps from store`);

      // Cache the result
      this.cachedStores.set(storeUrl, dapps);
      this.lastFetchTime.set(storeUrl, now);

      return dapps;

    } catch (error) {
      console.error('❌ Failed to fetch store:', storeUrl);
      console.error('   Error:', error.message);

      // Return cached data if available, even if expired
      const cached = this.cachedStores.get(storeUrl);
      if (cached) {
        console.log('⚠️ Returning stale cached data as fallback');
        return cached;
      }

      throw error;
    }
  }

  /**
   * Parse store data and convert to MiniMart format
   * Supports standard Minima store format (dapps.json)
   * @param {Object} storeData - Raw store JSON data
   * @param {string} storeUrl - Base URL of the store
   * @param {Object} profile - Profile of store owner
   * @returns {Array} Parsed dapps
   */
  parseStoreData(storeData, storeUrl, profile) {
    console.log('🔍 Parsing store data...');

    const baseUrl = storeUrl.replace(/\/[^\/]*$/, ''); // Remove filename from URL
    console.log('🌐 Base URL:', baseUrl);

    const dapps = [];

    // Standard Minima store format: { "dappName": { miniDapp: "file.mds.zip", icon: "icon.png", ... } }
    for (const [key, dappData] of Object.entries(storeData)) {
      try {
        // Skip metadata fields
        if (key === 'name' || key === 'description' || key === 'icon' || key === 'version') {
          continue;
        }

        const dapp = {
          uid: this.generateUid(key, profile.address),
          name: dappData.name || key,
          description: dappData.description || 'No description provided',
          version: dappData.version || '1.0.0',
          category: dappData.category || 'Utility',
          file: `${baseUrl}/${dappData.miniDapp || dappData.file}`,
          icon: dappData.icon ? `${baseUrl}/${dappData.icon}` : null,
          developer: profile.username,
          developer_address: profile.address,
          maxima_address: profile.maxima_address || null,
          store_url: storeUrl,
          store_name: profile.username + "'s Store",
          downloads: dappData.downloads || 0,
          timestamp: Date.now(),
          verified: profile.verified || false,
          featured: profile.featured_dapp_uid === key // Check if this dapp is featured
        };

        dapps.push(dapp);
        console.log(`   ✅ Parsed: ${dapp.name}`);
        console.log(`      📁 File: ${dapp.file}`);

      } catch (error) {
        console.warn(`   ⚠️ Skipped dapp "${key}":`, error.message);
      }
    }

    return dapps;
  }

  /**
   * Generate unique ID for a dapp
   * @param {string} dappName - Name of the dapp
   * @param {string} address - Developer address
   * @returns {string} Unique ID
   */
  generateUid(dappName, address) {
    const combined = `${dappName}_${address}_${Date.now()}`;
    // Simple hash function
    let hash = 0;
    for (let i = 0; i < combined.length; i++) {
      const char = combined.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32bit integer
    }
    return '0x' + Math.abs(hash).toString(16).toUpperCase();
  }

  /**
   * Clear cache for a specific store or all stores
   * @param {string} storeUrl - Optional, clear specific store
   */
  clearCache(storeUrl = null) {
    if (storeUrl) {
      this.cachedStores.delete(storeUrl);
      this.lastFetchTime.delete(storeUrl);
      console.log('🗑️ Cleared cache for:', storeUrl);
    } else {
      this.cachedStores.clear();
      this.lastFetchTime.clear();
      console.log('🗑️ Cleared all store caches');
    }
  }
}

// Create global instance (only if window exists)
if (typeof window !== 'undefined') {
    window.storeAggregator = new StoreAggregator();
    console.log('✅ StoreAggregator: Module loaded successfully');
} else {
    console.log('✅ StoreAggregator: Module loaded (server-side)');
    module.exports = StoreAggregator;
}
