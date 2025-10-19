/**
 * MiniMart - Simple Decentralized Marketplace
 * Clean, focused marketplace for MiniDapps
 */

console.log('MiniMart: Starting...');

class MiniMartApp {
    constructor() {
        this.currentView = 'marketplace';
        this.dapps = [];
        this.profiles = {}; // Store profiles by address
        this.userProfile = null;
        this.isInitialized = false;
    }

    async init() {
        console.log('MiniMart: Initializing app...');

        try {
            // Initialize Minima API first
            await window.minimaAPI.init();
            console.log('MiniMart: Minima API ready');

            // Initialize Maxima for live updates
            await window.maximaAPI.init();
            console.log('MiniMart: Maxima API ready');

            // Initialize Blockchain API
            await window.blockchainAPI.init(window.minimaAPI);
            console.log('MiniMart: Blockchain API ready');

            // Setup event listeners
            this.setupEventListeners();
            this.setupTreasuryButton();

            // Load initial data
            await this.loadInitialData();

            // Load blockchain profiles for developer verification
            console.log('MiniMart: Loading blockchain profiles...');
            try {
                const blockchainProfiles = await window.blockchainAPI.queryProfiles();
                console.log('MiniMart: Loaded', blockchainProfiles.length, 'blockchain profiles');

                // Store profiles for quick access
                blockchainProfiles.forEach(profile => {
                    this.profiles[profile.address] = profile;
                });
            } catch (error) {
                console.warn('MiniMart: Failed to load blockchain profiles:', error);
            }
            await this.updateTreasuryAmount();

            // Setup Maxima message handling
            this.setupMaximaMessages();

            this.isInitialized = true;
            this.hideLoading();

            console.log('MiniMart: App initialized successfully!');

        } catch (error) {
            console.error('MiniMart: Initialization failed:', error);
            this.showError('Failed to initialize MiniMart. Please refresh and try again.');
        }
    }

