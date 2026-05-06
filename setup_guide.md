# 🚀 Setup & Testing Guide

Follow these steps to get your multi-tenant chatbot platform running and tested.

## 1. Backend Configuration (`backend/`)

1. Go to the `backend/` directory.
2. Create/update a [.env](file:///home/nishant/SOLOITECH/ai_chatbot/backend/.env) file (copy from [.env.example](file:///home/nishant/SOLOITECH/ai_chatbot/backend/.env.example)).
3. **Required Keys:**
   - `GEMINI_API_KEY`: Get one from [Google AI Studio](https://aistudio.google.com/).
   - `DB_HOST`, `DB_USERNAME`, `DB_PASSWORD`: Use your Neon or local Postgres credentials.
   - `DB_SSL=true`: **Crucial** if using Neon.
   - `JWT_SECRET`: A long random string.

## 2. Start the Services

Open two terminals:

**Terminal 1 (Backend):**
```bash
cd backend
npm install
npm run start:dev
```
*Should see: "Nest application successfully started"*

**Terminal 2 (Admin Panel):**
```bash
cd admin
npm install
npm run dev
```
*Should see: "Ready in ...ms"*

## 3. Testing the Flow

1. **Register/Login:**
   - Open `http://localhost:3001/register` and create an account.
   - Login to reach the Dashboard.

2. **Create your first Bot:**
   - Click **+ New Bot**, give it a name.
   - You'll see your `Bot ID` and `API Key`.

3. **Add Knowledge:**
   - Paste some text into the "Add Knowledge" area.
   - *Example: "Our store is open from 9 AM to 6 PM. We sell organic coffee."*

4. **Test the Widget (Self-Test):**
   - In the Bot Detail page, copy the **Embed Code**.
   - Create a file named `test.html` on your desktop:
     ```html
     <!DOCTYPE html>
     <html>
     <body>
       <h1>Bot Test</h1>
       <!-- PASTE YOUR EMBED CODE HERE -->
     </body>
     </html>
     ```
   - Open `test.html` in your browser. A chat bubble should appear in the bottom-right corner!

## 4. Verification Checklist

- [ ] **AI Context**: Ask the bot a question about your knowledge. It should answer using ONLY that info.
- [ ] **Rate Limiting**: Refresh the page 20 times quickly. You should eventually see a "Too Many Requests" error.
- [ ] **Logging**: Check `backend/logs/combined.log` to see your activity being recorded.
- [ ] **Usage**: After chatting, refresh the Bot Detail page to see the **Usage Metrics** update.
- [ ] **Pagination**: Add more than 10 knowledge chunks and verify the "Next" button appears.
- [ ] **Security**: Verify you cannot access another bot's ID via the URL if you aren't the owner.
