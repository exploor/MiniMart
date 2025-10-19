/**
 * MiniMart Marketplace Module
 * Handles marketplace-specific functionality
 */

console.log('MiniMart: Marketplace module loading...');

class Marketplace {
    constructor() {
        this.dapps = [];
        this.filters = {
            category: 'all',
            search: ''
        };
    }

    init() {
        console.log('MiniMart: Marketplace initialized');
    }

    setDapps(dapps) {
        this.dapps = dapps || [];
        this.refreshDisplay();
    }

    addDapp(dapp) {
        this.dapps.unshift(dapp); // Add to beginning
        this.refreshDisplay();
    }

    refreshDisplay() {
        const filteredDapps = this.getFilteredDapps();
        this.renderDapps(filteredDapps);
    }

    getFilteredDapps() {
        return this.dapps.filter(dapp => {
            const matchesCategory = this.filters.category === 'all' ||
                                  dapp.category === this.filters.category;

            const matchesSearch = !this.filters.search ||
                                dapp.name.toLowerCase().includes(this.filters.search.toLowerCase()) ||
                                dapp.description.toLowerCase().includes(this.filters.search.toLowerCase());

            return matchesCategory && matchesSearch;
        });
    }

    renderDapps(dapps) {
        const grid = document.getElementById('dapps-grid');
        if (!grid) return;

        if (dapps.length === 0) {
            grid.innerHTML = this.renderEmptyState();
            return;
        }

        grid.innerHTML = dapps.map(dapp => this.renderDappCard(dapp)).join('');
    }

    renderEmptyState() {
        return `
            <div class="empty-state">
                <div class="empty-icon">🛒</div>
                <h3>No MiniDapps Found</h3>
                <p>${this.filters.search || this.filters.category !== 'all' ?
                    'Try adjusting your filters' :
                    'Be the first to publish a decentralized app!'}</p>
                <button class="btn-primary" onclick="window.app.switchView('publish')">
                    ${this.filters.search || this.filters.category !== 'all' ?
                        'Clear Filters' :
                        'Publish Your First Dapp'}
                </button>
            </div>
        `;
    }

    renderDappCard(dapp) {
        const isOwnDapp = dapp.developer_address === window.minimaAPI.getCurrentAddress();

        return `
            <div class="dapp-card ${isOwnDapp ? 'own-dapp' : ''}" data-uid="${dapp.uid}">
                ${isOwnDapp ? '<div class="own-badge">Your Dapp</div>' : ''}

                <div class="dapp-header">
                    <div class="dapp-icon">
                        ${dapp.icon ? `<img src="${dapp.icon}" alt="${dapp.name}" onerror="this.style.display='none'">` : ''}
                        ${!dapp.icon ? '📦' : ''}
                    </div>
                    <div class="dapp-info">
                        <h3 class="dapp-name">${this.escapeHtml(dapp.name)}</h3>
                        <p class="dapp-description">${this.escapeHtml(dapp.description)}</p>
                        <div class="dapp-meta">
                            <span class="dapp-version">v${dapp.version}</span>
                            <span class="dapp-category">${dapp.category}</span>
                            <span class="dapp-developer">${this.shortenAddress(dapp.developer_address)}</span>
                        </div>
                    </div>
                </div>

                <div class="dapp-stats">
                    <div class="stat">
                        <span class="stat-icon">⬇️</span>
                        <span class="stat-number">${dapp.downloads || 0}</span>
                        <span class="stat-label">Downloads</span>
                    </div>
                    <div class="stat">
                        <span class="stat-icon">💰</span>
                        <span class="stat-number">${dapp.tips || 0}</span>
                        <span class="stat-label">Tips</span>
                    </div>
                </div>

                <div class="dapp-actions">
                    <button class="btn-primary download-btn" onclick="window.marketplace.downloadDapp('${dapp.uid}')">
                        ⬇️ Download
                    </button>
                    <button class="btn-outline tip-btn" onclick="window.marketplace.showTipModal('${dapp.developer_address}')">
                        💰 Tip Developer
                    </button>
                    ${isOwnDapp ? `
                        <button class="btn-outline edit-btn" onclick="window.marketplace.editDapp('${dapp.uid}')">
                            ✏️ Edit
                        </button>
                    ` : ''}
                </div>
            </div>
        `;
    }

