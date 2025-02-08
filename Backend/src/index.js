import dotenv from 'dotenv'
import connectDB from './db/index.js';
import { app } from './app.js';

dotenv.config({
    path: './env'
})

const port = process.env.PORT || 8080;

connectDB()
    .then(() => {
        app.listen(port, () => {
            console.log(`Server started on port : ${port}`)
        })
    })
    .catch((err) => {
        console.log("MONGO DB connection failed !!! ", err)
    })


// import express from 'express'

// const app = express();

// (async () => {
//     try {
//         await mongoose.connect(`${process.env.MONGODB_URL}/${DB_NAME}`)
//         app.on("error", (error) => {
//             console.log("ERROR: ", error)
//             throw error;
//         });

//         app.listen(process.env.PORT, () => {
//             console.log(`App is listening on port ${process.env.PORT}`)
//         })

//     } catch (error) {
//         console.error("ERROR: ", error)
//         throw error;
//     }
// })