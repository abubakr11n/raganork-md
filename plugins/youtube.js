const {
  Module
} = require('../main');
const fs = require("fs");
const {
  MODE,
  HANDLERS,
  AUDIO_DATA,
  BOT_INFO
} = require('../config');
const ffmpeg = require('fluent-ffmpeg');
const {
  getString
} = require('./misc/lang');
const {
  getJson,
  searchYT,
  searchSong
} = require('./misc/misc');
const {
  ytTitle,
  downloadYT,
  dlSong,
  ytv,
  getResolutions
} = require('./misc/yt');
const Lang = getString('scrapers');
const {
  skbuffer,
  ytdlServer,
  getVideo,
  addInfo
} = require('raganork-bot');
const handler = HANDLERS !== 'false' ? HANDLERS.split("")[0] : "";
const fm = MODE == 'public' ? false : true;
const getID = /(?:http(?:s|):\/\/|)(?:(?:www\.|)youtube(?:\-nocookie|)\.com\/(?:watch\?.*(?:|\&)v=|embed|shorts\/|v\/)|youtu\.be\/)([-_0-9A-Za-z]{11})/;
Module({
  pattern: 'download ?(.*)',
  fromMe: fm,
  desc: "Download videos from the internet and compress into 100MB parts",
  usage: '.download <video_url>',
  use: 'download'
}, (async (message, match) => {
  if (!match[1]) return message.sendReply("_Please provide a valid video URL._");
  const videoUrl = match[1];
  await message.sendReply("_Downloading video..._");

  const filePath = './temp/video.mp4';
  const compressedPath = './temp/compressed';
  const compressedFilePrefix = 'part_';

  try {
    // Download video
    await downloadVideo(videoUrl, filePath);
    await message.sendReply("_Video downloaded successfully._");

    // Compress video into 100MB parts
    await compressVideo(filePath, compressedPath, compressedFilePrefix);
    await message.sendReply("_Video compressed into 100MB parts._");

    // Upload compressed parts
    await uploadCompressedParts(message, compressedPath, compressedFilePrefix);
  } catch (error) {
    console.error("Error:", error);
    await message.sendReply("_An error occurred during the download and compression process._");
  }

  // Clean up temporary files
  cleanUpFiles([filePath, compressedPath]);
}));

async function downloadVideo(videoUrl, filePath) {
  return new Promise((resolve, reject) => {
    ffmpeg(videoUrl)
      .format('mp4')
      .output(filePath)
      .on('end', () => resolve())
      .on('error', (error) => reject(error))
      .run();
  });
}

async function compressVideo(filePath, compressedPath, compressedFilePrefix) {
  return new Promise((resolve, reject) => {
    ffmpeg(filePath)
      .outputOptions('-fs', '100MB')
      .output(`${compressedPath}/${compressedFilePrefix}%03d.mp4`)
      .on('end', () => resolve())
      .on('error', (error) => reject(error))
      .run();
  });
}

async function uploadCompressedParts(message, compressedPath, compressedFilePrefix) {
  const files = fs.readdirSync(compressedPath);
  for (let i = 0; i < files.length; i++) {
    const file = files[i];
    const filePath = `${compressedPath}/${file}`;
    const fileSize = fs.statSync(filePath).size;

    // Check if the file size is within the desired limit (100MB)
    if (fileSize <= 100 * 1024 * 1024) {
      // Upload the file
      await message.sendReply(`_Uploading part ${i + 1}..._`);
      await message.reply(await skbuffer(fs.readFileSync(filePath)));
      await message.sendReply("_Part uploaded successfully._");
    } else {
      await message.sendReply(`_Skipping part ${i + 1} as it exceeds the size limit of 100MB._`);
    }
  }

  await message.sendReply("_All parts uploaded successfully._");
}

function cleanUpFiles(filePaths) {
  filePaths.forEach((filePath) => {
    fs.unlinkSync(filePath);
  });
}
