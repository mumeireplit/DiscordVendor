import { initializeApp } from 'firebase/app';
import { getFirestore, collection, doc, getDoc, getDocs, setDoc, updateDoc, deleteDoc, query, where } from 'firebase/firestore';
import { IStorage } from './storage';
import { 
  User, InsertUser, 
  Item, InsertItem, 
  DiscordUser, InsertDiscordUser, 
  Transaction, InsertTransaction, 
  BotSettings, InsertBotSettings 
} from '@shared/schema';

// Firebase設定 - ハードコード値を使用
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
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

// Firebaseストレージクラス
export class FirebaseStorage implements IStorage {
  // コレクション参照
  private usersCol = collection(db, 'users');
  private itemsCol = collection(db, 'items');
  private discordUsersCol = collection(db, 'discord_users');
  private transactionsCol = collection(db, 'transactions');
  private botSettingsCol = collection(db, 'bot_settings');

  // ユーザー関連のメソッド
  async getUser(id: number): Promise<User | undefined> {
    try {
      const userDoc = await getDoc(doc(this.usersCol, id.toString()));
      if (userDoc.exists()) {
        return userDoc.data() as User;
      }
      return undefined;
    } catch (error) {
      console.error('Error getting user:', error);
      return undefined;
    }
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    try {
      const q = query(this.usersCol, where('username', '==', username));
      const querySnapshot = await getDocs(q);
      if (!querySnapshot.empty) {
        return querySnapshot.docs[0].data() as User;
      }
      return undefined;
    } catch (error) {
      console.error('Error getting user by username:', error);
      return undefined;
    }
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    try {
      // 既存のユーザーIDの最大値を取得して新しいIDを生成
      const querySnapshot = await getDocs(this.usersCol);
      let maxId = 0;
      querySnapshot.forEach((doc) => {
        const userData = doc.data() as User;
        if (userData.id > maxId) {
          maxId = userData.id;
        }
      });
      
      const id = maxId + 1;
      const user: User = { ...insertUser, id };
      
      await setDoc(doc(this.usersCol, id.toString()), user);
      return user;
    } catch (error) {
      console.error('Error creating user:', error);
      throw error;
    }
  }

  // アイテム関連のメソッド
  async getItems(): Promise<Item[]> {
    try {
      const querySnapshot = await getDocs(this.itemsCol);
      const items: Item[] = [];
      querySnapshot.forEach((doc) => {
        items.push(doc.data() as Item);
      });
      return items;
    } catch (error) {
      console.error('Error getting items:', error);
      return [];
    }
  }

  async getItem(id: number): Promise<Item | undefined> {
    try {
      const itemDoc = await getDoc(doc(this.itemsCol, id.toString()));
      if (itemDoc.exists()) {
        return itemDoc.data() as Item;
      }
      return undefined;
    } catch (error) {
      console.error('Error getting item:', error);
      return undefined;
    }
  }

  async createItem(insertItem: InsertItem): Promise<Item> {
    try {
      // 既存のアイテムIDの最大値を取得して新しいIDを生成
      const querySnapshot = await getDocs(this.itemsCol);
      let maxId = 0;
      querySnapshot.forEach((doc) => {
        const itemData = doc.data() as Item;
        if (itemData.id > maxId) {
          maxId = itemData.id;
        }
      });
      
      const id = maxId + 1;
      const createdAt = new Date();
      const item: Item = { 
        ...insertItem, 
        id,
        createdAt,
        isActive: insertItem.isActive ?? true,
        infiniteStock: insertItem.infiniteStock ?? false,
        price: insertItem.price ?? 0,
        stock: insertItem.stock ?? 0,
        options: insertItem.options ?? null,
        discordRoleId: insertItem.discordRoleId ?? null,
        content: insertItem.content ?? null,
        contentOptions: insertItem.contentOptions ?? null
      };
      
      await setDoc(doc(this.itemsCol, id.toString()), item);
      return item;
    } catch (error) {
      console.error('Error creating item:', error);
      throw error;
    }
  }

