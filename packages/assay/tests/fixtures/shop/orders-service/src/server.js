import express from 'express'
const app = express()
app.get('/orders/:id', (req, res) => res.json({ id: req.params.id }))
app.post('/orders', (req, res) => res.status(201).end())
app.listen(3000)
