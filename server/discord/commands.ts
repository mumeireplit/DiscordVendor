import { Client, SlashCommandBuilder, EmbedBuilder, CommandInteraction, REST, Routes, Collection, Message, ButtonBuilder, ButtonStyle, ActionRowBuilder, ComponentType, StringSelectMenuBuilder, StringSelectMenuOptionBuilder } from 'discord.js';
import { IStorage } from '../storage';
import { Item } from '@shared/schema';

// Discord内で使用するユーザーごとのカートを管理
interface CartItem {
  itemId: number;
  name: string;
  price: number;
  quantity: number;
}

interface UserCart {
  userId: string;
  items: CartItem[];
  lastUpdated: Date;
}

// メモリ内にカート情報を保持（再起動で消去）
const userCarts = new Map<string, UserCart>();

// カート関連のユーティリティ関数
function getUserCart(userId: string): UserCart {
  if (!userCarts.has(userId)) {
    userCarts.set(userId, {
      userId,
      items: [],
      lastUpdated: new Date()
    });
  }
  return userCarts.get(userId)!;
}

function addToCart(userId: string, item: Item, quantity: number = 1): UserCart {
  const cart = getUserCart(userId);
  const existingItem = cart.items.find(i => i.itemId === item.id);
  
  if (existingItem) {
    existingItem.quantity += quantity;
  } else {
    cart.items.push({
      itemId: item.id,
      name: item.name,
      price: item.price,
      quantity: quantity
    });
  }
  
  cart.lastUpdated = new Date();
  return cart;
}

function removeFromCart(userId: string, itemId: number, quantity: number = 1): UserCart {
  const cart = getUserCart(userId);
  const existingItemIndex = cart.items.findIndex(i => i.itemId === itemId);
  
  if (existingItemIndex !== -1) {
    const item = cart.items[existingItemIndex];
    
    if (item.quantity <= quantity) {
      // 数量がゼロ以下になる場合は商品自体を削除
      cart.items.splice(existingItemIndex, 1);
    } else {
      // そうでない場合は数量を減らす
      item.quantity -= quantity;
    }
  }
  
  cart.lastUpdated = new Date();
  return cart;
}

function clearCart(userId: string): void {
  userCarts.delete(userId);
}

function getCartTotal(userId: string): number {
  const cart = getUserCart(userId);
  return cart.items.reduce((total, item) => total + (item.price * item.quantity), 0);
}

// Extend Discord.js Client to add commands property
interface BotClient extends Client {
  commands: Collection<string, any>;
}

// Handle message commands with ! prefix
export async function handleCommand(message: Message, commandName: string, args: string[], storage: IStorage) {
  try {
    // Map commandName to the appropriate command function
    switch(commandName) {
      case 'show':
        await handleShowCommand(message, storage);
        break;
      case 'buy':
        await handleBuyCommand(message, args, storage);
        break;
      case 'cart':
        await handleCartCommand(message, args, storage);
        break;
      case 'checkout':
        await handleCheckoutCommand(message, storage);
        break;
      case 'balance':
        await handleBalanceCommand(message, storage);
        break;
      case 'add':
        await handleAddCommand(message, args, storage);
        break;
      case 'remove':
        await handleRemoveCommand(message, args, storage);
        break;
      case 'price':
        await handlePriceCommand(message, args, storage);
        break;
      case 'stock':
        await handleStockCommand(message, args, storage);
        break;
      case 'help':
        await handleHelpCommand(message);
        break;
      default:
        await message.reply('無効なコマンドです。利用可能なコマンド一覧は `!help` で確認できます。');
        break;
    }
  } catch (error) {
    console.error('Error handling command:', error);
    await message.reply('コマンドの実行中にエラーが発生しました。');
  }
}

// Show command for ! prefix
async function handleShowCommand(message: Message, storage: IStorage) {
  try {
    const items = await storage.getItems();
    const activeItems = items.filter(item => item.isActive);
    
    // Get bot settings or use defaults
    const guildSettings = await storage.getBotSettings(message.guildId || '');
    const currencyName = guildSettings?.currencyName || 'コイン';
    
    // Create embed for the vending machine
    const embed = new EmbedBuilder()
      .setTitle('自動販売機')
      .setDescription(`以下の商品が販売中です！購入するには \`!buy [商品ID] [数量(省略可)]\` を使用してください`)
      .setColor('#5865F2');
      
    // Add fields for each item
    activeItems.forEach(item => {
      const stockStatus = item.stock > 0 
        ? `在庫: ${item.stock}`
        : '在庫切れ';
        
      embed.addFields({
        name: `#${item.id.toString().padStart(3, '0')} ${item.name}`,
        value: `${item.description}\n価格: **${item.price} ${currencyName}** | ${stockStatus}`,
        inline: false
      });
    });
    
    // Get user balance
    const discordUser = await storage.getDiscordUserByDiscordId(message.author.id);
    if (discordUser) {
      embed.setFooter({ 
        text: `残高: ${discordUser.balance} ${currencyName}` 
      });
    }
    
    await message.reply({ embeds: [embed] });
  } catch (error) {
    console.error('Error in show command:', error);
    await message.reply('商品リストの取得中にエラーが発生しました。');
  }
}