    async downloadDapp(dappUid) {
        try {
            const dapp = this.dapps.find(d => d.uid === dappUid);
            if (!dapp) {
                window.app.showToast('Dapp not found', 'error');
                return;
            }

            console.log('MiniMart: Downloading dapp:', dapp.name);

            // Broadcast download event via Maxima
            await window.maximaAPI.broadcastDownload(dappUid, window.minimaAPI.getCurrentAddress());

            // Update local download count
            dapp.downloads = (dapp.downloads || 0) + 1;
            this.refreshDisplay();

            window.app.showToast(`Downloading ${dapp.name}...`, 'success');

        } catch (error) {
            console.error('MiniMart: Download failed:', error);
            window.app.showToast('Download failed. Please try again.', 'error');
        }
    }

    showTipModal(developerAddress) {
        // For now, show a simple tip interface
        const modal = document.createElement('div');
        modal.className = 'modal-overlay';
        modal.innerHTML = `
            <div class="modal">
                <div class="modal-header">
                    <h3>Tip Developer</h3>
                    <button class="modal-close" onclick="this.closest('.modal-overlay').remove()">×</button>
                </div>
                <div class="modal-body">
                    <p>Send a tip to support this developer</p>
                    <div class="tip-amounts">
                        <button class="tip-amount" data-amount="0.01">0.01 MINIMA</button>
                        <button class="tip-amount" data-amount="0.1">0.1 MINIMA</button>
                        <button class="tip-amount" data-amount="1">1 MINIMA</button>
                        <input type="number" id="custom-tip" placeholder="Custom amount" step="0.01" min="0.01">
                    </div>
                    <button class="btn-primary" onclick="window.marketplace.sendTip('${developerAddress}')">
                        Send Tip
                    </button>
                </div>
            </div>
        `;

        document.body.appendChild(modal);

        // Setup tip amount buttons
        modal.querySelectorAll('.tip-amount').forEach(btn => {
            btn.addEventListener('click', () => {
                const amount = btn.dataset.amount;
                document.getElementById('custom-tip').value = amount;
                modal.querySelectorAll('.tip-amount').forEach(b => b.classList.remove('selected'));
                btn.classList.add('selected');
            });
        });
    }

    async sendTip(developerAddress) {
        try {
            const customAmount = document.getElementById('custom-tip').value;
            const amount = parseFloat(customAmount);

            if (!amount || amount <= 0) {
                window.app.showToast('Please enter a valid tip amount', 'error');
                return;
            }

            console.log('MiniMart: Sending tip of', amount, 'MINIMA to', developerAddress);

            // Send tip via Minima
            await window.minimaAPI.send(amount, developerAddress);

            // Broadcast tip event via Maxima
            await window.maximaAPI.broadcastTip(amount, developerAddress, window.minimaAPI.getCurrentAddress());

            // Close modal
            document.querySelector('.modal-overlay').remove();

            window.app.showToast(`Tip of ${amount} MINIMA sent!`, 'success');

        } catch (error) {
            console.error('MiniMart: Tip failed:', error);
            window.app.showToast('Failed to send tip. Please try again.', 'error');
        }
    }

    editDapp(dappUid) {
        window.app.showToast('Edit feature coming soon!', 'info');
    }

    setFilter(type, value) {
        this.filters[type] = value;
        this.refreshDisplay();
    }

    clearFilters() {
        this.filters = {
            category: 'all',
            search: ''
        };
        this.refreshDisplay();
    }

    shortenAddress(address) {
        if (!address) return 'Unknown';
        return address.substring(0, 6) + '...' + address.substring(address.length - 4);
    }

    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }
}

// Marketplace is now integrated into app.js
// This file provides additional marketplace functionality
