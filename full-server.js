import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import { initializeApp } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';

// ESモジュール用のディレクトリパス取得
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Firebase設定
const firebaseConfig = {
  apiKey: "AIzaSyC1mnXL-vofyL10NPsWH86EAUs-B6APVek",
  authDomain: "vending-b7172.firebaseapp.com",
  projectId: "vending-b7172",
  storageBucket: "vending-b7172.firebasestorage.app",
  messagingSenderId: "207956683496",
  appId: "1:207956683496:web:93dff9d97b4da303fa375d",
  measurementId: "G-EVXS44NVHC"
};

// Firebase初期化
const firebaseApp = initializeApp(firebaseConfig);
const db = getFirestore(firebaseApp);

// Expressアプリ作成
const app = express();
app.use(express.json());

// 静的ファイル配信設定
app.use(express.static(path.join(__dirname, 'dist/public')));

// API Routes
app.get('/api/status', (req, res) => {
  res.json({
    status: 'ok',
    server: 'Discord Bot Vending Machine API',
    time: new Date().toISOString(),
    environment: process.env.NODE_ENV || 'development',
    firebase: true
  });
});

// 現在のダミーデータのAPIエンドポイント
app.get('/api/items', (req, res) => {
  const items = [
    {
      "name": "プレミアムロール",
      "description": "サーバー内で特別な役割を付与します",
      "price": 1000,
      "stock": 50,
      "id": 1,
      "createdAt": "2023-04-01T00:00:00.000Z",
      "isActive": true,
      "infiniteStock": false,
      "discordRoleId": "123456789012345678",
      "options": null,
      "content": null,
      "contentOptions": null
    },
    {
      "name": "VIPステータス",
      "description": "1ヶ月間のVIP特典を獲得できます",
      "price": 5000,
      "stock": 10,
      "id": 2,
      "createdAt": "2023-04-02T00:00:00.000Z",
      "isActive": true,
      "infiniteStock": false,
      "discordRoleId": "234567890123456789",
      "options": null,
      "content": null,
      "contentOptions": null
    },
    {
      "name": "カスタム絵文字",
      "description": "あなたの好きな絵文字をサーバーに追加します",
      "price": 2000,
      "stock": 15,
      "id": 3,
      "createdAt": "2023-04-03T00:00:00.000Z",
      "isActive": true,
      "infiniteStock": false,
      "discordRoleId": null,
      "options": null,
      "content": null,
      "contentOptions": null
    },
    {
      "name": "プライベートチャンネル",
      "description": "あなた専用のプライベートチャンネルを作成します",
      "price": 3000,
      "stock": 5,
      "id": 4,
      "createdAt": "2023-04-04T00:00:00.000Z",
      "isActive": true,
      "infiniteStock": false,
      "discordRoleId": null,
      "options": null,
      "content": null,
      "contentOptions": null
    }
  ];
  
  res.json(items);
});

app.get('/api/stats', (req, res) => {
  const stats = {
    "totalSales": 0,
    "totalRevenue": 0,
    "totalStock": 155,
    "lowStockItems": 5,
    "userCount": 0,
    "newUsers": 0,
    "salesGrowth": 0
  };
  
  res.json(stats);
});

// フロントエンドのルートハンドリング（SPAサポート）
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'dist/public', 'index.html'));
});

// サーバー起動
const PORT = process.env.PORT || 10000;
app.listen(PORT, '0.0.0.0', () => {
  console.log(`Discord Bot Vending Machine server running on port ${PORT} in ${process.env.NODE_ENV || 'development'} mode`);
});