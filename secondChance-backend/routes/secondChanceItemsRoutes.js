
const express = require('express')
const multer = require('multer')
const router = express.Router()
const connectToDatabase = require('../models/db')
const logger = require('../logger')

// Define the upload directory path
const directoryPath = 'public/images'

// Set up storage for uploaded files
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, directoryPath) // Specify the upload directory
  },
  filename: function (req, file, cb) {
    cb(null, file.originalname) // Use the original file name
  }
})

const upload = multer({ storage })

// Get all secondChanceItems
router.get('/', async (req, res, next) => {
  logger.info('/ called')
  try {
    const db = await connectToDatabase()
    const collection = db.collection('secondChanceItems')
    const secondChanceItems = await collection.find({}).toArray()
    res.json(secondChanceItems)
  } catch (e) {
    // se vuoi usare console:
    // console.error('oops something went wrong', e)
    logger.error('oops something went wrong', e)
    next(e)
  }
})

// Add a new item
router.post('/', upload.single('file'), async (req, res, next) => {
  try {
    const db = await connectToDatabase()
    const collection = db.collection('secondChanceItems')

    let secondChanceItem = req.body

    const lastItemQuery = await collection.find().sort({ id: -1 }).limit(1)
    await lastItemQuery.forEach(item => {
      secondChanceItem.id = (parseInt(item.id) + 1).toString()
    })

    const dateAdded = Math.floor(new Date().getTime() / 1000)
    secondChanceItem.date_added = dateAdded

    // NB: con driver MongoDB recenti insertOne ritorna { acknowledged, insertedId }
    // se altrove ti aspetti ops[0], adegua in base alla tua versione del driver
    const insertResult = await collection.insertOne(secondChanceItem)

    // se vuoi ritornare il documento creato, puoi rifare una findOne su insertedId, ma
    // qui mantengo la logica precedente: se usavi ops[0], probabilmente hai un driver vecchio
    res.status(201).json(insertResult)
  } catch (e) {
    next(e)
  }
})

// Get a single secondChanceItem by ID
router.get('/:id', async (req, res, next) => {
  try {
    const db = await connectToDatabase()
    const collection = db.collection('secondChanceItems')
    const id = req.params.id
    const secondChanceItem = await collection.findOne({ id })

    if (!secondChanceItem) {
      return res.status(404).send('secondChanceItem not found')
    }

    res.json(secondChanceItem)
  } catch (e) {
    next(e)
  }
})

// Update an existing item
router.put('/:id', async (req, res, next) => {
  try {
    const id = req.params.id
    const db = await connectToDatabase()
    const collection = db.collection('secondChanceItems')

    const existing = await collection.findOne({ id })
    if (!existing) {
      logger.error('secondChanceItem not found')
      return res.status(404).json({ error: 'secondChanceItem not found' })
    }

    existing.category = req.body.category
    existing.condition = req.body.condition
    existing.age_days = req.body.age_days
    existing.description = req.body.description
    existing.age_years = Number((existing.age_days / 365).toFixed(1))
    existing.updatedAt = new Date()

    const updateResult = await collection.findOneAndUpdate(
      { id },
      { $set: existing },
      { returnDocument: 'after' } // per driver < v4: useFindAndModify deprecato; per v4 va bene returnDocument
    )

    if (updateResult && updateResult.value) {
      res.status(200).json({ status: 'success' })
    } else {
      res.status(404).json({ error: "Errore durante l'aggiornamento" })
    }
  } catch (e) {
    next(e)
  }
})

// Delete an existing item (TODO)
router.delete('/:id', async (req, res, next) => {
  try {
    const id = req.params.id
    const db = await connectToDatabase()
    const collection = db.collection('secondChanceItems')

    const deleteResult = await collection.deleteOne({ id })
    if (deleteResult.deletedCount === 1) {
      return res.status(200).json({ status: 'deleted' })
    }
    return res.status(404).json({ error: 'secondChanceItem not found' })
  } catch (e) {
    next(e)
  }
})

module.exports = router