    setupEventListeners() {
        // Bottom Navigation
        document.querySelectorAll('.bottom-nav .nav-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const view = e.currentTarget.dataset.view;
                this.switchView(view);
            });
        });
    }

    setupTreasuryButton() {
        const treasuryBtn = document.getElementById('treasury-btn');
        if (treasuryBtn) {
            treasuryBtn.addEventListener('click', () => {
                this.showTreasuryModal();
            });
        }
    }

    async updateTreasuryAmount() {
        try {
            // For now, estimate based on user activity
            // In production, this would query the treasury address balance
            const totalUsers = Math.max(this.dapps.length * 2, 1); // Rough estimate
            const estimatedTreasury = totalUsers * 0.01; // 0.01 MINIMA per user

            const amountElement = document.getElementById('treasury-amount');
            if (amountElement) {
                amountElement.textContent = estimatedTreasury.toFixed(2);
            }
        } catch (error) {
            console.error('MiniMart: Failed to update treasury amount:', error);
        }
    }

    setupMaximaMessages() {
        window.maximaAPI.listenForMessages((message) => {
            this.handleMaximaMessage(message);
        });
    }

    async handleMaximaMessage(message) {
        console.log('MiniMart: Received Maxima message:', message);

        switch (message.type) {
            case 'minidev_new_dapp':
                await this.handleNewDapp(message.dapp);
                break;
            case 'minidev_profile_update':
                await this.handleProfileUpdate(message.profile);
                break;
            default:
                console.log('MiniMart: Unknown message type:', message.type);
        }
    }

    async handleNewDapp(dapp) {
        console.log('MiniMart: New dapp received:', dapp);
        this.dapps.unshift(dapp); // Add to beginning
        this.refreshMarketplace();
    }

    async handleProfileUpdate(profile) {
        console.log('MiniMart: Profile update received:', profile);
        // Handle profile updates if needed
    }

    async loadInitialData() {
        console.log('MiniMart: Loading initial data...');

        try {
            // Load user profiles first (we need these for store aggregation)
            console.log('👥 Loading user profiles...');
            await this.loadProfiles();

            // Get all profiles with store URLs
            const allProfiles = Object.values(this.profiles || {});
            console.log('📋 Found', allProfiles.length, 'total profiles');

            // Use store aggregator to fetch all dapps from user stores (P2P)
            console.log('🏪 Fetching aggregated dapps from user stores...');
            const aggregatedDapps = await window.storeAggregator.fetchAllStores(allProfiles);

            // Load any additional dapps from blockchain (for backwards compatibility)
            const blockchainDapps = await window.blockchainAPI.queryRegisteredDapps();
            console.log('🔗 Loaded', blockchainDapps?.length || 0, 'dapps from blockchain');

            // Combine aggregated dapps with blockchain dapps
            this.dapps = [...aggregatedDapps, ...(blockchainDapps || [])];

            console.log('✅ Total dapps loaded:', this.dapps.length);
            console.log('   🏪 P2P Store dapps:', aggregatedDapps.length);
            console.log('   🔗 Blockchain dapps:', blockchainDapps?.length || 0);

            // Refresh marketplace display
            this.refreshMarketplace();

        } catch (error) {
            console.error('❌ Failed to load initial data:', error);
            this.showToast('❌ Failed to load marketplace data', 'error');
        }
    }

    switchView(viewName) {
        console.log('MiniMart: Switching to view:', viewName);

        // Update bottom navigation
        document.querySelectorAll('.bottom-nav .nav-btn').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.view === viewName);
        });

        // Update views
        document.querySelectorAll('.view').forEach(view => {
            view.classList.toggle('active', view.id === `${viewName}-view`);
            view.classList.toggle('hidden', view.id !== `${viewName}-view`);
        });

            this.currentView = viewName;

            // Load view-specific data
            switch (viewName) {
            case 'marketplace':
                this.refreshMarketplace();
                    break;
            case 'publish':
                this.showPublishForm();
                    break;
            case 'profile':
                this.showProfile();
                    break;
            case 'pending':
                this.showPending();
                    break;
        }
    }

    refreshMarketplace() {
        const grid = document.getElementById('marketplace-grid');
        if (!grid) return;

        if (this.dapps.length === 0) {
            grid.innerHTML = `
                <div class="empty-market">
                    <div class="empty-icon">📱</div>
                    <h3>No Apps Yet</h3>
                    <p>Be the first to upload!</p>
                    <button class="upload-btn" onclick="window.app.switchView('publish')">
                        <span>+</span>
                    </button>
                </div>
            `;
            return;
        }

        // Sort by downloads (most popular first)
        const sortedDapps = [...this.dapps].sort((a, b) => (b.downloads || 0) - (a.downloads || 0));

        grid.innerHTML = sortedDapps.map(dapp => this.renderAppIcon(dapp)).join('');
    }

    renderAppIcon(dapp) {
        return `
            <div class="app-icon" data-uid="${dapp.uid}" onclick="window.app.showAppDetails('${dapp.uid}')">
                <div class="app-icon-image">
                    ${dapp.icon ? `<img src="${dapp.icon}" alt="${dapp.name}" onerror="this.style.display='none'">` : ''}
                    ${!dapp.icon ? '📱' : ''}
            </div>
                <div class="app-icon-info">
                    <div class="app-name">${this.escapeHtml(dapp.name)}</div>
                    <div class="app-developer">${this.shortenAddress(dapp.developer_address)}</div>
                    <div class="app-downloads">${dapp.downloads || 0} downloads</div>
                    </div>
            </div>
        `;
    }

    async downloadDapp(dappUid) {
        console.log('='.repeat(80));
        console.log('🚀 MiniMart: Starting P2P install process for dapp:', dappUid);
        console.log('='.repeat(80));

        try {
            // Get user address
            const userAddress = await this.getUserMinimaAddress();
            console.log('✅ User address:', userAddress);

            // Find the dapp
            const dapp = this.dapps.find(d => d.uid === dappUid);
            if (!dapp) {
                console.error('❌ Dapp not found!');
                this.showToast('❌ Dapp not found!', 'error');
                return;
            }

            console.log('✅ Found dapp:', {
                uid: dapp.uid,
                name: dapp.name,
                file: dapp.file,
                developer: dapp.developer_address,
                store_url: dapp.store_url
            });

            // Check if we have a file URL (P2P install)
            if (!dapp.file) {
                console.error('❌ Dapp has no file URL!');
                this.showToast('❌ This dapp cannot be installed (no file URL)', 'error');
                return;
            }

            console.log('📦 File URL:', dapp.file);
            console.log('🏪 Source store:', dapp.store_url);

            this.showToast('📦 Installing MiniDapp from peer...', 'info');

            // P2P INSTALL: Use MDS to install directly from peer's HTTP server
            // This is exactly how the official MiniDapp store works!
            console.log('🔗 Installing via MDS from peer server:', dapp.file);
            try {
                const installResult = await window.minimaAPI.cmd(`mds action:install file:${dapp.file}`);
                console.log('✅ MDS Install result:', installResult);

            if (installResult.status === true) {
                // Success!
                console.log('🎉 MiniDapp installed successfully!');
                this.showToast(`✅ ${dapp.name} installed successfully!`, 'success');

                // Broadcast download event via Maxima
                try {
                    await window.maximaAPI.broadcastDownload(dappUid, userAddress);
                } catch (maximaError) {
                    console.warn('MiniMart: Maxima broadcast failed (non-critical):', maximaError);
                }

                // Update local download count
                dapp.downloads = (dapp.downloads || 0) + 1;
                this.refreshMarketplace();
            } else {
                throw new Error(installResult.error || 'MDS install returned false status');
            }
            } catch (installError) {
                console.error('❌ P2P install failed:', installError);
                console.error('   Install command:', `mds action:install file:${dapp.file}`);
                console.error('   MDS result:', installResult);

                // For P2P installs, if MDS fails, we can't really fallback to manual download
                // since we don't have the file locally. This is different from IPFS approach.
                this.showToast(`❌ Install failed: ${installError.message}`, 'error');

                // TODO: Maybe show instructions to visit the store directly?
                console.log('💡 User should visit the store directly:', dapp.store_url);
            }

        } catch (error) {
            console.error('='.repeat(80));
            console.error('❌ MiniMart: Download failed:', error);
            console.error('='.repeat(80));
            this.showToast('❌ Download failed: ' + error.message, 'error');
        }
    }

    showAppDetails(dappUid) {
        const dapp = this.dapps.find(d => d.uid === dappUid);
        if (!dapp) return;

        const modal = document.createElement('div');
        modal.className = 'modal-overlay';
        modal.innerHTML = `
            <div class="modal app-modal">
                <div class="modal-header">
                    <div class="app-detail-header">
                        <div class="app-detail-icon">
                            ${dapp.icon ? `<img src="${dapp.icon}" alt="${dapp.name}" onerror="this.style.display='none'">` : ''}
                            ${!dapp.icon ? '📱' : ''}
            </div>
                        <div class="app-detail-info">
                            <h2>${this.escapeHtml(dapp.name)}</h2>
                            <p class="app-developer-link" onclick="window.app.showVendorProfile('${dapp.developer_address}')">
                                by ${this.shortenAddress(dapp.developer_address)}
                            </p>
                            <div class="app-stats">
                                <span>⬇️ ${dapp.downloads || 0} downloads</span>
                                <span>💰 ${dapp.tips || 0} MINIMA earned</span>
                    </div>
                    </div>
                    </div>
                    <button class="modal-close" onclick="this.closest('.modal-overlay').remove()">×</button>
                    </div>
                <div class="modal-body">
                    <div class="app-description">
                        <h3>Description</h3>
                        <p>${this.escapeHtml(dapp.description)}</p>
                </div>
                    <div class="app-details">
                        <div class="detail-item">
                            <span class="detail-label">Version:</span>
                            <span class="detail-value">${dapp.version}</span>
                        </div>
                        <div class="detail-item">
                            <span class="detail-label">Category:</span>
                            <span class="detail-value">${dapp.category}</span>
                        </div>
                        <div class="detail-item">
                            <span class="detail-label">Size:</span>
                            <span class="detail-value">~${this.estimateSize(dapp)}MB</span>
                        </div>
                    </div>
                    <div class="app-actions">
                        <button class="btn-primary download-btn" onclick="window.app.downloadDapp('${dapp.uid}'); this.closest('.modal-overlay').remove();">
                            📥 Install MiniDapp
                        </button>
                        <button class="btn-outline tip-btn" onclick="window.app.showTipModal('${dapp.developer_address}')">
                            💰 Tip Developer
                    </button>
                </div>
                    <div class="install-info">
                        <small>⚡ Downloads from IPFS and installs to your MiniDapp Hub</small>
                    </div>
            </div>
            </div>
        `;

        document.body.appendChild(modal);
    }

    async showVendorProfile(developerAddress) {
        // Close any open modals first
        document.querySelectorAll('.modal-overlay').forEach(modal => modal.remove());

        const vendorDapps = this.dapps.filter(d => d.developer_address === developerAddress);
        const totalDownloads = vendorDapps.reduce((sum, d) => sum + (d.downloads || 0), 0);
        const totalTips = vendorDapps.reduce((sum, d) => sum + (d.tips || 0), 0);

        // Load vendor profile from blockchain first, then fallback
        console.log('MiniMart: Loading vendor profile for:', developerAddress);
        const blockchainProfiles = await window.blockchainAPI.queryProfiles(developerAddress);
        let vendorProfile = null;

        if (blockchainProfiles.length > 0) {
            blockchainProfiles.sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));
            vendorProfile = blockchainProfiles[0];
        } else {
            vendorProfile = await this.loadUserProfile(developerAddress);
        }

        const modal = document.createElement('div');
        modal.className = 'modal-overlay';
        modal.innerHTML = `
            <div class="modal vendor-modal">
                <div class="modal-header">
                    <div class="vendor-header">
                        <div class="vendor-avatar">🎮</div>
                        <div class="vendor-info">
                            <h2>${vendorProfile.username || this.shortenAddress(developerAddress)}</h2>
                            <p class="vendor-address">${this.shortenAddress(developerAddress)}</p>
                            <div class="vendor-stats">
                                <span>${vendorDapps.length} games</span>
                                <span>${totalDownloads} downloads</span>
                                <span>${totalTips.toFixed(2)} MINIMA earned</span>
                            </div>
                        </div>
                    </div>
                    <button class="modal-close" onclick="this.closest('.modal-overlay').remove()">×</button>
                </div>
                <div class="modal-body">
                    ${vendorProfile.bio ? `<p class="vendor-bio">${this.escapeHtml(vendorProfile.bio)}</p>` : ''}
                    <div class="vendor-links">
                        ${vendorProfile.gitUrl ? `<a href="${vendorProfile.gitUrl}" target="_blank" class="vendor-link">🐙 GitHub</a>` : ''}
                        ${vendorProfile.twitterUrl ? `<a href="${vendorProfile.twitterUrl}" target="_blank" class="vendor-link">🐦 X (Twitter)</a>` : ''}
                    </div>
                    <div class="vendor-actions">
                        <button class="neon-btn" onclick="window.app.messageVendor('${developerAddress}')">
                            💬 Message
                        </button>
                        <button class="neon-btn" onclick="window.app.showTipModal('${developerAddress}')">
                            🎁 Tip Developer
                    </button>
                    </div>
                    <div class="vendor-apps">
                        <h3>🎮 Their Games</h3>
                        <div class="vendor-apps-grid">
                            ${vendorDapps.map(dapp => `
                                <div class="mini-app-card" onclick="window.app.showAppDetails('${dapp.uid}')">
                                    <div class="mini-app-icon">
                                        ${dapp.icon ? `<img src="${dapp.icon}" alt="${dapp.name}" onerror="this.style.display='none'">` : ''}
                                        ${!dapp.icon ? '🎮' : ''}
                                    </div>
                                    <div class="mini-app-info">
                                        <div class="mini-app-name">${this.escapeHtml(dapp.name)}</div>
                                        <div class="mini-app-stats">${dapp.downloads || 0} ↓ • ${dapp.tips || 0} 💰</div>
                                    </div>
                                </div>
                            `).join('')}
                        </div>
                    </div>
                </div>
                </div>
            `;

        document.body.appendChild(modal);
    }

    async messageVendor(developerAddress) {
        try {
            // Get user's Maxima address
            const maximaAddress = await window.maximaAPI.getMaximaAddress();
            if (!maximaAddress) {
                this.showToast('Unable to get your Maxima address', 'error');
                return;
            }

            // Create Maxima contact for the developer
            await window.maximaAPI.addContact(developerAddress);

            // Open Maxima chat (this would typically open the Maxima app)
            this.showToast(`Opening chat with ${this.shortenAddress(developerAddress)}`, 'success');

            // For now, just show a modal with the address
            const modal = document.createElement('div');
            modal.className = 'modal-overlay';
            modal.innerHTML = `
                <div class="modal chat-modal">
                    <div class="modal-header">
                        <h3>💬 Maxima Chat</h3>
                        <button class="modal-close" onclick="this.closest('.modal-overlay').remove()">×</button>
            </div>
                    <div class="modal-body">
                        <p><strong>To:</strong> ${this.shortenAddress(developerAddress)}</p>
                        <p><strong>Your Maxima:</strong> ${this.shortenAddress(maximaAddress)}</p>
                        <p style="color: var(--text-secondary); font-size: 0.9rem; margin-top: var(--spacing-lg);">
                            Chat opened in Maxima! You can now send direct messages to this developer.
                        </p>
                        <button class="neon-btn" onclick="this.closest('.modal-overlay').remove()">
                            ✨ Got it!
                        </button>
                </div>
            </div>
        `;
            document.body.appendChild(modal);

        } catch (error) {
            console.error('MiniMart: Message vendor failed:', error);
            this.showToast('Unable to open chat', 'error');
        }
    }

    async loadUserProfile(address) {
        try {
            // First try blockchain (permanent)
            console.log('MiniMart: Checking blockchain for profile:', address);
            const blockchainProfiles = await window.blockchainAPI.queryProfiles(address);
            if (blockchainProfiles.length > 0) {
                // Return most recent blockchain profile
                blockchainProfiles.sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));
                console.log('MiniMart: Found blockchain profile:', blockchainProfiles[0].username);
                return blockchainProfiles[0];
            }

            // Fall back to local/Maxima storage
            console.log('MiniMart: No blockchain profile, checking local...');
            const localProfile = await window.minimaAPI.loadProfile(address);
            if (localProfile) {
                console.log('MiniMart: Found local profile:', localProfile.username);
                return localProfile;
            }

            return {
                username: null,
                bio: 'MiniMart Developer',
                gitUrl: null,
                twitterUrl: null
            };
        } catch (error) {
            console.error('MiniMart: Failed to load profile:', error);
            return {
                username: null,
                bio: 'MiniMart Developer',
                gitUrl: null,
                twitterUrl: null
            };
        }
    }

    async checkUsernameUnique(username, currentAddress) {
        try {
            // Check localStorage for existing usernames
            // Since profiles are now FREE and stored locally, we check all local profiles
            const allKeys = Object.keys(localStorage);
            const profileKeys = allKeys.filter(key => key.startsWith('minidev_profile_'));

            for (const key of profileKeys) {
                try {
                    const profileData = JSON.parse(localStorage.getItem(key));
                    if (profileData.username === username && profileData.address !== currentAddress) {
                        return false; // Username taken by another local user
                    }
                } catch (e) {
                    // Skip invalid profile data
                    console.warn('MiniMart: Invalid profile data in localStorage:', key);
                }
            }

            return true; // Username available
        } catch (error) {
            console.error('MiniMart: Username check failed:', error);
            return true; // Default to available on error
        }
    }

    showPublishForm() {
        const container = document.getElementById('publish-form');
        if (!container) return;

        container.innerHTML = `
            <div class="publish-form">
                        <div class="form-group">
                    <label for="dapp-name">Dapp Name *</label>
                    <input type="text" id="dapp-name" placeholder="My Amazing Dapp" required>
                        </div>

                        <div class="form-group">
                    <label for="dapp-description">Description *</label>
                    <textarea id="dapp-description" placeholder="What does your dapp do?" required></textarea>
                        </div>

                <div class="form-row">
                        <div class="form-group">
                        <label for="dapp-version">Version *</label>
                        <input type="text" id="dapp-version" placeholder="1.0.0" value="1.0.0" required>
                        </div>
                        <div class="form-group">
                        <label for="dapp-category">Category</label>
                        <select id="dapp-category">
                            <option value="Utilities">Utilities</option>
                            <option value="Games">Games</option>
                            <option value="Finance">Finance</option>
                            <option value="Social">Social</option>
                            <option value="Dev Tools">Dev Tools</option>
                            </select>
                    </div>
                        </div>

                        <div class="form-group">
                    <label for="dapp-icon">Icon URL</label>
                    <input type="url" id="dapp-icon" placeholder="https://example.com/icon.png">
                </div>

                        <div class="form-group">
                    <label for="dapp-zip">MiniDapp ZIP File *</label>
                    <input type="file" id="dapp-zip" accept=".zip,.mds.zip" required>
                    <small>Upload your packaged .mds.zip file</small>
                </div>

                <div class="publish-cost">
                    <div class="cost-info">
                        <span class="cost-label">Registration Fee:</span>
                        <span class="cost-amount">0.01 MINIMA</span>
            </div>
                    <p class="cost-note">One-time fee for permanent blockchain registration</p>
                </div>

                <button class="btn-primary publish-btn" onclick="window.app.publishDapp()">
                    🚀 Publish Dapp
                            </button>
            </div>
        `;
    }

    async publishDapp() {
        try {
            const name = document.getElementById('dapp-name').value.trim();
            const description = document.getElementById('dapp-description').value.trim();
            const version = document.getElementById('dapp-version').value.trim();
            const category = document.getElementById('dapp-category').value;
            const icon = document.getElementById('dapp-icon').value.trim();
            const zipFile = document.getElementById('dapp-zip').files[0];

            if (!name || !description || !version || !zipFile) {
                this.showToast('Please fill in all required fields.', 'error');
                return;
            }

            this.showToast('Publishing your dapp...', 'info');

            // Upload ZIP to IPFS
            console.log('MiniMart: Uploading ZIP to IPFS...');
            const ipfsHash = await window.ipfsAPI.uploadFile(zipFile);
            console.log('MiniMart: ZIP uploaded to IPFS:', ipfsHash);

            // Get developer address FIRST
            const developerAddress = await this.getUserMinimaAddress();

            // Create dapp data
            const dappData = {
                uid: this.generateUid(),
                name,
                description,
                version,
                category,
                icon: icon || null,
                ipfs_hash: ipfsHash,
                developer_address: developerAddress,
                timestamp: Date.now()
            };

            // Add to local array IMMEDIATELY for instant display
            console.log('MiniMart: Adding dapp to local marketplace...');
            this.dapps.unshift(dappData); // Add to beginning

            // Register on blockchain (for permanence)
            console.log('MiniMart: Registering on blockchain...');
            try {
                const txId = await window.blockchainAPI.registerDapp(dappData, developerAddress); // Use the address we already got!
                console.log('MiniMart: Registered with TX:', txId);
            } catch (blockchainError) {
                console.warn('MiniMart: Blockchain registration failed (non-critical):', blockchainError);
            }

            // Broadcast via Maxima (for live updates)
            console.log('MiniMart: Broadcasting via Maxima...');
            try {
                await window.maximaAPI.broadcastNewDapp(dappData); // dappData already has developer_address
            } catch (maximaError) {
                console.warn('MiniMart: Maxima broadcast failed (non-critical):', maximaError);
            }

            this.showToast('Dapp published successfully!', 'success');
            this.switchView('marketplace');

        } catch (error) {
            console.error('MiniMart: Publish failed:', error);
            this.showToast('Failed to publish dapp. Please try again.', 'error');
        }
    }

    async showProfile() {
        console.log('MiniMart: showProfile called');
        const container = document.getElementById('profile-content');
        if (!container) {
            console.error('MiniMart: profile-content container not found');
            this.showToast('Profile container not found', 'error');
            return;
        }


        try {
            // Get user address from Minima node
            const userAddress = await this.getUserMinimaAddress();
            console.log('MiniMart: User Minima address:', userAddress);

            if (!userAddress) {
        container.innerHTML = `
                    <div class="profile-container">
                        <div class="error-state">
                            <div class="error-icon">❌</div>
                            <h3>Cannot Load Profile</h3>
                            <p>Unable to connect to your Minima node.</p>
                            <button class="neon-btn" onclick="window.app.showProfile()">Retry</button>
                        </div>
            </div>
        `;
                return;
            }

            const userDapps = this.dapps.filter(d => d.developer_address === userAddress);
            console.log('MiniMart: User has', userDapps.length, 'dapps');

            // Load profile from blockchain first (permanent), then fall back to Maxima/local
            console.log('MiniMart: Querying blockchain for user profile...');
            const blockchainProfiles = await window.blockchainAPI.queryProfiles(userAddress);
            console.log('MiniMart: Found blockchain profiles:', blockchainProfiles);

            let profile = null;

            // Use the most recent blockchain profile
            if (blockchainProfiles.length > 0) {
                // Sort by timestamp (most recent first)
                blockchainProfiles.sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));
                profile = blockchainProfiles[0];
                console.log('MiniMart: Using blockchain profile:', profile.username);
            } else {
                // Fall back to Maxima/local storage
                console.log('MiniMart: No blockchain profile found, checking Maxima/local...');
                profile = await this.loadUserProfile(userAddress);
                console.log('MiniMart: Loaded fallback profile:', profile);
            }

            // Render profile
            container.innerHTML = this.renderProfile(userAddress, userDapps, profile);

        } catch (error) {
            console.error('MiniMart: Profile loading failed:', error);
            container.innerHTML = `
                <div class="profile-container">
                    <div class="error-state">
                        <div class="error-icon">❌</div>
                        <h3>Profile Error</h3>
                        <p>${error.message || 'Failed to load profile'}</p>
                        <button class="neon-btn" onclick="window.app.showProfile()">Retry</button>
                    </div>
                </div>
            `;
        }
    }

    async getUserMinimaAddress() {
        try {
            // Use the PERSISTENT ID for consistency!
            const persistentId = window.minimaAPI.getPersistentUserId();
            if (persistentId) {
                console.log('MiniMart: Using persistent ID:', persistentId);
                return persistentId;
            }

            // Fallback: try getaddress command
            const addressResult = await window.minimaAPI.cmd('getaddress');
            if (addressResult.response && addressResult.response.address) {
                const address = addressResult.response.address;
                // Store as persistent ID
                localStorage.setItem('minidev_persistent_id', address);
                console.log('MiniMart: Created new persistent ID:', address);
                return address;
            }

            // Last fallback
            const fallback = 'anonymous_' + Date.now();
            localStorage.setItem('minidev_persistent_id', fallback);
            return fallback;
        } catch (error) {
            console.error('MiniMart: Failed to get user address:', error);
            const fallback = 'anonymous_' + Date.now();
            localStorage.setItem('minidev_persistent_id', fallback);
            return fallback;
        }
    }

    async getMaximaAddress() {
        console.log('🔍 Getting Maxima address...');
        try {
            // Use MDS to get Maxima info
            const maximaResult = await window.minimaAPI.cmd('maxima action:info');
            console.log('📡 Maxima info result:', maximaResult);

            if (maximaResult.response && maximaResult.response.address) {
                const maximaAddress = maximaResult.response.address;
                console.log('✅ Got Maxima address:', maximaAddress);

                // Update the input field
                const maximaInput = document.getElementById('profile-maxima');
                if (maximaInput) {
                    maximaInput.value = maximaAddress;
                    this.showToast('📡 Maxima address loaded!', 'success');
                }

                return maximaAddress;
            } else {
                console.warn('⚠️ Maxima not available or not connected');
                this.showToast('📡 Maxima not available. Please enable Maxima in Minima.', 'warning');
                return null;
            }
        } catch (error) {
            console.error('❌ Failed to get Maxima address:', error);
            this.showToast('📡 Failed to get Maxima address. Please check Minima.', 'error');
            return null;
        }
    }

    async addTreasuryStatus(container) {
        // Estimate treasury balance (this would be more accurate with actual treasury tracking)
        const totalUsers = this.dapps.length * 2; // Rough estimate: 2 profiles per dapp
        const estimatedTreasury = totalUsers * 0.01; // 0.01 MINIMA per user

        const treasuryHTML = `
            <div class="treasury-status">
                <div class="treasury-header">
                    <span class="treasury-bank-icon">🏦</span>
                    <span class="treasury-title">MiniMart Treasury</span>
                </div>
                <div class="treasury-stats">
                    <div class="treasury-amount">
                        <span class="amount">${estimatedTreasury.toFixed(2)}</span>
                        <span class="currency">MINIMA</span>
                    </div>
                    <div class="treasury-breakdown">
                        <div class="breakdown-item">
                            <span class="breakdown-label">Developer Rewards</span>
                            <span class="breakdown-value">60%</span>
                        </div>
                        <div class="breakdown-item">
                            <span class="breakdown-label">Platform Growth</span>
                            <span class="breakdown-value">30%</span>
                        </div>
                        <div class="breakdown-item">
                            <span class="breakdown-label">Community Fund</span>
                            <span class="breakdown-value">10%</span>
                        </div>
                    </div>
                </div>
                <div class="treasury-message">
                    💰 Your contributions fund the future of MiniMart! 🎮
                </div>
            </div>
        `;

        // Insert treasury status at the top
        container.insertAdjacentHTML('afterbegin', treasuryHTML);
    }

    renderProfile(userAddress, userDapps, profile) {
        return `
            <div class="profile-container">
                <div class="profile-header-section">
                    <div class="profile-info">
                        <h1 class="profile-username">${this.escapeHtml(profile.username || 'Anonymous')}</h1>
                        <p class="profile-address">${this.shortenAddress(userAddress)}</p>
                        <button class="neon-btn edit-profile-btn" onclick="window.app.editProfile()">
                            ⚡ Edit Profile (FREE!)
                        </button>
                    </div>
                </div>

                <div class="profile-links">
                    ${profile.gitUrl ? `<a href="${profile.gitUrl}" target="_blank" class="profile-link">🐙 GitHub</a>` : ''}
                    ${profile.twitterUrl ? `<a href="${profile.twitterUrl}" target="_blank" class="profile-link">🐦 X (Twitter)</a>` : ''}
                </div>

                <div class="profile-stats-grid">
                    <div class="stat-card">
                        <div class="stat-number">${userDapps.length}</div>
                        <div class="stat-label">Apps Published</div>
                    </div>
                    <div class="stat-card">
                        <div class="stat-number">${userDapps.reduce((sum, d) => sum + (d.downloads || 0), 0)}</div>
                        <div class="stat-label">Total Downloads</div>
                    </div>
                    <div class="stat-card">
                        <div class="stat-number">${userDapps.reduce((sum, d) => sum + (d.tips || 0), 0).toFixed(2)}</div>
                        <div class="stat-label">MINIMA Earned</div>
                    </div>
                </div>

                ${userDapps.length === 0 ? `
                    <div class="empty-profile">
                        <div class="empty-icon">🎮</div>
                        <h3>No Games Yet!</h3>
                        <p>Publish your first game to get started!</p>
                        <button class="neon-btn" onclick="window.app.switchView('publish')">
                            🎯 Publish Your First Game
                        </button>
                    </div>
                ` : `
                    <div class="profile-apps">
                        <h3>🎮 Your Games</h3>
                        <div class="profile-apps-grid">
                            ${userDapps.map(dapp => `
                                <div class="profile-app-card" onclick="window.app.showAppDetails('${dapp.uid}')">
                                    <div class="profile-app-icon">
                                        ${dapp.icon ? `<img src="${dapp.icon}" alt="${dapp.name}" onerror="this.style.display='none'">` : ''}
                                        ${!dapp.icon ? '🎮' : ''}
                                    </div>
                                    <div class="profile-app-info">
                                        <h4>${this.escapeHtml(dapp.name)}</h4>
                                        <div class="profile-app-stats">
                                            <span>⬇️ ${dapp.downloads || 0}</span>
                                            <span>💰 ${dapp.tips || 0}</span>
                                        </div>
                                    </div>
                                </div>
                            `).join('')}
                        </div>
                    </div>
                `}
            </div>
        `;
    }

    async editProfile() {
        const userAddress = await this.getUserMinimaAddress();
        if (!userAddress) {
            this.showToast('Cannot get user address', 'error');
            return;
        }

        const currentProfile = await this.loadUserProfile(userAddress);

        const modal = document.createElement('div');
        modal.className = 'modal-overlay';
        modal.innerHTML = `
            <div class="modal profile-edit-modal">
                <div class="modal-header">
                    <h3>⚡ Edit Your Profile</h3>
                    <button class="modal-close" onclick="this.closest('.modal-overlay').remove()">×</button>
                </div>
                <div class="modal-body">
                        <div class="form-group">
                        <label for="profile-username">🎮 Username *</label>
                        <input type="text" id="profile-username" placeholder="Your unique username" maxlength="20" value="${currentProfile.username || ''}">
                        <small>Unique username (costs 0.01 MINIMA)</small>
                        <div id="username-check" class="username-check"></div>
                        </div>
                        <div class="form-group">
                        <label for="profile-bio">📝 Bio</label>
                        <textarea id="profile-bio" placeholder="Tell gamers about yourself!" maxlength="160">${currentProfile.bio || ''}</textarea>
                        </div>
                        <div class="form-group">
                        <label for="profile-github">🐙 GitHub</label>
                        <input type="url" id="profile-github" placeholder="https://github.com/username" value="${currentProfile.gitUrl || ''}">
                        </div>
                        <div class="form-group">
                        <label for="profile-twitter">🐦 X (Twitter)</label>
                        <input type="url" id="profile-twitter" placeholder="https://x.com/username" value="${currentProfile.twitterUrl || ''}">
                        </div>
                        <div class="form-group">
                        <label for="profile-store-url">🏪 Store URL *</label>
                        <input type="url" id="profile-store-url" placeholder="http://192.168.1.100:8080/dapps.json" value="${currentProfile.store_url || ''}">
                        <small>Link to your MiniDapp store (dapps.json file)</small>
                        </div>
                        <div class="form-group">
                        <label for="profile-maxima">📡 Maxima Address</label>
                        <input type="text" id="profile-maxima" placeholder="MxG..." value="${currentProfile.maxima_address || ''}" readonly>
                        <button type="button" class="btn-outline" onclick="window.app.getMaximaAddress()" style="margin-top: 0.5rem;">
                            🔄 Get My Maxima Address
                        </button>
                        <small>For P2P messaging with other users</small>
                        </div>
                    <div class="treasury-info">
                        <div class="treasury-notice">
                            <strong>⚡ FREE Profile!</strong> No payment required
                        </div>
                        <div class="treasury-benefit">
                            <span class="treasury-icon">🎮</span>
                            <span class="treasury-text">Your profile is stored:</span>
                            <ul class="treasury-list">
                                <li>💾 Locally for instant access</li>
                                <li>📡 Via Maxima for live updates</li>
                                <li>🎁 Publishing dapps costs 0.01 MINIMA</li>
                            </ul>
                                </div>
                                </div>
                    <button class="neon-btn" onclick="window.app.saveProfile()">
                        ✨ Save Profile
                            </button>
                </div>
            </div>
        `;

        document.body.appendChild(modal);

        // Add username uniqueness checking
        const usernameInput = document.getElementById('profile-username');
        const checkDiv = document.getElementById('username-check');

        usernameInput.addEventListener('input', async (e) => {
            const username = e.target.value.trim();
            if (username.length < 3) {
                checkDiv.innerHTML = '<span style="color: var(--text-secondary);">⚡ Username must be at least 3 characters</span>';
                return;
            }

            checkDiv.innerHTML = '<span style="color: var(--text-secondary);">🔍 Checking availability...</span>';

            const isAvailable = await this.checkUsernameUnique(username, window.minimaAPI.getCurrentAddress());

            if (isAvailable) {
                checkDiv.innerHTML = '<span style="color: var(--accent-success);">✅ Username available!</span>';
            } else {
                checkDiv.innerHTML = '<span style="color: var(--accent-error);">❌ Username taken</span>';
            }
        });
    }

    async saveProfile() {
        try {
            const username = document.getElementById('profile-username').value.trim();
            const bio = document.getElementById('profile-bio').value.trim();
            const github = document.getElementById('profile-github').value.trim();
            const twitter = document.getElementById('profile-twitter').value.trim();
            const storeUrl = document.getElementById('profile-store-url').value.trim();
            const maximaAddress = document.getElementById('profile-maxima').value.trim();

            // Get user's Minima address
            const userAddress = await this.getUserMinimaAddress();
            if (!userAddress) {
                this.showToast('❌ Cannot get your Minima address!', 'error');
                return;
            }

            if (!username) {
                this.showToast('🎮 Username is required!', 'error');
                return;
            }

            if (username.length < 3) {
                this.showToast('⚡ Username must be at least 3 characters!', 'error');
                return;
            }

            // Check username uniqueness (but allow user to keep their own username)
            const currentProfile = await window.minimaAPI.loadProfile(userAddress);
            const isChangingUsername = !currentProfile || currentProfile.username !== username;

            if (isChangingUsername) {
                const isAvailable = await this.checkUsernameUnique(username, userAddress);
                if (!isAvailable) {
                    this.showToast('❌ Username already taken!', 'error');
                    return;
                }
            }

            this.showToast('⚡ Creating profile...', 'info');

            // Create profile immediately (NO PAYMENT REQUIRED!)
            // Profiles are FREE and stored locally + broadcast via Maxima
            await this.completeProfileCreation(userAddress, username, bio, github, twitter, storeUrl, maximaAddress);

        } catch (error) {
            console.error('MiniMart: Profile creation failed:', error);
            this.showToast('❌ Failed to create profile. Please try again.', 'error');
        }
    }

    async completeProfileCreation(userAddress, username, bio, github, twitter, storeUrl, maximaAddress) {
        // Create profile data
        const profileData = {
            username,
            bio: bio || '🎮 MiniMart Game Developer',
            gitUrl: github || null,
            twitterUrl: twitter || null,
            store_url: storeUrl || null,
            maxima_address: maximaAddress || null,
            address: userAddress,
            timestamp: Date.now(),
            identity_created: true
        };

        // Store locally for immediate access (PRIMARY storage)
        console.log('MiniMart: Saving profile locally...');
        await window.minimaAPI.saveProfile(profileData);
        this.profiles = this.profiles || {};
        this.profiles[userAddress] = profileData;

        // Broadcast via Maxima for live updates to other users
        try {
            await window.maximaAPI.broadcastProfileUpdate(profileData);
            console.log('MiniMart: Profile broadcast via Maxima');
        } catch (error) {
            console.warn('MiniMart: Maxima broadcast failed (non-critical):', error);
        }

        // Close modal and refresh profile
        const modal = document.querySelector('.modal-overlay');
        if (modal) modal.remove();
        this.showProfile();

        this.showToast('✨ Profile created! (FREE!)', 'success');
    }

    async showTipModal(developerAddress) {
        const developerProfile = await this.loadUserProfile(developerAddress);

        const modal = document.createElement('div');
        modal.className = 'modal-overlay';
        modal.innerHTML = `
            <div class="modal tip-modal">
                <div class="modal-header">
                    <h3>🎁 Tip ${developerProfile.username || this.shortenAddress(developerAddress)}</h3>
                    <button class="modal-close" onclick="this.closest('.modal-overlay').remove()">×</button>
                </div>
                <div class="modal-body">
                    <p>Show your appreciation! 💰</p>
                    <div class="tip-presets">
                        <button class="tip-preset" data-amount="0.01">0.01</button>
                        <button class="tip-preset" data-amount="0.1">0.1</button>
                        <button class="tip-preset" data-amount="1">1</button>
                        <button class="tip-preset" data-amount="5">5</button>
                        </div>
                    <div class="custom-tip">
                        <input type="number" id="custom-tip-amount" placeholder="Custom amount" step="0.01" min="0.01">
                        <span>MINIMA</span>
                        </div>
                    <button class="neon-btn" onclick="window.app.sendTip('${developerAddress}')">
                        🎁 Send Tip
                            </button>
                </div>
            </div>
        `;

        document.body.appendChild(modal);

        // Setup preset buttons
        modal.querySelectorAll('.tip-preset').forEach(btn => {
            btn.addEventListener('click', () => {
                const amount = btn.dataset.amount;
                document.getElementById('custom-tip-amount').value = amount;
                modal.querySelectorAll('.tip-preset').forEach(b => b.classList.remove('selected'));
                btn.classList.add('selected');
            });
        });
    }

    async sendTip(developerAddress) {
        try {
            const amount = parseFloat(document.getElementById('custom-tip-amount').value);

            if (!amount || amount <= 0) {
                this.showToast('💰 Please enter a valid tip amount!', 'error');
                return;
            }

            // Check balance
            const balance = await window.minimaAPI.getBalance();
            if (parseFloat(balance.confirmed) < amount) {
                this.showToast('💰 Insufficient balance!', 'error');
                return;
            }

            this.showToast('🎁 Sending tip...', 'info');

            // Send tip via Minima
            await window.minimaAPI.send(amount.toString(), developerAddress);

            // Send Maxima notification to developer
            await window.maximaAPI.broadcastTip(amount, developerAddress, window.minimaAPI.getCurrentAddress());

            // Update local tip count for this developer
            const dapp = this.dapps.find(d => d.developer_address === developerAddress);
            if (dapp) {
                dapp.tips = (dapp.tips || 0) + amount;
            }

            // Close modal
            document.querySelector('.modal-overlay').remove();

            this.showToast(`🎁 Tip of ${amount} MINIMA sent!`, 'success');

        } catch (error) {
            console.error('MiniMart: Tip failed:', error);
            this.showToast('❌ Failed to send tip!', 'error');
        }
    }

    showTreasuryModal() {
        // Calculate current treasury estimate
        const totalUsers = Math.max(this.dapps.length * 2, 1);
        const estimatedTreasury = totalUsers * 0.01;

        const modal = document.createElement('div');
        modal.className = 'modal-overlay';
        modal.innerHTML = `
            <div class="modal treasury-modal">
                <div class="modal-header">
                    <h3>🏦 MiniMart Treasury</h3>
                    <button class="modal-close" onclick="this.closest('.modal-overlay').remove()">×</button>
                </div>
                <div class="modal-body">
                    <div class="treasury-status">
                        <div class="treasury-header">
                            <span class="treasury-bank-icon">🏦</span>
                            <span class="treasury-title">Community Treasury</span>
                        </div>
                        <div class="treasury-stats">
                            <div class="treasury-amount">
                                <span class="amount">${estimatedTreasury.toFixed(2)}</span>
                                <span class="currency">MINIMA</span>
                            </div>
                            <div class="treasury-breakdown">
                                <div class="breakdown-item">
                                    <span class="breakdown-label">Developer Rewards</span>
                                    <span class="breakdown-value">60%</span>
                                </div>
                                <div class="breakdown-item">
                                    <span class="breakdown-label">Platform Growth</span>
                                    <span class="breakdown-value">30%</span>
                                </div>
                                <div class="breakdown-item">
                                    <span class="breakdown-label">Community Fund</span>
                                    <span class="breakdown-value">10%</span>
                                </div>
                            </div>
                        </div>
                        <div class="treasury-message">
                            💰 Your contributions fund the future of MiniMart! 🎮
                        </div>
                    </div>

                    <div class="treasury-info">
                        <h4>How Treasury Works</h4>
                        <ul>
                            <li>🎯 <strong>0.01 MINIMA</strong> per profile creation</li>
                            <li>🚀 <strong>0.01 MINIMA</strong> per dapp registration</li>
                            <li>🎁 <strong>60%</strong> goes to developer rewards & bounties</li>
                            <li>🏗️ <strong>30%</strong> funds platform improvements</li>
                            <li>🤝 <strong>10%</strong> supports community initiatives</li>
                        </ul>

                        <div class="treasury-address">
                            <strong>Treasury Address:</strong><br>
                            <code>MxG086AUGQMWM6S47P6GWR2U1AV3391EPR5Q53N7DN9MGNMMN6BMH270SV8QRSC</code>
                        </div>
                    </div>
                </div>
            </div>
        `;

        document.body.appendChild(modal);
    }

    async showPending() {
        const container = document.getElementById('pending-content');
        if (!container) {
            console.error('MiniMart: pending-content container not found');
            return;
        }

        try {
            // Check for pending transactions using correct Minima command
            const pendingResult = await window.minimaAPI.cmd('mds action:list');
            console.log('MiniMart: Pending transactions result:', pendingResult);

            container.innerHTML = `
                <div class="pending-header">
                    <h2>⏳ Pending Transactions</h2>
                    <p>Approve or deny transactions requiring your confirmation</p>
                </div>

                <div class="pending-refresh">
                    <button class="neon-btn" onclick="window.app.showPending()">🔄 Refresh</button>
                </div>
            `;

            // Parse pending transactions response
            let pendingTxs = [];
            if (pendingResult.response && pendingResult.response.actions) {
                // The 'mds action:list' command returns an actions array
                pendingTxs = pendingResult.response.actions;
            } else if (Array.isArray(pendingResult.response)) {
                pendingTxs = pendingResult.response;
            }

            if (pendingTxs && pendingTxs.length > 0) {
                const pendingList = pendingTxs.map(tx => `
                    <div class="pending-item">
                        <div class="pending-info">
                            <div class="pending-amount">💰 ${tx.minima || tx.amount || '0.01'} MINIMA</div>
                            <div class="pending-to">To: ${tx.address ? this.shortenAddress(tx.address) : 'Treasury'}</div>
                            <div class="pending-id">ID: ${tx.uid || tx.id}</div>
                        </div>
                        <div class="pending-actions">
                            <button class="neon-btn approve-btn" onclick="window.app.approveTransaction('${tx.uid || tx.id}')">
                                ✅ Approve
                            </button>
                            <button class="btn-outline deny-btn" onclick="window.app.denyTransaction('${tx.uid || tx.id}')">
                                ❌ Deny
                            </button>
                        </div>
                    </div>
                `).join('');

                container.innerHTML += `
                    <div class="pending-list">
                        ${pendingList}
                    </div>
                `;
            } else {
                container.innerHTML += `
                    <div class="no-pending">
                        <div class="no-pending-icon">✅</div>
                        <h3>No Pending Transactions</h3>
                        <p>All transactions have been processed!</p>
                    </div>
                `;
            }

            // Check for pending profile creation
            const pendingProfile = localStorage.getItem('pending_profile');
            if (pendingProfile) {
                container.innerHTML += `
                    <div class="pending-profile-notice">
                        <div class="notice-icon">👤</div>
                        <div class="notice-text">
                            <strong>Profile Creation Pending</strong><br>
                            Approve the 0.01 MINIMA transaction above to complete your permanent identity!
                        </div>
                    </div>
                `;
            }

        } catch (error) {
            console.error('MiniMart: Failed to load pending transactions:', error);

            // Show manual instructions
            container.innerHTML = `
                <div class="pending-header">
                    <h2>⏳ Approve Your Transaction</h2>
                    <p>You need to approve the 0.01 MINIMA payment to complete profile creation</p>
                </div>

                <div class="manual-approval">
                    <div class="manual-instruction">
                        <h3>📋 Manual Approval Steps:</h3>
                        <ol>
                            <li>Open your Minima CLI</li>
                            <li>Run: <code>mds action:list</code></li>
                            <li>Find the transaction with amount 0.01</li>
                            <li>Run: <code>mds action:accept uid:TRANSACTION_UID</code></li>
                            <li>Return here and click "Check Again"</li>
                        </ol>
                    </div>

                    <div class="action-buttons">
                        <button class="neon-btn" onclick="window.app.showPending()">🔄 Check Again</button>
                        <button class="btn-outline" onclick="window.app.switchView('profile')">👤 Back to Profile</button>
                    </div>

                    <div class="pending-notice">
                        <strong>💡 Tip:</strong> You can also approve transactions directly in your Minima node's web interface at <code>http://127.0.0.1:9003</code>
                    </div>
                </div>
            `;
        }
    }

    async approveTransaction(txId) {
        try {
            this.showToast('🔄 Approving transaction...', 'info');

            // Approve the transaction using correct Minima command
            const approveResult = await window.minimaAPI.cmd(`mds action:accept uid:${txId}`);

            // Check if this was a profile creation
            const pendingProfile = localStorage.getItem('pending_profile');
            if (pendingProfile) {
                const profileData = JSON.parse(pendingProfile);
                localStorage.removeItem('pending_profile');

                // Complete profile creation
                await this.completeProfileCreation(
                    profileData.address,
                    profileData.username,
                    profileData.bio,
                    profileData.gitUrl,
                    profileData.twitterUrl
                );

                // Switch back to profile view
                this.switchView('profile');
            } else {
                this.showToast('✅ Transaction approved!', 'success');
                this.showPending(); // Refresh the list
            }

        } catch (error) {
            console.error('MiniMart: Failed to approve transaction:', error);
            this.showToast('❌ Failed to approve transaction', 'error');
        }
    }

    async denyTransaction(txId) {
        try {
            this.showToast('🔄 Denying transaction...', 'info');

            // Deny the transaction using correct Minima command
            const denyResult = await window.minimaAPI.cmd(`mds action:deny uid:${txId}`);

            // Clear any pending profile data
            localStorage.removeItem('pending_profile');

            this.showToast('❌ Transaction denied', 'warning');
            this.showPending(); // Refresh the list

        } catch (error) {
            console.error('MiniMart: Failed to deny transaction:', error);
            this.showToast('❌ Failed to deny transaction', 'error');
        }
    }

    editDapp(dappUid) {
        this.showToast('Dapp management coming soon!', 'info');
    }

    shortenAddress(address) {
        if (!address) return 'Unknown';
        // Convert to string if it's not already (handles objects, numbers, etc.)
        const addrStr = String(address);
        if (addrStr.length < 12) return addrStr;
        return addrStr.substring(0, 6) + '...' + addrStr.substring(addrStr.length - 4);
    }

    estimateSize(dapp) {
        // Rough estimate based on IPFS hash (each char ~ 1KB)
        return Math.max(1, Math.floor((dapp.ipfs_hash || '').length / 10));
    }

    generateUid() {
        return '0x' + Math.random().toString(16).substr(2, 64).toUpperCase();
    }

    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    showToast(message, type = 'info') {
        console.log(`MiniMart ${type.toUpperCase()}:`, message);

        // Create toast element
        const toast = document.createElement('div');
        toast.className = `toast toast-${type}`;

        const icon = type === 'error' ? '❌' : type === 'success' ? '✅' : type === 'warning' ? '⚠️' : 'ℹ️';
        toast.innerHTML = `
            <span class="toast-icon">${icon}</span>
            <span class="toast-message">${message}</span>
        `;

        // Add to page
        document.body.appendChild(toast);

        // Animate in
        setTimeout(() => toast.classList.add('toast-show'), 10);

        // Auto-remove after 4 seconds
        setTimeout(() => {
            toast.classList.remove('toast-show');
            setTimeout(() => toast.remove(), 300);
        }, 4000);
    }

    showError(message) {
        this.showToast(message, 'error');
    }

    hideLoading() {
        const loading = document.getElementById('loading');
        const app = document.getElementById('app');

        if (loading) loading.classList.add('hidden');
        if (app) app.classList.remove('hidden');
    }
}

// Initialize app when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    console.log('MiniMart: DOM ready, creating app...');
    window.app = new MiniMartApp();
    window.app.init();
});