  async updateItem(id: number, itemUpdate: Partial<InsertItem>): Promise<Item | undefined> {
    try {
      const itemDoc = await getDoc(doc(this.itemsCol, id.toString()));
      if (!itemDoc.exists()) {
        return undefined;
      }
      
      const currentItem = itemDoc.data() as Item;
      const updatedItem: Item = { ...currentItem, ...itemUpdate };
      
      await updateDoc(doc(this.itemsCol, id.toString()), updatedItem);
      return updatedItem;
    } catch (error) {
      console.error('Error updating item:', error);
      return undefined;
    }
  }

  async deleteItem(id: number): Promise<boolean> {
    try {
      await deleteDoc(doc(this.itemsCol, id.toString()));
      return true;
    } catch (error) {
      console.error('Error deleting item:', error);
      return false;
    }
  }

  // Discordユーザー関連のメソッド
  async getDiscordUsers(): Promise<DiscordUser[]> {
    try {
      const querySnapshot = await getDocs(this.discordUsersCol);
      const discordUsers: DiscordUser[] = [];
      querySnapshot.forEach((doc) => {
        discordUsers.push(doc.data() as DiscordUser);
      });
      return discordUsers;
    } catch (error) {
      console.error('Error getting Discord users:', error);
      return [];
    }
  }

  async getDiscordUser(id: number): Promise<DiscordUser | undefined> {
    try {
      const userDoc = await getDoc(doc(this.discordUsersCol, id.toString()));
      if (userDoc.exists()) {
        return userDoc.data() as DiscordUser;
      }
      return undefined;
    } catch (error) {
      console.error('Error getting Discord user:', error);
      return undefined;
    }
  }

  async getDiscordUserByDiscordId(discordId: string): Promise<DiscordUser | undefined> {
    try {
      const q = query(this.discordUsersCol, where('discordId', '==', discordId));
      const querySnapshot = await getDocs(q);
      if (!querySnapshot.empty) {
        return querySnapshot.docs[0].data() as DiscordUser;
      }
      return undefined;
    } catch (error) {
      console.error('Error getting Discord user by Discord ID:', error);
      return undefined;
    }
  }

  async createDiscordUser(insertDiscordUser: InsertDiscordUser): Promise<DiscordUser> {
    try {
      // 既存のDiscordユーザーIDの最大値を取得して新しいIDを生成
      const querySnapshot = await getDocs(this.discordUsersCol);
      let maxId = 0;
      querySnapshot.forEach((doc) => {
        const userData = doc.data() as DiscordUser;
        if (userData.id > maxId) {
          maxId = userData.id;
        }
      });
      
      const id = maxId + 1;
      const createdAt = new Date();
      const discordUser: DiscordUser = { 
        ...insertDiscordUser, 
        id,
        createdAt,
        balance: insertDiscordUser.balance ?? 0
      };
      
      await setDoc(doc(this.discordUsersCol, id.toString()), discordUser);
      return discordUser;
    } catch (error) {
      console.error('Error creating Discord user:', error);
      throw error;
    }
  }

  async updateDiscordUserBalance(id: number, amount: number): Promise<DiscordUser | undefined> {
    try {
      const userDoc = await getDoc(doc(this.discordUsersCol, id.toString()));
      if (!userDoc.exists()) {
        return undefined;
      }
      
      const currentUser = userDoc.data() as DiscordUser;
      const newBalance = currentUser.balance + amount;
      const updatedUser: DiscordUser = { ...currentUser, balance: newBalance };
      
      await updateDoc(doc(this.discordUsersCol, id.toString()), { balance: newBalance });
      return updatedUser;
    } catch (error) {
      console.error('Error updating Discord user balance:', error);
      return undefined;
    }
  }

  async setDiscordUserBalance(id: number, balance: number): Promise<DiscordUser | undefined> {
    try {
      const userDoc = await getDoc(doc(this.discordUsersCol, id.toString()));
      if (!userDoc.exists()) {
        return undefined;
      }
      
      const currentUser = userDoc.data() as DiscordUser;
      const updatedUser: DiscordUser = { ...currentUser, balance };
      
      await updateDoc(doc(this.discordUsersCol, id.toString()), { balance });
      return updatedUser;
    } catch (error) {
      console.error('Error setting Discord user balance:', error);
      return undefined;
    }
  }

