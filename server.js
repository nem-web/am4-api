import express from "express";
import runBot from "./bot.js";

const app = express();

app.get("/", (req, res) => {
    res.send("AM4 Bot API Running ✅");
});

app.get("/run", async (req, res) => {

    if (req.query.key !== process.env.SECRET_KEY) {
        return res.status(401).send("Unauthorized");
    }

    try {
        await runBot();
        res.send("✅ Bot executed");
    } catch (err) {
        console.error(err);
        res.status(500).send(err.message);
    }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
