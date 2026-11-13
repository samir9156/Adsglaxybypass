import sys
from pyrogram import Client
from pyrogram.raw.functions.messages import DeleteHistory

# Aapka session string (Railway Variables se aayega)
API_ID = int(sys.argv[1])
API_HASH = sys.argv[2]
SESSION_STRING = sys.argv[3]
BOT_LINK = sys.argv[4]

async def main():
    app = Client("userbot", api_id=API_ID, api_hash=API_HASH, session_string=SESSION_STRING)
    async with app:
        try:
            # Bot link se username nikalna (t.me/username)
            bot_username = BOT_LINK.split('/')[-1].split('?')[0]
            if not bot_username:
                print("[!] Invalid Bot Link")
                return

            # Bot ko /start bhejna
            await app.send_message(bot_username, "/start")
            print(f"[✅] Started bot: {bot_username}")
            
            # Thoda wait karein taaki bot reply kare
            import asyncio
            await asyncio.sleep(3)

            # Chat delete karna (User ID nikal kar)
            peer = await app.resolve_peer(bot_username)
            await app.invoke(DeleteHistory(peer=peer, max_id=0, just_clear=True, revoke=True))
            print(f"[✅] Chat deleted with: {bot_username}")
            
        except Exception as e:
            print(f"[!] Telegram Error: {e}")

if __name__ == "__main__":
    import asyncio
    asyncio.run(main())
