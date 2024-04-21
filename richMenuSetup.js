const line = require("@line/bot-sdk");
const fs = require("fs");

const config = {
  channelAccessToken: process.env.LINE_CHANNEL_ACCESS_TOKEN,
  channelSecret: process.env.LINE_CHANNEL_SECRET
};

async function createAndUploadRichMenu() {
  const client = new line.Client(config);

  const WIDTH = 2500;
  const HEIGHT = 1686;

  try {
    const richMenu = {
      size: { width: WIDTH, height: HEIGHT },
      selected: true,
      name: "Menu",
      chatBarText: "メニュー",
      areas: [
        {
          bounds: { x: 0, y: 0, width: 1250, height: 1686 },
          action: { type: "message", text: "夢日記をはじめます。" }
        },
        {
          bounds: { x: 1250, y: 0, width: 1250, height: 1686 },
          action: { type: "uri", uri: "https://liff.line.me/2004698497-4e8mJBR3" }
        }
      ]
    };

    const richMenuId = await client.createRichMenu(richMenu);
    console.log("Rich Menu created, ID:", richMenuId);

    const imagePath = './richmenu.png'; 
    const imageBuffer = fs.readFileSync(imagePath);
    await client.setRichMenuImage(richMenuId, imageBuffer);
    console.log("Rich Menu Image uploaded.");

    await client.setDefaultRichMenu(richMenuId);
    console.log("Rich Menu set as default.");
  } catch (error) {
    console.error("Error in creating/uploading Rich Menu:", error);
  }
}

module.exports = { createAndUploadRichMenu };