// Buy command for ! prefix
async function handleBuyCommand(message: Message, args: string[], storage: IStorage) {
  try {
    // ヘルプテキスト
    if (args.length === 0 || args[0] === 'help') {
      return await message.reply('使用方法: `!buy [商品ID] [数量(省略可)]`\n例: `!buy 1 2` - ID:1の商品を2個購入\n複数商品の購入には `!cart` と `!checkout` コマンドが便利です。');
    }
    
    // Get item ID and quantity from arguments
    const itemId = parseInt(args[0]);
    const quantity = args.length > 1 ? parseInt(args[1]) : 1;
    
    if (isNaN(itemId) || isNaN(quantity) || quantity < 1) {
      return await message.reply('有効な商品IDと数量を指定してください。例: `!buy 1 2`');
    }
    
    // Get the item
    const item = await storage.getItem(itemId);
    if (!item) {
      return await message.reply('指定された商品が見つかりません。');
    }
    
    if (!item.isActive) {
      return await message.reply('この商品は現在販売停止中です。');
    }
    
    if (item.stock < quantity) {
      return await message.reply(`在庫が不足しています。現在の在庫: ${item.stock}`);
    }
    
    // Create confirmation buttons
    const confirmButton = new ButtonBuilder()
      .setCustomId('confirm_purchase')
      .setLabel('購入する')
      .setStyle(ButtonStyle.Success);
      
    const cancelButton = new ButtonBuilder()
      .setCustomId('cancel_purchase')
      .setLabel('キャンセル')
      .setStyle(ButtonStyle.Secondary);
    
    const row = new ActionRowBuilder<ButtonBuilder>().addComponents(confirmButton, cancelButton);
    
    // Send confirmation message
    const totalPrice = item.price * quantity;
    const confirmMessage = await message.reply({
      content: `${item.name} を ${quantity} 個、合計 ${totalPrice} コインで購入しますか？`,
      components: [row]
    });
    
    // Create button collector
    const filter = (i: { user: { id: string; }; }) => i.user.id === message.author.id;
    const collector = confirmMessage.createMessageComponentCollector({ 
      filter, 
      time: 30000, // 30秒間有効
      componentType: ComponentType.Button
    });
    
    // Handle button interactions
    collector.on('collect', async (interaction) => {
      if (interaction.customId === 'confirm_purchase') {
        // Get the user
        const discordUser = await storage.getDiscordUserByDiscordId(message.author.id);
        if (!discordUser) {
          await interaction.update({
            content: 'ユーザー情報が見つかりません。',
            components: []
          });
          return;
        }
        
        // Recheck item stock
        const updatedItem = await storage.getItem(itemId);
        if (!updatedItem || updatedItem.stock < quantity) {
          await interaction.update({
            content: '申し訳ありません。在庫状況が変更されました。',
            components: []
          });
          return;
        }
        
        // Check if user has enough balance
        if (discordUser.balance < totalPrice) {
          await interaction.update({
            content: `残高が不足しています。必要な金額: ${totalPrice} コイン、現在の残高: ${discordUser.balance} コイン`,
            components: []
          });
          return;
        }
        
        // Process purchase
        try {
          // Update user balance
          await storage.updateDiscordUserBalance(discordUser.id, -totalPrice);
          
          // Update item stock
          await storage.updateItem(item.id, { stock: item.stock - quantity });
          
          // Create transaction record
          await storage.createTransaction({
            discordUserId: discordUser.id,
            itemId: item.id,
            quantity: quantity,
            totalPrice: totalPrice
          });
          
          // If there's a Discord role ID associated with the item, give role to user
          if (item.discordRoleId && message.guild) {
            try {
              const member = await message.guild.members.fetch(message.author.id);
              await member.roles.add(item.discordRoleId);
            } catch (roleError) {
              console.error('Error adding role:', roleError);
              // Continue with the purchase even if role assignment fails
            }
          }
          
          // Get updated user info
          const updatedUser = await storage.getDiscordUser(discordUser.id);
          const newBalance = updatedUser ? updatedUser.balance : 0;
          
          // Update message
          await interaction.update({
            content: `✅ ${item.name} を ${quantity} 個購入しました！\n残高: ${newBalance} コイン`,
            components: []
          });
          
          // Create embed for public announcement
          const publicEmbed = new EmbedBuilder()
            .setTitle('🛒 商品が購入されました！')
            .setDescription(`${message.author.username} が ${item.name} を ${quantity} 個購入しました！`)
            .setColor('#3BA55C')
            .setTimestamp();
            
          await message.channel.send({ embeds: [publicEmbed] });
        } catch (error) {
          console.error('Error processing purchase:', error);
          await interaction.update({
            content: '購入処理中にエラーが発生しました。',
            components: []
          });
        }
      } else if (interaction.customId === 'cancel_purchase') {
        await interaction.update({
          content: '購入をキャンセルしました。',
          components: []
        });
      }
    });
    
    // Handle timeout
    collector.on('end', async (collected) => {
      if (collected.size === 0) {
        await confirmMessage.edit({
          content: '時間切れです。購入がキャンセルされました。',
          components: []
        });
      }
    });
  } catch (error) {
    console.error('Error in buy command:', error);
    await message.reply('購入処理中にエラーが発生しました。');
  }
}

