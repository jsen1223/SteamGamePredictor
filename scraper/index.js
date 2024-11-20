import fs from 'fs';
import axios from 'axios';
import { configDotenv } from 'dotenv';

configDotenv({})

const KEY = process.env.APIKEY
const GAME_URI = `http://api.steampowered.com/IPlayerService/GetOwnedGames/v0001/?key=${KEY}&steamid=${process.env.STEAMID}&format=json`

// Create a folder named "../train", and two folders inside it named "train" and "test"
fs.mkdirSync('../train', { recursive: true })
fs.mkdirSync('../train/train', { recursive: true })
fs.mkdirSync('../train/test', { recursive: true })

;(async () => {
  const { data } = await axios.get(GAME_URI)
  const { response } = data
  const { games } = response

  let i = 0

  // Get game details
  for (const game of games) {
    i++
    let URI = `http://store.steampowered.com/api/appdetails?key=${KEY}&format=json&appids=${game.appid}`
    let reviewUri = `https://store.steampowered.com/appreviews/${game.appid}?json=1`

    console.log(`Getting ${game.appid}`)

    if (gameAlreadyScraped(game.appid)) {
      console.log(`Skipping ${game.appid}`)
      continue
    }

    const { data: reviewData } = await axios.get(reviewUri)
    const review = reviewData.query_summary
    const pct = Math.round((review.total_positive / review.total_reviews) * 100)

    console.log(`Reviews for ${game.appid}: ${pct}%`)

    if (isNaN(pct)) {
      console.log(`No reviews for ${game.appid}`)
      continue
    }

    const { data } = await axios.get(URI)
    const images = data[game.appid]?.data?.screenshots

    if (!images || images.length === 0) {
      console.log(`No images for ${game.appid}`)
      continue
    }

    const isTest = trainOrTest()
    const folder = isTest ? 'test' : 'train'
    const gameFolder = `../train/${folder}/`

    console.log(`Moving ${game.appid} to ${gameFolder}`)

    fs.mkdirSync(gameFolder, { recursive: true })

    // Limit to 3
    let iCount = 0

    for (const image of images || []) {
      const imgUrl = image.path_thumbnail
      const extension = imgUrl.split('.').pop().split('?')[0]
      const fileName = `${game.appid}-${iCount}-${pct}.${extension}`
      const filePath = `${gameFolder}/${fileName}`

      await axios.get(imgUrl, { responseType: 'stream' }).then(response => {
        response.data.pipe(fs.createWriteStream(filePath))
      })

      if (iCount === 2) {
        break
      }

      iCount++
    }

    console.log('Done with game!')
    console.log(`=== ${i}/${games.length} ===`)
  }

  console.log('Done!')
})()

function gameAlreadyScraped(appid) {
  // Read the train and test folders
  const trainFolder = fs.readdirSync('../train/train')
  const testFolder = fs.readdirSync('../train/test')
  
  return trainFolder.some(file => file.startsWith(appid)) || testFolder.some(file => file.startsWith(appid))
}

function trainOrTest() {
  // 30% chance to be test, otherwise train
  return Math.random() < 0.3
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}