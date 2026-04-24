import express from "express";
import runBot from "./bot.js";

const app = express();

app.get("/run", async (req, res) => {

    if (req.query.key !== process.env.SECRET_KEY) {
        return res.status(401).send("Unauthorized");
    }

    try {
        await runBot();
        res.send("✅ Bot executed");
    } catch (err) {
        res.status(500).send(err.message);
    }
});

app.listen(3000, () => console.log("Server running on port 3000"));
