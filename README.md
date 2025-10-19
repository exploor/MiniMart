# MiniMart

A decentralized MiniDapp marketplace built on the Minima blockchain. Discover, download, and tip creators in a peer-to-peer ecosystem.

## 🌟 Features

- **Decentralized Marketplace**: Browse MiniDapps from multiple peer-hosted stores
- **P2P Installation**: Direct installation from developer servers (no central hosting)
- **Blockchain Verification**: Permanent dapp registration on Minima blockchain
- **Social Features**: Developer profiles, tipping system, Maxima messaging
- **IPFS Integration**: Decentralized file storage for MiniDapp packages
- **Treasury System**: Community-funded platform with developer rewards

## 🏗️ Architecture

### Core Components

- **`app.js`**: Main application logic and UI management
- **`minimaAPI.js`**: Minima blockchain interaction layer
- **`maximaAPI.js`**: P2P messaging and real-time updates
- **`blockchainAPI.js`**: Smart contract interactions for permanent data
- **`storeAggregator.js`**: Aggregates dapps from multiple peer stores
- **`marketplace.js`**: Marketplace UI and dapp discovery
- **`ipfsAPI.js`**: IPFS upload/download for MiniDapp files

### Data Flow

1. **Discovery**: Store aggregator fetches dapp manifests from peer URLs
2. **Registration**: Dapps registered permanently on Minima blockchain (0.01 MINIMA fee)
3. **Installation**: P2P download from developer HTTP servers via MDS
4. **Verification**: Blockchain-stored profiles ensure developer authenticity

## 🚀 Quick Start

### Prerequisites

- Minima node running locally (port 9002/9003)
- Maxima enabled for P2P features
- Modern web browser with MDS support

### Installation

1. **Clone the repository:**
   ```bash
   git clone https://github.com/exploor/MiniMart.git
   cd MiniMart
   ```

2. **Package as MiniDapp:**
   ```bash
   # Create .mds.zip package
   # (Files are already packaged in minimart_v9.mds.zip)
   ```

3. **Install via Minima:**
   ```bash
   # Run install_minimart.cmd or manually:
   minima.jar -mds file:minimart_v9.mds.zip
   ```

4. **Access MiniMart:**
   - Open Minima desktop app
   - Navigate to MiniDapps → MiniMart

## 💰 Economy

- **Profile Creation**: Free (local + Maxima broadcast)
- **Dapp Registration**: 0.01 MINIMA (permanent blockchain storage)
- **Developer Tipping**: Variable amounts in MINIMA
- **Treasury Distribution**: 60% developers, 30% platform, 10% community

## 🔧 Technical Details

### Minima Integration

- **UTxO Model**: Uses Minima's unspent transaction output system
- **KISSVM Contracts**: Smart contracts for permanent data storage
- **Maxima Protocol**: Encrypted P2P messaging between users
- **MDS System**: MiniDapp runtime environment

### File Structure

```
MiniMart/
├── index.html          # Main UI
├── js/
│   ├── app.js         # Application controller
│   ├── minimaAPI.js   # Minima blockchain API
│   ├── maximaAPI.js   # Maxima messaging API
│   ├── blockchainAPI.js # Smart contract layer
│   ├── storeAggregator.js # P2P store aggregation
│   └── marketplace.js # Marketplace UI logic
├── css/
│   └── main.css       # Stylesheets
├── dapp.conf          # MiniDapp manifest
├── minima.jar         # Minima runtime
└── minimart_v9.mds.zip # Packaged MiniDapp
```

## 📡 API Endpoints

### Store Format
```json
{
  "name": "My Store",
  "description": "Developer store",
  "dapps": [
    {
      "uid": "unique-id",
      "name": "My Dapp",
      "description": "Description",
      "version": "1.0.0",
      "category": "Games",
      "icon": "https://...",
      "file": "http://store.example.com/dapp.mds.zip",
      "developer_address": "Mx...",
      "store_url": "http://store.example.com/dapps.json"
    }
  ]
}
```

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Test on Minima testnet
4. Submit pull request

## 📄 License

This project is open source. See individual files for licensing.

## ⚠️ Disclaimer

This is experimental software. Use at your own risk. Always backup your Minima wallet keys.