// Cart command for ! prefix
async function handleCartCommand(message: Message, args: string[], storage: IStorage) {
  try {
    // ヘルプテキスト
    if (args.length > 0 && args[0] === 'help') {
      return await message.reply(
        '使用方法:\n' +
        '`!cart` - カートの内容を表示\n' +
        '`!cart add [商品ID] [数量(省略可)]` - カートに商品を追加\n' +
        '`!cart remove [商品ID] [数量(省略可)]` - カートから商品を削除\n' +
        '`!cart clear` - カートを空にする'
      );
    }
    
    const subCommand = args.length > 0 ? args[0].toLowerCase() : 'show';
    
    // サブコマンドに基づいて処理
    switch (subCommand) {
      case 'show':
        // カートの内容を表示
        const cart = getUserCart(message.author.id);
        
        if (cart.items.length === 0) {
          return await message.reply('カートは空です。`!show` で商品一覧を確認し、`!cart add [商品ID] [数量]` でカートに追加できます。');
        }
        
        // カート内容をEmbedで表示
        const cartEmbed = new EmbedBuilder()
          .setTitle('🛒 ショッピングカート')
          .setDescription(`${message.author.username} さんのカート内容:`)
          .setColor('#5865F2');
          
        let total = 0;
        cart.items.forEach(item => {
          const itemTotal = item.price * item.quantity;
          total += itemTotal;
          cartEmbed.addFields({
            name: `${item.name} (ID: ${item.itemId})`,
            value: `${item.quantity} 個 × ${item.price} コイン = ${itemTotal} コイン`
          });
        });
        
        cartEmbed.addFields({
          name: '合計',
          value: `${total} コイン`
        });
        
        cartEmbed.setFooter({
          text: '購入するには !checkout コマンドを使用してください'
        });
        
        // ボタンを追加
        const checkoutButton = new ButtonBuilder()
          .setCustomId('checkout')
          .setLabel('購入手続きへ')
          .setStyle(ButtonStyle.Success);
          
        const clearButton = new ButtonBuilder()
          .setCustomId('clear_cart')
          .setLabel('カートを空にする')
          .setStyle(ButtonStyle.Danger);
          
        const row = new ActionRowBuilder<ButtonBuilder>().addComponents(checkoutButton, clearButton);
        
        const cartMessage = await message.reply({
          embeds: [cartEmbed],
          components: [row]
        });
        
        // ボタンコレクターを作成
        const filter = (i: { user: { id: string; }; }) => i.user.id === message.author.id;
        const collector = cartMessage.createMessageComponentCollector({ 
          filter, 
          time: 60000, // 60秒間有効
          componentType: ComponentType.Button
        });
        
        collector.on('collect', async (interaction) => {
          if (interaction.customId === 'checkout') {
            await interaction.update({
              components: []
            });
            
            // チェックアウト処理を実行
            await handleCheckoutCommand(message, storage);
          } else if (interaction.customId === 'clear_cart') {
            clearCart(message.author.id);
            await interaction.update({
              content: 'カートを空にしました。',
              embeds: [],
              components: []
            });
          }
        });
        
        break;
        
      case 'add':
        // カートに商品を追加
        if (args.length < 2) {
          return await message.reply('使用方法: `!cart add [商品ID] [数量(省略可)]`');
        }
        
        const addItemId = parseInt(args[1]);
        const addQuantity = args.length > 2 ? parseInt(args[2]) : 1;
        
        if (isNaN(addItemId) || isNaN(addQuantity) || addQuantity < 1) {
          return await message.reply('有効な商品IDと数量を指定してください。');
        }
        
        // 商品情報を取得
        const itemToAdd = await storage.getItem(addItemId);
        if (!itemToAdd) {
          return await message.reply('指定された商品が見つかりません。');
        }
        
        if (!itemToAdd.isActive) {
          return await message.reply('この商品は現在販売停止中です。');
        }
        
        if (itemToAdd.stock < addQuantity) {
          return await message.reply(`在庫が不足しています。現在の在庫: ${itemToAdd.stock}`);
        }
        
        // カートに追加
        addToCart(message.author.id, itemToAdd, addQuantity);
        
        await message.reply(`${itemToAdd.name} を ${addQuantity} 個カートに追加しました！カートを確認するには \`!cart\` と入力してください。`);
        break;
        
      case 'remove':
        // カートから商品を削除
        if (args.length < 2) {
          return await message.reply('使用方法: `!cart remove [商品ID] [数量(省略可)]`');
        }
        
        const removeItemId = parseInt(args[1]);
        const removeQuantity = args.length > 2 ? parseInt(args[2]) : 1;
        
        if (isNaN(removeItemId) || isNaN(removeQuantity) || removeQuantity < 1) {
          return await message.reply('有効な商品IDと数量を指定してください。');
        }
        
        // カートから削除
        const userCart = getUserCart(message.author.id);
        const itemInCart = userCart.items.find(item => item.itemId === removeItemId);
        
        if (!itemInCart) {
          return await message.reply('指定された商品はカートに入っていません。');
        }
        
        removeFromCart(message.author.id, removeItemId, removeQuantity);
        
        await message.reply(`${itemInCart.name} を ${Math.min(removeQuantity, itemInCart.quantity)} 個カートから削除しました。`);
        break;
        
      case 'clear':
        // カートを空にする
        clearCart(message.author.id);
        await message.reply('カートを空にしました。');
        break;
        
      default:
        await message.reply('無効なサブコマンドです。`!cart help` でヘルプを表示します。');
        break;
    }
  } catch (error) {
    console.error('Error in cart command:', error);
    await message.reply('カート処理中にエラーが発生しました。');
  }
}

