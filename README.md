# US Number DNC Checker

A web tool to check multiple US phone numbers for DNC (Do Not Call) status automatically.

## Features
- ✅ Batch process multiple numbers
- ✅ Real-time progress tracking
- ✅ Three categories: Clean, DNC, Invalid
- ✅ Export results to text files
- ✅ Copy all results to clipboard
- ✅ Responsive design
- ✅ Local storage for persistence

## Setup

### Option 1: GitHub Pages (Easiest)
1. Upload `index.html`, `style.css`, `script.js` to GitHub repository
2. Enable GitHub Pages in repository settings
3. Your site will be live at: `https://username.github.io/repo-name`

### Option 2: Self Hosting
1. Upload all files to your web server
2. Access via your domain

### Option 3: WordPress
1. Create new page in WordPress
2. Switch to code editor
3. Copy-paste contents of `index.html`
4. Publish page

## API Configuration
Edit `script.js` to update API endpoints:
```javascript
const CONFIG = {
    apiEndpoints: {
        tcpa: 'your-api-endpoint',
        person: 'your-api-endpoint',
        // ... more endpoints
    }
};
