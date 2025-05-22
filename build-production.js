import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ログ出力関数
function log(message) {
  console.log(`[BUILD] ${message}`);
}

// コマンド実行関数
function runCommand(command) {
  log(`実行: ${command}`);
  try {
    execSync(command, { stdio: 'inherit' });
    return true;
  } catch (error) {
    log(`エラー: ${command}`);
    console.error(error);
    return false;
  }
}

// ビルドプロセス
async function build() {
  log('本番環境用ビルドを開始します');
  
  // 必要なパッケージをインストール
  log('依存パッケージをインストールしています...');
  if (!runCommand('npm install')) {
    process.exit(1);
  }
  
  // フロントエンドのビルド
  log('フロントエンドをビルドしています...');
  if (!runCommand('npx vite build')) {
    log('フロントエンドのビルドに失敗しました。バックエンドのみで続行します。');
  }
  
  // distディレクトリの確認
  if (!fs.existsSync('dist')) {
    log('distディレクトリを作成します');
    fs.mkdirSync('dist');
  }
  
  // publicディレクトリの確認
  if (!fs.existsSync('dist/public')) {
    log('dist/publicディレクトリを作成します');
    fs.mkdirSync('dist/public', { recursive: true });
  }
  
  // full-server.jsをdistディレクトリにコピー
  log('サーバーファイルをコピーしています...');
  fs.copyFileSync('full-server.js', path.join('dist', 'server.js'));
  
  log('本番環境用ビルドが完了しました！');
}

// ビルド実行
build().catch(error => {
  log('ビルドエラー:');
  console.error(error);
  process.exit(1);
});