// Checkout command for ! prefix
async function handleCheckoutCommand(message: Message, storage: IStorage) {
  try {
    // カートの内容を取得
    const cart = getUserCart(message.author.id);
    
    if (cart.items.length === 0) {
      return await message.reply('カートは空です。`!show` で商品一覧を確認し、`!cart add [商品ID] [数量]` でカートに追加できます。');
    }
    
    // ユーザー情報を取得
    let discordUser = await storage.getDiscordUserByDiscordId(message.author.id);
    
    if (!discordUser) {
      // ユーザーが存在しない場合は作成
      discordUser = await storage.createDiscordUser({
        discordId: message.author.id,
        username: message.author.username,
        balance: 1000 // 初期残高
      });
    }
    
    // 合計金額を計算
    const total = getCartTotal(message.author.id);
    
    // 残高チェック
    if (discordUser.balance < total) {
      return await message.reply(`残高が不足しています。必要な金額: ${total} コイン、現在の残高: ${discordUser.balance} コイン`);
    }
    
    // 在庫チェック
    let stockError = false;
    const stockChecks = await Promise.all(cart.items.map(async (item) => {
      const dbItem = await storage.getItem(item.itemId);
      if (!dbItem || dbItem.stock < item.quantity) {
        stockError = true;
        return `${item.name}: 在庫不足（要求: ${item.quantity}、在庫: ${dbItem ? dbItem.stock : 0}）`;
      }
      return null;
    }));
    
    if (stockError) {
      const errorItems = stockChecks.filter(Boolean).join('\n');
      return await message.reply(`次の商品で在庫が不足しています:\n${errorItems}`);
    }
    
    // 確認メッセージを表示
    const confirmEmbed = new EmbedBuilder()
      .setTitle('🛒 購入確認')
      .setDescription('以下の内容で購入を確定しますか？')
      .setColor('#5865F2');
      
    cart.items.forEach(item => {
      const itemTotal = item.price * item.quantity;
      confirmEmbed.addFields({
        name: `${item.name}`,
        value: `${item.quantity} 個 × ${item.price} コイン = ${itemTotal} コイン`
      });
    });
    
    confirmEmbed.addFields(
      { name: '合計金額', value: `${total} コイン` },
      { name: '購入後残高', value: `${discordUser.balance - total} コイン` }
    );
    
    // 確認ボタンを追加
    const confirmButton = new ButtonBuilder()
      .setCustomId('confirm_checkout')
      .setLabel('購入確定')
      .setStyle(ButtonStyle.Success);
      
    const cancelButton = new ButtonBuilder()
      .setCustomId('cancel_checkout')
      .setLabel('キャンセル')
      .setStyle(ButtonStyle.Secondary);
    
    const row = new ActionRowBuilder<ButtonBuilder>().addComponents(confirmButton, cancelButton);
    
    const confirmMessage = await message.reply({
      embeds: [confirmEmbed],
      components: [row]
    });
    
    // ボタンコレクターを作成
    const filter = (i: { user: { id: string; }; }) => i.user.id === message.author.id;
    const collector = confirmMessage.createMessageComponentCollector({ 
      filter, 
      time: 60000, // 60秒間有効
      componentType: ComponentType.Button
    });
    
    collector.on('collect', async (interaction) => {
      if (interaction.customId === 'confirm_checkout') {
        try {
          // 再度ユーザー情報と在庫を確認
          const updatedUser = await storage.getDiscordUserByDiscordId(message.author.id);
          if (!updatedUser || updatedUser.balance < total) {
            await interaction.update({
              content: '残高が不足しています。',
              embeds: [],
              components: []
            });
            return;
          }
          
          // 在庫を再チェック
          let stockErrorFound = false;
          for (const item of cart.items) {
            const dbItem = await storage.getItem(item.itemId);
            if (!dbItem || dbItem.stock < item.quantity) {
              stockErrorFound = true;
              break;
            }
          }
          
          if (stockErrorFound) {
            await interaction.update({
              content: '申し訳ありません。在庫状況が変更されました。',
              embeds: [],
              components: []
            });
            return;
          }
          
          // 購入処理を実行
          // 1. 残高を減らす
          await storage.updateDiscordUserBalance(updatedUser.id, -total);
          
          // 2. 各商品の処理
          const transactions = [];
          for (const item of cart.items) {
            // 在庫を減らす
            const dbItem = await storage.getItem(item.itemId);
            if (dbItem) {
              await storage.updateItem(dbItem.id, { stock: dbItem.stock - item.quantity });
              
              // トランザクション記録を作成
              const transaction = await storage.createTransaction({
                discordUserId: updatedUser.id,
                itemId: dbItem.id,
                quantity: item.quantity,
                totalPrice: item.price * item.quantity
              });
              
              transactions.push(transaction);
              
              // ロールを付与（該当する場合）
              if (dbItem.discordRoleId && message.guild) {
                try {
                  const member = await message.guild.members.fetch(message.author.id);
                  await member.roles.add(dbItem.discordRoleId);
                } catch (roleError) {
                  console.error('Error adding role:', roleError);
                  // ロール付与に失敗しても購入処理は続行
                }
              }
            }
          }
          
          // 更新されたユーザー情報を取得
          const finalUser = await storage.getDiscordUser(updatedUser.id);
          
          // カートを空にする
          clearCart(message.author.id);
          
          // 成功メッセージを表示
          const successEmbed = new EmbedBuilder()
            .setTitle('✅ 購入完了')
            .setDescription('以下の商品の購入が完了しました！')
            .setColor('#3BA55C')
            .setTimestamp();
            
          cart.items.forEach(item => {
            successEmbed.addFields({
              name: item.name,
              value: `${item.quantity} 個`
            });
          });
          
          successEmbed.addFields({
            name: '合計金額',
            value: `${total} コイン`
          });
          
          if (finalUser) {
            successEmbed.addFields({
              name: '残高',
              value: `${finalUser.balance} コイン`
            });
          }
          
          await interaction.update({
            embeds: [successEmbed],
            components: []
          });
          
          // 購入通知を送信
          const publicEmbed = new EmbedBuilder()
            .setTitle('🛍️ 商品が購入されました！')
            .setDescription(`${message.author.username} が ${cart.items.length} 種類の商品を購入しました！`)
            .setColor('#3BA55C')
            .setTimestamp();
            
          await message.channel.send({ embeds: [publicEmbed] });
        } catch (error) {
          console.error('Error processing checkout:', error);
          await interaction.update({
            content: '購入処理中にエラーが発生しました。',
            embeds: [],
            components: []
          });
        }
      } else if (interaction.customId === 'cancel_checkout') {
        await interaction.update({
          content: '購入をキャンセルしました。',
          embeds: [],
          components: []
        });
      }
    });
    
    // タイムアウト処理
    collector.on('end', async (collected) => {
      if (collected.size === 0) {
        await confirmMessage.edit({
          content: '時間切れです。購入がキャンセルされました。',
          embeds: [],
          components: []
        });
      }
    });
  } catch (error) {
    console.error('Error in checkout command:', error);
    await message.reply('購入処理中にエラーが発生しました。');
  }
}

