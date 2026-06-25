# 📊 Call Insights Dashboard — Performance Golf

A permanent, searchable knowledge base for phone team call analysis.
Built with vanilla HTML/CSS/JS — no frameworks, no backend, fully compatible with GitHub Pages.

---

## 🚀 One-Time Setup: Deploy to GitHub Pages

### Step 1 — Create a GitHub Repository

1. Go to [github.com](https://github.com) and sign in
2. Click **"New repository"**
3. Name it: `call-insights` (or any name you prefer)
4. Set it to **Public**
5. Click **"Create repository"**

### Step 2 — Upload the Project Files

Option A — GitHub Web UI (easiest):
1. In your new repo, click **"uploading an existing file"**
2. Drag and drop the entire project folder contents
3. Make sure the structure is:
   ```
   index.html
   css/style.css
   js/app.js
   data/insights.json
   README.md
   ```
4. Click **"Commit changes"**

Option B — Git CLI:
```bash
cd call-insights-dashboard
git init
git add .
git commit -m "Initial deploy"
git branch -M main
git remote add origin https://github.com/YOUR_USERNAME/call-insights.git
git push -u origin main
```

### Step 3 — Enable GitHub Pages

1. Go to your repository on GitHub
2. Click **Settings** → **Pages** (left sidebar)
3. Under "Source", select **Deploy from a branch**
4. Branch: `main`, Folder: `/ (root)`
5. Click **Save**

Your permanent URL will be:
```
https://YOUR_USERNAME.github.io/call-insights/
```

**This URL never changes.** ✓

---

## 🔄 Updating: Add a New Insight

Every time you analyze new calls, follow this workflow:

### What you paste into Claude:

Give Claude the call analysis in any format. It will generate an updated `insights.json` with the new entry appended.

### What Claude returns:

A complete updated `data/insights.json` file.

### How to deploy the update:

**Option A — GitHub Web UI:**
1. Go to your repo on GitHub
2. Click on `data/insights.json`
3. Click the **pencil icon** (Edit)
4. Select all the text, paste the new JSON
5. Click **"Commit changes"**

Done — the website updates automatically within ~60 seconds.

**Option B — Git CLI:**
```bash
# Replace data/insights.json with the new file
git add data/insights.json
git commit -m "Add insight: [brief title]"
git push
```

---

## 📁 Project Structure

```
call-insights-dashboard/
├── index.html              ← Single page app shell (never changes)
├── css/
│   └── style.css           ← All styling (never changes)
├── js/
│   └── app.js              ← All logic: routing, filtering, rendering (never changes)
├── data/
│   └── insights.json       ← ⭐ THE ONLY FILE YOU EVER UPDATE
└── README.md
```

---

## 📋 insights.json Schema Reference

When Claude appends a new insight, it follows this structure:

```json
{
  "id": "insight-XXX",                    // unique ID (auto-increment)
  "date": "YYYY-MM-DD",                  // ISO date
  "title": "...",                         // descriptive title
  "campaign": "...",                      // campaign name
  "offer": "...",                         // specific offer
  "product": "...",                       // product name
  "funnel": "...",                        // Inbound / Outbound / Retention
  "team_member": "...",                   // team or rep name
  "call_type": "...",                     // Appointment Setting / Sales Close / etc.
  "call_duration": "...",                 // e.g. "8–14 min avg"
  "summary": "...",                       // paragraph summary
  "main_findings": ["..."],              // array of strings
  "positive_patterns": ["..."],          // array of strings
  "customer_objections": ["..."],        // array of strings
  "winning_language": ["..."],           // array of strings (can include quotes)
  "pain_points": ["..."],                // array of strings
  "buying_triggers": ["..."],            // array of strings
  "opportunities": ["..."],              // array of strings
  "recommendations": ["..."],            // array of strings
  "action_items": [                      // array of objects
    {
      "task": "...",
      "owner": "...",
      "due": "YYYY-MM-DD",
      "status": "Pending | In Progress | Completed"
    }
  ],
  "transcript_excerpts": [               // optional array of objects
    {
      "label": "...",
      "text": "..."
    }
  ],
  "tags": ["...", "..."]                 // searchable keyword tags
}
```

---

## 🔍 Features

| Feature | Description |
|---|---|
| **Search** | Full-text search across all fields in every insight |
| **Period filter** | Today / This Week / This Month / This Year / All Time |
| **Campaign filter** | Auto-populated from your data |
| **Offer filter** | Auto-populated from your data |
| **Product filter** | Auto-populated from your data |
| **Funnel filter** | Auto-populated from your data |
| **Team Member filter** | Auto-populated from your data |
| **Call Type filter** | Auto-populated from your data |
| **Homepage stats** | Total calls, action items, objections, teams |
| **Objection tracker** | Most common objections aggregated across all insights |
| **Buying triggers** | Most common triggers aggregated across all insights |
| **Topics cloud** | Clickable tag cloud — click to search |
| **Detail pages** | Full structured view of every insight field |
| **Action item table** | Tasks with owner, due date, status badge |
| **Transcript excerpts** | Optional monospace transcript snippets |
| **Responsive** | Works on desktop, tablet, and mobile |

---

## 🛠 Tech Stack

- **HTML5** — semantic shell, no templating engine
- **CSS3** — custom properties, grid, flexbox, animations
- **Vanilla JavaScript** — no frameworks, no dependencies
- **JSON** — all data in one flat file
- **GitHub Pages** — free, permanent hosting

**Zero dependencies. Zero build steps. Zero backend.**

---

## 💡 Prompt Template for Adding New Insights

When pasting a new call analysis into Claude, use this prompt:

```
Here is a new call analysis to add to my Call Insights Dashboard.
Please update my insights.json file by appending this new entry.
Keep all existing entries exactly as they are.
Return only the complete updated insights.json file.

[PASTE YOUR CALL ANALYSIS HERE]
```

Claude will return the complete updated `data/insights.json` — just replace the file on GitHub.