  async resetAllDiscordUserBalances(): Promise<number> {
    try {
      const querySnapshot = await getDocs(this.discordUsersCol);
      let count = 0;
      
      for (const document of querySnapshot.docs) {
        await updateDoc(doc(this.discordUsersCol, document.id), { balance: 0 });
        count++;
      }
      
      return count;
    } catch (error) {
      console.error('Error resetting all Discord user balances:', error);
      return 0;
    }
  }

  // トランザクション関連のメソッド
  async getTransactions(): Promise<Transaction[]> {
    try {
      const querySnapshot = await getDocs(this.transactionsCol);
      const transactions: Transaction[] = [];
      querySnapshot.forEach((doc) => {
        transactions.push(doc.data() as Transaction);
      });
      return transactions;
    } catch (error) {
      console.error('Error getting transactions:', error);
      return [];
    }
  }

  async getTransactionsByDiscordUser(discordUserId: number): Promise<Transaction[]> {
    try {
      const q = query(this.transactionsCol, where('discordUserId', '==', discordUserId));
      const querySnapshot = await getDocs(q);
      const transactions: Transaction[] = [];
      querySnapshot.forEach((doc) => {
        transactions.push(doc.data() as Transaction);
      });
      return transactions;
    } catch (error) {
      console.error('Error getting transactions by Discord user:', error);
      return [];
    }
  }

  async createTransaction(insertTransaction: InsertTransaction): Promise<Transaction> {
    try {
      // 既存のトランザクションIDの最大値を取得して新しいIDを生成
      const querySnapshot = await getDocs(this.transactionsCol);
      let maxId = 0;
      querySnapshot.forEach((doc) => {
        const transactionData = doc.data() as Transaction;
        if (transactionData.id > maxId) {
          maxId = transactionData.id;
        }
      });
      
      const id = maxId + 1;
      const createdAt = new Date();
      const transaction: Transaction = { 
        ...insertTransaction, 
        id, 
        createdAt,
        quantity: insertTransaction.quantity ?? 1 
      };
      
      await setDoc(doc(this.transactionsCol, id.toString()), transaction);
      return transaction;
    } catch (error) {
      console.error('Error creating transaction:', error);
      throw error;
    }
  }

  // ボット設定関連のメソッド
  async getBotSettings(guildId: string): Promise<BotSettings | undefined> {
    try {
      const settingsDoc = await getDoc(doc(this.botSettingsCol, guildId));
      if (settingsDoc.exists()) {
        return settingsDoc.data() as BotSettings;
      }
      return undefined;
    } catch (error) {
      console.error('Error getting bot settings:', error);
      return undefined;
    }
  }

  async createBotSettings(insertSettings: InsertBotSettings): Promise<BotSettings> {
    try {
      // 既存のボット設定IDの最大値を取得して新しいIDを生成
      const querySnapshot = await getDocs(this.botSettingsCol);
      let maxId = 0;
      querySnapshot.forEach((doc) => {
        const settingsData = doc.data() as BotSettings;
        if (settingsData.id > maxId) {
          maxId = settingsData.id;
        }
      });
      
      const id = maxId + 1;
      const settings: BotSettings = { 
        ...insertSettings, 
        id,
        isActive: insertSettings.isActive ?? true,
        currencyName: insertSettings.currencyName ?? 'コイン',
        prefix: insertSettings.prefix ?? '!'
      };
      
      await setDoc(doc(this.botSettingsCol, insertSettings.guildId), settings);
      return settings;
    } catch (error) {
      console.error('Error creating bot settings:', error);
      throw error;
    }
  }

  async updateBotSettings(guildId: string, settingsUpdate: Partial<InsertBotSettings>): Promise<BotSettings | undefined> {
    try {
      const settingsDoc = await getDoc(doc(this.botSettingsCol, guildId));
      if (!settingsDoc.exists()) {
        return undefined;
      }
      
      const currentSettings = settingsDoc.data() as BotSettings;
      const updatedSettings: BotSettings = { ...currentSettings, ...settingsUpdate };
      
      await updateDoc(doc(this.botSettingsCol, guildId), updatedSettings);
      return updatedSettings;
    } catch (error) {
      console.error('Error updating bot settings:', error);
      return undefined;
    }
  }
}