// Help command for ! prefix
async function handleHelpCommand(message: Message) {
  try {
    const helpEmbed = new EmbedBuilder()
      .setTitle('じはんきbot ヘルプ')
      .setDescription('利用可能なコマンド一覧')
      .setColor('#5865F2')
      .addFields(
        { name: '!show', value: '販売中の商品一覧を表示します' },
        { name: '!buy [商品ID] [数量]', value: '指定した商品を直接購入します' },
        { name: '!cart', value: '現在のカート内容を表示します' },
        { name: '!cart add [商品ID] [数量]', value: 'カートに商品を追加します' },
        { name: '!cart remove [商品ID] [数量]', value: 'カートから商品を削除します' },
        { name: '!cart clear', value: 'カートを空にします' },
        { name: '!checkout', value: 'カート内の商品を購入します' },
        { name: '!balance', value: '現在の残高を確認します' },
        { name: '!help', value: 'このヘルプメッセージを表示します' }
      )
      .setFooter({ text: 'じはんきbot by Replit' });
      
    // 管理者向けコマンド（オプション）
    // メッセージ送信者が管理者権限を持っている場合のみ表示
    if (message.member && message.member.permissions.has('Administrator')) {
      helpEmbed.addFields(
        { 
          name: '管理者コマンド', 
          value: '以下のコマンドは管理者のみ使用できます'
        },
        { name: '!add [名前] [説明] [価格] [在庫]', value: '新しい商品を追加します' },
        { name: '!price [商品ID] [新価格]', value: '商品の価格を変更します' },
        { name: '!stock [商品ID] [数量]', value: '商品の在庫を追加します' },
        { name: '!remove [商品ID]', value: '商品を削除します' }
      );
    }
    
    await message.reply({ embeds: [helpEmbed] });
  } catch (error) {
    console.error('Error in help command:', error);
    await message.reply('ヘルプ表示中にエラーが発生しました。');
  }
}

// Balance command for ! prefix
async function handleBalanceCommand(message: Message, storage: IStorage) {
  try {
    // Get the user
    const discordUser = await storage.getDiscordUserByDiscordId(message.author.id);
    if (!discordUser) {
      return await message.reply('ユーザー情報が見つかりません。');
    }
    
    // Get bot settings or use defaults
    const guildSettings = await storage.getBotSettings(message.guildId || '');
    const currencyName = guildSettings?.currencyName || 'コイン';
    
    // Send balance message
    await message.reply(`現在の残高: ${discordUser.balance} ${currencyName}`);
  } catch (error) {
    console.error('Error in balance command:', error);
    await message.reply('残高の確認中にエラーが発生しました。');
  }
}

// Add command for ! prefix
async function handleAddCommand(message: Message, args: string[], storage: IStorage) {
  try {
    // Check if user has admin permissions
    if (!message.member?.permissions.has('Administrator')) {
      return await message.reply('このコマンドは管理者のみ使用できます。');
    }
    
    // Example format: !add "Item Name" 500 "Item Description" 10 role_id
    // We need to parse more complex arguments with quotes
    const fullText = args.join(' ');
    const nameMatch = fullText.match(/"([^"]+)"/);
    
    if (!nameMatch) {
      return await message.reply('商品名を引用符で囲んで指定してください。例: `!add "プレミアムロール" 500 "説明文" 10`');
    }
    
    const name = nameMatch[1];
    const remainingText = fullText.replace(nameMatch[0], '').trim();
    const parts = remainingText.split(' ');
    
    const price = parseInt(parts[0]);
    if (isNaN(price) || price < 0) {
      return await message.reply('有効な価格を指定してください。');
    }
    
    const descMatch = remainingText.match(/"([^"]+)"/);
    if (!descMatch) {
      return await message.reply('説明文を引用符で囲んで指定してください。例: `!add "プレミアムロール" 500 "説明文" 10`');
    }
    
    const description = descMatch[1];
    const afterDesc = remainingText.replace(descMatch[0], '').trim().split(' ');
    
    const stock = parseInt(afterDesc[1]) || 0;
    const roleId = afterDesc[2] || null;
    
    // Create the item
    const item = await storage.createItem({
      name,
      description,
      price,
      stock,
      isActive: true,
      discordRoleId: roleId
    });
    
    await message.reply(`商品を追加しました：${item.name} (ID: ${item.id}, 価格: ${item.price} コイン)`);
  } catch (error) {
    console.error('Error in add command:', error);
    await message.reply('商品の追加中にエラーが発生しました。');
  }
}

