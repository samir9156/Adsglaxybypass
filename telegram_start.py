import sys
import asyncio
from pyrogram import Client
from pyrogram.raw.functions.messages import DeleteHistory

# Railway Variables se arguments aayenge
API_ID = int(sys.argv[1])
API_HASH = sys.argv[2]
SESSION_STRING = sys.argv[3]
BOT_LINK = sys.argv[4]

async def main():
    app = Client("userbot", api_id=API_ID, api_hash=API_HASH, session_string=SESSION_STRING)
    async with app:
        try:
            bot_username = BOT_LINK.split('/')[-1].split('?')[0]
            if not bot_username:
                print("[!] Invalid Bot Link")
                return

            # 1. Send /start to bot
            await app.send_message(bot_username, "/start")
            print(f"[✅] Sent /start to {bot_username}")
            await asyncio.sleep(3) # Wait for bot to reply

            # 2. Click 'English' button
            messages = [msg async for msg in app.get_chat_history(bot_username, limit=5)]
            for msg in messages:
                if msg.reply_markup and msg.reply_markup.inline_keyboard:
                    for row in msg.reply_markup.inline_keyboard:
                        for button in row:
                            if "english" in button.text.lower():
                                await msg.click(button.text)
                                print("[✅] Clicked 'English'")
                                break
            await asyncio.sleep(3) # Wait for main menu

            # 3. Find & Join 'Official Channel'
            channel_link = None
            messages = [msg async for msg in app.get_chat_history(bot_username, limit=5)]
            for msg in messages:
                if msg.reply_markup and msg.reply_markup.inline_keyboard:
                    for row in msg.reply_markup.inline_keyboard:
                        for button in row:
                            if "official channel" in button.text.lower():
                                if button.url:
                                    channel_link = button.url
                                break
            
            if channel_link:
                print(f"[+] Found Channel Link: {channel_link}")
                try:
                    # Join Channel
                    chat = await app.join_chat(channel_link)
                    print(f"[✅] Joined Channel: {chat.title}")
                    
                    # Wait 5 seconds
                    await asyncio.sleep(5)
                    
                    # Leave Channel
                    await app.leave_chat(chat.id)
                    print(f"[✅] Left Channel: {chat.title}")
                except Exception as e:
                    print(f"[!] Channel error: {e}")
            else:
                print("[!] Official Channel link not found in menu.")

            # 4. Delete Chat History (without blocking)
            peer = await app.resolve_peer(bot_username)
            await app.invoke(DeleteHistory(peer=peer, max_id=0, just_clear=True, revoke=True))
            print(f"[✅] Deleted Chat History with {bot_username}")

        except Exception as e:
            print(f"[!] Telegram Error: {e}")

if __name__ == "__main__":
    asyncio.run(main())
