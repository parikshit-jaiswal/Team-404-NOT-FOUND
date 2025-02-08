import express, { urlencoded } from 'express'
import cors from 'cors'
import cokkieParser from 'cookie-parser'
import axios from 'axios';


const app = express()

app.use(cors({
    origin: process.env.CORS_ORIGIN,
    credentials: true
}))

app.use(express.json({ limit: "16kb" }))
app.use(express.urlencoded({ extended: true, limit: "16kb" }))
app.use(express.static("public"))
app.use(cokkieParser());

// routes import
import userRouter from './routes/user.routes.js'


// routes declaration
app.use('/api/v1/users', userRouter)


app.post('/api/v1/chat', async (req, res) => {
    if (!req.body) {
        return res.status(400).send('No request body');
    }

    const { text, behavior = "Medical" } = req.body;


    const behaviorInstructions = {
        Medical: "Your name is Prana AI ,You are a medical asistanct and behave so and dont answer any questions on topic other than medical and guidenece related to health keep it short and crisp and answer this question",
        Casual: "Your name is Prana AI,You are a asistant of a mediical company and asist accordingly dont answer any vulger and question un related to health and doctor keeping all this in mind answer this ",
    };

    const prompt = `${behaviorInstructions[behavior] || "You are a helpful assistant."} ${text}`;

    try {
        const apiKey = process.env.APIKEY;
        const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-pro:generateContent?key=${apiKey}`;

        const postData = {
            "contents": [
                {
                    "parts": [
                        {
                            "text": prompt
                        }
                    ]
                }
            ]
        };

        const response = await axios.post(apiUrl, postData, {
            headers: {
                'Content-Type': 'application/json'
            }
        });

        res.json({ reply: response.data });
    } catch (error) {
        res.status(500).send('Failed to fetch response');
    }
});



export { app };