// Remove command for ! prefix
async function handleRemoveCommand(message: Message, args: string[], storage: IStorage) {
  try {
    // Check if user has admin permissions
    if (!message.member?.permissions.has('Administrator')) {
      return await message.reply('このコマンドは管理者のみ使用できます。');
    }
    
    const itemId = parseInt(args[0]);
    if (isNaN(itemId)) {
      return await message.reply('有効な商品IDを指定してください。');
    }
    
    // Get the item first to check if it exists
    const item = await storage.getItem(itemId);
    if (!item) {
      return await message.reply('指定された商品が見つかりません。');
    }
    
    // Delete the item
    await storage.deleteItem(itemId);
    
    await message.reply(`商品を削除しました：${item.name} (ID: ${item.id})`);
  } catch (error) {
    console.error('Error in remove command:', error);
    await message.reply('商品の削除中にエラーが発生しました。');
  }
}

// Price command for ! prefix
async function handlePriceCommand(message: Message, args: string[], storage: IStorage) {
  try {
    // Check if user has admin permissions
    if (!message.member?.permissions.has('Administrator')) {
      return await message.reply('このコマンドは管理者のみ使用できます。');
    }
    
    const itemId = parseInt(args[0]);
    const newPrice = parseInt(args[1]);
    
    if (isNaN(itemId) || isNaN(newPrice)) {
      return await message.reply('有効な商品IDと価格を指定してください。例: `!price 1 500`');
    }
    
    if (newPrice < 0) {
      return await message.reply('価格は0以上の値を指定してください。');
    }
    
    // Get the item first to check if it exists
    const item = await storage.getItem(itemId);
    if (!item) {
      return await message.reply('指定された商品が見つかりません。');
    }
    
    // Update the item price
    const updatedItem = await storage.updateItem(itemId, { price: newPrice });
    
    await message.reply(`商品の価格を変更しました：${updatedItem?.name} (新価格: ${newPrice} コイン)`);
  } catch (error) {
    console.error('Error in price command:', error);
    await message.reply('価格の変更中にエラーが発生しました。');
  }
}

// Stock command for ! prefix
async function handleStockCommand(message: Message, args: string[], storage: IStorage) {
  try {
    // Check if user has admin permissions
    if (!message.member?.permissions.has('Administrator')) {
      return await message.reply('このコマンドは管理者のみ使用できます。');
    }
    
    const itemId = parseInt(args[0]);
    const quantity = parseInt(args[1]);
    
    if (isNaN(itemId) || isNaN(quantity)) {
      return await message.reply('有効な商品IDと在庫数を指定してください。例: `!stock 1 10`');
    }
    
    if (quantity < 0) {
      return await message.reply('在庫数は0以上の値を指定してください。');
    }
    
    // Get the item first to check if it exists
    const item = await storage.getItem(itemId);
    if (!item) {
      return await message.reply('指定された商品が見つかりません。');
    }
    
    // Update the item stock
    const updatedItem = await storage.updateItem(itemId, { stock: quantity });
    
    await message.reply(`商品の在庫数を変更しました：${updatedItem?.name} (新在庫数: ${quantity})`);
  } catch (error) {
    console.error('Error in stock command:', error);
    await message.reply('在庫数の変更中にエラーが発生しました。');
  }
}

