import express from 'express';
import cors from 'cors';

const app = express();
app.use(cors());
app.use(express.json());

app.get('/', (req, res) => {
  res.send('Revenue Engine API is running live!');
});

app.post('/api/waitlist', (req, res) => {
  const { email } = req.body;
  console.log("Received email:", email);
  res.status(200).json({ success: true, message: "Saved!" });
});

const PORT = process.env.PORT || 10000;
app.listen(PORT, '0.0.0.0', () => {
  console.log(`Server running on port ${PORT}`);
});
