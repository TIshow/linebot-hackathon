const { GoogleSpreadsheet } = require('google-spreadsheet');
const { JWT } = require('google-auth-library');
const levenshtein = require('fast-levenshtein');

const SPREADSHEET_ID = '1yH3fseXVWv5cT8thGWdET5H0omkXl8Qi1_dxSn6vEiY';
const creds = require('./linebot-hackathon-420909-c914b5501f26.json');

// Initialize auth - see https://theoephraim.github.io/node-google-spreadsheet/#/guides/authentication
const serviceAccountAuth = new JWT({
  // env var values here are copied from service account credentials generated by google
  // see "Authentication" section in docs for more info
  email: creds.client_email,
  key: creds.private_key,
  scopes: [
    'https://www.googleapis.com/auth/spreadsheets',
  ],
});

const doc = new GoogleSpreadsheet(SPREADSHEET_ID, serviceAccountAuth);

async function accessSpreadsheet(data) {
  await doc.loadInfo();

  const sheet = doc.sheetsByIndex[0];

  await sheet.addRow(data);
}

async function accessStorySpreadsheet(data) {
  await doc.loadInfo();

  const sheet = doc.sheetsByIndex[1];

  await sheet.addRow(data);
}

async function fetchAllDreams() {
  await doc.loadInfo();
  const sheet = doc.sheetsByIndex[1];
  const rows = await sheet.getRows();

  return rows.map(row => ({
    UserId: row.get('UserId'),
    Story: row.get('Story'),
    Timestamp: new Date(row.get('Timestamp')).toDateString(),
    Feedback: row.get('Feedback'),
  }));
}

function calculateSimilarity(dream1, dream2) {
  if (!dream1 || !dream2) return 0; // どちらかの夢の内容が undefined の場合、類似度は 0 とする

  // Calculate the Levenshtein distance
  const distance = levenshtein.get(dream1, dream2);
  const maxLen = Math.max(dream1.length, dream2.length);
  return (maxLen - distance) / maxLen;  // Normalize the distance
}

function findSimilarDreams(dreams, userDream) {
  const threshold = 0.5; // similarity threshold
  const similarDreams = [];

  for (const entry of dreams) {
    if (entry.Story) {
      const similarity = calculateSimilarity(entry.Story, userDream);
      if (similarity >= threshold) {
        similarDreams.push(entry);
      }
    }
  }

  return similarDreams;
}

async function countSimilarDreamsOnSameDay(userDream, userDate) {
  const allDreams = await fetchAllDreams();
  const threshold = 0.7;
  let count = 0;

  allDreams.forEach(dream => {
    if (dream.Timestamp === userDate) {
      const similarity = calculateSimilarity(dream.Story, userDream);
      console.log(`Dream: ${dream.Story}, Similarity: ${similarity}`);
      if (similarity >= threshold) {
        count++;
      }
    }
  });

  return count;
}

async function checkForSimilarDreams(userDream, userDate) {
  const allDreams = await fetchAllDreams();
  // const similarDreams = findSimilarDreams(allDreams, userDream);
  const similarDreamsCount = countSimilarDreamsOnSameDay(userDream, userDate)

  return similarDreamsCount;
}

async function fetchDreamsFromSpreadsheet(userId) {
  await doc.loadInfo();
  const sheet = doc.sheetsByIndex[1];  // Index 1 for the sheet with dreams
  const rows = await sheet.getRows();

  // Filter rows to only include those matching the provided userId
  const userDreams = rows.filter(row => row.get('UserId') === userId).map(row => ({
    Story: row.get('Story'),
    Timestamp: row.get('Timestamp'),
    Feedback: row.get('Feedback'),
  }));

  return userDreams;
}


accessSpreadsheet().catch(console.error);
module.exports = { accessSpreadsheet, accessStorySpreadsheet, checkForSimilarDreams, fetchDreamsFromSpreadsheet };