// Register all commands with the Discord client
export async function registerCommands(client: BotClient) {
  // Show command - displays all items in the vending machine
  const showCommand = {
    data: new SlashCommandBuilder()
      .setName('show')
      .setDescription('販売中の商品リストを表示します'),
    async execute(interaction: CommandInteraction, storage: IStorage) {
      await interaction.deferReply();
      
      try {
        const items = await storage.getItems();
        const activeItems = items.filter(item => item.isActive);
        
        // Get bot settings or use defaults
        const guildSettings = await storage.getBotSettings(interaction.guildId || '');
        const currencyName = guildSettings?.currencyName || 'コイン';
        
        // Create embed for the vending machine
        const embed = new EmbedBuilder()
          .setTitle('自動販売機')
          .setDescription(`以下の商品が販売中です！購入するには \`!buy [商品ID]\` または \`!cart add [商品ID]\` を使用してください`)
          .setColor('#5865F2');
          
        // Add fields for each item
        activeItems.forEach(item => {
          const stockStatus = item.stock > 0 
            ? `在庫: ${item.stock}`
            : '在庫切れ';
            
          embed.addFields({
            name: `#${item.id.toString().padStart(3, '0')} ${item.name}`,
            value: `${item.description}\n価格: **${item.price} ${currencyName}** | ${stockStatus}`,
            inline: false
          });
        });
        
        // Get user balance
        const discordUser = await storage.getDiscordUserByDiscordId(interaction.user.id);
        if (discordUser) {
          embed.setFooter({ 
            text: `残高: ${discordUser.balance} ${currencyName}` 
          });
        }
        
        await interaction.editReply({ embeds: [embed] });
      } catch (error) {
        console.error('Error in show command:', error);
        await interaction.editReply('商品リストの取得中にエラーが発生しました。');
      }
    },
  };
  
  // Buy command - purchases an item from the vending machine
  const buyCommand = {
    data: new SlashCommandBuilder()
      .setName('buy')
      .setDescription('指定した商品を購入します')
      .addIntegerOption(option => 
        option.setName('item_id')
          .setDescription('購入する商品のID')
          .setRequired(true))
      .addIntegerOption(option => 
        option.setName('quantity')
          .setDescription('購入する数量')
          .setRequired(false)),
    async execute(interaction: CommandInteraction, storage: IStorage) {
      await interaction.deferReply({ ephemeral: true });
      
      try {
        // Get item ID and quantity from options
        const itemId = interaction.options.getInteger('item_id');
        const quantity = interaction.options.getInteger('quantity') || 1;
        
        if (!itemId || quantity < 1) {
          return await interaction.editReply('有効な商品IDと数量を指定してください。');
        }
        
        // Get the item
        const item = await storage.getItem(itemId);
        if (!item) {
          return await interaction.editReply('指定された商品が見つかりません。');
        }
        
        if (!item.isActive) {
          return await interaction.editReply('この商品は現在販売停止中です。');
        }
        
        if (item.stock < quantity) {
          return await interaction.editReply(`在庫が不足しています。現在の在庫: ${item.stock}`);
        }
        
        // Get the user
        const discordUser = await storage.getDiscordUserByDiscordId(interaction.user.id);
        if (!discordUser) {
          return await interaction.editReply('ユーザー情報が見つかりません。');
        }
        
        // Calculate total price
        const totalPrice = item.price * quantity;
        
        // Check if user has enough balance
        if (discordUser.balance < totalPrice) {
          return await interaction.editReply(`残高が不足しています。必要な金額: ${totalPrice} コイン、現在の残高: ${discordUser.balance} コイン`);
        }
        
        // Update user balance
        await storage.updateDiscordUserBalance(discordUser.id, -totalPrice);
        
        // Update item stock
        await storage.updateItem(item.id, { stock: item.stock - quantity });
        
        // Create transaction record
        await storage.createTransaction({
          discordUserId: discordUser.id,
          itemId: item.id,
          quantity: quantity,
          totalPrice: totalPrice
        });
        
        // If there's a Discord role ID associated with the item, give role to user
        if (item.discordRoleId && interaction.guild) {
          try {
            const member = await interaction.guild.members.fetch(interaction.user.id);
            await member.roles.add(item.discordRoleId);
          } catch (roleError) {
            console.error('Error adding role:', roleError);
            // Continue with the purchase even if role assignment fails
          }
        }
        
        // Send success message
        await interaction.editReply(`${item.name} を ${quantity} 個購入しました！残高: ${discordUser.balance - totalPrice} コイン`);
        
        // Send public message (optional)
        const publicEmbed = new EmbedBuilder()
          .setTitle('商品が購入されました！')
          .setDescription(`${interaction.user.username} が ${item.name} を ${quantity} 個購入しました！`)
          .setColor('#3BA55C');
          
        await interaction.channel?.send({ embeds: [publicEmbed] });
      } catch (error) {
        console.error('Error in buy command:', error);
        await interaction.editReply('購入処理中にエラーが発生しました。');
      }
    },
  };
  
  // Balance command - check user's balance
  const balanceCommand = {
    data: new SlashCommandBuilder()
      .setName('vending_balance')
      .setDescription('残高を確認します'),
    async execute(interaction: CommandInteraction, storage: IStorage) {
      await interaction.deferReply({ ephemeral: true });
      
      try {
        // Get the user
        const discordUser = await storage.getDiscordUserByDiscordId(interaction.user.id);
        if (!discordUser) {
          return await interaction.editReply('ユーザー情報が見つかりません。');
        }
        
        // Get bot settings or use defaults
        const guildSettings = await storage.getBotSettings(interaction.guildId || '');
        const currencyName = guildSettings?.currencyName || 'コイン';
        
        // Send balance message
        await interaction.editReply(`現在の残高: ${discordUser.balance} ${currencyName}`);
      } catch (error) {
        console.error('Error in balance command:', error);
        await interaction.editReply('残高の確認中にエラーが発生しました。');
      }
    },
  };
  
  // Admin commands - for managing items
  
  // Add item command
  const addCommand = {
    data: new SlashCommandBuilder()
      .setName('vending_add')
      .setDescription('新しい商品を追加します (管理者のみ)')
      .addStringOption(option => 
        option.setName('name')
          .setDescription('商品名')
          .setRequired(true))
      .addIntegerOption(option => 
        option.setName('price')
          .setDescription('価格')
          .setRequired(true))
      .addStringOption(option => 
        option.setName('description')
          .setDescription('商品の説明')
          .setRequired(true))
      .addIntegerOption(option => 
        option.setName('stock')
          .setDescription('在庫数')
          .setRequired(false))
      .addStringOption(option => 
        option.setName('role_id')
          .setDescription('付与するロールID (オプション)')
          .setRequired(false)),
    async execute(interaction: CommandInteraction, storage: IStorage) {
      await interaction.deferReply({ ephemeral: true });
      
      // Check if user has admin permissions
      if (!interaction.memberPermissions?.has('Administrator')) {
        return await interaction.editReply('このコマンドは管理者のみ使用できます。');
      }
      
      try {
        const name = interaction.options.getString('name', true);
        const price = interaction.options.getInteger('price', true);
        const description = interaction.options.getString('description', true);
        const stock = interaction.options.getInteger('stock') || 0;
        const roleId = interaction.options.getString('role_id') || null;
        
        // Create the item
        const item = await storage.createItem({
          name,
          description,
          price,
          stock,
          isActive: true,
          discordRoleId: roleId
        });
        
        await interaction.editReply(`商品を追加しました：${item.name} (ID: ${item.id}, 価格: ${item.price} コイン)`);
      } catch (error) {
        console.error('Error in add command:', error);
        await interaction.editReply('商品の追加中にエラーが発生しました。');
      }
    },
  };
  
  // Remove item command
  const removeCommand = {
    data: new SlashCommandBuilder()
      .setName('vending_remove')
      .setDescription('商品を削除します (管理者のみ)')
      .addIntegerOption(option => 
        option.setName('item_id')
          .setDescription('削除する商品のID')
          .setRequired(true)),
    async execute(interaction: CommandInteraction, storage: IStorage) {
      await interaction.deferReply({ ephemeral: true });
      
      // Check if user has admin permissions
      if (!interaction.memberPermissions?.has('Administrator')) {
        return await interaction.editReply('このコマンドは管理者のみ使用できます。');
      }
      
      try {
        const itemId = interaction.options.getInteger('item_id', true);
        
        // Get the item first to check if it exists
        const item = await storage.getItem(itemId);
        if (!item) {
          return await interaction.editReply('指定された商品が見つかりません。');
        }
        
        // Delete the item
        await storage.deleteItem(itemId);
        
        await interaction.editReply(`商品を削除しました：${item.name} (ID: ${item.id})`);
      } catch (error) {
        console.error('Error in remove command:', error);
        await interaction.editReply('商品の削除中にエラーが発生しました。');
      }
    },
  };
  
  // Update price command
  const priceCommand = {
    data: new SlashCommandBuilder()
      .setName('vending_price')
      .setDescription('商品の価格を変更します (管理者のみ)')
      .addIntegerOption(option => 
        option.setName('item_id')
          .setDescription('価格を変更する商品のID')
          .setRequired(true))
      .addIntegerOption(option => 
        option.setName('new_price')
          .setDescription('新しい価格')
          .setRequired(true)),
    async execute(interaction: CommandInteraction, storage: IStorage) {
      await interaction.deferReply({ ephemeral: true });
      
      // Check if user has admin permissions
      if (!interaction.memberPermissions?.has('Administrator')) {
        return await interaction.editReply('このコマンドは管理者のみ使用できます。');
      }
      
      try {
        const itemId = interaction.options.getInteger('item_id', true);
        const newPrice = interaction.options.getInteger('new_price', true);
        
        if (newPrice < 0) {
          return await interaction.editReply('価格は0以上の値を指定してください。');
        }
        
        // Get the item first to check if it exists
        const item = await storage.getItem(itemId);
        if (!item) {
          return await interaction.editReply('指定された商品が見つかりません。');
        }
        
        // Update the item price
        const updatedItem = await storage.updateItem(itemId, { price: newPrice });
        
        await interaction.editReply(`商品の価格を変更しました：${updatedItem?.name} (新価格: ${newPrice} コイン)`);
      } catch (error) {
        console.error('Error in price command:', error);
        await interaction.editReply('価格の変更中にエラーが発生しました。');
      }
    },
  };
  
  // Update stock command
  const stockCommand = {
    data: new SlashCommandBuilder()
      .setName('vending_stock')
      .setDescription('商品の在庫数を設定します (管理者のみ)')
      .addIntegerOption(option => 
        option.setName('item_id')
          .setDescription('在庫を変更する商品のID')
          .setRequired(true))
      .addIntegerOption(option => 
        option.setName('quantity')
          .setDescription('新しい在庫数')
          .setRequired(true)),
    async execute(interaction: CommandInteraction, storage: IStorage) {
      await interaction.deferReply({ ephemeral: true });
      
      // Check if user has admin permissions
      if (!interaction.memberPermissions?.has('Administrator')) {
        return await interaction.editReply('このコマンドは管理者のみ使用できます。');
      }
      
      try {
        const itemId = interaction.options.getInteger('item_id', true);
        const quantity = interaction.options.getInteger('quantity', true);
        
        if (quantity < 0) {
          return await interaction.editReply('在庫数は0以上の値を指定してください。');
        }
        
        // Get the item first to check if it exists
        const item = await storage.getItem(itemId);
        if (!item) {
          return await interaction.editReply('指定された商品が見つかりません。');
        }
        
        // Update the item stock
        const updatedItem = await storage.updateItem(itemId, { stock: quantity });
        
        await interaction.editReply(`商品の在庫数を変更しました：${updatedItem?.name} (新在庫数: ${quantity})`);
      } catch (error) {
        console.error('Error in stock command:', error);
        await interaction.editReply('在庫数の変更中にエラーが発生しました。');
      }
    },
  };
  
  // Register all commands with the client
  const commands = [
    showCommand,
    buyCommand,
    balanceCommand,
    addCommand,
    removeCommand,
    priceCommand,
    stockCommand
  ];
  
  // Add each command to the client.commands collection
  for (const command of commands) {
    client.commands.set(command.data.name, command);
  }
  
  try {
    // APIにコマンドを登録
    console.log('Started refreshing application (/) commands.');
    
    const commandsData = commands.map(command => command.data.toJSON());
    
    // RESTモジュールを使用してDiscord APIと通信
    const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_BOT_TOKEN || '');
    
    // グローバルコマンドとして登録（すべてのサーバーで利用可能）
    await rest.put(
      Routes.applicationCommands(client.user!.id),
      { body: commandsData },
    );
    
    console.log(`Successfully registered ${commands.length} application commands globally.`);
  } catch (error) {
    console.error('Error registering application commands:', error);
  }
  
  console.log(`Registered ${commands.length} vending machine commands`);
}
