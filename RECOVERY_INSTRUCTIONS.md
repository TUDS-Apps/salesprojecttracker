# Firebase Project Recovery Instructions

## If Original Project is Inaccessible:

### Option 1: Create New Firebase Project
1. Go to https://console.firebase.google.com/
2. Click "Create a project"
3. Name it "sales-project-tracker-2" (or similar)
4. Follow setup wizard
5. Create a Firestore database (choose production mode)
6. Get new configuration values

### Option 2: Check for Data Recovery
- Firebase projects aren't immediately deleted
- Check: https://console.cloud.google.com/projects
- Look for "sales-project-tracker" in ALL or DELETED projects
- If found in deleted, you may be able to restore it

### To Update Your App with New Firebase:

1. Get new config from Firebase Console > Project Settings > Your Apps
2. Update src/firebase.js with new values:
   - apiKey
   - authDomain  
   - projectId
   - storageBucket
   - messagingSenderId
   - appId

3. Set Firestore Rules (in Firebase Console > Firestore > Rules):
```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /{document=**} {
      allow read, write: if request.time < timestamp.date(2025, 12, 31);
    }
  }
}
```

## Data Recovery Options:

1. **From Local Browser Cache:**
   - Open browser DevTools (F12)
   - Application tab > Local Storage
   - Look for any cached data

2. **From Export Backup:**
   - Check Downloads folder for any "project-tracker-backup-*.json" files
   - These can be reimported manually

3. **From Browser History:**
   - Check if app still works locally with cached data
   - Use Export button if data is visible

## Prevent Future Loss:
1. Set up authentication
2. Regular automated backups
3. Proper security rules
4. Monitor Firebase usage/billing