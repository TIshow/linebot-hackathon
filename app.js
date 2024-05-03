'use strict';

require("dotenv").config();

const { createAndUploadRichMenu } = require('./richMenuSetup');
const { accessSpreadsheet, accessStorySpreadsheet, checkForSimilarDreams, fetchDreamsFromSpreadsheet } = require('./spreadsheet');

const OpenAI = require('openai');
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

const express = require('express');
const path = require('path');
const axios = require('axios');
const line = require('@line/bot-sdk');
const PORT = process.env.PORT || 3000;

const config = {
  channelSecret: process.env.LINE_CHANNEL_SECRET,
  channelAccessToken: process.env.LINE_CHANNEL_ACCESS_TOKEN
};

const app = express();
const client = new line.Client(config);

const sessions = {}; //instead of DB

app.get('/', async (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});
app.use('/liff', express.static(__dirname + '/public'))
app.get('/fetchDreams', async (req, res) => {
  const userId = req.query.userId;
  const dreams = await fetchDreamsFromSpreadsheet(userId);
  res.json(dreams);
});
app.post('/webhook', line.middleware(config), (req, res) => {
  Promise.all(req.body.events.map(event => {
      return handleEvent(event);
  })).then((result) => res.json(result));
});

const questions = [
  "夢であなたはどこにいましたか？",
  "誰が夢に現れましたか？",
  "そこであなたはなにをしていましたか？"
];

async function generateFreudianFeedback(story) {
  const feedback = await generatePsychologicalInterpretation(story); // generate feedback after analyzing keyword
  return feedback;
}

async function generatePsychologicalInterpretation(symbols) {
  const prompt = `Interpret these dream symbols psychologically based on Freud's Dream Interpretation in Japanese（日本語で回答）: ${symbols}`;
  const completion = await openai.chat.completions.create({
    model: "gpt-3.5-turbo",
    messages: [{ role: "system", content: prompt }]
  });
  return completion.choices[0].message.content;
}

async function handleEvent(event) {
  if (event.type !== 'message' || event.message.type !== 'text') {
      return Promise.resolve(null);
  }

  const userId = event.source.userId;
  const text = event.message.text;

  await accessSpreadsheet({ UserId: userId, Text: text, Timestamp: new Date().toISOString() });

  if (text === "夢日記をはじめます。") {
    sessions[userId] = {
      userId: userId,
      responses: [],
      questionIndex: 0
    };
    return client.replyMessage(event.replyToken, { type: 'text', text: "夢であなたはどこにいましたか？" });
  }

  if (!sessions[userId]) {
    sessions[userId] = {
      userId: userId,
      responses: [],
      questionIndex: 0  // question index
    };
  }

  const userSession = sessions[userId];

  if (userSession.questionIndex < questions.length) {
    userSession.responses.push(text);  // save user's answer
    userSession.questionIndex++;  // update question index
  }

  if (userSession.questionIndex < questions.length) {
    // next question
    return client.replyMessage(event.replyToken, { type: 'text', text: questions[userSession.questionIndex] });
  } else {
    // generate the story once the questions are completed
    const story = await generateStory(userSession.responses);
    const illustrationUrl = await generateIllustration(story);
    const feedback = await generateFreudianFeedback(story);

    sessions[userId] = null; // reset the session

    await accessStorySpreadsheet({ UserId: userId, Story: story, Timestamp: new Date().toISOString(), Feedback: feedback });
    const similarDreamsCount = await checkForSimilarDreams(story, new Date().toDateString());

    if (illustrationUrl) {
      // send url of text and illustration to LINE
      await client.replyMessage(event.replyToken, [
          { type: 'text', text: story },
          { type: 'image', originalContentUrl: illustrationUrl, previewImageUrl: illustrationUrl },
          { type: 'text', text: `フロイト夢分析:\n\n${feedback}` },
          { type: 'text', text: `あなたの他に、今日同じ夢を見た人が${similarDreamsCount - 1}人いました` },
      ]);
    } else {
        // if it's failed
        return client.replyMessage(event.replyToken, { type: 'text', text: story });
    }
  }
}

async function generateIllustration(prompt) {
  try {
      const response =  await openai.images.generate({
          model: "dall-e-3",
          prompt: prompt,
          n: 1,  // the number of images
          size: "1024x1024"  // size of image
      });
      return response.data[0].url;  // return url of generated image
  } catch (error) {
      console.error('Error generating illustration:', error);
      return null;
  }
}

async function generateStory(responses) {
  if (responses.length < 3) {
      // Error handling
      return "Error: Not enough data to generate a story. Please provide three parts.";
  }
  // Create the prompt based on user's answer
  const prompt = `Create a short story based on these elements in Japanese:\n1. Dream about: ${responses[0]}\n2. With: ${responses[1]}\n3. Doing: ${responses[2]}\n\nStory:`;
  
  const completion = await openai.chat.completions.create({
    model: "gpt-3.5-turbo",
    messages: [{ role: "system", content: prompt }]
  });
  
  return completion.choices[0].message.content;
}

app.listen(PORT, () => {
  console.log(`Server running at ${PORT}`);
  createAndUploadRichMenu().then(richMenuId => {
      console.log('Rich menu is set up with ID:', richMenuId);
  }).catch(err => {
      console.error('Failed to set up rich menu:', err);
  });
});